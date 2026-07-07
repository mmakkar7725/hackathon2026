"use client";

import { FileUp, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appendToTables, clearTables, readTables } from "@/services/localTables";
import { DemographicsRecord, IntakeParseResponse, MedicalHistoryRecord } from "@/types/intake";

type SelectedRecord =
  | { type: "demographics"; record: DemographicsRecord }
  | { type: "medical"; record: MedicalHistoryRecord }
  | null;

type FileParseStatus = "pending" | "processing" | "parsed" | "failed";

export function IngestionWorkspace() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileProgress, setFileProgress] = useState<Array<{ name: string; status: FileParseStatus; detail?: string }>>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false);
  const [connectivity, setConnectivity] = useState<{
    ok: boolean;
    status: string;
    detail: string;
    checkedAt?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [parseDebug, setParseDebug] = useState<{
    sourceFileName: string;
    parserMode: IntakeParseResponse["parserMode"];
    demographicsRows: number;
    medicalRows: number;
    demographicsMissingName: number;
    demographicsMissingGender: number;
    medicalMissingCondition: number;
    medicalMissingCode: number;
    extractionSource?: string;
    extractedTextLength?: number;
    finalTextLength?: number;
    usedTranscription?: boolean;
    transcriptionModel?: string;
    geminiFailureReason?: string;
    extractorFailureDetail?: string;
    transcriptionFailureDetail?: string;
    previewDemographics?: DemographicsRecord;
    previewMedical?: MedicalHistoryRecord;
  } | null>(null);
  const [tables, setTables] = useState<ReturnType<typeof readTables>>({ demographics: [], medicalHistory: [] });
  const [mounted, setMounted] = useState(false);
  const [showRecordViewer, setShowRecordViewer] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTables(readTables());
  }, []);

  const onCheckConnectivity = useCallback(async () => {
    setIsCheckingConnectivity(true);
    setError(null);

    try {
      const response = await fetch("/api/intake/connectivity", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        status?: string;
        detail?: string;
        checkedAt?: number;
      };

      setConnectivity({
        ok: Boolean(payload.ok),
        status: payload.status ?? "unknown",
        detail: payload.detail ?? "No details returned.",
        checkedAt: payload.checkedAt,
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Connectivity check failed.";
      setConnectivity({
        ok: false,
        status: "request-failed",
        detail,
      });
    } finally {
      setIsCheckingConnectivity(false);
    }
  }, []);

  useEffect(() => {
    void onCheckConnectivity();
  }, [onCheckConnectivity]);

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp || !mounted) {
      return "-";
    }

    return new Date(timestamp).toLocaleString();
  };

  const formatValue = (value?: string | number) => {
    if (value === undefined || value === null || value === "") {
      return "-";
    }

    return String(value);
  };

  const renderDetailRow = (label: string, value?: string | number) => (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-t border-[var(--border)] py-2 first:border-t-0 first:pt-0">
      <p className="ds-caption font-medium text-[var(--text-secondary)]">{label}</p>
      <p className="ds-body text-[var(--text-primary)]">{formatValue(value)}</p>
    </div>
  );

  const onParseFiles = async () => {
    if (selectedFiles.length === 0) {
      setError("Please choose one or more files first.");
      return;
    }

    setError(null);
    setIsParsing(true);
    setFileProgress(
      selectedFiles.map((file) => ({
        name: file.name,
        status: "pending",
      }))
    );

    try {
      let successCount = 0;
      const failedFiles: string[] = [];

      for (const file of selectedFiles) {
        setFileProgress((previous) =>
          previous.map((entry) =>
            entry.name === file.name ? { ...entry, status: "processing", detail: "Parsing..." } : entry
          )
        );

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/intake/parse", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as Partial<IntakeParseResponse> & {
          error?: string;
        };

        if (
          !payload ||
          !Array.isArray(payload.demographics) ||
          !Array.isArray(payload.medicalHistory)
        ) {
          failedFiles.push(file.name);
          setFileProgress((previous) =>
            previous.map((entry) =>
              entry.name === file.name
                ? { ...entry, status: "failed", detail: payload?.error || "Invalid parser response." }
                : entry
            )
          );
          continue;
        }

        if (!response.ok) {
          failedFiles.push(file.name);
          setFileProgress((previous) =>
            previous.map((entry) =>
              entry.name === file.name
                ? { ...entry, status: "failed", detail: payload.error || "Parser endpoint returned an error status." }
                : entry
            )
          );
          continue;
        }

        const safePayload = payload as IntakeParseResponse;
        appendToTables({
          demographics: safePayload.demographics,
          medicalHistory: safePayload.medicalHistory,
        });

        successCount += 1;

        setParseDebug({
          sourceFileName: file.name,
          parserMode: safePayload.parserMode,
          demographicsRows: safePayload.demographics.length,
          medicalRows: safePayload.medicalHistory.length,
          demographicsMissingName: safePayload.demographics.filter(
            (row) => !row.fullName || row.fullName === "Unknown Patient"
          ).length,
          demographicsMissingGender: safePayload.demographics.filter((row) => !row.gender).length,
          medicalMissingCondition: safePayload.medicalHistory.filter(
            (row) => !row.condition || row.condition === "Unspecified condition"
          ).length,
          medicalMissingCode: safePayload.medicalHistory.filter((row) => !row.code || row.code === "N/A").length,
          extractionSource: safePayload.parseMeta?.extractionSource,
          extractedTextLength: safePayload.parseMeta?.extractedTextLength,
          finalTextLength: safePayload.parseMeta?.finalTextLength,
          usedTranscription: safePayload.parseMeta?.usedTranscription,
          transcriptionModel: safePayload.parseMeta?.transcriptionModel,
          geminiFailureReason: safePayload.parseMeta?.geminiFailureReason,
          extractorFailureDetail: safePayload.parseMeta?.extractorFailureDetail,
          transcriptionFailureDetail: safePayload.parseMeta?.transcriptionFailureDetail,
          previewDemographics: safePayload.demographics[0],
          previewMedical: safePayload.medicalHistory[0],
        });

        setFileProgress((previous) =>
          previous.map((entry) =>
            entry.name === file.name
              ? {
                  ...entry,
                  status: "parsed",
                  detail: `${safePayload.demographics.length} demographics, ${safePayload.medicalHistory.length} history rows`,
                }
              : entry
          )
        );
      }

      if (successCount === 0) {
        throw new Error("None of the selected files could be parsed.");
      }

      setStatusLabel(successCount === selectedFiles.length ? "Batch Parse Complete" : "Batch Parse Partial");
      if (successCount === selectedFiles.length) {
        setStatusDetail(`Parsed ${successCount}/${selectedFiles.length} files successfully.`);
      } else {
        setStatusDetail(
          `Parsed ${successCount}/${selectedFiles.length} files. Failed: ${failedFiles.join(", ")}`
        );
      }

      setTables(readTables());
      setSelectedFiles([]);
      // Clear file progress after a short delay
      setTimeout(() => setFileProgress([]), 2000);
    } catch (cause) {
      const detail =
        cause instanceof Error && cause.message
          ? cause.message
          : "Could not parse this file. Try another format or retry with Gemini key configured.";
      setError(detail);
    } finally {
      setIsParsing(false);
    }
  };

  const onClearTables = () => {
    clearTables();
    setSelectedRecord(null);
    setTables(readTables());
  };

  return (
    <>
      <Card className="fade-in-up">
        <h2 className="ds-h1 mb-3 text-[18px] text-[var(--text-primary)]">Upload and Ingest Clinical Files</h2>
        <p className="ds-caption mb-3 text-[var(--text-secondary)]">
          Upload PDF, image, video, or text files. We parse demographics and medical history into
          separate tables for downstream NLP querying.
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <input
              type="file"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              disabled={isParsing}
              className="file-input-accent ds-body block w-full rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <p className="ds-caption rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-secondary)]">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file(s) selected`
                : "No file chosen"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            <Button onClick={onParseFiles} disabled={isParsing || selectedFiles.length === 0}>
              {isParsing ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
              {isParsing ? "Parsing..." : "Parse and Save"}
            </Button>
            <Button variant="secondary" onClick={onCheckConnectivity} disabled={isCheckingConnectivity || isParsing} size="sm">
              {isCheckingConnectivity ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              {isCheckingConnectivity ? "Checking..." : "Check Connectivity"}
            </Button>
          </div>
        </div>

        {fileProgress.length > 0 ? (
          <div className="mt-2 rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-2">
            <p className="ds-caption mb-2 font-semibold tracking-[0.07em] text-[var(--text-secondary)] uppercase">
              File Progress
            </p>
            <ul className="max-h-[120px] space-y-1 overflow-auto pr-1">
              {fileProgress.map((item) => {
                const statusTone =
                  item.status === "parsed"
                    ? "text-emerald-700"
                    : item.status === "failed"
                      ? "text-rose-700"
                      : item.status === "processing"
                        ? "text-[var(--brand-700)]"
                        : "text-[var(--text-secondary)]";

                const label =
                  item.status === "parsed"
                    ? "Parsed"
                    : item.status === "failed"
                      ? "Failed"
                      : item.status === "processing"
                        ? "Processing"
                        : "Pending";

                return (
                  <li key={item.name} className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="ds-caption truncate text-[var(--text-primary)]" title={item.name}>{item.name}</p>
                      <p className={`ds-caption font-medium ${statusTone}`}>{label}</p>
                    </div>
                    {item.detail ? <p className="ds-caption mt-0.5 text-[0.75rem] text-[var(--text-secondary)]">{item.detail}</p> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {isParsing ? (
          <div className="mt-2 rounded-[var(--ds-radius-sm)] border border-[var(--brand-400)] bg-[var(--surface-1)] p-2">
            <p className="ds-caption text-[var(--brand-700)]">Parsing in progress, extracting clinical entities...</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--brand-500)]" />
            </div>
          </div>
        ) : null}

        {error ? <p className="ds-body mt-3 text-rose-700">{error}</p> : null}
        <div className={`mt-2 rounded-[var(--ds-radius-sm)] border px-2 py-1.5 ${isCheckingConnectivity ? "border-[var(--border)] bg-[var(--surface-1)]" : connectivity?.ok ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`ds-caption font-medium ${isCheckingConnectivity ? "text-[var(--text-primary)]" : connectivity?.ok ? "text-emerald-800" : "text-rose-800"}`}>
              Connectivity: {isCheckingConnectivity ? "Checking..." : connectivity?.ok ? "✓ Passed" : "✗ Failed"}
              {!isCheckingConnectivity && connectivity?.status ? ` (${connectivity.status})` : ""}
            </p>
            <p className={`ds-caption text-[0.75rem] ${isCheckingConnectivity ? "text-[var(--text-secondary)]" : connectivity?.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {isCheckingConnectivity
                ? "Testing..."
                : connectivity?.detail ?? "Unavailable"}
            </p>
          </div>
        </div>
      </Card>

      {statusLabel ? (
        <Card className="fade-in-up">
          <p className="ds-body font-medium text-[var(--text-primary)]">Status: {statusLabel}</p>
          {statusDetail ? <p className="ds-caption mt-1 text-[var(--text-secondary)]">{statusDetail}</p> : null}
        </Card>
      ) : null}

      <section className="fade-in-up grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Demographics Table</h3>
            <span className="ds-caption text-[var(--text-muted)]">Rows: {tables.demographics.length}</span>
          </div>
          <ul className="max-h-[320px] space-y-2 overflow-auto">
            {tables.demographics.length === 0 ? (
              <li className="ds-body rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3 text-[var(--text-muted)]">
                No demographics records yet.
              </li>
            ) : (
              tables.demographics.map((row, index) => (
                <li key={`${row.id}-${row.extractedAt ?? "na"}-${index}`}>
                  <button
                    onClick={() => setSelectedRecord({ type: "demographics", record: row })}
                    className="w-full rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-3 py-2 text-left transition hover:border-[var(--brand-400)]"
                  >
                    <p className="ds-body font-medium text-[var(--text-primary)]">{row.fullName}</p>
                    <p className="ds-caption text-[var(--text-secondary)]">
                      Patient ID: {row.patientId} · Age: {row.age ?? "-"} · Gender: {row.gender ?? "-"}
                    </p>
                    <p className="ds-caption text-[var(--text-secondary)]">
                      Uploaded: {formatDateTime(row.extractedAt)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Medical History Table</h3>
            <span className="ds-caption text-[var(--text-muted)]">Rows: {tables.medicalHistory.length}</span>
          </div>
          <ul className="max-h-[320px] space-y-2 overflow-auto">
            {tables.medicalHistory.length === 0 ? (
              <li className="ds-body rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3 text-[var(--text-muted)]">
                No medical history records yet.
              </li>
            ) : (
              tables.medicalHistory.map((row, index) => (
                <li key={`${row.id}-${row.extractedAt ?? "na"}-${index}`}>
                  <button
                    onClick={() => setSelectedRecord({ type: "medical", record: row })}
                    className="w-full rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-3 py-2 text-left transition hover:border-[var(--brand-400)]"
                  >
                    <p className="ds-body font-medium text-[var(--text-primary)]">{row.condition}</p>
                    <p className="ds-caption text-[var(--text-secondary)]">
                      Patient ID: {row.patientId} · {row.codeSystem}: {row.code}
                    </p>
                    <p className="ds-caption text-[var(--text-secondary)]">
                      Uploaded: {formatDateTime(row.extractedAt)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>
      </section>

      <Card className="fade-in-up">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button 
            onClick={() => setShowRecordViewer(!showRecordViewer)}
            className="flex flex-1 items-center gap-2 text-left transition hover:opacity-70"
          >
            <span className={`text-[var(--text-secondary)] transition-transform ${showRecordViewer ? "rotate-90" : ""}`}>▶</span>
            <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Complete Record Viewer</h3>
          </button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowRawJson((previous) => !previous)}
              disabled={!selectedRecord}
            >
              {showRawJson ? "View Structured" : "View Raw JSON"}
            </Button>
            <Button variant="ghost" onClick={onClearTables}>
              <Trash2 size={14} /> Clear Tables
            </Button>
          </div>
        </div>

        {showRecordViewer ? (
          <>
            {selectedRecord ? (
              <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                <p className="ds-caption mb-2 text-[var(--text-secondary)]">
                  Showing full {selectedRecord.type === "demographics" ? "demographics" : "medical history"} record
                </p>

                {showRawJson ? (
                  <pre className="max-h-[300px] overflow-auto rounded-[var(--ds-radius-sm)] bg-[var(--code-bg)] p-3 text-xs text-[var(--code-fg)]">
{JSON.stringify(selectedRecord.record, null, 2)}
                  </pre>
                ) : (
                  <div className="space-y-4">
                    <section className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3">
                      <p className="ds-caption mb-2 font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                        Demographics
                      </p>
                      {selectedRecord.type === "demographics" ? (
                        <>
                          {renderDetailRow("Patient ID", selectedRecord.record.patientId)}
                          {renderDetailRow("Full Name", selectedRecord.record.fullName)}
                          {renderDetailRow("Age", selectedRecord.record.age)}
                          {renderDetailRow("Gender", selectedRecord.record.gender)}
                          {renderDetailRow("Date of Birth", selectedRecord.record.dateOfBirth)}
                        </>
                      ) : (
                        <>
                          {renderDetailRow("Patient ID", selectedRecord.record.patientId)}
                          {renderDetailRow("Linked Name", "Captured in demographics table")}
                        </>
                      )}
                    </section>

                    <section className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3">
                      <p className="ds-caption mb-2 font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                        Diagnosis
                      </p>
                      {selectedRecord.type === "medical" ? (
                        <>
                          {renderDetailRow("Condition", selectedRecord.record.condition)}
                          {renderDetailRow("Code System", selectedRecord.record.codeSystem)}
                          {renderDetailRow("Code", selectedRecord.record.code)}
                          {renderDetailRow("Clinical Note", selectedRecord.record.note)}
                        </>
                      ) : (
                        <>{renderDetailRow("Condition", "No diagnosis fields in demographics record")}</>
                      )}
                    </section>

                    <section className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3">
                      <p className="ds-caption mb-2 font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                        Dates
                      </p>
                      {selectedRecord.type === "demographics" ? (
                        <>
                          {renderDetailRow("Date of Birth", selectedRecord.record.dateOfBirth)}
                          {renderDetailRow("Extracted At", formatDateTime(selectedRecord.record.extractedAt))}
                        </>
                      ) : (
                        <>
                          {renderDetailRow("Onset Date", selectedRecord.record.onsetDate)}
                          {renderDetailRow("Extracted At", formatDateTime(selectedRecord.record.extractedAt))}
                        </>
                      )}
                    </section>

                    <section className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3">
                      <p className="ds-caption mb-2 font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                        Source
                      </p>
                      {renderDetailRow("Record ID", selectedRecord.record.id)}
                      {renderDetailRow("Source File", selectedRecord.record.sourceFileName)}
                    </section>
                  </div>
                )}
              </div>
            ) : (
              <p className="ds-body text-[var(--text-muted)]">
                Click any record from the demographics or medical history list to view the complete entry.
              </p>
            )}

            <p className="ds-caption mt-3 text-[var(--text-secondary)]">
              Step 1 ingestion and Step 2 NLP querying are independent modules in this hackathon MVP.
            </p>
          </>
        ) : (
          <p className="ds-caption text-[var(--text-secondary)]">
            Click the toggle to view complete record details
          </p>
        )}
      </Card>

      {parseDebug ? (
        <Card className="fade-in-up">
          <details>
            <summary className="ds-body cursor-pointer font-medium text-[var(--text-primary)]">
              Parser Debug Panel
            </summary>
            <div className="mt-3 space-y-3">
              <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                <p className="ds-caption font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                  Parse Summary
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Source File: <span className="ds-body text-[var(--text-primary)]">{parseDebug.sourceFileName}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Parser Mode: <span className="ds-body text-[var(--text-primary)]">{parseDebug.parserMode}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Demographics Rows: <span className="ds-body text-[var(--text-primary)]">{parseDebug.demographicsRows}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Medical Rows: <span className="ds-body text-[var(--text-primary)]">{parseDebug.medicalRows}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Extraction Source: <span className="ds-body text-[var(--text-primary)]">{parseDebug.extractionSource ?? "-"}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Extracted Text Length: <span className="ds-body text-[var(--text-primary)]">{parseDebug.extractedTextLength ?? 0}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Final Parser Text Length: <span className="ds-body text-[var(--text-primary)]">{parseDebug.finalTextLength ?? 0}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Used Gemini Transcription: <span className="ds-body text-[var(--text-primary)]">{parseDebug.usedTranscription ? "Yes" : "No"}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Gemini Failure Reason: <span className="ds-body text-[var(--text-primary)]">{parseDebug.geminiFailureReason ?? "-"}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)]">
                    Transcription Model: <span className="ds-body text-[var(--text-primary)]">{parseDebug.transcriptionModel ?? "-"}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)] md:col-span-2">
                    Extractor Detail: <span className="ds-body text-[var(--text-primary)]">{parseDebug.extractorFailureDetail ?? "-"}</span>
                  </p>
                  <p className="ds-caption text-[var(--text-secondary)] md:col-span-2">
                    Transcription Detail: <span className="ds-body text-[var(--text-primary)]">{parseDebug.transcriptionFailureDetail ?? "-"}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                <p className="ds-caption font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                  Field Completeness Checks
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="ds-caption text-[var(--text-secondary)]">
                    Demographics missing name: <span className="ds-body text-[var(--text-primary)]">{parseDebug.demographicsMissingName}</span>
                  </li>
                  <li className="ds-caption text-[var(--text-secondary)]">
                    Demographics missing gender: <span className="ds-body text-[var(--text-primary)]">{parseDebug.demographicsMissingGender}</span>
                  </li>
                  <li className="ds-caption text-[var(--text-secondary)]">
                    Medical rows missing condition: <span className="ds-body text-[var(--text-primary)]">{parseDebug.medicalMissingCondition}</span>
                  </li>
                  <li className="ds-caption text-[var(--text-secondary)]">
                    Medical rows missing code: <span className="ds-body text-[var(--text-primary)]">{parseDebug.medicalMissingCode}</span>
                  </li>
                </ul>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                  <p className="ds-caption font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                    Mapped Demographics Preview
                  </p>
                  <pre className="mt-2 max-h-[200px] overflow-auto rounded-[var(--ds-radius-sm)] bg-[var(--code-bg)] p-3 text-xs text-[var(--code-fg)]">
{JSON.stringify(parseDebug.previewDemographics ?? null, null, 2)}
                  </pre>
                </div>
                <div className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
                  <p className="ds-caption font-semibold tracking-[0.08em] text-[var(--text-secondary)] uppercase">
                    Mapped Medical Preview
                  </p>
                  <pre className="mt-2 max-h-[200px] overflow-auto rounded-[var(--ds-radius-sm)] bg-[var(--code-bg)] p-3 text-xs text-[var(--code-fg)]">
{JSON.stringify(parseDebug.previewMedical ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </details>
        </Card>
      ) : null}

      <div className="ds-caption flex items-center gap-2 text-[var(--text-secondary)]">
        <FileUp size={14} />
        Ingestion supports multi-format uploads and stores parsed rows locally for demo purposes.
      </div>

      <Card className="fade-in-up">
        <h4 className="ds-body font-semibold text-[var(--text-primary)]">Professional Use Disclaimer</h4>
        <ul className="mt-2 space-y-1">
          <li className="ds-caption text-[var(--text-secondary)]">
            Parsed content may include OCR/model inference errors and should be verified before operational use.
          </li>
          <li className="ds-caption text-[var(--text-secondary)]">
            This MVP stores records in browser-local tables for demo speed, not for production PHI storage.
          </li>
          <li className="ds-caption text-[var(--text-secondary)]">
            Apply enterprise controls for encryption, retention, access, and audit trails in real deployments.
          </li>
        </ul>
      </Card>
    </>
  );
}
