import { medicalDictionary } from "@/data/medicalDictionary";
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
