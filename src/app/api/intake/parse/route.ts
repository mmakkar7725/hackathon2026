import { NextRequest, NextResponse } from "next/server";

import { parseTextToRecords } from "@/services/intakeFallbackParser";
import { parseFileWithGemini } from "@/services/intakeGeminiService";
import { IntakeParseResponse } from "@/types/intake";

function decodeAsText(buffer: ArrayBuffer) {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(buffer);
  } catch {
    return "";
  }
}

function normalizeResponse(response: IntakeParseResponse): IntakeParseResponse {
  const now = Date.now();

  return {
    ...response,
    demographics: response.demographics.map((item, index) => ({
      ...item,
      id: item.id || `demo-${now}-${index}`,
      extractedAt: item.extractedAt || now,
    })),
    medicalHistory: response.medicalHistory.map((item, index) => ({
      ...item,
      id: item.id || `med-${now}-${index}`,
      extractedAt: item.extractedAt || now,
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    const gemini = await parseFileWithGemini({
      fileName: file.name,
      fileType: file.type,
      base64Data,
    });

    if (gemini) {
      const normalized = normalizeResponse({
        demographics: gemini.parsed.demographics,
        medicalHistory: gemini.parsed.medicalHistory,
        parserMode: "gemini",
        statusLabel: "Gemini Parser Active",
        statusDetail: `Parsed with ${gemini.model}. Data stored in demographics and medical history tables.`,
      });
      return NextResponse.json(normalized);
    }

    const text = decodeAsText(buffer);
    const fallback = parseTextToRecords({
      text,
      sourceFileName: file.name,
    });

    return NextResponse.json({
      ...fallback,
      parserMode: "fallback",
      statusLabel: "Fallback Parser",
      statusDetail:
        "Gemini unavailable or unsupported file parsing response. Used text-based fallback parser and saved table rows.",
    } satisfies IntakeParseResponse);
  } catch {
    return NextResponse.json(
      { error: "Unable to parse uploaded file. Please try another file." },
      { status: 500 }
    );
  }
}
