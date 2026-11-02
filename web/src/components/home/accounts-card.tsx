"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AccountBalance } from "@/lib/types";
import { t } from "@/i18n";

// Closed on phones (the total is enough at a glance); always open on larger screens.
export function AccountsCard({ accounts, total }: { accounts: AccountBalance[]; total: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="py-2">
      <button
        type="button"
        onClick={() => setOpen((cur) => !cur)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 text-left md:pointer-events-none"
      >
        <span className="min-w-0 flex-1 font-bold">{t.home.balances}</span>
        <span className="tabular font-bold">{formatMoney(total)}</span>
        <ChevronDown className={cn("size-5 shrink-0 text-text-3 transition-transform md:hidden", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn(open ? "block" : "hidden", "md:block")}>
        <ul className="flex flex-col gap-2 border-t border-border pt-2 text-sm">
          {accounts.map((a) => (
            <li key={a.account_id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-text-2">{a.name}</span>
              <span className="tabular font-semibold">{formatMoney(a.balance)}</span>
            </li>
          ))}
        </ul>
        <Link href="/contas" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
          {t.home.manageAccounts}
        </Link>
      </div>
    </Card>
  );
}
