import { NextResponse } from "next/server";

function normalizeDetail(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 260);
}

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const normalizedModel = model.startsWith("models/") ? model : `models/${model}`;
    const allowInsecureTls = process.env.GEMINI_ALLOW_INSECURE_TLS === "true";

    if (allowInsecureTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          status: "missing-api-key",
          detail: "GOOGLE_GEMINI_API_KEY is missing.",
          checkedAt: Date.now(),
        },
        { status: 200 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/${normalizedModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Return only the word OK." }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8,
        },
      }),
    });

    if (!response.ok) {
      const raw = normalizeDetail(await response.text().catch(() => ""));
      return NextResponse.json(
        {
          ok: false,
          status: "http-error",
          detail: `Gemini endpoint returned HTTP ${response.status}. ${raw || "No response body."}`,
          checkedAt: Date.now(),
        },
        { status: 200 }
      );
    }

    try {
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      return NextResponse.json(
        {
          ok: true,
          status: "connected",
          detail: text ? `Gemini reachable. Sample response: ${normalizeDetail(text)}` : "Gemini reachable.",
          checkedAt: Date.now(),
        },
        { status: 200 }
      );
    } catch {
      const raw = normalizeDetail(await response.text().catch(() => ""));
      const likelyPortal = /<html|window\.location|fgtauth|login|signin/i.test(raw);

      return NextResponse.json(
        {
          ok: false,
          status: likelyPortal ? "network-redirect" : "non-json",
          detail: likelyPortal
            ? `Network proxy/captive portal intercepted Gemini request: ${raw || "HTML response detected."}`
            : `Gemini returned non-JSON response: ${raw || "Unable to parse body."}`,
          checkedAt: Date.now(),
        },
        { status: 200 }
      );
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unknown connectivity error.";

    return NextResponse.json(
      {
        ok: false,
        status: "request-failed",
        detail,
        checkedAt: Date.now(),
      },
      { status: 200 }
    );
  }
}
