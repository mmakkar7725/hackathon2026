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

  const fullName =
    findFirstMatch(text, [/name\s*[:#-]?\s*([A-Za-z .'-]+)/i, /patient\s*[:#-]?\s*([A-Za-z .'-]+)/i]) ??
    "Unknown Patient";

  const ageRaw = findFirstMatch(text, [/age\s*[:#-]?\s*(\d{1,3})/i]);
  const genderRaw = findFirstMatch(text, [/gender\s*[:#-]?\s*([A-Za-z]+)/i, /sex\s*[:#-]?\s*([A-Za-z]+)/i]);
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

  const medicalHistory: MedicalHistoryRecord[] = medicalDictionary
    .filter((entry) => entry.synonyms.some((synonym) => lower.includes(synonym)))
    .map((entry, index) => ({
      id: `med-${now}-${index}`,
      sourceFileName: input.sourceFileName,
      patientId,
      condition: entry.name,
      codeSystem: entry.codingSystem,
      code: entry.code,
      note: "Detected via fallback text parser.",
      extractedAt: now,
    }));

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
