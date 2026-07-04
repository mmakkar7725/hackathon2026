import { Card } from "@/components/ui/card";

interface QueryExplanationProps {
  steps: string[];
  aiExplanation: string;
}

export function QueryExplanation({ steps, aiExplanation }: QueryExplanationProps) {
  return (
    <Card>
      <h3 className="ds-h1 mb-3 text-[18px] text-[var(--text-primary)]">Query Explanation</h3>
      <ol className="space-y-2 ds-body text-[var(--text-secondary)]">
        {steps.map((step, index) => (
          <li key={`${step}-${index}`} className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-1)] px-3 py-2.5">
            <span className="mr-2 font-semibold text-[var(--brand-700)]">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="ds-body mt-4 rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-1)] p-3 text-[var(--text-secondary)]">
        {aiExplanation}
      </p>
    </Card>
  );
}
