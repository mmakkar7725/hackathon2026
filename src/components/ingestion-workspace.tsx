"use client";

import { FileUp, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appendToTables, clearTables, readTables } from "@/services/localTables";
import { DemographicsRecord, IntakeParseResponse, MedicalHistoryRecord } from "@/types/intake";

type SelectedRecord =
  | { type: "demographics"; record: DemographicsRecord }
  | { type: "medical"; record: MedicalHistoryRecord }
  | null;

export function IngestionWorkspace() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
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
    previewDemographics?: DemographicsRecord;
    previewMedical?: MedicalHistoryRecord;
  } | null>(null);
  const [tables, setTables] = useState(() => readTables());

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) {
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

  const onParseFile = async () => {
    if (!selectedFile) {
      setError("Please choose a file first.");
      return;
    }

    setError(null);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

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
        throw new Error(payload?.error || "Invalid parser response.");
      }

      if (!response.ok) {
        throw new Error(payload.error || "Parser endpoint returned an error status.");
      }

      const safePayload = payload as IntakeParseResponse;
      appendToTables({
        demographics: safePayload.demographics,
        medicalHistory: safePayload.medicalHistory,
      });

      setParseDebug({
        sourceFileName: selectedFile.name,
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
        previewDemographics: safePayload.demographics[0],
        previewMedical: safePayload.medicalHistory[0],
      });

      setStatusLabel(safePayload.statusLabel);
      setStatusDetail(safePayload.statusDetail);
      setTables(readTables());
      setSelectedFile(null);
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

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full">
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              disabled={isParsing}
              className="file-input-accent ds-body block w-full rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-3 py-2"
            />
            <p className="ds-caption mt-2 inline-flex rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-secondary)]">
              {selectedFile
                ? `Selected: ${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`
                : "No file chosen"}
            </p>
            {isParsing ? (
              <div className="mt-3 rounded-[var(--ds-radius-sm)] border border-[var(--brand-400)] bg-[var(--surface-1)] p-2">
                <p className="ds-caption text-[var(--brand-700)]">Parsing in progress, extracting clinical entities...</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--brand-500)]" />
                </div>
              </div>
            ) : null}
          </div>
          <Button onClick={onParseFile} disabled={isParsing || !selectedFile}>
            {isParsing ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
            {isParsing ? "Parsing..." : "Parse and Save"}
          </Button>
        </div>

        {error ? <p className="ds-body mt-3 text-rose-700">{error}</p> : null}
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
              tables.demographics.map((row) => (
                <li key={row.id}>
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
              tables.medicalHistory.map((row) => (
                <li key={row.id}>
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
          <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Complete Record Viewer</h3>
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
