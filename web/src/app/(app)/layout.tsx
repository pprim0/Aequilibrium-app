import { BottomNav, Sidebar } from "@/components/shell/nav";
import { TxFormProvider } from "@/components/transactions/tx-form-provider";
import { getLookups } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lookups = await getLookups();
  return (
    <TxFormProvider lookups={lookups}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </TxFormProvider>
  );
}
