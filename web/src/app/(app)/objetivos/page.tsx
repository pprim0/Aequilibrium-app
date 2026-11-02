import { GoalsView } from "@/components/goals/goals-view";
import { SetupMissing } from "@/components/setup/require-setup";
import { getGoalsOverview, getLookups, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.goals.title} · ${t.app.name}` };

export default async function GoalsPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const [lookups, overview] = await Promise.all([getLookups(), getGoalsOverview()]);
  return <GoalsView {...overview} today={lookups.today} />;
}
