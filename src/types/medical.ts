export type MedicalCategory =
  | "disease"
  | "symptom"
  | "demographic"
  | "filter";

export interface MedicalDictionaryEntry {
  id: string;
  name: string;
  codingSystem: "ICD10" | "SNOMED" | "LOINC";
  code: string;
  category: Exclude<MedicalCategory, "demographic" | "filter">;
  synonyms: string[];
  labValue?: {
    unit: string;
    refMin: number;
    refMax: number;
  };
}

export interface ExtractedMedicalConcept {
  id: string;
  term: string;
  canonicalName: string;
  codingSystem: "ICD10" | "SNOMED" | "LOINC" | "UNKNOWN";
  code: string;
  category: MedicalCategory;
  confidence: number;
  sourceFragment: string;
}

export interface QueryFilters {
  ageMin?: number;
  ageMax?: number;
  gender?: "male" | "female";
  ethnicity?: string;
  race?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  zipcodeRadiusMiles?: number;
  diagnosedWithinYears?: number;
  diagnosedWithinMonths?: number;
  // Lab value filters
  labValues?: Map<string, { operator: string; value: number }>;
  // Direct ICD codes
  directIcdCodes?: string[];
  // Exclusions
  exclusions?: string[];
  // Selected fields
  selectedFields?: string[];
  // Insurance/payer status
  insuranceStatus?: string[];
  // Required condition codes (must all be present)
  requiredConditionCodes?: string[];
  // Medication exclusions (NOT on these medications)
  medicationExclusions?: string[];
}

export interface ParseResult {
  input: string;
  concepts: ExtractedMedicalConcept[];
  filters: QueryFilters;
  explanationSteps: string[];
  confidenceScore: number;
}

export type TranslationMode = "deterministic" | "gemini-assist";

export interface QueryFeasibilityResult {
  feasible: boolean;
  expectedRowsMin: number;
  expectedRowsMax: number;
  estimatedConfidence: number;
  warnings: string[];
  suggestions: string[];
}

export type AmbiguityType =
  | "medical-concept"
  | "temporal"
  | "demographic"
  | "structural";

export interface AmbiguityInterpretation {
  option: string;
  likelihood: "high" | "medium" | "low";
  explanation: string;
  clarifiedPhrase?: string;
}

export interface AmbiguityDetection {
  id: string;
  fragment: string;
  type: AmbiguityType;
  interpretations: AmbiguityInterpretation[];
  selectedInterpretationIndex?: number;
}

export interface AmbiguityResolution {
  hasAmbiguities: boolean;
  ambiguities: AmbiguityDetection[];
  clarifiedPrompt?: string;
}

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
  feasibilityCheck?: QueryFeasibilityResult;
}

export interface QueryInsightsResponse {
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
  source?: "gemini" | "fallback";
  model?: string;
}
