import "server-only";

import { IntakeParseResponse } from "@/types/intake";

interface GeminiParsedPayload {
  demographics: IntakeParseResponse["demographics"];
  medicalHistory: IntakeParseResponse["medicalHistory"];
}

type IntakeGeminiFailureReason =
  | "missing-api-key"
  | "request-failed"
  | "empty-response"
  | "invalid-json";

interface IntakeGeminiFailure {
  ok: false;
  reason: IntakeGeminiFailureReason;
  detail: string;
}

interface IntakeGeminiSuccess {
  ok: true;
  parsed: GeminiParsedPayload;
  model: string;
}

interface IntakeGeminiTextSuccess {
  ok: true;
  text: string;
  model: string;
}

type LooseObject = Record<string, unknown>;

function resolveGeminiModelName(model: string) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function extractTextFromGeminiResponse(payload: unknown): string {
  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function asRecord(value: unknown): LooseObject {
  if (value && typeof value === "object") {
    return value as LooseObject;
  }

  return {};
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getByAliases(record: LooseObject, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);

  for (const [key, value] of Object.entries(record)) {
    if (normalizedAliases.includes(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function toArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
}

function safeJsonParse(text: string): GeminiParsedPayload | null {
  try {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");

    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
      return null;
    }

    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as unknown;
    const root = asRecord(parsed);

    const demographics = toArray(
      getByAliases(root, ["demographics", "demographic", "patientDemographics", "patient_demo"])
    );
    const medicalHistory = toArray(
      getByAliases(root, ["medicalHistory", "medical_history", "history", "diagnoses", "conditions"])
    );

    if (demographics.length === 0 && medicalHistory.length === 0) {
      return null;
    }

    return {
      demographics: demographics as GeminiParsedPayload["demographics"],
      medicalHistory: medicalHistory as GeminiParsedPayload["medicalHistory"],
    };
  } catch {
    return null;
  }
}

export async function parseFileWithGemini(input: {
  fileName: string;
  fileType: string;
  base64Data: string;
}): Promise<IntakeGeminiSuccess | IntakeGeminiFailure> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = resolveGeminiModelName(
    process.env.GEMINI_MODEL ?? "models/gemini-2.5-flash"
  );

  if (!apiKey) {
    return {
      ok: false,
      reason: "missing-api-key",
      detail: "GOOGLE_GEMINI_API_KEY is missing or empty.",
    };
  }

  const prompt = [
    "Extract healthcare data from the provided file.",
    "Return strict JSON only with keys: demographics, medicalHistory.",
    "demographics: array of records with fields id, sourceFileName, patientId, fullName, age, gender, dateOfBirth, extractedAt.",
    "medicalHistory: array of records with fields id, sourceFileName, patientId, condition, codeSystem, code, note, onsetDate, extractedAt.",
    "Use coding systems ICD10 or SNOMED when possible, otherwise UNKNOWN.",
    "Use Unix timestamp number for extractedAt.",
    "If there is only one record, still return it inside an array.",
    `Source file name: ${input.fileName}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: input.fileType || "application/octet-stream",
                  data: input.base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: "request-failed",
      detail: `Gemini API returned ${response.status}. ${errorText.slice(0, 240)}`,
    };
  }

  const payload = (await response.json()) as unknown;
  const text = extractTextFromGeminiResponse(payload);
  if (!text) {
    return {
      ok: false,
      reason: "empty-response",
      detail: "Gemini returned no text content for file parsing.",
    };
  }

  const parsed = safeJsonParse(text);
  if (!parsed) {
    return {
      ok: false,
      reason: "invalid-json",
      detail: "Gemini returned text, but it was not valid JSON in the expected schema.",
    };
  }

  return {
    ok: true,
    parsed,
    model,
  };
}

export async function transcribeFileWithGemini(input: {
  fileName: string;
  fileType: string;
  base64Data: string;
}): Promise<IntakeGeminiTextSuccess | IntakeGeminiFailure> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = resolveGeminiModelName(
    process.env.GEMINI_MODEL ?? "models/gemini-2.5-flash"
  );

  if (!apiKey) {
    return {
      ok: false,
      reason: "missing-api-key",
      detail: "GOOGLE_GEMINI_API_KEY is missing or empty.",
    };
  }

  const prompt = [
    "Transcribe the clinical content from the provided file into plain text.",
    "Preserve key sections such as patient demographics, diagnosis, medications, and lab results.",
    "Do not summarize. Return plain text only.",
    `Source file name: ${input.fileName}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: input.fileType || "application/octet-stream",
                  data: input.base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1800,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: "request-failed",
      detail: `Gemini API returned ${response.status}. ${errorText.slice(0, 240)}`,
    };
  }

  const payload = (await response.json()) as unknown;
  const text = extractTextFromGeminiResponse(payload).trim();

  if (!text) {
    return {
      ok: false,
      reason: "empty-response",
      detail: "Gemini OCR/transcription returned no text content.",
    };
  }

  return {
    ok: true,
    text,
    model,
  };
}

export async function parseTextWithGemini(input: {
  fileName: string;
  text: string;
}): Promise<IntakeGeminiSuccess | IntakeGeminiFailure> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = resolveGeminiModelName(
    process.env.GEMINI_MODEL ?? "models/gemini-2.5-flash"
  );

  if (!apiKey) {
    return {
      ok: false,
      reason: "missing-api-key",
      detail: "GOOGLE_GEMINI_API_KEY is missing or empty.",
    };
  }

  const prompt = [
    "Convert the following clinical text into strict JSON.",
    "Return strict JSON only with keys: demographics, medicalHistory.",
    "demographics: array of records with fields id, sourceFileName, patientId, fullName, age, gender, dateOfBirth, extractedAt.",
    "medicalHistory: array of records with fields id, sourceFileName, patientId, condition, codeSystem, code, note, onsetDate, extractedAt.",
    "Use coding systems ICD10 or SNOMED when possible, otherwise UNKNOWN.",
    "Use Unix timestamp number for extractedAt.",
    "If there is only one record, still return it inside an array.",
    `Source file name: ${input.fileName}`,
    "Clinical text:",
    input.text,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1400,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: "request-failed",
      detail: `Gemini API returned ${response.status}. ${errorText.slice(0, 240)}`,
    };
  }

  const payload = (await response.json()) as unknown;
  const text = extractTextFromGeminiResponse(payload);
  if (!text) {
    return {
      ok: false,
      reason: "empty-response",
      detail: "Gemini returned no text content for text-to-JSON parsing.",
    };
  }

  const parsed = safeJsonParse(text);
  if (!parsed) {
    return {
      ok: false,
      reason: "invalid-json",
      detail: "Gemini text-to-JSON output was not valid JSON in the expected schema.",
    };
  }

  return {
    ok: true,
    parsed,
    model,
  };
}
