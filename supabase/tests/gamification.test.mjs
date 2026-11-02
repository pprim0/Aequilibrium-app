// Gamification engine (synthetic data). Reviews are inserted as the database owner because the
// "only today or yesterday" guard applies to whatever the current date is; the guard itself is
// tested through asUser below.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, asUser, one, all, addTx, USER_A, USER_B } from './helpers.mjs';

const setupData = (overrides = {}) => ({
  settings: { financial_month_start_day: 25, default_account: 'Conta', tracking_start_date: '2026-10-05', ...overrides },
  accounts: [
    { name: 'Conta', type: 'checking', opening_balance: 1000, opening_date: '2026-10-05' },
    { name: 'Poupança', type: 'savings', opening_date: '2026-10-05' },
    { name: 'Mãe', type: 'credit', opening_balance: -150, opening_date: '2026-10-05', debt_strategy: 'plan' },
  ],
  groups: [{ name: 'Dinheiro livre', monthly_budget: 100 }],
  categories: [
    { name: 'Saídas', kind: 'expense', group: 'Dinheiro livre' },
    { name: 'Pagar Mãe', kind: 'debt_payment', default_to_account: 'Mãe' },
    { name: 'Fundo', kind: 'saving', default_to_account: 'Poupança' },
  ],
  goals: [{ name: 'Fundo de emergência', target_type: 'fixed', target_amount: 400, category: 'Fundo' }],
});

async function newDb(data = setupData()) {
  const db = await createDb();
  const gam = (await one(db, `select data from public.presets where key = 'gamification_default'`)).data;
  await asUser(db, USER_A, '2026-10-05', () => one(db, 'select public.apply_setup($1::jsonb) r', [JSON.stringify({ ...data, ...gam })]));
  return db;
}

// Writes reviews directly, skipping the guard, to build history quickly.
async function reviews(db, days, fields = 'reviewed') {
  await db.exec(`alter table public.daily_checkins disable trigger daily_checkins_guard`);
  for (const day of days) {
    await db.query(
      `insert into public.daily_checkins (user_id, day, ${fields}) values ($1, $2, true)
       on conflict (user_id, day) do update set ${fields} = true`, [USER_A, day]);
  }
  await db.exec(`alter table public.daily_checkins enable trigger daily_checkins_guard`);
}

const dates = (from, n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});
const evaluate = (db, today) => asUser(db, USER_A, today, async () => (await one(db, 'select public.evaluate_gamification() r')).r);
const overview = (db, today) => asUser(db, USER_A, today, async () => (await one(db, 'select public.gamification_overview() r')).r);

describe('streak', () => {
  const streakOn = async (db, today) => (await overview(db, today)).streak;

  test('1 dia de descanso em 7 mantém; 2 falhas em 7 dias quebram', async () => {
    const db = await newDb();
    await reviews(db, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09', '2026-10-11']);
    // 08 is the rest day: 3 + 1 = 4 on the 9th. The 10th is a second miss within 7 days: back to 0.
    assert.equal(await streakOn(db, '2026-10-09'), 4);
    const cal = await asUser(db, USER_A, '2026-10-11', () => all(db, `select day::text, is_rest, streak from public.review_calendar()`));
    const by = Object.fromEntries(cal.map((c) => [c.day, c]));
    assert.equal(by['2026-10-08'].is_rest, true);
    assert.equal(by['2026-10-08'].streak, 3);
    assert.equal(by['2026-10-10'].is_rest, false);
    assert.equal(by['2026-10-10'].streak, 0);
    assert.equal(by['2026-10-11'].streak, 1);
  });

  test('passados 7 dias, volta a haver direito a descanso', async () => {
    const db = await newDb();
    await reviews(db, [...dates('2026-10-05', 3), ...dates('2026-10-09', 6), '2026-10-16']);
    // Rest on 08; next miss on 15 is 7 days later, so it is allowed again.
    assert.equal(await streakOn(db, '2026-10-16'), 10);
  });

  test('hoje por rever não conta como falha; dias de descanso configuráveis', async () => {
    const db = await newDb();
    await reviews(db, dates('2026-10-05', 3));
    assert.equal(await streakOn(db, '2026-10-08'), 3);
    const none = await newDb(setupData({ rest_days_per_week: 0 }));
    await reviews(none, ['2026-10-05', '2026-10-07']);
    assert.equal(await streakOn(none, '2026-10-07'), 1);
  });
});

describe('XP', () => {
  test('cada regra conta uma vez por período, mesmo avaliando várias vezes', async () => {
    const db = await newDb();
    await reviews(db, ['2026-10-05']);
    await reviews(db, ['2026-10-05'], 'payments_confirmed');
    await reviews(db, ['2026-10-05'], 'budget_checked');
    const first = await evaluate(db, '2026-10-05');
    assert.equal(first.xp_total, 7); // 5 + 1 + 1
    const again = await evaluate(db, '2026-10-05');
    assert.equal(again.xp_change, 0);
    assert.equal(again.xp_total, 7);
  });

  test('desmarcar hoje tira o XP; dias antigos ficam', async () => {
    const db = await newDb();
    await reviews(db, ['2026-10-05', '2026-10-09']);
    assert.equal((await evaluate(db, '2026-10-09')).xp_total, 10);
    await db.query(`update public.daily_checkins set reviewed = false where day = '2026-10-09'`);
    assert.equal((await evaluate(db, '2026-10-09')).xp_total, 5);
  });

  test('o número de movimentos não dá XP (além da conquista do primeiro)', async () => {
    const db = await newDb();
    await asUser(db, USER_A, '2026-10-06', async () => {
      for (let i = 0; i < 5; i += 1) await addTx(db, { date: '2026-10-06', amount: 1 + i, category: 'Saídas' });
    });
    assert.equal((await evaluate(db, '2026-10-06')).xp_total, 10);
    const rows = await all(db, 'select event from public.xp_ledger');
    assert.deepEqual(rows.map((r) => r.event), ['first_transaction']);
  });

  test('o cliente não escreve XP nem avalia outro utilizador', async () => {
    const db = await newDb();
    await asUser(db, USER_A, '2026-10-05', async () => {
      await assert.rejects(db.query(`select public.momentum_evaluate('${USER_A}')`), /permission denied/);
      await assert.rejects(db.query(`select public.evaluate_all_users()`), /permission denied/);
      await assert.rejects(db.query(`delete from public.xp_ledger`), /permission denied/);
    });
  });

  test('níveis: nome, XP em falta e progresso', async () => {
    const db = await newDb();
    await asUser(db, USER_A, '2026-10-06', () => addTx(db, { date: '2026-10-06', amount: 150, category: 'Pagar Mãe' }));
    await evaluate(db, '2026-10-06'); // first movement 10 + first 100 € 50 + no debts 100
    const o = await overview(db, '2026-10-06');
    assert.equal(o.xp_total, 160);
    assert.equal(o.level, 2);
    assert.equal(o.level_name, 'Organizado');
    assert.equal(o.xp_to_next, 140);
    assert.equal(Number(o.level_progress), 0.3);
    assert.deepEqual(o.xp_by_source, [{ source: null, xp: 160 }]);
  });
});

describe('missões semanais', () => {
  test('consistência: 5 dias revistos na semana', async () => {
    const db = await newDb();
    await reviews(db, dates('2026-10-05', 4));
    await evaluate(db, '2026-10-08');
    const m = (await asUser(db, USER_A, '2026-10-08', () => all(db, 'select * from public.missions_status()')))
      .find((x) => x.kind === 'days_reviewed_week');
    assert.equal(m.done, false);
    assert.equal(Number(m.current_value), 4);
    assert.equal(Number(m.target_value), 5);
    await reviews(db, ['2026-10-09']);
    await evaluate(db, '2026-10-09');
    const done = (await asUser(db, USER_A, '2026-10-09', () => all(db, 'select * from public.missions_status()')))
      .find((x) => x.kind === 'days_reviewed_week');
    assert.equal(done.done, true);
  });

  test('dinheiro livre: só com a semana terminada e dias suficientes revistos', async () => {
    const paid = (db) => one(db, `select count(*)::int n from public.xp_ledger where event = 'mission_free_pace'`);
    const db = await newDb();
    await reviews(db, dates('2026-10-05', 5));
    await evaluate(db, '2026-10-09');
    assert.equal((await paid(db)).n, 0); // the week has not ended
    await evaluate(db, '2026-10-12');
    assert.equal((await paid(db)).n, 1); // spent 0 ≤ 23,03 € and 5 days reviewed

    const lazy = await newDb();
    await reviews(lazy, dates('2026-10-05', 4));
    await evaluate(lazy, '2026-10-12');
    assert.equal((await paid(lazy)).n, 0); // only 4 days reviewed: forgetting must not pay

    const over = await newDb();
    await reviews(over, dates('2026-10-05', 5));
    await asUser(over, USER_A, '2026-10-06', () => addTx(over, { date: '2026-10-06', amount: 30, category: 'Saídas' }));
    await evaluate(over, '2026-10-12');
    assert.equal((await paid(over)).n, 0); // above the weekly pace, and nothing is taken away either
  });

  test('revisão semanal e rever dívidas pagam uma vez por semana', async () => {
    const db = await newDb();
    await reviews(db, ['2026-10-05', '2026-10-07'], 'weekly_review');
    await reviews(db, ['2026-10-07'], 'debts_goals_reviewed');
    const r = await evaluate(db, '2026-10-07');
    assert.equal(r.xp_total, 30); // 10 + 20
  });
});

describe('conquistas', () => {
  const unlocked = async (db, today) => Object.fromEntries(
    (await asUser(db, USER_A, today, () => all(db, `select name, unlocked_on::text from public.achievements_status() where unlocked_on is not null`)))
      .map((a) => [a.name, a.unlocked_on]));

  test('só com o critério cumprido, e com a data real', async () => {
    const db = await newDb();
    await evaluate(db, '2026-10-05');
    assert.deepEqual(await unlocked(db, '2026-10-05'), {});

    await asUser(db, USER_A, '2026-10-06', async () => {
      await addTx(db, { date: '2026-10-06', amount: 60, category: 'Pagar Mãe' });
      await addTx(db, { date: '2026-10-07', amount: 50, category: 'Pagar Mãe' });
      await addTx(db, { date: '2026-10-08', amount: 100, category: 'Fundo' });
    });
    await evaluate(db, '2026-10-08');
    assert.deepEqual(await unlocked(db, '2026-10-08'), {
      'Primeiro movimento': '2026-10-06',
      'Primeiros 100 € de dívida': '2026-10-07',
      'Fundo a 25%': '2026-10-08',
    });
  });

  test('sem dívidas exige ter havido dívidas e todas a zero', async () => {
    const db = await newDb();
    await asUser(db, USER_A, '2026-10-06', () => addTx(db, { date: '2026-10-06', amount: 149, category: 'Pagar Mãe' }));
    await evaluate(db, '2026-10-06');
    assert.equal((await unlocked(db, '2026-10-06'))['Sem dívidas'], undefined);
    await asUser(db, USER_A, '2026-10-07', () => addTx(db, { date: '2026-10-07', amount: 1, category: 'Pagar Mãe' }));
    await evaluate(db, '2026-10-07');
    assert.equal((await unlocked(db, '2026-10-07'))['Sem dívidas'], '2026-10-07');
  });

  test('streak, semana, 3 revisões semanais, mês e meses seguidos', async () => {
    const db = await newDb();
    // 05/10 to 30/12 every day.
    await reviews(db, dates('2026-10-05', 87));
    await reviews(db, ['2026-10-05', '2026-10-12', '2026-10-19'], 'weekly_review');
    await evaluate(db, '2026-12-30');
    const u = await unlocked(db, '2026-12-30');
    assert.equal(u['7 dias seguidos'], '2026-10-11');
    assert.equal(u['Primeira semana'], '2026-10-11');
    assert.equal(u['3 revisões semanais'], '2026-10-25');
    assert.equal(u['Primeiro mês acompanhado'], '2026-10-24'); // 20 days reviewed in the month ending 24/10
    assert.equal(u['3 meses seguidos'], '2026-12-24');
  });

  test('uma conquista desbloqueada não se perde nem paga outra vez', async () => {
    const db = await newDb();
    await asUser(db, USER_A, '2026-10-06', () => addTx(db, { date: '2026-10-06', amount: 5, category: 'Saídas' }));
    await evaluate(db, '2026-10-06');
    await db.exec(`delete from public.transactions`);
    const r = await evaluate(db, '2026-10-07');
    assert.equal(r.xp_change, 0);
    assert.equal(r.xp_total, 10);
  });

  test('conquista de hábito usa o mesmo motor', async () => {
    const db = await newDb();
    await db.exec(`
      insert into public.habits (id, user_id, name, created_at)
        values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '${USER_A}', 'Ler', '2026-10-05');
      insert into public.achievements (user_id, key, name, xp, condition)
        values ('${USER_A}', 'read_3', 'Leitor', 15, '{"type":"habit_streak","habit":"Ler","min":3}');
      insert into public.habit_logs (habit_id, user_id, log_date)
        select 'cccccccc-cccc-cccc-cccc-cccccccccccc', '${USER_A}', d::date
        from generate_series('2026-10-05'::date, '2026-10-07'::date, interval '1 day') d;`);
    await evaluate(db, '2026-10-08');
    assert.equal((await unlocked(db, '2026-10-08'))['Leitor'], '2026-10-07');
  });
});

describe('hábitos', () => {
  test('streak diária, em dias agendados e por semanas', async () => {
    const db = await newDb();
    await db.exec(`
      insert into public.habits (id, user_id, name, frequency_type, target_per_period, created_at) values
        ('dddddddd-dddd-dddd-dddd-000000000001', '${USER_A}', 'Diário', 'daily', 1, '2026-10-05'),
        ('dddddddd-dddd-dddd-dddd-000000000002', '${USER_A}', 'Segundas', 'specific_days', 1, '2026-10-05'),
        ('dddddddd-dddd-dddd-dddd-000000000003', '${USER_A}', 'Três vezes', 'weekly', 3, '2026-10-05');
      insert into public.habit_schedule_days (habit_id, weekday) values ('dddddddd-dddd-dddd-dddd-000000000002', 1);
      insert into public.habit_logs (habit_id, user_id, log_date) values
        ('dddddddd-dddd-dddd-dddd-000000000001', '${USER_A}', '2026-10-14'),
        ('dddddddd-dddd-dddd-dddd-000000000001', '${USER_A}', '2026-10-15'),
        ('dddddddd-dddd-dddd-dddd-000000000002', '${USER_A}', '2026-10-05'),
        ('dddddddd-dddd-dddd-dddd-000000000002', '${USER_A}', '2026-10-12'),
        ('dddddddd-dddd-dddd-dddd-000000000003', '${USER_A}', '2026-10-05'),
        ('dddddddd-dddd-dddd-dddd-000000000003', '${USER_A}', '2026-10-06'),
        ('dddddddd-dddd-dddd-dddd-000000000003', '${USER_A}', '2026-10-07');`);
    const rows = await asUser(db, USER_A, '2026-10-16', () => all(db, 'select * from public.habits_overview()'));
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    assert.equal(by['Diário'].current_streak, 2); // today (16) not done yet is not a miss
    assert.equal(by['Diário'].scheduled_today, true);
    assert.equal(by['Segundas'].current_streak, 2); // only Mondays count
    assert.equal(by['Segundas'].scheduled_today, false);
    assert.equal(by['Três vezes'].streak_unit, 'weeks');
    assert.equal(by['Três vezes'].current_streak, 1); // week of 05/10 met; week of 12/10 is still open, so it is not a miss
  });

  test('o hábito de sistema acompanha a revisão financeira', async () => {
    const db = await newDb();
    await asUser(db, USER_A, '2026-10-05', async () => {
      await db.query(`insert into public.daily_checkins (user_id, day, reviewed) values (auth.uid(), '2026-10-05', true)`);
      const h = await one(db, `select * from public.habits_overview() where system_key = 'daily_financial_review'`);
      assert.equal(h.done_today, true);
      await db.query(`update public.daily_checkins set reviewed = false where day = '2026-10-05'`);
      const off = await one(db, `select * from public.habits_overview() where system_key = 'daily_financial_review'`);
      assert.equal(off.done_today, false);
    });
  });

  test('RLS: outro utilizador não vê nem é avaliado', async () => {
    const db = await newDb();
    await reviews(db, ['2026-10-05']);
    await evaluate(db, '2026-10-05');
    await asUser(db, USER_B, '2026-10-05', async () => {
      assert.equal((await all(db, `select * from public.xp_ledger`)).length, 0);
      assert.equal((await all(db, `select * from public.habits_overview(null, '${USER_A}')`)).length, 0);
      assert.equal((await one(db, `select public.evaluate_gamification() r`)).r.xp_total, 0);
    });
  });
});

test('a migração aplica-se sem pg_cron e o job noturno avalia todos', async () => {
  const db = await newDb();
  await reviews(db, ['2026-10-05']);
  await db.exec(`select set_config('momentum.today', '2026-10-05', false)`);
  const n = await one(db, 'select public.evaluate_all_users() n');
  assert.equal(n.n, 1);
  assert.equal((await one(db, 'select coalesce(sum(xp),0)::int x from public.xp_ledger')).x, 5);
});
