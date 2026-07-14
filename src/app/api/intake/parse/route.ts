import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { parseTextToRecords } from "@/services/intakeFallbackParser";
import {
  parseFileWithGemini,
  parseTextWithGemini,
  transcribeFileWithGemini,
} from "@/services/intakeGeminiService";
import {
  normalizeAge,
  normalizeDateOfBirth,
  normalizeLocationLabel,
  normalizeZipCode,
} from "@/services/demographics";
import { IntakeParseResponse } from "@/types/intake";

export const runtime = "nodejs";

function decodeAsText(buffer: ArrayBuffer) {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(buffer);
  } catch {
    return "";
  }
}

function decodePdfEscapedString(input: string) {
  let output = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = input[index + 1];
    if (!next) {
      break;
    }

    if (/[0-7]/.test(next)) {
      const octal = input.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
      output += String.fromCharCode(parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    if (next === "n") {
      output += "\n";
      index += 1;
      continue;
    }
    if (next === "r") {
      output += "\r";
      index += 1;
      continue;
    }
    if (next === "t") {
      output += "\t";
      index += 1;
      continue;
    }
    if (next === "b") {
      output += "\b";
      index += 1;
      continue;
    }
    if (next === "f") {
      output += "\f";
      index += 1;
      continue;
    }

    output += next;
    index += 1;
  }

  return output;
}

function extractRawPdfText(buffer: ArrayBuffer) {
  const source = Buffer.from(new Uint8Array(buffer)).toString("latin1");
  const textFragments: string[] = [];

  const pushFragment = (value: string) => {
    const cleaned = decodePdfEscapedString(value)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length >= 2) {
      textFragments.push(cleaned);
    }
  };

  const textObjects = source.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of textObjects) {
    const tjMatches = block.match(/\((?:\\.|[^\\)])*\)\s*Tj/g) ?? [];
    for (const token of tjMatches) {
      const inner = token.match(/\(((?:\\.|[^\\)])*)\)\s*Tj/);
      if (inner?.[1]) {
        pushFragment(inner[1]);
      }
    }

    const tjArrayMatches = block.match(/\[(?:[^\]]|\\\]) *\]\s*TJ/g) ?? [];
    for (const token of tjArrayMatches) {
      const strings = token.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
      for (const wrapped of strings) {
        pushFragment(wrapped.slice(1, -1));
      }
    }
  }

  if (textFragments.length === 0) {
    return "";
  }

  return textFragments.join("\n");
}

function scoreTextQuality(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const printableChars = (trimmed.match(/[\x09\x0A\x0D\x20-\x7E]/g) ?? []).length;
  const printableRatio = printableChars / trimmed.length;
  const keywordHits = (
    trimmed.match(/patient|diagnosis|icd|age|gender|history|medication|lab|result|cholesterol|glucose/gi) ?? []
  ).length;

  let score = printableRatio;
  if (trimmed.length > 80) {
    score += 0.1;
  }
  if (keywordHits > 0) {
    score += Math.min(0.4, keywordHits * 0.05);
  }

  return Math.min(1, score);
}

function shouldTranscribeText(input: {
  text: string;
  extractionSource: string;
  geminiFailedReason?: string;
}) {
  if (!input.text.trim()) {
    return true;
  }

  if (input.extractionSource === "binary-decode") {
    return true;
  }

  if (input.extractionSource === "pdf-no-text") {
    return true;
  }

  if (input.geminiFailedReason === "invalid-json") {
    return true;
  }

  return scoreTextQuality(input.text) < 0.78;
}

async function extractTextForFallback(input: {
  fileName: string;
  fileType: string;
  buffer: ArrayBuffer;
}) {
  const isPdf =
    input.fileType === "application/pdf" || input.fileName.toLowerCase().endsWith(".pdf");

  const lowerName = input.fileName.toLowerCase();
  const isLikelyTextFile =
    input.fileType.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".xml");

  if (!isPdf) {
    if (!isLikelyTextFile) {
      return {
        text: "",
        source: "binary-nontext" as const,
        extractorFailureDetail: "Binary file type needs OCR/transcription (image/video/audio).",
      };
    }

    return {
      text: decodeAsText(input.buffer),
      source: "binary-decode" as const,
      extractorFailureDetail: undefined as string | undefined,
    };
  }

  let extractorFailureDetail: string | undefined;

  try {
    const pdfModule = await import("pdf-parse");
    const pdfBuffer = Buffer.from(new Uint8Array(input.buffer));

    if ("PDFParse" in pdfModule && typeof pdfModule.PDFParse === "function") {
      const parser = new pdfModule.PDFParse({ data: pdfBuffer });
      const result = await parser.getText();
      await parser.destroy();

      if (result.text?.trim()) {
        return {
          text: result.text,
          source: "pdf-parse" as const,
          extractorFailureDetail: undefined,
        };
      }

      extractorFailureDetail = "pdf-parse returned no readable text for this PDF.";
    }

    const defaultExport = (pdfModule as unknown as { default?: unknown }).default;
    if (typeof defaultExport === "function") {
      const legacyResult = await defaultExport(pdfBuffer);
      const text =
        legacyResult &&
        typeof legacyResult === "object" &&
        "text" in (legacyResult as Record<string, unknown>)
          ? String((legacyResult as Record<string, unknown>).text ?? "")
          : "";

      if (text.trim()) {
        return {
          text,
          source: "pdf-parse-legacy" as const,
          extractorFailureDetail: undefined,
        };
      }

      extractorFailureDetail = "pdf-parse legacy parser returned no readable text for this PDF.";
    }
  } catch (cause) {
    extractorFailureDetail =
      cause instanceof Error ? `pdf-parse failed: ${cause.message}` : "pdf-parse failed with unknown error.";
  }

  const rawPdfText = extractRawPdfText(input.buffer);
  if (rawPdfText.trim().length > 40) {
    return {
      text: rawPdfText,
      source: "pdf-raw-text" as const,
      extractorFailureDetail,
    };
  }

  extractorFailureDetail = `${extractorFailureDetail ?? "PDF extraction failed."} Raw PDF text fallback found no meaningful text.`;

  return {
    text: "",
    source: "pdf-no-text" as const,
    extractorFailureDetail,
  };
}

function normalizeResponse(response: IntakeParseResponse): IntakeParseResponse {
  const now = Date.now();

  return {
    ...response,
    demographics: response.demographics.map((item, index) => {
      const dateOfBirth = normalizeDateOfBirth(item.dateOfBirth);
      return {
        ...item,
        id: item.id || `demo-${now}-${index}`,
        age: normalizeAge(item.age, dateOfBirth, now),
        dateOfBirth,
        city: normalizeLocationLabel(item.city),
        state: normalizeLocationLabel(item.state),
        zipcode: normalizeZipCode(item.zipcode),
        ethnicity: normalizeLocationLabel(item.ethnicity),
        race: normalizeLocationLabel(item.race),
        extractedAt: item.extractedAt || now,
      };
    }),
    medicalHistory: response.medicalHistory.map((item, index) => ({
      ...item,
      id: item.id || `med-${now}-${index}`,
      extractedAt: item.extractedAt || now,
    })),
  };
}

type LooseObject = Record<string, unknown>;

function asRecord(value: unknown): LooseObject {
  if (value && typeof value === "object") {
    return value as LooseObject;
  }

  return {};
}

function toArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    return [value];
  }

  return [];
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildKeyIndex(record: LooseObject) {
  const index = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    index.set(normalizeKey(key), value);
  }
  return index;
}

function pickString(record: LooseObject, keys: string[]) {
  const index = buildKeyIndex(record);

  for (const key of keys) {
    const value = index.get(normalizeKey(key));
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function pickNumber(record: LooseObject, keys: string[]) {
  const index = buildKeyIndex(record);

  for (const key of keys) {
    const value = index.get(normalizeKey(key));

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function normalizeGender(input?: string) {
  if (!input) {
    return undefined;
  }

  const lower = input.toLowerCase();
  if (lower.startsWith("m")) {
    return "male" as const;
  }
  if (lower.startsWith("f")) {
    return "female" as const;
  }

  return "other" as const;
}

function normalizeCodeSystem(input?: string) {
  if (!input) {
    return "UNKNOWN" as const;
  }

  const normalized = input.toUpperCase().replace(/[-_\s]/g, "");
  if (normalized.includes("ICD10") || normalized === "ICD") {
    return "ICD10" as const;
  }
  if (normalized.includes("SNOMED")) {
    return "SNOMED" as const;
  }

  return "UNKNOWN" as const;
}

function normalizeGeminiResponse(input: {
  response: IntakeParseResponse;
  sourceFileName: string;
}) {
  const now = Date.now();

  const demographics = toArray(input.response.demographics)
    .map((row, index) => {
      const record = asRecord(row);
      const patientId =
        pickString(record, ["patientId", "patient_id", "mrn", "id"]) ??
        `PT-${now}-${index}`;
      const dateOfBirth = normalizeDateOfBirth(
        pickString(record, ["dateOfBirth", "dob", "birthDate", "birth_date"])
      );

      return {
        id: pickString(record, ["id"]) ?? `demo-${now}-${index}`,
        sourceFileName:
          pickString(record, ["sourceFileName", "source_file_name", "fileName", "source"]) ??
          input.sourceFileName,
        patientId,
        fullName:
          pickString(record, ["fullName", "full_name", "name", "patientName", "patient_name"]) ??
          "Unknown Patient",
        age: normalizeAge(pickNumber(record, ["age"]), dateOfBirth, now),
        gender: normalizeGender(pickString(record, ["gender", "sex"])),
        dateOfBirth,
        city: normalizeLocationLabel(
          pickString(record, ["city", "town", "municipality"])
        ),
        state: normalizeLocationLabel(
          pickString(record, ["state", "province", "region"])
        ),
        zipcode: normalizeZipCode(
          pickString(record, ["zipcode", "zipCode", "zip", "postalCode", "postal_code"])
        ),
        ethnicity: normalizeLocationLabel(
          pickString(record, ["ethnicity", "ethnicGroup", "ethnic_group"])
        ),
        race: normalizeLocationLabel(
          pickString(record, ["race", "racialGroup", "racial_group"])
        ),
        extractedAt: pickNumber(record, ["extractedAt", "extracted_at", "timestamp"]) ?? now,
      };
    })
    .filter((row) =>
      row.fullName !== "Unknown Patient" ||
      row.gender ||
      row.age ||
      row.dateOfBirth ||
      row.city ||
      row.state ||
      row.zipcode ||
      row.ethnicity ||
      row.race
    );

  const medicalHistory = toArray(input.response.medicalHistory)
    .map((row, index) => {
      const record = asRecord(row);

      return {
        id: pickString(record, ["id"]) ?? `med-${now}-${index}`,
        sourceFileName:
          pickString(record, ["sourceFileName", "source_file_name", "fileName", "source"]) ??
          input.sourceFileName,
        patientId:
          pickString(record, ["patientId", "patient_id", "mrn", "id"]) ??
          demographics[0]?.patientId ??
          `PT-${now}`,
        condition:
          pickString(record, [
            "condition",
            "diagnosis",
            "medicalCondition",
            "medical_condition",
            "disease",
          ]) ??
          "Unspecified condition",
        codeSystem: normalizeCodeSystem(
          pickString(record, [
            "codeSystem",
            "code_system",
            "codingSystem",
            "coding_system",
            "system",
          ])
        ),
        code:
          pickString(record, [
            "code",
            "icdCode",
            "icd_code",
            "icd10",
            "icd10code",
            "snomedCode",
            "snomed_code",
          ]) ?? "N/A",
        note: pickString(record, ["note", "status", "comment"]),
        onsetDate: pickString(record, ["onsetDate", "onset_date", "diagnosedDate", "diagnosed_date"]),
        extractedAt: pickNumber(record, ["extractedAt", "extracted_at", "timestamp"]) ?? now,
      };
    });

  return {
    ...input.response,
    demographics,
    medicalHistory,
  } satisfies IntakeParseResponse;
}

function buildFallbackResponse(input: {
  text: string;
  sourceFileName: string;
  statusDetail: string;
  parseMeta?: IntakeParseResponse["parseMeta"];
}): IntakeParseResponse {
  const fallback = parseTextToRecords({
    text: input.text,
    sourceFileName: input.sourceFileName,
  });

  return {
    ...fallback,
    parserMode: "fallback",
    statusLabel: "Fallback Parser",
    statusDetail: input.statusDetail,
    parseMeta: input.parseMeta,
  };
}

export async function POST(request: NextRequest) {
  try {

    const form = await request.formData();
    const filePart = form.get("file");
    const manualTextPart = form.get("manualText");
    const manualText = typeof manualTextPart === "string" ? manualTextPart.trim() : "";

    const isFileLike =
      !!filePart &&
      typeof filePart === "object" &&
      "arrayBuffer" in filePart &&
      "name" in filePart;

    if (!isFileLike && manualText) {
      return NextResponse.json(
        buildFallbackResponse({
          text: manualText,
          sourceFileName: "Manual Parsed Text",
          statusDetail: "Parsed from pasted text input using deterministic fallback parser.",
          parseMeta: {
            extractionSource: "manual-text",
            extractedTextLength: manualText.length,
            finalTextLength: manualText.length,
            usedTranscription: false,
          },
        })
      );
    }

    if (!isFileLike) {
      return NextResponse.json(
        {
          demographics: [],
          medicalHistory: [],
          parserMode: "fallback",
          statusLabel: "No File Detected",
          statusDetail: "The upload payload did not include a valid file object.",
        } satisfies IntakeParseResponse,
        { status: 200 }
      );
    }

    const file = filePart as File;

    const buffer = await file.arrayBuffer();
    const extracted = await extractTextForFallback({
      fileName: file.name,
      fileType: file.type,
      buffer,
    });
    const extractedText = extracted.text;
    const base64Data = Buffer.from(new Uint8Array(buffer)).toString("base64");
    let text = manualText || extractedText.trim();
    let parseMeta: IntakeParseResponse["parseMeta"] = {
      extractionSource: manualText ? "manual-text" : extracted.source,
      extractedTextLength: extractedText.trim().length,
      finalTextLength: text.length,
      usedTranscription: false,
      extractorFailureDetail: extracted.extractorFailureDetail,
    };

    let gemini: Awaited<ReturnType<typeof parseFileWithGemini>> | null = null;

    try {
      gemini = await parseFileWithGemini({
        fileName: file.name,
        fileType: file.type,
        base64Data,
      });
    } catch (cause) {
      gemini = null;
      parseMeta = {
        ...parseMeta,
        geminiFailureReason: "request-exception",
        transcriptionFailureDetail:
          cause instanceof Error
            ? `Gemini file parse request failed: ${cause.message}`
            : "Gemini file parse request failed.",
      };
    }

    if (gemini?.ok) {
      const normalizedGemini = normalizeGeminiResponse({
        response: {
          demographics: gemini.parsed.demographics,
          medicalHistory: gemini.parsed.medicalHistory,
          parserMode: "gemini",
          statusLabel: "Gemini Parser Active",
          statusDetail: `Parsed with ${gemini.model}. Data stored in demographics and medical history tables.`,
          parseMeta,
        },
        sourceFileName: file.name,
      });

      const hasCoreData =
        normalizedGemini.demographics.length > 0 || normalizedGemini.medicalHistory.length > 0;

      if (!hasCoreData) {
        const fallbackAfterGemini = buildFallbackResponse({
          text,
          sourceFileName: file.name,
          statusDetail:
            "Gemini responded but fields were incomplete after normalization. Used local fallback parser to populate tables.",
          parseMeta,
        });

        return NextResponse.json(fallbackAfterGemini);
      }

      const normalized = normalizeResponse(normalizedGemini);
      return NextResponse.json(normalized);
    }

    parseMeta = {
      ...parseMeta,
      geminiFailureReason: gemini && !gemini.ok ? gemini.reason : undefined,
    };

    if (
      shouldTranscribeText({
        text,
        extractionSource: parseMeta.extractionSource ?? extracted.source,
        geminiFailedReason: gemini && !gemini.ok ? gemini.reason : undefined,
      })
    ) {
      try {
        const transcription = await transcribeFileWithGemini({
          fileName: file.name,
          fileType: file.type,
          base64Data,
        });

        if (transcription.ok) {
          text = transcription.text;
          parseMeta = {
            ...parseMeta,
            extractionSource: "gemini-transcription",
            finalTextLength: text.length,
            usedTranscription: true,
            transcriptionModel: transcription.model,
          };

          try {
            const structuredFromText = await parseTextWithGemini({
              fileName: file.name,
              text,
            });

            if (structuredFromText.ok) {
              const normalizedFromText = normalizeGeminiResponse({
                response: {
                  demographics: structuredFromText.parsed.demographics,
                  medicalHistory: structuredFromText.parsed.medicalHistory,
                  parserMode: "gemini",
                  statusLabel: "Gemini Parser Active",
                  statusDetail:
                    `Initial structured parse failed, but ${structuredFromText.model} converted transcription into structured JSON and saved table rows.`,
                  parseMeta,
                },
                sourceFileName: file.name,
              });

              const hasCoreData =
                normalizedFromText.demographics.length > 0 ||
                normalizedFromText.medicalHistory.length > 0;

              if (hasCoreData) {
                const normalized = normalizeResponse(normalizedFromText);
              return NextResponse.json(normalized);
              }
            } else {
              parseMeta = {
                ...parseMeta,
                geminiFailureReason: structuredFromText.reason,
              };
            }
          } catch {
            // Continue to fallback parser when text-to-JSON structuring fails.
          }

          const ocrFallbackResponse = buildFallbackResponse({
            text,
            sourceFileName: file.name,
            statusDetail:
              `Gemini structured parsing was unavailable, but ${transcription.model} extracted readable text. Used local parser on Gemini transcription and saved table rows.`,
            parseMeta,
          });

          return NextResponse.json(ocrFallbackResponse);
        }

        parseMeta = {
          ...parseMeta,
          geminiFailureReason: transcription.reason,
          transcriptionFailureDetail: transcription.detail,
        };
      } catch (cause) {
        parseMeta = {
          ...parseMeta,
          geminiFailureReason: "request-exception",
          transcriptionFailureDetail:
            cause instanceof Error
              ? `Gemini transcription request failed: ${cause.message}`
              : "Gemini transcription request failed.",
        };
      }
    }

    const noReadableTextFromBinarySource =
      !text.trim() &&
      (parseMeta.extractionSource === "binary-nontext" || parseMeta.extractionSource === "pdf-no-text");

    if (noReadableTextFromBinarySource) {
      return NextResponse.json({
        demographics: [],
        medicalHistory: [],
        parserMode: "fallback",
        statusLabel: "Transcription Unavailable",
        statusDetail:
          parseMeta.transcriptionFailureDetail ??
          "No readable text could be extracted from this file in the current environment. Paste parsed text and retry.",
        parseMeta: {
          ...parseMeta,
          finalTextLength: 0,
        },
      } satisfies IntakeParseResponse);
    }

    const fallbackResponse = buildFallbackResponse({
      text,
      sourceFileName: file.name,
      statusDetail: text
        ? gemini && !gemini.ok
          ? `Gemini unavailable: ${gemini.detail} Used local fallback parser with ${parseMeta.extractionSource ?? extracted.source} and saved table rows.`
          : `Gemini unavailable or unsupported file parsing response. Used local fallback parser with ${parseMeta.extractionSource ?? extracted.source} and saved table rows.`
        : gemini && !gemini.ok
          ? `Gemini unavailable: ${gemini.detail} No readable text was extracted from file. Paste parsed text in the optional box and retry.`
          : "No readable text was extracted from file. Paste parsed text in the optional box and retry.",
      parseMeta: {
        ...parseMeta,
        finalTextLength: text.length,
      },
    });

    return NextResponse.json(fallbackResponse);
  } catch (error) {
    throw error;
  }
}
