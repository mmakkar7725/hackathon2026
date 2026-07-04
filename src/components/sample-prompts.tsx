import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SamplePromptsProps {
  prompts: string[];
  onPick: (prompt: string) => void;
}

export function SamplePrompts({ prompts, onPick }: SamplePromptsProps) {
  return (
    <div>
      <p className="ds-body mb-2 flex items-center gap-1 font-medium text-[var(--text-secondary)]">
        <Sparkles size={14} /> Sample prompts
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="secondary"
            size="sm"
            className="rounded-[var(--ds-radius-sm)]"
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
