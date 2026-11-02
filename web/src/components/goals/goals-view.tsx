import { Badge, type Tone } from "@/components/ui/badge";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { AssetDialog, GoalDialog, ValuationDialog } from "./goal-forms";
import { formatDate, formatMoney, monthLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { GoalHistory, GoalProgress, GoalRow, InvestmentSummary } from "@/lib/types";
import { t } from "@/i18n";

const statusTone: Record<string, Tone> = {
  no_category: "warning",
  no_target: "warning",
  reached: "success",
  overdue: "error",
  in_progress: "info",
};

function percent(value: number | string | null) {
  return value === null ? t.common.none : `${Math.round(Number(value) * 100)}%`;
}

function signedMoney(value: number | string) {
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${formatMoney(n)}`;
}

export function GoalsView({
  goals,
  rows,
  history,
  investments,
  today,
}: {
  goals: GoalProgress[];
  rows: GoalRow[];
  history: Record<string, GoalHistory[]>;
  investments: InvestmentSummary[];
  today: string;
}) {
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const totalDeposited = investments.reduce((s, i) => s + Number(i.deposited), 0);
  const valued = investments.filter((i) => i.current_value !== null);
  const totalGain = valued.reduce((s, i) => s + Number(i.gain), 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold">{t.goals.title}</h1>

      <section aria-labelledby="sec-goals">
        <SectionTitle action={<GoalDialog />}>
          <span id="sec-goals">{t.goals.goals}</span>
        </SectionTitle>
        {goals.length === 0 ? (
          <EmptyState>{t.goals.empty}</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {goals.map((g) => (
              <Card key={g.goal_id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold">{g.name}</h3>
                    <p className="text-xs text-text-3">
                      {rowById.get(g.goal_id)?.target_type === "formula" ? t.goals.formulaTarget : t.goals.target}
                      {g.target_date && ` · ${formatDate(g.target_date)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone={statusTone[g.status]}>{t.goals.status[g.status]}</Badge>
                    {rowById.get(g.goal_id) && <GoalDialog goal={rowById.get(g.goal_id)} />}
                  </div>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="tabular text-2xl font-extrabold">{formatMoney(g.saved)}</p>
                  <p className="tabular text-sm text-text-2">
                    {percent(g.progress)} · {formatMoney(g.target)}
                  </p>
                </div>
                <Meter value={g.progress === null ? null : Number(g.progress)} label={g.name} />
                <p className="text-xs text-text-2">
                  {t.goals.remaining}: <span className="tabular font-semibold">{formatMoney(g.remaining)}</span> · {t.goals.howToDeposit}
                </p>

                {g.milestones.length > 0 && Number(g.target) > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold text-text-2">{t.goals.milestones}</h4>
                    <ul className="grid gap-1 text-sm sm:grid-cols-2">
                      {g.milestones.map((m) => (
                        <li key={m.pct} className={cn("flex justify-between gap-2", !m.reached_on && "text-text-3")}>
                          <span className="tabular">
                            {Math.round(m.pct * 100)}% · {formatMoney(m.amount)}
                          </span>
                          <span className="text-xs">{m.reached_on ? `✓ ${t.goals.reachedOn(formatDate(m.reached_on))}` : t.goals.notReached}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(history[g.goal_id]?.length ?? 0) > 0 && (
                  <details>
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.goals.history}</summary>
                    <div className="overflow-x-auto">
                      <table className="tabular w-full text-sm">
                        <thead className="text-left text-xs text-text-3">
                          <tr>
                            <th scope="col" className="py-1 font-semibold">{t.goals.month}</th>
                            <th scope="col" className="py-1 text-right font-semibold">{t.goals.deposited}</th>
                            <th scope="col" className="py-1 text-right font-semibold">{t.goals.saved}</th>
                            <th scope="col" className="py-1 text-right font-semibold">{t.goals.ofTarget}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {history[g.goal_id].map((h) => (
                            <tr key={h.month_key}>
                              <td className="py-1.5">{monthLabel(h.month_key)}</td>
                              <td className="py-1.5 text-right">{formatMoney(h.deposited)}</td>
                              <td className="py-1.5 text-right">{formatMoney(h.accumulated)}</td>
                              <td className="py-1.5 text-right">{percent(h.progress)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sec-investments">
        <SectionTitle action={<AssetDialog />}>
          <span id="sec-investments">{t.goals.investments}</span>
        </SectionTitle>
        {investments.length === 0 ? (
          <EmptyState>{t.goals.noInvestments}</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {valued.length > 0 && totalDeposited > 0 && (
              <Card className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-text-2">{t.goals.gain}</p>
                <p className={cn("tabular text-2xl font-extrabold", totalGain < 0 ? "text-error" : "text-success")}>{signedMoney(totalGain)}</p>
              </Card>
            )}
            <ul className="grid gap-3 lg:grid-cols-2">
              {investments.map((i) => (
                <li key={i.category_id}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="min-w-0 font-bold">{i.name}</h3>
                      <ValuationDialog item={i} today={today} />
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-text-3">{t.goals.deposited}</dt>
                        <dd className="tabular font-semibold">{formatMoney(i.deposited)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-text-3">{t.goals.sold}</dt>
                        <dd className="tabular font-semibold">{formatMoney(i.sold)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-text-3">{t.goals.invested}</dt>
                        <dd className="tabular font-semibold">{formatMoney(i.invested)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-text-3">{t.goals.currentValue}</dt>
                        <dd className="tabular font-semibold">{i.current_value === null ? t.goals.noValue : formatMoney(i.current_value)}</dd>
                        {i.valued_on && <dd className="text-xs text-text-3">{t.goals.valueDate(formatDate(i.valued_on))}</dd>}
                      </div>
                      {i.gain !== null && (
                        <div>
                          <dt className="text-xs text-text-3">{t.goals.gain}</dt>
                          <dd className={cn("tabular font-semibold", Number(i.gain) < 0 ? "text-error" : "text-success")}>
                            {signedMoney(i.gain)}
                            {i.gain_pct !== null && ` (${percent(i.gain_pct)})`}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-3">{t.goals.investHint}</p>
          </div>
        )}
      </section>
    </div>
  );
}
