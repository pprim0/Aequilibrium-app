"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/types";
import { t } from "@/i18n";

const n = t.notifications;

function describe(item: Notification): { href: string; title: string; detail: string | null; urgent: boolean } {
  const name = item.name ?? "";
  const amount = item.amount === null ? "" : formatMoney(item.amount);
  switch (item.kind) {
    case "payment_overdue":
      return { href: "/compromissos", title: n.overdue(name), detail: `${amount} · ${formatDate(item.due_date ?? "")}`, urgent: true };
    case "payment_due":
      return { href: "/compromissos", title: n.due(name), detail: `${amount} · ${formatDate(item.due_date ?? "")}`, urgent: false };
    case "budget_limit":
      return { href: "/orcamento", title: `${name}: ${t.budget.levels[item.level ?? "orange"]}`, detail: t.budget.ofBudget(amount, formatMoney(item.budget ?? 0)), urgent: item.level === "red" };
    case "payment_no_day":
      return { href: "/compromissos", title: n.noDay(name), detail: amount, urgent: false };
    case "weekly_review":
      return { href: "/progresso", title: n.weeklyReview, detail: null, urgent: false };
  }
}

export function NotificationsBell({ items }: { items: Notification[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={n.label(items.length)}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-muted hover:text-text"
      >
        <Bell className="size-6" aria-hidden />
        {items.length > 0 && (
          <span aria-hidden className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-on-primary">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={n.title}>
        {items.length === 0 ? (
          <p className="py-4 text-sm text-text-2">{n.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item, index) => {
              const { href, title, detail, urgent } = describe(item);
              return (
                <li key={`${item.kind}-${item.name ?? ""}-${index}`}>
                  <Link href={href} onClick={() => setOpen(false)} className="block min-h-14 py-2 hover:bg-muted">
                    <span className={cn("block text-sm font-semibold", urgent && "text-error")}>{title}</span>
                    {detail && <span className="tabular block text-xs text-text-2">{detail}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );
}
