"use client";

import { DemographicsRecord, MedicalHistoryRecord } from "@/types/intake";

const DEMOGRAPHICS_KEY = "medquery-demographics-table-v1";
const MEDICAL_HISTORY_KEY = "medquery-medical-history-table-v1";

function normalizeKeyPart(input?: string | number) {
  if (input === undefined || input === null) {
    return "";
  }

  return String(input).trim().toLowerCase();
}

function demographicsDedupKey(row: DemographicsRecord) {
  return [
    normalizeKeyPart(row.sourceFileName),
    normalizeKeyPart(row.fullName),
    normalizeKeyPart(row.dateOfBirth),
    normalizeKeyPart(row.gender),
    normalizeKeyPart(row.city),
    normalizeKeyPart(row.state),
    normalizeKeyPart(row.zipcode),
    normalizeKeyPart(row.ethnicity),
    normalizeKeyPart(row.race),
  ].join("|");
}

function medicalHistoryDedupKey(row: MedicalHistoryRecord) {
  return [
    normalizeKeyPart(row.sourceFileName),
    normalizeKeyPart(row.condition),
    normalizeKeyPart(row.codeSystem),
    normalizeKeyPart(row.code),
    normalizeKeyPart(row.onsetDate),
  ].join("|");
}

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export function appendToTables(payload: {
  demographics: DemographicsRecord[];
  medicalHistory: MedicalHistoryRecord[];
}) {
  const demographicsTable = readJsonArray<DemographicsRecord>(DEMOGRAPHICS_KEY);
  const medicalHistoryTable = readJsonArray<MedicalHistoryRecord>(MEDICAL_HISTORY_KEY);

  const existingDemographicsKeys = new Set(
    demographicsTable.map((row) => demographicsDedupKey(row))
  );
  const existingMedicalKeys = new Set(
    medicalHistoryTable.map((row) => medicalHistoryDedupKey(row))
  );

  const acceptedDemographics: DemographicsRecord[] = [];
  let rejectedDemographics = 0;
  for (const row of payload.demographics) {
    const key = demographicsDedupKey(row);
    if (existingDemographicsKeys.has(key)) {
      rejectedDemographics += 1;
      continue;
    }

    existingDemographicsKeys.add(key);
    acceptedDemographics.push(row);
  }

  const acceptedMedicalHistory: MedicalHistoryRecord[] = [];
  let rejectedMedicalHistory = 0;
  for (const row of payload.medicalHistory) {
    const key = medicalHistoryDedupKey(row);
    if (existingMedicalKeys.has(key)) {
      rejectedMedicalHistory += 1;
      continue;
    }

    existingMedicalKeys.add(key);
    acceptedMedicalHistory.push(row);
  }

  writeJsonArray(DEMOGRAPHICS_KEY, [...acceptedDemographics, ...demographicsTable].slice(0, 200));
  writeJsonArray(MEDICAL_HISTORY_KEY, [...acceptedMedicalHistory, ...medicalHistoryTable].slice(0, 500));

  return {
    acceptedDemographics: acceptedDemographics.length,
    rejectedDemographics,
    acceptedMedicalHistory: acceptedMedicalHistory.length,
    rejectedMedicalHistory,
  };
}

export function readTables() {
  return {
    demographics: readJsonArray<DemographicsRecord>(DEMOGRAPHICS_KEY),
    medicalHistory: readJsonArray<MedicalHistoryRecord>(MEDICAL_HISTORY_KEY),
  };
}

export function clearTables() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(DEMOGRAPHICS_KEY);
  localStorage.removeItem(MEDICAL_HISTORY_KEY);
}
