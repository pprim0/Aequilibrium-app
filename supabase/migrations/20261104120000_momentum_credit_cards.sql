-- Momentum Web — credit cards are a way to pay with a limit, not just a debt. Safe to run more than once.

alter table public.accounts add column if not exists is_credit_card boolean not null default false;
alter table public.accounts add column if not exists credit_limit numeric(12, 2);
alter table public.accounts drop constraint if exists accounts_credit_limit_check;
alter table public.accounts add constraint accounts_credit_limit_check
  check ((credit_limit is null or credit_limit >= 0) and (not is_credit_card or type = 'credit'));

drop function if exists public.debt_summary(date, uuid);
create function public.debt_summary(p_today date default null, p_user uuid default auth.uid())
returns table (
  account_id uuid, name text, debt_strategy text, is_credit_card boolean, credit_limit numeric, available_credit numeric,
  initial numeric, new_purchases numeric, total_borrowed numeric,
  paid numeric, outstanding numeric, progress numeric, months_with_payment integer, monthly_average numeric,
  estimated_end date, status text
) language sql stable as $$
  with p as (
    select coalesce(p_today, public.momentum_today(p_user)) as today, public.momentum_start_day(p_user) as sd
  ), d as (
    select a.id, a.name, a.debt_strategy, a.is_credit_card, a.credit_limit, a.sort_order, -a.opening_balance as initial,
      coalesce((select sum(t.amount) from public.transactions t
                where t.user_id = a.user_id and t.account_id = a.id and t.type = 'expense' and t.date >= a.opening_date), 0) as purchases,
      coalesce((select sum(t.amount) from public.transactions t
                where t.user_id = a.user_id and t.to_account_id = a.id and t.type in ('debt_payment', 'transfer')
                  and t.date >= a.opening_date), 0) as paid,
      (select count(distinct public.fin_month_key(t.date, p.sd)) from public.transactions t
       where t.user_id = a.user_id and t.to_account_id = a.id and t.type in ('debt_payment', 'transfer')
         and t.date >= a.opening_date)::integer as months,
      bal.debt_outstanding as outstanding, p.today
    from public.accounts a cross join p
    join public.account_balances(null, p_user) bal on bal.account_id = a.id
    where a.user_id = p_user and a.type = 'credit' and not a.is_archived
  )
  select d.id, d.name, d.debt_strategy, d.is_credit_card, d.credit_limit,
         case when d.credit_limit is not null then greatest(0, d.credit_limit - d.outstanding) end,
         d.initial, d.purchases, d.initial + d.purchases, d.paid, d.outstanding,
         case when d.initial + d.purchases > 0 then least(1, round(d.paid / (d.initial + d.purchases), 4)) end,
         d.months,
         case when d.months >= 2 then round(d.paid / d.months, 2) end,
         -- An estimate only: needs payments in at least two different months.
         case when d.outstanding > 0 and d.months >= 2 and d.paid > 0
              then (d.today + make_interval(months => ceil(d.outstanding / (d.paid / d.months))::integer))::date end,
         case when d.outstanding = 0 then 'paid' when d.paid > 0 then 'in_progress' else 'not_started' end
  from d order by d.sort_order, d.name
$$;

-- The summary at the top of the commitments screen.
create or replace function public.debt_overview(p_today date default null, p_user uuid default auth.uid())
returns jsonb language plpgsql stable as $$
declare
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_key integer := public.fin_month_key(v_today, public.momentum_start_day(p_user));
  v_start date := public.fin_month_start(v_key, public.momentum_start_day(p_user));
  v_end date := public.fin_month_end(v_key, public.momentum_start_day(p_user));
  v_totals record;
  v_next record;
begin
  select coalesce(sum(outstanding), 0) as outstanding,
         coalesce(sum(total_borrowed), 0) as borrowed,
         coalesce(sum(paid), 0) as paid,
         count(*) filter (where outstanding > 0) as open_count,
         count(*) filter (where is_credit_card) as cards,
         sum(available_credit) as available
  into v_totals
  from public.debt_summary(v_today, p_user);

  select i.account_name, i.amount, i.due_date, i.status into v_next
  from public.installment_status(v_today, p_user) i
  where i.status <> 'paid' order by i.due_date limit 1;

  return jsonb_build_object(
    'outstanding', v_totals.outstanding,
    'borrowed', v_totals.borrowed,
    'paid', v_totals.paid,
    'progress', case when v_totals.borrowed > 0 then least(1, round(v_totals.paid / v_totals.borrowed, 4)) end,
    'open_count', v_totals.open_count,
    'cards', v_totals.cards,
    'available_credit', v_totals.available,
    'paid_this_month', coalesce((
      select sum(t.amount) from public.transactions t join public.accounts a on a.id = t.to_account_id
      where t.user_id = p_user and a.type = 'credit' and t.type in ('debt_payment', 'transfer') and t.date between v_start and v_end), 0),
    'planned_this_month', (
      select sum(mp.amount) from public.monthly_plans mp
      where mp.user_id = p_user and mp.month_key = v_key and mp.kind = 'debts'),
    'next_due', case when v_next.due_date is null then null else jsonb_build_object(
      'name', v_next.account_name, 'amount', v_next.amount, 'date', v_next.due_date, 'overdue', v_next.status = 'overdue') end
  );
end $$;

-- apply_setup learns the credit card fields.
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
  insert into public.accounts (user_id, name, type, opening_balance, opening_date, debt_strategy, is_credit_card, credit_limit, sort_order, notes)
  select v_uid, x.name, x.type, coalesce(x.opening_balance, 0),
         coalesce(public.momentum_preset_date(x.opening_date, v_uid), public.momentum_today(v_uid)),
         x.debt_strategy, coalesce(x.is_credit_card, false), x.credit_limit, coalesce(x.sort_order, e.ord::integer), x.notes
  from jsonb_array_elements(coalesce(p_data->'accounts', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, type text, opening_balance numeric, opening_date text, debt_strategy text, is_credit_card boolean, credit_limit numeric, sort_order integer, notes text);
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

