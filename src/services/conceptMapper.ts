import "server-only";

import type { ExtractedMedicalConcept } from "@/types/medical";
import { icd10Codes } from "@/data/icd10Codes";
import { snomedctCodes } from "@/data/snomedctCodes";
import { loincCodes } from "@/data/loincCodes";

interface GeminiCodeMappingResult {
  icd10Matches: Array<{
    code: string;
    name: string;
    confidence: number;
  }>;
  snomedMatches: Array<{
    code: string;
    name: string;
    confidence: number;
  }>;
  loincMatches: Array<{
    code: string;
    name: string;
    confidence: number;
  }>;
  explanation: string;
}

/**
 * Use Gemini AI to intelligently map natural language medical terms to standardized codes
 * (ICD-10, SNOMED-CT, LOINC)
 */
export async function mapConceptToStandardizedCodes(input: {
  medicalTerm: string;
  context?: string;
  category?: "disease" | "symptom" | "lab" | "procedure";
}): Promise<GeminiCodeMappingResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      icd10Matches: [],
      snomedMatches: [],
      loincMatches: [],
      explanation: "API key not configured",
    };
  }

  // Build available codes reference
  const icd10Reference = icd10Codes
    .slice(0, 50)
    .map((c) => `${c.code}: ${c.name}`)
    .join("\n");

  const snomedReference = snomedctCodes
    .slice(0, 50)
    .map((c) => `${c.code}: ${c.name}`)
    .join("\n");

  const loincReference = loincCodes
    .slice(0, 30)
    .map((c) => `${c.code}: ${c.name}`)
    .join("\n");

  const prompt = `You are a medical coding expert. Map the following clinical term to standardized medical codes.

Medical Term: "${input.medicalTerm}"
${input.context ? `Context: "${input.context}"` : ""}
${input.category ? `Category: ${input.category}` : ""}

Available ICD-10 Codes (sample):
${icd10Reference}

Available SNOMED-CT Codes (sample):
${snomedReference}

Available LOINC Codes (sample):
${loincReference}

Provide your response in JSON format:
{
  "icd10Matches": [
    {"code": "E11.9", "name": "Type 2 Diabetes", "confidence": 0.95},
    ...
  ],
  "snomedMatches": [
    {"code": "73211009", "name": "Diabetes mellitus type 2", "confidence": 0.92},
    ...
  ],
  "loincMatches": [
    {"code": "4548-4", "name": "Hemoglobin A1c", "confidence": 0.88},
    ...
  ],
  "explanation": "Mapped '${input.medicalTerm}' to diabetes-related codes across all three standards."
}

Return ONLY valid JSON, no markdown, no explanations outside the JSON.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return {
        icd10Matches: [],
        snomedMatches: [],
        loincMatches: [],
        explanation: `API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Parse JSON from response
    const parsed = JSON.parse(text) as GeminiCodeMappingResult;
    return parsed;
  } catch (error) {
    console.error("Error mapping concept to codes:", error);
    return {
      icd10Matches: [],
      snomedMatches: [],
      loincMatches: [],
      explanation: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Search through all coding systems for matches to a medical term
 */
export function searchAllCodingSystems(input: { term: string; limit?: number }) {
  const limit = input.limit || 5;
  const lowerTerm = input.term.toLowerCase();

  const icd10Matches = icd10Codes
    .filter(
      (code) =>
        code.name.toLowerCase().includes(lowerTerm) ||
        lowerTerm.includes(code.code.toLowerCase())
    )
    .slice(0, limit)
    .map((code) => ({
      system: "ICD10",
      code: code.code,
      name: code.name,
      confidence: 0.85,
    }));

  const snomedMatches = snomedctCodes
    .filter(
      (code) =>
        code.name.toLowerCase().includes(lowerTerm) ||
        lowerTerm.includes(code.code.toLowerCase())
    )
    .slice(0, limit)
    .map((code) => ({
      system: "SNOMED",
      code: code.code,
      name: code.name,
      confidence: 0.85,
    }));

  const loincMatches = loincCodes
    .filter(
      (code) =>
        code.name.toLowerCase().includes(lowerTerm) ||
        lowerTerm.includes(code.code.toLowerCase())
    )
    .slice(0, limit)
    .map((code) => ({
      system: "LOINC",
      code: code.code,
      name: code.name,
      confidence: 0.85,
    }));

  return {
    icd10: icd10Matches,
    snomed: snomedMatches,
    loinc: loincMatches,
  };
}

/**
 * Get related codes across coding systems (cross-mapping)
 */
export function getCrossSystemMappings(input: {
  icd10Code?: string;
  snomedCode?: string;
  loincCode?: string;
}) {
  // In a real system, this would use external mapping tables
  // For now, we'll search by similar terms
  const searchTerm =
    input.icd10Code ||
    input.snomedCode ||
    input.loincCode ||
    "disease";

  return searchAllCodingSystems({ term: searchTerm, limit: 3 });
}
