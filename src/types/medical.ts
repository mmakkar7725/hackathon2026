export type MedicalCategory =
  | "disease"
  | "symptom"
  | "demographic"
  | "filter";

export interface MedicalDictionaryEntry {
  id: string;
  name: string;
  codingSystem: "ICD10" | "SNOMED";
  code: string;
  category: Exclude<MedicalCategory, "demographic" | "filter">;
  synonyms: string[];
}

export interface ExtractedMedicalConcept {
  id: string;
  term: string;
  canonicalName: string;
  codingSystem: "ICD10" | "SNOMED";
  code: string;
  category: MedicalCategory;
  confidence: number;
  sourceFragment: string;
}

export interface QueryFilters {
  ageMin?: number;
  ageMax?: number;
  gender?: "male" | "female";
  diagnosedWithinYears?: number;
  diagnosedWithinMonths?: number;
}

export interface ParseResult {
  input: string;
  concepts: ExtractedMedicalConcept[];
  filters: QueryFilters;
  explanationSteps: string[];
  confidenceScore: number;
}

export type TranslationMode = "deterministic" | "gemini-assist";

export interface QueryResult {
  id: string;
  timestamp: number;
  input: string;
  sql: string;
  concepts: ExtractedMedicalConcept[];
  filters: QueryFilters;
  confidenceScore: number;
  explanationSteps: string[];
  aiExplanation: string;
  translationMode: TranslationMode;
  modelUsed?: string;
  statusLabel?: string;
  statusDetail?: string;
}
