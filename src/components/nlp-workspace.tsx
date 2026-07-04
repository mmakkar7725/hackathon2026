"use client";

import { BrainCircuit, Database } from "lucide-react";
import { useCallback, useState } from "react";

import { HistoryPanel } from "@/components/history-panel";
import { MedicalConceptsPanel } from "@/components/medical-concepts-panel";
import { QueryExplanation } from "@/components/query-explanation";
import { QueryInputPanel } from "@/components/query-input-panel";
import { SamplePrompts } from "@/components/sample-prompts";
import { SqlOutput } from "@/components/sql-output";
import { Badge } from "@/components/ui/badge";
import { data as samplePrompts } from "@/data/samplePrompts";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { useQueryStore } from "@/store/queryStore";
import { QueryResult } from "@/types/medical";

export function NlpWorkspace() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [useGeminiAssist, setUseGeminiAssist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    prompt,
    currentResult,
    history,
    setPrompt,
    setResult,
    loadFromHistory,
    clearHistory,
  } = useQueryStore();

  const runTranslation = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          useGeminiAssist,
        }),
      });

      if (!response.ok) {
        throw new Error("Translation failed.");
      }

      const result = (await response.json()) as QueryResult;
      setResult(result);
    } catch {
      setError("Could not translate this query right now. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  }, [prompt, setResult, useGeminiAssist]);

  const { isListening, isSupported, startListening } = useSpeechInput((transcript) => {
    setPrompt(transcript);
  });

  const concepts = currentResult?.concepts ?? [];
  const explanation = currentResult?.explanationSteps ?? [];
  const confidence = currentResult?.confidenceScore ?? 0;
  const sql =
    currentResult?.sql ??
    "-- SQL output will appear after you translate a natural language medical question.";

  return (
    <>
      <div className="fade-in-up rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-4 py-3 shadow-[var(--ds-elevation-1)]">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge>
            <BrainCircuit size={12} /> NLP Parsing
          </Badge>
          <Badge>
            <Database size={12} /> SQL Generation
          </Badge>
          {currentResult?.translationMode === "gemini-assist" ? (
            <Badge tone="success">Gemini Assist{currentResult.modelUsed ? ` (${currentResult.modelUsed})` : ""}</Badge>
          ) : (
            <Badge tone="neutral">Deterministic Mode</Badge>
          )}
        </div>
        {currentResult?.statusLabel ? (
          <>
            <p className="ds-body font-medium text-[var(--text-primary)]">Status: {currentResult.statusLabel}</p>
            {currentResult.statusDetail ? (
              <p className="ds-caption mt-1 text-[var(--text-secondary)]">{currentResult.statusDetail}</p>
            ) : null}
          </>
        ) : (
          <p className="ds-caption text-[var(--text-secondary)]">
            Run a query translation to view processing status.
          </p>
        )}
      </div>

      <section className="fade-in-up grid gap-6 lg:grid-cols-[1.6fr_1fr]" style={{ animationDelay: "120ms" }}>
        <div className="space-y-4">
          <QueryInputPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={runTranslation}
            isTranslating={isTranslating}
            useGeminiAssist={useGeminiAssist}
            onGeminiToggle={setUseGeminiAssist}
            isListening={isListening}
            isSpeechSupported={isSupported}
            onStartVoice={startListening}
          />
          {error ? <p className="ds-body text-rose-700">{error}</p> : null}
          <SamplePrompts prompts={samplePrompts} onPick={setPrompt} />
        </div>
        <HistoryPanel history={history} onLoad={loadFromHistory} onClear={clearHistory} />
      </section>

      <section className="fade-in-up grid gap-6 lg:grid-cols-2" style={{ animationDelay: "220ms" }}>
        <SqlOutput sql={sql} />
        <MedicalConceptsPanel concepts={concepts} confidenceScore={confidence} />
      </section>

      <section className="fade-in-up" style={{ animationDelay: "300ms" }}>
        <QueryExplanation
          steps={
            explanation.length > 0
              ? explanation
              : ["Run a translation to see step-by-step explainability details."]
          }
          aiExplanation={
            currentResult?.aiExplanation ??
            "The app uses deterministic NLP extraction and coded concept mapping before building SQL clauses."
          }
        />
      </section>

      <section className="fade-in-up rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-4 shadow-[var(--ds-elevation-1)]">
        <h4 className="ds-body font-semibold text-[var(--text-primary)]">Professional Use Disclaimer</h4>
        <ul className="mt-2 space-y-1">
          <li className="ds-caption text-[var(--text-secondary)]">
            This demo generates draft SQL for analytics acceleration and does not replace clinical judgement.
          </li>
          <li className="ds-caption text-[var(--text-secondary)]">
            Validate generated queries against approved schema, data governance, and privacy policies before use.
          </li>
          <li className="ds-caption text-[var(--text-secondary)]">
            For regulated workflows, route results through human review and audit logging.
          </li>
        </ul>
      </section>
    </>
  );
}
