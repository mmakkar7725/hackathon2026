import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExtractedMedicalConcept } from "@/types/medical";

interface MedicalConceptsPanelProps {
  concepts: ExtractedMedicalConcept[];
  confidenceScore: number;
}

export function MedicalConceptsPanel({
  concepts,
  confidenceScore,
}: MedicalConceptsPanelProps) {
  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Medical Concepts</h3>
        <Badge tone={confidenceScore > 0.75 ? "success" : "warn"}>
          Confidence {Math.round(confidenceScore * 100)}%
        </Badge>
      </div>

      {concepts.length === 0 ? (
        <p className="ds-body text-[var(--text-muted)]">
          No coded concepts detected yet. Try terms like diabetes, hypertension, or asthma.
        </p>
      ) : (
        <ul className="space-y-3">
          {concepts.map((concept) => (
            <li
              key={concept.id}
              className="rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="ds-body font-medium text-[var(--text-primary)]">{concept.canonicalName}</p>
                <Badge>{concept.codingSystem}</Badge>
              </div>
              <p className="ds-body mt-1 text-[var(--text-secondary)]">
                {concept.codingSystem}: {concept.code}
              </p>
              <p className="ds-caption text-[var(--text-muted)]">
                Matched: &quot;{concept.sourceFragment}&quot; · confidence {Math.round(concept.confidence * 100)}%
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
