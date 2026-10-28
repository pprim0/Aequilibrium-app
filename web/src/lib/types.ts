// Row shapes returned by the Supabase schema (supabase/migrations). Numeric columns arrive as strings or numbers.

export type Numeric = number | string;

export type AccountType = "checking" | "cash" | "savings" | "investment" | "credit";
export type TxType = "income" | "expense" | "transfer" | "saving" | "debt_payment" | "investment";

export const TX_TYPES: TxType[] = ["income", "expense", "transfer", "saving", "debt_payment", "investment"];
export const ACCOUNT_TYPES: AccountType[] = ["checking", "cash", "savings", "investment", "credit"];

/** Movement types that move money into another account. */
export const TYPES_WITH_DESTINATION: TxType[] = ["transfer", "saving", "debt_payment", "investment"];

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: Numeric;
  opening_date: string;
  debt_strategy: "plan" | "installments" | null;
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
};

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

export type DebtSummary = {
  account_id: string;
  name: string;
  debt_strategy: string;
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
  debt_payments: Numeric;
  savings: Numeric;
  investments: Numeric;
  net: Numeric;
};

export type FreeToSpend = {
  month_key: number;
  state: "ok" | "no_income" | "projected";
  free: Numeric;
  free_projected: Numeric;
  missing_expected_income: Numeric;
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
