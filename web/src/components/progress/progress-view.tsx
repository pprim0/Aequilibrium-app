import { Card, SectionTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ReviewDialog } from "@/components/review/review-dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AchievementStatus, BudgetTrack, CalendarDay, Checkin, DebtOverview, Gamification } from "@/lib/types";
import { t } from "@/i18n";

function ActivityCalendar({ days, today }: { days: CalendarDay[]; today: string }) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const [year, month] = today.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: total }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-3" aria-hidden>
        {t.progress.weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ul className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden />
        ))}
        {cells.map((iso) => {
          const d = byDay.get(iso);
          const dayNumber = Number(iso.slice(8));
          const state = d?.reviewed ? t.progress.legendReviewed : d?.is_rest ? t.progress.legendRest : "";
          return (
            <li
              key={iso}
              aria-label={`${formatDate(iso)}${state ? ` ${state}` : ""}`}
              className={cn(
                "tabular flex aspect-square flex-col items-center justify-center rounded-[var(--radius-sm)] text-xs",
                d?.reviewed ? "bg-primary font-bold text-on-primary" : d?.is_rest ? "bg-primary-pale text-primary" : "bg-muted text-text-3",
                iso === today && "ring-2 ring-text",
              )}
            >
              <span>{dayNumber}</span>
              <span aria-hidden className="h-3 leading-3">
                {d?.reviewed ? "✓" : d?.is_rest ? "·" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-text-2">
        <span>{t.progress.legendReviewed}</span>
        <span>{t.progress.legendRest}</span>
        <span>{t.progress.legendToday}</span>
      </p>
    </div>
  );
}

export function ProgressView({
  overview,
  achievements,
  debts,
  budgetTrack,
  calendar,
  checkins,
  today,
}: {
  overview: Gamification;
  achievements: AchievementStatus[];
  debts: DebtOverview;
  budgetTrack: BudgetTrack;
  calendar: CalendarDay[];
  checkins: Checkin[];
  today: string;
}) {
  const unlocked = achievements.filter((a) => a.unlocked_on).sort((a, b) => (b.unlocked_on ?? "").localeCompare(a.unlocked_on ?? ""));
  const locked = achievements.filter((a) => !a.unlocked_on);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold">{t.progress.title}</h1>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-2 bg-primary-pale">
          <h2 className="font-bold">{t.progress.debtPaid}</h2>
          <p className="tabular text-3xl font-extrabold">{formatMoney(debts.paid)}</p>
          {debts.progress !== null && <Meter value={Number(debts.progress)} label={t.progress.debtPaid} />}
          <p className="tabular text-sm text-text-2">{Number(debts.outstanding) > 0 ? t.progress.debtLeft(formatMoney(debts.outstanding)) : t.debts.noDebtsTotal}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">{t.progress.withinBudget}</h2>
          {budgetTrack.total > 0 ? (
            <>
              <p className="tabular text-3xl font-extrabold">{t.progress.monthsOf(budgetTrack.within, budgetTrack.total)}</p>
              <p className="text-sm text-text-2">{t.progress.monthsInARow(budgetTrack.streak)}</p>
            </>
          ) : (
            <p className="text-sm text-text-2">{t.progress.noFinishedMonths}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">{t.progress.reviews}</h2>
          <p className="tabular text-3xl font-extrabold">{t.progress.days(overview.streak)}</p>
          <p className="text-sm text-text-2">
            {t.progress.bestStreak(t.progress.days(overview.best_streak))} · {t.progress.daysMonth(overview.days_reviewed_month, overview.days_elapsed_month)}
          </p>
          <div>
            <ReviewDialog checkins={checkins} today={today} />
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="sec-achievements">
          <SectionTitle>
            <span id="sec-achievements">{t.progress.achievements}</span>
          </SectionTitle>
          <Card className="py-1">
            <ul className="divide-y divide-border">
              {[...unlocked, ...locked].map((a) => (
                <li key={a.achievement_id} className={cn("py-2", !a.unlocked_on && "opacity-60")}>
                  <p className="text-sm font-semibold">
                    {a.unlocked_on ? "✓" : "○"} {a.name}
                  </p>
                  <p className="text-xs text-text-2">{a.unlocked_on ? t.progress.unlockedOn(formatDate(a.unlocked_on)) : a.description}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
        <section aria-labelledby="sec-calendar">
          <SectionTitle>
            <span id="sec-calendar">{t.progress.calendar}</span>
          </SectionTitle>
          <Card>
            <ActivityCalendar days={calendar} today={today} />
          </Card>
        </section>
      </div>
    </div>
  );
}
