import { medicalDictionary } from "@/data/medicalDictionary";
import {
  normalizeAge,
  normalizeDateOfBirth,
  normalizeLocationLabel,
  normalizeStateAbbreviation,
  normalizeZipCode,
} from "@/services/demographics";
import { DemographicsRecord, MedicalHistoryRecord } from "@/types/intake";

function normalizeClinicalText(raw: string) {
  return raw
    .replace(/<PARSED TEXT FOR PAGE:[^>]+>/gi, "")
    .replace(/\r/g, "\n")
    .replace(/\uFFFD/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
  // 1. Try split first / last name fields (both generated PDFs and handwritten summaries)
  const firstName = findFirstMatch(text, [
    /patient\s*first\s*name\s*[:#-]\s*([^\n\r]+)/i,
    /first\s*name\s*[:#-]\s*([^\n\r]+)/i,
  ])?.trim();
  const lastName = findFirstMatch(text, [
    /patient\s*last\s*name\s*[:#-]\s*([^\n\r]+)/i,
    /last\s*name\s*[:#-]\s*([^\n\r]+)/i,
    /surname\s*[:#-]\s*([^\n\r]+)/i,
  ])?.trim();
  const middleName = findFirstMatch(text, [
    /patient\s*middle\s*name\s*[:#-]\s*([^\n\r]+)/i,
    /middle\s*name\s*[:#-]\s*([^\n\r]+)/i,
  ])?.trim();

  if (firstName && lastName) {
    return middleName
      ? `${firstName} ${middleName} ${lastName}`
      : `${firstName} ${lastName}`;
  }

  // 2. Try single combined name field
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

function extractDateOfBirth(text: string) {
  const captured = findFirstMatch(text, [
    /dob\s*[:#-]?\s*([^\n\r,;]+)/i,
    /date of birth\s*[:#-]?\s*([^\n\r,;]+)/i,
    /birth\s*date\s*[:#-]?\s*([^\n\r,;]+)/i,
  ]);

  return normalizeDateOfBirth(captured);
}

function extractZipcode(text: string) {
  const explicit = findFirstMatch(text, [
    /zip\s*code\s*[:#-]?\s*(\d{5}(?:-\d{4})?)/i,
    /zipcode\s*[:#-]?\s*(\d{5}(?:-\d{4})?)/i,
    /postal\s*code\s*[:#-]?\s*(\d{5}(?:-\d{4})?)/i,
  ]);

  if (explicit) {
    return normalizeZipCode(explicit);
  }

  // Try multi-line address: city on one line, state+zip on next
  const multiLine = text.match(/,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  if (multiLine) {
    return normalizeZipCode(multiLine[2]);
  }

  const fromAddress = text.match(/\b([A-Za-z][A-Za-z .'-]{1,80}),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  return normalizeZipCode(fromAddress?.[3]);
}

function extractCityState(text: string) {
  // 1. Try explicit labeled fields first — but enforce word boundary to avoid
  //    "insurance_status", "status", "statement", etc. false-matching "state"
  const city = normalizeLocationLabel(
    findFirstMatch(text, [
      /^city\s*[:#-]\s*([^\n\r]+)/im,
      /\bcity\s*[:#-]\s*([^\n\r]+)/i,
    ])
  );

  const stateRaw = findFirstMatch(text, [
    /^state\s*[:#-]\s*([^\n\r]+)/im,         // labeled on its own line
    /\bstate\s+of\s+(?:residence\s*[:#-]?\s*)?([A-Za-z]{2,30})/i,
  ]);
  const state = normalizeStateAbbreviation(stateRaw);

  if (city || state) {
    return { city, state };
  }

  // 2. Full single-line address: "1415 River Road, Las Vegas, NV 89105"
  //    City is the last comma-separated segment before the state abbreviation+zip
  const singleLine = text.match(
    /\b([A-Za-z][A-Za-z .'-]{1,80}),\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/
  );
  if (singleLine) {
    return {
      city: normalizeLocationLabel(singleLine[1]),
      state: normalizeStateAbbreviation(singleLine[2]),
    };
  }

  // 3. Multi-line address: city on one line, "ST  ZIPCODE" on the next
  //    e.g. "Las Vegas,\nNV 89105"
  const multiLine = text.match(
    /([A-Za-z][A-Za-z .'-]{1,40}),?\s*\n\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/
  );
  if (multiLine) {
    return {
      city: normalizeLocationLabel(multiLine[1]),
      state: normalizeStateAbbreviation(multiLine[2]),
    };
  }

  // 4. State abbreviation directly after "Home Address:" or "Address:" label
  const addressLabel = text.match(
    /(?:home\s+)?address\s*[:#-][^\n]*,\s*([A-Za-z]{2})\s+\d{5}/i
  );
  if (addressLabel) {
    return {
      city: undefined,
      state: normalizeStateAbbreviation(addressLabel[1]),
    };
  }

  return { city: undefined, state: undefined };
}

function extractEthnicity(text: string) {
  return normalizeLocationLabel(
    findFirstMatch(text, [
      /ethnicity\s*[:#-]?\s*([^\n\r]+)/i,
      /ethnic\s*group\s*[:#-]?\s*([^\n\r]+)/i,
    ])
  );
}

function extractRace(text: string) {
  return normalizeLocationLabel(
    findFirstMatch(text, [
      /race\s*[:#-]?\s*([^\n\r]+)/i,
      /racial\s*group\s*[:#-]?\s*([^\n\r]+)/i,
    ])
  );
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

function extractComorbidities(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}) {
  const entries: MedicalHistoryRecord[] = [];
  const comorbiditiesMatch = input.text.match(
    /(?:comorbidities|co-morbidities|comorbid\s+conditions)\s*[:#-]?\s*([^\n\r]+)/i
  );
  if (!comorbiditiesMatch?.[1]) return entries;

  const items = comorbiditiesMatch[1]
    .split(/,/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && !/^(none|n\/a|nil)$/i.test(s));

  items.forEach((condition, idx) => {
    entries.push({
      id: `med-comorbid-${input.now}-${idx}`,
      sourceFileName: input.sourceFileName,
      patientId: input.patientId,
      condition,
      codeSystem: "UNKNOWN",
      code: "N/A",
      note: "Extracted from Comorbidities field.",
      extractedAt: input.now,
    });
  });
  return entries;
}

function extractDiagnosedWithConditions(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}) {
  const entries: MedicalHistoryRecord[] = [];
  const regex = /diagnosed\s+with\s+([a-z][a-z0-9\-\s/]{2,80})(?:\.|,|\n|;)/gi;

  let match: RegExpExecArray | null = regex.exec(input.text);
  let index = 0;

  while (match) {
    const raw = match[1]?.trim();
    if (raw) {
      const condition = raw
        .replace(/\s+/g, " ")
        .replace(/\bthe\b/gi, "")
        .trim();

      if (condition.length >= 3) {
        entries.push({
          id: `med-dx-${input.now}-${index}`,
          sourceFileName: input.sourceFileName,
          patientId: input.patientId,
          condition,
          codeSystem: "UNKNOWN",
          code: "N/A",
          note: "Extracted from narrative diagnosis statement.",
          extractedAt: input.now,
        });
        index += 1;
      }
    }

    match = regex.exec(input.text);
  }

  return entries;
}

export function parseTextToRecords(input: {
  text: string;
  sourceFileName: string;
}) {
  const text = normalizeClinicalText(input.text);
  const lower = text.toLowerCase();
  const now = Date.now();

  const patientId =
    findFirstMatch(text, [/patient\s*id\s*[:#-]?\s*([A-Za-z0-9-]+)/i, /mrn\s*[:#-]?\s*([A-Za-z0-9-]+)/i]) ??
    `PT-${now}`;

  const fullName = extractPatientName(text) ?? "Unknown Patient";

  const ageRaw = extractAge(text);
  const genderRaw = extractGenderRaw(text);
  const dob = extractDateOfBirth(text);
  const zipcode = extractZipcode(text);
  const { city, state } = extractCityState(text);
  const ethnicity = extractEthnicity(text);
  const race = extractRace(text);
  const age = normalizeAge(ageRaw ? Number(ageRaw) : undefined, dob, now);

  const demographics: DemographicsRecord[] = [
    {
      id: `demo-${now}`,
      sourceFileName: input.sourceFileName,
      patientId,
      fullName,
      age,
      gender: normalizeGender(genderRaw),
      dateOfBirth: dob,
      city,
      state,
      zipcode,
      ethnicity,
      race,
      extractedAt: now,
    },
  ];

  const icdFromText = extractDiagnosisFromIcdLines({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  const comorbiditiesMatches = extractComorbidities({
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

  const narrativeDiagnoses = extractDiagnosedWithConditions({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  const uniqueByCode = new Map<string, MedicalHistoryRecord>();
  for (const record of [...icdFromText, ...comorbiditiesMatches, ...dictionaryMatches, ...problemListMatches, ...narrativeDiagnoses]) {
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
