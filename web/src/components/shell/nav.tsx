"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListOrdered, LogOut, Plus, Wallet, type LucideIcon } from "lucide-react";
import { useTxForm } from "@/components/transactions/tx-form-provider";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

type Item = { href: string; label: string; icon: LucideIcon };

const items: Item[] = [
  { href: "/", label: t.nav.home, icon: Home },
  { href: "/movimentos", label: t.nav.transactions, icon: ListOrdered },
  { href: "/contas", label: t.nav.accounts, icon: Wallet },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const { openNew, ready } = useTxForm();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-2 border-r border-border bg-card px-3 py-6 md:flex">
      <p className="px-3 pb-4 text-2xl font-extrabold tracking-tight text-primary">{t.app.name}</p>
      {ready && (
        <button
          type="button"
          onClick={() => openNew()}
          className="mb-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-mid"
        >
          <Plus className="size-5" aria-hidden /> {t.nav.add}
        </button>
      )}
      <nav aria-label={t.nav.main} className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-semibold",
              isActive(pathname, href) ? "bg-primary-pale text-primary" : "text-text-2 hover:bg-muted hover:text-text",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <form action={signOut} className="mt-auto">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-text-2 hover:bg-muted hover:text-text"
        >
          <LogOut className="size-5" aria-hidden /> {t.nav.signOut}
        </button>
      </form>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { openNew, ready } = useTxForm();
  const [first, ...rest] = items;
  const renderLink = ({ href, label, icon: Icon }: Item) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive(pathname, href) ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
        isActive(pathname, href) ? "text-primary" : "text-text-3",
      )}
    >
      <Icon className="size-6" aria-hidden />
      {label}
    </Link>
  );
  return (
    <nav
      aria-label={t.nav.main}
      className="fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {renderLink(first)}
      {ready && (
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => openNew()}
            aria-label={t.nav.add}
            className="-mt-6 inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg hover:bg-primary-mid"
          >
            <Plus className="size-7" aria-hidden />
          </button>
        </div>
      )}
      {rest.map(renderLink)}
    </nav>
  );
}
