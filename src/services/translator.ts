import { parseMedicalQuestion } from "@/services/nlpParser";
import { generateSqlFromParsedQuery } from "@/services/sqlGenerator";
import { QueryResult } from "@/types/medical";

function buildAiExplanation(result: {
  sql: string;
  conceptCount: number;
  confidenceScore: number;
}) {
  return `The translator identified ${result.conceptCount} coded medical concept(s) and combined them with demographic and temporal constraints from your prompt. It then generated a SQL query that prioritizes deterministic filters for explainability. Estimated confidence: ${Math.round(
    result.confidenceScore * 100
  )}%.`;
}

export function translateMedicalQuery(input: string): QueryResult {
  const parsed = parseMedicalQuestion(input);
  const sql = generateSqlFromParsedQuery(parsed);

  return {
    id: `query-${Date.now()}`,
    timestamp: Date.now(),
    input,
    sql,
    concepts: parsed.concepts,
    filters: parsed.filters,
    confidenceScore: parsed.confidenceScore,
    explanationSteps: [
      ...parsed.explanationSteps,
      "Compiled SQL WHERE clauses from extracted concepts and filters.",
    ],
    aiExplanation: buildAiExplanation({
      sql,
      conceptCount: parsed.concepts.length,
      confidenceScore: parsed.confidenceScore,
    }),
    translationMode: "deterministic",
    statusLabel: "Deterministic Mode",
    statusDetail: "Generated using rule-based parser and SQL generator.",
  };
}
