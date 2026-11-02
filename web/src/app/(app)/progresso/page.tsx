import { ProgressView } from "@/components/progress/progress-view";
import { SetupMissing } from "@/components/setup/require-setup";
import { getGamification, getLookups, getRecentCheckins, getReviewCalendar, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.progress.title} · ${t.app.name}` };

export default async function ProgressPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const lookups = await getLookups();
  const gamification = await getGamification();
  const [calendar, checkins] = await Promise.all([getReviewCalendar(), getRecentCheckins(lookups.today)]);
  return <ProgressView {...gamification} calendar={calendar} checkins={checkins} today={lookups.today} />;
}
