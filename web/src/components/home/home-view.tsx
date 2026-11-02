import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { HideValuesButton } from "@/components/ui/hide-values";
import { Meter } from "@/components/ui/meter";
import { ReviewDialog } from "@/components/review/review-dialog";
import { TransactionList } from "@/components/transactions/transaction-list";
import { AccountsCard } from "./accounts-card";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  AccountBalance,
  Checkin,
  DebtSummary,
  FreeToSpend,
  Gamification,
  GoalProgress,
  InstallmentStatus,
  Lookups,
  MonthCoverage,
  MonthTotals,
  RecurringStatus,
  Transaction,
} from "@/lib/types";
import { t } from "@/i18n";

export type HomeData = {
  free: FreeToSpend;
  coverage: MonthCoverage;
  spentToday: number;
  moneyInAccounts: number;
  totals: MonthTotals;
  balances: AccountBalance[];
  installments: InstallmentStatus[];
  recurring: RecurringStatus[];
  debts: DebtSummary[];
  goals: GoalProgress[];
  recent: Transaction[];
  gamification: Gamification;
  checkins: Checkin[];
};

const UPCOMING_LIMIT = 4;

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
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-xs font-medium text-text-2">{label}</p>
      <p className={cn("tabular mt-0.5 font-bold", tone)}>{value}</p>
    </div>
  );
}

function LinkCard({ href, label, value, danger, children }: { href: string; label: string; value: string; danger?: boolean; children?: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-[var(--radius-md)] border border-border bg-card p-4 hover:bg-muted">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-text-2">
        {label}
        <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
      </span>
      <span className={cn("tabular mt-1 block text-xl font-extrabold", danger && "text-error")}>{value}</span>
      {children}
    </Link>
  );
}

export function HomeView({ data, lookups }: { data: HomeData; lookups: Lookups }) {
  const { free, coverage, spentToday, moneyInAccounts, totals, balances, installments, recurring, debts, goals, recent, gamification, checkins } = data;
  const projected = free.state === "projected";
  const shownFree = Number(projected ? free.free_projected : free.free);
  const benefit = Number(free.benefit_balance);
  const difference = Number(coverage.difference);

  const upcoming = [
    ...recurring
      .filter((r) => r.status === "pending" || r.status === "overdue")
      .map((r) => ({ key: r.recurring_id, name: r.description, amount: r.amount, date: r.due_date, overdue: r.status === "overdue" })),
    ...installments
      .filter((i) => i.status !== "paid")
      .map((i) => ({ key: i.installment_id, name: i.account_name, amount: i.amount, date: i.due_date as string | null, overdue: i.status === "overdue" })),
  ]
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, UPCOMING_LIMIT);

  const accountRows = balances.filter((b) => !b.is_archived && b.type !== "credit").sort((a, b) => a.sort_order - b.sort_order);
  const debtTotal = debts.reduce((sum, d) => sum + Number(d.outstanding), 0);
  const mainGoal = goals[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t.home.title}</h1>
        <HideValuesButton />
      </div>

      <Card className="bg-primary-pale">
        <p className="text-sm font-semibold text-text-2">{projected ? t.home.freeProjected : t.home.freeToSpend}</p>
        {free.state === "no_income" ? (
          <p className="mt-2 text-xl font-bold text-warning">{t.home.registerIncome}</p>
        ) : (
          <p className="mt-1 text-4xl font-extrabold">
            <span className={cn("tabular", shownFree < 0 && "text-error")}>{formatMoney(shownFree)}</span>
            {projected && <span className="ml-2 align-middle text-xs font-semibold text-text-3">({t.common.estimate})</span>}
          </p>
        )}
        {benefit !== 0 && <p className="tabular mt-1 text-sm text-text-2">{t.home.benefitApart(formatMoney(benefit))}</p>}
        <p className={cn("tabular mt-2 text-sm font-semibold", difference < 0 ? "text-error" : "text-success")}>
          {difference < 0 ? t.home.coverageShort(formatMoney(-difference)) : t.home.coverageOk(formatMoney(difference))}
        </p>
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.home.howCalculated}</summary>
          <dl>
            <Row label={t.home.available} value={Number(free.available)} />
            <Row label={t.home.pending} value={-(Number(free.pending_recurring) + Number(free.pending_installments))} />
            <Row label={t.home.planDebts} value={-Number(free.reserved_debts)} />
            <Row label={t.home.planGoals} value={-Number(free.reserved_goals)} />
            <Row label={t.home.freeToSpend} value={Number(free.free)} strong />
          </dl>
          {!free.has_plan && <p className="mt-2 text-xs text-text-3">{t.home.noPlan}</p>}
          <h3 className="mt-3 text-sm font-bold">{t.home.coverageTitle}</h3>
          <dl>
            <Row label={t.home.budgetRemaining} value={Number(coverage.budget_remaining)} />
            <Row label={t.home.benefitCovered} value={-Number(coverage.benefit_covered)} />
            <Row label={t.home.neededFromAccounts} value={Number(coverage.needed_from_accounts)} strong />
          </dl>
        </details>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <AccountsCard accounts={accountRows} total={moneyInAccounts} />
          <Card className="grid grid-cols-3 gap-3 py-3">
            <Stat label={t.home.spentToday} value={formatMoney(spentToday)} />
            <Stat label={t.tx.income} value={formatMoney(totals.income)} />
            <Stat label={t.tx.expenses} value={formatMoney(totals.expenses)} />
          </Card>
          <div className="grid grid-cols-2 gap-3">
            {debtTotal > 0 && <LinkCard href="/compromissos" label={t.debts.title} value={formatMoney(debtTotal)} danger />}
            {mainGoal && (
              <LinkCard href="/objetivos" label={mainGoal.name} value={formatMoney(mainGoal.saved)}>
                <span className="mt-2 block">
                  <Meter value={mainGoal.progress === null ? null : Number(mainGoal.progress)} label={mainGoal.name} />
                </span>
              </LinkCard>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div>
              <h2 className="font-bold">{t.progress.reviews}</h2>
              <p className="tabular text-sm text-text-2">
                {t.progress.days(gamification.streak)} · {gamification.reviewed_today ? t.review.doneToday : t.review.pendingToday}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ReviewDialog checkins={checkins} today={lookups.today} />
              <Link href="/progresso" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                {t.progress.seeAll}
              </Link>
            </div>
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <h2 className="mb-2 font-bold">{t.home.upcoming}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {upcoming.map((u) => (
                  <li key={u.key} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.name}</span>
                      <span className={cn("block text-xs", u.overdue ? "font-semibold text-error" : "text-text-3")}>
                        {u.overdue ? t.recurringStatus.overdue : u.date ? formatDate(u.date) : t.accounts.noDay}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-semibold">{formatMoney(u.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

        </div>
      </div>

      <section aria-labelledby="sec-recent" className="mt-2">
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
