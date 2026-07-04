"use client";

import { DemographicsRecord, MedicalHistoryRecord } from "@/types/intake";

const DEMOGRAPHICS_KEY = "medquery-demographics-table-v1";
const MEDICAL_HISTORY_KEY = "medquery-medical-history-table-v1";

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

  writeJsonArray(DEMOGRAPHICS_KEY, [...payload.demographics, ...demographicsTable].slice(0, 200));
  writeJsonArray(MEDICAL_HISTORY_KEY, [...payload.medicalHistory, ...medicalHistoryTable].slice(0, 500));
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
