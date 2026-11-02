import { BottomNav, Sidebar } from "@/components/shell/nav";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { TxFormProvider } from "@/components/transactions/tx-form-provider";
import { getLookups, getNotifications, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lookups = await getLookups();
  const notifications = (await isSetUp()) ? await getNotifications() : [];
  const showHabits = lookups.settings?.show_habits ?? false;
  return (
    <TxFormProvider lookups={lookups}>
      <div className="flex min-h-dvh">
        <Sidebar showHabits={showHabits} />
        <div className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-2 pb-28 md:px-8 md:pb-10">
          <header className="mb-2 flex min-h-11 items-center justify-between gap-2">
            <p className="text-lg font-extrabold tracking-tight text-primary md:invisible">{t.app.name}</p>
            <NotificationsBell items={notifications} />
          </header>
          <main>{children}</main>
        </div>
      </div>
      <BottomNav showHabits={showHabits} />
    </TxFormProvider>
  );
}
