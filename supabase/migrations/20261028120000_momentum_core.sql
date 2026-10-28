-- Momentum Web — core finance + gamification schema.
--
-- * The old finance tables are renamed to legacy_* (data kept, nothing dropped).
-- * Every table has user_id + RLS. Child rows reference parents through (id, user_id)
--   so a user can never point a row at another user's category/account.
-- * The code only knows account types, movement types and the rule engine; everything
--   else (categories, budgets, XP, levels...) is per-user data.

-- ---------------------------------------------------------------------------
-- 0. Legacy tables
-- ---------------------------------------------------------------------------
alter table if exists public.transactions rename to legacy_transactions;
alter table if exists public.budgets rename to legacy_budgets;
alter table if exists public.finance_categories rename to legacy_finance_categories;
alter table if exists public.financial_goals rename to legacy_financial_goals;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.momentum_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Applies the standard "own rows only" policy and updated_at trigger to a table.
create or replace function public.momentum_secure_table(p_table text, p_has_updated_at boolean default true)
returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists own_rows on public.%I', p_table);
  execute format(
    'create policy own_rows on public.%I for all to authenticated
       using (user_id = auth.uid()) with check (user_id = auth.uid())', p_table);
  if p_has_updated_at then
    execute format('drop trigger if exists set_updated_at on public.%I', p_table);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.momentum_set_updated_at()', p_table);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Accounts and configuration
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('checking', 'cash', 'savings', 'investment', 'credit')),
  -- Credit accounts hold a negative opening balance (what is owed).
  opening_balance numeric(12, 2) not null default 0,
  -- Movements dated on or after this day change the balance.
  opening_date date not null,
  debt_strategy text check (debt_strategy in ('plan', 'installments')),
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  check ((type = 'credit') = (debt_strategy is not null))
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  financial_month_start_day integer not null default 1 check (financial_month_start_day between 1 and 28),
  default_account_id uuid,
  alert_thresholds numeric[] not null default '{0.7,0.9,1.0}',
  tracking_start_date date,
  timezone text not null default 'Europe/Lisbon',
  rest_days_per_week integer not null default 1 check (rest_days_per_week between 0 and 6),
  min_review_days_week integer not null default 5 check (min_review_days_week between 1 and 7),
  min_review_days_month integer not null default 15 check (min_review_days_month between 1 and 31),
  min_days_for_projection integer not null default 7 check (min_days_for_projection >= 1),
  -- 'projected': while expected income for the month is still missing, show an estimate.
  -- 'actual': only what was received (the Excel behaviour).
  free_to_spend_mode text not null default 'projected' check (free_to_spend_mode in ('projected', 'actual')),
  preset_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (default_account_id, user_id) references public.accounts (id, user_id) on delete set null (default_account_id)
);

create table public.allocation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  pct numeric(5, 4) not null check (pct between 0 and 1),
  -- What "real" means for this block: spending in the linked groups, or saving/investment movements.
  source text not null check (source in ('expense_groups', 'saving', 'investment')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.category_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  monthly_budget numeric(12, 2) check (monthly_budget >= 0),
  allocation_rule_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  foreign key (allocation_rule_id, user_id) references public.allocation_rules (id, user_id) on delete set null (allocation_rule_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  group_id uuid,
  -- Movement type implied by the category (the user never picks it when registering).
  kind text not null check (kind in ('income', 'expense', 'transfer', 'saving', 'debt_payment', 'investment')),
  nature text not null default 'variable' check (nature in ('fixed', 'variable')),
  own_limit numeric(12, 2) check (own_limit >= 0),
  -- Default destination: the credit account for a debt payment, the savings/investment account...
  default_to_account_id uuid,
  -- Tag used by formulas (e.g. income sources 'salary', 'meal_allowance').
  tag text,
  emoji text,
  color text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  foreign key (group_id, user_id) references public.category_groups (id, user_id) on delete set null (group_id),
  foreign key (default_to_account_id, user_id) references public.accounts (id, user_id) on delete set null (default_to_account_id)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);

create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  category_id uuid,
  amount numeric(12, 2) not null check (amount > 0),
  day_of_month integer check (day_of_month between 1 and 31),
  interval_months integer not null default 1 check (interval_months >= 1),
  -- Financial month (YYYYMM) in which a payment falls; with interval N it repeats every N months.
  anchor_month integer check (anchor_month between 190001 and 299912),
  start_month integer check (start_month between 190001 and 299912),
  end_month integer check (end_month between 190001 and 299912),
  account_id uuid,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Free tag referenced by goal formulas, e.g. 'salary', 'meal_allowance'.
  tag text not null,
  category_id uuid,
  account_id uuid,
  amount numeric(12, 2) not null check (amount >= 0),
  expected_day integer check (expected_day between 1 and 31),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (valid_to is null or valid_to >= valid_from),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);

create table public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  category_id uuid,
  account_id uuid,
  payment_method_id uuid,
  recurring_id uuid,
  usual_amount numeric(12, 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (payment_method_id, user_id) references public.payment_methods (id, user_id) on delete set null (payment_method_id),
  foreign key (recurring_id, user_id) references public.recurring_payments (id, user_id) on delete set null (recurring_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_type text not null check (target_type in ('fixed', 'formula')),
  target_amount numeric(12, 2) check (target_amount >= 0),
  -- e.g. {"type":"income_multiple","factor":2,"includes":["salary","meal_allowance"],"round_up":100,"at":"latest"}
  target_formula jsonb,
  target_date date,
  priority integer not null default 2,
  -- Deposits are saving movements in this category.
  category_id uuid,
  account_id uuid,
  milestones numeric[] not null default '{0.25,0.5,0.75,1}',
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  check ((target_type = 'fixed' and target_amount is not null) or (target_type = 'formula' and target_formula is not null)),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);

create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key integer not null check (month_key between 190001 and 299912),
  -- 'debts': all credit accounts with strategy 'plan' (or only account_id when set); 'goal': a goal.
  kind text not null check (kind in ('debts', 'goal')),
  account_id uuid,
  goal_id uuid,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'goal') = (goal_id is not null)),
  check (kind = 'debts' or account_id is null),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create unique index monthly_plans_unique on public.monthly_plans
  (user_id, month_key, kind, coalesce(account_id, goal_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.investment_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  value numeric(12, 2) not null check (value >= 0),
  valued_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, valued_on),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 3. Transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount <> 0),
  type text not null check (type in ('income', 'expense', 'transfer', 'saving', 'debt_payment', 'investment')),
  category_id uuid,
  account_id uuid not null,
  to_account_id uuid,
  payment_method_id uuid,
  split_id uuid,
  recurring_id uuid,
  installment_id uuid,
  shortcut_id uuid,
  description text,
  note text,
  import_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Negative only to withdraw from savings or sell investments.
  check (amount > 0 or type in ('saving', 'investment')),
  check (type not in ('transfer', 'debt_payment') or to_account_id is not null),
  check (to_account_id is null or to_account_id <> account_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (to_account_id, user_id) references public.accounts (id, user_id),
  foreign key (payment_method_id, user_id) references public.payment_methods (id, user_id) on delete set null (payment_method_id),
  foreign key (recurring_id, user_id) references public.recurring_payments (id, user_id) on delete set null (recurring_id),
  foreign key (installment_id, user_id) references public.installments (id, user_id) on delete set null (installment_id),
  foreign key (shortcut_id, user_id) references public.shortcuts (id, user_id) on delete set null (shortcut_id)
);
create index transactions_user_date on public.transactions (user_id, date);
create index transactions_user_category on public.transactions (user_id, category_id);
create index transactions_user_to_account on public.transactions (user_id, to_account_id);
create unique index transactions_import_ref on public.transactions (user_id, import_ref) where import_ref is not null;

-- Fills what can be derived, so registering needs only date, amount and a category or shortcut.
create or replace function public.transactions_fill_defaults()
returns trigger language plpgsql as $$
declare
  v_cat public.categories;
  v_sc public.shortcuts;
begin
  if new.shortcut_id is not null then
    select * into v_sc from public.shortcuts where id = new.shortcut_id and user_id = new.user_id;
    new.category_id := coalesce(new.category_id, v_sc.category_id);
    new.description := coalesce(new.description, v_sc.description, v_sc.name);
    new.account_id := coalesce(new.account_id, v_sc.account_id);
    new.payment_method_id := coalesce(new.payment_method_id, v_sc.payment_method_id);
    new.recurring_id := coalesce(new.recurring_id, v_sc.recurring_id);
  end if;

  if new.category_id is not null then
    select * into v_cat from public.categories where id = new.category_id and user_id = new.user_id;
    if found then
      new.type := v_cat.kind;
      new.to_account_id := coalesce(new.to_account_id, v_cat.default_to_account_id);
      new.description := coalesce(new.description, v_cat.name);
    end if;
  end if;

  if new.account_id is null and new.payment_method_id is not null then
    select account_id into new.account_id
      from public.payment_methods where id = new.payment_method_id and user_id = new.user_id;
  end if;
  if new.account_id is null then
    select default_account_id into new.account_id from public.user_settings where user_id = new.user_id;
  end if;
  if new.account_id is null then
    raise exception 'Falta a conta do movimento e não há conta principal definida.'
      using errcode = '23502';
  end if;
  return new;
end $$;

create trigger transactions_fill_defaults
  before insert or update on public.transactions
  for each row execute function public.transactions_fill_defaults();

-- ---------------------------------------------------------------------------
-- 4. Daily review and gamification definitions
-- ---------------------------------------------------------------------------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  reviewed boolean not null default false,
  no_expenses boolean not null default false,
  payments_confirmed boolean not null default false,
  budget_checked boolean not null default false,
  weekly_review boolean not null default false,
  debts_goals_reviewed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create table public.xp_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  name text not null,
  xp integer not null check (xp >= 0),
  period text not null check (period in ('day', 'week', 'month', 'once')),
  condition jsonb not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  unique (id, user_id)
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level integer not null check (level >= 1),
  name text not null,
  min_xp integer not null check (min_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, level),
  unique (user_id, min_xp)
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  name text not null,
  period text not null check (period in ('day', 'week')),
  condition jsonb not null default '{}',
  xp_rule_id uuid,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  foreign key (xp_rule_id, user_id) references public.xp_rules (id, user_id) on delete set null (xp_rule_id)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  xp integer not null default 0 check (xp >= 0),
  condition jsonb not null default '{}',
  habit_id uuid references public.habits (id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  unique (id, user_id)
);

create table public.achievement_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null,
  unlocked_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, achievement_id),
  foreign key (achievement_id, user_id) references public.achievements (id, user_id) on delete cascade
);

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_id uuid,
  achievement_id uuid,
  -- 'YYYY-MM-DD', 'YYYY-Www', 'YYYYMM' or 'once' depending on the rule's period.
  period_key text not null,
  xp integer not null check (xp >= 0),
  event text,
  earned_on date not null,
  created_at timestamptz not null default now(),
  check ((rule_id is null) <> (achievement_id is null)),
  foreign key (rule_id, user_id) references public.xp_rules (id, user_id) on delete cascade,
  foreign key (achievement_id, user_id) references public.achievements (id, user_id) on delete cascade
);
-- Each rule pays once per period; each achievement once ever. Enforced by the database.
create unique index xp_ledger_rule_once_per_period on public.xp_ledger (user_id, rule_id, period_key) where rule_id is not null;
create unique index xp_ledger_achievement_once on public.xp_ledger (user_id, achievement_id) where achievement_id is not null;

-- System habit support ("Revisão financeira do dia").
alter table public.habits add column if not exists system_key text;
create unique index if not exists habits_system_key on public.habits (user_id, system_key) where system_key is not null;

-- ---------------------------------------------------------------------------
-- 5. Presets (default values live here, never in code)
-- ---------------------------------------------------------------------------
create table public.presets (
  key text primary key,
  name text not null,
  description text,
  -- null = available to everyone; otherwise private to that user.
  owner_id uuid references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.presets enable row level security;
create policy presets_read on public.presets for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create trigger set_updated_at before update on public.presets
  for each row execute function public.momentum_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS + updated_at everywhere
-- ---------------------------------------------------------------------------
select public.momentum_secure_table(t, t not in ('achievement_unlocks', 'xp_ledger'))
from unnest(array[
  'accounts', 'user_settings', 'allocation_rules', 'category_groups', 'categories',
  'payment_methods', 'recurring_payments', 'installments', 'income_sources', 'shortcuts',
  'goals', 'monthly_plans', 'investment_valuations', 'transactions', 'daily_checkins',
  'xp_rules', 'levels', 'missions', 'achievements', 'achievement_unlocks', 'xp_ledger'
]) as t;

-- XP and unlocks are written only by the evaluator (security definer), never directly by clients.
revoke insert, update, delete on public.xp_ledger, public.achievement_unlocks from anon, authenticated;
revoke all on public.presets from anon;
revoke insert, update, delete on public.presets from authenticated;
