import "server-only";

import type { AmbiguityDetection, AmbiguityInterpretation, AmbiguityResolution, QueryFeasibilityResult, AmbiguityType } from "@/types/medical";

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
    // First, try to extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1] : text;
    
    const jsonStart = jsonText.indexOf("{");
    const jsonEnd = jsonText.lastIndexOf("}");

    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
      return null;
    }

    let maybeJson = jsonText.slice(jsonStart, jsonEnd + 1);
    
    // Handle common JSON escaping issues
    maybeJson = maybeJson.replace(/\\'/g, "'");
    
    const parsed = JSON.parse(maybeJson) as GeminiRefinementLooseResult;
    let sql = (parsed.sql ?? parsed.query ?? parsed.refinedSql ?? "").trim();
    
    // Unescape common SQL escaping patterns
    sql = sql
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, "  ")
      .replace(/\\"/g, '"')
      .trim();
    
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
  // Try fenced sql block first
  const fencedSql = text.match(/```sql\s*([\s\S]*?)```/i);
  if (fencedSql?.[1]) {
    const sql = fencedSql[1].trim();
    if (/^(select|with)\b/i.test(sql)) {
      return sql;
    }
  }

  // Try generic fenced block
  const genericFence = text.match(/```\s*([\s\S]*?)```/i);
  if (genericFence?.[1]) {
    const candidate = genericFence[1].trim();
    if (/^(select|with)\b/i.test(candidate)) {
      return candidate;
    }
  }

  // Try finding SELECT/WITH statement - be careful not to include JSON syntax
  const start = text.search(/\b(select|with)\b/i);
  if (start >= 0) {
    // Look for natural end: semicolon, newline followed by closing brace/bracket, or end of typical SQL
    let candidate = text.slice(start);
    
    // Remove trailing JSON syntax if present (e.g., }", ]),
    candidate = candidate
      .replace(/[}\],"']\s*$/, "")
      .replace(/\s+[}\],"']\s*$/, "");
    
    candidate = candidate.trim();
    if (candidate && /^(select|with)\b/i.test(candidate)) {
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

export function buildDatabaseSchemaContext(datasetStats: {
  demographicsCount: number;
  medicalHistoryCount: number;
  uniquePatientsCount: number;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}): string {
  return `
## Database Schema Context

### Available Tables:
1. **demographics** (${datasetStats.demographicsCount} records)
   - patient_id (PK): Unique patient identifier
   - full_name: Patient's full name
   - age: Patient's age in years (integer, 0-130)
   - gender: 'male', 'female', or 'other'
   - date_of_birth: ISO date string (YYYY-MM-DD)
   - extracted_at: Timestamp (milliseconds since epoch)

2. **medical_history** (${datasetStats.medicalHistoryCount} records from ${datasetStats.uniquePatientsCount} patients)
   - patient_id (FK): Links to demographics.patient_id
   - condition: Clinical condition name/description
   - code_system: 'ICD10', 'SNOMED', or 'UNKNOWN'
   - code: Medical code (e.g., E11 for Type 2 Diabetes)
   - note: Optional clinical notes
   - onset_date: ISO date string (YYYY-MM-DD)
   - extracted_at: Timestamp (milliseconds since epoch)

### Dataset Characteristics:
- Unique Patients: ${datasetStats.uniquePatientsCount}
- Demographics Records: ${datasetStats.demographicsCount}
- Medical History Records: ${datasetStats.medicalHistoryCount}
- Average records/patient: ${(datasetStats.medicalHistoryCount / datasetStats.uniquePatientsCount).toFixed(1)}
- Date Range: ${datasetStats.dateRangeStart ?? "Unknown"} to ${datasetStats.dateRangeEnd ?? "Unknown"}

### SQL Generation Rules:
1. Always JOIN demographics and medical_history on patient_id
2. Use lowercase column names: patient_id, full_name, age, gender, condition, code, onset_date
3. Dates are ISO strings (YYYY-MM-DD format) - use string comparison or DATE() function
4. Age is an integer - use comparison operators directly
5. Gender values: 'male' (case-insensitive match)
6. Diagnoses/Conditions: Match against condition name OR code
7. Always add WHERE filters to limit result set
8. Prefer DISTINCT to avoid duplicate patient records
9. Use aggregate functions (COUNT, MAX, MIN) only when grouping is intentional
10. Test for NULL values explicitly when filtering`;
}

export async function assessQueryFeasibilityWithGemini(input: {
  sql: string;
  conceptSummary: string;
  filterSummary: string;
  datasetStats: {
    demographicsCount: number;
    medicalHistoryCount: number;
    uniquePatientsCount: number;
  };
}): Promise<QueryFeasibilityResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const model = resolveGeminiModelName(
    process.env.GEMINI_MODEL ?? "models/gemini-2.5-flash"
  );

  if (!apiKey) {
    return {
      feasible: true,
      expectedRowsMin: 0,
      expectedRowsMax: Math.min(100, input.datasetStats.uniquePatientsCount),
      estimatedConfidence: 0.65,
      warnings: ["API key unavailable, using fallback feasibility estimation."],
      suggestions: [],
    };
  }

  const prompt = `
You are a healthcare database analyst. Assess the feasibility of this SQL query against the given dataset.

## Dataset:
- Unique Patients: ${input.datasetStats.uniquePatientsCount}
- Demographics Records: ${input.datasetStats.demographicsCount}
- Medical History Records: ${input.datasetStats.medicalHistoryCount}
- Average records/patient: ${(input.datasetStats.medicalHistoryCount / input.datasetStats.uniquePatientsCount).toFixed(1)}

## Query Concepts:
${input.conceptSummary}

## Filters Applied:
${input.filterSummary}

## SQL Query:
\`\`\`sql
${input.sql}
\`\`\`

Analyze this query and return ONLY valid JSON with:
{
  "feasible": boolean - Will this query execute without errors?
  "expectedRowsMin": number - Minimum expected result rows,
  "expectedRowsMax": number - Maximum expected result rows,
  "estimatedConfidence": number between 0 and 1,
  "warnings": [string array] - e.g., ["Filter too restrictive, may return 0 rows"],
  "suggestions": [string array] - e.g., ["Consider expanding date range to 2 years"]
}

Warnings should flag:
- Combinations of filters that are too restrictive
- Date ranges that exceed dataset coverage
- Concepts that are rare in typical datasets
- Temporal filters more than 5 years old

Suggestions should recommend:
- Filter relaxation (e.g., expand age range)
- Alternative filter combinations
- Data validation steps
`;

  try {
    const response = await fetch(
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
            temperature: 0.3,
            maxOutputTokens: 800,
            responseMimeType: "application/json",
          },
        })
      )
    );

    if (!response.ok) {
      return {
        feasible: true,
        expectedRowsMin: 0,
        expectedRowsMax: Math.min(50, input.datasetStats.uniquePatientsCount),
        estimatedConfidence: 0.6,
        warnings: ["Feasibility assessment service unavailable."],
        suggestions: [],
      };
    }

    const jsonResult = await parseGeminiJsonResponse(response);
    if (!jsonResult.ok) {
      return {
        feasible: true,
        expectedRowsMin: 0,
        expectedRowsMax: Math.min(50, input.datasetStats.uniquePatientsCount),
        estimatedConfidence: 0.6,
        warnings: ["Could not parse feasibility response."],
        suggestions: [],
      };
    }

    const text = extractTextFromGeminiResponse(jsonResult.payload);
    try {
      const result = JSON.parse(text) as QueryFeasibilityResult;
      return {
        feasible: Boolean(result.feasible) ?? true,
        expectedRowsMin: Math.max(0, Number(result.expectedRowsMin) ?? 0),
        expectedRowsMax: Math.max(
          Number(result.expectedRowsMax) ?? 100,
          input.datasetStats.uniquePatientsCount
        ),
        estimatedConfidence: Math.max(0, Math.min(1, Number(result.estimatedConfidence) ?? 0.7)),
        warnings: Array.isArray(result.warnings) ? result.warnings.slice(0, 3) : [],
        suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 2) : [],
      };
    } catch {
      return {
        feasible: true,
        expectedRowsMin: 0,
        expectedRowsMax: Math.min(100, input.datasetStats.uniquePatientsCount),
        estimatedConfidence: 0.65,
        warnings: [],
        suggestions: [],
      };
    }
  } catch {
    return {
      feasible: true,
      expectedRowsMin: 0,
      expectedRowsMax: Math.min(100, input.datasetStats.uniquePatientsCount),
      estimatedConfidence: 0.6,
      warnings: ["Feasibility check failed, query may proceed with caution."],
      suggestions: [],
    };
  }
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
  schemaContext?: string;
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

  const instruction = `Generate complete clinical SQL query.
Return ONLY valid JSON: {"sql":"SELECT...","explanation":"...","confidenceScore":0.85}

Schema: demographics(patient_id,full_name,age,gender), medical_history(patient_id,condition,code,onset_date)

Query: ${input.prompt}
Baseline SQL: ${input.deterministicSql}

Generate complete SELECT FROM WHERE ORDER BY SQL now:`;


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
            maxOutputTokens: 2048,
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


export async function detectAmbiguitiesWithGemini(input: {
  prompt: string;
}): Promise<AmbiguityResolution> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      hasAmbiguities: false,
      ambiguities: [],
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const systemPrompt = `You are a medical query analyzer. Detect ambiguities in clinical queries and suggest interpretations.

For ambiguous terms, provide alternative interpretations ranked by likelihood (high/medium/low).

Ambiguity types to detect:
1. MEDICAL-CONCEPT: Terms that could refer to multiple conditions or synonyms
2. TEMPORAL: Vague time references (e.g., "recently", "a while ago")
3. DEMOGRAPHIC: Unclear demographic references or implicit assumptions
4. STRUCTURAL: Phrases that could be interpreted as symptoms vs conditions

Response format: JSON array of ambiguities, each with fragment, type, interpretations.

If no ambiguities, return empty array [].`;

  const userPrompt = `Analyze this clinical query for ambiguities: "${input.prompt}"

Return ONLY valid JSON (array or empty array), no markdown blocks or extra text.`;

  try {
    const requestBody = {
      system: [{ text: systemPrompt }],
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolveGeminiModelName(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      return { hasAmbiguities: false, ambiguities: [] };
    }

    const rawText = extractTextFromGeminiResponse(await response.json());
    const parsed = safeJsonParse(rawText) as Array<{
      fragment: string;
      type: string;
      interpretations: AmbiguityInterpretation[];
    }> | null;

    if (!parsed || !Array.isArray(parsed)) {
      return { hasAmbiguities: false, ambiguities: [] };
    }

    const ambiguities: AmbiguityDetection[] = parsed
      .filter(
        (item) =>
          item.fragment &&
          item.type &&
          Array.isArray(item.interpretations) &&
          item.interpretations.length > 0
      )
      .map((item, idx) => ({
        id: `ambig-${idx}`,
        fragment: item.fragment,
        type: item.type as AmbiguityType,
        interpretations: item.interpretations,
      }));

    return {
      hasAmbiguities: ambiguities.length > 0,
      ambiguities,
    };
  } catch {
    return { hasAmbiguities: false, ambiguities: [] };
  }
}
