import { Badge, type Tone } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { CategoryLimitDialog, GroupBudgetDialog } from "./budget-forms";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BudgetUsage, CategoryGroup, Category } from "@/lib/types";
import { t } from "@/i18n";

const levelTone: Record<string, Tone> = { yellow: "warning", orange: "orange", red: "error" };

function Remaining({ row }: { row: BudgetUsage }) {
  const left = Number(row.budget) - Number(row.spent);
  return (
    <span className={cn("tabular shrink-0 text-sm font-bold", left < 0 && "text-error")}>
      {left >= 0 ? t.budget.leftShort(formatMoney(left)) : t.budget.overShort(formatMoney(-left))}
    </span>
  );
}

export function BudgetView({
  usage,
  groups,
  categories,
}: {
  usage: BudgetUsage[];
  groups: CategoryGroup[];
  categories: Category[];
}) {
  const groupRows = usage.filter((u) => u.scope === "group");
  const categoryRows = usage.filter((u) => u.scope === "category");
  const expenseGroupIds = new Set(categoryRows.map((c) => c.group_id));
  // Income, debt or transfer groups have nothing to budget.
  const shown = groups.filter((g) => expenseGroupIds.has(g.id));
  const ungrouped = categoryRows.filter((c) => !c.group_id);
  const budgeted = groupRows.filter((g) => g.budget !== null && shown.some((s) => s.id === g.id));
  const totalBudget = budgeted.reduce((sum, g) => sum + Number(g.budget), 0);
  const totalSpent = budgeted.reduce((sum, g) => sum + Number(g.spent), 0);
  const totalLeft = totalBudget - totalSpent;
  const limitOf = (id: string) => categories.find((c) => c.id === id)?.own_limit ?? null;

  const categoryList = (rows: BudgetUsage[]) => {
    const sorted = [...rows].sort((a, b) => Number(b.spent) - Number(a.spent));
    return (
      <ul className="divide-y divide-border">
        {sorted.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-2 py-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                <span className="tabular shrink-0 text-sm font-semibold">
                  {c.budget !== null ? t.budget.ofBudget(formatMoney(c.spent), formatMoney(c.budget)) : formatMoney(c.spent)}
                </span>
              </div>
              {c.budget !== null && (
                <div className="mt-1">
                  <Meter value={c.pct === null ? null : Number(c.pct)} level={c.level} label={c.name} />
                </div>
              )}
            </div>
            <CategoryLimitDialog id={c.id} name={c.name} limit={limitOf(c.id)} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {totalBudget > 0 ? (
        <Card className="bg-primary-pale">
          <p className="text-sm font-semibold text-text-2">{totalLeft >= 0 ? t.budget.canStillSpend : t.budget.overTotal}</p>
          <p className={cn("tabular text-3xl font-extrabold", totalLeft < 0 && "text-error")}>{formatMoney(Math.abs(totalLeft))}</p>
          <div className="mt-2">
            <Meter value={totalSpent / totalBudget} label={t.budget.total} />
          </div>
          <p className="tabular mt-1 text-xs text-text-2">{t.budget.spentOf(formatMoney(totalSpent), formatMoney(totalBudget))}</p>
        </Card>
      ) : (
        <EmptyState>{t.budget.empty}</EmptyState>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {shown.map((g) => {
          const row = groupRows.find((u) => u.id === g.id);
          if (!row) return null;
          const rows = categoryRows.filter((c) => c.group_id === g.id);
          const alert = levelTone[row.level];
          return (
            <Card key={g.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate font-bold">{g.name}</h2>
                {alert && <Badge tone={alert}>{t.budget.levels[row.level]}</Badge>}
                <GroupBudgetDialog id={g.id} name={g.name} budget={g.monthly_budget} />
              </div>
              {row.budget !== null ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular text-xs text-text-2">{t.budget.ofBudget(formatMoney(row.spent), formatMoney(row.budget))}</span>
                    <Remaining row={row} />
                  </div>
                  <Meter value={row.pct === null ? null : Number(row.pct)} level={row.level} label={g.name} />
                </>
              ) : (
                <p className="tabular text-sm text-text-2">
                  {formatMoney(row.spent)} · {t.budget.noBudget}
                </p>
              )}
              {rows.length > 0 && (
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.budget.categories(rows.length)}</summary>
                  {categoryList(rows)}
                </details>
              )}
            </Card>
          );
        })}
        {ungrouped.length > 0 && (
          <Card className="flex flex-col gap-1">
            <h2 className="font-bold">{t.budget.other}</h2>
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.budget.categories(ungrouped.length)}</summary>
              {categoryList(ungrouped)}
            </details>
          </Card>
        )}
      </div>
    </div>
  );
}
