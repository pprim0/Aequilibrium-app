-- Momentum Web — gamification engine shared by habits and finances. Safe to run more than once.
--
-- Rules, levels, missions and achievements are per-user data; this file only knows the condition
-- types. Clients cannot write XP: evaluate_gamification() is the only way in, and it derives
-- everything from what actually happened. XP never depends on the number of movements or on
-- spending less by force, and nothing here is random.

-- ---------------------------------------------------------------------------
-- 1. Streaks
-- ---------------------------------------------------------------------------
-- Day by day from the start of tracking. A missed day is a rest day (streak kept, not increased)
-- while fewer than rest_days_per_week rest days were used in the previous 6 days. Today is never
-- a miss. A day without expenses counts as long as the review was confirmed.
create or replace function public.review_calendar(p_today date default null, p_user uuid default auth.uid())
returns table (day date, reviewed boolean, is_rest boolean, is_today boolean, streak integer)
language plpgsql stable as $$
declare
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_rest_allowed integer := coalesce((select rest_days_per_week from public.user_settings where user_id = p_user), 1);
  v_from date;
  v_rests date[] := '{}';
  v_streak integer := 0;
  v_day date;
  v_done boolean;
  v_rest boolean;
begin
  select least(
    v_today,
    coalesce((select tracking_start_date from public.user_settings where user_id = p_user), v_today),
    coalesce((select min(c.day) from public.daily_checkins c where c.user_id = p_user), v_today))
  into v_from;

  v_day := v_from;
  while v_day <= v_today loop
    v_done := exists (select 1 from public.daily_checkins c where c.user_id = p_user and c.day = v_day and c.reviewed);
    v_rest := false;
    if v_done then
      v_streak := v_streak + 1;
    elsif v_day < v_today then
      if v_streak > 0
         and (select count(*) from unnest(v_rests) r where r >= v_day - 6) < v_rest_allowed then
        v_rest := true;
        v_rests := v_rests || v_day;
      else
        v_streak := 0;
      end if;
    end if;
    day := v_day;
    reviewed := v_done;
    is_rest := v_rest;
    is_today := v_day = v_today;
    streak := v_streak;
    return next;
    v_day := v_day + 1;
  end loop;
end $$;

-- Habit streak: consecutive scheduled days, or consecutive weeks for "N times a week" habits.
-- reached_on: first day the streak reached p_min (used by habit achievements).
create or replace function public.habit_streak(p_habit_id uuid, p_today date default null, p_min integer default null)
returns table (current_streak integer, best_streak integer, unit text, reached_on date)
language plpgsql stable as $$
declare
  h public.habits;
  v_today date;
  v_first date;
  v_day date;
  v_streak integer := 0;
  v_best integer := 0;
  v_reached date;
  v_count integer;
begin
  select * into h from public.habits where id = p_habit_id;
  if not found then return; end if;
  v_today := coalesce(p_today, public.momentum_today(h.user_id));
  select least(h.created_at::date, coalesce(min(l.log_date), h.created_at::date), v_today)
  into v_first from public.habit_logs l where l.habit_id = h.id and l.status = 'done';

  if h.frequency_type = 'weekly' then
    v_day := date_trunc('week', v_first)::date;
    while v_day <= v_today loop
      select count(*) into v_count from public.habit_logs l
      where l.habit_id = h.id and l.status = 'done' and l.log_date between v_day and v_day + 6;
      if v_count >= h.target_per_period then
        v_streak := v_streak + 1;
        if p_min is not null and v_reached is null and v_streak >= p_min then v_reached := least(v_day + 6, v_today); end if;
      elsif v_day + 6 < v_today then
        v_streak := 0;
      end if;
      v_best := greatest(v_best, v_streak);
      v_day := v_day + 7;
    end loop;
    current_streak := v_streak; best_streak := v_best; unit := 'weeks'; reached_on := v_reached;
    return next;
    return;
  end if;

  v_day := v_first;
  while v_day <= v_today loop
    if h.frequency_type <> 'specific_days' or exists (
      select 1 from public.habit_schedule_days s
      where s.habit_id = h.id and s.weekday = extract(dow from v_day)::integer) then
      if exists (select 1 from public.habit_logs l where l.habit_id = h.id and l.log_date = v_day and l.status = 'done') then
        v_streak := v_streak + 1;
        if p_min is not null and v_reached is null and v_streak >= p_min then v_reached := v_day; end if;
      elsif v_day < v_today then
        v_streak := 0;
      end if;
      v_best := greatest(v_best, v_streak);
    end if;
    v_day := v_day + 1;
  end loop;
  current_streak := v_streak; best_streak := v_best; unit := 'days'; reached_on := v_reached;
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tracked weeks and months
-- ---------------------------------------------------------------------------
create or replace function public.review_weeks(p_today date default null, p_user uuid default auth.uid())
returns table (week_start date, week_end date, week_key text, days_reviewed integer, weekly_review boolean, debts_goals_reviewed boolean, is_finished boolean)
language sql stable as $$
  with p as (select coalesce(p_today, public.momentum_today(p_user)) as today),
  bounds as (
    select p.today,
           date_trunc('week', least(
             p.today,
             coalesce((select tracking_start_date from public.user_settings where user_id = p_user), p.today),
             coalesce((select min(c.day) from public.daily_checkins c where c.user_id = p_user), p.today)))::date as first_week
    from p
  )
  select w::date, w::date + 6, to_char(w, 'IYYY-"W"IW'),
         count(c.id) filter (where c.reviewed)::integer,
         coalesce(bool_or(c.weekly_review), false),
         coalesce(bool_or(c.debts_goals_reviewed), false),
         w::date + 6 < b.today
  from bounds b
  cross join generate_series(b.first_week, b.today, interval '7 days') as w
  left join public.daily_checkins c on c.user_id = p_user and c.day between w::date and w::date + 6 and c.day <= b.today
  group by w, b.today
  order by w
$$;

create or replace function public.tracked_months(p_today date default null, p_user uuid default auth.uid())
returns table (month_key integer, end_date date, days_reviewed integer, tracked boolean, consecutive integer)
language plpgsql stable as $$
declare
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_sd integer := public.momentum_start_day(p_user);
  v_min integer := coalesce((select min_review_days_month from public.user_settings where user_id = p_user), 15);
  v_key integer;
  v_last integer := public.fin_month_key(v_today, v_sd);
  v_run integer := 0;
begin
  v_key := public.fin_month_key(least(
    v_today,
    coalesce((select tracking_start_date from public.user_settings where user_id = p_user), v_today),
    coalesce((select min(c.day) from public.daily_checkins c where c.user_id = p_user), v_today)), v_sd);
  while v_key <= v_last loop
    month_key := v_key;
    end_date := public.fin_month_end(v_key, v_sd);
    select count(*)::integer into days_reviewed from public.daily_checkins c
    where c.user_id = p_user and c.reviewed and c.day between public.fin_month_start(v_key, v_sd) and end_date;
    tracked := end_date < v_today and days_reviewed >= v_min;
    v_run := case when tracked then v_run + 1 else 0 end;
    consecutive := v_run;
    return next;
    v_key := public.month_key_shift(v_key, 1);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Achievement conditions: the day a condition became true, or null
-- ---------------------------------------------------------------------------
create or replace function public.momentum_achievement_date(p_cond jsonb, p_habit_id uuid, p_user uuid, p_today date)
returns date language plpgsql stable as $$
declare
  v_type text := p_cond->>'type';
  v_min numeric := coalesce((p_cond->>'min')::numeric, 1);
  v_min_week integer := coalesce((select min_review_days_week from public.user_settings where user_id = p_user), 5);
  v_date date;
begin
  case v_type
    when 'transactions_count' then
      select t.date into v_date from public.transactions t
      where t.user_id = p_user and t.date <= p_today
      order by t.date, t.created_at offset (v_min::integer - 1) limit 1;
    when 'consistent_weeks' then
      select least(w.week_end, p_today) into v_date from public.review_weeks(p_today, p_user) w
      where w.days_reviewed >= v_min_week
      order by w.week_start offset (v_min::integer - 1) limit 1;
    when 'streak' then
      select min(c.day) into v_date from public.review_calendar(p_today, p_user) c where c.streak >= v_min;
    when 'tracked_months' then
      select m.end_date into v_date from public.tracked_months(p_today, p_user) m
      where m.tracked order by m.month_key offset (v_min::integer - 1) limit 1;
    when 'consecutive_tracked_months' then
      select min(m.end_date) into v_date from public.tracked_months(p_today, p_user) m where m.consecutive >= v_min;
    when 'goals_count' then
      select g.created_at::date into v_date from public.goals g
      where g.user_id = p_user order by g.created_at offset (v_min::integer - 1) limit 1;
    when 'goal_milestone' then
      select (m->>'reached_on')::date into v_date
      from public.goal_progress(p_today, p_user) g, jsonb_array_elements(g.milestones) m
      where g.name = p_cond->>'goal' and (m->>'pct')::numeric = (p_cond->>'pct')::numeric;
    when 'debt_paid_total' then
      select min(x.date) into v_date from (
        select t.date, sum(t.amount) over (order by t.date, t.created_at, t.id) as running
        from public.transactions t
        where t.user_id = p_user and t.type = 'debt_payment' and t.date <= p_today
      ) x where x.running >= v_min;
    when 'debt_cleared' then
      select (select max(t.date) from public.transactions t
              where t.user_id = p_user and t.to_account_id = d.account_id and t.date <= p_today)
      into v_date
      from public.debt_summary(p_today, p_user) d
      where d.name = p_cond->>'account' and d.status = 'paid' and d.total_borrowed > 0;
    when 'all_debts_cleared' then
      if exists (select 1 from public.debt_summary(p_today, p_user) d where d.total_borrowed > 0)
         and not exists (select 1 from public.debt_summary(p_today, p_user) d where d.status <> 'paid' and d.total_borrowed > 0) then
        select max(t.date) into v_date from public.transactions t
        where t.user_id = p_user and t.type = 'debt_payment' and t.date <= p_today;
      end if;
    when 'weekly_reviews' then
      select least(w.week_end, p_today) into v_date from public.review_weeks(p_today, p_user) w
      where w.weekly_review order by w.week_start offset (v_min::integer - 1) limit 1;
    when 'habit_streak' then
      select s.reached_on into v_date
      from public.habits h, public.habit_streak(h.id, p_today, v_min::integer) s
      where h.user_id = p_user and not h.is_archived
        and (h.id = p_habit_id or (p_habit_id is null and h.name = p_cond->>'habit'))
      limit 1;
    else
      v_date := null;
  end case;
  return v_date;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The evaluator (the only writer of XP)
-- ---------------------------------------------------------------------------
create or replace function public.momentum_evaluate(p_user uuid, p_today date default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_before integer;
  v_after integer;
  v_unlocked text[] := '{}';
  v_min_week integer := coalesce((select min_review_days_week from public.user_settings where user_id = p_user), 5);
  r public.xp_rules;
  a public.achievements;
  v_field text;
  v_min integer;
  v_group record;
  v_limit numeric;
  v_date date;
begin
  select coalesce(sum(xp), 0)::integer into v_before from public.xp_ledger where user_id = p_user;

  for r in select * from public.xp_rules where user_id = p_user and is_active loop
    v_field := r.condition->>'field';
    case r.condition->>'type'
      when 'checkin' then
        if v_field in ('reviewed', 'payments_confirmed', 'budget_checked') then
          execute format(
            'insert into public.xp_ledger (user_id, rule_id, period_key, xp, event, earned_on)
             select $1, $2, to_char(c.day, ''YYYY-MM-DD''), $3, $4, c.day
             from public.daily_checkins c
             where c.user_id = $1 and c.%I and c.day <= $5
             on conflict (user_id, rule_id, period_key) where rule_id is not null do nothing', v_field)
          using p_user, r.id, r.xp, r.key, v_today;
          -- Today and yesterday can still be corrected: unticking takes the XP back.
          execute format(
            'delete from public.xp_ledger l
             where l.user_id = $1 and l.rule_id = $2
               and l.period_key in (to_char($3::date, ''YYYY-MM-DD''), to_char($3::date - 1, ''YYYY-MM-DD''))
               and not exists (select 1 from public.daily_checkins c
                               where c.user_id = $1 and c.%I and to_char(c.day, ''YYYY-MM-DD'') = l.period_key)', v_field)
          using p_user, r.id, v_today;
        end if;

      when 'checkin_week' then
        if v_field in ('weekly_review', 'debts_goals_reviewed') then
          execute format(
            'insert into public.xp_ledger (user_id, rule_id, period_key, xp, event, earned_on)
             select $1, $2, w.week_key, $3, $4, least(w.week_end, $5)
             from public.review_weeks($5, $1) w where w.%I
             on conflict (user_id, rule_id, period_key) where rule_id is not null do nothing', v_field)
          using p_user, r.id, r.xp, r.key, v_today;
          execute format(
            'delete from public.xp_ledger l
             where l.user_id = $1 and l.rule_id = $2
               and l.period_key in (to_char($3::date, ''IYYY-"W"IW''), to_char($3::date - 1, ''IYYY-"W"IW''))
               and not exists (select 1 from public.review_weeks($3, $1) w where w.%I and w.week_key = l.period_key)', v_field)
          using p_user, r.id, v_today;
        end if;

      when 'days_reviewed_week' then
        v_min := coalesce((r.condition->>'min')::integer, v_min_week);
        insert into public.xp_ledger (user_id, rule_id, period_key, xp, event, earned_on)
        select p_user, r.id, w.week_key, r.xp, r.key, least(w.week_end, v_today)
        from public.review_weeks(v_today, p_user) w where w.days_reviewed >= v_min
        on conflict (user_id, rule_id, period_key) where rule_id is not null do nothing;

      when 'group_weekly_pace' then
        -- Only finished weeks with enough reviewed days: forgetting to register must not pay.
        select g.id, g.monthly_budget into v_group from public.category_groups g
        where g.user_id = p_user and g.name = r.condition->>'group';
        if v_group.monthly_budget is not null then
          v_min := coalesce((r.condition->>'min')::integer, v_min_week);
          v_limit := v_group.monthly_budget * 7 / coalesce((r.condition->>'days_per_month')::numeric, 30.4);
          insert into public.xp_ledger (user_id, rule_id, period_key, xp, event, earned_on)
          select p_user, r.id, w.week_key, r.xp, r.key, w.week_end
          from public.review_weeks(v_today, p_user) w
          where w.is_finished and w.days_reviewed >= v_min
            and coalesce((select sum(t.amount) from public.transactions t
                          join public.categories c on c.id = t.category_id
                          where t.user_id = p_user and t.type = 'expense' and c.group_id = v_group.id
                            and t.date between w.week_start and w.week_end), 0) <= v_limit
          on conflict (user_id, rule_id, period_key) where rule_id is not null do nothing;
        end if;
      else
        null;
    end case;
  end loop;

  for a in
    select * from public.achievements x
    where x.user_id = p_user and x.is_active
      and not exists (select 1 from public.achievement_unlocks u where u.user_id = p_user and u.achievement_id = x.id)
  loop
    v_date := public.momentum_achievement_date(a.condition, a.habit_id, p_user, v_today);
    if v_date is not null then
      insert into public.achievement_unlocks (user_id, achievement_id, unlocked_on) values (p_user, a.id, v_date)
      on conflict (user_id, achievement_id) do nothing;
      insert into public.xp_ledger (user_id, achievement_id, period_key, xp, event, earned_on)
      values (p_user, a.id, 'once', a.xp, a.key, v_date)
      on conflict (user_id, achievement_id) where achievement_id is not null do nothing;
      v_unlocked := v_unlocked || a.name;
    end if;
  end loop;

  select coalesce(sum(xp), 0)::integer into v_after from public.xp_ledger where user_id = p_user;
  return jsonb_build_object('xp_change', v_after - v_before, 'xp_total', v_after, 'unlocked', to_jsonb(v_unlocked));
end $$;

-- What the app calls after every relevant write: always for the signed-in user.
create or replace function public.evaluate_gamification()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão em falta.' using errcode = 'insufficient_privilege';
  end if;
  return public.momentum_evaluate(auth.uid());
end $$;

-- Nightly job: finished weeks and months pay even without a new write.
create or replace function public.evaluate_all_users()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_count integer := 0;
begin
  for v_user in select user_id from public.user_settings loop
    perform public.momentum_evaluate(v_user);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on function public.momentum_evaluate(uuid, date) from public, anon, authenticated;
revoke all on function public.evaluate_all_users() from public, anon, authenticated;
revoke all on function public.evaluate_gamification() from public, anon;
grant execute on function public.evaluate_gamification() to authenticated;

-- Schedule the nightly job only where pg_cron is enabled.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $job$select cron.schedule('momentum-nightly', '30 3 * * *', 'select public.evaluate_all_users()')$job$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The system habit follows the daily review
-- ---------------------------------------------------------------------------
create or replace function public.daily_checkins_sync_habit()
returns trigger language plpgsql as $$
declare v_habit uuid;
begin
  select id into v_habit from public.habits
  where user_id = new.user_id and system_key = 'daily_financial_review';
  if v_habit is null then return new; end if;
  if new.reviewed then
    insert into public.habit_logs (habit_id, user_id, log_date, status)
    values (v_habit, new.user_id, new.day, 'done')
    on conflict (habit_id, log_date) do update set status = 'done';
  else
    delete from public.habit_logs where habit_id = v_habit and log_date = new.day;
  end if;
  return new;
end $$;

drop trigger if exists daily_checkins_sync_habit on public.daily_checkins;
create trigger daily_checkins_sync_habit
  after insert or update on public.daily_checkins
  for each row execute function public.daily_checkins_sync_habit();

-- ---------------------------------------------------------------------------
-- 6. Read side
-- ---------------------------------------------------------------------------
create or replace function public.gamification_overview(p_today date default null, p_user uuid default auth.uid())
returns jsonb language plpgsql stable as $$
declare
  v_today date := coalesce(p_today, public.momentum_today(p_user));
  v_sd integer := public.momentum_start_day(p_user);
  v_key integer := public.fin_month_key(v_today, v_sd);
  v_start date := public.fin_month_start(v_key, v_sd);
  v_xp integer;
  v_level record;
  v_next record;
begin
  select coalesce(sum(xp), 0)::integer into v_xp from public.xp_ledger where user_id = p_user;
  select level, name, min_xp into v_level from public.levels
  where user_id = p_user and min_xp <= v_xp order by min_xp desc limit 1;
  select level, name, min_xp into v_next from public.levels
  where user_id = p_user and min_xp > v_xp order by min_xp limit 1;

  return jsonb_build_object(
    'xp_total', v_xp,
    'level', v_level.level,
    'level_name', v_level.name,
    'next_level_name', v_next.name,
    'xp_to_next', v_next.min_xp - v_xp,
    'level_progress', case
      when v_next.min_xp is null then 1
      when v_level.min_xp is null then 0
      else round((v_xp - v_level.min_xp)::numeric / (v_next.min_xp - v_level.min_xp), 4) end,
    'xp_by_source', coalesce((
      select jsonb_agg(jsonb_build_object('source', x.source, 'xp', x.xp) order by x.ord)
      from (
        select r.name as source, sum(l.xp)::integer as xp, min(r.sort_order) as ord
        from public.xp_ledger l join public.xp_rules r on r.id = l.rule_id
        where l.user_id = p_user group by r.name
        union all
        select null, sum(l.xp)::integer, 100000
        from public.xp_ledger l where l.user_id = p_user and l.achievement_id is not null
        having count(*) > 0
      ) x), '[]'::jsonb),
    'streak', (select coalesce(c.streak, 0) from public.review_calendar(v_today, p_user) c where c.day = v_today),
    'best_streak', (select coalesce(max(c.streak), 0) from public.review_calendar(v_today, p_user) c),
    'reviewed_today', exists (select 1 from public.daily_checkins c where c.user_id = p_user and c.day = v_today and c.reviewed),
    'days_reviewed_month', (select count(*) from public.daily_checkins c
                            where c.user_id = p_user and c.reviewed and c.day between v_start and v_today),
    'days_elapsed_month', v_today - v_start + 1
  );
end $$;

-- Missions of the current day and week, with how far along they are.
create or replace function public.missions_status(p_today date default null, p_user uuid default auth.uid())
returns table (
  mission_id uuid, name text, period text, xp integer, done boolean, kind text, current_value numeric, target_value numeric
) language sql stable as $$
  with p as (
    select coalesce(p_today, public.momentum_today(p_user)) as today,
           coalesce((select min_review_days_week from public.user_settings where user_id = p_user), 5) as min_week
  ), w as (
    select date_trunc('week', p.today)::date as s, p.today, p.min_week from p
  )
  select m.id, m.name, m.period, coalesce(r.xp, 0),
         exists (
           select 1 from public.xp_ledger l
           where l.user_id = p_user and l.rule_id = m.xp_rule_id
             and l.period_key = case m.period when 'day' then to_char(w.today, 'YYYY-MM-DD') else to_char(w.today, 'IYYY-"W"IW') end),
         r.condition->>'type',
         case r.condition->>'type'
           when 'days_reviewed_week' then (
             select count(*) from public.daily_checkins c
             where c.user_id = p_user and c.reviewed and c.day between w.s and w.s + 6)
           when 'group_weekly_pace' then (
             select coalesce(sum(t.amount), 0) from public.transactions t
             join public.categories c on c.id = t.category_id
             join public.category_groups g on g.id = c.group_id
             where t.user_id = p_user and t.type = 'expense' and g.name = r.condition->>'group'
               and t.date between w.s and w.s + 6)
         end,
         case r.condition->>'type'
           when 'days_reviewed_week' then coalesce((r.condition->>'min')::numeric, w.min_week)
           when 'group_weekly_pace' then (
             select round(g.monthly_budget * 7 / coalesce((r.condition->>'days_per_month')::numeric, 30.4), 2)
             from public.category_groups g where g.user_id = p_user and g.name = r.condition->>'group')
         end
  from public.missions m
  cross join w
  left join public.xp_rules r on r.id = m.xp_rule_id
  where m.user_id = p_user and m.is_active
  order by m.period, m.sort_order
$$;

create or replace function public.achievements_status(p_user uuid default auth.uid())
returns table (achievement_id uuid, name text, description text, xp integer, unlocked_on date)
language sql stable as $$
  select a.id, a.name, a.description, a.xp, u.unlocked_on
  from public.achievements a
  left join public.achievement_unlocks u on u.achievement_id = a.id and u.user_id = a.user_id
  where a.user_id = p_user and a.is_active
  order by a.sort_order, a.name
$$;

create or replace function public.habits_overview(p_today date default null, p_user uuid default auth.uid())
returns table (
  habit_id uuid, name text, emoji text, color text, frequency_type text, target_per_period integer,
  time_of_day time, system_key text, weekdays integer[], scheduled_today boolean, done_today boolean,
  done_this_week integer, current_streak integer, best_streak integer, streak_unit text
) language sql stable as $$
  with p as (select coalesce(p_today, public.momentum_today(p_user)) as today)
  select h.id, h.name, h.emoji, h.color, h.frequency_type, h.target_per_period, h.time_of_day, h.system_key,
         coalesce((select array_agg(s.weekday order by s.weekday) from public.habit_schedule_days s where s.habit_id = h.id), '{}'),
         h.frequency_type <> 'specific_days' or exists (
           select 1 from public.habit_schedule_days s
           where s.habit_id = h.id and s.weekday = extract(dow from p.today)::integer),
         exists (select 1 from public.habit_logs l where l.habit_id = h.id and l.log_date = p.today and l.status = 'done'),
         (select count(*)::integer from public.habit_logs l
          where l.habit_id = h.id and l.status = 'done'
            and l.log_date between date_trunc('week', p.today)::date and date_trunc('week', p.today)::date + 6),
         s.current_streak, s.best_streak, s.unit
  from public.habits h
  cross join p
  cross join lateral public.habit_streak(h.id, p.today) s
  where h.user_id = p_user and not h.is_archived
  order by h.sort_order, h.created_at
$$;

-- ---------------------------------------------------------------------------
-- 7. Generic preset: its weekly pace mission follows its own group name
-- ---------------------------------------------------------------------------
update public.presets
set data = replace(data::text, '"group": "Dinheiro livre"', '"group": "Lazer"')::jsonb
where key = 'generic';
