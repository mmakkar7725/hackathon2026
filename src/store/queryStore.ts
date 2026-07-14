"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { QueryResult, QueryInsightsResponse } from "@/types/medical";
import type { Step1QueryRunResult } from "@/services/localQueryRunner";

interface PipelineState {
  isExecutingPipeline: boolean;
  isGeneratingInsights: boolean;
  pipelineStep: "idle" | "translating" | "executing" | "insights" | "done";
  timelineState: {
    entities: "pending" | "active" | "done";
    filters: "pending" | "active" | "done";
    sql: "pending" | "active" | "done";
    patients: "pending" | "active" | "done";
  };
  timelineFacts: {
    entitiesFound: number;
    filtersInferred: number;
    sqlBuilt: boolean;
    patientsMatched: number;
  };
  step1Result: Step1QueryRunResult | null;
  queryInsights: QueryInsightsResponse | null;
  nlpError: string | null;
}

interface QueryStoreState {
  prompt: string;
  currentResult: QueryResult | null;
  history: QueryResult[];
  pipeline: PipelineState;
  setPrompt: (value: string) => void;
  setResult: (result: QueryResult) => void;
  loadFromHistory: (id: string) => void;
  clearHistory: () => void;
  updatePipeline: (updates: Partial<PipelineState>) => void;
  mergeTimelineState: (updates: Partial<PipelineState["timelineState"]>) => void;
  mergeTimelineFacts: (updates: Partial<PipelineState["timelineFacts"]>) => void;
  resetPipeline: () => void;
}

const defaultPipelineState: PipelineState = {
  isExecutingPipeline: false,
  isGeneratingInsights: false,
  pipelineStep: "idle",
  timelineState: { entities: "pending", filters: "pending", sql: "pending", patients: "pending" },
  timelineFacts: { entitiesFound: 0, filtersInferred: 0, sqlBuilt: false, patientsMatched: 0 },
  step1Result: null,
  queryInsights: null,
  nlpError: null,
};

export const useQueryStore = create<QueryStoreState>()(
  persist(
    (set) => ({
      prompt: "",
      currentResult: null,
      history: [],
      pipeline: defaultPipelineState,
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
      updatePipeline: (updates) =>
        set((state) => ({
          pipeline: { ...state.pipeline, ...updates },
        })),
      mergeTimelineState: (updates) =>
        set((state) => ({
          pipeline: {
            ...state.pipeline,
            timelineState: { ...state.pipeline.timelineState, ...updates },
          },
        })),
      mergeTimelineFacts: (updates) =>
        set((state) => ({
          pipeline: {
            ...state.pipeline,
            timelineFacts: { ...state.pipeline.timelineFacts, ...updates },
          },
        })),
      resetPipeline: () => set({ pipeline: defaultPipelineState }),
    }),
    {
      name: "medquery-history-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        prompt: state.prompt,
        currentResult: state.currentResult,
        history: state.history,
        pipeline: state.pipeline,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[queryStore] Failed to rehydrate from localStorage, resetting.", error);
          if (state) {
            state.pipeline = defaultPipelineState;
          }
        }
      },
    }
  )
);
