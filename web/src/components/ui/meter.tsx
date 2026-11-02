import { cn } from "@/lib/cn";

export type MeterLevel = "none" | "ok" | "yellow" | "orange" | "red" | "progress";

const fills: Record<MeterLevel, string> = {
  none: "bg-text-3",
  ok: "bg-success",
  yellow: "bg-warning",
  orange: "bg-orange",
  red: "bg-error",
  progress: "bg-primary",
};

// A bar never decides alone: callers show the value and, for alerts, the level in words.
export function Meter({ value, level = "progress", label }: { value: number | null; level?: MeterLevel; label: string }) {
  const pct = value === null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", fills[level])} style={{ width: `${pct}%` }} />
    </div>
  );
}
