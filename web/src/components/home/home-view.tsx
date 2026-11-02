import Link from "next/link";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Meter, type MeterLevel } from "@/components/ui/meter";
import { Badge, type Tone } from "@/components/ui/badge";
import { TransactionList } from "@/components/transactions/transaction-list";
import { ReviewDialog } from "@/components/review/review-dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  AccountBalance,
  BudgetUsage,
  DebtSummary,
  AchievementStatus,
  Checkin,
  FreeToSpend,
  Gamification,
  MissionStatus,
  GoalProgress,
  InstallmentStatus,
  Lookups,
  MonthCoverage,
  MonthTotals,
  Transaction,
} from "@/lib/types";
import { t } from "@/i18n";

export type HomeData = {
  free: FreeToSpend;
  coverage: MonthCoverage;
  spentToday: number;
  totals: MonthTotals;
  balances: AccountBalance[];
  installments: InstallmentStatus[];
  usage: BudgetUsage[];
  debts: DebtSummary[];
  goals: GoalProgress[];
  recent: Transaction[];
  gamification: Gamification;
  missions: MissionStatus[];
  achievements: AchievementStatus[];
  checkins: Checkin[];
};

const alertTone: Record<string, Tone> = { yellow: "warning", orange: "orange", red: "error" };

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "border-t border-border pt-2 font-bold")}>
      <dt className={strong ? "text-text" : "text-text-2"}>{label}</dt>
      <dd className="tabular shrink-0 font-semibold">{formatMoney(value)}</dd>
    </div>
  );
}

function Stat({ label, value, tone, className }: { label: string; value: string; tone?: string; className?: string }) {
  return (
    <Card className={cn("p-3 sm:p-4", className)}>
      <p className="text-xs font-semibold text-text-2 sm:text-sm">{label}</p>
      <p className={cn("tabular mt-1 text-lg font-extrabold sm:text-2xl", tone)}>{value}</p>
    </Card>
  );
}

function ProgressRow({ label, value, level, detail }: { label: string; value: number | null; level?: MeterLevel; detail?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-xs text-text-2">{value === null ? t.common.none : `${Math.round(value * 100)}%`}</span>
      </div>
      <Meter value={value} level={level} label={label} />
      {detail && <p className="text-xs text-text-3">{detail}</p>}
    </div>
  );
}

export function HomeView({ data, lookups }: { data: HomeData; lookups: Lookups }) {
  const { free, coverage, spentToday, totals, balances, installments, usage, debts, goals, recent, gamification, missions, achievements, checkins } = data;
  const projected = free.state === "projected";
  const shownFree = Number(projected ? free.free_projected : free.free);
  const benefit = Number(free.benefit_balance);
  const difference = Number(coverage.difference);

  const groups = usage.filter((u) => u.scope === "group" && u.budget !== null);
  const totalBudget = groups.reduce((sum, g) => sum + Number(g.budget), 0);
  const alerts = usage
    .filter((u) => u.level === "yellow" || u.level === "orange" || u.level === "red")
    .sort((a, b) => Number(b.pct) - Number(a.pct));

  const nextInstallment = installments
    .filter((i) => i.status !== "paid")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const accountRows = balances
    .filter((b) => !b.is_archived && b.type !== "credit")
    .sort((a, b) => a.sort_order - b.sort_order);

  const borrowed = debts.reduce((sum, d) => sum + Number(d.total_borrowed), 0);
  const paid = debts.reduce((sum, d) => sum + Number(d.paid), 0);
  const mainGoal = goals[0];
  const dayMissions = missions.filter((m) => m.period === "day");
  const latest = achievements
    .filter((a) => a.unlocked_on)
    .sort((a, b) => (b.unlocked_on ?? "").localeCompare(a.unlocked_on ?? ""))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t.home.title}</h1>

      <Card className="bg-primary-pale">
        <p className="text-sm font-semibold text-text-2">{projected ? t.home.freeProjected : t.home.freeToSpend}</p>
        {free.state === "no_income" ? (
          <p className="mt-2 text-xl font-bold text-warning">{t.home.registerIncome}</p>
        ) : (
          <p className={cn("tabular mt-1 text-4xl font-extrabold", shownFree < 0 && "text-error")}>
            {formatMoney(shownFree)}
            {projected && <span className="ml-2 align-middle text-xs font-semibold text-text-3">({t.common.estimate})</span>}
          </p>
        )}
        {benefit !== 0 && <p className="mt-1 text-sm text-text-2">{t.home.benefitApart(formatMoney(benefit))}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t.home.spentToday} value={formatMoney(spentToday)} className="col-span-2 lg:col-span-1" />
        <Stat label={t.home.monthIncome} value={formatMoney(totals.income)} tone="text-success" />
        <Stat label={t.home.monthExpenses} value={formatMoney(totals.expenses)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold">{gamification.level !== null && t.progress.levelName(gamification.level, gamification.level_name ?? "")}</h2>
              <p className="text-sm text-text-2">
                {t.progress.xpTotal(gamification.xp_total)}
                {gamification.xp_to_next !== null && ` · ${t.progress.xpToNext(gamification.xp_to_next, gamification.next_level_name ?? "")}`}
              </p>
            </div>
            <p className="shrink-0 text-right text-sm font-bold">🔥 {t.progress.days(gamification.streak)}</p>
          </div>
          <Meter value={Number(gamification.level_progress)} label={t.progress.title} />
          <ul className="flex flex-col gap-1 text-sm">
            {dayMissions.map((m) => (
              <li key={m.mission_id} className="flex items-center justify-between gap-2">
                <span className={cn("min-w-0", m.done && "text-text-3")}>{m.done ? "✓" : "○"} {m.name}</span>
                <span className="tabular shrink-0 text-xs text-text-3">+{m.xp} XP</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReviewDialog checkins={checkins} today={lookups.today} />
            <Link href="/progresso" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t.progress.seeAll}</Link>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">{t.progress.latest}</h2>
          {latest.length === 0 ? (
            <p className="text-sm text-text-2">{t.progress.noneYet}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {latest.map((a) => (
                <li key={a.achievement_id} className="flex justify-between gap-3">
                  <span>🏅 {a.name}</span>
                  <span className="tabular shrink-0 text-xs text-text-3">{formatDate(a.unlocked_on)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="font-bold">{t.home.monthProgress}</h2>
          {totalBudget > 0 && (
            <ProgressRow
              label={t.home.totalBudget}
              value={Number(totals.expenses) / totalBudget}
              level="progress"
              detail={t.home.budgetLeft(formatMoney(totalBudget), formatMoney(Math.max(0, totalBudget - Number(totals.expenses))))}
            />
          )}
          {groups.map((g) => (
            <ProgressRow key={g.id} label={g.name} value={g.pct === null ? null : Number(g.pct)} level={g.level} />
          ))}
          {mainGoal && <ProgressRow label={mainGoal.name} value={mainGoal.progress === null ? null : Number(mainGoal.progress)} />}
          {borrowed > 0 && <ProgressRow label={t.home.debtsPaid} value={paid / borrowed} />}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-2 font-bold">{t.home.alerts}</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-text-2">{t.home.noAlerts}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alerts.map((a) => (
                  <li key={`${a.scope}-${a.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">{t.home.alertLine(a.name, formatMoney(a.spent), formatMoney(a.budget))}</span>
                    <Badge tone={alertTone[a.level]}>{t.budget.levels[a.level]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-bold">{t.home.nextInstallment}</h2>
            {nextInstallment ? (
              <p className="text-sm">
                <strong>{nextInstallment.account_name}</strong> · <span className="tabular">{formatMoney(nextInstallment.amount)}</span> ·{" "}
                {formatDate(nextInstallment.due_date)}
                {nextInstallment.days_left !== null && ` (${t.accounts.daysLeft(nextInstallment.days_left)})`}
              </p>
            ) : (
              <p className="text-sm text-text-2">{t.home.noInstallment}</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-bold">{t.home.balances}</h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {accountRows.map((b) => (
                <li key={b.account_id} className="flex justify-between gap-3">
                  <span className="truncate text-text-2">{b.name}</span>
                  <span className="tabular font-semibold">{formatMoney(b.balance)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <section aria-labelledby="sec-recent">
        <SectionTitle
          action={
            <Link href="/movimentos" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
              {t.home.seeAll}
            </Link>
          }
        >
          <span id="sec-recent">{t.home.recent}</span>
        </SectionTitle>
        {recent.length === 0 ? (
          <EmptyState>{t.home.noActivity}</EmptyState>
        ) : (
          <TransactionList transactions={recent} alerts={{}} categories={lookups.categories} accounts={lookups.accounts} />
        )}
      </section>
    </div>
  );
}
