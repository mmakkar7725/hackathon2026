import { medicalDictionary } from "@/data/medicalDictionary";
import { DemographicsRecord, MedicalHistoryRecord } from "@/types/intake";

function findFirstMatch(input: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = input.match(expression);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractPatientName(text: string) {
  const candidates = [
    /^\s*name\s*[:#-]\s*([^\n\r]+)/im,
    /^\s*patient\s*name\s*[:#-]\s*([^\n\r]+)/im,
    /^\s*patient\s*[:#-]\s*([^\n\r]+)/im,
  ];

  for (const regex of candidates) {
    const match = text.match(regex);
    const value = match?.[1]?.trim();
    if (!value) {
      continue;
    }

    const lower = value.toLowerCase();
    const looksLikeHeader = /clinical\s+record|confidential|follow-?up|diagnosis/i.test(lower);
    if (looksLikeHeader) {
      continue;
    }

    if (/^[A-Za-z][A-Za-z ,.'-]{1,80}$/.test(value)) {
      const normalized = value.replace(/\s+/g, " ").trim();
      const commaFormat = normalized.match(/^([A-Za-z .'-]+),\s*([A-Za-z .'-]+)$/);
      if (commaFormat) {
        return `${commaFormat[2].trim()} ${commaFormat[1].trim()}`;
      }

      return normalized;
    }
  }

  return undefined;
}

function normalizeGender(input?: string): DemographicsRecord["gender"] {
  if (!input) {
    return undefined;
  }

  const lower = input.toLowerCase();
  if (lower.startsWith("m")) {
    return "male";
  }
  if (lower.startsWith("f")) {
    return "female";
  }

  return "other";
}

function extractDiagnosisFromIcdLines(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}) {
  const entries: MedicalHistoryRecord[] = [];
  const regex =
    /(?:\d+\.\s*)?([A-Za-z0-9 ,()'\/-]+?)\s*\(ICD(?:-|\s*)10\s*:\s*([A-Z][0-9]{1,2}(?:\.[0-9A-Z]+)?)\)(?:[^\n]*?(?:Diagnosed|Onset)\s*([0-9]{4}-[0-9]{2}-[0-9]{2}))?/gi;

  let match: RegExpExecArray | null = regex.exec(input.text);
  let index = 0;

  while (match) {
    const condition = match[1]?.trim();
    const code = match[2]?.trim();
    const onsetDate = match[3]?.trim();

    if (condition && code) {
      entries.push({
        id: `med-icd-${input.now}-${index}`,
        sourceFileName: input.sourceFileName,
        patientId: input.patientId,
        condition,
        codeSystem: "ICD10",
        code,
        onsetDate,
        note: "Extracted from ICD-10 diagnosis line.",
        extractedAt: input.now,
      });
      index += 1;
    }

    match = regex.exec(input.text);
  }

  return entries;
}

function extractAge(text: string) {
  return findFirstMatch(text, [
    /age\s*[:#-]?\s*(\d{1,3})/i,
    /\b(\d{1,3})\s*(?:y\/?o|yo|years?\s+old|year\s+old)\b/i,
  ]);
}

function extractGenderRaw(text: string) {
  const explicit = findFirstMatch(text, [/gender\s*[:#-]?\s*([A-Za-z]+)/i, /sex\s*[:#-]?\s*([A-Za-z]+)/i]);
  if (explicit) {
    return explicit;
  }

  const shorthand = text.match(/\b\d{1,3}\s*(?:y\/?o|yo|years?\s+old)\s*([WBAH]?[MF])\b/i);
  if (shorthand?.[1]) {
    const value = shorthand[1].toUpperCase();
    if (value.endsWith("M")) {
      return "male";
    }
    if (value.endsWith("F")) {
      return "female";
    }
  }

  return undefined;
}

function extractProblemListConditions(text: string) {
  const conditions: string[] = [];
  const sections = [
    /(?:Initial Problem List|Revised Problem List)([\s\S]*?)(?:Assessment and Differential Diagnosis|Plan:|$)/gi,
    /Assessment and Differential Diagnosis([\s\S]*?)(?:Plan:|$)/gi,
  ];

  for (const sectionRegex of sections) {
    let sectionMatch = sectionRegex.exec(text);
    while (sectionMatch) {
      const sectionBody = sectionMatch[1] ?? "";
      const itemRegex = /^\s*\d+\.\s+([^\n\r]{3,120})/gm;
      let itemMatch = itemRegex.exec(sectionBody);

      while (itemMatch) {
        const raw = itemMatch[1].trim();
        const cleaned = raw
          .replace(/\s{2,}/g, " ")
          .replace(/\.$/, "")
          .trim();

        const isInstruction = /^(this list|in the assessment|you should|although|always|comment|follow this pattern)/i.test(cleaned);
        if (!isInstruction && cleaned.length >= 3) {
          conditions.push(cleaned);
        }

        itemMatch = itemRegex.exec(sectionBody);
      }

      sectionMatch = sectionRegex.exec(text);
    }
  }

  return Array.from(new Set(conditions.map((item) => item.toLowerCase()))).map((normalized) => {
    const match = conditions.find((entry) => entry.toLowerCase() === normalized);
    return match ?? normalized;
  });
}

export function parseTextToRecords(input: {
  text: string;
  sourceFileName: string;
}) {
  const text = input.text;
  const lower = text.toLowerCase();
  const now = Date.now();

  const patientId =
    findFirstMatch(text, [/patient\s*id\s*[:#-]?\s*([A-Za-z0-9-]+)/i, /mrn\s*[:#-]?\s*([A-Za-z0-9-]+)/i]) ??
    `PT-${now}`;

  const fullName = extractPatientName(text) ?? "Unknown Patient";

  const ageRaw = extractAge(text);
  const genderRaw = extractGenderRaw(text);
  const dob = findFirstMatch(text, [/dob\s*[:#-]?\s*([0-9/\-]+)/i, /date of birth\s*[:#-]?\s*([0-9/\-]+)/i]);

  const demographics: DemographicsRecord[] = [
    {
      id: `demo-${now}`,
      sourceFileName: input.sourceFileName,
      patientId,
      fullName,
      age: ageRaw ? Number(ageRaw) : undefined,
      gender: normalizeGender(genderRaw),
      dateOfBirth: dob,
      extractedAt: now,
    },
  ];

  const icdFromText = extractDiagnosisFromIcdLines({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  const dictionaryMatches: MedicalHistoryRecord[] = medicalDictionary
    .filter((entry) => entry.synonyms.some((synonym) => lower.includes(synonym)))
    .map((entry, index) => ({
      id: `med-dict-${now}-${index}`,
      sourceFileName: input.sourceFileName,
      patientId,
      condition: entry.name,
      codeSystem: entry.codingSystem,
      code: entry.code,
      note: "Detected via fallback text parser.",
      extractedAt: now,
    }));

  const problemListMatches: MedicalHistoryRecord[] = extractProblemListConditions(text).map((condition, index) => ({
    id: `med-problem-${now}-${index}`,
    sourceFileName: input.sourceFileName,
    patientId,
    condition,
    codeSystem: "UNKNOWN",
    code: "N/A",
    note: "Extracted from problem list/assessment section.",
    extractedAt: now,
  }));

  const uniqueByCode = new Map<string, MedicalHistoryRecord>();
  for (const record of [...icdFromText, ...dictionaryMatches, ...problemListMatches]) {
    const key =
      record.codeSystem === "UNKNOWN" && record.code === "N/A"
        ? `${record.codeSystem}:${record.code}:${record.condition.toLowerCase()}`
        : `${record.codeSystem}:${record.code}`;
    if (!uniqueByCode.has(key)) {
      uniqueByCode.set(key, record);
    }
  }

  const medicalHistory = Array.from(uniqueByCode.values());

  if (medicalHistory.length === 0) {
    medicalHistory.push({
      id: `med-${now}-0`,
      sourceFileName: input.sourceFileName,
      patientId,
      condition: "General clinical history entry",
      codeSystem: "UNKNOWN",
      code: "N/A",
      note: "No mapped condition detected. Review source document manually.",
      extractedAt: now,
    });
  }

  return {
    demographics,
    medicalHistory,
  };
}
