import { BudgetView } from "@/components/budget/budget-view";
import { MonthNav } from "@/components/ui/month-nav";
import { SetupMissing } from "@/components/setup/require-setup";
import { getBudget, getCurrentMonthKey, getLookups, getMonthTotals, isSetUp } from "@/lib/data";
import { shiftMonthKey } from "@/lib/format";
import { t } from "@/i18n";

export const metadata = { title: `${t.budget.title} · ${t.app.name}` };

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!(await isSetUp())) return <SetupMissing />;
  const { mes } = await searchParams;
  const requested = Number(mes);
  const monthKey = Number.isInteger(requested) && requested % 100 >= 1 && requested % 100 <= 12 ? requested : await getCurrentMonthKey();
  const [lookups, totals, budget] = await Promise.all([getLookups(), getMonthTotals(monthKey), getBudget(monthKey)]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t.budget.title}</h1>
      <MonthNav
        monthKey={monthKey}
        start={totals.start_date}
        end={totals.end_date}
        prevHref={`/orcamento?mes=${shiftMonthKey(monthKey, -1)}`}
        nextHref={`/orcamento?mes=${shiftMonthKey(monthKey, 1)}`}
      />
      <BudgetView usage={budget.usage} groups={budget.groups} categories={lookups.categories} />
    </div>
  );
}
