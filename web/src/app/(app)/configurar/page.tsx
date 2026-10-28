import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/card";
import { PresetPicker } from "@/components/setup/preset-picker";
import { getPresets, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.setup.title} · ${t.app.name}` };

// Minimal setup until the full onboarding (phase 6): pick a preset.
export default async function SetupPage() {
  if (await isSetUp()) redirect("/");
  const presets = await getPresets();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t.setup.title}</h1>
      <p className="text-text-2">{t.setup.intro}</p>
      {presets.length > 0 ? <PresetPicker presets={presets} /> : <EmptyState>{t.setup.noPresets}</EmptyState>}
    </div>
  );
}
