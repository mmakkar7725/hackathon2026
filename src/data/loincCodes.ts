/**
 * Comprehensive LOINC Lab Test Codes
 * Logical Observation Identifiers Names and Codes
 * Lab test codes with reference ranges and units
 */

export const loincCodes = [
  // Chemistry Panel
  { code: "2160-0", name: "Creatinine [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.7, refMax: 1.3 },
  { code: "2951-2", name: "Sodium [Moles/volume] in Serum", unit: "mmol/L", refMin: 136, refMax: 145 },
  { code: "2823-3", name: "Potassium [Moles/volume] in Serum", unit: "mmol/L", refMin: 3.5, refMax: 5.0 },
  { code: "2075-0", name: "Chloride [Moles/volume] in Serum", unit: "mmol/L", refMin: 98, refMax: 107 },
  { code: "2704-7", name: "Glucose [Mass/volume] in Serum", unit: "mg/dL", refMin: 70, refMax: 100 },
  { code: "3094-0", name: "Urea nitrogen [Mass/volume] in Serum", unit: "mg/dL", refMin: 7, refMax: 20 },
  { code: "2865-4", name: "Protein [Mass/volume] in Serum", unit: "g/dL", refMin: 6.0, refMax: 8.3 },
  { code: "1751-7", name: "Albumin [Mass/volume] in Serum", unit: "g/dL", refMin: 3.5, refMax: 5.5 },
  { code: "1743-4", name: "Albumin/Globulin ratio [Mass Ratio]", unit: "ratio", refMin: 1.0, refMax: 2.5 },
  { code: "2606-2", name: "Glycated Hemoglobin A1c [Mass Fraction]", unit: "%", refMin: 4.0, refMax: 5.9 },

  // Lipid Panel
  { code: "2085-9", name: "Cholesterol [Mass/volume] in Serum", unit: "mg/dL", refMin: 0, refMax: 199 },
  { code: "2089-1", name: "LDL Cholesterol [Mass/volume] in Serum", unit: "mg/dL", refMin: 0, refMax: 99 },
  { code: "2093-3", name: "HDL Cholesterol [Mass/volume] in Serum", unit: "mg/dL", refMin: 40, refMax: 200 },
  { code: "3043-7", name: "Triglycerides [Mass/volume] in Serum", unit: "mg/dL", refMin: 0, refMax: 149 },
  { code: "1001-9", name: "Cholesterol/Triglycerides ratio", unit: "ratio", refMin: 1.0, refMax: 10.0 },

  // Liver Function Tests
  { code: "1742-6", name: "Alanine aminotransferase [Catalytic Activity/volume] in Serum", unit: "U/L", refMin: 7, refMax: 56 },
  { code: "1920-8", name: "Aspartate aminotransferase [Catalytic Activity/volume] in Serum", unit: "U/L", refMin: 10, refMax: 40 },
  { code: "1975-2", name: "Bilirubin.total [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.1, refMax: 1.2 },
  { code: "1968-7", name: "Bilirubin.direct [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.0, refMax: 0.3 },
  { code: "1920-8", name: "Alkaline phosphatase [Catalytic Activity/volume] in Serum", unit: "U/L", refMin: 30, refMax: 120 },
  { code: "1849-2", name: "Gamma-glutamyltransferase [Catalytic Activity/volume] in Serum", unit: "U/L", refMin: 8, refMax: 61 },

  // Renal Function
  { code: "3097-3", name: "Urea nitrogen/Creatinine ratio [Molar ratio]", unit: "ratio", refMin: 10, refMax: 20 },
  { code: "2160-0", name: "Creatinine [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.7, refMax: 1.3 },
  { code: "33914-3", name: "Glomerular filtration rate [Volume/time/area] in Serum", unit: "mL/min/1.73m2", refMin: 60, refMax: 200 },

  // Complete Blood Count
  { code: "2345-7", name: "Glucose [Mass/volume] in Serum 2 hours after glucose challenge", unit: "mg/dL", refMin: 0, refMax: 140 },
  { code: "789-8", name: "Erythrocyte sedimentation rate [Velocity] in Blood", unit: "mm/h", refMin: 0, refMax: 20 },
  { code: "718-7", name: "Hemoglobin [Mass/volume] in Blood", unit: "g/dL", refMin: 12.0, refMax: 16.0 },
  { code: "4544-3", name: "Hematocrit [Volume Fraction] in Blood", unit: "%", refMin: 36.0, refMax: 46.0 },
  { code: "777-3", name: "Platelet count [Entitic number/volume] in Blood", unit: "10^3/uL", refMin: 150, refMax: 400 },
  { code: "6690-2", name: "Leukocyte count [Entitic number/volume] in Blood", unit: "10^3/uL", refMin: 4.5, refMax: 11.0 },
  { code: "742-7", name: "Erythrocyte mean corpuscular hemoglobin concentration", unit: "g/dL", refMin: 32, refMax: 36 },
  { code: "785-6", name: "Erythrocyte mean corpuscular volume", unit: "fL", refMin: 80, refMax: 100 },

  // Cardiac Markers
  { code: "19123-9", name: "Troponin I [Mass/volume] in Serum", unit: "ng/mL", refMin: 0, refMax: 0.04 },
  { code: "1988-8", name: "C-reactive protein [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.0, refMax: 0.3 },
  { code: "30934-4", name: "Troponin T [Mass/volume] in Serum", unit: "ng/mL", refMin: 0, refMax: 0.04 },
  { code: "83520-7", name: "Myoglobin [Mass/volume] in Serum", unit: "ng/mL", refMin: 20, refMax: 200 },
  { code: "42637-9", name: "B-type natriuretic peptide [Mass/volume] in Serum", unit: "pg/mL", refMin: 0, refMax: 100 },

  // Thyroid Function
  { code: "3016-3", name: "Thyrotropin [Moles/volume] in Serum", unit: "mIU/L", refMin: 0.4, refMax: 4.0 },
  { code: "3024-7", name: "Thyroxine (T4) [Mass/volume] in Serum", unit: "ug/dL", refMin: 4.5, refMax: 12.0 },
  { code: "3635-3", name: "Triiodothyronine (T3) [Mass/volume] in Serum", unit: "ng/dL", refMin: 80, refMax: 200 },

  // Hormone Tests
  { code: "2171-7", name: "Cortisol [Mass/volume] in Serum morning", unit: "ug/dL", refMin: 5, refMax: 25 },
  { code: "2173-3", name: "Cortisol [Mass/volume] in Serum evening", unit: "ug/dL", refMin: 2, refMax: 9 },
  { code: "2161-8", name: "Testosterone [Moles/volume] in Serum", unit: "ng/dL", refMin: 300, refMax: 1000 },
  { code: "2243-3", name: "Prolactin [Mass/volume] in Serum", unit: "ng/mL", refMin: 2, refMax: 29 },

  // Coagulation Tests
  { code: "3150-0", name: "Prothrombin time [Time] in Blood", unit: "seconds", refMin: 11, refMax: 13.5 },
  { code: "3173-2", name: "Thrombin time [Time] in Blood", unit: "seconds", refMin: 14, refMax: 21 },
  { code: "3267-3", name: "Activated partial thromboplastin time [Time] in Blood", unit: "seconds", refMin: 25, refMax: 35 },
  { code: "3162-5", name: "Prothrombin time INR [Ratio]", unit: "ratio", refMin: 0.8, refMax: 1.1 },

  // Immunology/Serology
  { code: "22496-4", name: "Immunoglobulin G [Mass/volume] in Serum", unit: "mg/dL", refMin: 700, refMax: 1600 },
  { code: "22497-2", name: "Immunoglobulin M [Mass/volume] in Serum", unit: "mg/dL", refMin: 40, refMax: 230 },
  { code: "22498-0", name: "Immunoglobulin A [Mass/volume] in Serum", unit: "mg/dL", refMin: 70, refMax: 400 },
  { code: "23460-5", name: "HIV1/HIV2 antigen and antibody [Presence]", unit: "presence/absence", refMin: 0, refMax: 0 },
  { code: "20507-0", name: "Hepatitis B surface antigen [Presence]", unit: "presence/absence", refMin: 0, refMax: 0 },
  { code: "11011-4", name: "Hepatitis C virus antibody [Presence]", unit: "presence/absence", refMin: 0, refMax: 0 },

  // Urinalysis Components
  { code: "2339-0", name: "Glucose [Mass/volume] in Urine", unit: "mg/dL", refMin: 0, refMax: 0 },
  { code: "2340-8", name: "Protein [Mass/volume] in Urine", unit: "mg/dL", refMin: 0, refMax: 10 },
  { code: "20507-9", name: "Leukocytes [Presence] in Urine by automated urinalysis", unit: "presence/absence", refMin: 0, refMax: 0 },
  { code: "5803-2", name: "Nitrite [Presence] in Urine", unit: "presence/absence", refMin: 0, refMax: 0 },
  { code: "2324-2", name: "Blood [Presence] in Urine by automated urinalysis", unit: "presence/absence", refMin: 0, refMax: 0 },

  // Metabolic Tests
  { code: "2703-9", name: "Glucose [Mass/volume] in Serum - fasting", unit: "mg/dL", refMin: 70, refMax: 100 },
  { code: "33037-3", name: "Glucose [Mass/volume] in Serum 2 hours after 75 g oral glucose challenge", unit: "mg/dL", refMin: 0, refMax: 140 },
  { code: "2619-8", name: "Bicarbonate [Moles/volume] in Serum", unit: "mmol/L", refMin: 23, refMax: 29 },
  { code: "2743-5", name: "Phosphate [Moles/volume] in Serum", unit: "mg/dL", refMin: 2.5, refMax: 4.5 },
  { code: "2757-5", name: "Magnesium [Mass/volume] in Serum", unit: "mg/dL", refMin: 1.7, refMax: 2.2 },
  { code: "2776-5", name: "Calcium [Mass/volume] in Serum", unit: "mg/dL", refMin: 8.5, refMax: 10.2 },

  // Bone Markers
  { code: "2510-7", name: "Alkaline phosphatase [Catalytic Activity/volume] in Serum bone specific", unit: "U/L", refMin: 11, refMax: 78 },
  { code: "26283-6", name: "Osteocalcin [Mass/volume] in Serum", unit: "ng/mL", refMin: 10, refMax: 42 },
  { code: "1919-0", name: "Collagen type 1 cross-linked C-telopeptide", unit: "ng/mL", refMin: 0.16, refMax: 0.40 },

  // Micronutrients
  { code: "2132-7", name: "Ferritin [Mass/volume] in Serum", unit: "ng/mL", refMin: 30, refMax: 400 },
  { code: "2823-3", name: "Iron [Moles/volume] in Serum", unit: "ug/dL", refMin: 60, refMax: 170 },
  { code: "2501-6", name: "Vitamin B12 [Mass/volume] in Serum", unit: "pg/mL", refMin: 200, refMax: 900 },
  { code: "2974-0", name: "Folate [Moles/volume] in Serum", unit: "ng/mL", refMin: 5.4, refMax: 20.5 },
  { code: "13982-0", name: "Vitamin D, 25-hydroxy [Mass/volume] in Serum", unit: "ng/mL", refMin: 30, refMax: 100 },

  // Pulmonary Function
  { code: "19912-0", name: "Forced expiratory volume 1", unit: "L", refMin: 2.5, refMax: 4.0 },
  { code: "19914-6", name: "Forced vital capacity", unit: "L", refMin: 3.0, refMax: 5.0 },
  { code: "19870-0", name: "FEV1/FVC ratio", unit: "ratio", refMin: 0.70, refMax: 1.0 },

  // Gastroenterology
  { code: "2309-2", name: "Albumin [Mass/volume] in Serum", unit: "g/dL", refMin: 3.5, refMax: 5.5 },
  { code: "1975-2", name: "Bilirubin.total [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.1, refMax: 1.2 },
  { code: "1920-8", name: "Aspartate aminotransferase [Catalytic Activity/volume] in Serum", unit: "U/L", refMin: 10, refMax: 40 },

  // Oncology Markers
  { code: "27353-1", name: "Prostate specific antigen [Mass/volume] in Serum", unit: "ng/mL", refMin: 0, refMax: 4.0 },
  { code: "20963-1", name: "Carcinoembryonic antigen [Mass/volume] in Serum", unit: "ng/mL", refMin: 0, refMax: 2.5 },
  { code: "17929-2", name: "Cancer antigen 19-9 [Mass/volume] in Serum", unit: "U/mL", refMin: 0, refMax: 37 },

  // Inflammation Markers
  { code: "1988-8", name: "C-reactive protein [Mass/volume] in Serum", unit: "mg/dL", refMin: 0.0, refMax: 0.3 },
  { code: "25404-8", name: "Ferritin [Mass/volume] in Serum", unit: "ng/mL", refMin: 30, refMax: 400 },
  { code: "3011-4", name: "Thrombin time [Time] in Blood", unit: "seconds", refMin: 14, refMax: 21 },
];
