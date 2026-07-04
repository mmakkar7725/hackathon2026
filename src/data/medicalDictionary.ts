import { MedicalDictionaryEntry } from "@/types/medical";

export const medicalDictionary: MedicalDictionaryEntry[] = [
  {
    id: "icd10-e11",
    name: "Diabetes mellitus type 2",
    codingSystem: "ICD10",
    code: "E11",
    category: "disease",
    synonyms: ["diabetes", "diabetic", "type 2 diabetes", "dm2"],
  },
  {
    id: "icd10-i10",
    name: "Essential hypertension",
    codingSystem: "ICD10",
    code: "I10",
    category: "disease",
    synonyms: ["hypertension", "high blood pressure", "htn"],
  },
  {
    id: "icd10-j45",
    name: "Asthma",
    codingSystem: "ICD10",
    code: "J45",
    category: "disease",
    synonyms: ["asthma", "wheezing"],
  },
  {
    id: "icd10-i25",
    name: "Chronic ischemic heart disease",
    codingSystem: "ICD10",
    code: "I25",
    category: "disease",
    synonyms: ["coronary artery disease", "cad", "heart disease"],
  },
  {
    id: "icd10-j44",
    name: "Chronic obstructive pulmonary disease",
    codingSystem: "ICD10",
    code: "J44",
    category: "disease",
    synonyms: ["copd", "chronic bronchitis", "emphysema"],
  },
  {
    id: "snomed-267036007",
    name: "Dyspnea",
    codingSystem: "SNOMED",
    code: "267036007",
    category: "symptom",
    synonyms: ["shortness of breath", "dyspnea", "breathlessness"],
  },
  {
    id: "snomed-422400008",
    name: "Vomiting symptom",
    codingSystem: "SNOMED",
    code: "422400008",
    category: "symptom",
    synonyms: ["vomiting", "emesis"],
  },
  {
    id: "snomed-25064002",
    name: "Headache",
    codingSystem: "SNOMED",
    code: "25064002",
    category: "symptom",
    synonyms: ["headache", "migraine"],
  },
  {
    id: "snomed-43724002",
    name: "Chills",
    codingSystem: "SNOMED",
    code: "43724002",
    category: "symptom",
    synonyms: ["chills", "shivering"],
  },
];

export const samplePrompts = [
  "Show diabetic patients above 60 years with hypertension diagnosed in the last year",
  "List female asthma patients younger than 18 diagnosed in the last 6 months",
  "Find male patients with shortness of breath and COPD over age 45",
  "Retrieve heart disease patients with headache diagnosed in the past 2 years",
];
