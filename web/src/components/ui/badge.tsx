import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "success" | "warning" | "orange" | "error" | "info" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-text-2",
  success: "bg-primary-pale text-success",
  warning: "bg-warning-pale text-warning",
  orange: "bg-orange-pale text-orange",
  error: "bg-error-pale text-error",
  info: "bg-info-pale text-info",
  muted: "bg-muted text-text-3",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
