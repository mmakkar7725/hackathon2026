"use client";

import { BrainCircuit, CheckCircle2, Circle, Database, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";


import { AgentActivityPanel } from "@/components/agent-activity-panel";
import { QueryInputPanel } from "@/components/query-input-panel";
import { SamplePrompts } from "@/components/sample-prompts";
import { SqlOutput } from "@/components/sql-output";
import { Badge } from "@/components/ui/badge";
import { data as samplePrompts } from "@/data/samplePrompts";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { runQueryAgainstStep1Data, Step1QueryRunResult } from "@/services/localQueryRunner";
import { useQueryStore } from "@/store/queryStore";
import type { AmbiguityDetection, QueryResult } from "@/types/medical";

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

type TimelineKey = "entities" | "filters" | "sql" | "patients";
type TimelineStatus = "pending" | "active" | "done";

type TimelineState = Record<TimelineKey, TimelineStatus>;

function createDefaultTimelineState(): TimelineState {
  return {
    entities: "pending",
    filters: "pending",
    sql: "pending",
    patients: "pending",
  };
}

function countInferredFilters(filters: QueryResult["filters"]) {
  const values = Object.values(filters ?? {});
  return values.filter((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return true;
  }).length;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatTimestamp(value: string | number | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLocalInsights(output: Step1QueryRunResult): QueryInsightsResponse {
  const relaxationAdvice = output.relaxationStats
    .filter((item) => item.additionalPatients > 0)
    .slice(0, 3)
    .map((item) => ({
      droppedFilter: item.droppedFilter,
      additionalPatients: item.additionalPatients,
      rationale: `Dropping ${item.droppedFilter} may include ${item.additionalPatients} more patients.`,
    }));

  const patientJoinChances = output.nearMisses.slice(0, 5).map((item) => ({
    patientId: item.patientId,
    fullName: item.fullName,
    chancePercent: item.chanceToJoinPercent,
    reason:
      item.missingCriteria.length > 0
        ? `Near match. Missing: ${item.missingCriteria.join(", ")}.`
        : "Near match based on current filters.",
  }));

  return {
    overview: `Current query matched ${output.totalPatients} out of ${output.totalCandidates} ingested patients.`,
    relaxationAdvice,
    patientJoinChances,
    source: "fallback",
    model: "local-fallback",
  };
}

export function NlpWorkspace() {
  const pipelineSectionRef = useRef<HTMLElement | null>(null);
  const [isExecutingPipeline, setIsExecutingPipeline] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<"idle" | "translating" | "executing" | "insights" | "done">("idle");
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [useGeminiAssist, setUseGeminiAssist] = useState(true);
  const [ambiguities, setAmbiguities] = useState<AmbiguityDetection[] | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState>(createDefaultTimelineState());
  const [timelineFacts, setTimelineFacts] = useState({
    entitiesFound: 0,
    filtersInferred: 0,
    sqlBuilt: false,
    patientsMatched: 0,
  });
  const [step1Result, setStep1Result] = useState<Step1QueryRunResult | null>(null);
  const [queryInsights, setQueryInsights] = useState<QueryInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    prompt,
    currentResult,
    history,
    setPrompt,
    setResult,
  } = useQueryStore();

  const downloadMatchedPatientsCsv = useCallback(() => {
    if (!step1Result || step1Result.rows.length === 0) {
      return;
    }

    const header = [
      "Patient ID",
      "Full Name",
      "Age",
      "Gender",
      "Matched Conditions",
      "Matched Codes",
      "Last Uploaded",
    ];

    const lines = step1Result.rows.map((row) => [
      row.patientId,
      row.fullName,
      row.age ?? "",
      row.gender ?? "",
      row.matchedConditions.join(", "),
      row.matchedCodes.join(", "),
      formatTimestamp(row.latestUploadAt),
    ]);

    const csv = [header, ...lines]
      .map((line) => line.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateTag = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `matched-patients-${dateTag}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [step1Result]);

  const downloadMatchedPatientsPdf = useCallback(() => {
    if (!step1Result || step1Result.rows.length === 0) {
      return;
    }

    const rowsHtml = step1Result.rows
      .map((row) => {
        const demographics = `Age: ${row.age ?? "-"} | Gender: ${row.gender ?? "-"}`;
        return `
          <tr>
            <td>${escapeHtml(row.fullName)}</td>
            <td>${escapeHtml(row.patientId)}</td>
            <td>${escapeHtml(demographics)}</td>
            <td>${escapeHtml(row.matchedConditions.join(", ") || "-")}</td>
            <td>${escapeHtml(row.matchedCodes.join(", ") || "-")}</td>
            <td>${escapeHtml(formatTimestamp(row.latestUploadAt))}</td>
          </tr>
        `;
      })
      .join("");

    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      setError("Popup blocked. Enable popups to export PDF.");
      return;
    }

    const generatedAt = new Date().toLocaleString();
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Matched Patients Report</title>
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0 0 8px; font-size: 20px; }
            p { margin: 0 0 10px; font-size: 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 11px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Matched Patients Report</h1>
          <p>Generated: ${escapeHtml(generatedAt)}</p>
          <p>Matched Patients: ${step1Result.totalPatients} | Total Candidates: ${step1Result.totalCandidates}</p>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Patient ID</th>
                <th>Demographics</th>
                <th>Matched Conditions</th>
                <th>Matched Codes</th>
                <th>Last Uploaded</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }, [step1Result]);

  const runTranslateAndExecute = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    try {
      const pipelineEl = pipelineSectionRef.current;
      if (pipelineEl) {
        const targetTop = Math.max(0, pipelineEl.getBoundingClientRect().top + window.scrollY - 72);
        window.scrollTo({ top: targetTop, behavior: "smooth" });
      }

      setPipelineStep("idle");
      setIsExecutingPipeline(true);
      setStep1Result(null);
      setQueryInsights(null);
      setError(null);
      setTimelineState({
        entities: "active",
        filters: "pending",
        sql: "pending",
        patients: "pending",
      });
      setTimelineFacts({
        entitiesFound: 0,
        filtersInferred: 0,
        sqlBuilt: false,
        patientsMatched: 0,
      });
      setPipelineStep("translating");

      let translated: QueryResult | null = null;

      try {
        // Import readTables locally to get dataset statistics
        const { readTables } = await import("@/services/localTables");
        const { demographics, medicalHistory } = readTables();
        
        // Calculate dataset statistics
        const uniquePatients = new Set(demographics.map((d) => d.patientId));
        const dateRanges = medicalHistory
          .map((m) => m.onsetDate)
          .filter((d) => d)
          .sort();
        
        const datasetStats = {
          demographicsCount: demographics.length,
          medicalHistoryCount: medicalHistory.length,
          uniquePatientsCount: uniquePatients.size,
          dateRangeStart: dateRanges[0] ?? undefined,
          dateRangeEnd: dateRanges[dateRanges.length - 1] ?? undefined,
        };

        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            useGeminiAssist,
            datasetStats,
            ambiguities,
          }),
        });

        if (!response.ok) {
          let errorMessage = "Translation failed.";
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload?.error) {
              errorMessage = payload.error;
            }
          } catch {
            // Ignore JSON parsing failures and keep the default message.
          }

          throw new Error(errorMessage);
        }

        translated = (await response.json()) as QueryResult;
        setResult(translated);

        const entitiesFound = translated.concepts.length;
        const filtersInferred = countInferredFilters(translated.filters);
        const sqlBuilt = Boolean(translated.sql?.trim());

        setTimelineFacts((previous) => ({
          ...previous,
          entitiesFound,
        }));
        setTimelineState((previous) => ({
          ...previous,
          entities: "done",
          filters: "active",
        }));

        await wait(180);

        setTimelineFacts((previous) => ({
          ...previous,
          filtersInferred,
        }));
        setTimelineState((previous) => ({
          ...previous,
          filters: "done",
          sql: "active",
        }));

        await wait(180);

        setTimelineFacts((previous) => ({
          ...previous,
          sqlBuilt,
        }));
        setTimelineState((previous) => ({
          ...previous,
          sql: "done",
          patients: "active",
        }));
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Translation failed.";
        setError(`Translation step failed: ${message}`);
        setIsExecutingPipeline(false);
        setTimelineState(createDefaultTimelineState());
        setPipelineStep("idle");
        return;
      }

      setPipelineStep("executing");
      const output = runQueryAgainstStep1Data(translated);
      setStep1Result(output);
      setTimelineFacts((previous) => ({
        ...previous,
        patientsMatched: output.totalPatients,
      }));
      setTimelineState((previous) => ({
        ...previous,
        patients: "done",
      }));
      setIsGeneratingInsights(true);
      setPipelineStep("insights");

      try {
        const insightsResponse = await fetch("/api/query-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: translated.input,
            totalPatients: output.totalPatients,
            totalCandidates: output.totalCandidates,
            relaxationStats: output.relaxationStats,
            nearMisses: output.nearMisses,
          }),
        });

        if (insightsResponse.ok) {
          const insights = (await insightsResponse.json()) as QueryInsightsResponse;
          setQueryInsights(insights);
        } else {
          setQueryInsights(buildLocalInsights(output));
          setError("Gemini insights unavailable. Showing deterministic fallback insights.");
        }
      } catch {
        setQueryInsights(buildLocalInsights(output));
        setError("Gemini insights unavailable. Showing deterministic fallback insights.");
      } finally {
        setIsGeneratingInsights(false);
        setIsExecutingPipeline(false);
        setPipelineStep("done");
      }
    } catch (executionError) {
      const message =
        executionError instanceof Error
          ? executionError.message
          : "An unexpected error occurred during query execution.";
      setError(`Query execution failed: ${message}`);
      setIsExecutingPipeline(false);
      setTimelineState(createDefaultTimelineState());
      setPipelineStep("idle");
    }
  }, [prompt, setResult, useGeminiAssist, ambiguities]);

  const { isListening, isSupported, startListening } = useSpeechInput((transcript: string) => {
    setPrompt(transcript);
  });

  const limitedPrompts = samplePrompts.slice(0, 2);

  const sql =
    currentResult?.sql ??
    "-- SQL output will appear after you translate a natural language medical question.";

  const compactTimeline = [
    {
      key: "entities" as const,
      label: "Entities",
      doneDetail: `${timelineFacts.entitiesFound}`,
      activeDetail: "...",
      pendingDetail: "-",
    },
    {
      key: "filters" as const,
      label: "Filters",
      doneDetail: `${timelineFacts.filtersInferred}`,
      activeDetail: "...",
      pendingDetail: "-",
    },
    {
      key: "sql" as const,
      label: "SQL",
      doneDetail: timelineFacts.sqlBuilt ? "Ready" : "Empty",
      activeDetail: "...",
      pendingDetail: "-",
    },
    {
      key: "patients" as const,
      label: "Patients",
      doneDetail: `${timelineFacts.patientsMatched}`,
      activeDetail: "...",
      pendingDetail: "-",
    },
  ] as const;

  return (
    <>

      <section className="fade-in-up grid gap-4 lg:grid-cols-[1.1fr_1fr]" style={{ animationDelay: "120ms" }}>
        <div className="space-y-3">
          <QueryInputPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmitAndExecute={runTranslateAndExecute}
            isTranslating={isExecutingPipeline && pipelineStep === "translating"}
            isExecuting={isExecutingPipeline}
            useGeminiAssist={useGeminiAssist}
            onGeminiToggle={setUseGeminiAssist}
            isListening={isListening}
            isSpeechSupported={isSupported}
            onStartVoice={startListening}
            onAmbiguitiesChange={setAmbiguities}
          />
          {error ? <p className="ds-body text-rose-700">{error}</p> : null}
          <details className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-2">
            <summary className="ds-caption cursor-pointer font-semibold text-[var(--text-primary)]">Sample Queries</summary>
            <div className="mt-2">
              <SamplePrompts prompts={limitedPrompts} onPick={setPrompt} />
            </div>
          </details>
        </div>

        <section className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-4 shadow-[var(--ds-elevation-1)]">
          <div>
            <div>
              <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Clinical Dataset Query Results</h3>
              <p className="ds-caption mt-1 text-[var(--text-secondary)]">
                Patient records matched from Step 1 ingested data using the generated query filters.
              </p>
            </div>
          </div>

          {step1Result ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="ds-body font-medium text-[var(--text-primary)]">
                    Matched Patients: {step1Result.totalPatients}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadMatchedPatientsCsv}
                      disabled={step1Result.rows.length === 0}
                      className="ds-caption inline-flex items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-2.5 py-1.5 font-medium text-[var(--text-secondary)] transition hover:border-[var(--brand-400)] hover:text-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={downloadMatchedPatientsPdf}
                      disabled={step1Result.rows.length === 0}
                      className="ds-caption inline-flex items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-2.5 py-1.5 font-medium text-[var(--text-secondary)] transition hover:border-[var(--brand-400)] hover:text-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
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
                      {step1Result.rows.map((row, index) => (
                        <tr key={`${row.patientId}-${row.fullName}-${index}`} className="align-top">
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
                            <span suppressHydrationWarning>{row.latestUploadAt ? new Date(row.latestUploadAt).toLocaleString() : "-"}</span>
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
            </div>
          ) : (
            <p className="ds-caption mt-3 text-[var(--text-secondary)]">
              Use <strong>Translate &amp; Execute</strong> above to translate the query and immediately run it against ingested patient data.
            </p>
          )}

          {queryInsights && (
            <div className="mt-4 rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
              <p className="ds-caption font-semibold text-[var(--text-primary)] mb-2">
                💡 Gemini Insights {queryInsights.source === "gemini" && `(${queryInsights.model})`}
              </p>
              <p className="ds-caption text-[var(--text-secondary)] mb-3">{queryInsights.overview}</p>
              
              {queryInsights.relaxationAdvice.length > 0 && (
                <div className="mb-3">
                  <p className="ds-caption font-medium text-[var(--text-secondary)] mb-1">Try relaxing filters:</p>
                  <ul className="space-y-1">
                    {queryInsights.relaxationAdvice.map((advice, idx) => (
                      <li key={idx} className="ds-caption text-[var(--text-secondary)] text-sm">
                        • Drop <strong>{advice.droppedFilter}</strong> → {advice.additionalPatients} more patients
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {queryInsights.patientJoinChances.length > 0 && (
                <div>
                  <p className="ds-caption font-medium text-[var(--text-secondary)] mb-1">Near-match patients:</p>
                  <ul className="space-y-1">
                    {queryInsights.patientJoinChances.map((patient, idx) => (
                      <li key={idx} className="ds-caption text-[var(--text-secondary)] text-sm">
                        • <strong>{patient.fullName}</strong> ({patient.patientId}): {patient.chancePercent}% match - {patient.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 mt-4">
            <p className="ds-caption text-[var(--text-secondary)] italic">Demo Illustration Only</p>
            <AgentActivityPanel pollingInterval={500} />
          </div>
        </section>
      </section>

      <section className="fade-in-up grid gap-6 lg:grid-cols-2" style={{ animationDelay: "280ms" }}>
        <details className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3 shadow-[var(--ds-elevation-1)]">
          <summary className="ds-body cursor-pointer font-semibold text-[var(--text-primary)]">Generated SQL</summary>
          <div className="mt-3">
            <SqlOutput sql={sql} />
          </div>
        </details>
      </section>
    </>
  );
}
