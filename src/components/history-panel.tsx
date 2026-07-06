import { Clock3, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QueryResult } from "@/types/medical";

interface HistoryPanelProps {
  history: QueryResult[];
  onLoad: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onLoad, onClear }: HistoryPanelProps) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Recent Queries</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 size={14} /> Clear
        </Button>
      </div>

      {history.length === 0 ? (
        <p className="ds-body text-[var(--text-muted)]">Your translated queries will appear here.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onLoad(item.id)}
                className="w-full rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-3 py-2.5 text-left transition hover:border-[var(--brand-400)]"
              >
                <p className="ds-body line-clamp-1 font-medium text-[var(--text-primary)]">{item.input}</p>
                <p className="ds-caption mt-1 flex items-center gap-1 text-[var(--text-muted)]">
                  <Clock3 size={12} />
                  <span suppressHydrationWarning>{new Date(item.timestamp).toLocaleString()}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
