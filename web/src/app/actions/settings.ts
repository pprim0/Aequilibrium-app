"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findEntity, normalizeEntity, normalizeSettings, type SettingsInput } from "@/lib/settings-entities";
import type { ActionResult } from "@/lib/types";
import { t } from "@/i18n";

function dbError(error: { code?: string; message: string }): ActionResult {
  if (error.code === "23505") return { ok: false, error: t.settings.errors.duplicate };
  if (error.code === "23503") return { ok: false, error: t.settings.errors.inUse };
  return { ok: false, error: error.message };
}

async function evaluateAndRefresh(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ActionResult> {
  await supabase.rpc("evaluate_gamification");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveEntity(entityKey: string, id: string | null, raw: Record<string, unknown>): Promise<ActionResult> {
  const entity = findEntity(entityKey);
  if (!entity || (!id && !entity.canCreate)) return { ok: false, error: t.common.unexpectedError };
  const parsed = normalizeEntity(entity, raw);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };

  // Without a tag, an expected income takes its category's (e.g. salary, used by the fund target).
  if (entity.key === "rendimentos" && !parsed.values.tag) {
    const { data: category } = parsed.values.category_id
      ? await supabase.from("categories").select("tag").eq("id", String(parsed.values.category_id)).maybeSingle()
      : { data: null };
    parsed.values.tag = category?.tag || String(parsed.values.name).toLowerCase();
  }

  const { error } = id
    ? await supabase.from(entity.table).update(parsed.values).eq("id", id)
    : await supabase.from(entity.table).insert({ ...parsed.values, user_id: user.id });
  if (error) return dbError(error);
  return evaluateAndRefresh(supabase);
}

export async function deleteEntity(entityKey: string, id: string): Promise<ActionResult> {
  const entity = findEntity(entityKey);
  if (!entity?.canDelete) return { ok: false, error: t.common.unexpectedError };
  const supabase = await createClient();
  const { error } = await supabase.from(entity.table).delete().eq("id", id);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveSettings(raw: SettingsInput): Promise<ActionResult> {
  const parsed = normalizeSettings(raw);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t.common.unexpectedError };
  const { error } = await supabase.from("user_settings").upsert({ ...parsed.values, user_id: user.id }, { onConflict: "user_id" });
  if (error) return dbError(error);
  return evaluateAndRefresh(supabase);
}

/** Calls the delete-account Edge Function, which holds the service key on the server side. */
export async function deleteMyAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation.trim() !== t.settings.deleteWord) return { ok: false, error: t.settings.deleteConfirmLabel, field: "confirm" };
  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) return { ok: false, error: t.settings.deleteUnavailable };
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function applySetup(data: unknown): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_setup", { p_data: data });
  if (error) return error.message;
  await supabase.rpc("evaluate_gamification");
  revalidatePath("/", "layout");
  redirect("/");
}
