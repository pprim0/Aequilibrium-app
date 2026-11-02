"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/i18n";

export type CheckinInput = {
  day: string;
  reviewed: boolean;
  noExpenses: boolean;
  paymentsConfirmed: boolean;
  budgetChecked: boolean;
  weeklyReview: boolean;
  debtsGoalsReviewed: boolean;
  notes: string;
};

export type ReviewResult = { ok: true; xpChange: number; unlocked: string[] } | { ok: false; error: string };

export async function saveCheckin(input: CheckinInput): Promise<ReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      day: input.day,
      reviewed: input.reviewed,
      no_expenses: input.noExpenses,
      payments_confirmed: input.paymentsConfirmed,
      budget_checked: input.budgetChecked,
      weekly_review: input.weeklyReview,
      debts_goals_reviewed: input.debtsGoalsReviewed,
      notes: input.notes.trim() || null,
    },
    { onConflict: "user_id,day" },
  );
  if (error) return { ok: false, error: error.code === "23514" ? t.review.only : error.message };

  const { data } = await supabase.rpc("evaluate_gamification");
  revalidatePath("/", "layout");
  return { ok: true, xpChange: data?.xp_change ?? 0, unlocked: data?.unlocked ?? [] };
}
