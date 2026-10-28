-- Momentum Web — presets and onboarding setup.
--
-- apply_setup(data) creates a user's whole configuration from a JSON document (the onboarding
-- sends an edited preset). Inside the document rows reference each other by name.

create or replace function public.momentum_ref(p_table text, p_user uuid, p_name text, p_col text default 'name')
returns uuid language plpgsql stable as $$
declare v uuid;
begin
  if p_name is null then return null; end if;
  execute format('select id from public.%I where user_id = $1 and %I = $2', p_table, p_col)
    into v using p_user, p_name;
  if v is null then
    raise exception 'Referência desconhecida (%): "%"', p_table, p_name using errcode = 'foreign_key_violation';
  end if;
  return v;
end $$;

create or replace function public.momentum_preset_date(p_value text, p_user uuid)
returns date language sql stable as $$
  select case when p_value is null then null
              when p_value = 'today' then public.momentum_today(p_user)
              else p_value::date end
$$;

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
         coalesce(s->>'free_to_spend_mode', 'projected'),
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

  insert into public.categories (user_id, name, group_id, kind, nature, own_limit, default_to_account_id, tag, emoji, sort_order)
  select v_uid, x.name, public.momentum_ref('category_groups', v_uid, x."group"), x.kind, coalesce(x.nature, 'variable'),
         x.own_limit, public.momentum_ref('accounts', v_uid, x.default_to_account), x.tag, x.emoji, e.ord::integer
  from jsonb_array_elements(coalesce(p_data->'categories', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(name text, "group" text, kind text, nature text, own_limit numeric, default_to_account text, tag text, emoji text);
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

create or replace function public.apply_preset(p_key text)
returns jsonb language plpgsql as $$
declare v_data jsonb;
begin
  -- RLS on presets: only public presets or the caller's own.
  select data || jsonb_build_object('preset_key', key) into v_data from public.presets where key = p_key;
  -- A preset without accounts (e.g. 'gamification_default') is a building block, not a setup.
  if v_data is null or not (v_data ? 'accounts') then
    raise exception 'Preset desconhecido: %', p_key using errcode = 'no_data_found';
  end if;
  return public.apply_setup(v_data);
end $$;

-- ---------------------------------------------------------------------------
-- Shared gamification definitions + the generic preset.
-- ---------------------------------------------------------------------------
insert into public.presets (key, name, description, data) values (
  'gamification_default',
  'Gamificação base',
  'Regras de XP, níveis, missões e conquistas usadas pelos presets.',
  $json$
  {
    "xp_rules": [
      {"key": "daily_review", "name": "Revisão diária concluída", "xp": 5, "period": "day", "condition": {"type": "checkin", "field": "reviewed"}},
      {"key": "payments_confirmed", "name": "Pagamentos previstos confirmados", "xp": 1, "period": "day", "condition": {"type": "checkin", "field": "payments_confirmed"}},
      {"key": "budget_checked", "name": "Orçamento verificado", "xp": 1, "period": "day", "condition": {"type": "checkin", "field": "budget_checked"}},
      {"key": "weekly_review", "name": "Revisão semanal", "xp": 10, "period": "week", "condition": {"type": "checkin_week", "field": "weekly_review"}},
      {"key": "mission_consistency", "name": "Missão: consistência", "xp": 20, "period": "week", "condition": {"type": "days_reviewed_week", "min_setting": "min_review_days_week"}},
      {"key": "mission_free_pace", "name": "Missão: dinheiro livre no ritmo", "xp": 20, "period": "week", "condition": {"type": "group_weekly_pace", "group": "Dinheiro livre", "days_per_month": 30.4, "requires_week_ended": true, "min_setting": "min_review_days_week"}},
      {"key": "mission_debts_goals", "name": "Missão: rever dívidas e objetivos", "xp": 20, "period": "week", "condition": {"type": "checkin_week", "field": "debts_goals_reviewed"}}
    ],
    "levels": [
      {"level": 1, "name": "Iniciante", "min_xp": 0},
      {"level": 2, "name": "Organizado", "min_xp": 100},
      {"level": 3, "name": "Construtor de hábitos", "min_xp": 300},
      {"level": 4, "name": "Estratega financeiro", "min_xp": 700},
      {"level": 5, "name": "Mestre da poupança", "min_xp": 1500}
    ],
    "missions": [
      {"key": "day_review", "name": "Rever os movimentos do dia", "period": "day", "xp_rule": "daily_review"},
      {"key": "day_payments", "name": "Confirmar pagamentos previstos", "period": "day", "xp_rule": "payments_confirmed"},
      {"key": "day_budget", "name": "Ver o orçamento disponível", "period": "day", "xp_rule": "budget_checked"},
      {"key": "week_review", "name": "Revisão semanal", "period": "week", "xp_rule": "weekly_review"},
      {"key": "week_consistency", "name": "Consistência: rever 5 dos 7 dias", "period": "week", "xp_rule": "mission_consistency"},
      {"key": "week_free_pace", "name": "Dinheiro livre dentro do ritmo semanal", "period": "week", "xp_rule": "mission_free_pace"},
      {"key": "week_debts_goals", "name": "Rever dívidas e objetivos", "period": "week", "xp_rule": "mission_debts_goals"}
    ],
    "achievements": [
      {"key": "first_transaction", "name": "Primeiro movimento", "description": "Registar o primeiro movimento", "xp": 10, "condition": {"type": "transactions_count", "min": 1}},
      {"key": "first_week", "name": "Primeira semana", "description": "Rever pelo menos os dias mínimos numa semana", "xp": 20, "condition": {"type": "consistent_weeks", "min": 1}},
      {"key": "streak_7", "name": "7 dias seguidos", "description": "Streak de 7 dias", "xp": 20, "condition": {"type": "streak", "min": 7}},
      {"key": "first_month", "name": "Primeiro mês acompanhado", "description": "Mês terminado com os dias mínimos revistos", "xp": 30, "condition": {"type": "tracked_months", "min": 1}},
      {"key": "first_goal", "name": "Primeiro objetivo criado", "description": "Criar um objetivo além do fundo", "xp": 10, "condition": {"type": "goals_count", "min": 2}},
      {"key": "fund_25", "name": "Fundo a 25%", "description": "Fundo de emergência a 25% da meta", "xp": 50, "condition": {"type": "goal_milestone", "goal": "Fundo de emergência", "pct": 0.25}},
      {"key": "fund_50", "name": "Fundo a 50%", "description": "Fundo de emergência a 50%", "xp": 50, "condition": {"type": "goal_milestone", "goal": "Fundo de emergência", "pct": 0.5}},
      {"key": "fund_75", "name": "Fundo a 75%", "description": "Fundo de emergência a 75%", "xp": 50, "condition": {"type": "goal_milestone", "goal": "Fundo de emergência", "pct": 0.75}},
      {"key": "fund_100", "name": "Fundo completo", "description": "Fundo de emergência a 100%", "xp": 50, "condition": {"type": "goal_milestone", "goal": "Fundo de emergência", "pct": 1}},
      {"key": "debt_first_100", "name": "Primeiros 100 € de dívida", "description": "Pagar 100 € de dívidas no total", "xp": 50, "condition": {"type": "debt_paid_total", "min": 100}},
      {"key": "debt_free", "name": "Sem dívidas", "description": "Todas as dívidas pagas", "xp": 100, "condition": {"type": "all_debts_cleared"}},
      {"key": "weekly_reviews_3", "name": "3 revisões semanais", "description": "Fazer 3 revisões semanais", "xp": 20, "condition": {"type": "weekly_reviews", "min": 3}},
      {"key": "months_3", "name": "3 meses seguidos", "description": "3 meses consecutivos acompanhados", "xp": 50, "condition": {"type": "consecutive_tracked_months", "min": 3}}
    ],
    "habits": [
      {"name": "Revisão financeira do dia", "emoji": "📒", "system_key": "daily_financial_review"}
    ]
  }
  $json$::jsonb
) on conflict (key) do update set data = excluded.data, name = excluded.name, description = excluded.description;

insert into public.presets (key, name, description, data)
select 'generic', 'Genérico', 'Ponto de partida neutro: contas a zero, envelopes sem valores definidos.',
  $json$
  {
    "settings": {
      "financial_month_start_day": 1,
      "default_account": "Conta à ordem",
      "alert_thresholds": [0.7, 0.9, 1.0],
      "tracking_start_date": "today",
      "free_to_spend_mode": "projected"
    },
    "accounts": [
      {"name": "Conta à ordem", "type": "checking", "opening_balance": 0, "opening_date": "today"},
      {"name": "Dinheiro", "type": "cash", "opening_balance": 0, "opening_date": "today"},
      {"name": "Poupança", "type": "savings", "opening_balance": 0, "opening_date": "today"}
    ],
    "allocation_rules": [
      {"name": "Necessidades", "pct": 0.5, "source": "expense_groups"},
      {"name": "Lazer", "pct": 0.2, "source": "expense_groups"},
      {"name": "Poupança", "pct": 0.2, "source": "saving"},
      {"name": "Investimento", "pct": 0.1, "source": "investment"}
    ],
    "groups": [
      {"name": "Rendimentos"},
      {"name": "Essenciais", "allocation_rule": "Necessidades"},
      {"name": "Outras despesas", "allocation_rule": "Necessidades"},
      {"name": "Lazer", "allocation_rule": "Lazer"},
      {"name": "Poupança"},
      {"name": "Transferências"}
    ],
    "categories": [
      {"name": "Salário", "kind": "income", "group": "Rendimentos", "nature": "fixed", "tag": "salary", "emoji": "💼"},
      {"name": "Outros rendimentos", "kind": "income", "group": "Rendimentos", "emoji": "📥"},
      {"name": "Casa", "kind": "expense", "group": "Essenciais", "nature": "fixed", "emoji": "🏠"},
      {"name": "Supermercado", "kind": "expense", "group": "Essenciais", "emoji": "🛒"},
      {"name": "Transportes", "kind": "expense", "group": "Essenciais", "emoji": "🚌"},
      {"name": "Contas da casa", "kind": "expense", "group": "Essenciais", "nature": "fixed", "emoji": "💡"},
      {"name": "Saúde", "kind": "expense", "group": "Outras despesas", "emoji": "💊"},
      {"name": "Telemóvel / Internet", "kind": "expense", "group": "Outras despesas", "nature": "fixed", "emoji": "📱"},
      {"name": "Subscrições", "kind": "expense", "group": "Outras despesas", "nature": "fixed", "emoji": "🔁"},
      {"name": "Juros / comissões", "kind": "expense", "group": "Outras despesas", "emoji": "🏦"},
      {"name": "Refeições fora", "kind": "expense", "group": "Lazer", "emoji": "🍽️"},
      {"name": "Saídas / Lazer", "kind": "expense", "group": "Lazer", "emoji": "🎉"},
      {"name": "Compras", "kind": "expense", "group": "Lazer", "emoji": "🛍️"},
      {"name": "Outros", "kind": "expense", "group": "Lazer", "emoji": "📦"},
      {"name": "Fundo de emergência", "kind": "saving", "group": "Poupança", "default_to_account": "Poupança", "emoji": "🛟"},
      {"name": "Transferência entre contas", "kind": "transfer", "group": "Transferências", "emoji": "🔄"}
    ],
    "payment_methods": [
      {"name": "Cartão de débito", "account": "Conta à ordem"},
      {"name": "MB Way", "account": "Conta à ordem"},
      {"name": "Dinheiro", "account": "Dinheiro"},
      {"name": "Transferência", "account": "Conta à ordem"}
    ],
    "shortcuts": [
      {"name": "Café", "description": "Café", "category": "Refeições fora"},
      {"name": "Supermercado", "description": "Supermercado", "category": "Supermercado"},
      {"name": "Transportes", "description": "Transportes", "category": "Transportes"}
    ],
    "goals": [
      {"name": "Fundo de emergência", "target_type": "formula", "priority": 1, "category": "Fundo de emergência", "account": "Poupança",
       "target_formula": {"type": "income_multiple", "factor": 3, "includes": ["salary"], "round_up": 100, "at": "latest"}}
    ]
  }
  $json$::jsonb || (select data from public.presets where key = 'gamification_default')
on conflict (key) do update set data = excluded.data, name = excluded.name, description = excluded.description;
