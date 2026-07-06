import { NextRequest, NextResponse } from "next/server";

interface QueryInsightsRequest {
  prompt?: string;
  totalPatients?: number;
  totalCandidates?: number;
  relaxationStats?: Array<{
    droppedFilter: string;
    matchedPatients: number;
    additionalPatients: number;
  }>;
  nearMisses?: Array<{
    patientId: string;
    fullName: string;
    chanceToJoinPercent: number;
    missingCriteria: string[];
  }>;
}

interface GeminiInsights {
  overview: string;
  relaxationAdvice: Array<{
    droppedFilter: string;
    additionalPatients: number;
    rationale: string;
  }>;
  patientJoinChances: Array<{
    patientId: string;
    fullName: string;
    chancePercent: number;
    reason: string;
  }>;
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

function safeJsonParse(text: string): GeminiInsights | null {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");

    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
      return null;
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GeminiInsights;
    if (!parsed.overview || !Array.isArray(parsed.relaxationAdvice) || !Array.isArray(parsed.patientJoinChances)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function buildFallbackInsights(body: QueryInsightsRequest): GeminiInsights {
  const topRelaxations = (body.relaxationStats ?? [])
    .filter((item) => item.additionalPatients > 0)
    .slice(0, 3)
    .map((item) => ({
      droppedFilter: item.droppedFilter,
      additionalPatients: item.additionalPatients,
      rationale: `Dropping ${item.droppedFilter} may increase eligible patients by ${item.additionalPatients}.`,
    }));

  const patientJoinChances = (body.nearMisses ?? []).slice(0, 5).map((item) => ({
    patientId: item.patientId,
    fullName: item.fullName,
    chancePercent: item.chanceToJoinPercent,
    reason:
      item.missingCriteria.length > 0
        ? `Near match. Missing: ${item.missingCriteria.join(", ")}.`
        : "Near match based on current filters.",
  }));

  return {
    overview: `Current query matched ${body.totalPatients ?? 0} out of ${body.totalCandidates ?? 0} ingested patients.`,
    relaxationAdvice: topRelaxations,
    patientJoinChances,
  };
}

export async function POST(request: NextRequest) {
  const model = resolveGeminiModelName(process.env.GEMINI_MODEL ?? "models/gemini-2.5-flash");
  let body: QueryInsightsRequest = {};

  try {
    try {
      body = (await request.json()) as QueryInsightsRequest;
    } catch {
      body = {};
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    const effectivePrompt = body.prompt?.trim() || "Clinical cohort query analysis";

    if (!apiKey) {
      return NextResponse.json({
        ...buildFallbackInsights(body),
        source: "fallback",
        model,
      });
    }

    const instruction = [
      "You are a healthcare query analytics assistant.",
      "Given query execution stats, provide concise guidance for widening patient retrieval.",
      "Return ONLY strict JSON with keys: overview, relaxationAdvice, patientJoinChances.",
      "relaxationAdvice: array of objects with droppedFilter, additionalPatients, rationale.",
      "patientJoinChances: array of objects with patientId, fullName, chancePercent (0-100), reason.",
      "Do not invent patients. Use provided values and calibrate chances conservatively.",
      `Prompt: ${effectivePrompt}`,
      `Matched patients: ${body.totalPatients ?? 0}`,
      `Total candidates: ${body.totalCandidates ?? 0}`,
      `Relaxation stats: ${JSON.stringify(body.relaxationStats ?? [])}`,
      `Near misses: ${JSON.stringify(body.nearMisses ?? [])}`,
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
              parts: [{ text: instruction }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 900,
          },
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        ...buildFallbackInsights(body),
        source: "fallback",
        model,
      });
    }

    const payload = (await response.json()) as unknown;
    const text = extractTextFromGeminiResponse(payload);
    const parsed = text ? safeJsonParse(text) : null;

    if (!parsed) {
      return NextResponse.json({
        ...buildFallbackInsights(body),
        source: "fallback",
        model,
      });
    }

    return NextResponse.json({
      ...parsed,
      source: "gemini",
      model,
    });
  } catch {
    return NextResponse.json({
      ...buildFallbackInsights(body),
      source: "fallback",
      model,
    });
  }
}
