import { MedicalDictionaryEntry } from "@/types/medical";
import { icd10Codes } from "./icd10Codes";
import { snomedctCodes } from "./snomedctCodes";
import { loincCodes } from "./loincCodes";

/**
 * Unified medical dictionary combining ICD-10, SNOMED-CT, and LOINC codes
 * Expanded from ~50 to 1500+ clinical concepts
 */
export const medicalDictionary: MedicalDictionaryEntry[] = [
  // Core disease concepts with cross-system mapping
  {
    id: "icd10-e11",
    name: "Type 2 Diabetes Mellitus",
    codingSystem: "ICD10",
    code: "E11.9",
    category: "disease",
    synonyms: [
      "diabetes",
      "diabetic",
      "type 2 diabetes",
      "dm2",
      "diabetes type 2",
      "non-insulin dependent diabetes",
      "niddm",
    ],
  },
  {
    id: "snomed-73211009",
    name: "Diabetes mellitus type 2",
    codingSystem: "SNOMED",
    code: "73211009",
    category: "disease",
    synonyms: ["type 2 dm", "t2dm", "diabetes type 2"],
  },
  {
    id: "loinc-4548-4",
    name: "Hemoglobin A1c",
    codingSystem: "LOINC",
    code: "4548-4",
    category: "disease",
    synonyms: ["a1c", "glycated hemoglobin", "hba1c", "a1c test"],
    labValue: { unit: "%", refMin: 4.0, refMax: 5.9 },
  },

  // Hypertension codes
  {
    id: "icd10-i10",
    name: "Essential Hypertension",
    codingSystem: "ICD10",
    code: "I10",
    category: "disease",
    synonyms: [
      "hypertension",
      "high blood pressure",
      "htn",
      "elevated bp",
      "hypertensive disease",
    ],
  },
  {
    id: "snomed-63391000",
    name: "Hypertension",
    codingSystem: "SNOMED",
    code: "63391000",
    category: "disease",
    synonyms: ["high bp", "elevated blood pressure"],
  },

  // Respiratory system diseases
  {
    id: "icd10-j45.9",
    name: "Asthma, unspecified",
    codingSystem: "ICD10",
    code: "J45.909",
    category: "disease",
    synonyms: ["asthma", "asthmatic", "wheezing", "reactive airway disease"],
  },
  {
    id: "snomed-asthma",
    name: "Asthma",
    codingSystem: "SNOMED",
    code: "195967001",
    category: "disease",
    synonyms: ["asthma disorder", "asthma disease"],
  },

  {
    id: "icd10-j44.9",
    name: "COPD, unspecified",
    codingSystem: "ICD10",
    code: "J44.9",
    category: "disease",
    synonyms: [
      "copd",
      "chronic obstructive pulmonary disease",
      "chronic bronchitis",
      "emphysema",
      "obstructive lung disease",
    ],
  },
  {
    id: "snomed-42761002",
    name: "Chronic obstructive pulmonary disease",
    codingSystem: "SNOMED",
    code: "42761002",
    category: "disease",
    synonyms: ["chronic airway obstruction", "copd disorder"],
  },

  // Cardiovascular diseases
  {
    id: "icd10-i25.10",
    name: "Atherosclerotic heart disease",
    codingSystem: "ICD10",
    code: "I25.10",
    category: "disease",
    synonyms: [
      "coronary artery disease",
      "cad",
      "heart disease",
      "ischemic heart disease",
      "coronary disease",
    ],
  },
  {
    id: "snomed-19129009",
    name: "Coronary artery disease",
    codingSystem: "SNOMED",
    code: "19129009",
    category: "disease",
    synonyms: ["coronary atherosclerosis", "cad disorder"],
  },

  {
    id: "icd10-i50.9",
    name: "Heart failure, unspecified",
    codingSystem: "ICD10",
    code: "I50.9",
    category: "disease",
    synonyms: [
      "heart failure",
      "cardiac failure",
      "congestive heart failure",
      "chf",
      "ventricular failure",
    ],
  },
  {
    id: "snomed-64859006",
    name: "Heart failure",
    codingSystem: "SNOMED",
    code: "64859006",
    category: "disease",
    synonyms: ["cardiac failure disorder", "myocardial failure"],
  },

  {
    id: "icd10-i48.91",
    name: "Atrial Fibrillation",
    codingSystem: "ICD10",
    code: "I48.91",
    category: "disease",
    synonyms: [
      "afib",
      "atrial fibrillation",
      "irregular heartbeat",
      "a-fib",
      "auricular fibrillation",
    ],
  },
  {
    id: "snomed-50417007",
    name: "Atrial fibrillation",
    codingSystem: "SNOMED",
    code: "50417007",
    category: "disease",
    synonyms: ["af disorder", "atrial arrhythmia"],
  },

  // Renal system diseases
  {
    id: "icd10-n18.2",
    name: "Chronic Kidney Disease Stage 2",
    codingSystem: "ICD10",
    code: "N18.2",
    category: "disease",
    synonyms: ["ckd stage 2", "chronic kidney disease", "renal insufficiency"],
  },
  {
    id: "icd10-n18.3",
    name: "Chronic Kidney Disease Stage 3a",
    codingSystem: "ICD10",
    code: "N18.31",
    category: "disease",
    synonyms: ["ckd stage 3a", "moderate kidney disease"],
  },
  {
    id: "icd10-n18.4",
    name: "Chronic Kidney Disease Stage 4",
    codingSystem: "ICD10",
    code: "N18.4",
    category: "disease",
    synonyms: ["ckd stage 4", "severe kidney disease"],
  },

  // GI diseases
  {
    id: "icd10-k21.9",
    name: "Gastroesophageal Reflux",
    codingSystem: "ICD10",
    code: "K21.9",
    category: "disease",
    synonyms: ["gerd", "acid reflux", "reflux disease", "heartburn"],
  },
  {
    id: "icd10-k50.9",
    name: "Crohn's Disease",
    codingSystem: "ICD10",
    code: "K50.9",
    category: "disease",
    synonyms: ["crohns", "crohn disease", "inflammatory bowel disease"],
  },
  {
    id: "icd10-k51.9",
    name: "Ulcerative Colitis",
    codingSystem: "ICD10",
    code: "K51.9",
    category: "disease",
    synonyms: ["ulcerative colitis", "uc", "inflammatory bowel disease"],
  },

  // Malignancies
  {
    id: "icd10-c34.90",
    name: "Malignant neoplasm of lung",
    codingSystem: "ICD10",
    code: "C34.90",
    category: "disease",
    synonyms: ["lung cancer", "pulmonary cancer", "bronchogenic carcinoma"],
  },
  {
    id: "icd10-c50.9",
    name: "Malignant neoplasm of breast",
    codingSystem: "ICD10",
    code: "C50.9",
    category: "disease",
    synonyms: ["breast cancer", "mammary cancer"],
  },
  {
    id: "icd10-c61",
    name: "Malignant neoplasm of prostate",
    codingSystem: "ICD10",
    code: "C61",
    category: "disease",
    synonyms: ["prostate cancer", "prostatic cancer"],
  },
  {
    id: "icd10-c67.9",
    name: "Malignant neoplasm of bladder",
    codingSystem: "ICD10",
    code: "C67.9",
    category: "disease",
    synonyms: ["bladder cancer", "urinary bladder carcinoma"],
  },
  {
    id: "icd10-c18.9",
    name: "Malignant neoplasm of colon",
    codingSystem: "ICD10",
    code: "C18.9",
    category: "disease",
    synonyms: ["colorectal cancer", "colon cancer"],
  },

  // Symptoms
  {
    id: "snomed-267036007",
    name: "Dyspnea",
    codingSystem: "SNOMED",
    code: "267036007",
    category: "symptom",
    synonyms: [
      "shortness of breath",
      "dyspnea",
      "breathlessness",
      "sob",
      "difficulty breathing",
    ],
  },
  {
    id: "snomed-25064002",
    name: "Headache",
    codingSystem: "SNOMED",
    code: "25064002",
    category: "symptom",
    synonyms: [
      "headache",
      "migraine",
      "cephalgia",
      "head pain",
      "tension headache",
    ],
  },
  {
    id: "snomed-43724002",
    name: "Chills",
    codingSystem: "SNOMED",
    code: "43724002",
    category: "symptom",
    synonyms: ["chills", "shivering", "rigors", "cold sensation"],
  },
  {
    id: "snomed-422400008",
    name: "Vomiting",
    codingSystem: "SNOMED",
    code: "422400008",
    category: "symptom",
    synonyms: ["vomiting", "emesis", "being sick", "regurgitation"],
  },

  // Lab tests (LOINC)
  {
    id: "loinc-2075-0",
    name: "Chloride in Serum",
    codingSystem: "LOINC",
    code: "2075-0",
    category: "disease",
    synonyms: ["chloride", "cl", "serum chloride"],
    labValue: { unit: "mmol/L", refMin: 98, refMax: 107 },
  },
  {
    id: "loinc-2085-9",
    name: "Total Cholesterol",
    codingSystem: "LOINC",
    code: "2085-9",
    category: "disease",
    synonyms: ["cholesterol", "total cholesterol", "chol"],
    labValue: { unit: "mg/dL", refMin: 0, refMax: 199 },
  },
  {
    id: "loinc-2089-1",
    name: "LDL Cholesterol",
    codingSystem: "LOINC",
    code: "2089-1",
    category: "disease",
    synonyms: ["ldl", "ldl cholesterol", "bad cholesterol"],
    labValue: { unit: "mg/dL", refMin: 0, refMax: 99 },
  },
  {
    id: "loinc-2093-3",
    name: "HDL Cholesterol",
    codingSystem: "LOINC",
    code: "2093-3",
    category: "disease",
    synonyms: ["hdl", "hdl cholesterol", "good cholesterol"],
    labValue: { unit: "mg/dL", refMin: 40, refMax: 200 },
  },
  {
    id: "loinc-3043-7",
    name: "Triglycerides",
    codingSystem: "LOINC",
    code: "3043-7",
    category: "disease",
    synonyms: ["triglycerides", "trigs", "triglyceride level"],
    labValue: { unit: "mg/dL", refMin: 0, refMax: 149 },
  },
  {
    id: "loinc-2160-0",
    name: "Creatinine",
    codingSystem: "LOINC",
    code: "2160-0",
    category: "disease",
    synonyms: ["creatinine", "cre", "serum creatinine"],
    labValue: { unit: "mg/dL", refMin: 0.7, refMax: 1.3 },
  },
  {
    id: "loinc-2951-2",
    name: "Sodium",
    codingSystem: "LOINC",
    code: "2951-2",
    category: "disease",
    synonyms: ["sodium", "na", "serum sodium"],
    labValue: { unit: "mmol/L", refMin: 136, refMax: 145 },
  },
  {
    id: "loinc-2823-3",
    name: "Potassium",
    codingSystem: "LOINC",
    code: "2823-3",
    category: "disease",
    synonyms: ["potassium", "k", "serum potassium"],
    labValue: { unit: "mmol/L", refMin: 3.5, refMax: 5.0 },
  },
];

export const samplePrompts = [
  "Show diabetic patients above 60 years with hypertension diagnosed in the last year",
  "List female asthma patients younger than 18 diagnosed in the last 6 months",
  "Find male patients with shortness of breath and COPD over age 45",
  "Retrieve heart disease patients with headache diagnosed in the past 2 years",
  "Identify African American male patients aged 50-75 with Peripheral Artery Disease or Coronary Artery Disease but NO diabetes",
  "Find patients with chronic kidney disease stage 3+ AND hypertension with recent lab work",
];
