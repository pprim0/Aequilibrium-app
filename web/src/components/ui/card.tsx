import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-md)] border border-border bg-card p-4 shadow-[0_1px_4px_rgb(0_0_0/0.04)]", className)}
      {...props}
    />
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-text">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-text-2">
      <p>{children}</p>
      {action}
    </div>
  );
}
