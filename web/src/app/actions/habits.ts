"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { t } from "@/i18n";

export type HabitInput = {
  id?: string;
  name: string;
  emoji: string;
  frequency: "daily" | "specific_days" | "weekly";
  weekdays: number[];
  timesPerWeek: string;
  time: string;
};

async function finish(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ActionResult> {
  await supabase.rpc("evaluate_gamification");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveHabit(input: HabitInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };

  const name = input.name.trim();
  if (!name) return { ok: false, error: t.habits.errors.name, field: "name" };
  if (input.frequency === "specific_days" && input.weekdays.length === 0) {
    return { ok: false, error: t.habits.errors.days, field: "weekdays" };
  }
  const times = Number(input.timesPerWeek);
  if (input.frequency === "weekly" && !(Number.isInteger(times) && times >= 1 && times <= 7)) {
    return { ok: false, error: t.habits.errors.times, field: "times" };
  }

  const fields = {
    name,
    emoji: input.emoji.trim() || "✅",
    frequency_type: input.frequency,
    target_per_period: input.frequency === "weekly" ? times : 1,
    time_of_day: input.time || null,
  };

  let habitId = input.id;
  if (habitId) {
    const { error } = await supabase.from("habits").update(fields).eq("id", habitId);
    if (error) return { ok: false, error: error.message };
    const { error: clearError } = await supabase.from("habit_schedule_days").delete().eq("habit_id", habitId);
    if (clearError) return { ok: false, error: clearError.message };
  } else {
    const { data, error } = await supabase.from("habits").insert({ ...fields, user_id: user.id }).select("id").single();
    if (error) return { ok: false, error: error.message };
    habitId = data.id as string;
  }

  if (input.frequency === "specific_days") {
    const { error } = await supabase
      .from("habit_schedule_days")
      .insert(input.weekdays.map((weekday) => ({ habit_id: habitId, weekday })));
    if (error) return { ok: false, error: error.message };
  }
  return finish(supabase);
}

export async function toggleHabit(habitId: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };
  const { data: today, error: todayError } = await supabase.rpc("momentum_today");
  if (todayError) return { ok: false, error: todayError.message };

  // The system habit is the daily review: ticking it confirms the review, and a trigger logs the habit.
  const { data: habit } = await supabase.from("habits").select("system_key").eq("id", habitId).single();
  if (habit?.system_key === "daily_financial_review") {
    const { error } = await supabase
      .from("daily_checkins")
      .upsert({ user_id: user.id, day: today, reviewed: done }, { onConflict: "user_id,day" });
    if (error) return { ok: false, error: error.message };
    return finish(supabase);
  }

  const { error } = done
    ? await supabase
        .from("habit_logs")
        .upsert({ habit_id: habitId, user_id: user.id, log_date: today, status: "done" }, { onConflict: "habit_id,log_date" })
    : await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", today);
  if (error) return { ok: false, error: error.message };
  return finish(supabase);
}

// The habit is archived, never deleted: its history stays for streaks and insights.
export async function archiveHabit(habitId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", habitId)
    .is("system_key", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
