import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { AccountDialog } from "@/components/accounts/forms";
import type { AccountBalance, Lookups } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

export function AccountsView({
  lookups,
  balances,
  moneyInAccounts,
}: {
  lookups: Lookups;
  balances: AccountBalance[];
  moneyInAccounts: number;
}) {
  const accountById = new Map(lookups.accounts.map((a) => [a.id, a]));
  const rows = balances.filter((b) => b.type !== "credit" && !b.is_archived).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle action={<AccountDialog today={lookups.today} />}>
        <span className="text-2xl font-extrabold">{t.accounts.accounts}</span>
      </SectionTitle>
      <Card>
        <p className="text-sm font-semibold text-text-2">{t.accounts.moneyInAccounts}</p>
        <p className="tabular text-3xl font-extrabold">{formatMoney(moneyInAccounts)}</p>
        <p className="mt-1 text-xs text-text-3">{t.accounts.moneyHint}</p>
      </Card>
      {rows.length === 0 ? (
        <EmptyState>{t.accounts.noAccounts}</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
          {rows.map((b) => (
            <li key={b.account_id} className="flex min-h-16 items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="text-xs text-text-3">{t.accountTypes[b.type]}</p>
              </div>
              <p className={cn("tabular font-bold", Number(b.balance) < 0 && "text-error")}>{formatMoney(b.balance)}</p>
              {accountById.get(b.account_id) && <AccountDialog account={accountById.get(b.account_id)} today={lookups.today} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
