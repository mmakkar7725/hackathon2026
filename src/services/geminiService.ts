import "server-only";

interface GeminiRefinementResult {
  sql: string;
  explanation: string;
  confidenceScore?: number;
}

interface GeminiRefinementLooseResult {
  sql?: string;
  query?: string;
  refinedSql?: string;
  explanation?: string;
  reasoning?: string;
  confidenceScore?: number | string;
}

type GeminiRefineFailureReason =
  | "missing-api-key"
  | "request-failed"
  | "http-error"
  | "non-json-response"
  | "empty-response"
  | "invalid-json";

interface GeminiRefineSuccess {
  ok: true;
  result: GeminiRefinementResult & { model: string };
}

interface GeminiRefineFailure {
  ok: false;
  reason: GeminiRefineFailureReason;
  detail: string;
  model: string;
}

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

function safeJsonParse(text: string): GeminiRefinementResult | null {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");

    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
      return null;
    }

    const maybeJson = text.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(maybeJson) as GeminiRefinementLooseResult;
    const sql = (parsed.sql ?? parsed.query ?? parsed.refinedSql ?? "").trim();
    const explanation = (parsed.explanation ?? parsed.reasoning ?? "Gemini refined SQL.").trim();

    if (!sql) {
      return null;
    }

    const confidenceCandidate =
      typeof parsed.confidenceScore === "string"
        ? Number(parsed.confidenceScore)
        : parsed.confidenceScore;

    const confidenceScore =
      typeof confidenceCandidate === "number" && Number.isFinite(confidenceCandidate)
        ? confidenceCandidate
        : undefined;

    return {
      sql,
      explanation,
      confidenceScore,
    };
  } catch {
    return null;
  }
}

function extractSqlFromText(text: string): string | null {
  const fencedSql = text.match(/```sql\s*([\s\S]*?)```/i);
  if (fencedSql?.[1]) {
    const sql = fencedSql[1].trim();
    if (sql) {
      return sql;
    }
  }

  const genericFence = text.match(/```\s*([\s\S]*?)```/i);
  if (genericFence?.[1]) {
    const candidate = genericFence[1].trim();
    if (/^(select|with)\b/i.test(candidate)) {
      return candidate;
    }
  }

  const start = text.search(/\b(select|with)\b/i);
  if (start >= 0) {
    const candidate = text.slice(start).trim();
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function buildGeminiRequestInit(body: string) {
  if (process.env.GEMINI_ALLOW_INSECURE_TLS === "true") {
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

function normalizeDetail(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function normalizeSqlText(sql: string) {
  let normalized = sql.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ")
    .replace(/\\"/g, '"');
}

async function parseGeminiJsonResponse(response: Response): Promise<{ ok: true; payload: unknown } | { ok: false; detail: string }> {
  try {
    const payload = (await response.json()) as unknown;
    return { ok: true, payload };
  } catch {
    const raw = await response.text().catch(() => "");
    const preview = normalizeDetail(raw);
    const likelyPortal = /<html|window\.location|fgtauth|login|signin/i.test(preview);
    return {
      ok: false,
      detail: likelyPortal
        ? `Network proxy/captive portal intercepted Gemini response: ${preview || "HTML response detected."}`
        : `Gemini returned non-JSON response: ${preview || "Unable to parse response body."}`,
    };
  }
}

export async function refineSqlWithGemini(input: {
  prompt: string;
  deterministicSql: string;
  conceptSummary: string;
  filterSummary: string;
}): Promise<GeminiRefineSuccess | GeminiRefineFailure> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = resolveGeminiModelName(
    process.env.GEMINI_MODEL ?? "models/gemini-2.5-flash"
  );

  if (!apiKey) {
    return {
      ok: false,
      reason: "missing-api-key",
      detail: "GOOGLE_GEMINI_API_KEY is missing or empty.",
      model,
    };
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

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
      buildGeminiRequestInit(
        JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: instruction }],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 700,
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
      model,
    };
  }

  if (!response.ok) {
    const raw = normalizeDetail(await response.text().catch(() => ""));
    return {
      ok: false,
      reason: "http-error",
      detail: `Gemini API returned HTTP ${response.status}. ${raw || "No response body."}`,
      model,
    };
  }

  const jsonResult = await parseGeminiJsonResponse(response);
  if (!jsonResult.ok) {
    return {
      ok: false,
      reason: "non-json-response",
      detail: jsonResult.detail,
      model,
    };
  }

  const payload = jsonResult.payload;
  const text = extractTextFromGeminiResponse(payload);

  if (!text) {
    return {
      ok: false,
      reason: "empty-response",
      detail: "Gemini returned no text content.",
      model,
    };
  }

  const parsed = safeJsonParse(text);
  if (!parsed) {
    const sqlOnly = extractSqlFromText(text);
    if (sqlOnly) {
      return {
        ok: true,
        result: {
          sql: normalizeSqlText(sqlOnly),
          explanation: "Gemini returned SQL in non-JSON format; response normalized automatically.",
          model,
        },
      };
    }

    return {
      ok: false,
      reason: "invalid-json",
      detail: "Gemini response text did not contain valid strict JSON with sql/explanation.",
      model,
    };
  }

  return {
    ok: true,
    result: {
      ...parsed,
      sql: normalizeSqlText(parsed.sql),
      model,
    },
  };
}
