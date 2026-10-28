-- Reconstruction of the live public schema (columns from information_schema, 28/10/2026).
-- Test-only: constraints and policies of the real project are approximated.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  motivation text not null default 'Consistência vence intensidade.',
  primary_goal text,
  preferred_currency text not null default 'EUR',
  week_starts_on integer not null default 1,
  timezone text not null default 'Europe/Lisbon',
  locale text not null default 'pt-PT',
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notifications_enabled boolean not null default true,
  biometrics_enabled boolean not null default false,
  dark_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text,
  color text,
  created_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.habit_categories (id) on delete set null,
  name text not null,
  emoji text not null default '✅',
  color text not null default '#E8F5EE',
  frequency_type text not null default 'daily',
  target_per_period integer not null default 1,
  time_of_day time,
  reminder_enabled boolean not null default false,
  notes text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_schedule_days (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  weekday integer not null
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  status text not null default 'done',
  value numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  emoji text,
  color text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  period_month date not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.finance_categories (id) on delete set null,
  type text not null,
  amount numeric not null,
  description text,
  transaction_date date not null,
  recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '🎯',
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date,
  notes text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','habit_categories','habits','habit_logs',
                           'finance_categories','budgets','transactions','financial_goals'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy own on public.profiles using (id = auth.uid()) with check (id = auth.uid());
create policy own on public.user_preferences using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.habit_categories using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.habits using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.habit_logs using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.finance_categories using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.budgets using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.transactions using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.financial_goals using (user_id = auth.uid()) with check (user_id = auth.uid());
