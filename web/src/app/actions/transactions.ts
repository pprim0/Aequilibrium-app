"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseAmount } from "@/lib/format";
import { TYPES_WITH_DESTINATION, type ActionResult, type TxType } from "@/lib/types";
import { t } from "@/i18n";

export type TxLineInput = { categoryId: string; amount: string };

export type TxInput = {
  id?: string;
  date: string;
  description: string;
  note: string;
  paymentMethodId: string;
  accountId: string;
  toAccountId: string;
  shortcutId: string;
  recurringId: string;
  lines: TxLineInput[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveTransaction(input: TxInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };

  if (!ISO_DATE.test(input.date)) return { ok: false, error: t.tx.errors.date, field: "date" };
  if (input.lines.length === 0) return { ok: false, error: t.tx.errors.category, field: "category-0" };

  // Category kinds decide the movement type (the database trigger enforces the same).
  const categoryIds = input.lines.map((l) => l.categoryId).filter(Boolean);
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, kind, default_to_account_id")
    .in("id", categoryIds.length ? categoryIds : ["00000000-0000-0000-0000-000000000000"]);
  if (catError) return { ok: false, error: catError.message };
  const kindOf = new Map(categories.map((c) => [c.id as string, c as { kind: TxType; default_to_account_id: string | null }]));

  const rows = [];
  for (const [i, line] of input.lines.entries()) {
    const category = kindOf.get(line.categoryId);
    if (!category) return { ok: false, error: t.tx.errors.category, field: `category-${i}` };
    const amount = parseAmount(line.amount);
    if (amount === null || amount === 0) return { ok: false, error: t.tx.errors.amount, field: `amount-${i}` };
    if (amount < 0 && category.kind !== "saving" && category.kind !== "investment") {
      return { ok: false, error: t.tx.errors.negative, field: `amount-${i}` };
    }
    const needsDestination = TYPES_WITH_DESTINATION.includes(category.kind);
    const toAccountId = needsDestination ? input.toAccountId || category.default_to_account_id || null : null;
    if (needsDestination && (category.kind === "transfer" || category.kind === "debt_payment") && !toAccountId) {
      return { ok: false, error: t.tx.errors.toAccount, field: "toAccount" };
    }
    if (toAccountId && input.accountId && toAccountId === input.accountId) {
      return { ok: false, error: t.tx.errors.sameAccount, field: "toAccount" };
    }
    rows.push({
      user_id: user.id,
      date: input.date,
      amount,
      type: category.kind,
      category_id: line.categoryId,
      // Empty account: the trigger takes it from the payment method or the main account.
      account_id: input.accountId || null,
      to_account_id: toAccountId,
      payment_method_id: input.paymentMethodId || null,
      shortcut_id: input.shortcutId || null,
      recurring_id: input.recurringId || null,
      description: input.description.trim() || null,
      note: input.note.trim() || null,
    });
  }

  if (input.id) {
    const { error } = await supabase.from("transactions").update(rows[0]).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const splitId = rows.length > 1 ? randomUUID() : null;
    const { error } = await supabase.from("transactions").insert(rows.map((row) => ({ ...row, split_id: splitId })));
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
