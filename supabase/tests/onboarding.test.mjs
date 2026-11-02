// What the onboarding sends, run through the real apply_setup: a new account from an edited preset.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, asUser, one, all, money, addTx, USER_A } from './helpers.mjs';
import { finalizeSetup, startEditing } from '../../web/src/lib/setup-data.ts';

const TODAY = '2026-11-03';

async function genericPreset(db) {
  return (await one(db, `select data from public.presets where key = 'generic'`)).data;
}

async function run(db, doc) {
  return asUser(db, USER_A, TODAY, () => one(db, 'select public.apply_setup($1::jsonb) r', [JSON.stringify(doc)]));
}

describe('onboarding com conta nova', () => {
  test('preset genérico sem alterações', async () => {
    const db = await createDb();
    const doc = finalizeSetup(startEditing(await genericPreset(db)), TODAY);
    const r = await run(db, doc);
    assert.equal(r.r.accounts, 3);
    await asUser(db, USER_A, TODAY, async () => {
      const f = (await one(db, 'select public.free_to_spend() f')).f;
      assert.equal(f.state, 'no_income');
      assert.equal((await one(db, 'select public.evaluate_gamification() r')).r.xp_total, 0);
      const levels = await all(db, 'select level from public.levels');
      assert.equal(levels.length, 5);
    });
  });

  test('preset editado: saldos, dívida nova, conta renomeada e removida, rendimento, envelope, hábito e objetivo', async () => {
    const db = await createDb();
    const draft = startEditing(await genericPreset(db));
    draft.settings.financial_month_start_day = 25;
    const bank = draft.accounts.find((a) => a.name === 'Conta à ordem');
    bank.name = 'Banco';
    bank.opening_balance = 500;
    draft.accounts = draft.accounts.filter((a) => a.name !== 'Dinheiro');
    draft.accounts.push({ name: 'Irmão', type: 'credit', opening_balance: 200, debt_strategy: 'plan', opening_date: TODAY });
    draft.income_sources = [{ name: 'Ordenado', tag: 'salary', category: 'Salário', amount: 1000, valid_from: TODAY }];
    draft.groups.find((g) => g.name === 'Lazer').monthly_budget = 100;
    draft.habits.push({ name: 'Ler' });
    draft.categories.push({ name: 'Viagem', kind: 'saving', nature: 'fixed', default_to_account: 'Poupança' });
    draft.goals.push({ name: 'Viagem', target_type: 'fixed', target_amount: 800, category: 'Viagem' });

    await run(db, finalizeSetup(draft, TODAY));

    await asUser(db, USER_A, TODAY, async () => {
      const s = await one(db, 'select financial_month_start_day, (select name from public.accounts a where a.id = default_account_id) as main from public.user_settings');
      assert.deepEqual([s.financial_month_start_day, s.main], [25, 'Banco']);

      const b = Object.fromEntries((await all(db, 'select name, balance, debt_outstanding from public.account_balances()')).map((r) => [r.name, r]));
      assert.equal(money(b.Banco.balance), 500);
      assert.equal(b.Dinheiro, undefined);
      assert.equal(money(b['Irmão'].debt_outstanding), 200);

      // The method tied to the removed account went with it; a payment category exists for the new debt.
      const methods = (await all(db, 'select name from public.payment_methods')).map((m) => m.name);
      assert.ok(!methods.includes('Dinheiro'));
      await addTx(db, { date: TODAY, amount: 50, category: 'Dívida: Irmão' });
      const after = await one(db, `select balance from public.account_balances() where name = 'Irmão'`);
      assert.equal(money(after.balance), -150);

      // The fund target is calculated from the income entered here: 3 × 1000.
      const goals = Object.fromEntries((await all(db, 'select name, target from public.goal_progress()')).map((g) => [g.name, g]));
      assert.equal(money(goals['Fundo de emergência'].target), 3000);
      assert.equal(money(goals.Viagem.target), 800);

      assert.equal((await one(db, `select count(*)::int n from public.habits where name = 'Ler'`)).n, 1);
      assert.equal((await one(db, `select count(*)::int n from public.habits where system_key = 'daily_financial_review'`)).n, 1);
      assert.equal((await one(db, `select count(*)::int n from public.achievements where key = 'debt_irmao'`)).n, 1);
    });
  });

  test('não se configura duas vezes', async () => {
    const db = await createDb();
    const doc = finalizeSetup(startEditing(await genericPreset(db)), TODAY);
    await run(db, doc);
    await assert.rejects(run(db, doc), /já tem configuração/);
  });
});
