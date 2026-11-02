import { InsightsView } from "@/components/insights/insights-view";
import { MonthNav } from "@/components/ui/month-nav";
import { SetupMissing } from "@/components/setup/require-setup";
import { getCurrentMonthKey, getInsights, getLookups, isSetUp } from "@/lib/data";
import { shiftMonthKey } from "@/lib/format";
import { t } from "@/i18n";

export const metadata = { title: `${t.insights.title} · ${t.app.name}` };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ mes?: string; categoria?: string }> }) {
  if (!(await isSetUp())) return <SetupMissing />;
  const { mes, categoria } = await searchParams;
  const lookups = await getLookups();
  const requested = Number(mes);
  const monthKey = Number.isInteger(requested) && requested % 100 >= 1 && requested % 100 <= 12 ? requested : await getCurrentMonthKey();
  const categoryId = lookups.categories.some((c) => c.id === categoria) ? categoria! : null;
  const data = await getInsights(monthKey, shiftMonthKey(monthKey, -1), categoryId);
  const keep = categoryId ? `&categoria=${categoryId}` : "";
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t.insights.title}</h1>
      <MonthNav
        monthKey={monthKey}
        start={data.current.start_date}
        end={data.current.end_date}
        prevHref={`/insights?mes=${shiftMonthKey(monthKey, -1)}${keep}`}
        nextHref={`/insights?mes=${shiftMonthKey(monthKey, 1)}${keep}`}
      />
      <InsightsView monthKey={monthKey} categories={lookups.categories} categoryId={categoryId} data={data} showHabits={lookups.settings?.show_habits ?? false} />
    </div>
  );
}
