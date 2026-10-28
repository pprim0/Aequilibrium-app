"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthInputToKey, parseAmount } from "@/lib/format";
import { ACCOUNT_TYPES, type AccountType, type ActionResult } from "@/lib/types";
import { t } from "@/i18n";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function userClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function done(): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- accounts
export type AccountInput = {
  id?: string;
  name: string;
  type: AccountType;
  amount: string; // for credit accounts: what is owed (positive)
  openingDate: string;
  debtStrategy: "plan" | "installments" | "";
  archived: boolean;
};

export async function saveAccount(input: AccountInput): Promise<ActionResult> {
  const { supabase, userId } = await userClient();
  if (!userId) return { ok: false, error: t.common.unexpectedError };
  if (!input.name.trim()) return { ok: false, error: t.accounts.name, field: "name" };
  if (!ACCOUNT_TYPES.includes(input.type)) return { ok: false, error: t.accounts.type, field: "type" };
  const amount = input.amount.trim() === "" ? 0 : parseAmount(input.amount);
  if (amount === null) return { ok: false, error: t.tx.errors.amount, field: "amount" };
  if (!ISO_DATE.test(input.openingDate)) return { ok: false, error: t.tx.errors.date, field: "openingDate" };
  const isCredit = input.type === "credit";
  const row = {
    user_id: userId,
    name: input.name.trim(),
    type: input.type,
    opening_balance: isCredit ? -Math.abs(amount) : amount,
    opening_date: input.openingDate,
    debt_strategy: isCredit ? input.debtStrategy || "plan" : null,
    is_archived: input.archived,
  };
  const { error } = input.id
    ? await supabase.from("accounts").update(row).eq("id", input.id)
    : await supabase.from("accounts").insert(row);
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const { supabase } = await userClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? t.accounts.cannotDelete : error.message };
  return done();
}

// ---------------------------------------------------------------- recurring payments
export type RecurringInput = {
  id?: string;
  description: string;
  categoryId: string;
  amount: string;
  dayOfMonth: string;
  intervalMonths: string;
  anchorMonth: string; // "2026-10"
  startMonth: string;
  endMonth: string;
  accountId: string;
};

export async function saveRecurring(input: RecurringInput): Promise<ActionResult> {
  const { supabase, userId } = await userClient();
  if (!userId) return { ok: false, error: t.common.unexpectedError };
  if (!input.description.trim()) return { ok: false, error: t.tx.description, field: "description" };
  const amount = parseAmount(input.amount);
  if (amount === null || amount <= 0) return { ok: false, error: t.tx.errors.amount, field: "amount" };
  const day = input.dayOfMonth ? Number(input.dayOfMonth) : null;
  if (day !== null && !(Number.isInteger(day) && day >= 1 && day <= 31)) return { ok: false, error: t.accounts.dayOfMonth, field: "day" };
  const interval = Number(input.intervalMonths || 1);
  if (!(Number.isInteger(interval) && interval >= 1)) return { ok: false, error: t.accounts.everyNMonths, field: "interval" };
  const row = {
    user_id: userId,
    description: input.description.trim(),
    category_id: input.categoryId || null,
    amount,
    day_of_month: day,
    interval_months: interval,
    anchor_month: monthInputToKey(input.anchorMonth),
    start_month: monthInputToKey(input.startMonth),
    end_month: monthInputToKey(input.endMonth),
    account_id: input.accountId || null,
  };
  const { error } = input.id
    ? await supabase.from("recurring_payments").update(row).eq("id", input.id)
    : await supabase.from("recurring_payments").insert(row);
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  const { supabase } = await userClient();
  const { error } = await supabase.from("recurring_payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}

// ---------------------------------------------------------------- installments
export type InstallmentInput = {
  id?: string;
  accountId: string;
  amount: string;
  dueDate: string;
  description: string;
};

export async function saveInstallment(input: InstallmentInput): Promise<ActionResult> {
  const { supabase, userId } = await userClient();
  if (!userId) return { ok: false, error: t.common.unexpectedError };
  if (!input.accountId) return { ok: false, error: t.accounts.creditAccount, field: "account" };
  const amount = parseAmount(input.amount);
  if (amount === null || amount <= 0) return { ok: false, error: t.tx.errors.amount, field: "amount" };
  if (!ISO_DATE.test(input.dueDate)) return { ok: false, error: t.tx.errors.date, field: "dueDate" };
  const row = {
    user_id: userId,
    account_id: input.accountId,
    amount,
    due_date: input.dueDate,
    description: input.description.trim() || null,
  };
  const { error } = input.id
    ? await supabase.from("installments").update(row).eq("id", input.id)
    : await supabase.from("installments").insert(row);
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function deleteInstallment(id: string): Promise<ActionResult> {
  const { supabase } = await userClient();
  const { error } = await supabase.from("installments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}
