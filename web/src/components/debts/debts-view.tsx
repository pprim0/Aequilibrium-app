import { Badge, type Tone } from "@/components/ui/badge";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { AccountDialog, InstallmentDialog } from "@/components/accounts/forms";
import { PaymentsSection } from "./payments-section";
import type { DebtOverview, DebtSummary, Installment, InstallmentStatus, Lookups, RecurringPayment, RecurringStatus } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

const installmentTone: Record<string, Tone> = {
  paid: "success",
  overdue: "error",
  due_this_month: "warning",
  later: "neutral",
};

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-text-2">{label}</p>
      <p className="tabular mt-0.5 font-bold">{value}</p>
      {detail && <p className="truncate text-xs text-text-3">{detail}</p>}
    </div>
  );
}

export function DebtsView({
  lookups,
  overview,
  debts,
  installments,
  installmentRows,
  recurringStatus,
  recurring,
}: {
  lookups: Lookups;
  overview: DebtOverview;
  debts: DebtSummary[];
  installments: InstallmentStatus[];
  installmentRows: Installment[];
  recurringStatus: RecurringStatus[];
  recurring: RecurringPayment[];
}) {
  const accountById = new Map(lookups.accounts.map((a) => [a.id, a]));
  const installmentById = new Map(installmentRows.map((i) => [i.id, i]));
  const creditAccounts = lookups.accounts.filter((a) => a.type === "credit" && !a.is_archived);
  const cards = debts.filter((d) => d.is_credit_card);
  const others = debts.filter((d) => !d.is_credit_card);
  const open = others.filter((d) => d.status !== "paid").sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
  const paid = others.filter((d) => d.status === "paid");
  const next = overview.next_due;
  const planned = overview.planned_this_month;
  const inDebt = Number(overview.outstanding) > 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t.debts.title}</h1>

      <Card className={cn("flex flex-col gap-3", inDebt ? "border-error/30 bg-error-pale" : "bg-primary-pale")}>
        <div>
          <p className={cn("text-sm font-semibold", inDebt ? "text-error" : "text-text-2")}>{inDebt ? t.debts.totalOwed : t.debts.noDebtsTotal}</p>
          <p className={cn("tabular text-3xl font-extrabold", inDebt && "text-error")}>{formatMoney(overview.outstanding)}</p>
        </div>
        {overview.progress !== null && (
          <div>
            <Meter value={Number(overview.progress)} label={t.debts.totalOwed} />
            <p className="tabular mt-1 text-xs text-text-2">{t.debts.paidOf(formatMoney(overview.paid), formatMoney(overview.borrowed))}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
          <Metric
            label={t.debts.paidThisMonth}
            value={formatMoney(overview.paid_this_month)}
            detail={planned !== null ? t.debts.ofPlan(formatMoney(planned)) : undefined}
          />
          <Metric
            label={t.debts.nextPayment}
            value={next ? formatMoney(next.amount) : t.common.none}
            detail={next ? `${next.name} · ${formatDate(next.date)}` : t.debts.nothingScheduled}
          />
          {overview.cards > 0 && (
            <Metric label={t.debts.availableCredit} value={overview.available_credit !== null ? formatMoney(overview.available_credit) : t.common.none} detail={overview.available_credit === null ? t.debts.setLimit : undefined} />
          )}
        </div>
      </Card>

      <PaymentsSection statuses={recurringStatus} recurring={recurring} installments={installments} categories={lookups.categories} accounts={lookups.accounts} />

      <section aria-labelledby="sec-cards">
        <SectionTitle action={<AccountDialog today={lookups.today} debt card />}>
          <span id="sec-cards">{t.debts.cards}</span>
        </SectionTitle>
        {cards.length === 0 ? (
          <EmptyState>{t.debts.noCards}</EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
            {cards.map((c) => {
              const limit = c.credit_limit === null ? null : Number(c.credit_limit);
              const used = Number(c.outstanding);
              return (
                <li key={c.account_id} className="flex min-h-16 items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-semibold">{c.name}</p>
                      {used === 0 ? <Badge tone="success">{t.debts.noBalance}</Badge> : <span className="tabular shrink-0 font-bold text-error">{formatMoney(used)}</span>}
                    </div>
                    {limit !== null ? (
                      <div className="mt-2">
                        <Meter value={limit > 0 ? used / limit : 0} label={c.name} />
                        <p className="tabular mt-1 text-xs text-text-2">{t.debts.limitLine(formatMoney(c.available_credit), formatMoney(limit))}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-text-3">{t.debts.setLimit}</p>
                    )}
                  </div>
                  {accountById.get(c.account_id) && <AccountDialog account={accountById.get(c.account_id)} today={lookups.today} debt card />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="sec-debts">
        <SectionTitle action={<AccountDialog today={lookups.today} debt />}>
          <span id="sec-debts">{t.debts.others}</span>
        </SectionTitle>
        {open.length === 0 && paid.length === 0 ? (
          <EmptyState>{t.accounts.noDebts}</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {open.length > 0 && (
              <ul className="grid items-start gap-3 lg:grid-cols-2">
                {open.map((d) => {
                  const own = installments.filter((i) => i.account_id === d.account_id);
                  const pending = own.filter((i) => i.status !== "paid");
                  const nextOwn = pending[0];
                  const debtAccount = creditAccounts.filter((a) => a.id === d.account_id);
                  return (
                    <li key={d.account_id}>
                      <Card className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate font-bold">{d.name}</p>
                          {accountById.get(d.account_id) && <AccountDialog account={accountById.get(d.account_id)} today={lookups.today} debt />}
                        </div>
                        <p className="tabular text-2xl font-extrabold text-error">{formatMoney(d.outstanding)}</p>
                        {d.progress !== null && <Meter value={Number(d.progress)} label={d.name} />}
                        <p className="tabular text-xs text-text-2">{t.debts.paidOf(formatMoney(d.paid), formatMoney(d.total_borrowed))}</p>
                        {nextOwn && (
                          <p className={cn("tabular text-xs font-semibold", nextOwn.status === "overdue" ? "text-error" : "text-text-2")}>
                            {t.debts.nextInstallment(formatMoney(nextOwn.amount), formatDate(nextOwn.due_date))}
                          </p>
                        )}
                        <details>
                          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.debts.details}</summary>
                          <dl className="grid grid-cols-2 gap-2 pb-2 text-xs">
                            <div>
                              <dt className="text-text-3">{t.accounts.debtStrategy}</dt>
                              <dd className="font-semibold">{t.debtStrategies[d.debt_strategy]}</dd>
                            </div>
                            <div>
                              <dt className="text-text-3">{t.accounts.estimatedEnd}</dt>
                              <dd className="font-semibold">{d.estimated_end ? `${formatDate(d.estimated_end)} (${t.common.estimate})` : t.debts.noEstimate}</dd>
                            </div>
                          </dl>
                          <p className="mb-1 text-xs font-semibold text-text-2">{t.accounts.installments}</p>
                          {own.length > 0 && (
                            <ul className="divide-y divide-border">
                              {own.map((i) => (
                                <li key={i.installment_id} className={cn("flex min-h-12 items-center gap-2 py-1", i.status === "paid" && "opacity-60")}>
                                  <span className="min-w-0 flex-1 text-xs">
                                    <span className="tabular block font-semibold">{formatMoney(i.amount)}</span>
                                    {formatDate(i.due_date)}
                                  </span>
                                  <Badge tone={installmentTone[i.status]}>{t.installmentStatus[i.status]}</Badge>
                                  {installmentById.get(i.installment_id) && <InstallmentDialog item={installmentById.get(i.installment_id)} creditAccounts={debtAccount} today={lookups.today} />}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2">
                            <InstallmentDialog creditAccounts={debtAccount} today={lookups.today} />
                          </div>
                        </details>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
            {paid.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-text-2">{t.accounts.paidDebts}</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card opacity-70">
                  {paid.map((d) => (
                    <li key={d.account_id} className="flex min-h-14 items-center gap-2 px-4 py-1">
                      <p className="min-w-0 flex-1 truncate font-semibold">{d.name}</p>
                      <Badge tone="muted">{t.debtStatus.paid}</Badge>
                      {accountById.get(d.account_id) && <AccountDialog account={accountById.get(d.account_id)} today={lookups.today} debt />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
