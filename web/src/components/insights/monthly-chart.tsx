"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, monthLabel } from "@/lib/format";
import type { MonthHistory } from "@/lib/types";
import { t } from "@/i18n";

type Point = { label: string; fixed: number; variable: number };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: Point }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-bold">{point.label}</p>
      <p className="tabular flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm bg-series-2" />
        {t.insights.variable}: {formatMoney(point.variable)}
      </p>
      <p className="tabular flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm bg-series-1" />
        {t.insights.fixed}: {formatMoney(point.fixed)}
      </p>
      <p className="tabular mt-1 font-semibold">
        {t.insights.total}: {formatMoney(point.fixed + point.variable)}
      </p>
    </div>
  );
}

// Stacked bars with a surface-coloured gap between segments; one axis, recessive grid.
export function MonthlyChart({ history }: { history: MonthHistory[] }) {
  const data: Point[] = history.map((h) => ({
    label: monthLabel(h.month_key),
    fixed: Number(h.fixed_expenses),
    variable: Number(h.variable_expenses),
  }));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-text-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-series-1" /> {t.insights.fixed}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-series-2" /> {t.insights.variable}
        </span>
      </div>
      <div className="h-56 w-full" role="img" aria-label={t.insights.monthlyChart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="35%" maxBarSize={48}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
            <YAxis
              width={60}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-2)", fontSize: 12 }}
              tickFormatter={(v: number) => `${Math.round(v)} €`}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="fixed" stackId="a" fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} isAnimationActive={false} />
            <Bar dataKey="variable" stackId="a" fill="var(--series-2)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
