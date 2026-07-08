import { NextRequest, NextResponse } from "next/server";

import {
  refineSqlWithGemini,
  buildDatabaseSchemaContext,
  assessQueryFeasibilityWithGemini,
} from "@/services/geminiService";
import { translateMedicalQuery } from "@/services/translator";
import { QueryResult, type AmbiguityDetection, type QueryFeasibilityResult } from "@/types/medical";
import { agentActivityStore } from "@/store/agentActivityStore";

interface TranslateRequestBody {
  prompt?: string;
  useGeminiAssist?: boolean;
  datasetStats?: {
    demographicsCount: number;
    medicalHistoryCount: number;
    uniquePatientsCount: number;
    dateRangeStart?: string;
    dateRangeEnd?: string;
  };
  ambiguities?: AmbiguityDetection[];
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

function buildAmbiguitySummary(ambiguities?: AmbiguityDetection[]): string {
  if (!ambiguities || ambiguities.length === 0) {
    return "";
  }

  return ambiguities
    .map((ambig) => {
      const selected =
        ambig.selectedInterpretationIndex !== undefined
          ? ambig.interpretations[ambig.selectedInterpretationIndex]
          : null;
      if (!selected) return null;
      return `"${ambig.fragment}": ${selected.option}`;
    })
    .filter(Boolean)
    .join("; ");
}

export async function POST(request: NextRequest) {
  const agentName = "QueryExecutionAgent";
  
  try {
    const body = (await request.json()) as TranslateRequestBody;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    // Track agent activity
    agentActivityStore.startAgent(agentName, "Generating SQL from query");
    agentActivityStore.updateProgress(agentName, 15, { stage: "parsing" });

    const useGeminiAssist = Boolean(body.useGeminiAssist);
    const datasetStats = body.datasetStats;
    const ambiguities = body.ambiguities;
    const baseResult = translateMedicalQuery(prompt);

    agentActivityStore.updateProgress(agentName, 35, { stage: "base-translation-complete" });

    if (!useGeminiAssist) {
      agentActivityStore.completeAgent(agentName, { mode: "deterministic" });
      return NextResponse.json({
        ...baseResult,
        statusLabel: "Deterministic Mode",
        statusDetail: "Gemini Assist was off. Generated SQL using deterministic pipeline.",
      });
    }

    const { conceptSummary, filterSummary } = summarizeBaseResult(baseResult);
    const ambiguitySummary = buildAmbiguitySummary(ambiguities);
    const schemaContext = datasetStats ? buildDatabaseSchemaContext(datasetStats) : undefined;

    let geminiResult: Awaited<ReturnType<typeof refineSqlWithGemini>> | null = null;
    let geminiFailureReason: string | null = null;

    try {
      const refinementPrompt = ambiguitySummary
        ? `${prompt}\n\n[Clarifications: ${ambiguitySummary}]`
        : prompt;

      geminiResult = await refineSqlWithGemini({
        prompt: refinementPrompt,
        deterministicSql: baseResult.sql,
        conceptSummary,
        filterSummary,
        schemaContext,
      });
    } catch (cause) {
      geminiFailureReason = "Gemini service request failed.";
      if (cause instanceof Error && cause.message) {
        geminiFailureReason = `Gemini service request failed: ${cause.message}`;
      }
    }

    agentActivityStore.updateProgress(agentName, 60, { stage: "gemini-refinement-complete" });

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

    // Check query feasibility if dataset stats are available
    let feasibilityResult: QueryFeasibilityResult | null = null;
    if (datasetStats) {
      try {
        feasibilityResult = await assessQueryFeasibilityWithGemini({
          sql: safeSql,
          conceptSummary,
          filterSummary,
          datasetStats,
        });
      } catch {
        // Feasibility check failed silently - not critical
      }
    }

    agentActivityStore.updateProgress(agentName, 85, { stage: "feasibility-check-complete" });

    const candidateConfidence =
      typeof geminiResult.result.confidenceScore === "number"
        ? Math.max(0, Math.min(1, geminiResult.result.confidenceScore))
        : baseResult.confidenceScore;

    const explanationSteps = [
      ...baseResult.explanationSteps,
      "Gemini refined SQL for schema-level accuracy and readability.",
    ];

    if (feasibilityResult) {
      if (!feasibilityResult.feasible) {
        explanationSteps.push("⚠️ Query feasibility check detected potential issues.");
      }
      if (feasibilityResult.warnings.length > 0) {
        explanationSteps.push(`Feasibility warnings: ${feasibilityResult.warnings[0]}`);
      }
      if (feasibilityResult.suggestions.length > 0) {
        explanationSteps.push(`Suggestion: ${feasibilityResult.suggestions[0]}`);
      }
    }

    const statusDetail = feasibilityResult
      ? `SQL refined by ${geminiResult.result.model}. Expected results: ${feasibilityResult.expectedRowsMin}-${feasibilityResult.expectedRowsMax} rows. Confidence: ${Math.round(feasibilityResult.estimatedConfidence * 100)}%.`
      : `SQL refined by ${geminiResult.result.model}.`;

    const responseData = {
      ...baseResult,
      sql: safeSql,
      confidenceScore: Number(
        Math.max(
          baseResult.confidenceScore,
          feasibilityResult ? feasibilityResult.estimatedConfidence : candidateConfidence
        ).toFixed(2)
      ),
      aiExplanation: geminiResult.result.explanation,
      explanationSteps,
      translationMode: "gemini-assist",
      modelUsed: geminiResult.result.model,
      statusLabel: feasibilityResult && !feasibilityResult.feasible ? "Gemini Assist (Warnings)" : "Gemini Assist Active",
      statusDetail,
      feasibilityCheck: feasibilityResult ?? undefined,
    };

    agentActivityStore.completeAgent(agentName, {
      sqlGenerated: true,
      confidence: responseData.confidenceScore,
      rowsExpected: feasibilityResult?.expectedRowsMax || 0,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    agentActivityStore.errorAgent(
      agentName,
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json({ error: "Unable to translate query." }, { status: 500 });
  }
}
