-- Momentum Web — read-only calculations for Goals and Insights. Safe to run more than once.

-- One row per financial month, from the start of tracking up to the current month.
create or replace function public.monthly_history(
  p_months integer default 12, p_today date default null, p_user uuid default auth.uid())
returns table (
  month_key integer, start_date date, end_date date, is_current boolean,
  income numeric, expenses numeric, fixed_expenses numeric, variable_expenses numeric,
  debt_payments numeric, savings numeric, investments numeric, debt_outstanding numeric
) language sql stable as $$
  with p as (
    select coalesce(p_today, public.momentum_today(p_user)) as today, public.momentum_start_day(p_user) as sd
  ), bounds as (
    select p.today, p.sd,
           public.fin_month_key(p.today, p.sd) as last_key,
           public.fin_month_key(least(
             p.today,
             coalesce((select tracking_start_date from public.user_settings where user_id = p_user), p.today),
             coalesce((select min(date) from public.transactions where user_id = p_user), p.today)
           ), p.sd) as first_key
    from p
  ), months as (
    select public.month_key_shift(b.last_key, -n) as k, b.last_key, b.today
    from bounds b, generate_series(0, greatest(p_months, 1) - 1) as n
    where public.month_key_shift(b.last_key, -n) >= b.first_key
  )
  select t.month_key, t.start_date, t.end_date, months.k = months.last_key,
         t.income, t.expenses, t.fixed_expenses, t.variable_expenses,
         t.debt_payments, t.savings, t.investments,
         (select coalesce(sum(b.debt_outstanding), 0)
          from public.account_balances(least(t.end_date, months.today), p_user) b where b.type = 'credit')
  from months
  cross join lateral public.month_totals(months.k, p_user) t
  order by t.month_key
$$;

-- A goal month by month: what went in and what had accumulated by the end of the month.
create or replace function public.goal_history(
  p_goal_id uuid, p_months integer default 12, p_today date default null, p_user uuid default auth.uid())
returns table (month_key integer, deposited numeric, accumulated numeric, target numeric, progress numeric)
language sql stable as $$
  with g as (
    select g.id, g.category_id, public.goal_target(g.id, p_today) as target
    from public.goals g where g.id = p_goal_id and g.user_id = p_user
  )
  select h.month_key,
         coalesce((select sum(t.amount) from public.transactions t
                   where t.user_id = p_user and t.type = 'saving' and t.category_id = g.category_id
                     and t.date between h.start_date and h.end_date), 0),
         coalesce(a.total, 0),
         g.target,
         case when g.target > 0 then least(1, round(coalesce(a.total, 0) / g.target, 4)) end
  from g
  cross join public.monthly_history(p_months, p_today, p_user) h
  left join lateral (
    select sum(t.amount) as total from public.transactions t
    where t.user_id = p_user and t.type = 'saving' and t.category_id = g.category_id and t.date <= h.end_date
  ) a on true
  order by h.month_key
$$;

-- Spending per expense category: this month against the previous one, largest changes first.
create or replace function public.category_changes(p_month_key integer default null, p_user uuid default auth.uid())
returns table (
  category_id uuid, name text, emoji text, nature text, group_id uuid,
  current_amount numeric, previous_amount numeric, change numeric
) language sql stable as $$
  with p as (
    select coalesce(p_month_key, public.current_month_key(p_user)) as k, public.momentum_start_day(p_user) as sd
  ), b as (
    select public.fin_month_start(k, sd) as s, public.fin_month_end(k, sd) as e,
           public.fin_month_start(public.month_key_shift(k, -1), sd) as ps,
           public.fin_month_end(public.month_key_shift(k, -1), sd) as pe
    from p
  ), x as (
    select t.category_id,
           coalesce(sum(t.amount) filter (where t.date between b.s and b.e), 0) as cur,
           coalesce(sum(t.amount) filter (where t.date between b.ps and b.pe), 0) as prev
    from public.transactions t, b
    where t.user_id = p_user and t.type = 'expense' and t.category_id is not null and t.date between b.ps and b.e
    group by t.category_id
  )
  select c.id, c.name, c.emoji, c.nature, c.group_id, x.cur, x.prev, x.cur - x.prev
  from x join public.categories c on c.id = x.category_id
  order by abs(x.cur - x.prev) desc, c.name
$$;

-- Average daily spending on days with and without each habit. Only scheduled, finished days count.
-- Without a category it uses variable expenses, because fixed bills say nothing about a habit.
-- `enough_data` needs the minimum number of days on both sides. It shows a relation, not a cause.
create or replace function public.habit_spending(
  p_category_id uuid default null, p_days integer default 90, p_today date default null, p_user uuid default auth.uid())
returns table (
  habit_id uuid, name text, emoji text, days_done integer, days_not_done integer,
  avg_done numeric, avg_not_done numeric, difference numeric, enough_data boolean
) language sql stable as $$
  with p as (
    select coalesce(p_today, public.momentum_today(p_user)) as today,
           coalesce((select min_days_for_projection from public.user_settings where user_id = p_user), 7) as min_days,
           (select tracking_start_date from public.user_settings where user_id = p_user) as tracking
  ), days as (
    select d::date as day, p.min_days
    from p, generate_series(
      greatest(p.today - p_days, coalesce(p.tracking, p.today - p_days)), p.today - 1, interval '1 day') as d
  ), spent as (
    select t.date, sum(t.amount) as total
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    where t.user_id = p_user and t.type = 'expense'
      and (case when p_category_id is null then coalesce(c.nature, 'variable') = 'variable' else t.category_id = p_category_id end)
    group by t.date
  ), facts as (
    select h.id, h.name, h.emoji, h.sort_order, days.min_days,
           l.habit_id is not null as done, coalesce(spent.total, 0) as total
    from public.habits h
    join days on days.day >= h.created_at::date
      and (h.frequency_type <> 'specific_days' or exists (
        select 1 from public.habit_schedule_days s
        where s.habit_id = h.id and s.weekday = extract(dow from days.day)::integer))
    left join public.habit_logs l on l.habit_id = h.id and l.log_date = days.day and l.status = 'done'
    left join spent on spent.date = days.day
    where h.user_id = p_user and not h.is_archived
  )
  select f.id, f.name, f.emoji,
         count(*) filter (where f.done)::integer,
         count(*) filter (where not f.done)::integer,
         round(avg(f.total) filter (where f.done), 2),
         round(avg(f.total) filter (where not f.done), 2),
         round(avg(f.total) filter (where f.done) - avg(f.total) filter (where not f.done), 2),
         count(*) filter (where f.done) >= f.min_days and count(*) filter (where not f.done) >= f.min_days
  from facts f
  group by f.id, f.name, f.emoji, f.sort_order, f.min_days
  order by f.sort_order, f.name
$$;
