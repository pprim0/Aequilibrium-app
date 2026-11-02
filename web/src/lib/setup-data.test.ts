import { describe, expect, test } from "vitest";
import { finalizeSetup, startEditing, type SetupData } from "./setup-data";

const TODAY = "2026-11-03";

const preset = (): SetupData => ({
  settings: { default_account: "Banco", financial_month_start_day: 25 },
  accounts: [
    { name: "Banco", type: "checking", opening_balance: 10, opening_date: "2026-10-01" },
    { name: "Poupança", type: "savings" },
    { name: "Loja", type: "credit", opening_balance: -100, debt_strategy: "installments" },
    { name: "Amigo", type: "credit", opening_balance: -50, debt_strategy: "plan" },
  ],
  categories: [
    { name: "Comida", kind: "expense" },
    { name: "Fundo", kind: "saving", default_to_account: "Poupança" },
    { name: "Dívida: Loja", kind: "debt_payment", default_to_account: "Loja", group: "Dívidas" },
    { name: "Dívida: Amigo", kind: "debt_payment", default_to_account: "Amigo", group: "Dívidas" },
  ],
  groups: [{ name: "Dívidas" }],
  payment_methods: [
    { name: "Débito", account: "Banco" },
    { name: "Loja", account: "Loja" },
  ],
  installments: [{ account: "Loja", amount: 10, due_date: "2026-12-01" }],
  shortcuts: [
    { name: "Pagar Loja", category: "Dívida: Loja" },
    { name: "Compra", category: "Comida", payment_method: "Loja" },
    { name: "Café", category: "Comida", account: "Banco" },
  ],
  goals: [{ name: "Fundo", target_type: "fixed", target_amount: 100, category: "Fundo", account: "Poupança" }],
  monthly_plans: [
    { month_key: 202612, kind: "debts", amount: 50 },
    { month_key: 202612, kind: "goal", goal: "Fundo", amount: 10 },
  ],
  achievements: [
    { key: "debt_first_100", xp: 50, condition: { type: "debt_paid_total", min: 100 } },
    { key: "debt_loja", xp: 50, condition: { type: "debt_cleared", account: "Loja" } },
    { key: "debt_amigo", xp: 50, condition: { type: "debt_cleared", account: "Amigo" } },
  ],
});

const finalize = (edit: (d: SetupData) => void) => {
  const d = startEditing(preset());
  edit(d);
  return finalizeSetup(d, TODAY);
};

describe("finalizeSetup", () => {
  test("sem alterações: mantém tudo e tira o campo de edição", () => {
    const r = finalize(() => {});
    expect(r.accounts).toHaveLength(4);
    expect(r.accounts?.every((a) => !("_original" in a))).toBe(true);
    expect(r.categories).toHaveLength(4);
    expect(r.settings?.default_account).toBe("Banco");
  });

  test("renomear uma conta atualiza todas as referências", () => {
    const r = finalize((d) => {
      d.accounts![2].name = "Loja Online";
      d.accounts![0].name = "Conta";
    });
    expect(r.settings?.default_account).toBe("Conta");
    expect(r.payment_methods).toContainEqual({ name: "Loja", account: "Loja Online" });
    expect(r.installments?.[0].account).toBe("Loja Online");
    expect(r.categories?.find((c) => c.name === "Dívida: Loja")?.default_to_account).toBe("Loja Online");
    expect(r.achievements?.find((a) => a.key === "debt_loja")?.condition?.account).toBe("Loja Online");
    expect(r.shortcuts?.find((s) => s.name === "Café")?.account).toBe("Conta");
    // No second payment category or achievement for the same debt.
    expect(r.categories?.filter((c) => c.default_to_account === "Loja Online")).toHaveLength(1);
    expect(r.achievements?.filter((a) => a.condition?.account === "Loja Online")).toHaveLength(1);
  });

  test("remover uma dívida leva o que dependia dela", () => {
    const r = finalize((d) => {
      d.accounts = d.accounts!.filter((a) => a.name !== "Loja");
    });
    expect(r.categories?.some((c) => c.name === "Dívida: Loja")).toBe(false);
    expect(r.payment_methods?.some((m) => m.name === "Loja")).toBe(false);
    expect(r.installments).toEqual([]);
    expect(r.shortcuts?.some((s) => s.name === "Pagar Loja")).toBe(false);
    expect(r.shortcuts?.find((s) => s.name === "Compra")?.payment_method).toBeUndefined();
    expect(r.achievements?.some((a) => a.key === "debt_loja")).toBe(false);
  });

  test("sem dívidas: o plano de dívidas desaparece, o de objetivos fica", () => {
    const r = finalize((d) => {
      d.accounts = d.accounts!.filter((a) => a.type !== "credit");
    });
    expect(r.monthly_plans).toEqual([{ month_key: 202612, kind: "goal", goal: "Fundo", amount: 10 }]);
  });

  test("remover um objetivo tira o seu plano", () => {
    const r = finalize((d) => {
      d.goals = [];
    });
    expect(r.monthly_plans?.some((p) => p.kind === "goal")).toBe(false);
  });

  test("dívida nova ganha categoria de pagamento e conquista", () => {
    const r = finalize((d) => {
      d.accounts!.push({ name: "Irmão João", type: "credit", opening_balance: 30 });
    });
    const debt = r.accounts?.find((a) => a.name === "Irmão João");
    expect(debt?.opening_balance).toBe(-30);
    expect(debt?.debt_strategy).toBe("plan");
    expect(debt?.opening_date).toBe(TODAY);
    expect(r.categories?.find((c) => c.name === "Dívida: Irmão João")).toMatchObject({ kind: "debt_payment", default_to_account: "Irmão João", group: "Dívidas" });
    expect(r.achievements?.find((a) => a.key === "debt_irmao_joao")).toMatchObject({ xp: 50, condition: { type: "debt_cleared", account: "Irmão João" } });
  });

  test("remover a conta principal escolhe outra", () => {
    const r = finalize((d) => {
      d.accounts = [{ name: "Carteira", type: "cash" }];
    });
    expect(r.settings?.default_account).toBe("Carteira");
  });
});

test("cartão de crédito novo aparece como método de pagamento", () => {
  const d = startEditing(preset());
  d.accounts!.push({ name: "Visa", type: "credit", is_credit_card: true, credit_limit: 500, opening_balance: 0 });
  const r = finalizeSetup(d, TODAY);
  expect(r.payment_methods).toContainEqual({ name: "Visa", account: "Visa" });
  expect(r.accounts?.find((a) => a.name === "Visa")?.credit_limit).toBe(500);
});
