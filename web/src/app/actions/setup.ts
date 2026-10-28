"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function applyPreset(_prev: string | null, formData: FormData): Promise<string | null> {
  const key = String(formData.get("preset") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_preset", { p_key: key });
  if (error) return error.message;
  redirect("/");
}
