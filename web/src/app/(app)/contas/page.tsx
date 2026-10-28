import { AccountsView } from "@/components/accounts/accounts-view";
import { SetupMissing } from "@/components/setup/require-setup";
import { getAccountsOverview, getCurrentMonthKey, getLookups, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.accounts.title} · ${t.app.name}` };

export default async function AccountsPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  const [lookups, monthKey] = await Promise.all([getLookups(), getCurrentMonthKey()]);
  const overview = await getAccountsOverview(monthKey);
  return <AccountsView lookups={lookups} monthKey={monthKey} overview={overview} />;
}
