import { describe, expect, test } from "vitest";
import { ENTITIES, findEntity, normalizeEntity, normalizeSettings, type SettingsInput } from "./settings-entities";

const entity = (key: string) => findEntity(key)!;

describe("normalizeEntity", () => {
  test("ignora campos que não estão na lista (não se escreve user_id nem outros)", () => {
    const r = normalizeEntity(entity("metodos"), { name: "MB Way", account_id: "", user_id: "x", is_admin: true });
    expect(r).toEqual({ ok: true, values: { name: "MB Way", account_id: null } });
  });

  test("converte valores pt-PT, percentagens e meses", () => {
    const money = normalizeEntity(entity("grupos"), { name: "Fixas", monthly_budget: "1 234,50" });
    expect(money.ok && money.values.monthly_budget).toBe(1234.5);
    const pct = normalizeEntity(entity("regra"), { name: "Lazer", pct: "20", source: "expense_groups" });
    expect(pct.ok && pct.values.pct).toBe(0.2);
    const plan = normalizeEntity(entity("plano"), { month_key: "2026-12", kind: "debts", amount: "960" });
    expect(plan.ok && plan.values).toMatchObject({ month_key: 202612, amount: 960, goal_id: null });
  });

  test("recusa o que é inválido, indicando o campo", () => {
    expect(normalizeEntity(entity("metodos"), { name: " " })).toMatchObject({ ok: false, field: "name" });
    expect(normalizeEntity(entity("grupos"), { name: "A", monthly_budget: "abc" })).toMatchObject({ ok: false, field: "monthly_budget" });
    expect(normalizeEntity(entity("grupos"), { name: "A", monthly_budget: "-5" })).toMatchObject({ ok: false, field: "monthly_budget" });
    expect(normalizeEntity(entity("regra"), { name: "A", pct: "120", source: "saving" })).toMatchObject({ ok: false, field: "pct" });
    expect(normalizeEntity(entity("categorias"), { name: "A", kind: "hack", nature: "fixed" })).toMatchObject({ ok: false, field: "kind" });
    expect(normalizeEntity(entity("metodos"), { name: "A", account_id: "1; drop table" })).toMatchObject({ ok: false, field: "account_id" });
    expect(normalizeEntity(entity("niveis"), { level: "1.5", name: "A", min_xp: "0" })).toMatchObject({ ok: false, field: "level" });
  });

  test("regras entre campos: plano de objetivo pede objetivo; datas por ordem", () => {
    expect(normalizeEntity(entity("plano"), { month_key: "2026-12", kind: "goal", amount: "10" })).toMatchObject({ ok: false, field: "goal_id" });
    expect(
      normalizeEntity(entity("rendimentos"), { name: "A", tag: "salary", amount: "1", valid_from: "2026-12-01", valid_to: "2026-01-01" }),
    ).toMatchObject({ ok: false, field: "valid_to" });
  });

  test("um campo escondido não guarda um valor antigo", () => {
    const uuid = "00000000-0000-0000-0000-000000000001";
    const r = normalizeEntity(entity("plano"), { month_key: "2026-12", kind: "goal", amount: "10", goal_id: uuid, account_id: uuid });
    expect(r.ok && r.values).toMatchObject({ goal_id: uuid, account_id: null });
  });

  test("regras de XP e conquistas não se criam nem apagam aqui, e as condições não são editáveis", () => {
    for (const key of ["xp", "missoes", "conquistas"]) {
      expect(entity(key).canCreate).toBe(false);
      expect(entity(key).canDelete).toBe(false);
      expect(entity(key).fields.some((f) => f.key === "condition")).toBe(false);
    }
    expect(ENTITIES.some((e) => e.table === "xp_ledger" || e.table === "achievement_unlocks")).toBe(false);
  });
});

describe("normalizeSettings", () => {
  const base: SettingsInput = {
    financial_month_start_day: "25",
    default_account_id: "",
    alert_1: "70",
    alert_2: "90",
    alert_3: "100",
    tracking_start_date: "2026-10-01",
    rest_days_per_week: "1",
    min_review_days_week: "5",
    min_review_days_month: "15",
    min_days_for_projection: "7",
    free_to_spend_mode: "actual",
    show_habits: false,
  };

  test("valores válidos", () => {
    const r = normalizeSettings(base);
    expect(r.ok && r.values).toMatchObject({ financial_month_start_day: 25, alert_thresholds: [0.7, 0.9, 1], default_account_id: null });
  });

  test("dia do mês, alertas por ordem e modo", () => {
    expect(normalizeSettings({ ...base, financial_month_start_day: "29" })).toMatchObject({ ok: false, field: "financial_month_start_day" });
    expect(normalizeSettings({ ...base, alert_1: "95" })).toMatchObject({ ok: false, field: "alert_1" });
    expect(normalizeSettings({ ...base, free_to_spend_mode: "x" })).toMatchObject({ ok: false, field: "free_to_spend_mode" });
  });
});
