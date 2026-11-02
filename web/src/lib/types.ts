// Row shapes returned by the Supabase schema (supabase/migrations). Numeric columns arrive as strings or numbers.

export type Numeric = number | string;

export type AccountType = "checking" | "cash" | "savings" | "investment" | "credit" | "benefit";
export type TxType = "income" | "expense" | "transfer" | "saving" | "debt_payment" | "investment";

export const TX_TYPES: TxType[] = ["income", "expense", "transfer", "saving", "debt_payment", "investment"];
export const ACCOUNT_TYPES: AccountType[] = ["checking", "cash", "savings", "investment", "credit", "benefit"];

/** Movement types that move money into another account. */
export const TYPES_WITH_DESTINATION: TxType[] = ["transfer", "saving", "debt_payment", "investment"];

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: Numeric;
  opening_date: string;
  debt_strategy: "plan" | "installments" | null;
  is_credit_card?: boolean;
  credit_limit?: Numeric | null;
  sort_order: number;
  is_archived: boolean;
};

export type Category = {
  id: string;
  name: string;
  kind: TxType;
  group_id: string | null;
  nature: "fixed" | "variable";
  own_limit: Numeric | null;
  default_to_account_id: string | null;
  default_account_id: string | null;
  benefit_eligible: boolean;
  emoji: string | null;
  sort_order: number;
  is_archived: boolean;
};

export type PaymentMethod = { id: string; name: string; account_id: string | null; sort_order: number };

export type Shortcut = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  account_id: string | null;
  payment_method_id: string | null;
  recurring_id: string | null;
  usual_amount: Numeric | null;
  sort_order: number;
};

export type Settings = {
  financial_month_start_day: number;
  default_account_id: string | null;
  timezone: string;
  free_to_spend_mode: "projected" | "actual";
  show_habits: boolean;
};

export type Notification = {
  kind: "payment_overdue" | "payment_due" | "budget_limit" | "payment_no_day" | "weekly_review";
  name: string | null;
  amount: Numeric | null;
  budget: Numeric | null;
  due_date: string | null;
  level: string | null;
};

export type GoalPlan = {
  goal_id: string;
  months_left: number | null;
  monthly_needed: Numeric | null;
  monthly_average: Numeric | null;
  estimated_date: string | null;
  on_track: boolean | null;
};

export type BudgetTrack = { total: number; within: number; streak: number };

export type Transaction = {
  id: string;
  date: string;
  amount: Numeric;
  type: TxType;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  payment_method_id: string | null;
  split_id: string | null;
  recurring_id: string | null;
  shortcut_id: string | null;
  description: string | null;
  note: string | null;
  created_at: string;
};

export type RecurringPayment = {
  id: string;
  description: string;
  category_id: string | null;
  amount: Numeric;
  day_of_month: number | null;
  interval_months: number;
  anchor_month: number | null;
  start_month: number | null;
  end_month: number | null;
  account_id: string | null;
};

export type Installment = {
  id: string;
  account_id: string;
  amount: Numeric;
  due_date: string;
  description: string | null;
};

export type AccountBalance = {
  account_id: string;
  name: string;
  type: AccountType;
  debt_strategy: string | null;
  sort_order: number;
  is_archived: boolean;
  balance: Numeric;
  debt_outstanding: Numeric | null;
};

export type DebtOverview = {
  outstanding: Numeric;
  borrowed: Numeric;
  paid: Numeric;
  progress: Numeric | null;
  open_count: number;
  cards: number;
  available_credit: Numeric | null;
  paid_this_month: Numeric;
  planned_this_month: Numeric | null;
  next_due: { name: string; amount: Numeric; date: string; overdue: boolean } | null;
};

export type DebtSummary = {
  account_id: string;
  name: string;
  debt_strategy: string;
  is_credit_card: boolean;
  credit_limit: Numeric | null;
  available_credit: Numeric | null;
  initial: Numeric;
  new_purchases: Numeric;
  total_borrowed: Numeric;
  paid: Numeric;
  outstanding: Numeric;
  progress: Numeric | null;
  months_with_payment: number;
  monthly_average: Numeric | null;
  estimated_end: string | null;
  status: "paid" | "in_progress" | "not_started";
};

export type RecurringStatus = {
  recurring_id: string;
  description: string;
  category_id: string | null;
  amount: Numeric;
  day_of_month: number | null;
  interval_months: number;
  due_date: string | null;
  status: "paid" | "pending" | "overdue" | "not_this_month" | "not_started" | "ended";
  next_date: string | null;
};

export type InstallmentStatus = {
  installment_id: string;
  account_id: string;
  account_name: string;
  amount: Numeric;
  due_date: string;
  description: string | null;
  status: "paid" | "overdue" | "due_this_month" | "later";
  days_left: number | null;
};

export type MonthTotals = {
  month_key: number;
  start_date: string;
  end_date: string;
  income: Numeric;
  expenses: Numeric;
  credit_expenses: Numeric;
  fixed_expenses: Numeric;
  variable_expenses: Numeric;
  debt_payments: Numeric;
  savings: Numeric;
  investments: Numeric;
  net: Numeric;
};

export type FreeToSpend = {
  month_key: number;
  state: "ok" | "no_income" | "projected";
  available: Numeric;
  benefit_balance: Numeric;
  pending_recurring: Numeric;
  pending_installments: Numeric;
  reserved_debts: Numeric;
  reserved_goals: Numeric;
  has_plan: boolean;
  free: Numeric;
  free_projected: Numeric;
  missing_expected_income: Numeric;
};

export type MonthCoverage = {
  budget_remaining: Numeric;
  eligible_remaining: Numeric;
  benefit_covered: Numeric;
  needed_from_accounts: Numeric;
  free: Numeric;
  difference: Numeric;
};

/** Lookups the registration form needs (all small per-user lists). */
export type Lookups = {
  settings: Settings | null;
  accounts: Account[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  shortcuts: Shortcut[];
  today: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

export type BudgetUsage = {
  scope: "group" | "category";
  id: string;
  name: string;
  group_id: string | null;
  budget: Numeric | null;
  spent: Numeric;
  pct: Numeric | null;
  level: "none" | "ok" | "yellow" | "orange" | "red";
};

export type Milestone = { pct: number; amount: number; reached_on: string | null };

export type GoalProgress = {
  goal_id: string;
  name: string;
  target: Numeric | null;
  saved: Numeric;
  remaining: Numeric | null;
  progress: Numeric | null;
  target_date: string | null;
  status: "no_category" | "no_target" | "reached" | "overdue" | "in_progress";
  milestones: Milestone[];
};

export type GoalRow = {
  id: string;
  name: string;
  target_type: "fixed" | "formula";
  target_amount: Numeric | null;
  target_formula: { factor?: number; includes?: string[]; round_up?: number; at?: string } | null;
  target_date: string | null;
  priority: number;
};

export type GoalHistory = { month_key: number; deposited: Numeric; accumulated: Numeric; target: Numeric | null; progress: Numeric | null };

export type InvestmentSummary = {
  category_id: string;
  name: string;
  deposited: Numeric;
  sold: Numeric;
  invested: Numeric;
  current_value: Numeric | null;
  valued_on: string | null;
  gain: Numeric | null;
  gain_pct: Numeric | null;
};

export type MonthHistory = {
  month_key: number;
  is_current: boolean;
  income: Numeric;
  expenses: Numeric;
  fixed_expenses: Numeric;
  variable_expenses: Numeric;
  debt_payments: Numeric;
  savings: Numeric;
  investments: Numeric;
  debt_outstanding: Numeric;
};

export type CategoryChange = {
  category_id: string;
  name: string;
  emoji: string | null;
  nature: "fixed" | "variable";
  current_amount: Numeric;
  previous_amount: Numeric;
  change: Numeric;
};

export type HabitSpending = {
  habit_id: string;
  name: string;
  emoji: string | null;
  days_done: number;
  days_not_done: number;
  avg_done: Numeric | null;
  avg_not_done: Numeric | null;
  difference: Numeric | null;
  enough_data: boolean;
};

export type AllocationRow = {
  rule_id: string;
  name: string;
  pct: Numeric;
  recommended: Numeric;
  actual: Numeric;
  difference: Numeric;
  debt_phase: boolean;
};

export type CategoryGroup = { id: string; name: string; monthly_budget: Numeric | null; sort_order: number };

export type Gamification = {
  xp_total: number;
  level: number | null;
  level_name: string | null;
  next_level_name: string | null;
  xp_to_next: number | null;
  level_progress: Numeric;
  xp_by_source: { source: string | null; xp: number }[];
  streak: number;
  best_streak: number;
  reviewed_today: boolean;
  days_reviewed_month: number;
  days_elapsed_month: number;
};

export type MissionStatus = {
  mission_id: string;
  name: string;
  period: "day" | "week";
  xp: number;
  done: boolean;
  kind: string | null;
  current_value: Numeric | null;
  target_value: Numeric | null;
};

export type AchievementStatus = {
  achievement_id: string;
  name: string;
  description: string | null;
  xp: number;
  unlocked_on: string | null;
};

export type CalendarDay = { day: string; reviewed: boolean; is_rest: boolean; is_today: boolean; streak: number };

export type Checkin = {
  day: string;
  reviewed: boolean;
  no_expenses: boolean;
  payments_confirmed: boolean;
  budget_checked: boolean;
  weekly_review: boolean;
  debts_goals_reviewed: boolean;
  notes: string | null;
};

export type HabitOverview = {
  habit_id: string;
  name: string;
  emoji: string;
  color: string;
  frequency_type: "daily" | "weekly" | "specific_days";
  target_per_period: number;
  time_of_day: string | null;
  system_key: string | null;
  weekdays: number[];
  scheduled_today: boolean;
  done_today: boolean;
  done_this_week: number;
  current_streak: number;
  best_streak: number;
  streak_unit: "days" | "weeks";
};
