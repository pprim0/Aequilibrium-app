// Credit cards (a way to pay, with a limit) and the commitments summary.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, asUser, one, all, money, addTx, USER_A, USER_B } from './helpers.mjs';

const TODAY = '2026-11-03';

describe('cartões de crédito e resumo de compromissos', () => {
  let db;
  before(async () => {
    db = await createDb();
    await asUser(db, USER_A, TODAY, async () => {
      await one(db, 'select public.apply_setup($1::jsonb) r', [JSON.stringify({
        settings: { financial_month_start_day: 25, default_account: 'Conta' },
        accounts: [
          { name: 'Conta', type: 'checking', opening_balance: 1000, opening_date: '2026-10-25' },
          { name: 'Visa', type: 'credit', opening_balance: 0, opening_date: '2026-10-25', debt_strategy: 'plan', is_credit_card: true, credit_limit: 500 },
          { name: 'Banco', type: 'credit', opening_balance: -1000, opening_date: '2026-10-25', debt_strategy: 'plan' },
          { name: 'Loja', type: 'credit', opening_balance: -100, opening_date: '2026-10-25', debt_strategy: 'installments' },
        ],
        categories: [
          { name: 'Compras', kind: 'expense' },
          { name: 'Pagar Visa', kind: 'debt_payment', default_to_account: 'Visa' },
          { name: 'Pagar Banco', kind: 'debt_payment', default_to_account: 'Banco' },
        ],
        payment_methods: [{ name: 'Visa', account: 'Visa' }],
        installments: [{ account: 'Loja', amount: 50, due_date: '2026-11-20' }, { account: 'Loja', amount: 50, due_date: '2026-12-20' }],
        monthly_plans: [{ month_key: 202611, kind: 'debts', amount: 300 }],
      })]);
    });
  });

  const card = () => asUser(db, USER_A, TODAY, () => one(db, `select * from public.debt_summary() where name = 'Visa'`));

  test('cartão sem saldo: conta como pago e com o plafond todo disponível', async () => {
    const c = await card();
    assert.equal(c.is_credit_card, true);
    assert.equal(money(c.credit_limit), 500);
    assert.equal(money(c.available_credit), 500);
    assert.equal(c.status, 'paid');
  });

  test('compra no cartão reduz o disponível; pagar repõe', async () => {
    await asUser(db, USER_A, TODAY, () => addTx(db, { date: TODAY, amount: 120, category: 'Compras', method: 'Visa' }));
    let c = await card();
    assert.equal(money(c.outstanding), 120);
    assert.equal(money(c.available_credit), 380);
    await asUser(db, USER_A, TODAY, () => addTx(db, { date: TODAY, amount: 120, category: 'Pagar Visa' }));
    c = await card();
    assert.equal(money(c.outstanding), 0);
    assert.equal(money(c.available_credit), 500);
  });

  test('o disponível nunca fica negativo acima do plafond', async () => {
    await asUser(db, USER_A, TODAY, () => addTx(db, { date: TODAY, amount: 600, category: 'Compras', method: 'Visa' }));
    assert.equal(money((await card()).available_credit), 0);
    await asUser(db, USER_A, TODAY, () => addTx(db, { date: TODAY, amount: 600, category: 'Pagar Visa' }));
  });

  test('resumo: total, pago, este mês vs plano, próximo pagamento e crédito disponível', async () => {
    await asUser(db, USER_A, TODAY, () => addTx(db, { date: TODAY, amount: 200, category: 'Pagar Banco' }));
    const o = await asUser(db, USER_A, TODAY, async () => (await one(db, 'select public.debt_overview() r')).r);
    assert.equal(money(o.outstanding), 900); // Banco 800 + Loja 100 + Visa 0
    assert.equal(money(o.borrowed), 1820); // 1000 + 100 + purchases of 720
    assert.equal(money(o.paid), 920);
    assert.equal(money(o.paid_this_month), 920);
    assert.equal(money(o.planned_this_month), 300);
    assert.deepEqual([o.next_due.name, money(o.next_due.amount), o.next_due.date], ['Loja', 50, '2026-11-20']);
    assert.equal(money(o.available_credit), 500);
    assert.equal(o.cards, 1);
    assert.equal(o.open_count, 2);
  });

  test('o plafond não se aplica a outras contas e não aceita valores negativos', async () => {
    await asUser(db, USER_A, TODAY, async () => {
      await assert.rejects(db.query(`update public.accounts set is_credit_card = true where name = 'Conta'`), /accounts_credit_limit_check/);
      await assert.rejects(db.query(`update public.accounts set credit_limit = -1 where name = 'Visa'`), /accounts_credit_limit_check/);
    });
  });

  test('RLS: outro utilizador não vê o resumo', async () => {
    const o = await asUser(db, USER_B, TODAY, async () => (await one(db, `select public.debt_overview(null, '${USER_A}') r`)).r);
    assert.equal(money(o.outstanding), 0);
    assert.equal(o.next_due, null);
  });
});

test('sem dívidas nem cartões, o resumo vem a zero', async () => {
  const db = await createDb();
  const o = await asUser(db, USER_B, TODAY, async () => (await one(db, 'select public.debt_overview() r')).r);
  assert.equal(money(o.outstanding), 0);
  assert.equal(o.progress, null);
  assert.equal(o.available_credit, null);
  void all;
});
