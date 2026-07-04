import "server-only";

import { IntakeParseResponse } from "@/types/intake";

interface GeminiParsedPayload {
  demographics: IntakeParseResponse["demographics"];
  medicalHistory: IntakeParseResponse["medicalHistory"];
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

function safeJsonParse(text: string): GeminiParsedPayload | null {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");

    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
      return null;
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GeminiParsedPayload;
    if (!Array.isArray(parsed.demographics) || !Array.isArray(parsed.medicalHistory)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function parseFileWithGemini(input: {
  fileName: string;
  fileType: string;
  base64Data: string;
}) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  if (!apiKey) {
    return null;
  }

  const prompt = [
    "Extract healthcare data from the provided file.",
    "Return strict JSON only with keys: demographics, medicalHistory.",
    "demographics: array of records with fields id, sourceFileName, patientId, fullName, age, gender, dateOfBirth, extractedAt.",
    "medicalHistory: array of records with fields id, sourceFileName, patientId, condition, codeSystem, code, note, onsetDate, extractedAt.",
    "Use coding systems ICD10 or SNOMED when possible, otherwise UNKNOWN.",
    "Use Unix timestamp number for extractedAt.",
    `Source file name: ${input.fileName}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
        },
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  const text = extractTextFromGeminiResponse(payload);
  if (!text) {
    return null;
  }

  const parsed = safeJsonParse(text);
  if (!parsed) {
    return null;
  }

  return {
    parsed,
    model,
  };
}
