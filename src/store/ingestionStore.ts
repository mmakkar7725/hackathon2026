"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FileParseStatus = "pending" | "processing" | "parsed" | "failed";

export interface FileProgressEntry {
  name: string;
  status: FileParseStatus;
  detail?: string;
}

interface IngestionStoreState {
  fileProgress: FileProgressEntry[];
  isParsing: boolean;
  statusLabel: string | null;
  statusDetail: string | null;
  ingestionError: string | null;
  setFileProgress: (
    entriesOrUpdater: FileProgressEntry[] | ((prev: FileProgressEntry[]) => FileProgressEntry[])
  ) => void;
  setIsParsing: (val: boolean) => void;
  setStatusLabel: (val: string | null) => void;
  setStatusDetail: (val: string | null) => void;
  setIngestionError: (val: string | null) => void;
  clearProgress: () => void;
}

export const useIngestionStore = create<IngestionStoreState>()(
  persist(
    (set) => ({
      fileProgress: [],
      isParsing: false,
      statusLabel: null,
      statusDetail: null,
      ingestionError: null,
      setFileProgress: (entriesOrUpdater) =>
        set((state) => ({
          fileProgress:
            typeof entriesOrUpdater === "function"
              ? entriesOrUpdater(state.fileProgress)
              : entriesOrUpdater,
        })),
      setIsParsing: (val) => set({ isParsing: val }),
      setStatusLabel: (val) => set({ statusLabel: val }),
      setStatusDetail: (val) => set({ statusDetail: val }),
      setIngestionError: (val) => set({ ingestionError: val }),
      clearProgress: () =>
        set({ fileProgress: [], isParsing: false, statusLabel: null, statusDetail: null, ingestionError: null }),
    }),
    {
      name: "medquery-ingestion-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fileProgress: state.fileProgress,
        isParsing: state.isParsing,
        statusLabel: state.statusLabel,
        statusDetail: state.statusDetail,
        ingestionError: state.ingestionError,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[ingestionStore] Failed to rehydrate from localStorage, resetting.", error);
        }
        // Always reset isParsing on load — a previous session may have crashed mid-parse
        if (state) {
          state.isParsing = false;
        }
      },
    }
  )
);
