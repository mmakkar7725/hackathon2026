import { medicalDictionary } from "@/data/medicalDictionary";
import {
  normalizeAge,
  normalizeDateOfBirth,
  normalizeLocationLabel,
  normalizeStateAbbreviation,
  normalizeZipCode,
} from "@/services/demographics";
import { DemographicsRecord, MedicalHistoryRecord } from "@/types/intake";

// ============================================================================
// DOCUMENT TYPE DETECTION
// ============================================================================

type DocumentType = 'INTAKE_FORM' | 'HOSPITAL_DISCHARGE' | 'CLINICAL_NOTE' | 'UNSTRUCTURED';

/**
 * Detect document format to apply appropriate extraction strategy
 */
function detectDocumentType(text: string): DocumentType {
  const lower = text.toLowerCase();
  
  // Hospital discharge signature
  if (/discharge\s+summary|discharged\s+to|discharge\s+diagnosis/i.test(lower)) {
    return 'HOSPITAL_DISCHARGE';
  }
  
  // Hospital discharge indicators
  if (/patient name:|medical record number:|admission date:|discharge date:/i.test(lower)) {
    return 'HOSPITAL_DISCHARGE';
  }
  
  // Structured intake form signature
  if (/health\s+intake|intake\s+form|date of birth|gender\s*:/i.test(lower)) {
    return 'INTAKE_FORM';
  }
  
  // Clinical note structure
  if (/chief\s+complaint|assessment|plan\s*:|objective|subjective/i.test(lower)) {
    return 'CLINICAL_NOTE';
  }
  
  return 'UNSTRUCTURED';
}

// ============================================================================
// MULTI-STRATEGY EXTRACTION HELPERS
// ============================================================================

/**
 * Levenshtein distance fuzzy matcher for handling label variations
 * Used to match slightly misspelled or OCR-corrupted field labels
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(0));

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

/**
 * Common English words that should never be treated as field labels.
 * Prevents fuzzy matching confusing prepositions/pronouns with field names
 * (e.g. "with" is 2 edits from "city"; "her" is 2 edits from "sex").
 */
const COMMON_ENGLISH_WORDS = new Set([
  'the','and','for','not','but','her','his','she','he','it','its',
  'with','from','this','that','was','are','had','has','have','been',
  'were','who','what','when','where','why','how','all','any','one',
  'two','may','can','no','at','in','on','of','to','by','as','up',
  'an','or','if','so','do','be','is','we','our','him','my','me',
  'us','you','now','new','old','see','get','day','way','use','did',
  'let','put','set','got','end','try','ask','via','per','nor','yet',
  'too','also','both','same','such','more','most','just','only',
  'then','than','each','into','onto','upon','over','about',
]);

/**
 * Fuzzy match a label against known variations (e.g., "Zipo" → "Zip")
 * Returns the matched value if similarity > threshold
 */
function fuzzyMatchLabel(
  text: string,
  targetLabel: string,
  threshold: number = 2
): string | undefined {
  // Find all lines containing words close to targetLabel
  const lines = text.split("\n");
  for (const line of lines) {
    const words = line.split(/[\s:,#\-]+/);
    for (const word of words) {
      // Skip common English words — they are never field labels
      if (COMMON_ENGLISH_WORDS.has(word.toLowerCase())) {
        continue;
      }
      const distance = levenshteinDistance(word.toLowerCase(), targetLabel.toLowerCase());
      if (distance <= threshold && distance > 0) {
        // Found a fuzzy match, extract the value after this word
        const regex = new RegExp(`\\b${word}\\s*[:#-]?\\s*([^\\n\\r,;]+)`, "i");
        const match = text.match(regex);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
    }
  }
  return undefined;
}

// ============================================================================
// NARRATIVE EXTRACTION HELPERS (for hospital discharge & clinical notes)
// ============================================================================

/**
 * Extract demographics from narrative first line (e.g., "Mr. Doe is a 72 year old gentleman")
 * Common in hospital discharge summaries and clinical notes
 */
function extractDemographicsFromNarrative(text: string): {
  name?: string;
  age?: string;
  gender?: string;
} {
  // Strategy: Look for any line with Mr./Mrs./Ms./Miss/Dr. title and patient narrative
  // This works better than just taking the "first substantial line" because
  // discharge summaries have metadata lines (dates, record numbers) before the narrative
  
  const lines = text.split('\n').filter(l => l.trim());
  let narrativeLine = '';
  
  // Priority 1: Find line with title prefix that indicates a person narrative
  for (const line of lines) {
    const cleaned = line.trim();
    // Look for "Mr./Mrs./Ms./Miss/Dr. [Name] is a"
    if (/(?:Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s+[A-Z]\w+.*\b(?:is|was|are|were)\b/i.test(cleaned)) {
      narrativeLine = cleaned;
      break;
    }
  }
  
  // Priority 2: If no title line found, get first substantial line (fallback)
  if (!narrativeLine) {
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.length > 15 && !/^(patient|medical|record|date|admitted|discharged|history)/i.test(cleaned)) {
        narrativeLine = cleaned;
        break;
      }
    }
  }
  
  if (!narrativeLine) return {};
  
  const result: { name?: string; age?: string; gender?: string } = {};
  
  // Extract name: Look for "Mr./Mrs./Ms./Miss + name" 
  const nameMatch = narrativeLine.match(/(?:Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
  }
  
  // Extract age: Look for "XX year old" or "XX y/o" pattern
  // Use 1-3 digit constraint to avoid matching years like "2050"
  const ageMatch = narrativeLine.match(/\b(\d{1,3})\s+(?:year|y)\s*(?:old|o|\/o)\b/i);
  if (ageMatch) {
    result.age = ageMatch[1];
  }
  
  // Extract gender from contextual clues
  if (/\b(?:gentleman|man|male|he\s+|his\s+)\b/i.test(narrativeLine)) {
    result.gender = 'male';
  } else if (/\b(?:lady|woman|female|she\s+|her\s+)\b/i.test(narrativeLine)) {
    result.gender = 'female';
  }
  
  return result;
}

/**
 * Extract section content from clinical documents
 * Returns text between section headers (e.g., between "History:" and "Physical Exam:")
 */
function extractSection(text: string, sectionName: string, nextSectionPattern?: RegExp): string {
  const sectionRegex = new RegExp(`\\b${sectionName}\\s*[:\\-]\\s*([\\s\\S]*?)(?:${nextSectionPattern?.source || '(?:History|Physical|Exam|Assessment|Plan|Medications|Labs):'}|$)`, 'i');
  const match = text.match(sectionRegex);
  return match?.[1]?.trim() || '';
}

/**
 * Extract medical concerns from intake forms
 * e.g. "Describe your medical concerns: runny nose, mucus in throat, weakness, aches, chills, tired"
 */
function extractMedicalConcernsFromIntakeForm(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}): MedicalHistoryRecord[] {
  // Extract the medical concerns section
  const concernsSection = extractSection(input.text, 'medical concerns|chief complaint');
  
  if (!concernsSection) {
    return [];
  }

  // Split by commas, periods, or newlines and clean up
  const items = concernsSection
    .split(/[,;.\n]+/)
    .map(item => item.trim())
    .filter(item => item.length > 2 && item.length < 100);

  if (items.length === 0) {
    return [];
  }

  const records: MedicalHistoryRecord[] = [];

  for (const item of items) {
    const lower = item.toLowerCase();
    
    // Try to find a match in the medical dictionary
    const matches = medicalDictionary.filter(entry =>
      entry.synonyms.some(syn => lower.includes(syn.toLowerCase())) &&
      entry.category !== "lab_test"
    );

    if (matches.length > 0) {
      // Use the best match (first one with highest priority)
      const match = matches[0];
      records.push({
        id: `med-concern-${input.now}-${records.length}`,
        sourceFileName: input.sourceFileName,
        patientId: input.patientId,
        condition: match.name,
        codeSystem: match.codingSystem,
        code: match.code,
        note: `Symptom from intake form: "${item}"`,
        extractedAt: input.now,
      });
    } else {
      // If no dictionary match, still record it as a condition
      records.push({
        id: `med-concern-${input.now}-${records.length}`,
        sourceFileName: input.sourceFileName,
        patientId: input.patientId,
        condition: item.charAt(0).toUpperCase() + item.slice(1),
        codeSystem: "UNKNOWN",
        code: "N/A",
        note: `Symptom from intake form`,
        extractedAt: input.now,
      });
    }
  }

  return records;
}

/**
 * Check if text contains medical narrative (not a geographic location)
 * Used to filter out diagnoses being extracted as city/state
 */
function isMedicalNarrative(value: string): boolean {
  if (!value) return false;
  
  // Check for medical keywords
  const medicalKeywords = [
    'history of', 'diagnosed with', 'presented with', 'complained of',
    'symptoms of', 'treatment of', 'management of', 'therapy',
    'medication', 'drug', 'therapy', 'syndrome', 'disease',
    'condition', 'edema', 'hypertension', 'diabetes', 'chf',
    'ami', 'copd', 'pneumonia', 'infection', 'fever',
  ];
  
  const lower = value.toLowerCase();
  for (const keyword of medicalKeywords) {
    if (lower.includes(keyword)) {
      return true;
    }
  }
  
  // Check length - medical narrative tends to be longer
  if (value.length > 100) {
    return true;
  }
  
  return false;
}

/**
 * Check if text looks like a person name (e.g., "John Doe", "Mary Smith")
 * Used to prevent patient names from being extracted as demographic values
 */
function isPersonName(value: string): boolean {
  if (!value || value.length < 3 || value.length > 50) {
    return false;
  }
  
  // Check for pattern: Word Word... (e.g., "John Doe", "Mary Jane Smith")
  const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[A-Z]\.[A-Za-z\s\.]+)$/;
  if (namePattern.test(value.trim())) {
    return true;
  }
  
  // Check for titles: Mr., Mrs., Ms., Dr., etc.
  if (/^(Mr|Mrs|Ms|Miss|Dr)\.\s+/i.test(value)) {
    return true;
  }
  
  return false;
}

/**
 * Gemini fallback for extracting demographics when regex/fuzzy fails
 * Used for complex/ambiguous text that needs semantic understanding
 */
async function geminiExtractDemographicField(
  text: string,
  fieldName: string,
  description: string
): Promise<string | undefined> {
  try {
    const response = await fetch("/api/gemini-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        fieldName,
        description,
      }),
    });

    if (!response.ok) {
      console.warn(`Gemini extraction failed for ${fieldName}`);
      return undefined;
    }

    const data = await response.json();
    return data.value || undefined;
  } catch (error) {
    console.warn(`Gemini fallback error for ${fieldName}:`, error);
    return undefined;
  }
}

/**
 * Multi-strategy extraction: Regex → Fuzzy Match → Gemini Fallback
 */
async function extractWithFallback(
  text: string,
  regexPatterns: RegExp[],
  fuzzyLabel: string,
  fieldName: string,
  fieldDescription: string
): Promise<string | undefined> {
  // Strategy 1: Try exact regex patterns (fastest, free)
  const regexResult = findFirstMatch(text, regexPatterns);
  if (regexResult) {
    return regexResult;
  }

  // Strategy 2: Try fuzzy matching on labels (handles OCR/handwriting variations)
  const fuzzyResult = fuzzyMatchLabel(text, fuzzyLabel, 2);
  if (fuzzyResult) {
    return fuzzyResult;
  }

  // Strategy 3: Fall back to Gemini for semantic understanding (slowest, costs tokens)
  // Only use this if regex and fuzzy matching both fail
  const geminiResult = await geminiExtractDemographicField(
    text,
    fieldName,
    fieldDescription
  );
  if (geminiResult) {
    return geminiResult;
  }

  return undefined;
}

function normalizeClinicalText(raw: string) {
  return raw
    .replace(/<PARSED TEXT FOR PAGE:[^>]+>/gi, "")
    .replace(/\r/g, "\n")
    .replace(/\uFFFD/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findFirstMatch(input: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = input.match(expression);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractPatientName(text: string) {
  // Strategy 0: Try extracting from narrative first (hospital discharge format)
  // e.g. "Mr. Doe is a 72 year old gentleman"
  const narrative = extractDemographicsFromNarrative(text);
  if (narrative.name) {
    return narrative.name;
  }

  // Strategy 1: Try split first / last name fields — stop before dates/numbers
  const firstNameRaw = findFirstMatch(text, [
    /patient\s*first\s*name\s*[:#-]\s*([A-Za-z .'-]+?)(?=\s*(?:\d|\n|$|date:|dob:|mrn:|id:))/i,
    /first\s*name\s*[:#-]\s*([A-Za-z .'-]+?)(?=\s*(?:\d|\n|$|date:|dob:|mrn:|id:))/i,
  ])?.trim();
  const lastNameRaw = findFirstMatch(text, [
    /patient\s*last\s*name\s*[:#-]\s*([A-Za-z .'-]+?)(?=\s*(?:\d|\n|$|date:|dob:|mrn:|id:))/i,
    /last\s*name\s*[:#-]\s*([A-Za-z .'-]+?)(?=\s*(?:\d|\n|$|date:|dob:|mrn:|id:))/i,
    /surname\s*[:#-]\s*([A-Za-z .'-]+?)(?=\s*(?:\d|\n|$))/i,
  ])?.trim();

  if (firstNameRaw && lastNameRaw &&
      /^[A-Za-z][A-Za-z .'-]{0,30}$/.test(firstNameRaw) &&
      /^[A-Za-z][A-Za-z .'-]{0,30}$/.test(lastNameRaw)) {
    return `${firstNameRaw} ${lastNameRaw}`;
  }

  // Strategy 2: Try single combined name field — CRITICAL: stop before dates/numbers/labels
  // Two-column PDFs often have "Patient Name: Rogers, Pamela Date: 6/2/04" on one line.
  // Capture only the name part before the first digit or known label.
  const nameCandidates = [
    /^\s*patient\s*name\s*[:#-]\s*([A-Za-z ,.'"-]{2,50}?)(?=\s*(?:\d|date\s*:|dob\s*:|mrn\s*:|referral|data\s+source|$))/im,
    /^\s*name\s*[:#-]\s*([A-Za-z ,.'"-]{2,50}?)(?=\s*(?:\d|date\s*:|dob\s*:|mrn\s*:|$))/im,
    /^\s*patient\s*[:#-]\s*([A-Za-z ,.'"-]{2,50}?)(?=\s*(?:\d|date\s*:|dob\s*:|mrn\s*:|$))/im,
  ];

  for (const regex of nameCandidates) {
    const match = text.match(regex);
    const value = match?.[1]?.trim();
    if (!value || value.length < 3) continue;

    const looksLikeHeader = /clinical\s+record|confidential|follow-?up|diagnosis|comments/i.test(value);
    if (looksLikeHeader) continue;

    // Must look like a person name: only letters, spaces, commas, hyphens, periods
    if (/^[A-Za-z][A-Za-z ,.'"-]{1,49}$/.test(value)) {
      const normalized = value.replace(/\s+/g, " ").trim();
      // Handle "Last, First" comma format
      const commaFormat = normalized.match(/^([A-Za-z .'-]+),\s*([A-Za-z .'-]+)$/);
      if (commaFormat) {
        return `${commaFormat[2].trim()} ${commaFormat[1].trim()}`;
      }
      return normalized;
    }
  }

  // NOTE: Fuzzy matching intentionally removed from name extraction —
  // common English words like "some", "note", "none" are 2 edits from "name"
  // and cause capture of medical narrative text as the patient name.

  return undefined;
}

function normalizeGender(input?: string): DemographicsRecord["gender"] {
  if (!input) {
    return undefined;
  }

  const lower = input.toLowerCase();
  if (lower.startsWith("m")) {
    return "male";
  }
  if (lower.startsWith("f")) {
    return "female";
  }

  return "other";
}

function extractDiagnosisFromIcdLines(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}) {
  const entries: MedicalHistoryRecord[] = [];
  const regex =
    /(?:\d+\.\s*)?([A-Za-z0-9 ,()'\/-]+?)\s*\(ICD(?:-|\s*)10\s*:\s*([A-Z][0-9]{1,2}(?:\.[0-9A-Z]+)?)\)(?:[^\n]*?(?:Diagnosed|Onset)\s*([0-9]{4}-[0-9]{2}-[0-9]{2}))?/gi;

  let match: RegExpExecArray | null = regex.exec(input.text);
  let index = 0;

  while (match) {
    const condition = match[1]?.trim();
    const code = match[2]?.trim();
    const onsetDate = match[3]?.trim();

    if (condition && code) {
      entries.push({
        id: `med-icd-${input.now}-${index}`,
        sourceFileName: input.sourceFileName,
        patientId: input.patientId,
        condition,
        codeSystem: "ICD10",
        code,
        onsetDate,
        note: "Extracted from ICD-10 diagnosis line.",
        extractedAt: input.now,
      });
      index += 1;
    }

    match = regex.exec(input.text);
  }

  return entries;
}

function extractAge(text: string) {
  // Strategy 0: For narrative documents, try extracting from first line
  const narrative = extractDemographicsFromNarrative(text);
  if (narrative.age) {
    return narrative.age;
  }
  
  // Strategy 1: Try explicit label patterns
  const explicit = findFirstMatch(text, [
    /age\s*[:#-]?\s*(\d{1,3})/i,
    /\b(\d{1,3})\s*(?:y\/?o|yo|years?\s+old|year\s+old)\b/i,
  ]);

  if (explicit) {
    return explicit;
  }

  // Strategy 2: Try fuzzy matching for misspellings like "Agee", "Aeg", etc.
  const fuzzyResult = fuzzyMatchLabel(text, "age", 2);
  if (fuzzyResult && /^\d{1,3}$/.test(fuzzyResult)) {
    return fuzzyResult;
  }

  return undefined;
}

function extractDateOfBirth(text: string) {
  // Strategy 1: Try explicit label patterns
  const captured = findFirstMatch(text, [
    /dob\s*[:#-]?\s*([^\n\r,;]+)/i,
    /date of birth\s*[:#-]?\s*([^\n\r,;]+)/i,
    /birth\s*date\s*[:#-]?\s*([^\n\r,;]+)/i,
  ]);

  if (captured) {
    return normalizeDateOfBirth(captured);
  }

  // Strategy 2: Try fuzzy matching for variations like "DObb", "Birth Dat", etc.
  const fuzzyResult = fuzzyMatchLabel(text, "dob", 2);
  if (fuzzyResult) {
    return normalizeDateOfBirth(fuzzyResult);
  }

  const fuzzyBirthResult = fuzzyMatchLabel(text, "birth", 2);
  if (fuzzyBirthResult) {
    return normalizeDateOfBirth(fuzzyBirthResult);
  }

  return undefined;
}

function extractZipcode(text: string) {
  // Strategy 1: Try explicit regex patterns first
  const explicit = findFirstMatch(text, [
    /\bzip\s*[:#-]\s*(\d{5}(?:-\d{4})?)/i,
    /zip\s*code\s*[:#-]?\s*(\d{5}(?:-\d{4})?)/i,
    /zipcode\s*[:#-]?\s*(\d{5}(?:-\d{4})?)/i,
    /postal\s*code\s*[:#-]?\s*(\d{5}(?:-\d{4})?)/i,
  ]);

  if (explicit) {
    return normalizeZipCode(explicit);
  }

  // Strategy 2: Try fuzzy matching for variations like "Zipl", "Zipo", etc.
  const fuzzyResult = fuzzyMatchLabel(text, "zip", 2);
  if (fuzzyResult && /^\d{5}(?:-\d{4})?$/.test(fuzzyResult)) {
    return normalizeZipCode(fuzzyResult);
  }

  // Strategy 3: Try multi-line address: city on one line, state+zip on next
  const multiLine = text.match(/,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  if (multiLine) {
    return normalizeZipCode(multiLine[2]);
  }

  // Strategy 4: Try from full address line
  const fromAddress = text.match(/\b([A-Za-z][A-Za-z .'-]{1,80}),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  return normalizeZipCode(fromAddress?.[3]);
}

function extractCityState(text: string) {
  // Strategy 1: Try explicit labeled fields with word boundaries
  let city = normalizeLocationLabel(
    findFirstMatch(text, [
      /^city\s*[:#-]\s*([^\n\r]+)/im,
      /\bcity\s*[:#-]\s*([^\n\r]+)/i,
    ])
  );

  // Validate: reject if it looks like medical narrative or person name
  if (city && (isMedicalNarrative(city) || isPersonName(city))) {
    city = undefined;
  }

  const stateRaw = findFirstMatch(text, [
    /^state\s*[:#-]\s*([^\n\r]+)/im,
    /\bstate\s+of\s+(?:residence\s*[:#-]?\s*)?([A-Za-z]{2,30})/i,
  ]);
  const state = normalizeStateAbbreviation(stateRaw);

  if (city || state) {
    return { city, state };
  }

  // Strategy 2: Try fuzzy matching for label variations (e.g., "Citi" → "City")
  let fuzzyCity = normalizeLocationLabel(fuzzyMatchLabel(text, "city", 2));
  
  // Validate fuzzy city: reject if medical narrative or person name
  if (fuzzyCity && (isMedicalNarrative(fuzzyCity) || isPersonName(fuzzyCity))) {
    fuzzyCity = undefined;
  }
  
  const fuzzyState = normalizeStateAbbreviation(fuzzyMatchLabel(text, "state", 2));

  if (fuzzyCity || fuzzyState) {
    return { city: fuzzyCity, state: fuzzyState };
  }

  // Strategy 3: Full single-line address: "1415 River Road, Las Vegas, NV 89105"
  const singleLine = text.match(
    /\b([A-Za-z][A-Za-z .'-]{1,80}),\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/
  );
  if (singleLine) {
    const extractedCity = normalizeLocationLabel(singleLine[1]);
    if (extractedCity && !isMedicalNarrative(extractedCity) && !isPersonName(extractedCity)) {
      return {
        city: extractedCity,
        state: normalizeStateAbbreviation(singleLine[2]),
      };
    }
  }

  // Strategy 4: Multi-line address: city on one line, "ST  ZIPCODE" on the next
  const multiLine = text.match(
    /([A-Za-z][A-Za-z .'-]{1,40}),?\s*\n\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/
  );
  if (multiLine) {
    const extractedCity = normalizeLocationLabel(multiLine[1]);
    if (extractedCity && !isMedicalNarrative(extractedCity) && !isPersonName(extractedCity)) {
      return {
        city: extractedCity,
        state: normalizeStateAbbreviation(multiLine[2]),
      };
    }
  }

  // Strategy 5: State abbreviation directly after "Home Address:" or "Address:" label
  const addressLabel = text.match(
    /(?:home\s+)?address\s*[:#-][^\n]*,\s*([A-Za-z]{2})\s+\d{5}/i
  );
  if (addressLabel) {
    return {
      city: undefined,
      state: normalizeStateAbbreviation(addressLabel[1]),
    };
  }

  return { city: undefined, state: undefined };
}

function extractEthnicity(text: string) {
  // Strategy 1: Try explicit patterns
  let explicit = normalizeLocationLabel(
    findFirstMatch(text, [
      /ethnicity\s*[:#-]?\s*([^\n\r]+)/i,
      /ethnic\s*group\s*[:#-]?\s*([^\n\r]+)/i,
    ])
  );

  // Validate: reject if it looks like a date, person name, or medical narrative
  if (explicit && (isDateLike(explicit) || isPersonName(explicit) || isMedicalNarrative(explicit))) {
    explicit = undefined;
  }

  if (explicit && explicit.length >= 3) {
    return explicit;
  }

  // Strategy 2: Try fuzzy matching for variations
  const fuzzyResult = normalizeLocationLabel(fuzzyMatchLabel(text, "ethnicity", 3));
  
  // Validate fuzzy result too
  if (fuzzyResult && !isDateLike(fuzzyResult) && !isPersonName(fuzzyResult) && !isMedicalNarrative(fuzzyResult) && fuzzyResult.length >= 3) {
    return fuzzyResult;
  }

  return undefined;
}

function extractRace(text: string) {
  // Strategy 1: Try explicit patterns
  let explicit = normalizeLocationLabel(
    findFirstMatch(text, [
      /race\s*[:#-]?\s*([^\n\r]+)/i,
      /racial\s*group\s*[:#-]?\s*([^\n\r]+)/i,
    ])
  );

  // Validate: reject if it looks like a date, person name, or medical narrative
  if (explicit && (isDateLike(explicit) || isPersonName(explicit) || isMedicalNarrative(explicit))) {
    explicit = undefined;
  }

  if (explicit && explicit.length >= 3) {
    return explicit;
  }

  // Strategy 2: Try fuzzy matching for variations like "Raace", "Rac", etc.
  const fuzzyResult = normalizeLocationLabel(fuzzyMatchLabel(text, "race", 2));
  
  // Validate fuzzy result too
  if (fuzzyResult && !isDateLike(fuzzyResult) && !isPersonName(fuzzyResult) && !isMedicalNarrative(fuzzyResult) && fuzzyResult.length >= 3) {
    return fuzzyResult;
  }

  return undefined;
}

/**
 * Check if a string looks like a date (e.g., "9/14/19", "2023-07-15")
 * Used to filter out dates that were incorrectly extracted as demographic values
 */
function isDateLike(value: string): boolean {
  if (!value) return false;
  
  // Pattern 1: M/D/YY or MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) {
    return true;
  }
  
  // Pattern 2: YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return true;
  }
  
  // Pattern 3: Month name + day + year (e.g., "January 15, 2023")
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i.test(value)) {
    return true;
  }
  
  return false;
}

function extractGenderRaw(text: string) {
  // Strategy 0: For narrative documents, try contextual clues
  const narrative = extractDemographicsFromNarrative(text);
  if (narrative.gender) {
    return narrative.gender;
  }
  
  // Strategy 1: Title-based extraction (Mr., Mrs., Ms., Miss, etc.)
  // Note: use lookahead instead of trailing \b because period is non-word char
  const titleMatch = text.match(/\b(Mr\.|Mrs\.|Ms\.|Miss)(?=\s)/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (title === 'mr.') {
      return 'male';
    }
    if (title === 'mrs.' || title === 'ms.' || title === 'miss') {
      return 'female';
    }
  }

  // Strategy 2: Try explicit patterns
  const explicit = findFirstMatch(text, [
    /gender\s*[:#-]?\s*([A-Za-z]+)/i,
    /sex\s*[:#-]?\s*([A-Za-z]+)/i,
  ]);

  if (explicit) {
    return explicit;
  }

  // Strategy 3: Try fuzzy matching — validate result is actually a gender value
  const validGenderValues = /^(male|female|man|woman|m|f)$/i;
  const fuzzyGender = fuzzyMatchLabel(text, "gender", 2);
  if (fuzzyGender && validGenderValues.test(fuzzyGender.trim())) {
    return fuzzyGender;
  }

  const fuzzySex = fuzzyMatchLabel(text, "sex", 2);
  if (fuzzySex && validGenderValues.test(fuzzySex.trim())) {
    return fuzzySex;
  }

  // Strategy 4: Try shorthand format (M/F indicator, e.g. "56 y/o WF")
  const shorthand = text.match(/\b\d{1,3}\s*(?:y\/?o|yo|years?\s+old)\s*([WBAH]?[MF])\b/i);
  if (shorthand?.[1]) {
    const value = shorthand[1].toUpperCase();
    if (value.endsWith("M")) {
      return "male";
    }
    if (value.endsWith("F")) {
      return "female";
    }
  }

  // Strategy 5: Pronoun scan — look for gendered pronouns in the whole text
  const femalePronouns = /\b(?:she|her|hers|woman|female|lady|girl)\b/i;
  const malePronouns = /\b(?:he\b|his\b|him\b|man\b|male\b|gentleman\b|boy\b)/i;
  const femaleCount = (text.match(new RegExp(femalePronouns.source, 'gi')) ?? []).length;
  const maleCount = (text.match(new RegExp(malePronouns.source, 'gi')) ?? []).length;
  if (femaleCount > 0 && femaleCount >= maleCount * 2) {
    return 'female';
  }
  if (maleCount > 0 && maleCount >= femaleCount * 2) {
    return 'male';
  }

  return undefined;
}

function extractProblemListConditions(text: string) {
  const conditions: string[] = [];
  const sections = [
    /(?:Initial Problem List|Revised Problem List)([\s\S]*?)(?:Assessment and Differential Diagnosis|Plan:|$)/gi,
    /Assessment and Differential Diagnosis([\s\S]*?)(?:Plan:|$)/gi,
  ];

  // Generic/instructional text to filter out
  const genericPatterns = [
    /^(general|clinical|history|entry|problem|list|comment|note|section|header|title)$/i,
    /^(this|that|these|those|which|what|where|when|why|how)$/i,
    /^(a|an|the|is|are|or|and|but|not)$/i,
  ];

  for (const sectionRegex of sections) {
    let sectionMatch = sectionRegex.exec(text);
    while (sectionMatch) {
      const sectionBody = sectionMatch[1] ?? "";
      const itemRegex = /^\s*\d+\.\s+([^\n\r]{3,120})/gm;
      let itemMatch = itemRegex.exec(sectionBody);

      while (itemMatch) {
        const raw = itemMatch[1].trim();
        const cleaned = raw
          .replace(/\s{2,}/g, " ")
          .replace(/\.$/, "")
          .trim();

        // Skip instructions and headers
        const isInstruction = /^(this list|in the assessment|you should|although|always|comment|follow this pattern)/i.test(cleaned);
        
        // Skip generic/metadata text
        let isGeneric = false;
        if (cleaned.split(/\s+/).length === 1) {
          // Single word - check against generic patterns
          for (const pattern of genericPatterns) {
            if (pattern.test(cleaned)) {
              isGeneric = true;
              break;
            }
          }
        }
        
        // Skip if it looks like metadata (e.g., "General clinical history entry")
        if (/^(general\s+clinical|clinical\s+history|history\s+entry|problem\s+list|revised\s+problem)/i.test(cleaned)) {
          isGeneric = true;
        }

        if (!isInstruction && !isGeneric && cleaned.length >= 3) {
          conditions.push(cleaned);
        }

        itemMatch = itemRegex.exec(sectionBody);
      }

      sectionMatch = sectionRegex.exec(text);
    }
  }

  return Array.from(new Set(conditions.map((item) => item.toLowerCase()))).map((normalized) => {
    const match = conditions.find((entry) => entry.toLowerCase() === normalized);
    return match ?? normalized;
  });
}

function extractComorbidities(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}) {
  const entries: MedicalHistoryRecord[] = [];
  const comorbiditiesMatch = input.text.match(
    /(?:comorbidities|co-morbidities|comorbid\s+conditions)\s*[:#-]?\s*([^\n\r]+)/i
  );
  if (!comorbiditiesMatch?.[1]) return entries;

  const items = comorbiditiesMatch[1]
    .split(/,/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && !/^(none|n\/a|nil)$/i.test(s));

  items.forEach((condition, idx) => {
    entries.push({
      id: `med-comorbid-${input.now}-${idx}`,
      sourceFileName: input.sourceFileName,
      patientId: input.patientId,
      condition,
      codeSystem: "UNKNOWN",
      code: "N/A",
      note: "Extracted from Comorbidities field.",
      extractedAt: input.now,
    });
  });
  return entries;
}

function extractDiagnosedWithConditions(input: {
  text: string;
  sourceFileName: string;
  patientId: string;
  now: number;
}) {
  const entries: MedicalHistoryRecord[] = [];
  // Stop capture before: digits ("3 years"), conjunctions ("and", "who"), temporal words ("ago")
  const regex = /diagnosed\s+with\s+([a-z][a-z\s\-/]{2,50}?)(?=\s*\d|\s+(?:ago|and|who|which|recently|began|started|controlled|resolved|managed|stopped)\b|\.|,|;|\n|$)/gi;

  let match: RegExpExecArray | null = regex.exec(input.text);
  let index = 0;

  while (match) {
    const raw = match[1]?.trim();
    if (raw) {
      const condition = raw
        .replace(/\s+/g, " ")
        .replace(/\bthe\b/gi, "")
        .trim();

      if (condition.length >= 3) {
        entries.push({
          id: `med-dx-${input.now}-${index}`,
          sourceFileName: input.sourceFileName,
          patientId: input.patientId,
          condition,
          codeSystem: "UNKNOWN",
          code: "N/A",
          note: "Extracted from narrative diagnosis statement.",
          extractedAt: input.now,
        });
        index += 1;
      }
    }

    match = regex.exec(input.text);
  }

  return entries;
}

export function parseTextToRecords(input: {
  text: string;
  sourceFileName: string;
}) {
  const text = normalizeClinicalText(input.text);
  const lower = text.toLowerCase();
  const now = Date.now();

  const patientId =
    findFirstMatch(text, [/patient\s*id\s*[:#-]?\s*([A-Za-z0-9-]+)/i, /mrn\s*[:#-]?\s*([A-Za-z0-9-]+)/i]) ??
    `PT-${now}`;

  const fullName = extractPatientName(text) ?? "Unknown Patient";

  const ageRaw = extractAge(text);
  const genderRaw = extractGenderRaw(text);
  const dob = extractDateOfBirth(text);
  const zipcode = extractZipcode(text);
  const { city, state } = extractCityState(text);
  const ethnicity = extractEthnicity(text);
  const race = extractRace(text);
  const age = normalizeAge(ageRaw ? Number(ageRaw) : undefined, dob, now);

  const demographics: DemographicsRecord[] = [
    {
      id: `demo-${now}`,
      sourceFileName: input.sourceFileName,
      patientId,
      fullName,
      age,
      gender: normalizeGender(genderRaw),
      dateOfBirth: dob,
      city,
      state,
      zipcode,
      ethnicity,
      race,
      extractedAt: now,
    },
  ];

  const icdFromText = extractDiagnosisFromIcdLines({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  const comorbiditiesMatches = extractComorbidities({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  const dictionaryMatches: MedicalHistoryRecord[] = medicalDictionary
    .filter((entry) => entry.synonyms.some((synonym) => lower.includes(synonym)))
    .filter((entry) => entry.category !== "lab_test")
    .map((entry, index) => ({
      id: `med-dict-${now}-${index}`,
      sourceFileName: input.sourceFileName,
      patientId,
      condition: entry.name,
      codeSystem: entry.codingSystem,
      code: entry.code,
      note: "Detected via fallback text parser.",
      extractedAt: now,
    }));

  const problemListMatches: MedicalHistoryRecord[] = extractProblemListConditions(text).map((condition, index) => ({
    id: `med-problem-${now}-${index}`,
    sourceFileName: input.sourceFileName,
    patientId,
    condition,
    codeSystem: "UNKNOWN",
    code: "N/A",
    note: "Extracted from problem list/assessment section.",
    extractedAt: now,
  }));

  const narrativeDiagnoses = extractDiagnosedWithConditions({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  // Extract medical concerns from intake forms
  const intakeFormConcerns = extractMedicalConcernsFromIntakeForm({
    text,
    sourceFileName: input.sourceFileName,
    patientId,
    now,
  });

  const uniqueByCode = new Map<string, MedicalHistoryRecord>();
  for (const record of [...icdFromText, ...comorbiditiesMatches, ...dictionaryMatches, ...problemListMatches, ...narrativeDiagnoses, ...intakeFormConcerns]) {
    const key =
      record.codeSystem === "UNKNOWN" && record.code === "N/A"
        ? `${record.codeSystem}:${record.code}:${record.condition.toLowerCase()}`
        : `${record.codeSystem}:${record.code}`;
    if (!uniqueByCode.has(key)) {
      uniqueByCode.set(key, record);
    }
  }

  const medicalHistory = Array.from(uniqueByCode.values());

  return {
    demographics,
    medicalHistory,
  };
}
