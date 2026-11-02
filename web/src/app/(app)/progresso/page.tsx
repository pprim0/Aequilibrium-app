import { ProgressView } from "@/components/progress/progress-view";
import { SetupMissing } from "@/components/setup/require-setup";
import { getBudgetTrack, getDebtOverview, getGamification, getLookups, getRecentCheckins, getReviewCalendar, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.progress.title} · ${t.app.name}` };

export default async function ProgressPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const lookups = await getLookups();
  const gamification = await getGamification();
  const [calendar, checkins, debts, budgetTrack] = await Promise.all([getReviewCalendar(), getRecentCheckins(lookups.today), getDebtOverview(), getBudgetTrack()]);
  return (
    <ProgressView
      overview={gamification.overview}
      achievements={gamification.achievements}
      debts={debts}
      budgetTrack={budgetTrack}
      calendar={calendar}
      checkins={checkins}
      today={lookups.today}
    />
  );
}
