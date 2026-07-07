import { NextRequest, NextResponse } from "next/server";

import { detectAmbiguitiesWithGemini } from "@/services/geminiService";

interface DetectAmbiguitiesRequest {
  prompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetectAmbiguitiesRequest;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const result = await detectAmbiguitiesWithGemini({ prompt });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to detect ambiguities." }, { status: 500 });
  }
}
