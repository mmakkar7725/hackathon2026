export interface DemographicsRecord {
  id: string;
  sourceFileName: string;
  patientId: string;
  fullName: string;
  age?: number;
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  ethnicity?: string;
  race?: string;
  extractedAt: number;
}

export interface MedicalHistoryRecord {
  id: string;
  sourceFileName: string;
  patientId: string;
  condition: string;
  codeSystem: "ICD10" | "SNOMED" | "LOINC" | "UNKNOWN";
  code: string;
  note?: string;
  onsetDate?: string;
  extractedAt: number;
}

export interface IntakeParseResponse {
  demographics: DemographicsRecord[];
  medicalHistory: MedicalHistoryRecord[];
  parserMode: "gemini" | "fallback";
  statusLabel: string;
  statusDetail: string;
  parseMeta?: {
    extractionSource?: string;
    extractedTextLength?: number;
    finalTextLength?: number;
    usedTranscription?: boolean;
    transcriptionModel?: string;
    geminiFailureReason?: string;
    extractorFailureDetail?: string;
    transcriptionFailureDetail?: string;
  };
}
