"use client";

import { useTxForm } from "./tx-form-provider";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import type { Account, Category, Transaction } from "@/lib/types";
import { t } from "@/i18n";

const SIGN: Record<string, 1 | -1 | 0> = {
  income: 1,
  expense: -1,
  transfer: 0,
  saving: 0,
  debt_payment: 0,
  investment: 0,
};

export function TransactionList({
  transactions,
  alerts,
  categories,
  accounts,
}: {
  transactions: Transaction[];
  alerts: Record<string, string[]>;
  categories: Category[];
  accounts: Account[];
}) {
  const { openEdit } = useTxForm();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const byDate = new Map<string, Transaction[]>();
  for (const tx of transactions) byDate.set(tx.date, [...(byDate.get(tx.date) ?? []), tx]);

  return (
    <div className="flex flex-col gap-5">
      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} aria-label={formatDate(date)}>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-text-3 uppercase">{formatDate(date)}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
            {list.map((tx) => {
              const category = tx.category_id ? categoryById.get(tx.category_id) : undefined;
              const from = accountById.get(tx.account_id)?.name;
              const to = tx.to_account_id ? accountById.get(tx.to_account_id)?.name : undefined;
              const sign = SIGN[tx.type];
              const amount = Number(tx.amount);
              const txAlerts = alerts[tx.id] ?? [];
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(tx)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
                  >
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                      {category?.emoji ?? "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{tx.description || category?.name || t.types[tx.type]}</span>
                      <span className="block truncate text-xs text-text-2">
                        {category?.name ?? t.alerts.missing_category} · {from}
                        {to ? ` → ${to}` : ""}
                      </span>
                      {(txAlerts.length > 0 || tx.split_id) && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {tx.split_id && <Badge tone="info">{t.tx.splitBadge}</Badge>}
                          {txAlerts.map((a) => (
                            <Badge key={a} tone="warning">
                              {t.alerts[a] ?? a}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        "tabular shrink-0 text-right font-bold " +
                        (sign > 0 ? "text-success" : sign < 0 ? "text-text" : "text-text-2")
                      }
                    >
                      {sign > 0 ? "+" : sign < 0 ? "−" : ""}
                      {formatMoney(Math.abs(amount)).replace("-", "")}
                      <span className="block text-[11px] font-medium text-text-3">{t.types[tx.type]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
