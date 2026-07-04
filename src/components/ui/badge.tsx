import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "success" | "warn";
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "ds-caption inline-flex items-center rounded-[var(--ds-radius-sm)] border px-2.5 py-1 font-medium",
        tone === "neutral" &&
          "border-[color:var(--ds-color-blue-100)] bg-[color:var(--ds-color-blue-50)] text-[color:var(--ds-color-blue-700)]",
        tone === "success" &&
          "border-[color:var(--ds-color-green-100)] bg-[color:var(--ds-color-green-50)] text-[color:var(--ds-color-green-700)]",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
        className
      )}
      {...props}
    />
  );
}
