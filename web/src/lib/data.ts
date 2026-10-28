import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type {
  Account,
  AccountBalance,
  Category,
  DebtSummary,
  FreeToSpend,
  Installment,
  InstallmentStatus,
  Lookups,
  MonthTotals,
  PaymentMethod,
  RecurringPayment,
  RecurringStatus,
  Settings,
  Shortcut,
  Transaction,
  TxType,
} from "@/lib/types";

// Data access layer: every read goes through here and runs under the user's RLS.
// Numbers come from the SQL functions (supabase/migrations/*_calc.sql); nothing is recalculated here.

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "erro desconhecido"}`);
}

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return user;
});

export const getLookups = cache(async (): Promise<Lookups> => {
  await getUser();
  const supabase = await createClient();
  const [settings, accounts, categories, methods, shortcuts] = await Promise.all([
    supabase.from("user_settings").select("financial_month_start_day, default_account_id, timezone, free_to_spend_mode").maybeSingle(),
    supabase.from("accounts").select("*").order("sort_order").order("name"),
    supabase.from("categories").select("*").eq("is_archived", false).order("sort_order").order("name"),
    supabase.from("payment_methods").select("*").order("sort_order").order("name"),
    supabase.from("shortcuts").select("*").order("sort_order").order("name"),
  ]);
  if (settings.error) fail("Definições", settings.error);
  if (accounts.error) fail("Contas", accounts.error);
  if (categories.error) fail("Categorias", categories.error);
  if (methods.error) fail("Métodos de pagamento", methods.error);
  if (shortcuts.error) fail("Atalhos", shortcuts.error);
  const s = settings.data as Settings | null;
  return {
    settings: s,
    accounts: accounts.data as Account[],
    categories: categories.data as Category[],
    paymentMethods: methods.data as PaymentMethod[],
    shortcuts: shortcuts.data as Shortcut[],
    today: todayISO(s?.timezone),
  };
});

export async function isSetUp(): Promise<boolean> {
  const lookups = await getLookups();
  return lookups.accounts.length > 0 && lookups.categories.length > 0;
}

export async function getPresets() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("presets").select("key, name, description, data");
  if (error) fail("Presets", error);
  // Building blocks (without accounts) cannot be applied on their own.
  return (data ?? [])
    .filter((p) => p.data && typeof p.data === "object" && "accounts" in p.data)
    .map((p) => ({ key: p.key as string, name: p.name as string, description: p.description as string | null }));
}

export async function getCurrentMonthKey(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_month_key");
  if (error) fail("Mês atual", error);
  return data as number;
}

export async function getMonthTotals(monthKey: number): Promise<MonthTotals> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("month_totals", { p_month_key: monthKey }).single();
  if (error) fail("Totais do mês", error);
  return data as MonthTotals;
}

export async function getFreeToSpend(): Promise<FreeToSpend> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("free_to_spend");
  if (error) fail("Livre para gastar", error);
  return data as FreeToSpend;
}

export async function getSpentToday(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("spent_on");
  if (error) fail("Gasto hoje", error);
  return Number(data);
}

export type TransactionFilters = {
  monthKey: number;
  categoryId?: string;
  type?: TxType;
  accountId?: string;
  q?: string;
};

export async function getTransactions(filters: TransactionFilters, range: { start: string; end: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.accountId) {
    query = query.or(`account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`);
  }
  if (filters.q) {
    // PostgREST filter syntax: strip characters with special meaning.
    const q = filters.q.replace(/[,()%*\\]/g, " ").trim();
    if (q) query = query.or(`description.ilike.%${q}%,note.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) fail("Movimentos", error);
  const transactions = data as Transaction[];

  const alerts = new Map<string, string[]>();
  if (transactions.length > 0) {
    const { data: rows, error: alertError } = await supabase
      .from("transaction_alerts")
      .select("transaction_id, alert")
      .in("transaction_id", transactions.map((tx) => tx.id));
    if (alertError) fail("Alertas", alertError);
    for (const row of rows ?? []) {
      alerts.set(row.transaction_id, [...(alerts.get(row.transaction_id) ?? []), row.alert]);
    }
  }
  return { transactions, alerts };
}

export async function getAccountsOverview(monthKey: number) {
  const supabase = await createClient();
  const [balances, money, debts, installments, recurringStatus, recurring, installmentRows] = await Promise.all([
    supabase.rpc("account_balances"),
    supabase.rpc("money_in_accounts"),
    supabase.rpc("debt_summary"),
    supabase.rpc("installment_status"),
    supabase.rpc("recurring_status", { p_month_key: monthKey }),
    supabase.from("recurring_payments").select("*").eq("is_archived", false).order("sort_order"),
    supabase.from("installments").select("*").order("due_date"),
  ]);
  if (balances.error) fail("Saldos", balances.error);
  if (money.error) fail("Dinheiro nas contas", money.error);
  if (debts.error) fail("Dívidas", debts.error);
  if (installments.error) fail("Prestações", installments.error);
  if (recurringStatus.error) fail("Pagamentos fixos", recurringStatus.error);
  if (recurring.error) fail("Pagamentos fixos", recurring.error);
  if (installmentRows.error) fail("Prestações", installmentRows.error);
  return {
    balances: balances.data as AccountBalance[],
    moneyInAccounts: Number(money.data),
    debts: debts.data as DebtSummary[],
    installments: (installments.data as InstallmentStatus[]).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    recurringStatus: recurringStatus.data as RecurringStatus[],
    recurring: recurring.data as RecurringPayment[],
    installmentRows: installmentRows.data as Installment[],
  };
}
