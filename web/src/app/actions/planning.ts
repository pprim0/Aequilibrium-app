"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseAmount } from "@/lib/format";
import type { ActionResult } from "@/lib/types";
import { t } from "@/i18n";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function done(): ActionResult {
  // Goals and debts feed achievements, which the next screen load evaluates.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Empty input means "no value"; anything else must be a non-negative amount. */
function optionalAmount(input: string): { ok: true; value: number | null } | { ok: false } {
  if (!input.trim()) return { ok: true, value: null };
  const value = parseAmount(input);
  return value === null || value < 0 ? { ok: false } : { ok: true, value };
}

// ---------------------------------------------------------------- budget
export async function saveGroupBudget(id: string, amount: string): Promise<ActionResult> {
  const parsed = optionalAmount(amount);
  if (!parsed.ok) return { ok: false, error: t.tx.errors.amount, field: "amount" };
  const supabase = await createClient();
  const { error } = await supabase.from("category_groups").update({ monthly_budget: parsed.value }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function saveCategoryLimit(id: string, amount: string): Promise<ActionResult> {
  const parsed = optionalAmount(amount);
  if (!parsed.ok) return { ok: false, error: t.tx.errors.amount, field: "amount" };
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ own_limit: parsed.value }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}

// ---------------------------------------------------------------- goals
export type GoalInput = {
  id?: string;
  name: string;
  isFormula: boolean;
  target: string;
  factor: string;
  roundUp: string;
  targetDate: string;
  priority: string;
};

export async function saveGoal(input: GoalInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };

  const name = input.name.trim();
  if (!name) return { ok: false, error: t.goals.name, field: "name" };
  if (input.targetDate && !ISO_DATE.test(input.targetDate)) return { ok: false, error: t.tx.errors.date, field: "targetDate" };
  const priority = Number(input.priority) || 2;

  if (input.id && input.isFormula) {
    const factor = parseAmount(input.factor);
    const roundUp = input.roundUp.trim() ? parseAmount(input.roundUp) : 0;
    if (factor === null || factor <= 0) return { ok: false, error: t.tx.errors.amount, field: "factor" };
    if (roundUp === null || roundUp < 0) return { ok: false, error: t.tx.errors.amount, field: "roundUp" };
    const { data: current, error: readError } = await supabase.from("goals").select("target_formula").eq("id", input.id).single();
    if (readError) return { ok: false, error: readError.message };
    const { error } = await supabase
      .from("goals")
      .update({
        name,
        priority,
        target_date: input.targetDate || null,
        target_formula: { ...(current.target_formula as object), factor, round_up: roundUp },
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return done();
  }

  const target = parseAmount(input.target);
  if (target === null || target <= 0) return { ok: false, error: t.tx.errors.amount, field: "target" };
  const fields = { name, priority, target_type: "fixed", target_amount: target, target_date: input.targetDate || null };

  if (input.id) {
    const { error } = await supabase.from("goals").update(fields).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return done();
  }

  // A new goal gets its own saving category, so deposits are registered like any movement.
  const { data: savings } = await supabase.from("accounts").select("id").eq("type", "savings").eq("is_archived", false).order("sort_order").limit(1).maybeSingle();
  const { data: existing } = await supabase.from("categories").select("id").eq("name", name).maybeSingle();
  if (existing) return { ok: false, error: t.goals.nameTaken, field: "name" };
  const { data: category, error: catError } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, kind: "saving", nature: "fixed", default_to_account_id: savings?.id ?? null, emoji: "🎯" })
    .select("id")
    .single();
  if (catError) return { ok: false, error: catError.message };
  const { error } = await supabase
    .from("goals")
    .insert({ ...fields, user_id: user.id, category_id: category.id, account_id: savings?.id ?? null });
  if (error) return { ok: false, error: error.message };
  return done();
}

// Goals are archived, never deleted: their deposits stay in the history.
export async function archiveGoal(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").update({ is_archived: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}

// ---------------------------------------------------------------- investments
export async function saveValuation(categoryId: string, value: string, valuedOn: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };
  const amount = parseAmount(value);
  if (amount === null || amount < 0) return { ok: false, error: t.tx.errors.amount, field: "value" };
  if (!ISO_DATE.test(valuedOn)) return { ok: false, error: t.tx.errors.date, field: "valuedOn" };
  const { error } = await supabase
    .from("investment_valuations")
    .upsert({ user_id: user.id, category_id: categoryId, value: amount, valued_on: valuedOn }, { onConflict: "user_id,category_id,valued_on" });
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function addInvestmentAsset(name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };
  const clean = name.trim();
  if (!clean) return { ok: false, error: t.goals.assetName, field: "name" };
  const { data: account } = await supabase.from("accounts").select("id").eq("type", "investment").eq("is_archived", false).order("sort_order").limit(1).maybeSingle();
  if (!account) return { ok: false, error: t.goals.noInvestmentAccount, field: "name" };
  const { error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name: clean, kind: "investment", default_to_account_id: account.id, emoji: "📈" });
  if (error) return { ok: false, error: error.message };
  return done();
}
