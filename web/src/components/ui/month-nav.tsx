import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, monthLongLabel } from "@/lib/format";
import { t } from "@/i18n";

const arrow = "inline-flex size-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted";

export function MonthNav({
  monthKey,
  start,
  end,
  prevHref,
  nextHref,
}: {
  monthKey: number;
  start: string;
  end: string;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={prevHref} aria-label={t.tx.previousMonth} className={arrow}>
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <div className="text-center">
        <p className="font-bold first-letter:uppercase">{monthLongLabel(monthKey)}</p>
        <p className="text-xs text-text-3">{t.tx.monthRange(formatDate(start), formatDate(end))}</p>
      </div>
      <Link href={nextHref} aria-label={t.tx.nextMonth} className={arrow}>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </div>
  );
}
