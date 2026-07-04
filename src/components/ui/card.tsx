import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--border)] bg-[var(--surface-0)] p-5 shadow-[var(--ds-elevation-2)]",
        className
      )}
      {...props}
    />
  );
}
