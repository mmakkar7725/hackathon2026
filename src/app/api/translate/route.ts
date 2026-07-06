import { NextRequest, NextResponse } from "next/server";

import { refineSqlWithGemini } from "@/services/geminiService";
import { translateMedicalQuery } from "@/services/translator";
import { QueryResult } from "@/types/medical";

interface TranslateRequestBody {
  prompt?: string;
  useGeminiAssist?: boolean;
}

function sanitizeReadOnlySql(sql: string) {
  const lowered = sql.toLowerCase();
  const forbidden = [
    " insert ",
    " update ",
    " delete ",
    " drop ",
    " alter ",
    " truncate ",
    " create ",
    " merge ",
    " grant ",
    " revoke ",
  ];

  const padded = ` ${lowered} `;
  const hasForbiddenKeyword = forbidden.some((keyword) => padded.includes(keyword));
  const startsReadOnly = lowered.trimStart().startsWith("select") || lowered.trimStart().startsWith("with");

  if (hasForbiddenKeyword || !startsReadOnly) {
    return null;
  }

  return sql;
}

function summarizeBaseResult(baseResult: QueryResult) {
  const conceptSummary =
    baseResult.concepts.length > 0
      ? baseResult.concepts
          .map((concept) => `${concept.canonicalName}(${concept.codingSystem}:${concept.code})`)
          .join(", ")
      : "None";

  const filterSummary = Object.entries(baseResult.filters)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  return {
    conceptSummary,
    filterSummary: filterSummary || "None",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslateRequestBody;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const useGeminiAssist = Boolean(body.useGeminiAssist);
    const baseResult = translateMedicalQuery(prompt);

    if (!useGeminiAssist) {
      return NextResponse.json({
        ...baseResult,
        statusLabel: "Deterministic Mode",
        statusDetail: "Gemini Assist was off. Generated SQL using deterministic pipeline.",
      });
    }

    const { conceptSummary, filterSummary } = summarizeBaseResult(baseResult);
    let geminiResult: Awaited<ReturnType<typeof refineSqlWithGemini>> | null = null;
    let geminiFailureReason: string | null = null;

    try {
      geminiResult = await refineSqlWithGemini({
        prompt,
        deterministicSql: baseResult.sql,
        conceptSummary,
        filterSummary,
      });
    } catch (cause) {
      geminiFailureReason = "Gemini service request failed.";
      if (cause instanceof Error && cause.message) {
        geminiFailureReason = `Gemini service request failed: ${cause.message}`;
      }
    }

    if (!geminiResult || !geminiResult.ok) {
      const failureDetail = !geminiResult || geminiResult.ok ? null : geminiResult.detail;
      return NextResponse.json({
        ...baseResult,
        explanationSteps: [
          ...baseResult.explanationSteps,
          "Gemini assist was unavailable, returned deterministic SQL.",
        ],
        statusLabel: "Gemini Fallback",
        statusDetail:
          failureDetail ??
          geminiFailureReason ??
          "Gemini Assist was enabled, but the model was unavailable or returned no valid response.",
      });
    }

    const safeSql = sanitizeReadOnlySql(geminiResult.result.sql);
    if (!safeSql) {
      return NextResponse.json({
        ...baseResult,
        explanationSteps: [
          ...baseResult.explanationSteps,
          "Gemini output failed read-only safety checks, returned deterministic SQL.",
        ],
        statusLabel: "Gemini Safety Fallback",
        statusDetail: "Gemini response was blocked by read-only SQL safety checks.",
      });
    }

    const candidateConfidence =
      typeof geminiResult.result.confidenceScore === "number"
        ? Math.max(0, Math.min(1, geminiResult.result.confidenceScore))
        : baseResult.confidenceScore;

    return NextResponse.json({
      ...baseResult,
      sql: safeSql,
      confidenceScore: Number(Math.max(baseResult.confidenceScore, candidateConfidence).toFixed(2)),
      aiExplanation: geminiResult.result.explanation,
      explanationSteps: [
        ...baseResult.explanationSteps,
        "Gemini refined SQL for schema-level phrasing and readability.",
      ],
      translationMode: "gemini-assist",
      modelUsed: geminiResult.result.model,
      statusLabel: "Gemini Assist Active",
      statusDetail: `SQL refined by ${geminiResult.result.model}.`,
    });
  } catch {
    return NextResponse.json({ error: "Unable to translate query." }, { status: 500 });
  }
}
