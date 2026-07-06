"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { QueryResult } from "@/types/medical";

interface QueryStoreState {
  prompt: string;
  currentResult: QueryResult | null;
  history: QueryResult[];
  setPrompt: (value: string) => void;
  setResult: (result: QueryResult) => void;
  loadFromHistory: (id: string) => void;
  clearHistory: () => void;
}

export const useQueryStore = create<QueryStoreState>()(
  persist(
    (set) => ({
      prompt: "",
      currentResult: null,
      history: [],
      setPrompt: (value) => set({ prompt: value }),
      setResult: (result) =>
        set((state) => ({
          currentResult: result,
          history: [result, ...state.history.filter((item) => item.id !== result.id)].slice(
            0,
            6
          ),
        })),
      loadFromHistory: (id) =>
        set((state) => {
          const found = state.history.find((item) => item.id === id) ?? null;
          return {
            currentResult: found,
            prompt: found?.input ?? state.prompt,
          };
        }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "medquery-history-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        prompt: state.prompt,
        currentResult: state.currentResult,
        history: state.history,
      }),
    }
  )
);
