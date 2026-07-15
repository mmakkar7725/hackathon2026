import { medicalDictionary } from "@/data/medicalDictionary";
import { icd10Codes } from "@/data/icd10Codes";
import { snomedctCodes } from "@/data/snomedctCodes";
import { loincCodes } from "@/data/loincCodes";
import { MedicalDictionaryEntry } from "@/types/medical";

function levenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyTokenScore(target: string, inputTokens: string[]) {
  let bestScore = 0;
  let bestToken = "";

  const normalizedTarget = target.trim().toLowerCase();
  if (normalizedTarget.length < 4 || normalizedTarget.includes(" ")) {
    return {
      score: 0,
      fragment: "",
    };
  }

  for (const token of inputTokens) {
    if (token.length < 4) {
      continue;
    }

    const distance = levenshteinDistance(token, normalizedTarget);
    const maxDistance = Math.max(1, Math.floor(normalizedTarget.length * 0.25));

    if (distance > maxDistance) {
      continue;
    }

    const similarity = 1 - distance / normalizedTarget.length;
    const score = Math.min(0.86, 0.6 + similarity * 0.25);

    if (score > bestScore) {
      bestScore = score;
      bestToken = token;
    }
  }

  return {
    score: bestScore,
    fragment: bestToken,
  };
}

function scoreMatch(entry: MedicalDictionaryEntry, lowerInput: string) {
  let topScore = 0;
  let bestFragment = "";
  const tokens = lowerInput.match(/[a-z0-9]+/g) ?? [];

  for (const synonym of entry.synonyms) {
    if (lowerInput.includes(synonym)) {
      const score = Math.min(0.96, 0.68 + synonym.length / 50);
      if (score > topScore) {
        topScore = score;
        bestFragment = synonym;
      }
    }

    const fuzzy = fuzzyTokenScore(synonym.toLowerCase(), tokens);
    if (fuzzy.score > topScore) {
      topScore = fuzzy.score;
      bestFragment = fuzzy.fragment || synonym;
    }
  }

  if (lowerInput.includes(entry.name.toLowerCase())) {
    const score = 0.95;
    if (score > topScore) {
      topScore = score;
      bestFragment = entry.name;
    }
  }

  return {
    topScore,
    bestFragment,
  };
}

/**
 * Identify medical concepts from text using expanded dictionaries
 * Supports ICD-10, SNOMED-CT, and LOINC codes
 */
export function identifyMedicalConcepts(input: string) {
  const lowerInput = input.toLowerCase();

  return medicalDictionary
    .map((entry) => {
      const { topScore, bestFragment } = scoreMatch(entry, lowerInput);
      return {
        entry,
        confidence: topScore,
        sourceFragment: bestFragment,
      };
    })
    .filter((item) => item.confidence > 0);
}

/**
 * Search across all coding systems (ICD-10, SNOMED-CT, LOINC)
 */
export function searchAllCodingSystems(searchTerm: string, limit: number = 10) {
  const lowerTerm = searchTerm.toLowerCase();

  const icd10Results = icd10Codes
    .filter(
      (code) =>
        code.name.toLowerCase().includes(lowerTerm) ||
        code.code.toLowerCase().includes(lowerTerm)
    )
    .slice(0, limit)
    .map((code) => ({
      system: "ICD10" as const,
      code: code.code,
      name: code.name,
      confidence: 0.85,
    }));

  const snomedResults = snomedctCodes
    .filter(
      (code) =>
        code.name.toLowerCase().includes(lowerTerm) ||
        code.code.toLowerCase().includes(lowerTerm)
    )
    .slice(0, limit)
    .map((code) => ({
      system: "SNOMED" as const,
      code: code.code,
      name: code.name,
      confidence: 0.85,
    }));

  const loincResults = loincCodes
    .filter(
      (code) =>
        code.name.toLowerCase().includes(lowerTerm) ||
        code.code.toLowerCase().includes(lowerTerm)
    )
    .slice(0, limit)
    .map((code) => ({
      system: "LOINC" as const,
      code: code.code,
      name: code.name,
      confidence: 0.80,
    }));

  return {
    icd10: icd10Results,
    snomed: snomedResults,
    loinc: loincResults,
    total: icd10Results.length + snomedResults.length + loincResults.length,
  };
}
