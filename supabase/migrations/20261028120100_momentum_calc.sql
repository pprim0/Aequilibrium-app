-- Momentum Web — single source of truth for every number shown in the app.
--
-- All functions are SECURITY INVOKER: they run under the caller's RLS, so passing another
-- user's id simply returns nothing. "Today" comes from momentum_today() so tests and the
-- nightly job can evaluate any date.
--
-- Month keys are integers YYYYMM of the *financial* month (a day >= start day belongs to
-- the next month).

-- ---------------------------------------------------------------------------
-- 1. Dates and months
-- ---------------------------------------------------------------------------
create or replace function public.momentum_start_day(p_user uuid default auth.uid())
returns integer language sql stable as $$
  select coalesce((select financial_month_start_day from public.user_settings where user_id = p_user), 1)
$$;

create or replace function public.momentum_today(p_user uuid default auth.uid())
returns date language sql stable as $$
  select coalesce(
    nullif(current_setting('momentum.today', true), '')::date,
    (now() at time zone coalesce(
      (select timezone from public.user_settings where user_id = p_user), 'Europe/Lisbon'))::date)
$$;

create or replace function public.fin_month_key(p_date date, p_start_day integer)
returns integer language sql immutable as $$
  select case
    when p_start_day > 1 and extract(day from p_date) >= p_start_day
      then to_char(p_date + interval '1 month', 'YYYYMM')::integer
    else to_char(p_date, 'YYYYMM')::integer
  end
$$;

create or replace function public.fin_month_start(p_key integer, p_start_day integer)
returns date language sql immutable as $$
  select case
    when p_start_day > 1
      then (make_date(p_key / 100, p_key % 100, 1) - interval '1 month')::date + (p_start_day - 1)
    else make_date(p_key / 100, p_key % 100, 1)
  end
$$;

create or replace function public.fin_month_end(p_key integer, p_start_day integer)
returns date language sql immutable as $$
  select case
    when p_start_day > 1 then make_date(p_key / 100, p_key % 100, p_start_day) - 1
    else (make_date(p_key / 100, p_key % 100, 1) + interval '1 month')::date - 1
  end
$$;

create or replace function public.month_key_shift(p_key integer, p_months integer)
returns integer language sql immutable as $$
  select ((p_key / 100) * 12 + (p_key % 100) - 1 + p_months) / 12 * 100
       + ((p_key / 100) * 12 + (p_key % 100) - 1 + p_months) % 12 + 1
$$;

create or replace function public.month_key_diff(p_a integer, p_b integer)
returns integer language sql immutable as $$
  select ((p_a / 100) * 12 + (p_a % 100)) - ((p_b / 100) * 12 + (p_b % 100))
$$;

-- A day of month clamped to the month's length (31 in November -> 30).
create or replace function public.momentum_day_in_month(p_any_day date, p_day integer)
returns date language sql immutable as $$
  select make_date(
    extract(year from p_any_day)::integer,
    extract(month from p_any_day)::integer,
    least(p_day, extract(day from (date_trunc('month', p_any_day) + interval '1 month - 1 day'))::integer))
$$;

create or replace function public.current_month_key(p_user uuid default auth.uid())
returns integer language sql stable as $$
  select public.fin_month_key(public.momentum_today(p_user), public.momentum_start_day(p_user))
$$;

create or replace function public.momentum_alert_level(p_pct numeric, p_thresholds numeric[])
returns text language sql immutable as $$
  select case
    when p_pct is null then 'none'
    when p_pct >= p_thresholds[3] then 'red'
    when p_pct >= p_thresholds[2] then 'orange'
    when p_pct >= p_thresholds[1] then 'yellow'
    else 'ok'
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. Balances
-- ---------------------------------------------------------------------------
create or replace function public.account_balances(p_as_of date default null, p_user uuid default auth.uid())
returns table (
  account_id uuid, name text, type text, debt_strategy text, sort_order integer, is_archived boolean,
  balance numeric, debt_outstanding numeric
) language sql stable as $$
  select a.id, a.name, a.type, a.debt_strategy, a.sort_order, a.is_archived,
         round(a.opening_balance + coalesce(m.delta, 0), 2) as balance,
         case when a.type = 'credit' then greatest(0, -round(a.opening_balance + coalesce(m.delta, 0), 2)) end
  from public.accounts a
  left join lateral (
    select sum(
             case when t.account_id = a.id then case when t.type = 'income' then t.amount else -t.amount end else 0 end
           + case when t.to_account_id = a.id then t.amount else 0 end) as delta
    from public.transactions t
    where t.user_id = a.user_id
      and (t.account_id = a.id or t.to_account_id = a.id)
      and t.date >= a.opening_date
      and (p_as_of is null or t.date <= p_as_of)
  ) m on true
  where a.user_id = p_user
$$;

-- "Dinheiro nas contas": checking + cash + savings. Investments and debts are shown apart.
create or replace function public.money_in_accounts(p_as_of date default null, p_user uuid default auth.uid())
returns numeric language sql stable as $$
  select coalesce(sum(balance), 0) from public.account_balances(p_as_of, p_user)
  where type in ('checking', 'cash', 'savings') and not is_archived
$$;

-- ---------------------------------------------------------------------------
-- 3. Month totals
-- ---------------------------------------------------------------------------
create or replace function public.month_totals(p_month_key integer default null, p_user uuid default auth.uid())
returns table (
  month_key integer, start_date date, end_date date,
  income numeric, expenses numeric, credit_expenses numeric, fixed_expenses numeric, variable_expenses numeric,
  debt_payments numeric, savings numeric, investments numeric, net numeric
) language sql stable as $$
  with p as (
    select coalesce(p_month_key, public.current_month_key(p_user)) as k, public.momentum_start_day(p_user) as sd
  ), b as (
    select k, public.fin_month_start(k, sd) as s, public.fin_month_end(k, sd) as e from p
  ), t as (
    select t.type, t.amount, a.type as account_type, c.nature
    from b
    join public.transactions t on t.user_id = p_user and t.date between b.s and b.e
    join public.accounts a on a.id = t.account_id
    left join public.categories c on c.id = t.category_id
  )
  select b.k, b.s, b.e,
         coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'expense' and t.account_type = 'credit'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'expense' and t.nature = 'fixed'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'expense' and coalesce(t.nature, 'variable') = 'variable'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'debt_payment'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'saving'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'investment'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
           - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)
  from b left join t on true
  group by b.k, b.s, b.e
$$;

create or replace function public.spent_on(p_day date default null, p_user uuid default auth.uid())
returns numeric language sql stable as $$
  select coalesce(sum(amount), 0) from public.transactions
  where user_id = p_user and type = 'expense' and date = coalesce(p_day, public.momentum_today(p_user))
$$;

-- ---------------------------------------------------------------------------
-- 4. Recurring payments and installments
-- ---------------------------------------------------------------------------
-- Status: paid | pending | overdue | not_this_month | not_started | ended.
-- A forecast never counts as an expense; only the linked movement does.
create or replace function public.recurring_status(
  p_month_key integer default null, p_today date default null, p_user uuid default auth.uid())
returns table (
  recurring_id uuid, description text, category_id uuid, amount numeric, day_of_month integer,
  interval_months integer, due_date date, status text, next_date date
) language sql stable as $$
  with p as (
    select coalesce(p_month_key, public.current_month_key(p_user)) as k,
           coalesce(p_today, public.momentum_today(p_user)) as today,
           public.momentum_start_day(p_user) as sd
  ), b as (
    select k, today, sd, public.fin_month_start(k, sd) as s, public.fin_month_end(k, sd) as e from p
  ), r as (
    select rp.*, b.k, b.today, b.s, b.e, b.sd,
      case when rp.day_of_month is null then null
           when public.momentum_day_in_month(b.e, rp.day_of_month) <= b.e then public.momentum_day_in_month(b.e, rp.day_of_month)
           else public.momentum_day_in_month(b.s, rp.day_of_month) end as due,
      exists (
        select 1 from public.transactions t
        where t.user_id = rp.user_id and t.date between b.s and b.e
          and (t.recurring_id = rp.id
               or (t.recurring_id is null and lower(trim(t.description)) = lower(trim(rp.description))))
      ) as paid,
      exists (
        select 1 from public.transactions t
        where t.user_id = rp.user_id
          and t.date between public.fin_month_start(public.month_key_shift(b.k, -1), b.sd)
                         and public.fin_month_end(public.month_key_shift(b.k, -1), b.sd)
          and (t.recurring_id = rp.id
               or (t.recurring_id is null and lower(trim(t.description)) = lower(trim(rp.description))))
      ) as paid_prev
    from public.recurring_payments rp, b
    where rp.user_id = p_user and not rp.is_archived
  ), st as (
    select r.*,
      case
        when r.start_month is not null and r.k < r.start_month then 'not_started'
        when r.end_month is not null and r.k > r.end_month then 'ended'
        when r.paid then 'paid'
        when r.interval_months > 1 and r.anchor_month is not null
             and public.month_key_diff(r.k, r.anchor_month) % r.interval_months <> 0 then 'not_this_month'
        when r.interval_months > 1 and r.anchor_month is null and r.paid_prev then 'not_this_month'
        when r.due is not null and r.due < r.today then 'overdue'
        else 'pending'
      end as status
    from r
  )
  select st.id, st.description, st.category_id, st.amount, st.day_of_month, st.interval_months, st.due, st.status,
         case
           when st.status = 'ended' or st.due is null then null
           when st.status = 'paid' then (st.due + make_interval(months => st.interval_months))::date
           when st.status = 'not_this_month' then (st.due + interval '1 month')::date
           else st.due
         end
  from st
$$;

-- An installment is paid once everything paid to its credit account covers the sum of all
-- installments due up to its date (paying early counts).
create or replace function public.installment_status(p_today date default null, p_user uuid default auth.uid())
returns table (
  installment_id uuid, account_id uuid, account_name text, amount numeric, due_date date,
  description text, status text, days_left integer
) language sql stable as $$
  with p as (
    select coalesce(p_today, public.momentum_today(p_user)) as today, public.momentum_start_day(p_user) as sd
  ), paid as (
    select a.id as account_id, coalesce(sum(t.amount), 0) as total
    from public.accounts a
    left join public.transactions t
      on t.user_id = a.user_id and t.to_account_id = a.id
     and t.type in ('debt_payment', 'transfer') and t.date >= a.opening_date
    where a.user_id = p_user and a.type = 'credit'
    group by a.id
  ), i as (
    select i.*, a.name as account_name,
           sum(i.amount) over (partition by i.account_id order by i.due_date
                               range between unbounded preceding and current row) as due_so_far
    from public.installments i join public.accounts a on a.id = i.account_id
    where i.user_id = p_user
  )
  select i.id, i.account_id, i.account_name, i.amount, i.due_date, i.description,
         case
           when coalesce(paid.total, 0) + 0.005 >= i.due_so_far then 'paid'
           when i.due_date < p.today then 'overdue'
           when i.due_date <= public.fin_month_end(public.fin_month_key(p.today, p.sd), p.sd) then 'due_this_month'
           else 'later'
         end,
         case when coalesce(paid.total, 0) + 0.005 >= i.due_so_far then null else i.due_date - p.today end
  from i cross join p left join paid on paid.account_id = i.account_id
$$;

-- ---------------------------------------------------------------------------
-- 5. Expected income and goal targets (never hardcoded: read from income_sources)
-- ---------------------------------------------------------------------------
create or replace function public.expected_income(p_month_key integer default null, p_user uuid default auth.uid())
returns table (category_id uuid, expected numeric, received numeric, missing numeric)
language sql stable as $$
  with p as (
    select coalesce(p_month_key, public.current_month_key(p_user)) as k, public.momentum_start_day(p_user) as sd
  ), b as (
    select public.fin_month_start(k, sd) as s, public.fin_month_end(k, sd) as e from p
  ), exp as (
    select src.category_id, sum(src.amount) as expected
    from public.income_sources src, b
    where src.user_id = p_user and src.valid_from <= b.e and (src.valid_to is null or src.valid_to >= b.s)
    group by src.category_id
  )
  select exp.category_id, exp.expected, coalesce(r.received, 0), greatest(0, exp.expected - coalesce(r.received, 0))
  from exp cross join b
  left join lateral (
    select sum(t.amount) as received from public.transactions t
    where t.user_id = p_user and t.type = 'income' and t.date between b.s and b.e
      and t.category_id is not distinct from exp.category_id
  ) r on true
$$;

create or replace function public.goal_target(p_goal_id uuid, p_today date default null)
returns numeric language plpgsql stable as $$
declare
  g public.goals;
  f jsonb;
  v_today date;
  v_base numeric := 0;
  v_tag text;
  v_amount numeric;
  v_target numeric;
begin
  select * into g from public.goals where id = p_goal_id;
  if not found then return null; end if;
  if g.target_type = 'fixed' then return g.target_amount; end if;

  f := g.target_formula;
  v_today := coalesce(p_today, public.momentum_today(g.user_id));
  if f->>'type' = 'income_multiple' then
    for v_tag in select jsonb_array_elements_text(coalesce(f->'includes', '[]'::jsonb)) loop
      if coalesce(f->>'at', 'latest') = 'current' then
        select sum(amount) into v_amount from public.income_sources
        where user_id = g.user_id and tag = v_tag and valid_from <= v_today
          and (valid_to is null or valid_to >= v_today);
      else
        select amount into v_amount from public.income_sources
        where user_id = g.user_id and tag = v_tag
        order by valid_from desc limit 1;
      end if;
      v_base := v_base + coalesce(v_amount, 0);
    end loop;
    v_target := v_base * coalesce((f->>'factor')::numeric, 1);
  else
    raise exception 'Fórmula de objetivo desconhecida: %', f->>'type';
  end if;

  if coalesce((f->>'round_up')::numeric, 0) > 0 then
    v_target := ceil(v_target / (f->>'round_up')::numeric) * (f->>'round_up')::numeric;
  end if;
  return round(v_target, 2);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Free to spend
-- ---------------------------------------------------------------------------
-- free = income - (expenses - expenses on credit) - debt payments - savings - investments
--        - recurring/installments still to pay this month - what the monthly plan still reserves.
create or replace function public.free_to_spend(
  p_month_key integer default null, p_today date default null, p_user uuid default auth.uid())
returns jsonb language plpgsql stable as $$
declare
  v_key integer := coalesce(p_month_key, public.current_month_key(p_user));
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_sd integer := public.momentum_start_day(p_user);
  v_s date := public.fin_month_start(v_key, v_sd);
  v_e date := public.fin_month_end(v_key, v_sd);
  v_mode text := coalesce((select free_to_spend_mode from public.user_settings where user_id = p_user), 'projected');
  m record;
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
  select coalesce(sum(missing), 0) into v_missing_income from public.expected_income(v_key, p_user);

  v_free := m.income - (m.expenses - m.credit_expenses) - m.debt_payments - m.savings - m.investments
            - v_pending_recurring - v_pending_installments - v_reserved_debts - v_reserved_goals;

  v_state := case
    when v_mode = 'projected' and v_missing_income > 0 then 'projected'
    when m.income = 0 then 'no_income'
    else 'ok'
  end;

  return jsonb_build_object(
    'month_key', v_key, 'start_date', v_s, 'end_date', v_e, 'state', v_state,
    'income', m.income,
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

-- ---------------------------------------------------------------------------
-- 7. Budget (envelopes) and alerts
-- ---------------------------------------------------------------------------
create or replace function public.budget_usage(p_month_key integer default null, p_user uuid default auth.uid())
returns table (
  scope text, id uuid, name text, group_id uuid, budget numeric, spent numeric, pct numeric, level text
) language sql stable as $$
  with p as (
    select coalesce(p_month_key, public.current_month_key(p_user)) as k, public.momentum_start_day(p_user) as sd,
           coalesce((select alert_thresholds from public.user_settings where user_id = p_user), '{0.7,0.9,1.0}') as th
  ), b as (
    select th, public.fin_month_start(k, sd) as s, public.fin_month_end(k, sd) as e from p
  ), spent as (
    select t.category_id, sum(t.amount) as total
    from public.transactions t, b
    where t.user_id = p_user and t.type = 'expense' and t.date between b.s and b.e
    group by t.category_id
  )
  select 'group', g.id, g.name, g.id, g.monthly_budget, coalesce(sum(spent.total), 0),
         case when coalesce(g.monthly_budget, 0) > 0 then round(coalesce(sum(spent.total), 0) / g.monthly_budget, 4) end,
         public.momentum_alert_level(
           case when coalesce(g.monthly_budget, 0) > 0 then coalesce(sum(spent.total), 0) / g.monthly_budget end, b.th)
  from public.category_groups g cross join b
  left join public.categories c on c.group_id = g.id
  left join spent on spent.category_id = c.id
  where g.user_id = p_user
  group by g.id, g.name, g.monthly_budget, b.th
  union all
  select 'category', c.id, c.name, c.group_id, c.own_limit, coalesce(spent.total, 0),
         case when coalesce(c.own_limit, 0) > 0 then round(coalesce(spent.total, 0) / c.own_limit, 4) end,
         public.momentum_alert_level(
           case when coalesce(c.own_limit, 0) > 0 then coalesce(spent.total, 0) / c.own_limit end, b.th)
  from public.categories c cross join b
  left join spent on spent.category_id = c.id
  where c.user_id = p_user and c.kind = 'expense'
$$;

-- Movements needing attention: possible duplicates (same date + amount + description, not split)
-- and missing category.
create or replace view public.transaction_alerts with (security_invoker = true) as
select t.id as transaction_id, t.user_id, 'possible_duplicate'::text as alert
from public.transactions t
where t.split_id is null
  and exists (
    select 1 from public.transactions o
    where o.user_id = t.user_id and o.id <> t.id and o.split_id is null
      and o.date = t.date and o.amount = t.amount
      and lower(trim(coalesce(o.description, ''))) = lower(trim(coalesce(t.description, ''))))
union all
select t.id, t.user_id, 'missing_category'
from public.transactions t
where t.category_id is null;

-- ---------------------------------------------------------------------------
-- 8. Debts, goals, investments, allocation rule, projection
-- ---------------------------------------------------------------------------
create or replace function public.debt_summary(p_today date default null, p_user uuid default auth.uid())
returns table (
  account_id uuid, name text, debt_strategy text, initial numeric, new_purchases numeric, total_borrowed numeric,
  paid numeric, outstanding numeric, progress numeric, months_with_payment integer, monthly_average numeric,
  estimated_end date, status text
) language sql stable as $$
  with p as (
    select coalesce(p_today, public.momentum_today(p_user)) as today, public.momentum_start_day(p_user) as sd
  ), d as (
    select a.id, a.name, a.debt_strategy, a.sort_order, -a.opening_balance as initial,
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
    where a.user_id = p_user and a.type = 'credit'
  )
  select d.id, d.name, d.debt_strategy, d.initial, d.purchases, d.initial + d.purchases, d.paid, d.outstanding,
         case when d.initial + d.purchases > 0 then least(1, round(d.paid / (d.initial + d.purchases), 4)) end,
         d.months,
         case when d.months >= 2 then round(d.paid / d.months, 2) end,
         -- An estimate only: needs payments in at least two different months.
         case when d.outstanding > 0 and d.months >= 2 and d.paid > 0
              then (d.today + make_interval(months => ceil(d.outstanding / (d.paid / d.months))::integer))::date end,
         case when d.outstanding = 0 then 'paid' when d.paid > 0 then 'in_progress' else 'not_started' end
  from d order by d.sort_order, d.name
$$;

create or replace function public.goal_progress(p_today date default null, p_user uuid default auth.uid())
returns table (
  goal_id uuid, name text, target numeric, saved numeric, remaining numeric, progress numeric,
  target_date date, status text, milestones jsonb
) language sql stable as $$
  with p as (select coalesce(p_today, public.momentum_today(p_user)) as today),
  g as (
    select g.*, public.goal_target(g.id, p.today) as target, p.today
    from public.goals g cross join p where g.user_id = p_user and not g.is_archived
  ), s as (
    select g.id as goal_id, t.date,
           sum(t.amount) over (partition by g.id order by t.date, t.created_at, t.id) as running
    from g join public.transactions t
      on t.user_id = g.user_id and t.type = 'saving' and t.category_id = g.category_id and t.date <= g.today
  ), tot as (
    select g.id, coalesce((select sum(t.amount) from public.transactions t
                           where t.user_id = g.user_id and t.type = 'saving' and t.category_id = g.category_id
                             and t.date <= g.today), 0) as saved
    from g
  )
  select g.id, g.name, g.target, tot.saved, greatest(0, g.target - tot.saved),
         case when g.target > 0 then least(1, round(tot.saved / g.target, 4)) end,
         g.target_date,
         case when g.category_id is null then 'no_category'
              when g.target is null then 'no_target'
              when tot.saved >= g.target then 'reached'
              when g.target_date is not null and g.target_date < g.today then 'overdue'
              else 'in_progress' end,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'pct', ms.pct, 'amount', round(g.target * ms.pct, 2),
                    'reached_on', (select min(s.date) from s where s.goal_id = g.id and s.running >= g.target * ms.pct))
                  order by ms.pct)
           from unnest(g.milestones) as ms(pct)), '[]'::jsonb)
  from g join tot on tot.id = g.id
  order by g.priority, g.sort_order, g.name
$$;

-- Buying = positive, selling = negative (amount received). Gain = current value + sold - deposited.
create or replace function public.investment_summary(p_user uuid default auth.uid())
returns table (
  category_id uuid, name text, deposited numeric, sold numeric, invested numeric,
  current_value numeric, valued_on date, gain numeric, gain_pct numeric
) language sql stable as $$
  select c.id, c.name, x.deposited, x.sold, x.deposited - x.sold, v.value, v.valued_on,
         case when v.value is not null then v.value + x.sold - x.deposited end,
         case when v.value is not null and x.deposited > 0 then round((v.value + x.sold - x.deposited) / x.deposited, 4) end
  from public.categories c
  cross join lateral (
    select coalesce(sum(t.amount) filter (where t.amount > 0), 0) as deposited,
           coalesce(-sum(t.amount) filter (where t.amount < 0), 0) as sold
    from public.transactions t
    where t.user_id = c.user_id and t.category_id = c.id and t.type = 'investment'
  ) x
  left join lateral (
    select iv.value, iv.valued_on from public.investment_valuations iv
    where iv.user_id = c.user_id and iv.category_id = c.id
    order by iv.valued_on desc limit 1
  ) v on true
  where c.user_id = p_user and c.kind = 'investment'
  order by c.sort_order, c.name
$$;

-- Recommended vs real per block. While any debt is outstanding the app is in "debt phase".
create or replace function public.allocation_comparison(p_month_key integer default null, p_user uuid default auth.uid())
returns table (rule_id uuid, name text, pct numeric, recommended numeric, actual numeric, difference numeric, debt_phase boolean)
language sql stable as $$
  with m as (select * from public.month_totals(p_month_key, p_user)),
  debt as (
    select coalesce(sum(debt_outstanding), 0) > 0 as debt_phase
    from public.account_balances(null, p_user) where type = 'credit'
  ), grp as (
    select g.allocation_rule_id, sum(t.amount) as total
    from m
    join public.transactions t on t.user_id = p_user and t.type = 'expense' and t.date between m.start_date and m.end_date
    join public.categories c on c.id = t.category_id
    join public.category_groups g on g.id = c.group_id
    where g.allocation_rule_id is not null
    group by g.allocation_rule_id
  )
  select r.id, r.name, r.pct, round(m.income * r.pct, 2),
         case r.source when 'saving' then m.savings when 'investment' then m.investments
              else coalesce(grp.total, 0) end as actual,
         round(case r.source when 'saving' then m.savings when 'investment' then m.investments
                    else coalesce(grp.total, 0) end - m.income * r.pct, 2),
         debt.debt_phase
  from public.allocation_rules r cross join m cross join debt
  left join grp on grp.allocation_rule_id = r.id
  where r.user_id = p_user
  order by r.sort_order
$$;

-- End-of-month estimate for variable expenses: current month only, with enough days of data.
create or replace function public.month_projection(p_today date default null, p_user uuid default auth.uid())
returns jsonb language plpgsql stable as $$
declare
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_key integer := public.fin_month_key(v_today, public.momentum_start_day(p_user));
  v_min integer := coalesce((select min_days_for_projection from public.user_settings where user_id = p_user), 7);
  v_tracking date := (select tracking_start_date from public.user_settings where user_id = p_user);
  m record;
  v_from date;
  v_days integer;
  v_total_days integer;
begin
  select * into m from public.month_totals(v_key, p_user);
  v_from := greatest(m.start_date, coalesce(v_tracking, m.start_date));
  v_days := v_today - v_from + 1;
  v_total_days := m.end_date - v_from + 1;
  if v_days < v_min then
    return jsonb_build_object('available', false, 'reason', 'not_enough_days', 'days', v_days, 'min_days', v_min);
  end if;
  return jsonb_build_object(
    'available', true, 'is_estimate', true, 'days', v_days, 'total_days', v_total_days,
    'variable_spent', m.variable_expenses,
    'variable_projected', round(m.variable_expenses / v_days * v_total_days, 2));
end $$;

-- ---------------------------------------------------------------------------
-- 9. Daily review: only today or yesterday can be written
-- ---------------------------------------------------------------------------
create or replace function public.daily_checkins_guard()
returns trigger language plpgsql as $$
declare v_today date := public.momentum_today(new.user_id);
begin
  if new.day not between v_today - 1 and v_today then
    raise exception 'Só podes registar a revisão de hoje ou de ontem.' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.day <> new.day then
    raise exception 'Não é possível mudar o dia de uma revisão.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger daily_checkins_guard
  before insert or update on public.daily_checkins
  for each row execute function public.daily_checkins_guard();
