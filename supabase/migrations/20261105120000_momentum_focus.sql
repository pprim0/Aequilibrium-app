-- Momentum Web — the app talks about money first: notifications, goal plans and real progress.
-- Nothing is deleted: habits, XP and missions stay in the database. Safe to run more than once.

-- Habits become optional. People who already created their own keep them in the menu.
alter table public.user_settings add column if not exists show_habits boolean;
update public.user_settings s
set show_habits = exists (select 1 from public.habits h where h.user_id = s.user_id and h.system_key is null)
where s.show_habits is null;
alter table public.user_settings alter column show_habits set default false;
alter table public.user_settings alter column show_habits set not null;

-- What needs attention now. Derived from the current state: it disappears when it is resolved.
create or replace function public.notifications(p_today date default null, p_user uuid default auth.uid())
returns table (
  kind text, name text, amount numeric, budget numeric, due_date date, level text
) language sql stable as $$
  with p as (select coalesce(p_today, public.momentum_today(p_user)) as today),
  items as (
    select 1 as rank, 'payment_overdue' as kind, r.description as name, r.amount, null::numeric as budget, r.due_date, null::text as level
    from public.recurring_status(null, (select today from p), p_user) r
    where r.status = 'overdue'
    union all
    select 1, 'payment_overdue', i.account_name, i.amount, null, i.due_date, null
    from public.installment_status((select today from p), p_user) i
    where i.status = 'overdue'
    union all
    select 2, 'payment_due', r.description, r.amount, null, r.due_date, null
    from public.recurring_status(null, (select today from p), p_user) r, p
    where r.status = 'pending' and r.due_date between p.today and p.today + 3
    union all
    select 2, 'payment_due', i.account_name, i.amount, null, i.due_date, null
    from public.installment_status((select today from p), p_user) i
    where i.status <> 'paid' and i.days_left between 0 and 3
    union all
    select 3, 'budget_limit', u.name, u.spent, u.budget, null, u.level
    from public.budget_usage(public.fin_month_key((select today from p), public.momentum_start_day(p_user)), p_user) u
    where u.level in ('orange', 'red')
    union all
    select 4, 'payment_no_day', r.description, r.amount, null, null, null
    from public.recurring_status(null, (select today from p), p_user) r
    where r.status = 'pending' and r.due_date is null
    union all
    -- From Friday on, while this week's review is missing and there is something to review.
    select 5, 'weekly_review', null, null, null, null, null
    from p
    where extract(isodow from p.today) >= 5
      and exists (select 1 from public.transactions t where t.user_id = p_user)
      and not exists (
        select 1 from public.daily_checkins c
        where c.user_id = p_user and c.weekly_review
          and c.day between date_trunc('week', p.today)::date and p.today)
  )
  select i.kind, i.name, i.amount, i.budget, i.due_date, i.level
  from items i
  order by i.rank, i.due_date nulls last, i.name
$$;

-- How much a goal needs per month to arrive on time, and where the current pace leads.
create or replace function public.goal_plans(p_today date default null, p_user uuid default auth.uid())
returns table (
  goal_id uuid, months_left integer, monthly_needed numeric, monthly_average numeric,
  estimated_date date, on_track boolean
) language sql stable as $$
  with p as (select coalesce(p_today, public.momentum_today(p_user)) as today),
  g as (
    select gp.goal_id, gp.saved, gp.remaining, gp.target_date, p.today,
           (select min(t.date) from public.transactions t
            where t.user_id = p_user and t.type = 'saving' and t.category_id = goal.category_id and t.date <= p.today) as first_deposit
    from public.goal_progress((select today from p), p_user) gp
    join public.goals goal on goal.id = gp.goal_id
    cross join p
  ), pace as (
    select g.*,
           case when g.target_date >= g.today then greatest(1, ceil((g.target_date - g.today) / 30.4375))::integer end as months_left,
           case when g.saved > 0 and g.first_deposit is not null
                then round(g.saved / greatest(1, ceil((g.today - g.first_deposit + 1) / 30.4375)), 2) end as average
    from g
  ), est as (
    select pace.*,
           case when pace.remaining > 0 and pace.average > 0
                then pace.today + ceil(pace.remaining / pace.average * 30.4375)::integer end as estimated
    from pace
  )
  select est.goal_id, est.months_left,
         case when est.remaining > 0 and est.months_left is not null then round(est.remaining / est.months_left, 2) end,
         est.average, est.estimated,
         case when est.remaining = 0 then true
              when est.target_date is null or est.estimated is null then null
              else est.estimated <= est.target_date end
  from est
$$;

-- Finished months within budget. Budgets have no history, so past months use today's budget.
create or replace function public.budget_track(p_months integer default 12, p_today date default null, p_user uuid default auth.uid())
returns jsonb language sql stable as $$
  with months as (
    select h.month_key, coalesce(sum(u.spent), 0) as spent, sum(u.budget) as budget
    from public.monthly_history(p_months, p_today, p_user) h
    cross join lateral public.budget_usage(h.month_key, p_user) u
    where not h.is_current and h.expenses > 0 and u.scope = 'group' and u.budget is not null
    group by h.month_key
  ), judged as (
    select m.month_key, m.spent <= m.budget as ok,
           row_number() over (order by m.month_key desc) as recent
    from months m
  )
  select jsonb_build_object(
    'total', count(*)::integer,
    'within', (count(*) filter (where j.ok))::integer,
    'streak', coalesce(min(j.recent) filter (where not j.ok) - 1, count(*))::integer)
  from judged j
$$;
