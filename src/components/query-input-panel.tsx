"use client";

import { Mic, MicOff, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

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
}: QueryInputPanelProps) {
  const isBusy = isTranslating || isExecuting;
  return (
    <Card>
      <h2 className="ds-h1 mb-2 text-[var(--text-primary)]">
        Natural Language to Clinical SQL
      </h2>
      <p className="ds-body mb-4 text-[var(--text-secondary)]">
        Enter a clinical question and MedQuery AI will identify coded medical concepts, derive filters,
        and generate explainable SQL.
      </p>

      <Textarea
        placeholder="Example: Show diabetic patients above 60 years with hypertension diagnosed in the last year"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button onClick={onSubmitAndExecute} size="lg" disabled={!prompt.trim() || isBusy}>
          <PlayCircle size={16} />
          {isExecuting ? "Running pipeline..." : "Translate & Execute"}
        </Button>

        <Button
          onClick={onStartVoice}
          variant="secondary"
          size="lg"
          disabled={!isSpeechSupported || isBusy}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening ? "Listening..." : "Voice Input"}
        </Button>
      </div>
      <p className="ds-caption mt-2 text-[var(--text-muted)]">
        Translates your clinical question to SQL and immediately runs it against ingested Step 1 patient data.
      </p>

      <label className="ds-body mt-4 flex items-center gap-2 text-[var(--text-secondary)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--brand-600)]"
          checked={useGeminiAssist}
          onChange={(event) => onGeminiToggle(event.target.checked)}
          disabled={isTranslating}
        />
        Enable Gemini Assist (fallbacks to deterministic if unavailable)
      </label>
    </Card>
  );
}
