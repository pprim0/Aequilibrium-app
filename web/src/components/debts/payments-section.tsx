import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/card";
import { RecurringDialog } from "@/components/accounts/forms";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Account, Category, InstallmentStatus, RecurringPayment, RecurringStatus } from "@/lib/types";
import { t } from "@/i18n";

const recurringTone: Record<string, Tone> = {
  paid: "success",
  pending: "warning",
  overdue: "error",
  not_this_month: "muted",
  not_started: "muted",
  ended: "muted",
};

export function PaymentsSection({
  statuses,
  recurring,
  installments,
  categories,
  accounts,
}: {
  statuses: RecurringStatus[];
  recurring: RecurringPayment[];
  installments: InstallmentStatus[];
  categories: Category[];
  accounts: Account[];
}) {
  const byId = new Map(recurring.map((r) => [r.id, r]));
  const toPay = [
    ...statuses
      .filter((r) => r.status === "pending" || r.status === "overdue")
      .map((r) => ({ key: r.recurring_id, name: r.description, amount: Number(r.amount), date: r.due_date, overdue: r.status === "overdue" })),
    ...installments
      .filter((i) => i.status === "overdue" || i.status === "due_this_month")
      .map((i) => ({ key: i.installment_id, name: i.account_name, amount: Number(i.amount), date: i.due_date as string | null, overdue: i.status === "overdue" })),
  ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const total = toPay.reduce((sum, p) => sum + p.amount, 0);

  return (
    <section aria-labelledby="sec-payments" className="flex flex-col gap-3">
      <SectionTitle>
        <span id="sec-payments">{t.debts.toPay}</span>
      </SectionTitle>
      {toPay.length === 0 ? (
        <EmptyState>{t.debts.nothingToPay}</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
          <ul className="divide-y divide-border">
            {toPay.map((p) => (
              <li key={p.key} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className={cn("block text-xs", p.overdue ? "font-semibold text-error" : "text-text-2")}>
                    {p.overdue ? t.recurringStatus.overdue : p.date ? formatDate(p.date) : t.accounts.noDay}
                  </span>
                </span>
                <span className={cn("tabular shrink-0 font-bold", p.overdue && "text-error")}>{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-baseline justify-between gap-3 border-t border-border px-4 py-3 text-sm font-bold">
            <span>{t.debts.totalToPay}</span>
            <span className="tabular">{formatMoney(total)}</span>
          </p>
        </div>
      )}
      {statuses.length > 0 && (
        <details className="rounded-[var(--radius-md)] border border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">{t.debts.allRecurring(statuses.length)}</summary>
          <ul className="divide-y divide-border border-t border-border">
            {statuses.map((r) => (
              <li key={r.recurring_id} className="flex min-h-14 items-center gap-2 px-4 py-1">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.description}</span>
                  <span className="tabular block text-xs text-text-2">{formatMoney(r.amount)}</span>
                </span>
                <Badge tone={recurringTone[r.status]}>{t.recurringStatus[r.status]}</Badge>
                {byId.get(r.recurring_id) && <RecurringDialog item={byId.get(r.recurring_id)} categories={categories} accounts={accounts} />}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div>
        <RecurringDialog categories={categories} accounts={accounts} />
      </div>
    </section>
  );
}
