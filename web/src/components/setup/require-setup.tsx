import Link from "next/link";
import { EmptyState } from "@/components/ui/card";
import { t } from "@/i18n";

export function SetupMissing() {
  return (
    <EmptyState
      action={
        <Link href="/configurar" className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-semibold text-on-primary">
          {t.setup.goToSetup}
        </Link>
      }
    >
      {t.setup.missing}
    </EmptyState>
  );
}
