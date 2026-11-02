import { HomeView } from "@/components/home/home-view";
import { SetupMissing } from "@/components/setup/require-setup";
import {
  getAccountsOverview,
  getBudget,
  getCurrentMonthKey,
  getFreeToSpend,
  getGamification,
  getRecentCheckins,
  getGoalsOverview,
  getLookups,
  getMonthCoverage,
  getMonthTotals,
  getRecentTransactions,
  getSpentToday,
  isSetUp,
} from "@/lib/data";

export default async function HomePage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const [lookups, monthKey] = await Promise.all([getLookups(), getCurrentMonthKey()]);
  const [free, coverage, spentToday, totals, overview, budget, goals, recent, gamification, checkins] = await Promise.all([
    getFreeToSpend(),
    getMonthCoverage(),
    getSpentToday(),
    getMonthTotals(monthKey),
    getAccountsOverview(monthKey),
    getBudget(monthKey),
    getGoalsOverview(),
    getRecentTransactions(6),
    getGamification(),
    getRecentCheckins(lookups.today),
  ]);
  return (
    <HomeView
      lookups={lookups}
      data={{
        free,
        coverage,
        spentToday,
        totals,
        balances: overview.balances,
        installments: overview.installments,
        usage: budget.usage,
        debts: overview.debts,
        goals: goals.goals,
        recent,
        gamification: gamification.overview,
        missions: gamification.missions,
        achievements: gamification.achievements,
        checkins,
      }}
    />
  );
}
