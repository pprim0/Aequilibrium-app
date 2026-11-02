import { Button } from "@/components/ui/button";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { MonthlyChart } from "./monthly-chart";
import { formatMoney, monthLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AllocationRow, Category, CategoryChange, HabitSpending, MonthHistory, MonthTotals, Numeric } from "@/lib/types";
import { t } from "@/i18n";

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}

function Compare({ label, current, previous }: { label: string; current: Numeric; previous: Numeric }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-semibold text-text-2">{label}</p>
      <p className="tabular text-lg font-bold">{formatMoney(current)}</p>
      <p className="tabular text-xs text-text-3">{t.insights.previously(formatMoney(previous))}</p>
    </Card>
  );
}

export function InsightsView({
  monthKey,
  categories,
  categoryId,
  data,
}: {
  monthKey: number;
  categories: Category[];
  categoryId: string | null;
  data: {
    current: MonthTotals;
    previous: MonthTotals;
    changes: CategoryChange[];
    allocation: AllocationRow[];
    history: MonthHistory[];
    habits: HabitSpending[];
  };
}) {
  const { current, previous, changes, allocation, history, habits } = data;
  const variations = changes.filter((c) => Number(c.change) !== 0).slice(0, 5);
  const fixed = Number(current.fixed_expenses);
  const variable = Number(current.variable_expenses);
  const total = fixed + variable;
  const byCategory = changes.filter((c) => Number(c.current_amount) > 0).sort((a, b) => Number(b.current_amount) - Number(a.current_amount));
  const maxCategory = Math.max(0, ...byCategory.map((c) => Number(c.current_amount)));
  const debtPhase = allocation[0]?.debt_phase ?? false;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="sec-compare">
        <SectionTitle>
          <span id="sec-compare">{t.insights.compare}</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Compare label={t.insights.income} current={current.income} previous={previous.income} />
          <Compare label={t.insights.expenses} current={current.expenses} previous={previous.expenses} />
          <Compare label={t.insights.debts} current={current.debt_payments} previous={previous.debt_payments} />
          <Compare label={t.insights.savings} current={current.savings} previous={previous.savings} />
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="sec-variations">
          <SectionTitle>
            <span id="sec-variations">{t.insights.variations}</span>
          </SectionTitle>
          {variations.length === 0 ? (
            <EmptyState>{t.insights.noVariations}</EmptyState>
          ) : (
            <Card className="py-1">
              <ul className="divide-y divide-border">
                {variations.map((c) => (
                  <li key={c.category_id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="tabular block text-xs text-text-3">
                        {formatMoney(c.previous_amount)} → {formatMoney(c.current_amount)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-bold">{signed(Number(c.change))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section aria-labelledby="sec-fixed">
          <SectionTitle>
            <span id="sec-fixed">{t.insights.fixedVariable}</span>
          </SectionTitle>
          <Card>
            {total === 0 ? (
              <p className="text-sm text-text-2">{t.insights.noExpenses}</p>
            ) : (
              <>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  {fixed > 0 && <div className="bg-series-1" style={{ width: `${(fixed / total) * 100}%` }} />}
                  {variable > 0 && <div className="bg-series-2" style={{ width: `${(variable / total) * 100}%` }} />}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-text-2">
                      <span aria-hidden className="size-2.5 rounded-sm bg-series-1" /> {t.insights.fixed}
                    </dt>
                    <dd className="tabular font-bold">
                      {formatMoney(fixed)} <span className="text-xs font-medium text-text-3">({Math.round((fixed / total) * 100)}%)</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-text-2">
                      <span aria-hidden className="size-2.5 rounded-sm bg-series-2" /> {t.insights.variable}
                    </dt>
                    <dd className="tabular font-bold">
                      {formatMoney(variable)} <span className="text-xs font-medium text-text-3">({Math.round((variable / total) * 100)}%)</span>
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </Card>
        </section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="sec-monthly">
          <SectionTitle>
            <span id="sec-monthly">{t.insights.monthlyChart}</span>
          </SectionTitle>
          <Card>
            <MonthlyChart history={history} />
            <details className="mt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.insights.chartTable}</summary>
              <div className="overflow-x-auto">
                <table className="tabular w-full text-sm">
                  <thead className="text-left text-xs text-text-3">
                    <tr>
                      <th scope="col" className="py-1 font-semibold">{t.insights.month}</th>
                      <th scope="col" className="py-1 text-right font-semibold">{t.insights.fixed}</th>
                      <th scope="col" className="py-1 text-right font-semibold">{t.insights.variable}</th>
                      <th scope="col" className="py-1 text-right font-semibold">{t.insights.total}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((h) => (
                      <tr key={h.month_key}>
                        <td className="py-1.5">{monthLabel(h.month_key)}</td>
                        <td className="py-1.5 text-right">{formatMoney(h.fixed_expenses)}</td>
                        <td className="py-1.5 text-right">{formatMoney(h.variable_expenses)}</td>
                        <td className="py-1.5 text-right">{formatMoney(h.expenses)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        </section>

        <section aria-labelledby="sec-category">
          <SectionTitle>
            <span id="sec-category">{t.insights.byCategory}</span>
          </SectionTitle>
          {byCategory.length === 0 ? (
            <EmptyState>{t.insights.noExpenses}</EmptyState>
          ) : (
            <Card>
              <ul className="flex flex-col gap-3">
                {byCategory.map((c) => (
                  <li key={c.category_id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{c.name}</span>
                      <span className="tabular shrink-0 font-semibold">{formatMoney(c.current_amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-r-[4px]" aria-hidden>
                      <div className="h-full rounded-r-[4px] bg-series-1" style={{ width: `${maxCategory > 0 ? (Number(c.current_amount) / maxCategory) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <section aria-labelledby="sec-rule">
        <SectionTitle>
          <span id="sec-rule">{t.insights.rule}</span>
        </SectionTitle>
        {allocation.length === 0 ? (
          <EmptyState>{t.insights.noRule}</EmptyState>
        ) : (
          <Card>
            <p className={cn("mb-3 text-sm font-semibold", debtPhase ? "text-warning" : "text-success")}>{debtPhase ? t.insights.debtPhase : t.insights.ruleActive}</p>
            <div className="overflow-x-auto">
              <table className="tabular w-full min-w-[20rem] text-sm">
                <thead className="text-left text-xs text-text-3">
                  <tr>
                    <th scope="col" className="py-1 font-semibold">{t.insights.block}</th>
                    <th scope="col" className="py-1 text-right font-semibold">{t.insights.recommended}</th>
                    <th scope="col" className="py-1 text-right font-semibold">{t.insights.actual}</th>
                    <th scope="col" className="py-1 text-right font-semibold">{t.insights.difference}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allocation.map((r) => (
                    <tr key={r.rule_id}>
                      <td className="py-2">
                        {r.name} <span className="text-xs text-text-3">{Math.round(Number(r.pct) * 100)}%</span>
                      </td>
                      <td className="py-2 text-right">{formatMoney(r.recommended)}</td>
                      <td className="py-2 text-right">{formatMoney(r.actual)}</td>
                      <td className="py-2 text-right font-semibold">{signed(Number(r.difference))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-text-3">{t.insights.ruleHint}</p>
          </Card>
        )}
      </section>

      <section aria-labelledby="sec-habits">
        <SectionTitle>
          <span id="sec-habits">{t.insights.habits}</span>
        </SectionTitle>
        <form method="get" action="/insights" className="mb-3 flex items-center gap-2">
          <input type="hidden" name="mes" value={monthKey} />
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t.insights.habitsCategory}</span>
            <Select name="categoria" defaultValue={categoryId ?? ""}>
              <option value="">{t.insights.allVariable}</option>
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary">
            {t.insights.habitsApply}
          </Button>
        </form>
        {habits.length === 0 ? (
          <EmptyState>{t.insights.noHabits}</EmptyState>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {habits.map((h) => {
              const diff = Number(h.difference);
              return (
                <li key={h.habit_id}>
                  <Card>
                    <p className="font-bold">
                      {h.emoji ? `${h.emoji} ` : ""}
                      {h.name}
                    </p>
                    {h.enough_data ? (
                      <>
                        <p className="tabular mt-1 text-sm font-semibold">
                          {diff === 0 ? t.insights.habitSame : diff < 0 ? t.insights.habitLess(formatMoney(-diff)) : t.insights.habitMore(formatMoney(diff))}
                        </p>
                        <p className="tabular text-xs text-text-2">{t.insights.withHabit(formatMoney(h.avg_done), h.days_done)}</p>
                        <p className="tabular text-xs text-text-2">{t.insights.withoutHabit(formatMoney(h.avg_not_done), h.days_not_done)}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-text-2">{t.insights.notEnough(h.days_done, h.days_not_done)}</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-text-3">{t.insights.habitsHint}</p>
      </section>
    </div>
  );
}
