import { identifyMedicalConcepts } from "@/services/medicalDictionaryService";
import {
  ExtractedMedicalConcept,
  ParseResult,
  QueryFilters,
} from "@/types/medical";

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

const STATE_ABBREVIATIONS = new Set(Object.values(STATE_NAME_TO_ABBREV));

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectStateFromPrompt(text: string) {
  const lower = text.toLowerCase();

  for (const [name, abbreviation] of Object.entries(STATE_NAME_TO_ABBREV)) {
    const expression = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    if (expression.test(lower)) {
      return abbreviation;
    }
  }

  return undefined;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () => 
    Array(a.length + 1).fill(0)
  );
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
}

function findBestStateMatch(input: string): string | undefined {
  const lowered = input.toLowerCase();
  const candidates = Object.keys(STATE_NAME_TO_ABBREV).filter(state => 
    levenshteinDistance(lowered, state) <= 2
  );
  
  if (candidates.length === 0) return undefined;
  
  return STATE_NAME_TO_ABBREV[
    candidates.reduce((closest, current) => 
      levenshteinDistance(lowered, current) < levenshteinDistance(lowered, closest)
        ? current
        : closest
    )
  ];
}

function normalizeState(input?: string) {
  if (!input) {
    return undefined;
  }

  const cleaned = input.replace(/[^A-Za-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return undefined;
  }

  const lowered = cleaned.toLowerCase();
  if (STATE_NAME_TO_ABBREV[lowered]) {
    return STATE_NAME_TO_ABBREV[lowered];
  }

  const upper = cleaned.toUpperCase();
  if (STATE_ABBREVIATIONS.has(upper)) {
    return upper;
  }

  // Try fuzzy matching for typos
  const fuzzyMatch = findBestStateMatch(lowered);
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  return undefined;
}

function extractAgeFilters(text: string, filters: QueryFilters, steps: string[]) {
  const middleAgeMatch = /\bmiddle\s*-?\s*age(?:d)?\b|\bmid\s*-?\s*life\b/i.test(text);
  if (middleAgeMatch) {
    // Practical hackathon default band for "middle-aged" cohorts.
    filters.ageMin = 35;
    filters.ageMax = 60;
    steps.push("Detected age band: middle-aged (35-60 years).");
  }

  const aboveMatch = text.match(
    /(?:age\s*(?:more\s*than|more\s*then|above|over)|more\s*than|more\s*then|above|over|older\s*than|greater\s*than)\s*(\d{1,3})/i
  );
  if (aboveMatch) {
    filters.ageMin = Number(aboveMatch[1]);
    steps.push(`Detected age threshold: age > ${filters.ageMin}.`);
  }

  const belowMatch = text.match(/(?:below|under|younger than|less than)\s*(\d{1,3})/i);
  if (belowMatch) {
    filters.ageMax = Number(belowMatch[1]);
    steps.push(`Detected age threshold: age < ${filters.ageMax}.`);
  }
}

function extractGender(text: string, filters: QueryFilters, steps: string[]) {
  if (/\bfemale\b|\bwomen\b|\bwoman\b/i.test(text)) {
    filters.gender = "female";
    steps.push("Detected demographic filter: female patients.");
    return;
  }

  if (/\bmale\b|\bmen\b|\bman\b/i.test(text)) {
    filters.gender = "male";
    steps.push("Detected demographic filter: male patients.");
  }
}

function extractEthnicityAndRace(text: string, filters: QueryFilters, steps: string[]) {
  if (/\blatino\b|\blatina\b|\bhispanic\b/i.test(text)) {
    filters.ethnicity = "Hispanic or Latino";
    steps.push("Detected demographic filter: ethnicity Hispanic or Latino.");
  } else if (/\bnon\s*-?\s*hispanic\b|\bnot\s+hispanic\b/i.test(text)) {
    filters.ethnicity = "Not Hispanic or Latino";
    steps.push("Detected demographic filter: ethnicity Not Hispanic or Latino.");
  }

  if (/\bwhite\b|\bcaucasian\b/i.test(text)) {
    filters.race = "White";
    steps.push("Detected demographic filter: race White.");
    return;
  }

  if (/\bblack\b|\bafrican american\b/i.test(text)) {
    filters.race = "Black or African American";
    steps.push("Detected demographic filter: race Black or African American.");
    return;
  }

  if (/\basian\b/i.test(text)) {
    filters.race = "Asian";
    steps.push("Detected demographic filter: race Asian.");
    return;
  }

  if (/\bamerican indian\b|\balaska native\b/i.test(text)) {
    filters.race = "American Indian or Alaska Native";
    steps.push("Detected demographic filter: race American Indian or Alaska Native.");
    return;
  }

  if (/\bpacific islander\b|\bnative hawaiian\b/i.test(text)) {
    filters.race = "Native Hawaiian or Other Pacific Islander";
    steps.push("Detected demographic filter: race Native Hawaiian or Other Pacific Islander.");
  }
}

function extractTimeFilters(text: string, filters: QueryFilters, steps: string[]) {
  if (/last year|past year|in the last year/i.test(text)) {
    filters.diagnosedWithinYears = 1;
    steps.push("Detected temporal filter: diagnosis in last 1 year.");
    return;
  }

  const yearsMatch = text.match(/(?:last|past)\s*(\d+)\s*years?/i);
  if (yearsMatch) {
    filters.diagnosedWithinYears = Number(yearsMatch[1]);
    steps.push(
      `Detected temporal filter: diagnosis in last ${filters.diagnosedWithinYears} years.`
    );
    return;
  }

  const monthsMatch = text.match(/(?:last|past)\s*(\d+)\s*months?/i);
  if (monthsMatch) {
    filters.diagnosedWithinMonths = Number(monthsMatch[1]);
    steps.push(
      `Detected temporal filter: diagnosis in last ${filters.diagnosedWithinMonths} months.`
    );
  }
}

function extractLocationFilters(text: string, filters: QueryFilters, steps: string[]) {
  const radiusMatch = text.match(
    /(?:within|in)\s*(\d{1,4})\s*(?:mile|miles|mi)\s*(?:of|from|around)?\s*(?:zip(?:\s*code)?\s*)?(\d{5}(?:-\d{4})?)/i
  );
  if (radiusMatch) {
    filters.zipcodeRadiusMiles = Number(radiusMatch[1]);
    filters.zipcode = radiusMatch[2];
    steps.push(
      `Detected geographic filter: within ${filters.zipcodeRadiusMiles} miles of ZIP ${filters.zipcode}.`
    );
  }

  const zipMatch = text.match(/(?:zip(?:\s*code)?\s*(?:is|=|:)?\s*|\bin\s+)(\d{5}(?:-\d{4})?)/i);
  if (zipMatch) {
    filters.zipcode = zipMatch[1];
    steps.push(`Detected location filter: ZIP code ${filters.zipcode}.`);
  }

  const explicitStateMatch = text.match(
    /\b(?:state\s*(?:is|=|:)?\s*|in\s+state\s+|state\s+of\s+)([A-Za-z][A-Za-z\s]{1,30})\b/i
  );

  const narrativeStateMatch = text.match(
    /\b(?:living|residing|located|staying)\s+in\s+([A-Za-z][A-Za-z\s]{1,30})\b/i
  );

  const inPhraseStateMatch = text.match(/\bin\s+([A-Za-z][A-Za-z\s]{1,30})\b/i);

  const stateCandidate =
    explicitStateMatch?.[1] ??
    narrativeStateMatch?.[1] ??
    inPhraseStateMatch?.[1];
  const normalizedState = normalizeState(stateCandidate);

  const detectedState = normalizedState ?? detectStateFromPrompt(text);

  if (detectedState) {
    filters.state = detectedState;
    steps.push(`Detected location filter: state ${filters.state}.`);
  }

  // Improved city extraction: support "City, State Zip" format
  const cityMatch = text.match(/\b(?:city\s*(?:is|=|:)?\s*|in\s+city\s+|in\s+)([A-Za-z][A-Za-z\s.'-]{1,40})(?:\s*,|\s+(?:TX|CA|NY|FL|PA|IL|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MD|MO|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|NM|NV|AR|MS|KS|IA|NE|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC)\s+)/i);
  if (cityMatch) {
    filters.city = cityMatch[1].trim();
    steps.push(`Detected location filter: city ${filters.city}.`);
  }
}

function extractDirectIcdCodes(text: string, steps: string[]): string[] {
  // Match ICD-10 codes like E78.5, I10, J45.909, etc.
  const icdPattern = /\b([A-Z]\d{2}(?:\.\d{1,3})?)\b/g;
  const matches = text.match(icdPattern) ?? [];
  
  if (matches.length > 0) {
    steps.push(`Detected direct ICD-10 codes: ${matches.join(", ")}.`);
  }
  
  return matches;
}

function extractLabValues(text: string, steps: string[]): Map<string, { operator: string; value: number }> {
  const labValues = new Map<string, { operator: string; value: number }>();
  
  // Extract LDL cholesterol values
  const ldlPattern = /(?:ldl|ldl\s*cholesterol)\s*([<>]=?)\s*(\d+(?:\.\d+)?)\s*(?:mg\/dl|mg\/dL|mg\/dl)/i;
  const ldlMatch = text.match(ldlPattern);
  if (ldlMatch) {
    labValues.set("LDL", { operator: ldlMatch[1], value: Number(ldlMatch[2]) });
    steps.push(`Detected lab filter: LDL ${ldlMatch[1]} ${ldlMatch[2]} mg/dL.`);
  }
  
  // Extract HDL cholesterol values
  const hdlPattern = /(?:hdl|hdl\s*cholesterol)\s*([<>]=?)\s*(\d+(?:\.\d+)?)\s*(?:mg\/dl|mg\/dL)/i;
  const hdlMatch = text.match(hdlPattern);
  if (hdlMatch) {
    labValues.set("HDL", { operator: hdlMatch[1], value: Number(hdlMatch[2]) });
    steps.push(`Detected lab filter: HDL ${hdlMatch[1]} ${hdlMatch[2]} mg/dL.`);
  }
  
  // Extract A1C values
  const a1cPattern = /(?:a1c|a1C|hba1c|HbA1c)\s*([<>]=?)\s*(\d+(?:\.\d+)?)\s*%/i;
  const a1cMatch = text.match(a1cPattern);
  if (a1cMatch) {
    labValues.set("A1C", { operator: a1cMatch[1], value: Number(a1cMatch[2]) });
    steps.push(`Detected lab filter: A1C ${a1cMatch[1]} ${a1cMatch[2]}%.`);
  }
  
  return labValues;
}

function extractExclusions(text: string, steps: string[]): string[] {
  const exclusions: string[] = [];
  
  // Extract smoking status exclusions
  if (/exclude.*(?:former\s+smoker|ex-smoker|previous\s+smoker)|no.*(?:former\s+smoker|ex-smoker)/i.test(text)) {
    exclusions.push("former_smoker");
    steps.push("Detected exclusion filter: exclude former smokers.");
  }
  
  if (/exclude.*(?:current\s+smoker|active\s+smoker)|no.*(?:current\s+smoker|active\s+smoker)/i.test(text)) {
    exclusions.push("current_smoker");
    steps.push("Detected exclusion filter: exclude current smokers.");
  }
  
  // Extract disease exclusions
  if (/exclude.*(?:diabetic|diabetes)|no.*(?:diabetic|diabetes)/i.test(text)) {
    exclusions.push("diabetes");
    steps.push("Detected exclusion filter: exclude patients with diabetes.");
  }
  
  return exclusions;
}

function extractRequestedFields(text: string, steps: string[]): string[] {
  const fields: string[] = [];
  
  // Check for commonly requested fields
  const fieldPatterns: Record<string, RegExp> = {
    medications: /medication|drug|prescription/i,
    diagnosis_codes: /diagnosis code|icd|diagnosis_code/i,
    procedures: /procedure|surgical/i,
    lab_results: /lab|laboratory|test result|labValue/i,
    race: /race/i,
    ethnicity: /ethnicity|ethnic/i,
    date_of_birth: /date of birth|dob|birth date/i,
    contact_info: /contact|phone|email|address/i,
  };
  
  for (const [field, pattern] of Object.entries(fieldPatterns)) {
    if (pattern.test(text)) {
      fields.push(field);
    }
  }
  
  if (fields.length > 0) {
    steps.push(`Detected requested fields: ${fields.join(", ")}.`);
  }
  
  return fields;
}

function extractInsuranceStatus(text: string, steps: string[]): string[] {
  const insuranceTypes: string[] = [];
  
  if (/\bMedicare\b/i.test(text)) {
    insuranceTypes.push("Medicare");
    steps.push("Detected insurance filter: Medicare patients.");
  }
  
  if (/\bMedicaid\b/i.test(text)) {
    insuranceTypes.push("Medicaid");
    steps.push("Detected insurance filter: Medicaid patients.");
  }
  
  if (/\bcommercial\s+insurance\b|\bprivate\s+insurance\b/i.test(text)) {
    insuranceTypes.push("Commercial");
    steps.push("Detected insurance filter: Commercial insurance patients.");
  }
  
  if (/\buninsured\b|\bno\s+insurance\b/i.test(text)) {
    insuranceTypes.push("Uninsured");
    steps.push("Detected insurance filter: Uninsured patients.");
  }
  
  return insuranceTypes;
}

function extractMedicationExclusions(text: string, steps: string[]): string[] {
  const medicationExclusions: string[] = [];
  
  // Extract NOT on specific medications
  const patterns = [
    { regex: /not\s+on\s+insulin|excluding?\s+insulin|without\s+insulin/i, med: "insulin", label: "insulin" },
    { regex: /not\s+on\s+statin|excluding?\s+statin|without\s+statin/i, med: "statin", label: "statin" },
    { regex: /not\s+on\s+ace\s+inhibitor|excluding?\s+ace|without\s+ace/i, med: "ace_inhibitor", label: "ACE inhibitor" },
    { regex: /not\s+on\s+beta\s+blocker|excluding?\s+beta\s+blocker|without\s+beta\s+blocker/i, med: "beta_blocker", label: "beta blocker" },
    { regex: /not\s+on\s+anticoagulant|excluding?\s+anticoagulant|without\s+anticoagulant/i, med: "anticoagulant", label: "anticoagulant" },
  ];
  
  for (const { regex, med, label } of patterns) {
    if (regex.test(text)) {
      medicationExclusions.push(med);
      steps.push(`Detected medication exclusion: NOT on ${label}.`);
    }
  }
  
  return medicationExclusions;
}

function extractRequiredConditions(
  concepts: Array<{ entry: { category: string; code: string }; confidence: number; sourceFragment: string }>,
  steps: string[]
): string[] {
  // Identify disease/condition codes that were matched
  const diseaseCodes = concepts
    .filter((c) => c.entry.category === "disease")
    .map((c) => c.entry.code);
  
  if (diseaseCodes.length > 1) {
    steps.push(
      `Detected multiple required conditions: patient must have ALL of ${diseaseCodes.join(", ")}.`
    );
  }
  
  return diseaseCodes;
}

export function parseMedicalQuestion(input: string): ParseResult {
  const explanationSteps: string[] = [
    "Normalized natural language prompt for pattern and entity detection.",
  ];
  const filters: QueryFilters = {};

  extractAgeFilters(input, filters, explanationSteps);
  extractGender(input, filters, explanationSteps);
  extractEthnicityAndRace(input, filters, explanationSteps);
  extractTimeFilters(input, filters, explanationSteps);
  extractLocationFilters(input, filters, explanationSteps);
  
  // Extract additional clinical data
  const directIcdCodes = extractDirectIcdCodes(input, explanationSteps);
  const labValues = extractLabValues(input, explanationSteps);
  const exclusions = extractExclusions(input, explanationSteps);
  const selectedFields = extractRequestedFields(input, explanationSteps);
  const insuranceStatus = extractInsuranceStatus(input, explanationSteps);
  const medicationExclusions = extractMedicationExclusions(input, explanationSteps);

  const concepts: ExtractedMedicalConcept[] = identifyMedicalConcepts(input).map(
    (match) => ({
      id: match.entry.id,
      term: match.sourceFragment,
      canonicalName: match.entry.name,
      codingSystem: match.entry.codingSystem,
      code: match.entry.code,
      category: match.entry.category,
      confidence: Number(match.confidence.toFixed(2)),
      sourceFragment: match.sourceFragment,
    })
  );

  // Extract required conditions from matched disease concepts
  const diseaseConcepts = concepts.filter((c) => c.category === "disease");
  const requiredConditions = diseaseConcepts.length > 1 
    ? diseaseConcepts.map((c) => c.code)
    : [];
  
  if (requiredConditions.length > 1) {
    explanationSteps.push(
      `Detected multiple required disease conditions: patient must have ALL of [${requiredConditions.join(", ")}].`
    );
  }
  
  // Add extracted values to filters
  if (directIcdCodes.length > 0) {
    filters.directIcdCodes = directIcdCodes;
  }
  if (labValues.size > 0) {
    filters.labValues = labValues;
  }
  if (exclusions.length > 0) {
    filters.exclusions = exclusions;
  }
  if (selectedFields.length > 0) {
    filters.selectedFields = selectedFields;
  }
  if (insuranceStatus.length > 0) {
    filters.insuranceStatus = insuranceStatus;
    explanationSteps.push(`Added insurance filter: ${insuranceStatus.join(", ")}.`);
  }
  if (medicationExclusions.length > 0) {
    filters.medicationExclusions = medicationExclusions;
    explanationSteps.push(`Added medication exclusions: NOT on ${medicationExclusions.join(", ")}.`);
  }
  if (requiredConditions.length > 0) {
    filters.requiredConditionCodes = requiredConditions;
  }

  if (concepts.length > 0) {
    explanationSteps.push(
      `Mapped ${concepts.length} medical concept${
        concepts.length > 1 ? "s" : ""
      } to standard codes: [${concepts.map((c) => `${c.code}(${c.category})`).join(", ")}].`
    );
  } else {
    explanationSteps.push(
      "No coded concept found in dictionary, generated SQL from demographic and temporal filters only."
    );
  }

  const aggregateConfidence =
    concepts.length > 0
      ? concepts.reduce((sum, c) => sum + c.confidence, 0) / concepts.length
      : 0.52;

  return {
    input,
    concepts,
    filters,
    explanationSteps,
    confidenceScore: Number(aggregateConfidence.toFixed(2)),
  };
}
