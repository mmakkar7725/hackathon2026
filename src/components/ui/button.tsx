import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--ds-radius-sm)] border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "border-[#35792a] bg-[#35792a] text-white hover:bg-[#175b23] focus-visible:ring-[#95c58e] shadow-[var(--ds-elevation-1)] hover:shadow-[var(--ds-elevation-2)]",
        secondary:
          "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] focus-visible:ring-[#35792a] shadow-[var(--ds-elevation-1)]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] focus-visible:ring-[#35792a]",
        danger:
          "border-[#ef4444] bg-[#ef4444] text-white hover:bg-[#dc2626] focus-visible:ring-[#ef4444]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-10 px-5 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
