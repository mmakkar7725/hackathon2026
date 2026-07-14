import { readTables } from "@/services/localTables";
import { QueryResult } from "@/types/medical";

interface Step1QueryRow {
  patientId: string;
  fullName: string;
  age?: number;
  gender?: string;
  ethnicity?: string;
  race?: string;
  dateOfBirth?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  matchedConditions: string[];
  matchedCodes: string[];
  latestUploadAt?: number;
}

interface Step1NearMissPatient {
  patientId: string;
  fullName: string;
  age?: number;
  gender?: string;
  ethnicity?: string;
  race?: string;
  dateOfBirth?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  chanceToJoinPercent: number;
  missingCriteria: string[];
  matchedConditions: string[];
}

interface Step1RelaxationStat {
  droppedFilter: string;
  matchedPatients: number;
  additionalPatients: number;
}

interface Step1QueryRunResult {
  rows: Step1QueryRow[];
  nearMisses: Step1NearMissPatient[];
  relaxationStats: Step1RelaxationStat[];
  totalPatients: number;
  totalCandidates: number;
  scannedDemographics: number;
  scannedHistoryRows: number;
}

function normalize(input: string) {
  return input.toLowerCase().trim();
}

function normalizeZip(input?: string) {
  if (!input) {
    return undefined;
  }

  const match = input.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1];
}

// Zip radius fallback for local-only execution when geospatial ZIP centroids are unavailable.
function estimateZipDistanceMiles(fromZip?: string, toZip?: string) {
  const from = normalizeZip(fromZip);
  const to = normalizeZip(toZip);

  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  if (from === to) {
    return 0;
  }

  if (from.slice(0, 3) === to.slice(0, 3)) {
    return 25;
  }

  if (from.slice(0, 2) === to.slice(0, 2)) {
    return 80;
  }

  return Number.POSITIVE_INFINITY;
}

function daysFromYears(years: number) {
  return years * 365;
}

function daysFromMonths(months: number) {
  return months * 30;
}

function isWithinRange(input: {
  onsetDate?: string;
  diagnosedWithinYears?: number;
  diagnosedWithinMonths?: number;
}) {
  if (!input.diagnosedWithinYears && !input.diagnosedWithinMonths) {
    return true;
  }

  if (!input.onsetDate) {
    return false;
  }

  const onsetTimestamp = Date.parse(input.onsetDate);
  if (Number.isNaN(onsetTimestamp)) {
    return false;
  }

  const diffDays = (Date.now() - onsetTimestamp) / (1000 * 60 * 60 * 24);

  if (input.diagnosedWithinYears && diffDays > daysFromYears(input.diagnosedWithinYears)) {
    return false;
  }

  if (input.diagnosedWithinMonths && diffDays > daysFromMonths(input.diagnosedWithinMonths)) {
    return false;
  }

  return true;
}

function buildHistoryMatcher(input: {
  diseaseCodes: string[];
  symptomCodes: string[];
  conceptTerms: string[];
}) {
  const { diseaseCodes, symptomCodes, conceptTerms } = input;

  return (condition: string, code: string) => {
    if (diseaseCodes.length > 0 || symptomCodes.length > 0) {
      const acceptedCodes = [...diseaseCodes, ...symptomCodes];
      return acceptedCodes.includes(code);
    }

    if (conceptTerms.length > 0) {
      const normalizedCondition = normalize(condition);
      return conceptTerms.some((term) => normalizedCondition.includes(term));
    }

    return true;
  };
}

export function runQueryAgainstStep1Data(query: QueryResult): Step1QueryRunResult {
  const { demographics, medicalHistory } = readTables();

  const diseaseCodes = query.concepts
    .filter((concept) => concept.category === "disease")
    .map((concept) => concept.code);

  const symptomCodes = query.concepts
    .filter((concept) => concept.category === "symptom")
    .map((concept) => concept.code);

  const conceptTerms = query.concepts.map((concept) => normalize(concept.canonicalName));
  const hasTimeFilter =
    query.filters.diagnosedWithinYears !== undefined ||
    query.filters.diagnosedWithinMonths !== undefined;
  const hasConceptFilter = diseaseCodes.length > 0 || symptomCodes.length > 0 || conceptTerms.length > 0;

  const activeChecks: Array<{ key: string; label: string }> = [];
  if (query.filters.ageMin !== undefined) {
    activeChecks.push({ key: "ageMin", label: `Age > ${query.filters.ageMin}` });
  }
  if (query.filters.ageMax !== undefined) {
    activeChecks.push({ key: "ageMax", label: `Age < ${query.filters.ageMax}` });
  }
  if (query.filters.gender !== undefined) {
    activeChecks.push({ key: "gender", label: `Gender = ${query.filters.gender}` });
  }
  if (query.filters.ethnicity !== undefined) {
    activeChecks.push({ key: "ethnicity", label: `Ethnicity = ${query.filters.ethnicity}` });
  }
  if (query.filters.race !== undefined) {
    activeChecks.push({ key: "race", label: `Race = ${query.filters.race}` });
  }
  if (query.filters.city !== undefined) {
    activeChecks.push({ key: "city", label: `City = ${query.filters.city}` });
  }
  if (query.filters.state !== undefined) {
    activeChecks.push({ key: "state", label: `State = ${query.filters.state}` });
  }
  if (query.filters.zipcode !== undefined && query.filters.zipcodeRadiusMiles === undefined) {
    activeChecks.push({ key: "zipcode", label: `ZIP = ${query.filters.zipcode}` });
  }
  if (query.filters.zipcode !== undefined && query.filters.zipcodeRadiusMiles !== undefined) {
    activeChecks.push({
      key: "zipcodeRadius",
      label: `Within ${query.filters.zipcodeRadiusMiles} miles of ZIP ${query.filters.zipcode}`,
    });
  }
  if (hasTimeFilter) {
    const timeLabel =
      query.filters.diagnosedWithinYears !== undefined
        ? `Diagnosed within ${query.filters.diagnosedWithinYears} year(s)`
        : `Diagnosed within ${query.filters.diagnosedWithinMonths} month(s)`;
    activeChecks.push({ key: "time", label: timeLabel });
  }
  if (hasConceptFilter) {
    activeChecks.push({ key: "concept", label: "Condition/code concept match" });
  }

  const historyByPatient = new Map<string, typeof medicalHistory>();
  for (const row of medicalHistory) {
    const key = row.patientId || "UNKNOWN";
    const bucket = historyByPatient.get(key) ?? [];
    bucket.push(row);
    historyByPatient.set(key, bucket);
  }

  const rows: Step1QueryRow[] = [];
  const nearMisses: Step1NearMissPatient[] = [];
  const patientCheckMap: Array<{ patientId: string; checks: Record<string, boolean> }> = [];

  const historyMatcher = buildHistoryMatcher({ diseaseCodes, symptomCodes, conceptTerms });

  for (const patient of demographics) {
    const patientHistory = historyByPatient.get(patient.patientId) ?? [];

    const timeFilteredHistory = patientHistory.filter((row) =>
      isWithinRange({
        onsetDate: row.onsetDate,
        diagnosedWithinYears: query.filters.diagnosedWithinYears,
        diagnosedWithinMonths: query.filters.diagnosedWithinMonths,
      })
    );

    const conceptFilteredHistory = patientHistory.filter((row) => historyMatcher(row.condition, row.code));
    const filteredHistory = timeFilteredHistory.filter((row) => historyMatcher(row.condition, row.code));

    const checks: Record<string, boolean> = {
      ageMin:
        query.filters.ageMin === undefined ||
        (patient.age !== undefined && patient.age > query.filters.ageMin),
      ageMax:
        query.filters.ageMax === undefined ||
        (patient.age !== undefined && patient.age < query.filters.ageMax),
      gender:
        query.filters.gender === undefined ||
        (patient.gender !== undefined && normalize(patient.gender) === query.filters.gender),
      ethnicity:
        query.filters.ethnicity === undefined ||
        (patient.ethnicity !== undefined &&
          normalize(patient.ethnicity).includes(normalize(query.filters.ethnicity))),
      race:
        query.filters.race === undefined ||
        (patient.race !== undefined && normalize(patient.race).includes(normalize(query.filters.race))),
      city:
        query.filters.city === undefined ||
        (patient.city !== undefined && normalize(patient.city) === normalize(query.filters.city)),
      state:
        query.filters.state === undefined ||
        (patient.state !== undefined && normalize(patient.state) === normalize(query.filters.state)),
      zipcode:
        query.filters.zipcode === undefined ||
        normalizeZip(patient.zipcode) === normalizeZip(query.filters.zipcode),
      zipcodeRadius:
        query.filters.zipcode === undefined || query.filters.zipcodeRadiusMiles === undefined
          ? true
          : estimateZipDistanceMiles(patient.zipcode, query.filters.zipcode) <= query.filters.zipcodeRadiusMiles,
      time: !hasTimeFilter || timeFilteredHistory.length > 0,
      concept: !hasConceptFilter || conceptFilteredHistory.length > 0,
    };

    patientCheckMap.push({ patientId: patient.patientId, checks });

    const allChecksPassed = activeChecks.every((item) => checks[item.key] !== false);

    const latestUploadAt = [patient.extractedAt, ...filteredHistory.map((row) => row.extractedAt)]
      .filter((value) => typeof value === "number")
      .sort((a, b) => b - a)[0];

    if (!allChecksPassed) {
      const missingCriteria = activeChecks
        .filter((item) => checks[item.key] === false)
        .map((item) => item.label);
      const passedCount = activeChecks.filter((item) => checks[item.key] !== false).length;
      const chanceToJoinPercent =
        activeChecks.length > 0
          ? Math.max(0, Math.min(100, Math.round((passedCount / activeChecks.length) * 100)))
          : 0;

      nearMisses.push({
        patientId: patient.patientId,
        fullName: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        ethnicity: patient.ethnicity,
        race: patient.race,
        dateOfBirth: patient.dateOfBirth,
        city: patient.city,
        state: patient.state,
        zipcode: patient.zipcode,
        chanceToJoinPercent,
        missingCriteria,
        matchedConditions: Array.from(
          new Set(
            [...timeFilteredHistory, ...conceptFilteredHistory].map((row) => row.condition)
          )
        ).slice(0, 5),
      });

      continue;
    }

    if (hasConceptFilter && filteredHistory.length === 0) {
      continue;
    }

    rows.push({
      patientId: patient.patientId,
      fullName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      ethnicity: patient.ethnicity,
      race: patient.race,
      dateOfBirth: patient.dateOfBirth,
      city: patient.city,
      state: patient.state,
      zipcode: patient.zipcode,
      matchedConditions: Array.from(new Set(filteredHistory.map((row) => row.condition))),
      matchedCodes: Array.from(new Set(filteredHistory.map((row) => `${row.codeSystem}:${row.code}`))),
      latestUploadAt,
    });
  }

  const relaxationStats: Step1RelaxationStat[] = activeChecks.map((activeCheck) => {
    const matchedIfDropped = patientCheckMap.filter((entry) =>
      activeChecks
        .filter((check) => check.key !== activeCheck.key)
        .every((check) => entry.checks[check.key] !== false)
    ).length;

    return {
      droppedFilter: activeCheck.label,
      matchedPatients: matchedIfDropped,
      additionalPatients: Math.max(0, matchedIfDropped - rows.length),
    };
  });

  return {
    rows,
    nearMisses: nearMisses.sort((a, b) => b.chanceToJoinPercent - a.chanceToJoinPercent).slice(0, 10),
    relaxationStats: relaxationStats.sort((a, b) => b.additionalPatients - a.additionalPatients),
    totalPatients: rows.length,
    totalCandidates: demographics.length,
    scannedDemographics: demographics.length,
    scannedHistoryRows: medicalHistory.length,
  };
}

export type { Step1QueryRow, Step1NearMissPatient, Step1RelaxationStat, Step1QueryRunResult };
