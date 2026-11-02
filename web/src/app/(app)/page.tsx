import { Card } from "@/components/ui/card";
import { SetupMissing } from "@/components/setup/require-setup";
import { getFreeToSpend, getMonthCoverage, getSpentToday, isSetUp } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "border-t border-border pt-2 font-bold")}>
      <dt className={strong ? "text-text" : "text-text-2"}>{label}</dt>
      <dd className="tabular shrink-0 font-semibold">{formatMoney(value)}</dd>
    </div>
  );
}

// Interim home: the full dashboard is phase 4. Numbers come from the SQL functions.
export default async function HomePage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const [free, coverage, spentToday] = await Promise.all([getFreeToSpend(), getMonthCoverage(), getSpentToday()]);
  const projected = free.state === "projected";
  const benefit = Number(free.benefit_balance);
  const difference = Number(coverage.difference);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t.home.title}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-text-2">{projected ? t.home.freeProjected : t.home.freeToSpend}</p>
          {free.state === "no_income" ? (
            <p className="mt-2 text-lg font-bold text-warning">{t.home.registerIncome}</p>
          ) : (
            <p className={cn("tabular mt-1 text-3xl font-extrabold", Number(projected ? free.free_projected : free.free) < 0 && "text-error")}>
              {formatMoney(projected ? free.free_projected : free.free)}
              {projected && <span className="ml-2 align-middle text-xs font-semibold text-text-3">({t.common.estimate})</span>}
            </p>
          )}
          {benefit !== 0 && <p className="mt-1 text-xs text-text-2">{t.home.benefitApart(formatMoney(benefit))}</p>}
        </Card>
        <Card>
          <p className="text-sm font-semibold text-text-2">{t.home.spentToday}</p>
          <p className="tabular mt-1 text-3xl font-extrabold">{formatMoney(spentToday)}</p>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">{t.home.howCalculated}</h2>
          <dl>
            <Row label={t.home.available} value={Number(free.available)} />
            <Row label={t.home.pending} value={-(Number(free.pending_recurring) + Number(free.pending_installments))} />
            <Row label={t.home.planDebts} value={-Number(free.reserved_debts)} />
            <Row label={t.home.planGoals} value={-Number(free.reserved_goals)} />
            <Row label={t.home.freeToSpend} value={Number(free.free)} strong />
          </dl>
          {!free.has_plan && <p className="mt-2 text-xs text-text-3">{t.home.noPlan}</p>}
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">{t.home.coverageTitle}</h2>
          <dl>
            <Row label={t.home.budgetRemaining} value={Number(coverage.budget_remaining)} />
            <Row label={t.home.benefitCovered} value={-Number(coverage.benefit_covered)} />
            <Row label={t.home.neededFromAccounts} value={Number(coverage.needed_from_accounts)} strong />
            <Row label={t.home.freeToSpend} value={Number(coverage.free)} />
            <Row label={t.home.difference} value={difference} strong />
          </dl>
          <p className={cn("mt-2 text-sm font-semibold", difference < 0 ? "text-error" : "text-success")}>
            {difference < 0 ? t.home.coverageShort(formatMoney(-difference)) : t.home.coverageOk(formatMoney(difference))}
          </p>
        </Card>
      </div>
      <p className="text-sm text-text-3">{t.home.comingSoon}</p>
    </div>
  );
}
