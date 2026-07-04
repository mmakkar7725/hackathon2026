import "server-only";

interface GeminiRefinementResult {
  sql: string;
  explanation: string;
  confidenceScore?: number;
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

function safeJsonParse(text: string): GeminiRefinementResult | null {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");

    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
      return null;
    }

    const maybeJson = text.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(maybeJson) as GeminiRefinementResult;

    if (!parsed.sql || !parsed.explanation) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function refineSqlWithGemini(input: {
  prompt: string;
  deterministicSql: string;
  conceptSummary: string;
  filterSummary: string;
}) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  if (!apiKey) {
    return null;
  }

  const instruction = [
    "You are a healthcare SQL assistant.",
    "Refine the SQL query while preserving medical meaning and safety.",
    "Return ONLY strict JSON with keys: sql, explanation, confidenceScore.",
    "Rules:",
    "- SQL must be read-only SELECT/CTE only.",
    "- Do not include INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE.",
    "- Keep query explainable and concise.",
    "- confidenceScore must be a number between 0 and 1.",
    `Prompt: ${input.prompt}`,
    `Concepts: ${input.conceptSummary}`,
    `Filters: ${input.filterSummary}`,
    "Baseline SQL:",
    input.deterministicSql,
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
            parts: [{ text: instruction }],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 700,
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
    ...parsed,
    model,
  };
}
