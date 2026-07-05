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
import { runQueryAgainstStep1Data, Step1QueryRunResult } from "@/services/localQueryRunner";
import { useQueryStore } from "@/store/queryStore";
import { QueryResult } from "@/types/medical";

interface QueryInsightsResponse {
  overview: string;
  relaxationAdvice: Array<{
    droppedFilter: string;
    additionalPatients: number;
    rationale: string;
  }>;
  patientJoinChances: Array<{
    patientId: string;
    fullName: string;
    chancePercent: number;
    reason: string;
  }>;
  source?: "gemini" | "fallback";
  model?: string;
}

export function NlpWorkspace() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRunningOnStep1, setIsRunningOnStep1] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [useGeminiAssist, setUseGeminiAssist] = useState(false);
  const [step1Result, setStep1Result] = useState<Step1QueryRunResult | null>(null);
  const [queryInsights, setQueryInsights] = useState<QueryInsightsResponse | null>(null);
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

  const runOnStep1Database = useCallback(() => {
    if (!currentResult) {
      return;
    }

    setIsRunningOnStep1(true);
    setQueryInsights(null);
    setError(null);

    const runInsights = async (output: Step1QueryRunResult) => {
      setIsGeneratingInsights(true);
      try {
        const response = await fetch("/api/query-insights", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: currentResult.input,
            totalPatients: output.totalPatients,
            totalCandidates: output.totalCandidates,
            relaxationStats: output.relaxationStats,
            nearMisses: output.nearMisses,
          }),
        });

        if (!response.ok) {
          throw new Error("Insights failed");
        }

        const insights = (await response.json()) as QueryInsightsResponse;
        setQueryInsights(insights);
      } catch {
        setError("Step 1 query ran, but Gemini insights are currently unavailable.");
      } finally {
        setIsGeneratingInsights(false);
      }
    };

    try {
      const output = runQueryAgainstStep1Data(currentResult);
      setStep1Result(output);
      void runInsights(output);
    } finally {
      setIsRunningOnStep1(false);
    }
  }, [currentResult]);

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

      <section className="fade-in-up rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-4 shadow-[var(--ds-elevation-1)]" style={{ animationDelay: "260ms" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Execute Query Against Step 1 Clinical Dataset</h3>
            <p className="ds-caption mt-1 text-[var(--text-secondary)]">
              Execute the generated query filters on ingested demographics and medical history rows.
            </p>
          </div>
          <button
            type="button"
            onClick={runOnStep1Database}
            disabled={!currentResult || isRunningOnStep1}
            className="ds-body inline-flex items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--brand-500)] bg-[var(--surface-1)] px-3 py-2 font-medium text-[var(--brand-700)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunningOnStep1 ? "Running..." : "Run On Step 1 Data"}
          </button>
        </div>

        {step1Result ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
              <p className="ds-body font-medium text-[var(--text-primary)]">
                Matched Patients: {step1Result.totalPatients}
              </p>
              <p className="ds-caption mt-1 text-[var(--text-secondary)]">
                Scanned {step1Result.scannedDemographics} demographics rows and {step1Result.scannedHistoryRows} medical history rows.
              </p>
              <p className="ds-caption mt-1 text-[var(--text-secondary)]">
                Total candidates in Step 1: {step1Result.totalCandidates}
              </p>
            </div>

            {step1Result.rows.length > 0 ? (
              <div className="max-h-[340px] overflow-auto rounded-[var(--ds-radius-sm)] border border-[var(--border)]">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[var(--surface-1)]">
                    <tr>
                      <th className="ds-caption border-b border-[var(--border)] px-3 py-2 text-left text-[var(--text-secondary)]">Patient</th>
                      <th className="ds-caption border-b border-[var(--border)] px-3 py-2 text-left text-[var(--text-secondary)]">Demographics</th>
                      <th className="ds-caption border-b border-[var(--border)] px-3 py-2 text-left text-[var(--text-secondary)]">Matched Conditions</th>
                      <th className="ds-caption border-b border-[var(--border)] px-3 py-2 text-left text-[var(--text-secondary)]">Matched Codes</th>
                      <th className="ds-caption border-b border-[var(--border)] px-3 py-2 text-left text-[var(--text-secondary)]">Last Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step1Result.rows.map((row) => (
                      <tr key={`${row.patientId}-${row.fullName}`} className="align-top">
                        <td className="ds-caption border-b border-[var(--border)] px-3 py-2 text-[var(--text-primary)]">
                          <p className="ds-body font-medium">{row.fullName}</p>
                          <p className="text-[var(--text-secondary)]">{row.patientId}</p>
                        </td>
                        <td className="ds-caption border-b border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
                          Age: {row.age ?? "-"} | Gender: {row.gender ?? "-"}
                        </td>
                        <td className="ds-caption border-b border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
                          {row.matchedConditions.length > 0 ? row.matchedConditions.join(", ") : "-"}
                        </td>
                        <td className="ds-caption border-b border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
                          {row.matchedCodes.length > 0 ? row.matchedCodes.join(", ") : "-"}
                        </td>
                        <td className="ds-caption border-b border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
                          {row.latestUploadAt ? new Date(row.latestUploadAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ds-caption text-[var(--text-secondary)]">
                No patients matched the generated query on current Step 1 data.
              </p>
            )}

            <details className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3" open>
              <summary className="ds-body cursor-pointer font-medium text-[var(--text-primary)]">Gemini Match Insights</summary>
              {isGeneratingInsights ? (
                <p className="ds-caption mt-2 text-[var(--text-secondary)]">Analyzing match expansion opportunities...</p>
              ) : queryInsights ? (
                <div className="mt-2 space-y-3">
                  <p className="ds-caption text-[var(--text-secondary)]">{queryInsights.overview}</p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Source: {queryInsights.source === "gemini" ? `Gemini (${queryInsights.model ?? "model"})` : "Deterministic fallback"}
                  </p>

                  <div>
                    <p className="ds-caption font-medium text-[var(--text-primary)]">If we drop some filters:</p>
                    <ul className="mt-1 space-y-1">
                      {queryInsights.relaxationAdvice.length > 0 ? (
                        queryInsights.relaxationAdvice.map((item) => (
                          <li key={item.droppedFilter} className="ds-caption text-[var(--text-secondary)]">
                            {item.droppedFilter}: +{item.additionalPatients} patients. {item.rationale}
                          </li>
                        ))
                      ) : (
                        <li className="ds-caption text-[var(--text-secondary)]">No high-impact relaxation suggestion found.</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="ds-caption font-medium text-[var(--text-primary)]">Patient join chances:</p>
                    <ul className="mt-1 max-h-[180px] space-y-1 overflow-auto pr-1">
                      {queryInsights.patientJoinChances.length > 0 ? (
                        queryInsights.patientJoinChances.map((item) => (
                          <li key={`${item.patientId}-${item.fullName}`} className="ds-caption text-[var(--text-secondary)]">
                            {item.fullName} ({item.patientId}): {item.chancePercent}% chance. {item.reason}
                          </li>
                        ))
                      ) : (
                        <li className="ds-caption text-[var(--text-secondary)]">No near-miss patients to score.</li>
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="ds-caption mt-2 text-[var(--text-secondary)]">
                  Run Step 1 execution to generate Gemini insights.
                </p>
              )}
            </details>
          </div>
        ) : (
          <p className="ds-caption mt-3 text-[var(--text-secondary)]">
            Translate a query first, then run it on Step 1 data to view patient matches.
          </p>
        )}
      </section>

      <section className="fade-in-up grid gap-6 lg:grid-cols-2" style={{ animationDelay: "300ms" }}>
        <details className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3 shadow-[var(--ds-elevation-1)]" open>
          <summary className="ds-body cursor-pointer font-semibold text-[var(--text-primary)]">Query Explainability</summary>
          <div className="mt-3">
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
          </div>
        </details>

        <details className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-4 shadow-[var(--ds-elevation-1)]">
          <summary className="ds-body cursor-pointer font-semibold text-[var(--text-primary)]">Professional Use Disclaimer</summary>
          <ul className="mt-3 space-y-1">
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
        </details>
      </section>
    </>
  );
}
