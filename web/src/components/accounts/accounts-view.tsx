import { Badge, type Tone } from "@/components/ui/badge";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { AccountDialog, InstallmentDialog, RecurringDialog } from "@/components/accounts/forms";
import type { getAccountsOverview } from "@/lib/data";
import type { Lookups } from "@/lib/types";
import { formatDate, formatMoney, monthLongLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

const recurringTone: Record<string, Tone> = {
  paid: "success",
  pending: "warning",
  overdue: "error",
  not_this_month: "muted",
  not_started: "muted",
  ended: "muted",
};

const installmentTone: Record<string, Tone> = {
  paid: "success",
  overdue: "error",
  due_this_month: "warning",
  later: "neutral",
};

function Progress({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AccountsView({
  lookups,
  monthKey,
  overview,
}: {
  lookups: Lookups;
  monthKey: number;
  overview: Awaited<ReturnType<typeof getAccountsOverview>>;
}) {
  const accountById = new Map(lookups.accounts.map((a) => [a.id, a]));
  const recurringById = new Map(overview.recurring.map((r) => [r.id, r]));
  const installmentById = new Map(overview.installmentRows.map((i) => [i.id, i]));
  const creditAccounts = lookups.accounts.filter((a) => a.type === "credit" && !a.is_archived);

  const cashAccounts = overview.balances
    .filter((b) => b.type !== "credit" && b.type !== "investment" && !b.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order);
  const investmentAccounts = overview.balances.filter((b) => b.type === "investment" && !b.is_archived);
  const invested = investmentAccounts.reduce((s, b) => s + Number(b.balance), 0);
  const openDebts = overview.debts.filter((d) => d.status !== "paid");
  const paidDebts = overview.debts.filter((d) => d.status === "paid");
  const debtTotal = openDebts.reduce((s, d) => s + Number(d.outstanding), 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold">{t.accounts.title}</h1>

      <section aria-labelledby="sec-accounts">
        <SectionTitle action={<AccountDialog today={lookups.today} />}>
          <span id="sec-accounts">{t.accounts.accounts}</span>
        </SectionTitle>
        <Card className="mb-3">
          <p className="text-sm font-semibold text-text-2">{t.accounts.moneyInAccounts}</p>
          <p className="tabular text-3xl font-extrabold">{formatMoney(overview.moneyInAccounts)}</p>
          <p className="mt-1 text-xs text-text-3">{t.accounts.moneyHint}</p>
        </Card>
        {cashAccounts.length + investmentAccounts.length === 0 ? (
          <EmptyState>{t.accounts.noAccounts}</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...cashAccounts, ...investmentAccounts].map((b) => (
              <li key={b.account_id}>
                <Card className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-xs text-text-3">{t.accountTypes[b.type]}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className={cn("tabular font-bold", Number(b.balance) < 0 && "text-error")}>{formatMoney(b.balance)}</p>
                    {accountById.get(b.account_id) && <AccountDialog account={accountById.get(b.account_id)} today={lookups.today} />}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {investmentAccounts.length > 0 && (
          <p className="mt-2 text-xs text-text-3">
            {t.accounts.invested}: {formatMoney(invested)}
          </p>
        )}
      </section>

      <section aria-labelledby="sec-debts">
        <SectionTitle>
          <span id="sec-debts">{t.accounts.debts}</span>
        </SectionTitle>
        {overview.debts.length === 0 ? (
          <EmptyState>{t.accounts.noDebts}</EmptyState>
        ) : (
          <>
            {openDebts.length > 0 && (
              <Card className="mb-3 border-error/30 bg-error-pale">
                <p className="text-sm font-semibold text-error">{t.accounts.debtTotal}</p>
                <p className="tabular text-3xl font-extrabold text-error">{formatMoney(debtTotal)}</p>
              </Card>
            )}
            <ul className="grid gap-3 sm:grid-cols-2">
              {[...openDebts, ...paidDebts].map((d) => {
                const paid = d.status === "paid";
                return (
                  <li key={d.account_id}>
                    <Card className={cn("flex flex-col gap-2", paid && "opacity-60")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{d.name}</p>
                          <p className="text-xs text-text-3">{t.debtStrategies[d.debt_strategy]}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge tone={paid ? "muted" : d.status === "in_progress" ? "info" : "neutral"}>{t.debtStatus[d.status]}</Badge>
                          {accountById.get(d.account_id) && <AccountDialog account={accountById.get(d.account_id)} today={lookups.today} />}
                        </div>
                      </div>
                      <p className={cn("tabular text-2xl font-extrabold", !paid && "text-error")}>{formatMoney(d.outstanding)}</p>
                      {d.progress !== null && <Progress value={Number(d.progress)} />}
                      <dl className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-text-3">{t.accounts.initial}</dt>
                          <dd className="tabular font-semibold">{formatMoney(d.initial)}</dd>
                        </div>
                        <div>
                          <dt className="text-text-3">{t.accounts.newPurchases}</dt>
                          <dd className="tabular font-semibold">{formatMoney(d.new_purchases)}</dd>
                        </div>
                        <div>
                          <dt className="text-text-3">{t.accounts.paid}</dt>
                          <dd className="tabular font-semibold">{formatMoney(d.paid)}</dd>
                        </div>
                      </dl>
                      {!paid && (
                        <p className="text-xs text-text-2">
                          {t.accounts.estimatedEnd}:{" "}
                          {d.estimated_end ? (
                            <>
                              <strong>{formatDate(d.estimated_end)}</strong> ({t.common.estimate}, {t.accounts.monthlyAverage.toLowerCase()} {formatMoney(d.monthly_average)})
                            </>
                          ) : (
                            t.accounts.insufficientData
                          )}
                        </p>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="sec-installments">
        <SectionTitle action={<InstallmentDialog creditAccounts={creditAccounts} today={lookups.today} />}>
          <span id="sec-installments">{t.accounts.installments}</span>
        </SectionTitle>
        {overview.installments.length === 0 ? (
          <EmptyState>{t.accounts.noInstallments}</EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
            {overview.installments.map((i) => (
              <li key={i.installment_id} className={cn("flex min-h-16 items-center gap-3 px-4 py-2", i.status === "paid" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.description || i.account_name}</p>
                  <p className="text-xs text-text-2">
                    {i.account_name} · {formatDate(i.due_date)}
                    {i.days_left !== null && ` · ${t.accounts.daysLeft(i.days_left)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular font-bold">{formatMoney(i.amount)}</span>
                  <Badge tone={installmentTone[i.status]}>{t.installmentStatus[i.status]}</Badge>
                </div>
                {installmentById.get(i.installment_id) && (
                  <InstallmentDialog item={installmentById.get(i.installment_id)} creditAccounts={creditAccounts} today={lookups.today} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sec-recurring">
        <SectionTitle action={<RecurringDialog categories={lookups.categories} accounts={lookups.accounts} />}>
          <span id="sec-recurring">{t.accounts.recurring}</span>
        </SectionTitle>
        <p className="-mt-2 mb-3 text-xs text-text-3 first-letter:uppercase">{t.accounts.recurringMonth(monthLongLabel(monthKey))}</p>
        {overview.recurringStatus.length === 0 ? (
          <EmptyState>{t.accounts.noRecurring}</EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
            {overview.recurringStatus.map((r) => (
              <li key={r.recurring_id} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.description}</p>
                  <p className="text-xs text-text-2">
                    {r.due_date ? formatDate(r.due_date) : t.accounts.noDay}
                    {r.next_date && r.status !== "pending" && r.status !== "overdue" && ` · ${t.accounts.nextDate}: ${formatDate(r.next_date)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular font-bold">{formatMoney(r.amount)}</span>
                  <Badge tone={recurringTone[r.status]}>{t.recurringStatus[r.status]}</Badge>
                </div>
                {recurringById.get(r.recurring_id) && (
                  <RecurringDialog item={recurringById.get(r.recurring_id)} categories={lookups.categories} accounts={lookups.accounts} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
