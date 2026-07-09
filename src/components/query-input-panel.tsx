"use client";

import { AlertCircle, Mic, MicOff, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AmbiguityDetection, AmbiguityResolution } from "@/types/medical";

interface QueryInputPanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmitAndExecute: () => void;
  isTranslating: boolean;
  isExecuting: boolean;
  useGeminiAssist: boolean;
  onGeminiToggle: (value: boolean) => void;
  isListening: boolean;
  isSpeechSupported: boolean;
  onStartVoice: () => void;
  onAmbiguitiesChange?: (ambiguities: AmbiguityDetection[] | null) => void;
}

export function QueryInputPanel({
  prompt,
  onPromptChange,
  onSubmitAndExecute,
  isTranslating,
  isExecuting,
  useGeminiAssist,
  onGeminiToggle,
  isListening,
  isSpeechSupported,
  onStartVoice,
  onAmbiguitiesChange,
}: QueryInputPanelProps) {
  const isBusy = isTranslating || isExecuting;
  const [ambiguities, setAmbiguities] = useState<AmbiguityResolution | null>(null);
  const [isDetectingAmbiguities, setIsDetectingAmbiguities] = useState(false);
  const [showAmbiguities, setShowAmbiguities] = useState(true);
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Debounce ambiguity detection
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }

    if (!prompt.trim() || !useGeminiAssist) {
      setAmbiguities(null);
      onAmbiguitiesChange?.(null);
      return;
    }

    setIsDetectingAmbiguities(true);
    detectionTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/detect-ambiguities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        });

        if (!response.ok) {
          setAmbiguities(null);
          onAmbiguitiesChange?.(null);
          return;
        }

        const result = (await response.json()) as AmbiguityResolution;
        setAmbiguities(result);
        onAmbiguitiesChange?.(result.hasAmbiguities ? result.ambiguities : null);
      } catch {
        setAmbiguities(null);
        onAmbiguitiesChange?.(null);
      } finally {
        setIsDetectingAmbiguities(false);
      }
    }, 800);

    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, [prompt, useGeminiAssist, onAmbiguitiesChange]);

  const handleInterpretationSelect = useCallback(
    (ambigIdx: number, interpretationIdx: number) => {
      setAmbiguities((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ambiguities: prev.ambiguities.map((ambig, idx) =>
            idx === ambigIdx ? { ...ambig, selectedInterpretationIndex: interpretationIdx } : ambig
          ),
        };
        return updated;
      });
    },
    []
  );

  return (
    <Card>
      <h2 className="ds-h1 mb-2 text-[var(--text-primary)]">
        Natural Language to Clinical SQL
      </h2>
      <p className="ds-body mb-4 text-[var(--text-secondary)]">
        Enter a clinical question and EligibilityAI will identify coded medical concepts, apply trial filters,
        and generate SQL to find eligible patients.
      </p>

      <Textarea
        placeholder="Example: Show diabetic patients above 60 years with hypertension diagnosed in the last year"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
      />

      {ambiguities?.hasAmbiguities && (
        <div className="mt-3 rounded-[var(--ds-radius-sm)] border border-amber-200 bg-amber-50 p-3">
          <button
            type="button"
            onClick={() => setShowAmbiguities(!showAmbiguities)}
            className="flex w-full items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-700" />
              <p className="ds-body font-semibold text-amber-900">
                {ambiguities.ambiguities.length} Ambiguit{ambiguities.ambiguities.length === 1 ? "y" : "ies"} Detected
              </p>
            </div>
            {showAmbiguities ? (
              <ChevronUp size={16} className="text-amber-700" />
            ) : (
              <ChevronDown size={16} className="text-amber-700" />
            )}
          </button>

          {showAmbiguities && (
            <div className="mt-2 space-y-2">
              {ambiguities.ambiguities.map((ambig, ambigIdx) => (
                <div key={ambig.id} className="rounded-[var(--ds-radius-sm)] border border-amber-100 bg-white p-2">
                  <p className="ds-caption font-medium text-amber-900">
                    &quot;{ambig.fragment}&quot; ({ambig.type.replace("-", " ")})
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {ambig.interpretations.map((interp, interpIdx) => (
                      <label
                        key={interpIdx}
                        className="flex items-start gap-2 rounded p-1 hover:bg-amber-100"
                      >
                        <input
                          type="radio"
                          name={`ambig-${ambig.id}`}
                          checked={ambig.selectedInterpretationIndex === interpIdx}
                          onChange={() => handleInterpretationSelect(ambigIdx, interpIdx)}
                          className="mt-0.5 accent-amber-600"
                        />
                        <div className="flex-1">
                          <p className="ds-caption font-medium text-gray-900">{interp.option}</p>
                          <p className="ds-caption text-gray-600">
                            {interp.explanation}
                            <span className={`ml-1 inline-block rounded px-1 text-[11px] font-semibold ${
                              interp.likelihood === "high"
                                ? "bg-green-100 text-green-700"
                                : interp.likelihood === "medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}>
                              {interp.likelihood}
                            </span>
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSubmitAndExecute();
          }}
          size="lg"
          disabled={!prompt.trim() || isBusy}
        >
          <PlayCircle size={16} />
          {isExecuting ? "Running pipeline..." : "Translate & Execute"}
        </Button>

        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStartVoice();
          }}
          variant="secondary"
          size="lg"
          disabled={!isSpeechSupported || isBusy}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening ? "Listening..." : "Voice Input"}
        </Button>

        {isDetectingAmbiguities && (
          <p className="ds-caption text-[var(--text-muted)]">Analyzing query...</p>
        )}
      </div>
      <p className="ds-caption mt-2 text-[var(--text-muted)]">
        Translates your clinical question to SQL and immediately runs it against ingested Step 1 patient data.
      </p>

      <label className="ds-body mt-4 flex items-center gap-2 text-[var(--text-secondary)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--brand-600)]"
          checked={useGeminiAssist}
          onChange={(event) => {
            event.preventDefault();
            onGeminiToggle(event.target.checked);
          }}
          disabled={isTranslating}
        />
        Enable Gemini Assist (fallbacks to deterministic if unavailable)
      </label>
    </Card>
  );
}
