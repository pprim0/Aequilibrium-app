-- Momentum Web — rules of the updated Excel (registo_gastos_v2, Nov 2026).
--
-- * New account type 'benefit' (meal card): usable only for some purchases, so it stays out of
--   "free to spend" and "money in accounts" and is shown apart.
-- * "Free to spend" now starts from the money available today (checking + cash), minus what is
--   still to pay this month and what the monthly plan still reserves.
-- * month_coverage(): is the free money enough for the budgets still to be spent?
-- Safe to run more than once.

alter table public.accounts drop constraint if exists accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('checking', 'cash', 'savings', 'investment', 'credit', 'benefit'));

-- Account a movement in this category comes from or goes into by default (e.g. the meal allowance).
alter table public.categories add column if not exists default_account_id uuid;
-- Can be paid with a benefit account (food categories).
alter table public.categories add column if not exists benefit_eligible boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_default_account_fkey') then
    alter table public.categories add constraint categories_default_account_fkey
      foreign key (default_account_id, user_id) references public.accounts (id, user_id)
      on delete set null (default_account_id);
  end if;
end $$;

-- The Excel shows what actually happened; an estimate is now something to opt into.
alter table public.user_settings alter column free_to_spend_mode set default 'actual';
update public.user_settings set free_to_spend_mode = 'actual' where free_to_spend_mode = 'projected';
update public.presets set data = jsonb_set(data, '{settings,free_to_spend_mode}', '"actual"')
where data #> '{settings,free_to_spend_mode}' is not null;

-- Account chosen when none is given: payment method, then the category's, then the main account.
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
  if new.account_id is null and v_cat.default_account_id is not null then
    new.account_id := v_cat.default_account_id;
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

-- free = checking + cash today - recurring/installments still to pay - what the plan still reserves.
create or replace function public.free_to_spend(
  p_month_key integer default null, p_today date default null, p_user uuid default auth.uid())
returns jsonb language plpgsql stable as $$
declare
  v_key integer := coalesce(p_month_key, public.current_month_key(p_user));
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_sd integer := public.momentum_start_day(p_user);
  v_s date := public.fin_month_start(v_key, v_sd);
  v_e date := public.fin_month_end(v_key, v_sd);
  v_mode text := coalesce((select free_to_spend_mode from public.user_settings where user_id = p_user), 'actual');
  m record;
  v_available numeric;
  v_benefit numeric;
  v_benefit_income numeric;
  v_pending_recurring numeric;
  v_pending_installments numeric;
  v_reserved_debts numeric;
  v_reserved_goals numeric;
  v_has_plan boolean;
  v_missing_income numeric;
  v_free numeric;
  v_state text;
begin
  select * into m from public.month_totals(v_key, p_user);

  select coalesce(sum(balance) filter (where type in ('checking', 'cash')), 0),
         coalesce(sum(balance) filter (where type = 'benefit'), 0)
  into v_available, v_benefit
  from public.account_balances(null, p_user) where not is_archived;

  select coalesce(sum(t.amount), 0) into v_benefit_income
  from public.transactions t join public.accounts a on a.id = t.account_id
  where t.user_id = p_user and t.type = 'income' and a.type = 'benefit' and t.date between v_s and v_e;

  select coalesce(sum(amount), 0) into v_pending_recurring
  from public.recurring_status(v_key, v_today, p_user) where status in ('pending', 'overdue');

  select coalesce(sum(i.amount), 0) into v_pending_installments
  from public.installment_status(v_today, p_user) i
  where i.status = 'overdue'
     or (i.status = 'due_this_month' and i.due_date between v_s and v_e);

  select coalesce(sum(greatest(0, mp.amount - coalesce((
           select sum(t.amount) from public.transactions t
           join public.accounts a on a.id = t.to_account_id
           where t.user_id = p_user and t.type in ('debt_payment', 'transfer') and a.type = 'credit'
             and t.date between v_s and v_e
             and (case when mp.account_id is null then a.debt_strategy = 'plan' else a.id = mp.account_id end)
         ), 0))), 0)
  into v_reserved_debts
  from public.monthly_plans mp where mp.user_id = p_user and mp.month_key = v_key and mp.kind = 'debts';

  select coalesce(sum(greatest(0, mp.amount - coalesce((
           select sum(t.amount) from public.transactions t
           where t.user_id = p_user and t.type = 'saving' and t.date between v_s and v_e
             and t.category_id = g.category_id
         ), 0))), 0)
  into v_reserved_goals
  from public.monthly_plans mp join public.goals g on g.id = mp.goal_id
  where mp.user_id = p_user and mp.month_key = v_key and mp.kind = 'goal';

  select exists (select 1 from public.monthly_plans where user_id = p_user and month_key = v_key) into v_has_plan;

  -- Expected income that lands on a benefit account never becomes free money.
  select coalesce(sum(e.missing), 0) into v_missing_income
  from public.expected_income(v_key, p_user) e
  left join public.categories c on c.id = e.category_id
  left join public.accounts a on a.id = c.default_account_id
  where a.type is distinct from 'benefit';

  v_free := v_available - v_pending_recurring - v_pending_installments - v_reserved_debts - v_reserved_goals;

  v_state := case
    when v_mode = 'projected' and v_missing_income > 0 then 'projected'
    when m.income - v_benefit_income = 0 and v_available = 0 then 'no_income'
    else 'ok'
  end;

  return jsonb_build_object(
    'month_key', v_key, 'start_date', v_s, 'end_date', v_e, 'state', v_state,
    'available', v_available,
    'benefit_balance', v_benefit,
    'income', m.income,
    'benefit_income', v_benefit_income,
    'expenses_paid', m.expenses - m.credit_expenses,
    'credit_expenses', m.credit_expenses,
    'debt_payments', m.debt_payments,
    'savings', m.savings,
    'investments', m.investments,
    'pending_recurring', v_pending_recurring,
    'pending_installments', v_pending_installments,
    'reserved_debts', v_reserved_debts,
    'reserved_goals', v_reserved_goals,
    'reserved', v_reserved_debts + v_reserved_goals,
    'has_plan', v_has_plan,
    'missing_expected_income', v_missing_income,
    'free', round(v_free, 2),
    'free_projected', round(v_free + v_missing_income, 2)
  );
end $$;

-- "Is it enough for the rest of the month?": budgets still to spend, minus what the benefit
-- account can cover (eligible categories only), compared with the free money.
create or replace function public.month_coverage(
  p_month_key integer default null, p_today date default null, p_user uuid default auth.uid())
returns jsonb language plpgsql stable as $$
declare
  v_key integer := coalesce(p_month_key, public.current_month_key(p_user));
  v_free jsonb := public.free_to_spend(v_key, p_today, p_user);
  v_budget_left numeric;
  v_eligible_left numeric;
  v_benefit numeric := greatest(0, (v_free->>'benefit_balance')::numeric);
  v_covered numeric;
  v_needed numeric;
begin
  select coalesce(sum(greatest(0, budget - spent)), 0) into v_budget_left
  from public.budget_usage(v_key, p_user) where scope = 'group' and budget is not null;

  select coalesce(sum(greatest(0, b.budget - b.spent)), 0) into v_eligible_left
  from public.budget_usage(v_key, p_user) b
  join public.categories c on c.id = b.id
  where b.scope = 'category' and b.budget is not null and c.benefit_eligible;

  v_covered := least(v_benefit, v_eligible_left);
  v_needed := v_budget_left - v_covered;

  return jsonb_build_object(
    'budget_remaining', round(v_budget_left, 2),
    'eligible_remaining', round(v_eligible_left, 2),
    'benefit_covered', round(v_covered, 2),
    'needed_from_accounts', round(v_needed, 2),
    'free', v_free->'free',
    'difference', round((v_free->>'free')::numeric - v_needed, 2));
end $$;

-- apply_setup learns the two new category fields.
create or replace function public.apply_setup(p_data jsonb)
returns jsonb language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_counts jsonb := '{}';
  r record;
  n integer;
begin
  if v_uid is null then
    raise exception 'Sessão em falta.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.accounts where user_id = v_uid)
     or exists (select 1 from public.categories where user_id = v_uid) then
    raise exception 'Esta conta já tem configuração. Usa as Definições para alterar.' using errcode = 'unique_violation';
  end if;

  -- Accounts
  insert into public.accounts (user_id, name, type, opening_balance, opening_date, debt_strategy, sort_order, notes)
  select v_uid, x.name, x.type, coalesce(x.opening_balance, 0),
         coalesce(public.momentum_preset_date(x.opening_date, v_uid), public.momentum_today(v_uid)),
         x.debt_strategy, coalesce(x.sort_order, e.ord::integer), x.notes
  from jsonb_array_elements(coalesce(p_data->'accounts', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, type text, opening_balance numeric, opening_date text, debt_strategy text, sort_order integer, notes text);
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('accounts', n);

  -- Settings
  insert into public.user_settings (user_id, financial_month_start_day, default_account_id, alert_thresholds,
    tracking_start_date, timezone, rest_days_per_week, min_review_days_week, min_review_days_month,
    min_days_for_projection, free_to_spend_mode, preset_key)
  select v_uid,
         coalesce((s->>'financial_month_start_day')::integer, 1),
         public.momentum_ref('accounts', v_uid, s->>'default_account'),
         coalesce((select array_agg(v::numeric) from jsonb_array_elements_text(s->'alert_thresholds') v), '{0.7,0.9,1.0}'),
         coalesce(public.momentum_preset_date(s->>'tracking_start_date', v_uid), public.momentum_today(v_uid)),
         coalesce(s->>'timezone', 'Europe/Lisbon'),
         coalesce((s->>'rest_days_per_week')::integer, 1),
         coalesce((s->>'min_review_days_week')::integer, 5),
         coalesce((s->>'min_review_days_month')::integer, 15),
         coalesce((s->>'min_days_for_projection')::integer, 7),
         coalesce(s->>'free_to_spend_mode', 'actual'),
         p_data->>'preset_key'
  from (select coalesce(p_data->'settings', '{}') as s) z
  on conflict (user_id) do update set
    financial_month_start_day = excluded.financial_month_start_day,
    default_account_id = excluded.default_account_id,
    alert_thresholds = excluded.alert_thresholds,
    tracking_start_date = excluded.tracking_start_date,
    timezone = excluded.timezone,
    rest_days_per_week = excluded.rest_days_per_week,
    min_review_days_week = excluded.min_review_days_week,
    min_review_days_month = excluded.min_review_days_month,
    min_days_for_projection = excluded.min_days_for_projection,
    free_to_spend_mode = excluded.free_to_spend_mode,
    preset_key = excluded.preset_key;

  insert into public.allocation_rules (user_id, name, pct, source, sort_order)
  select v_uid, x.name, x.pct, x.source, e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'allocation_rules', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, pct numeric, source text);

  insert into public.category_groups (user_id, name, monthly_budget, allocation_rule_id, sort_order)
  select v_uid, x.name, x.monthly_budget, public.momentum_ref('allocation_rules', v_uid, x.allocation_rule), e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'groups', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, monthly_budget numeric, allocation_rule text);

  insert into public.categories (user_id, name, group_id, kind, nature, own_limit, default_to_account_id, default_account_id, benefit_eligible, tag, emoji, sort_order)
  select v_uid, x.name, public.momentum_ref('category_groups', v_uid, x."group"), x.kind, coalesce(x.nature, 'variable'),
         x.own_limit, public.momentum_ref('accounts', v_uid, x.default_to_account), public.momentum_ref('accounts', v_uid, x.default_account), coalesce(x.benefit_eligible, false), x.tag, x.emoji, e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'categories', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, "group" text, kind text, nature text, own_limit numeric, default_to_account text, default_account text, benefit_eligible boolean, tag text, emoji text);
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('categories', n);

  insert into public.payment_methods (user_id, name, account_id, sort_order)
  select v_uid, x.name, public.momentum_ref('accounts', v_uid, x.account), e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'payment_methods', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, account text);

  insert into public.recurring_payments (user_id, description, category_id, amount, day_of_month, interval_months,
    anchor_month, start_month, end_month, account_id, sort_order)
  select v_uid, x.description, public.momentum_ref('categories', v_uid, x.category), x.amount, x.day_of_month,
         coalesce(x.interval_months, 1), x.anchor_month, x.start_month, x.end_month,
         public.momentum_ref('accounts', v_uid, x.account), e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'recurring_payments', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(description text, category text, amount numeric, day_of_month integer, interval_months integer,
            anchor_month integer, start_month integer, end_month integer, account text);

  insert into public.installments (user_id, account_id, amount, due_date, description)
  select v_uid, public.momentum_ref('accounts', v_uid, x.account), x.amount, x.due_date::date, x.description
  from jsonb_to_recordset(coalesce(p_data->'installments', '[]')) as x(account text, amount numeric, due_date text, description text);

  insert into public.income_sources (user_id, name, tag, category_id, account_id, amount, expected_day, valid_from, valid_to)
  select v_uid, x.name, x.tag, public.momentum_ref('categories', v_uid, x.category),
         public.momentum_ref('accounts', v_uid, x.account), x.amount, x.expected_day,
         coalesce(public.momentum_preset_date(x.valid_from, v_uid), public.momentum_today(v_uid)), x.valid_to::date
  from jsonb_to_recordset(coalesce(p_data->'income_sources', '[]'))
       as x(name text, tag text, category text, account text, amount numeric, expected_day integer, valid_from text, valid_to text);

  insert into public.shortcuts (user_id, name, description, category_id, account_id, payment_method_id, recurring_id, usual_amount, sort_order)
  select v_uid, x.name, x.description, public.momentum_ref('categories', v_uid, x.category),
         public.momentum_ref('accounts', v_uid, x.account), public.momentum_ref('payment_methods', v_uid, x.payment_method),
         public.momentum_ref('recurring_payments', v_uid, x.recurring, 'description'), x.usual_amount, e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'shortcuts', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, description text, category text, account text, payment_method text, recurring text, usual_amount numeric);

  insert into public.goals (user_id, name, target_type, target_amount, target_formula, target_date, priority,
    category_id, account_id, milestones, sort_order)
  select v_uid, x.name, x.target_type, x.target_amount, x.target_formula, x.target_date::date, coalesce(x.priority, 2),
         public.momentum_ref('categories', v_uid, x.category), public.momentum_ref('accounts', v_uid, x.account),
         coalesce((select array_agg(ms.val::numeric) from jsonb_array_elements_text(x.milestones) as ms(val)), '{0.25,0.5,0.75,1}'),
         e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'goals', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, target_type text, target_amount numeric, target_formula jsonb, target_date text, priority integer,
            category text, account text, milestones jsonb);

  insert into public.monthly_plans (user_id, month_key, kind, account_id, goal_id, amount)
  select v_uid, x.month_key, x.kind, public.momentum_ref('accounts', v_uid, x.account),
         public.momentum_ref('goals', v_uid, x.goal), x.amount
  from jsonb_to_recordset(coalesce(p_data->'monthly_plans', '[]'))
       as x(month_key integer, kind text, account text, goal text, amount numeric);

  insert into public.habits (user_id, name, emoji, frequency_type, system_key, sort_order)
  select v_uid, x.name, coalesce(x.emoji, '✅'), coalesce(x.frequency_type, 'daily'), x.system_key, e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'habits', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, emoji text, frequency_type text, system_key text)
  on conflict do nothing;

  insert into public.xp_rules (user_id, key, name, xp, period, condition, sort_order)
  select v_uid, x.key, x.name, x.xp, x.period, coalesce(x.condition, '{}'), e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'xp_rules', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(key text, name text, xp integer, period text, condition jsonb);

  insert into public.levels (user_id, level, name, min_xp)
  select v_uid, x.level, x.name, x.min_xp
  from jsonb_to_recordset(coalesce(p_data->'levels', '[]')) as x(level integer, name text, min_xp integer);

  insert into public.missions (user_id, key, name, period, condition, xp_rule_id, sort_order)
  select v_uid, x.key, x.name, x.period, coalesce(x.condition, '{}'),
         public.momentum_ref('xp_rules', v_uid, x.xp_rule, 'key'), e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'missions', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(key text, name text, period text, condition jsonb, xp_rule text);

  insert into public.achievements (user_id, key, name, description, xp, condition, sort_order)
  select v_uid, x.key, x.name, x.description, coalesce(x.xp, 0), coalesce(x.condition, '{}'), e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'achievements', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(key text, name text, description text, xp integer, condition jsonb);

  return v_counts;
end $$;

