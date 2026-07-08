import { NextRequest, NextResponse } from "next/server";

import { detectAmbiguitiesWithGemini } from "@/services/geminiService";
import { agentActivityStore } from "@/store/agentActivityStore";

interface DetectAmbiguitiesRequest {
  prompt?: string;
}

export async function POST(request: NextRequest) {
  const agentName = "NLPAgent";
  
  try {
    const body = (await request.json()) as DetectAmbiguitiesRequest;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    // Track agent activity
    agentActivityStore.startAgent(agentName, "Detecting ambiguities in query");
    agentActivityStore.updateProgress(agentName, 25, { stage: "parsing" });

    const result = await detectAmbiguitiesWithGemini({ prompt });
    
    agentActivityStore.updateProgress(agentName, 75, { stage: "analyzing" });
    agentActivityStore.completeAgent(agentName, {
      ambiguities: result.ambiguities.length,
      hasAmbiguities: result.hasAmbiguities,
    });

    return NextResponse.json(result);
  } catch (error) {
    agentActivityStore.errorAgent(
      agentName,
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json({ error: "Unable to detect ambiguities." }, { status: 500 });
  }
}
