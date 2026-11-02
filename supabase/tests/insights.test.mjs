// Goals and Insights calculations (synthetic data).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, asUser, one, all, money, addTx, USER_A, USER_B } from './helpers.mjs';

const TODAY = '2026-12-10'; // financial month 202612: 25/11 to 24/12

describe('histórico, variações e hábitos × gastos', () => {
  let db;
  before(async () => {
    db = await createDb();
    await asUser(db, USER_A, TODAY, async () => {
      await one(db, 'select public.apply_setup($1::jsonb) as r', [JSON.stringify({
        settings: { financial_month_start_day: 25, default_account: 'Conta', tracking_start_date: '2026-10-25' },
        accounts: [
          { name: 'Conta', type: 'checking', opening_balance: 5000, opening_date: '2026-10-25' },
          { name: 'Poupança', type: 'savings', opening_date: '2026-10-25' },
          { name: 'Dívida', type: 'credit', opening_balance: -1000, opening_date: '2026-10-25', debt_strategy: 'plan' },
        ],
        categories: [
          { name: 'Salário', kind: 'income' },
          { name: 'Renda', kind: 'expense', nature: 'fixed' },
          { name: 'Refeições fora', kind: 'expense' },
          { name: 'Supermercado', kind: 'expense' },
          { name: 'Pagar dívida', kind: 'debt_payment', default_to_account: 'Dívida' },
          { name: 'Fundo', kind: 'saving', default_to_account: 'Poupança' },
        ],
        goals: [{ name: 'Fundo', target_type: 'fixed', target_amount: 1000, category: 'Fundo' }],
      })]);
      // November (25/10 to 24/11)
      await addTx(db, { date: '2026-10-26', amount: 1000, category: 'Salário' });
      await addTx(db, { date: '2026-10-27', amount: 300, category: 'Renda' });
      await addTx(db, { date: '2026-10-28', amount: 100, category: 'Refeições fora' });
      await addTx(db, { date: '2026-10-29', amount: 40, category: 'Supermercado' });
      await addTx(db, { date: '2026-10-30', amount: 200, category: 'Pagar dívida' });
      await addTx(db, { date: '2026-10-30', amount: 100, category: 'Fundo' });
      // December (25/11 to 24/12)
      await addTx(db, { date: '2026-11-26', amount: 1000, category: 'Salário' });
      await addTx(db, { date: '2026-11-27', amount: 300, category: 'Renda' });
      await addTx(db, { date: '2026-11-28', amount: 30, category: 'Refeições fora' });
      await addTx(db, { date: '2026-11-29', amount: 90, category: 'Supermercado' });
      await addTx(db, { date: '2026-11-30', amount: 100, category: 'Pagar dívida' });
      await addTx(db, { date: '2026-11-30', amount: 150, category: 'Fundo' });
    });
  });

  test('histórico mensal: um registo por mês, do início do registo até agora', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, 'select * from public.monthly_history()'));
    assert.deepEqual(rows.map((r) => r.month_key), [202611, 202612]);
    const [nov, dec] = rows;
    assert.equal(money(nov.expenses), 440);
    assert.equal(money(nov.fixed_expenses), 300);
    assert.equal(money(nov.variable_expenses), 140);
    assert.equal(money(nov.debt_outstanding), 800);
    assert.equal(nov.is_current, false);
    assert.equal(money(dec.expenses), 420);
    assert.equal(money(dec.debt_outstanding), 700);
    assert.equal(dec.is_current, true);
  });

  test('o histórico respeita o limite de meses', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, 'select month_key from public.monthly_history(1)'));
    assert.deepEqual(rows.map((r) => r.month_key), [202612]);
  });

  test('objetivo mês a mês: depositado e acumulado', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db,
      `select h.* from public.goals g, public.goal_history(g.id) h order by h.month_key`));
    assert.deepEqual(rows.map((r) => [r.month_key, money(r.deposited), money(r.accumulated)]),
      [[202611, 100, 100], [202612, 150, 250]]);
    assert.equal(Number(rows[1].progress), 0.25);
  });

  test('variações por categoria: maiores alterações primeiro', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, 'select * from public.category_changes()'));
    assert.deepEqual(rows.map((r) => [r.name, money(r.change)]),
      [['Refeições fora', -70], ['Supermercado', 50], ['Renda', 0]]);
    assert.equal(money(rows[0].current_amount), 30);
    assert.equal(money(rows[0].previous_amount), 100);
  });

  test('hábitos × gastos: média com e sem o hábito, só com dados suficientes', async () => {
    const ask = () => asUser(db, USER_A, TODAY, () => one(db, `
      select s.* from public.categories c, public.habit_spending(c.id) s where c.name = 'Refeições fora'`));
    await db.exec(`insert into public.habits (id, user_id, name, created_at)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '${USER_A}', 'Cozinhar em casa', '2026-11-20')`);

    const few = await ask();
    assert.equal(few.days_done, 0);
    assert.equal(few.enough_data, false);
    assert.equal(few.avg_done, null);

    // Done on 10 days (29/11 to 08/12 except one), never on the day of the 30 € meal.
    await db.exec(`insert into public.habit_logs (habit_id, user_id, log_date)
      select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '${USER_A}', d::date
      from generate_series('2026-11-29'::date, '2026-12-08'::date, interval '1 day') d`);
    const r = await ask();
    assert.equal(r.days_done, 10);
    assert.equal(r.days_not_done, 10); // 20/11 to 09/12 = 20 finished days
    assert.equal(money(r.avg_done), 0);
    assert.equal(money(r.avg_not_done), 3); // 30 € over 10 days
    assert.equal(money(r.difference), -3);
    assert.equal(r.enough_data, true);
  });

  test('hábito só em certos dias: dias não agendados não contam', async () => {
    await db.exec(`
      insert into public.habits (id, user_id, name, frequency_type, created_at)
        values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '${USER_A}', 'Ginásio', 'specific_days', '2026-11-30');
      insert into public.habit_schedule_days (habit_id, weekday) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1);`);
    const r = await asUser(db, USER_A, TODAY, () => one(db,
      `select * from public.habit_spending() where name = 'Ginásio'`));
    // Mondays between 30/11 and 09/12: 30/11 and 07/12
    assert.equal(r.days_done + r.days_not_done, 2);
    assert.equal(r.enough_data, false);
  });

  test('RLS: outro utilizador não vê nada', async () => {
    await asUser(db, USER_B, TODAY, async () => {
      assert.equal((await all(db, `select * from public.category_changes(202612, '${USER_A}')`)).length, 0);
      assert.equal((await all(db, `select * from public.habit_spending(null, 90, null, '${USER_A}')`)).length, 0);
      const h = await all(db, `select income, expenses from public.monthly_history(12, null, '${USER_A}')`);
      assert.ok(h.every((r) => Number(r.income) === 0 && Number(r.expenses) === 0));
    });
  });
});
