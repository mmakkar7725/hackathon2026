import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "ds-body min-h-[168px] w-full rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] px-4 py-3 text-[var(--text-primary)] shadow-[var(--ds-elevation-1)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
