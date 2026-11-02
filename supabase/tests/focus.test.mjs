// Notifications, goal plans and real progress (synthetic data).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, asUser, one, all, money, addTx, USER_A, USER_B } from './helpers.mjs';

const TODAY = '2026-11-06'; // A Friday.

describe('notificações, metas e progresso real', () => {
  let db;
  before(async () => {
    db = await createDb();
    await asUser(db, USER_A, '2026-09-25', async () => {
      await one(db, 'select public.apply_setup($1::jsonb) r', [JSON.stringify({
        settings: { financial_month_start_day: 25, default_account: 'Conta' },
        accounts: [
          { name: 'Conta', type: 'checking', opening_balance: 3000, opening_date: '2026-08-25' },
          { name: 'Poupança', type: 'savings', opening_date: '2026-08-25' },
          { name: 'Loja', type: 'credit', opening_balance: -100, opening_date: '2026-08-25', debt_strategy: 'installments' },
        ],
        groups: [{ name: 'Lazer', monthly_budget: 100 }],
        categories: [
          { name: 'Saídas', kind: 'expense', group: 'Lazer' },
          { name: 'Fundo', kind: 'saving', default_to_account: 'Poupança' },
          { name: 'Viagem', kind: 'saving', default_to_account: 'Poupança' },
        ],
        goals: [
          { name: 'Fundo', target_type: 'fixed', target_amount: 600, category: 'Fundo', target_date: '2027-02-05' },
          { name: 'Viagem', target_type: 'fixed', target_amount: 100, category: 'Viagem' },
        ],
        recurring_payments: [
          { description: 'Sem dia', amount: 5, interval_months: 1, start_date: '2026-08-25' },
          { description: 'Passou', amount: 7, day_of_month: 1, interval_months: 1, start_date: '2026-08-25' },
          { description: 'Em breve', amount: 9, day_of_month: 8, interval_months: 1, start_date: '2026-08-25' },
          { description: 'Longe', amount: 11, day_of_month: 20, interval_months: 1, start_date: '2026-08-25' },
        ],
        installments: [{ account: 'Loja', amount: 40, due_date: '2026-11-02' }, { account: 'Loja', amount: 60, due_date: '2026-12-20' }],
      })]);
    });
    // September within budget, October over it, November (current) near the limit.
    await asUser(db, USER_A, TODAY, async () => {
      await addTx(db, { date: '2026-09-01', type: 'expense', amount: 60, account: 'Conta', category: 'Saídas' });
      await addTx(db, { date: '2026-10-01', type: 'expense', amount: 150, account: 'Conta', category: 'Saídas' });
      await addTx(db, { date: '2026-11-01', type: 'expense', amount: 95, account: 'Conta', category: 'Saídas' });
      await addTx(db, { date: '2026-10-10', type: 'saving', amount: 120, account: 'Conta', category: 'Fundo' });
    });
  });

  const notes = () => asUser(db, USER_A, TODAY, () => all(db, 'select * from public.notifications()'));

  test('mostra só o que pede ação, por ordem de urgência', async () => {
    const rows = await notes();
    assert.deepEqual(rows.map((r) => [r.kind, r.name]), [
      ['payment_overdue', 'Passou'],
      ['payment_overdue', 'Loja'],
      ['payment_due', 'Em breve'],
      ['budget_limit', 'Lazer'],
      ['payment_no_day', 'Sem dia'],
      ['weekly_review', null],
    ]);
    assert.equal(rows.find((r) => r.kind === 'budget_limit').level, 'orange');
    assert.equal(money(rows.find((r) => r.kind === 'budget_limit').amount), 95);
  });

  test('a revisão semanal desaparece quando é feita e não aparece antes de sexta', async () => {
    await db.exec(`alter table public.daily_checkins disable trigger daily_checkins_guard`);
    await db.query(`insert into public.daily_checkins (user_id, day, weekly_review) values ($1, '2026-11-05', true)`, [USER_A]);
    await db.exec(`alter table public.daily_checkins enable trigger daily_checkins_guard`);
    assert.ok(!(await notes()).some((r) => r.kind === 'weekly_review'));
    await db.query(`delete from public.daily_checkins where user_id = $1`, [USER_A]);
    const thursday = await asUser(db, USER_A, '2026-11-05', () => all(db, 'select kind from public.notifications()'));
    assert.ok(!thursday.some((r) => r.kind === 'weekly_review'));
  });

  test('cada pessoa só vê as suas notificações', async () => {
    assert.deepEqual(await asUser(db, USER_B, TODAY, () => all(db, 'select * from public.notifications()')), []);
    assert.deepEqual(await asUser(db, USER_B, TODAY, () => all(db, `select * from public.notifications(null, '${USER_A}')`)), []);
  });

  test('a meta diz quanto pôr por mês e se o ritmo chega', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, `
      select gp.*, g.name from public.goal_plans() gp join public.goals g on g.id = gp.goal_id`));
    const fundo = rows.find((r) => r.name === 'Fundo');
    assert.equal(fundo.months_left, 3); // 91 days
    assert.equal(money(fundo.monthly_needed), 160); // (600 - 120) / 3
    assert.equal(money(fundo.monthly_average), 120); // 28 days of deposits = 1 month
    assert.equal(fundo.on_track, false); // 480 / 120 = 4 months, only 3 left
    const viagem = rows.find((r) => r.name === 'Viagem');
    assert.equal(viagem.months_left, null);
    assert.equal(viagem.monthly_needed, null);
    assert.equal(viagem.estimated_date, null);
    assert.equal(viagem.on_track, null);
  });

  test('conta os meses terminados dentro do orçamento', async () => {
    const r = await asUser(db, USER_A, TODAY, () => one(db, 'select public.budget_track() r'));
    // Financial months: Sep 1 → 202609, Oct 1 → 202610. The current month does not count.
    assert.deepEqual(r.r, { total: 2, within: 1, streak: 0 });
  });

  test('sem hábitos criados, a página fica desligada', async () => {
    const s = await asUser(db, USER_A, TODAY, () => one(db, 'select show_habits from public.user_settings'));
    assert.equal(s.show_habits, false);
  });
});
