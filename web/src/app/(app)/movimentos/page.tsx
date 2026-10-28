import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TransactionList } from "@/components/transactions/transaction-list";
import { SetupMissing } from "@/components/setup/require-setup";
import { getCurrentMonthKey, getLookups, getMonthTotals, getTransactions, isSetUp } from "@/lib/data";
import { formatDate, formatMoney, monthLongLabel, shiftMonthKey } from "@/lib/format";
import { TX_TYPES, type TxType } from "@/lib/types";
import { t } from "@/i18n";

export const metadata = { title: `${t.tx.title} · ${t.app.name}` };

type Search = { mes?: string; categoria?: string; tipo?: string; conta?: string; q?: string };

function href(params: Search) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = qs.toString();
  return s ? `/movimentos?${s}` : "/movimentos";
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await isSetUp())) return <SetupMissing />;
  const params = await searchParams;
  const lookups = await getLookups();

  const requested = Number(params.mes);
  const monthKey = Number.isInteger(requested) && requested % 100 >= 1 && requested % 100 <= 12 ? requested : await getCurrentMonthKey();
  const type = TX_TYPES.includes(params.tipo as TxType) ? (params.tipo as TxType) : undefined;
  const categoryId = lookups.categories.some((c) => c.id === params.categoria) ? params.categoria : undefined;
  const accountId = lookups.accounts.some((a) => a.id === params.conta) ? params.conta : undefined;
  const q = params.q?.slice(0, 80);
  const filtered = Boolean(type || categoryId || accountId || q);

  const totals = await getMonthTotals(monthKey);
  const { transactions, alerts } = await getTransactions(
    { monthKey, type, categoryId, accountId, q },
    { start: totals.start_date, end: totals.end_date },
  );
  const keep = { categoria: categoryId, tipo: type, conta: accountId, q };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t.tx.title}</h1>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={href({ ...keep, mes: String(shiftMonthKey(monthKey, -1)) })}
          aria-label={t.tx.previousMonth}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="text-center">
          <p className="font-bold capitalize">{monthLongLabel(monthKey)}</p>
          <p className="text-xs text-text-3">{t.tx.monthRange(formatDate(totals.start_date), formatDate(totals.end_date))}</p>
        </div>
        <Link
          href={href({ ...keep, mes: String(shiftMonthKey(monthKey, 1)) })}
          aria-label={t.tx.nextMonth}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs font-semibold text-text-2">{t.tx.income}</p>
          <p className="tabular text-lg font-bold text-success">{formatMoney(totals.income)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-text-2">{t.tx.expenses}</p>
          <p className="tabular text-lg font-bold">{formatMoney(totals.expenses)}</p>
        </Card>
      </div>

      <form method="get" action="/movimentos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <input type="hidden" name="mes" value={monthKey} />
        <label className="relative sm:col-span-2 lg:col-span-4">
          <span className="sr-only">{t.tx.search}</span>
          <Search className="pointer-events-none absolute top-3 left-3 size-5 text-text-3" aria-hidden />
          <Input name="q" defaultValue={q} placeholder={t.tx.searchPlaceholder} className="pl-10" />
        </label>
        <label>
          <span className="sr-only">{t.tx.category}</span>
          <Select name="categoria" defaultValue={categoryId ?? ""}>
            <option value="">{t.tx.allCategories}</option>
            {lookups.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">{t.accounts.type}</span>
          <Select name="tipo" defaultValue={type ?? ""}>
            <option value="">{t.tx.allTypes}</option>
            {TX_TYPES.map((k) => (
              <option key={k} value={k}>
                {t.types[k]}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">{t.tx.account}</span>
          <Select name="conta" defaultValue={accountId ?? ""}>
            <option value="">{t.tx.allAccounts}</option>
            {lookups.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1">
            {t.tx.filters}
          </Button>
          {filtered && (
            <Link href={href({ mes: String(monthKey) })} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary">
              {t.tx.clearFilters}
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-text-2" aria-live="polite">
        {t.tx.count(transactions.length)}
      </p>
      {transactions.length === 0 ? (
        <EmptyState>{filtered ? t.tx.emptyFiltered : t.tx.empty}</EmptyState>
      ) : (
        <TransactionList
          transactions={transactions}
          alerts={Object.fromEntries(alerts)}
          categories={lookups.categories}
          accounts={lookups.accounts}
        />
      )}
    </div>
  );
}
