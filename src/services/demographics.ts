function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isValidDateParts(year: number, month: number, day: number) {
  if (year < 1900 || year > 2100) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function normalizeDateOfBirth(input?: string) {
  if (!input) {
    return undefined;
  }

  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  const isoLike = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoLike) {
    const year = Number(isoLike[1]);
    const month = Number(isoLike[2]);
    const day = Number(isoLike[3]);
    if (isValidDateParts(year, month, day)) {
      return toIsoDate(year, month, day);
    }
  }

  const slashLike = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashLike) {
    let year = Number(slashLike[3]);
    const first = Number(slashLike[1]);
    const second = Number(slashLike[2]);

    if (year < 100) {
      year += year > 30 ? 1900 : 2000;
    }

    // Default to MM/DD/YYYY, but switch to DD/MM/YYYY when month would be invalid.
    let month = first;
    let day = second;
    if (month > 12 && second <= 12) {
      month = second;
      day = first;
    }

    if (isValidDateParts(year, month, day)) {
      return toIsoDate(year, month, day);
    }
  }

  return undefined;
}

export function deriveAgeFromDateOfBirth(dob?: string, referenceTimestamp = Date.now()) {
  if (!dob) {
    return undefined;
  }

  const normalizedDob = normalizeDateOfBirth(dob);
  if (!normalizedDob) {
    return undefined;
  }

  const birthDate = new Date(`${normalizedDob}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) {
    return undefined;
  }

  const reference = new Date(referenceTimestamp);
  if (Number.isNaN(reference.getTime())) {
    return undefined;
  }

  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = reference.getUTCMonth() - birthDate.getUTCMonth();
  const dayDelta = reference.getUTCDate() - birthDate.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  if (age < 0 || age > 130) {
    return undefined;
  }

  return age;
}

export function normalizeAge(input: number | string | undefined, dob?: string, referenceTimestamp = Date.now()) {
  if (typeof input === "number" && Number.isFinite(input)) {
    const rounded = Math.trunc(input);
    if (rounded >= 0 && rounded <= 130) {
      return rounded;
    }
  }

  if (typeof input === "string") {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) {
      const rounded = Math.trunc(parsed);
      if (rounded >= 0 && rounded <= 130) {
        return rounded;
      }
    }
  }

  return deriveAgeFromDateOfBirth(dob, referenceTimestamp);
}

export function normalizeZipCode(input?: string) {
  if (!input) {
    return undefined;
  }

  const cleaned = input.trim().replace(/[^0-9-]/g, "");
  const zip5 = cleaned.match(/^(\d{5})(?:-?\d{4})?$/);
  if (zip5) {
    return zip5[0].includes("-") ? zip5[0] : zip5[1];
  }

  return undefined;
}

export function normalizeLocationLabel(input?: string) {
  if (!input) {
    return undefined;
  }

  const cleaned = input.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

const VALID_STATE_ABBREVIATIONS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",
  colorado:"CO",connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",
  hawaii:"HI",idaho:"ID",illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",
  kentucky:"KY",louisiana:"LA",maine:"ME",maryland:"MD",massachusetts:"MA",
  michigan:"MI",minnesota:"MN",mississippi:"MS",missouri:"MO",montana:"MT",
  nebraska:"NE",nevada:"NV","new hampshire":"NH","new jersey":"NJ",
  "new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND",
  ohio:"OH",oklahoma:"OK",oregon:"OR",pennsylvania:"PA","rhode island":"RI",
  "south carolina":"SC","south dakota":"SD",tennessee:"TN",texas:"TX",
  utah:"UT",vermont:"VT",virginia:"VA",washington:"WA","west virginia":"WV",
  wisconsin:"WI",wyoming:"WY","district of columbia":"DC",
};

/**
 * Normalizes and validates a state value.
 * Strips trailing zip codes, handles full names, and rejects invalid values.
 */
export function normalizeStateAbbreviation(input?: string): string | undefined {
  if (!input) return undefined;

  // Strip leading/trailing whitespace and common noise (zip codes, extra text)
  const cleaned = input.trim()
    .replace(/\d{5}(?:-\d{4})?.*$/, "")  // strip trailing zip and anything after
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;

  // Check if it's already a valid 2-letter abbreviation
  const upper = cleaned.toUpperCase();
  if (upper.length === 2 && VALID_STATE_ABBREVIATIONS.has(upper)) {
    return upper;
  }

  // Try matching full state name
  const lower = cleaned.toLowerCase();
  if (STATE_NAME_TO_ABBREV[lower]) {
    return STATE_NAME_TO_ABBREV[lower];
  }

  // Try partial match for names like "New York" that might have trailing noise
  for (const [name, abbrev] of Object.entries(STATE_NAME_TO_ABBREV)) {
    if (lower.startsWith(name)) {
      return abbrev;
    }
  }

  return undefined;
}
