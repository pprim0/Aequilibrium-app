import { Badge, type Tone } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { CategoryLimitDialog, GroupBudgetDialog } from "./budget-forms";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BudgetUsage, CategoryGroup, Category } from "@/lib/types";
import { t } from "@/i18n";

const levelTone: Record<string, Tone> = { none: "muted", ok: "success", yellow: "warning", orange: "orange", red: "error" };

function Amounts({ row, alignRight }: { row: BudgetUsage; alignRight?: boolean }) {
  if (row.budget === null) return <span className="tabular text-sm font-semibold">{formatMoney(row.spent)}</span>;
  const left = Number(row.budget) - Number(row.spent);
  return (
    <span className="tabular text-sm">
      <strong>{t.budget.ofBudget(formatMoney(row.spent), formatMoney(row.budget))}</strong>
      <span className={cn("block text-xs text-text-2", alignRight && "text-right")}>{left >= 0 ? t.budget.left(formatMoney(left)) : t.budget.over(formatMoney(-left))}</span>
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
  const budgeted = groupRows.filter((g) => g.budget !== null);
  const totalBudget = budgeted.reduce((sum, g) => sum + Number(g.budget), 0);
  const totalSpent = categoryRows.reduce((sum, c) => sum + Number(c.spent), 0);
  const limitOf = (id: string) => categories.find((c) => c.id === id)?.own_limit ?? null;

  const categoryList = (rows: BudgetUsage[]) => (
    <ul className="mt-2 divide-y divide-border">
      {rows.map((c) => (
        <li key={c.id} className="flex items-center gap-2 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
              <Amounts row={c} alignRight />
            </div>
            {c.budget !== null ? (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1">
                  <Meter value={c.pct === null ? null : Number(c.pct)} level={c.level} label={c.name} />
                </div>
                <Badge tone={levelTone[c.level]}>{t.budget.levels[c.level]}</Badge>
              </div>
            ) : (
              <p className="text-xs text-text-3">{t.budget.noLimit}</p>
            )}
          </div>
          <CategoryLimitDialog id={c.id} name={c.name} limit={limitOf(c.id)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      {totalBudget > 0 ? (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold">{t.budget.total}</h2>
            <p className="tabular text-sm font-semibold">{t.budget.ofBudget(formatMoney(totalSpent), formatMoney(totalBudget))}</p>
          </div>
          <div className="mt-2">
            <Meter value={totalSpent / totalBudget} label={t.budget.total} />
          </div>
        </Card>
      ) : (
        <EmptyState>{t.budget.empty}</EmptyState>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {shown.map((g) => {
          const row = groupRows.find((u) => u.id === g.id);
          if (!row) return null;
          return (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{g.name}</h2>
                    <Badge tone={levelTone[row.level]}>{row.budget === null ? t.budget.noBudget : t.budget.levels[row.level]}</Badge>
                  </div>
                  <div className="mt-1">
                    <Amounts row={row} />
                  </div>
                </div>
                <GroupBudgetDialog id={g.id} name={g.name} budget={g.monthly_budget} />
              </div>
              {row.budget !== null && (
                <div className="mt-2">
                  <Meter value={row.pct === null ? null : Number(row.pct)} level={row.level} label={g.name} />
                </div>
              )}
              {categoryList(categoryRows.filter((c) => c.group_id === g.id))}
            </Card>
          );
        })}
        {ungrouped.length > 0 && (
          <Card>
            <h2 className="font-bold">{t.budget.other}</h2>
            {categoryList(ungrouped)}
          </Card>
        )}
      </div>
    </div>
  );
}
