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

function buildGeminiRequestInit(body: string) {
  const allowInsecureTls = process.env.GEMINI_ALLOW_INSECURE_TLS === "true";

  if (allowInsecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  } satisfies RequestInit;
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

async function parseGeminiJsonResponse(response: Response): Promise<{ ok: true; payload: unknown } | { ok: false; detail: string }> {
  try {
    const payload = (await response.json()) as unknown;
    return { ok: true, payload };
  } catch {
    const rawText = await response.text().catch(() => "");
    const preview = rawText.replace(/\s+/g, " ").slice(0, 220);
    return {
      ok: false,
      detail: preview
        ? `Gemini endpoint returned non-JSON response: ${preview}`
        : "Gemini endpoint returned non-JSON response.",
    };
  }
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
    "Extract healthcare data from the provided clinical document.",
    "Return ONLY strict JSON with two top-level keys: demographics, medicalHistory.",
    "",
    "demographics: array with ONE record containing:",
    "  - patientId: from 'Patient ID', 'Medical Record Number', 'MRN', or generate PT-<timestamp>",
    "  - fullName: patient's full name (not physician names)",
    "  - age: INTEGER only — extract from phrases like '72 year old' or 'Age: 56', NOT a string",
    "  - gender: 'male' or 'female' — infer from Mr./Mrs./Ms., 'gentleman', 'woman', or pronouns he/she",
    "  - dateOfBirth: ISO date string if present, otherwise null",
    "  - city, state, zipcode: from address fields if present, otherwise null",
    "  - ethnicity, race: if explicitly stated, otherwise null",
    "",
    "medicalHistory: array of ALL diagnoses/conditions, one record per condition:",
    "  - Include conditions from: 'Diagnosis:', 'Other diagnoses:', 'Problems:', 'Assessment:', 'Past Medical History:' sections",
    "  - condition: full condition name (e.g. 'Left-sided systolic congestive heart failure', NOT just 'Left-sided')",
    "  - codeSystem: 'ICD10' MUST be set for any recognized condition. Use 'SNOMED' only if ICD10 not available.",
    "  - code: ALWAYS include ICD-10 code using reference list below. Never leave as 'N/A' for common conditions.",
    "  - note: brief note about the condition if relevant",
    "",
    "Common ICD-10 Code Reference (use for conditions in document):",
    "  Type 2 Diabetes → E11.9",
    "  Hypertension → I10",
    "  Diabetes Mellitus → E11.9",
    "  Heart Failure / CHF / Congestive Heart Failure → I50.9",
    "  Atrial Fibrillation → I48.91",
    "  Coronary Artery Disease / CAD → I25.10",
    "  Osteoarthritis → M19.90",
    "  Osteoporosis → M81.9",
    "  COPD → J44.9",
    "  Asthma → J45.909",
    "  Chronic Kidney Disease → N18.3",
    "  Acute Kidney Injury → N17.9",
    "  Pneumonia → J18.9",
    "  UTI / Urinary Tract Infection → N39.0",
    "  Hip Fracture → S72.001",
    "  Chest Pain → R07.9",
    "  Angina Pectoris → I20.9",
    "",
    "Instructions for coding:",
    "  - If condition matches one in reference list, ALWAYS use that code",
    "  - If condition not in list but is recognizable medical term, use best-match ICD-10 code",
    "  - NEVER return code='N/A' for recognizable medical diagnoses — always provide code",
    "  - For complications, use appropriate ICD-10 code (e.g. 'Post-op atrial fibrillation' → I48.91 with note)",
    "",
    "Rules:",
    "  - age MUST be a number (e.g. 72), never a string like '72 years old'",
    "  - Do NOT truncate condition names — always include the full diagnosis",
    "  - Return valid complete JSON — do not cut off mid-string",
    "  - Wrap all results in arrays even for single records",
    "  - CRITICAL: Every condition MUST have a codeSystem and code. No 'N/A' values.",
    `Source file name: ${input.fileName}`,
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
      buildGeminiRequestInit(
        JSON.stringify({
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
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        })
      )
    );
  } catch (cause) {
    return {
      ok: false,
      reason: "request-failed",
      detail:
        cause instanceof Error
          ? `Gemini request failed: ${cause.message}`
          : "Gemini request failed due to network/runtime error.",
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: "request-failed",
      detail: `Gemini API returned ${response.status}. ${errorText.slice(0, 240)}`,
    };
  }

  const jsonResult = await parseGeminiJsonResponse(response);
  if (!jsonResult.ok) {
    return {
      ok: false,
      reason: "request-failed",
      detail: jsonResult.detail,
    };
  }

  const payload = jsonResult.payload;
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

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
      buildGeminiRequestInit(
        JSON.stringify({
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
        })
      )
    );
  } catch (cause) {
    return {
      ok: false,
      reason: "request-failed",
      detail:
        cause instanceof Error
          ? `Gemini transcription failed: ${cause.message}`
          : "Gemini transcription failed due to network/runtime error.",
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: "request-failed",
      detail: `Gemini API returned ${response.status}. ${errorText.slice(0, 240)}`,
    };
  }

  const jsonResult = await parseGeminiJsonResponse(response);
  if (!jsonResult.ok) {
    return {
      ok: false,
      reason: "request-failed",
      detail: jsonResult.detail,
    };
  }

  const payload = jsonResult.payload;
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
     "demographics: array of records with fields id, sourceFileName, patientId, fullName, age, gender, dateOfBirth, city, state, zipcode, ethnicity, race, extractedAt.",
    "medicalHistory: array of records with fields id, sourceFileName, patientId, condition, codeSystem, code, note, onsetDate, extractedAt.",
    "Use coding systems ICD10 or SNOMED when possible, otherwise UNKNOWN.",
    "Use Unix timestamp number for extractedAt.",
    "If there is only one record, still return it inside an array.",
    `Source file name: ${input.fileName}`,
    "Clinical text:",
    input.text,
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
      buildGeminiRequestInit(
        JSON.stringify({
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
        })
      )
    );
  } catch (cause) {
    return {
      ok: false,
      reason: "request-failed",
      detail:
        cause instanceof Error
          ? `Gemini text-to-JSON parse failed: ${cause.message}`
          : "Gemini text-to-JSON parse failed due to network/runtime error.",
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: "request-failed",
      detail: `Gemini API returned ${response.status}. ${errorText.slice(0, 240)}`,
    };
  }

  const jsonResult = await parseGeminiJsonResponse(response);
  if (!jsonResult.ok) {
    return {
      ok: false,
      reason: "request-failed",
      detail: jsonResult.detail,
    };
  }

  const payload = jsonResult.payload;
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
