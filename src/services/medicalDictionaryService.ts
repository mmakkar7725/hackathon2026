import { medicalDictionary } from "@/data/medicalDictionary";
import { MedicalDictionaryEntry } from "@/types/medical";

function scoreMatch(entry: MedicalDictionaryEntry, lowerInput: string) {
  let topScore = 0;
  let bestFragment = "";

  for (const synonym of entry.synonyms) {
    if (lowerInput.includes(synonym)) {
      const score = Math.min(0.96, 0.68 + synonym.length / 50);
      if (score > topScore) {
        topScore = score;
        bestFragment = synonym;
      }
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
