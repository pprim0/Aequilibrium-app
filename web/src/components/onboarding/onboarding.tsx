"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { applySetup } from "@/app/actions/settings";
import { amountToInput, parseAmount } from "@/lib/format";
import { finalizeSetup, isCredit, startEditing, type SetupAccount, type SetupData } from "@/lib/setup-data";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

const o = t.onboarding;
const STEPS = ["preset", "accounts", "debts", "income", "budgets", "habits", "goals", "review"] as const;
type Step = (typeof STEPS)[number];

type Preset = { key: string; name: string; description: string | null; data: SetupData };

// Amounts stay as typed while editing and are parsed on leaving each step.
type Draft = SetupData & { preset_key?: string };

function money(value: number | null | undefined) {
  return value === null || value === undefined ? "" : amountToInput(Math.abs(value));
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label={`${o.remove}: ${label}`}>
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}

export function Onboarding({ presets, today }: { presets: Preset[]; today: string }) {
  const [step, setStep] = useState<Step>("preset");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [newHabit, setNewHabit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const index = STEPS.indexOf(step);
  const accounts = draft?.accounts ?? [];
  const regular = accounts.filter((a) => !isCredit(a));
  const debts = accounts.filter(isCredit);

  function choose(preset: Preset) {
    const edited: Draft = { ...startEditing(preset.data), preset_key: preset.key };
    const initial: Record<string, string> = { startDay: String(edited.settings?.financial_month_start_day ?? 1) };
    (edited.accounts ?? []).forEach((a, i) => {
      initial[`acc-${i}`] = money(a.opening_balance);
      initial[`lim-${i}`] = money(a.credit_limit);
    });
    (edited.income_sources ?? []).forEach((s, i) => (initial[`inc-${i}`] = money(s.amount)));
    (edited.groups ?? []).forEach((g, i) => (initial[`grp-${i}`] = money(g.monthly_budget)));
    (edited.goals ?? []).forEach((g, i) => (initial[`goal-${i}`] = money(g.target_amount)));
    setDraft(edited);
    setAmounts(initial);
    setError(null);
    setStep("accounts");
  }

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setAmount = (key: string, value: string) => setAmounts((cur) => ({ ...cur, [key]: value }));

  // Rows are addressed by their position in the full list, so removing shifts the typed amounts too.
  function removeAt(prefix: string, list: unknown[], at: number) {
    setAmounts((cur) => {
      const next = { ...cur };
      for (let i = at; i < list.length; i += 1) {
        const following = cur[`${prefix}-${i + 1}`];
        if (following === undefined) delete next[`${prefix}-${i}`];
        else next[`${prefix}-${i}`] = following;
      }
      return next;
    });
  }

  function setAccount(at: number, patch: Partial<SetupAccount>) {
    update({ accounts: accounts.map((a, i) => (i === at ? { ...a, ...patch } : a)) });
  }
  function addAccount(credit: boolean) {
    update({ accounts: [...accounts, { name: "", type: credit ? "credit" : "checking", debt_strategy: credit ? "plan" : null, opening_date: today, }] });
  }
  function removeAccount(at: number) {
    removeAt("acc", accounts, at);
    removeAt("lim", accounts, at);
    update({ accounts: accounts.filter((_, i) => i !== at) });
  }

  function validate(current: Step): string | null {
    if (current === "accounts") {
      if (!regular.some((a) => a.type === "checking" || a.type === "cash")) return o.errors.noAccount;
      const day = Number(amounts.startDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) return t.settings.errors.range(o.monthStartDay, 1, 28);
    }
    if (current === "accounts" || current === "debts") {
      const names = accounts.map((a) => a.name.trim());
      if (names.some((n) => !n) || new Set(names).size !== names.length) return o.errors.names;
      for (let i = 0; i < accounts.length; i += 1) {
        const text = amounts[`acc-${i}`];
        if (text && parseAmount(text) === null) return o.errors.amount;
        const limit = amounts[`lim-${i}`];
        if (limit && (parseAmount(limit) === null || (parseAmount(limit) as number) < 0)) return o.errors.amount;
      }
    }
    if (current === "income") {
      for (let i = 0; i < (draft?.income_sources ?? []).length; i += 1) {
        if (!draft?.income_sources?.[i].name.trim()) return o.errors.names;
        const value = parseAmount(amounts[`inc-${i}`] ?? "");
        if (value === null || value < 0) return o.errors.amount;
      }
    }
    if (current === "budgets") {
      for (let i = 0; i < (draft?.groups ?? []).length; i += 1) {
        const text = amounts[`grp-${i}`];
        if (text && (parseAmount(text) === null || (parseAmount(text) as number) < 0)) return o.errors.amount;
      }
    }
    if (current === "goals") {
      const goals = draft?.goals ?? [];
      const names = goals.map((g) => g.name.trim());
      if (names.some((n) => !n) || new Set(names).size !== names.length) return o.errors.names;
      for (let i = 0; i < goals.length; i += 1) {
        if (goals[i].target_type === "formula") continue;
        const value = parseAmount(amounts[`goal-${i}`] ?? "");
        if (value === null || value <= 0) return o.errors.amount;
      }
    }
    return null;
  }

  function next() {
    const problem = validate(step);
    setError(problem);
    if (!problem) setStep(STEPS[index + 1]);
  }

  function buildDocument(): SetupData {
    const d = draft!;
    const parsed = (key: string) => parseAmount(amounts[key] ?? "") ?? undefined;
    const incomeCategories = (d.categories ?? []).filter((c) => c.kind === "income");
    const savingsAccount = accounts.find((a) => a.type === "savings")?.name;

    // A new goal needs its saving category; apply_setup links them by name.
    const categories = [...(d.categories ?? [])];
    for (const goal of d.goals ?? []) {
      const goalName = goal.name.trim();
      if (goal.target_type === "fixed" && !goal.category && !categories.some((c) => c.name === goalName)) {
        categories.push({ name: goalName, kind: "saving", nature: "fixed", default_to_account: savingsAccount, emoji: "🎯" });
      }
    }

    const edited: SetupData = {
      ...d,
      settings: { ...d.settings, financial_month_start_day: Number(amounts.startDay) },
      accounts: accounts.map((a, i) => ({ ...a, name: a.name.trim(), opening_balance: parsed(`acc-${i}`) ?? 0, credit_limit: a.is_credit_card ? (parsed(`lim-${i}`) ?? null) : null })),
      categories,
      income_sources: (d.income_sources ?? []).map((s, i) => {
        const category = incomeCategories.find((c) => c.name === s.category);
        return { ...s, name: s.name.trim(), amount: parsed(`inc-${i}`) ?? 0, tag: s.tag ?? category?.tag ?? s.name.trim().toLowerCase(), valid_from: s.valid_from ?? today };
      }),
      groups: (d.groups ?? []).map((g, i) => ({ ...g, monthly_budget: parsed(`grp-${i}`) ?? null })),
      goals: (d.goals ?? []).map((g, i) =>
        g.target_type === "formula"
          ? g
          : { ...g, name: g.name.trim(), target_amount: parsed(`goal-${i}`), category: g.category ?? g.name.trim() },
      ),
    };
    return finalizeSetup(edited, today);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const message = await applySetup(buildDocument());
      if (message) setError(message);
    });
  }

  const incomeCategories = (draft?.categories ?? []).filter((c) => c.kind === "income");
  const budgeted = (draft?.groups ?? []).filter((_, i) => amounts[`grp-${i}`]?.trim()).length;
  const habits = draft?.habits ?? [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-text-2">{o.stepOf(index + 1, STEPS.length)}</p>
        <h1 className="text-2xl font-extrabold">{o.steps[step]}</h1>
        <p className="mt-1 text-sm text-text-2">{o.hints[step]}</p>
        <div className="mt-3">
          <Meter value={(index + 1) / STEPS.length} label={o.stepOf(index + 1, STEPS.length)} />
        </div>
      </div>

      {step === "preset" && (
        <div className="flex flex-col gap-3">
          {presets.length === 0 && <p className="text-sm text-text-2">{t.setup.noPresets}</p>}
          {presets.map((p) => (
            <Card key={p.key} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">{p.name}</p>
                {p.description && <p className="text-sm text-text-2">{p.description}</p>}
              </div>
              <Button onClick={() => choose(p)}>{t.setup.apply}</Button>
            </Card>
          ))}
        </div>
      )}

      {step === "accounts" && draft && (
        <div className="flex flex-col gap-3">
          <Card>
            <Field label={o.monthStartDay} htmlFor="start-day" hint={t.settings.hints.monthStart}>
              <Input
                id="start-day"
                inputMode="numeric"
                className="tabular"
                value={amounts.startDay ?? ""}
                onChange={(e) => setAmount("startDay", e.target.value)}
              />
            </Field>
          </Card>
          {accounts.map((a, i) =>
            isCredit(a) ? null : (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <Field label={o.accountName} htmlFor={`acc-name-${i}`} className="min-w-0 flex-1">
                    <Input id={`acc-name-${i}`} value={a.name} onChange={(e) => setAccount(i, { name: e.target.value })} autoComplete="off" />
                  </Field>
                  <RemoveButton onClick={() => removeAccount(i)} label={a.name} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={o.accountType} htmlFor={`acc-type-${i}`}>
                    <Select id={`acc-type-${i}`} value={a.type} onChange={(e) => setAccount(i, { type: e.target.value })}>
                      {["checking", "cash", "savings", "investment", "benefit"].map((type) => (
                        <option key={type} value={type}>
                          {t.accountTypes[type]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={o.balance} htmlFor={`acc-amount-${i}`}>
                    <Input id={`acc-amount-${i}`} inputMode="decimal" placeholder="0,00" className="tabular" value={amounts[`acc-${i}`] ?? ""} onChange={(e) => setAmount(`acc-${i}`, e.target.value)} autoComplete="off" />
                  </Field>
                </div>
              </Card>
            ),
          )}
          <div>
            <Button variant="secondary" size="sm" onClick={() => addAccount(false)}>
              <Plus className="size-4" aria-hidden /> {o.newAccount}
            </Button>
          </div>
        </div>
      )}

      {step === "debts" && draft && (
        <div className="flex flex-col gap-3">
          {accounts.map((a, i) =>
            !isCredit(a) ? null : (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <Field label={o.accountName} htmlFor={`debt-name-${i}`} className="min-w-0 flex-1">
                    <Input id={`debt-name-${i}`} value={a.name} onChange={(e) => setAccount(i, { name: e.target.value })} autoComplete="off" />
                  </Field>
                  <RemoveButton onClick={() => removeAccount(i)} label={a.name} />
                </div>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-text-2">
                  <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={Boolean(a.is_credit_card)} onChange={(e) => setAccount(i, { is_credit_card: e.target.checked })} />
                  {o.isCard}
                </label>
                {a.is_credit_card && (
                  <Field label={t.debts.limit} htmlFor={`debt-limit-${i}`}>
                    <Input id={`debt-limit-${i}`} inputMode="decimal" placeholder="0,00" className="tabular" value={amounts[`lim-${i}`] ?? ""} onChange={(e) => setAmount(`lim-${i}`, e.target.value)} autoComplete="off" />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label={o.owed} htmlFor={`debt-amount-${i}`}>
                    <Input id={`debt-amount-${i}`} inputMode="decimal" placeholder="0,00" className="tabular" value={amounts[`acc-${i}`] ?? ""} onChange={(e) => setAmount(`acc-${i}`, e.target.value)} autoComplete="off" />
                  </Field>
                  <Field label={o.strategy} htmlFor={`debt-strategy-${i}`}>
                    <Select id={`debt-strategy-${i}`} value={a.debt_strategy ?? "plan"} onChange={(e) => setAccount(i, { debt_strategy: e.target.value })}>
                      <option value="plan">{t.debtStrategies.plan}</option>
                      <option value="installments">{t.debtStrategies.installments}</option>
                    </Select>
                  </Field>
                </div>
              </Card>
            ),
          )}
          <div>
            <Button variant="secondary" size="sm" onClick={() => addAccount(true)}>
              <Plus className="size-4" aria-hidden /> {o.newDebt}
            </Button>
          </div>
        </div>
      )}

      {step === "income" && draft && (
        <div className="flex flex-col gap-3">
          {(draft.income_sources ?? []).map((s, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <Field label={o.incomeName} htmlFor={`inc-name-${i}`} className="min-w-0 flex-1">
                  <Input
                    id={`inc-name-${i}`}
                    value={s.name}
                    autoComplete="off"
                    onChange={(e) => update({ income_sources: draft.income_sources?.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                </Field>
                <RemoveButton
                  label={s.name}
                  onClick={() => {
                    removeAt("inc", draft.income_sources ?? [], i);
                    update({ income_sources: draft.income_sources?.filter((_, j) => j !== i) });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={o.incomeAmount} htmlFor={`inc-amount-${i}`}>
                  <Input id={`inc-amount-${i}`} inputMode="decimal" placeholder="0,00" className="tabular" value={amounts[`inc-${i}`] ?? ""} onChange={(e) => setAmount(`inc-${i}`, e.target.value)} autoComplete="off" />
                </Field>
                <Field label={o.incomeCategory} htmlFor={`inc-cat-${i}`}>
                  <Select
                    id={`inc-cat-${i}`}
                    value={String(s.category ?? "")}
                    onChange={(e) => {
                      const category = incomeCategories.find((c) => c.name === e.target.value);
                      update({ income_sources: draft.income_sources?.map((x, j) => (j === i ? { ...x, category: e.target.value, tag: category?.tag ?? x.tag } : x)) });
                    }}
                  >
                    {incomeCategories.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          ))}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                update({
                  income_sources: [
                    ...(draft.income_sources ?? []),
                    { name: "", category: incomeCategories[0]?.name, tag: incomeCategories[0]?.tag ?? undefined, valid_from: today },
                  ],
                })
              }
            >
              <Plus className="size-4" aria-hidden /> {o.newIncome}
            </Button>
          </div>
        </div>
      )}

      {step === "budgets" && draft && (
        <Card className="flex flex-col gap-3">
          {(draft.groups ?? []).map((g, i) => (
            <Field key={g.name} label={g.name} htmlFor={`grp-${i}`}>
              <Input id={`grp-${i}`} inputMode="decimal" placeholder={o.budget} className="tabular" value={amounts[`grp-${i}`] ?? ""} onChange={(e) => setAmount(`grp-${i}`, e.target.value)} autoComplete="off" />
            </Field>
          ))}
        </Card>
      )}

      {step === "habits" && draft && (
        <div className="flex flex-col gap-3">
          <Card className="py-1">
            <ul className="divide-y divide-border">
              {habits.map((h, i) => (
                <li key={`${h.name}-${i}`} className="flex min-h-14 items-center justify-between gap-2 py-1">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {typeof h.emoji === "string" ? `${h.emoji} ` : ""}
                      {h.name}
                    </span>
                    {h.system_key && <span className="block text-xs text-text-3">{o.systemHabit}</span>}
                  </span>
                  {!h.system_key && <RemoveButton label={h.name} onClick={() => update({ habits: habits.filter((_, j) => j !== i) })} />}
                </li>
              ))}
            </ul>
          </Card>
          <div className="flex items-end gap-2">
            <Field label={o.habitName} htmlFor="new-habit" className="min-w-0 flex-1">
              <Input id="new-habit" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} autoComplete="off" />
            </Field>
            <Button
              variant="secondary"
              disabled={!newHabit.trim() || habits.some((h) => h.name === newHabit.trim())}
              onClick={() => {
                update({ habits: [...habits, { name: newHabit.trim() }] });
                setNewHabit("");
              }}
            >
              <Plus className="size-4" aria-hidden /> {o.add}
            </Button>
          </div>
        </div>
      )}

      {step === "goals" && draft && (
        <div className="flex flex-col gap-3">
          {(draft.goals ?? []).map((g, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <Field label={o.goalName} htmlFor={`goal-name-${i}`} className="min-w-0 flex-1">
                  <Input
                    id={`goal-name-${i}`}
                    value={g.name}
                    autoComplete="off"
                    readOnly={g.target_type === "formula"}
                    onChange={(e) => update({ goals: draft.goals?.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                </Field>
                <RemoveButton
                  label={g.name}
                  onClick={() => {
                    removeAt("goal", draft.goals ?? [], i);
                    update({ goals: draft.goals?.filter((_, j) => j !== i) });
                  }}
                />
              </div>
              {g.target_type === "formula" ? (
                <p className="text-sm text-text-2">{o.formulaGoal(String(g.target_formula?.factor ?? 1).replace(".", ","))}</p>
              ) : (
                <Field label={o.goalTarget} htmlFor={`goal-amount-${i}`}>
                  <Input id={`goal-amount-${i}`} inputMode="decimal" placeholder="0,00" className="tabular" value={amounts[`goal-${i}`] ?? ""} onChange={(e) => setAmount(`goal-${i}`, e.target.value)} autoComplete="off" />
                </Field>
              )}
            </Card>
          ))}
          <div>
            <Button variant="secondary" size="sm" onClick={() => update({ goals: [...(draft.goals ?? []), { name: "", target_type: "fixed" }] })}>
              <Plus className="size-4" aria-hidden /> {o.newGoal}
            </Button>
          </div>
        </div>
      )}

      {step === "review" && draft && (
        <Card>
          <ul className="flex flex-col gap-2 text-sm font-medium">
            <li>✓ {o.summary.accounts(regular.length)}</li>
            <li>✓ {o.summary.debts(debts.length)}</li>
            <li>✓ {o.summary.income((draft.income_sources ?? []).length)}</li>
            <li>✓ {o.summary.budgets(budgeted)}</li>
            <li>✓ {o.summary.habits(habits.length)}</li>
            <li>✓ {o.summary.goals((draft.goals ?? []).length)}</li>
          </ul>
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {step !== "preset" && (
        <div className={cn("flex gap-3")}>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setError(null);
              setStep(STEPS[index - 1]);
            }}
          >
            {o.back}
          </Button>
          {step === "review" ? (
            <Button className="flex-1" onClick={finish} disabled={pending}>
              {pending ? o.finishing : o.finish}
            </Button>
          ) : (
            <Button className="flex-1" onClick={next}>
              {o.next}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
