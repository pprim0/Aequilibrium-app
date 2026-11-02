import { redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding/onboarding";
import { getLookups, getPresets, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.onboarding.title} · ${t.app.name}` };

export default async function SetupPage() {
  if (await isSetUp()) redirect("/");
  const [presets, lookups] = await Promise.all([getPresets(), getLookups()]);
  return <Onboarding presets={presets} today={lookups.today} />;
}
