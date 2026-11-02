import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { SetupData } from "@/lib/setup-data";
import type {
  Account,
  AccountBalance,
  AllocationRow,
  BudgetTrack,
  BudgetUsage,
  CategoryChange,
  AchievementStatus,
  CalendarDay,
  CategoryGroup,
  Checkin,
  Gamification,
  HabitOverview,
  MissionStatus,
  GoalHistory,
  GoalPlan,
  Notification,
  GoalProgress,
  GoalRow,
  HabitSpending,
  InvestmentSummary,
  MonthHistory,
  Category,
  DebtOverview,
  DebtSummary,
  FreeToSpend,
  Installment,
  InstallmentStatus,
  Lookups,
  MonthCoverage,
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
    supabase.from("user_settings").select("financial_month_start_day, default_account_id, timezone, free_to_spend_mode, show_habits").maybeSingle(),
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
  const { data, error } = await supabase.from("presets").select("key, name, description, data").order("name");
  if (error) fail("Presets", error);
  // Building blocks (without accounts) cannot be applied on their own.
  return (data ?? [])
    .filter((p) => p.data && typeof p.data === "object" && "accounts" in p.data)
    .map((p) => ({ key: p.key as string, name: p.name as string, description: p.description as string | null, data: p.data as SetupData }));
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

export async function getMonthCoverage(): Promise<MonthCoverage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("month_coverage");
  if (error) fail("Cobertura do mês", error);
  return data as MonthCoverage;
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

export async function getBudget(monthKey: number) {
  const supabase = await createClient();
  const [usage, groups] = await Promise.all([
    supabase.rpc("budget_usage", { p_month_key: monthKey }),
    supabase.from("category_groups").select("id, name, monthly_budget, sort_order").order("sort_order"),
  ]);
  if (usage.error) fail("Orçamento", usage.error);
  if (groups.error) fail("Grupos", groups.error);
  return { usage: usage.data as BudgetUsage[], groups: groups.data as CategoryGroup[] };
}

export async function getGoalsOverview() {
  const supabase = await createClient();
  const [progress, rows, investments] = await Promise.all([
    supabase.rpc("goal_progress"),
    supabase.from("goals").select("id, name, target_type, target_amount, target_formula, target_date, priority").eq("is_archived", false),
    supabase.rpc("investment_summary"),
  ]);
  if (progress.error) fail("Objetivos", progress.error);
  if (rows.error) fail("Objetivos", rows.error);
  if (investments.error) fail("Investimentos", investments.error);
  const goals = progress.data as GoalProgress[];
  const history = await Promise.all(
    goals.map(async (g) => {
      const { data, error } = await supabase.rpc("goal_history", { p_goal_id: g.goal_id });
      if (error) fail("Histórico do objetivo", error);
      return [g.goal_id, data as GoalHistory[]] as const;
    }),
  );
  return {
    goals,
    rows: rows.data as GoalRow[],
    history: Object.fromEntries(history),
    investments: investments.data as InvestmentSummary[],
  };
}

export async function getGoalPlanning() {
  const supabase = await createClient();
  const [plans, debts] = await Promise.all([supabase.rpc("goal_plans"), supabase.rpc("debt_summary")]);
  if (plans.error) fail("Metas", plans.error);
  if (debts.error) fail("Dívidas", debts.error);
  return { plans: plans.data as GoalPlan[], debts: debts.data as DebtSummary[] };
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("notifications");
  if (error) fail("Notificações", error);
  return data as Notification[];
}

export async function getBudgetTrack(): Promise<BudgetTrack> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("budget_track");
  if (error) fail("Meses dentro do orçamento", error);
  return data as BudgetTrack;
}

export async function getInsights(monthKey: number, previousKey: number, categoryId: string | null) {
  const supabase = await createClient();
  const [current, previous, changes, allocation, history, habits] = await Promise.all([
    getMonthTotals(monthKey),
    getMonthTotals(previousKey),
    supabase.rpc("category_changes", { p_month_key: monthKey }),
    supabase.rpc("allocation_comparison", { p_month_key: monthKey }),
    supabase.rpc("monthly_history"),
    supabase.rpc("habit_spending", { p_category_id: categoryId }),
  ]);
  if (changes.error) fail("Variações", changes.error);
  if (allocation.error) fail("Regra de distribuição", allocation.error);
  if (history.error) fail("Histórico", history.error);
  if (habits.error) fail("Hábitos e gastos", habits.error);
  return {
    current,
    previous,
    changes: changes.data as CategoryChange[],
    allocation: allocation.data as AllocationRow[],
    history: history.data as MonthHistory[],
    habits: habits.data as HabitSpending[],
  };
}

export async function getRecentTransactions(limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Atividade recente", error);
  return data as Transaction[];
}

// Evaluating first keeps finished weeks and months up to date even if the nightly job is not enabled.
export async function getGamification() {
  const supabase = await createClient();
  const evaluated = await supabase.rpc("evaluate_gamification");
  if (evaluated.error) fail("Gamificação", evaluated.error);
  const [overview, missions, achievements] = await Promise.all([
    supabase.rpc("gamification_overview"),
    supabase.rpc("missions_status"),
    supabase.rpc("achievements_status"),
  ]);
  if (overview.error) fail("Progresso", overview.error);
  if (missions.error) fail("Missões", missions.error);
  if (achievements.error) fail("Conquistas", achievements.error);
  return {
    overview: overview.data as Gamification,
    missions: missions.data as MissionStatus[],
    achievements: achievements.data as AchievementStatus[],
  };
}

export async function getRecentCheckins(today: string): Promise<Checkin[]> {
  const supabase = await createClient();
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("day, reviewed, no_expenses, payments_confirmed, budget_checked, weekly_review, debts_goals_reviewed, notes")
    .gte("day", yesterday.toISOString().slice(0, 10))
    .lte("day", today);
  if (error) fail("Revisão", error);
  return data as Checkin[];
}

export async function getReviewCalendar(): Promise<CalendarDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_calendar");
  if (error) fail("Calendário", error);
  return data as CalendarDay[];
}

export async function getHabits(): Promise<HabitOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("habits_overview");
  if (error) fail("Hábitos", error);
  return data as HabitOverview[];
}

export async function getEntityRows(table: string, orderBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").order(orderBy).order("id");
  if (error) fail(table, error);
  return (data ?? []) as Record<string, unknown>[];
}

/** Options for reference fields in the Settings editors. */
export async function getSettingsOptions() {
  const supabase = await createClient();
  const [accounts, categories, groups, methods, recurring, goals, rules] = await Promise.all([
    supabase.from("accounts").select("id, name, type").order("sort_order"),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("category_groups").select("id, name").order("sort_order"),
    supabase.from("payment_methods").select("id, name").order("sort_order"),
    supabase.from("recurring_payments").select("id, description").order("sort_order"),
    supabase.from("goals").select("id, name").eq("is_archived", false).order("sort_order"),
    supabase.from("allocation_rules").select("id, name").order("sort_order"),
  ]);
  for (const r of [accounts, categories, groups, methods, recurring, goals, rules]) if (r.error) fail("Opções", r.error);
  const named = (rows: { id: string; name: string }[] | null) => (rows ?? []).map((r) => ({ value: r.id, label: r.name }));
  return {
    accounts: named(accounts.data),
    creditAccounts: named((accounts.data ?? []).filter((a) => a.type === "credit")),
    categories: named(categories.data),
    groups: named(groups.data),
    methods: named(methods.data),
    recurring: (recurring.data ?? []).map((r) => ({ value: r.id as string, label: r.description as string })),
    goals: named(goals.data),
    rules: named(rules.data),
  };
}

export async function getFullSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
  if (error) fail("Definições", error);
  return data as Record<string, unknown> | null;
}

export async function getDebtOverview(): Promise<DebtOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("debt_overview");
  if (error) fail("Compromissos", error);
  return data as DebtOverview;
}
