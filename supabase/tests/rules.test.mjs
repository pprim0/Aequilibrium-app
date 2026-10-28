// Business rules from the Excel (registo_gastos_v2) checked against the SQL functions.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, asUser, one, all, money, addTx, USER_A, USER_B } from './helpers.mjs';

const TODAY = '2026-10-28';

// Synthetic setup used by the reference scenario (no personal data).
const referenceSetup = {
  settings: { financial_month_start_day: 25, default_account: 'Conta à ordem', tracking_start_date: '2026-10-25' },
  accounts: [
    { name: 'Conta à ordem', type: 'checking', opening_balance: 500, opening_date: '2026-10-25' },
    { name: 'Dinheiro', type: 'cash', opening_balance: 20, opening_date: '2026-10-25' },
    { name: 'Poupança', type: 'savings', opening_balance: 0, opening_date: '2026-10-25' },
    { name: 'Investimentos', type: 'investment', opening_balance: 0, opening_date: '2026-10-25' },
    { name: 'Cartão de crédito', type: 'credit', opening_balance: -150, opening_date: '2026-10-25', debt_strategy: 'plan' },
    { name: 'Mãe', type: 'credit', opening_balance: -2000, opening_date: '2026-10-25', debt_strategy: 'plan' },
  ],
  allocation_rules: [
    { name: 'Necessidades', pct: 0.5, source: 'expense_groups' },
    { name: 'Lazer', pct: 0.2, source: 'expense_groups' },
    { name: 'Poupança', pct: 0.2, source: 'saving' },
    { name: 'Investimento', pct: 0.1, source: 'investment' },
  ],
  groups: [
    { name: 'Rendimentos' },
    { name: 'Fixas', monthly_budget: 500, allocation_rule: 'Necessidades' },
    { name: 'Outras cenas', monthly_budget: 150, allocation_rule: 'Necessidades' },
    { name: 'Dinheiro livre', monthly_budget: 250, allocation_rule: 'Lazer' },
  ],
  categories: [
    { name: 'Salário', kind: 'income', group: 'Rendimentos', nature: 'fixed', tag: 'salary' },
    { name: 'Subsídio de almoço', kind: 'income', group: 'Rendimentos', nature: 'fixed', tag: 'meal_allowance' },
    { name: 'Renda', kind: 'expense', group: 'Fixas', nature: 'fixed', own_limit: 300 },
    { name: 'Supermercado', kind: 'expense', group: 'Fixas', own_limit: 200 },
    { name: 'Casa / Higiene', kind: 'expense', group: 'Outras cenas' },
    { name: 'Refeições fora', kind: 'expense', group: 'Dinheiro livre', own_limit: 50 },
    { name: 'Dívida: Cartão', kind: 'debt_payment', default_to_account: 'Cartão de crédito' },
    { name: 'Dívida: Mãe', kind: 'debt_payment', default_to_account: 'Mãe' },
    { name: 'Fundo de emergência', kind: 'saving', default_to_account: 'Poupança' },
    { name: 'Transferência entre contas', kind: 'transfer' },
  ],
  recurring_payments: [{ description: 'Renda', category: 'Renda', amount: 300, day_of_month: 1 }],
  goals: [{ name: 'Fundo de emergência', target_type: 'fixed', target_amount: 2600, category: 'Fundo de emergência' }],
  monthly_plans: [
    { month_key: 202611, kind: 'debts', amount: 520 },
    { month_key: 202611, kind: 'goal', goal: 'Fundo de emergência', amount: 100 },
  ],
};

async function setup(db, user, data, today = TODAY) {
  return asUser(db, user, today, () => one(db, 'select public.apply_setup($1::jsonb) as r', [JSON.stringify(data)]));
}

describe('mês financeiro', () => {
  let db;
  before(async () => { db = await createDb(); });

  test('dia >= início pertence ao mês seguinte; dia 1 = meses normais', async () => {
    const r = await one(db, `select
      public.fin_month_key('2026-10-30', 25) as a, public.fin_month_key('2026-10-24', 25) as b,
      public.fin_month_key('2026-12-25', 25) as c, public.fin_month_key('2026-10-30', 1) as d,
      public.fin_month_start(202611, 25)::text as s1, public.fin_month_end(202611, 25)::text as e1,
      public.fin_month_start(202701, 25)::text as s2, public.fin_month_end(202701, 25)::text as e2,
      public.fin_month_start(202602, 1)::text as s3, public.fin_month_end(202602, 1)::text as e3,
      public.month_key_shift(202612, 1) as n1, public.month_key_shift(202701, -1) as n2`);
    assert.deepEqual(
      [r.a, r.b, r.c, r.d, r.s1, r.e1, r.s2, r.e2, r.s3, r.e3, r.n1, r.n2],
      [202611, 202610, 202701, 202610, '2026-10-25', '2026-11-24', '2026-12-25', '2027-01-24',
       '2026-02-01', '2026-02-28', 202701, 202612]);
  });
});

describe('cenário de referência (Excel): 25/10–24/11/2026, hoje 28/10', () => {
  let db;
  before(async () => {
    db = await createDb();
    await setup(db, USER_A, referenceSetup);
    await asUser(db, USER_A, TODAY, async () => {
      const split = '11111111-1111-1111-1111-111111111111';
      await addTx(db, { date: '2026-10-26', amount: 1038, category: 'Salário', description: 'Ordenado' });
      await addTx(db, { date: '2026-10-26', amount: 200, category: 'Subsídio de almoço' });
      await addTx(db, { date: TODAY, amount: 150, category: 'Dívida: Cartão' });
      await addTx(db, { date: TODAY, amount: 320, category: 'Dívida: Mãe' });
      await addTx(db, { date: TODAY, amount: 50, category: 'Fundo de emergência' });
      await addTx(db, { date: TODAY, amount: 100, category: 'Transferência entre contas', to: 'Dinheiro' });
      await addTx(db, { date: TODAY, amount: 30, category: 'Supermercado', split, description: 'Continente' });
      await addTx(db, { date: TODAY, amount: 10, category: 'Casa / Higiene', split, description: 'Continente' });
      await addTx(db, { date: TODAY, amount: 1.2, category: 'Refeições fora', description: 'Café' });
      await addTx(db, { date: TODAY, amount: 1.2, category: 'Refeições fora', description: 'Café' });
      await addTx(db, { date: TODAY, amount: 70, category: 'Refeições fora', description: 'Jantar' });
    });
  });

  test('livre para gastar = 205,60 € com todas as parcelas do Excel', async () => {
    const f = await asUser(db, USER_A, TODAY, async () => (await one(db, 'select public.free_to_spend() as f')).f);
    assert.equal(f.month_key, 202611);
    assert.equal(money(f.income), 1238);
    assert.equal(money(f.expenses_paid), 112.4);
    assert.equal(money(f.debt_payments), 470);
    assert.equal(money(f.savings), 50);
    assert.equal(money(f.pending_recurring), 300);
    assert.equal(money(f.reserved), 100);
    assert.equal(money(f.free), 205.6);
    assert.equal(f.state, 'ok');
  });

  test('saldo nas contas 1175,60 €, gasto hoje 112,40 € e dívida do cartão a 0', async () => {
    await asUser(db, USER_A, TODAY, async () => {
      assert.equal(money((await one(db, 'select public.money_in_accounts() as v')).v), 1175.6);
      assert.equal(money((await one(db, 'select public.spent_on() as v')).v), 112.4);
      const balances = Object.fromEntries(
        (await all(db, 'select name, balance, debt_outstanding from public.account_balances()'))
          .map((r) => [r.name, r]));
      assert.equal(money(balances['Conta à ordem'].balance), 1005.6);
      assert.equal(money(balances['Dinheiro'].balance), 120);
      assert.equal(money(balances['Poupança'].balance), 50);
      assert.equal(money(balances['Cartão de crédito'].debt_outstanding), 0);
      assert.equal(money(balances['Mãe'].debt_outstanding), 1680);
    });
  });

  test('duplicado assinalado só nos cafés; compra dividida não conta como duplicado', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, `
      select t.description, t.amount from public.transaction_alerts a
      join public.transactions t on t.id = a.transaction_id where a.alert = 'possible_duplicate'`));
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.description === 'Café' && money(r.amount) === 1.2));
  });

  test('transferência não é rendimento nem despesa; poupança não conta como despesa', async () => {
    const m = await asUser(db, USER_A, TODAY, () => one(db, 'select * from public.month_totals()'));
    assert.equal(money(m.income), 1238);
    assert.equal(money(m.expenses), 112.4);
    assert.equal(money(m.savings), 50);
  });

  test('envelopes: cores de alerta por grupo e por categoria', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, 'select scope, name, spent, pct, level from public.budget_usage()'));
    const by = (scope, name) => rows.find((r) => r.scope === scope && r.name === name);
    assert.equal(by('category', 'Refeições fora').level, 'red'); // 72,40 / 50
    assert.equal(money(by('group', 'Dinheiro livre').spent), 72.4);
    assert.equal(by('group', 'Dinheiro livre').level, 'ok');
    assert.equal(by('group', 'Fixas').level, 'ok');
    assert.equal(by('group', 'Rendimentos').level, 'none'); // no budget configured
    assert.equal(by('category', 'Casa / Higiene').level, 'none');
  });

  test('regra 50/20/20/10: recomendado vs real e fase de dívidas', async () => {
    const rows = await asUser(db, USER_A, TODAY, () => all(db, 'select * from public.allocation_comparison()'));
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    assert.equal(money(by['Necessidades'].recommended), 619);
    assert.equal(money(by['Necessidades'].actual), 40);
    assert.equal(money(by['Lazer'].actual), 72.4);
    assert.equal(money(by['Poupança'].actual), 50);
    assert.equal(rows[0].debt_phase, true);
  });

  test('sem rendimento no mês: estado "no_income" em vez de um valor enganador', async () => {
    const f = await asUser(db, USER_A, '2026-11-26', async () =>
      (await one(db, 'select public.free_to_spend() as f')).f);
    assert.equal(f.month_key, 202612);
    assert.equal(f.state, 'no_income');
  });
});

describe('pagamentos fixos', () => {
  let db;
  before(async () => {
    db = await createDb();
    await setup(db, USER_A, {
      settings: { financial_month_start_day: 25, default_account: 'Conta à ordem' },
      accounts: [{ name: 'Conta à ordem', type: 'checking', opening_balance: 1000, opening_date: '2026-09-01' }],
      categories: [{ name: 'Renda', kind: 'expense', nature: 'fixed' }, { name: 'Subscrições', kind: 'expense', nature: 'fixed' }],
      recurring_payments: [
        { description: 'Renda', category: 'Renda', amount: 300, day_of_month: 1, start_month: 202610 },
        { description: 'Netflix', category: 'Subscrições', amount: 8.99, day_of_month: 15, interval_months: 2, anchor_month: 202610 },
        { description: 'Ginásio', category: 'Subscrições', amount: 20, day_of_month: 5, start_month: 202612, end_month: 202702 },
        { description: 'Spotify', category: 'Subscrições', amount: 2.83 },
      ],
    });
  });

  const status = (month, today) => asUser(db, USER_A, today, async () =>
    Object.fromEntries((await all(db, 'select description, status, due_date::text as due from public.recurring_status($1, $2::date)', [month, today]))
      .map((r) => [r.description, r])));

  test('Netflix de 2 em 2 meses alterna a partir do mês âncora', async () => {
    assert.equal((await status(202610, '2026-10-01')).Netflix.status, 'pending');
    assert.equal((await status(202611, '2026-10-28')).Netflix.status, 'not_this_month');
    assert.equal((await status(202612, '2026-11-26')).Netflix.status, 'pending');
  });

  test('ainda não começou / terminado / sem dia definido / em atraso', async () => {
    const nov = await status(202611, '2026-11-20');
    assert.equal(nov['Ginásio'].status, 'not_started');
    assert.equal(nov.Spotify.status, 'pending');
    assert.equal(nov.Spotify.due, null);
    assert.equal(nov.Renda.due, '2026-11-01');
    assert.equal(nov.Renda.status, 'overdue');
    assert.equal((await status(202703, '2027-02-26'))['Ginásio'].status, 'ended');
  });

  test('fixo pago a 30/10 conta em novembro; previstos nunca contam como despesa', async () => {
    await asUser(db, USER_A, '2026-10-30', () =>
      addTx(db, { date: '2026-10-30', amount: 300, category: 'Renda', recurring: 'Renda' }));
    assert.equal((await status(202611, '2026-10-30')).Renda.status, 'paid');
    // The 30/10 payment does not settle October (due 01/10, still unpaid there).
    assert.equal((await status(202610, '2026-10-30')).Renda.status, 'overdue');
    const m = await asUser(db, USER_A, '2026-10-30', () => one(db, 'select * from public.month_totals(202611)'));
    assert.equal(money(m.expenses), 300);
    const oct = await asUser(db, USER_A, '2026-10-20', () => one(db, 'select * from public.month_totals(202610)'));
    assert.equal(money(oct.expenses), 0);
  });
});

describe('crédito, prestações e investimentos', () => {
  let db;
  before(async () => {
    db = await createDb();
    await setup(db, USER_A, {
      settings: { financial_month_start_day: 25, default_account: 'Conta à ordem' },
      accounts: [
        { name: 'Conta à ordem', type: 'checking', opening_balance: 1000, opening_date: '2026-10-25' },
        { name: 'Investimentos', type: 'investment', opening_balance: 0, opening_date: '2026-10-25' },
        { name: 'Klarna', type: 'credit', opening_balance: -80.94, opening_date: '2026-10-25', debt_strategy: 'installments' },
      ],
      groups: [{ name: 'Dinheiro livre', monthly_budget: 250 }],
      categories: [
        { name: 'Outros', kind: 'expense', group: 'Dinheiro livre' },
        { name: 'Dívida: Klarna', kind: 'debt_payment', default_to_account: 'Klarna' },
        { name: 'Investimento: S&P 500', kind: 'investment', default_to_account: 'Investimentos' },
      ],
      payment_methods: [{ name: 'Klarna', account: 'Klarna' }, { name: 'Cartão de débito', account: 'Conta à ordem' }],
      installments: [
        { account: 'Klarna', amount: 40.97, due_date: '2026-11-02' },
        { account: 'Klarna', amount: 39.97, due_date: '2026-11-30' },
      ],
    });
  });

  const installments = (today) => asUser(db, USER_A, today, async () =>
    (await all(db, 'select due_date::text as due, status from public.installment_status($1::date) order by due_date', [today])));

  test('prestação em atraso sem pagamento; paga antecipadamente conta', async () => {
    assert.deepEqual((await installments('2026-11-03')).map((r) => r.status), ['overdue', 'later']);
    await asUser(db, USER_A, '2026-10-28', () =>
      addTx(db, { date: '2026-10-28', amount: 40.97, category: 'Dívida: Klarna' }));
    assert.deepEqual((await installments('2026-10-28')).map((r) => r.status), ['paid', 'later']);
    assert.deepEqual((await installments('2026-11-26')).map((r) => r.status), ['paid', 'due_this_month']);
  });

  test('compra Klarna conta no orçamento mas não mexe na conta à ordem', async () => {
    await asUser(db, USER_A, '2026-10-29', async () => {
      await addTx(db, { date: '2026-10-29', amount: 50, category: 'Outros', method: 'Klarna', description: 'Rato' });
      const m = await one(db, 'select * from public.month_totals()');
      assert.equal(money(m.expenses), 50);
      assert.equal(money(m.credit_expenses), 50);
      const g = await one(db, `select spent from public.budget_usage() where scope = 'group' and name = 'Dinheiro livre'`);
      assert.equal(money(g.spent), 50);
      const b = Object.fromEntries((await all(db, 'select name, balance, debt_outstanding from public.account_balances()')).map((r) => [r.name, r]));
      assert.equal(money(b['Conta à ordem'].balance), 959.03);
      assert.equal(money(b.Klarna.debt_outstanding), 89.97); // 80,94 - 40,97 + 50
      const f = (await one(db, 'select public.free_to_spend() as f')).f;
      assert.equal(money(f.expenses_paid), 0);
      assert.equal(money(f.credit_expenses), 50);
    });
  });

  test('investimentos: 100 depositados, 30 vendidos, valor atual 80 → ganho +10 €', async () => {
    await asUser(db, USER_A, '2026-10-30', async () => {
      await addTx(db, { date: '2026-10-26', amount: 100, category: 'Investimento: S&P 500' });
      await addTx(db, { date: '2026-10-30', amount: -30, category: 'Investimento: S&P 500' });
      await db.query(`insert into public.investment_valuations (user_id, category_id, value, valued_on)
                      select auth.uid(), id, 80, '2026-10-30' from public.categories where name = 'Investimento: S&P 500'`);
      const i = await one(db, 'select * from public.investment_summary()');
      assert.deepEqual([money(i.deposited), money(i.sold), money(i.invested), money(i.current_value), money(i.gain)],
                       [100, 30, 70, 80, 10]);
      const b = await one(db, `select balance from public.account_balances() where name = 'Investimentos'`);
      assert.equal(money(b.balance), 70);
    });
  });
});

describe('dívidas, objetivos e estimativas', () => {
  let db;
  before(async () => {
    db = await createDb();
    await setup(db, USER_A, {
      settings: { financial_month_start_day: 25, default_account: 'Conta à ordem', tracking_start_date: '2026-10-25' },
      accounts: [
        { name: 'Conta à ordem', type: 'checking', opening_balance: 5000, opening_date: '2026-10-25' },
        { name: 'Poupança', type: 'savings', opening_balance: 0, opening_date: '2026-10-25' },
        { name: 'Mãe', type: 'credit', opening_balance: -1000, opening_date: '2026-10-25', debt_strategy: 'plan' },
      ],
      categories: [
        { name: 'Salário', kind: 'income', tag: 'salary' },
        { name: 'Subsídio de almoço', kind: 'income', tag: 'meal_allowance' },
        { name: 'Supermercado', kind: 'expense' },
        { name: 'Renda', kind: 'expense', nature: 'fixed' },
        { name: 'Dívida: Mãe', kind: 'debt_payment', default_to_account: 'Mãe' },
        { name: 'Fundo de emergência', kind: 'saving', default_to_account: 'Poupança' },
      ],
      income_sources: [
        { name: 'Ordenado', tag: 'salary', category: 'Salário', amount: 1038, valid_from: '2026-10-01', valid_to: '2026-12-24' },
        { name: 'Ordenado', tag: 'salary', category: 'Salário', amount: 1088, valid_from: '2026-12-25' },
        { name: 'Subsídio', tag: 'meal_allowance', category: 'Subsídio de almoço', amount: 200, valid_from: '2026-10-01' },
      ],
      goals: [{
        name: 'Fundo de emergência', target_type: 'formula', category: 'Fundo de emergência',
        target_formula: { type: 'income_multiple', factor: 2, includes: ['salary', 'meal_allowance'], round_up: 100, at: 'latest' },
      }],
    });
  });

  test('meta do fundo vem dos rendimentos definidos pelo utilizador (último valor ou o atual)', async () => {
    await asUser(db, USER_A, TODAY, async () => {
      assert.equal(money((await one(db, `select public.goal_target(id) as t from public.goals`)).t), 2600);
      await db.query(`update public.goals set target_formula = target_formula || '{"at":"current"}'`);
      assert.equal(money((await one(db, `select public.goal_target(id) as t from public.goals`)).t), 2500);
      await db.query(`update public.goals set target_formula = target_formula || '{"at":"latest"}'`);
    });
  });

  test('marcos do fundo guardam a data em que foram atingidos', async () => {
    await asUser(db, USER_A, '2026-11-30', async () => {
      await addTx(db, { date: '2026-10-28', amount: 400, category: 'Fundo de emergência' });
      await addTx(db, { date: '2026-11-28', amount: 400, category: 'Fundo de emergência' });
      const g = await one(db, 'select * from public.goal_progress()');
      assert.equal(money(g.saved), 800);
      const m = Object.fromEntries(g.milestones.map((x) => [x.pct, x.reached_on]));
      assert.equal(m[0.25], '2026-11-28'); // 650 needed: reached only with the second deposit
      assert.equal(m[0.5], null);
    });
  });

  test('conclusão estimada da dívida só com pagamentos em 2 ou mais meses', async () => {
    await asUser(db, USER_A, '2026-10-30', async () => {
      await addTx(db, { date: '2026-10-28', amount: 100, category: 'Dívida: Mãe' });
      const d1 = await one(db, 'select * from public.debt_summary()');
      assert.equal(d1.estimated_end, null);
      assert.equal(d1.status, 'in_progress');
    });
    await asUser(db, USER_A, '2026-11-30', async () => {
      await addTx(db, { date: '2026-11-28', amount: 100, category: 'Dívida: Mãe' });
      const d2 = await one(db, 'select *, estimated_end::text as est from public.debt_summary()');
      assert.equal(d2.months_with_payment, 2);
      assert.equal(money(d2.monthly_average), 100);
      assert.equal(d2.est, '2027-07-30'); // 800 € left at 100 €/month
    });
  });

  test('livre previsto enquanto falta o ordenado esperado (modo "projected")', async () => {
    await asUser(db, USER_A, '2026-11-26', async () => {
      await addTx(db, { date: '2026-11-26', amount: 200, category: 'Subsídio de almoço' });
      const f = (await one(db, 'select public.free_to_spend() as f')).f;
      assert.equal(f.month_key, 202612);
      assert.equal(f.state, 'projected');
      assert.equal(money(f.missing_expected_income), 1038);
      assert.equal(money(f.free_projected), money(money(f.free) + 1038));
      await db.query(`update public.user_settings set free_to_spend_mode = 'actual'`);
      assert.equal((await one(db, 'select public.free_to_spend() as f')).f.state, 'ok');
      await db.query(`update public.user_settings set free_to_spend_mode = 'projected'`);
    });
  });

  test('estimativa de fim de mês: só variáveis e com pelo menos 7 dias de dados', async () => {
    await asUser(db, USER_A, '2026-12-27', async () => {
      await addTx(db, { date: '2026-12-26', amount: 31, category: 'Supermercado' });
      await addTx(db, { date: '2026-12-26', amount: 300, category: 'Renda' });
      assert.equal((await one(db, 'select public.month_projection() as p')).p.available, false);
    });
    await asUser(db, USER_A, '2026-12-31', async () => {
      const p = (await one(db, 'select public.month_projection() as p')).p;
      assert.equal(p.available, true);
      assert.equal(p.is_estimate, true);
      assert.equal(money(p.variable_spent), 31);
      assert.equal(p.days, 7);
      assert.equal(p.total_days, 31);
      assert.equal(money(p.variable_projected), 137.29); // 31 € in 7 days over a 31-day month; rent (fixed) excluded
    });
  });
});

describe('segurança e integridade', () => {
  let db;
  before(async () => {
    db = await createDb();
    await setup(db, USER_A, referenceSetup);
    await setup(db, USER_B, { accounts: [{ name: 'Conta B', type: 'checking', opening_date: TODAY }], settings: { default_account: 'Conta B' } });
    await asUser(db, USER_A, TODAY, () => addTx(db, { date: TODAY, amount: 10, category: 'Supermercado' }));
  });

  test('RLS: um utilizador não vê dados de outro', async () => {
    await asUser(db, USER_B, TODAY, async () => {
      assert.equal((await all(db, 'select * from public.transactions')).length, 0);
      assert.equal((await all(db, 'select * from public.categories')).length, 0);
      assert.equal((await all(db, `select * from public.account_balances(null, '${USER_A}')`)).length, 0);
      const f = (await one(db, `select public.free_to_spend(null, null, '${USER_A}') as f`)).f;
      assert.equal(money(f.expenses_paid), 0);
    });
  });

  test('não é possível apontar um movimento para a conta de outro utilizador', async () => {
    const accountA = await one(db, `select id from public.accounts where user_id = '${USER_A}' limit 1`);
    await asUser(db, USER_B, TODAY, async () => {
      await assert.rejects(db.query(
        `insert into public.transactions (user_id, date, amount, type, account_id) values (auth.uid(), $1, 5, 'expense', $2)`,
        [TODAY, accountA.id]));
    });
  });

  test('XP conta uma vez por período (garantido pela base de dados) e o cliente não escreve XP', async () => {
    const rule = await one(db, `insert into public.xp_rules (user_id, key, name, xp, period)
                                values ('${USER_A}', 'test_daily', 'Teste', 5, 'day') returning id`);
    const ins = (period) => db.query(
      `insert into public.xp_ledger (user_id, rule_id, period_key, xp, earned_on) values ($1, $2, $3, 5, $4)`,
      [USER_A, rule.id, period, TODAY]);
    await ins('2026-10-28');
    await assert.rejects(ins('2026-10-28'), /xp_ledger_rule_once_per_period/);
    await ins('2026-10-29');
    await asUser(db, USER_A, TODAY, async () => {
      await assert.rejects(ins('2026-10-30'), /permission denied/);
    });
  });

  test('revisão diária só aceita hoje ou ontem', async () => {
    await asUser(db, USER_A, TODAY, async () => {
      await db.query(`insert into public.daily_checkins (user_id, day, reviewed) values (auth.uid(), '2026-10-27', true)`);
      await db.query(`insert into public.daily_checkins (user_id, day, reviewed) values (auth.uid(), '2026-10-28', true)`);
      await assert.rejects(
        db.query(`insert into public.daily_checkins (user_id, day, reviewed) values (auth.uid(), '2026-10-26', true)`),
        /hoje ou de ontem/);
    });
  });

  test('não se apaga uma conta com movimentos; apagar o utilizador apaga tudo dele', async () => {
    await asUser(db, USER_A, TODAY, async () => {
      await assert.rejects(db.query(`delete from public.accounts where name = 'Conta à ordem'`), /foreign key/);
    });
    const D = '00000000-0000-0000-0000-00000000000d';
    await db.exec(`insert into auth.users (id, email) values ('${D}', 'd@test.local')`);
    await setup(db, D, referenceSetup);
    await asUser(db, D, TODAY, () => addTx(db, { date: TODAY, amount: 10, category: 'Supermercado' }));
    await db.exec(`delete from auth.users where id = '${D}'`);
    const left = await one(db, `select
      (select count(*) from public.transactions where user_id = '${D}') +
      (select count(*) from public.accounts where user_id = '${D}') +
      (select count(*) from public.categories where user_id = '${D}') +
      (select count(*) from public.user_settings where user_id = '${D}') as n`);
    assert.equal(Number(left.n), 0);
  });

  test('presets: genérico aplica-se a conta nova; não se aplica duas vezes', async () => {
    const C = '00000000-0000-0000-0000-00000000000c';
    await db.exec(`insert into auth.users (id, email) values ('${C}', 'c@test.local')`);
    await asUser(db, C, TODAY, async () => {
      const r = (await one(db, `select public.apply_preset('generic') as r`)).r;
      assert.ok(r.accounts >= 3 && r.categories > 10);
      const s = await one(db, 'select financial_month_start_day, preset_key from public.user_settings');
      assert.deepEqual([s.financial_month_start_day, s.preset_key], [1, 'generic']);
      assert.equal((await one(db, `select count(*)::int as n from public.levels`)).n, 5);
      assert.equal((await one(db, `select count(*)::int as n from public.habits where system_key = 'daily_financial_review'`)).n, 1);
      await assert.rejects(db.query(`select public.apply_preset('generic')`), /já tem configuração/);
      await assert.rejects(db.query(`select public.apply_preset('gamification_default')`), /Preset desconhecido/);
    });
  });
});
