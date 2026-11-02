import { DebtsView } from "@/components/debts/debts-view";
import { SetupMissing } from "@/components/setup/require-setup";
import { getAccountsOverview, getCurrentMonthKey, getDebtOverview, getLookups, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.debts.title} · ${t.app.name}` };

export default async function CommitmentsPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const [lookups, monthKey, debtOverview] = await Promise.all([getLookups(), getCurrentMonthKey(), getDebtOverview()]);
  const overview = await getAccountsOverview(monthKey);
  return <DebtsView lookups={lookups} overview={debtOverview} debts={overview.debts} installments={overview.installments} installmentRows={overview.installmentRows} recurringStatus={overview.recurringStatus} recurring={overview.recurring} />;
}
