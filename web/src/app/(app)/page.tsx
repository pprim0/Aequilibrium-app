import { Card } from "@/components/ui/card";
import { SetupMissing } from "@/components/setup/require-setup";
import { getFreeToSpend, getSpentToday, isSetUp } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { t } from "@/i18n";

// Placeholder home: the full dashboard is phase 4. Numbers come from the SQL functions.
export default async function HomePage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const [free, spentToday] = await Promise.all([getFreeToSpend(), getSpentToday()]);
  const projected = free.state === "projected";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t.home.title}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-text-2">{projected ? t.home.freeProjected : t.home.freeToSpend}</p>
          {free.state === "no_income" ? (
            <p className="mt-2 text-lg font-bold text-warning">{t.home.registerIncome}</p>
          ) : (
            <p className="tabular mt-1 text-3xl font-extrabold">
              {formatMoney(projected ? free.free_projected : free.free)}
              {projected && <span className="ml-2 align-middle text-xs font-semibold text-text-3">({t.common.estimate})</span>}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-sm font-semibold text-text-2">{t.home.spentToday}</p>
          <p className="tabular mt-1 text-3xl font-extrabold">{formatMoney(spentToday)}</p>
        </Card>
      </div>
      <p className="text-sm text-text-3">{t.home.comingSoon}</p>
    </div>
  );
}
