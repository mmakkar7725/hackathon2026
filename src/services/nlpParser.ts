import { identifyMedicalConcepts } from "@/services/medicalDictionaryService";
import {
  ExtractedMedicalConcept,
  ParseResult,
  QueryFilters,
} from "@/types/medical";

function extractAgeFilters(text: string, filters: QueryFilters, steps: string[]) {
  const aboveMatch = text.match(/(?:above|over|older than|greater than)\s*(\d{1,3})/i);
  if (aboveMatch) {
    filters.ageMin = Number(aboveMatch[1]);
    steps.push(`Detected age threshold: age > ${filters.ageMin}.`);
  }

  const belowMatch = text.match(/(?:below|under|younger than|less than)\s*(\d{1,3})/i);
  if (belowMatch) {
    filters.ageMax = Number(belowMatch[1]);
    steps.push(`Detected age threshold: age < ${filters.ageMax}.`);
  }
}

function extractGender(text: string, filters: QueryFilters, steps: string[]) {
  if (/\bfemale\b|\bwomen\b|\bwoman\b/i.test(text)) {
    filters.gender = "female";
    steps.push("Detected demographic filter: female patients.");
    return;
  }

  if (/\bmale\b|\bmen\b|\bman\b/i.test(text)) {
    filters.gender = "male";
    steps.push("Detected demographic filter: male patients.");
  }
}

function extractTimeFilters(text: string, filters: QueryFilters, steps: string[]) {
  if (/last year|past year|in the last year/i.test(text)) {
    filters.diagnosedWithinYears = 1;
    steps.push("Detected temporal filter: diagnosis in last 1 year.");
    return;
  }

  const yearsMatch = text.match(/(?:last|past)\s*(\d+)\s*years?/i);
  if (yearsMatch) {
    filters.diagnosedWithinYears = Number(yearsMatch[1]);
    steps.push(
      `Detected temporal filter: diagnosis in last ${filters.diagnosedWithinYears} years.`
    );
    return;
  }

  const monthsMatch = text.match(/(?:last|past)\s*(\d+)\s*months?/i);
  if (monthsMatch) {
    filters.diagnosedWithinMonths = Number(monthsMatch[1]);
    steps.push(
      `Detected temporal filter: diagnosis in last ${filters.diagnosedWithinMonths} months.`
    );
  }
}

export function parseMedicalQuestion(input: string): ParseResult {
  const explanationSteps: string[] = [
    "Normalized natural language prompt for pattern and entity detection.",
  ];
  const filters: QueryFilters = {};

  extractAgeFilters(input, filters, explanationSteps);
  extractGender(input, filters, explanationSteps);
  extractTimeFilters(input, filters, explanationSteps);

  const concepts: ExtractedMedicalConcept[] = identifyMedicalConcepts(input).map(
    (match) => ({
      id: match.entry.id,
      term: match.sourceFragment,
      canonicalName: match.entry.name,
      codingSystem: match.entry.codingSystem,
      code: match.entry.code,
      category: match.entry.category,
      confidence: Number(match.confidence.toFixed(2)),
      sourceFragment: match.sourceFragment,
    })
  );

  if (concepts.length > 0) {
    explanationSteps.push(
      `Mapped ${concepts.length} medical concept${
        concepts.length > 1 ? "s" : ""
      } to standard codes.`
    );
  } else {
    explanationSteps.push(
      "No coded concept found in dictionary, generated SQL from demographic and temporal filters only."
    );
  }

  const aggregateConfidence =
    concepts.length > 0
      ? concepts.reduce((sum, c) => sum + c.confidence, 0) / concepts.length
      : 0.52;

  return {
    input,
    concepts,
    filters,
    explanationSteps,
    confidenceScore: Number(aggregateConfidence.toFixed(2)),
  };
}
