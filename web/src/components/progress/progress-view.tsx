import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ReviewDialog } from "@/components/review/review-dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AchievementStatus, CalendarDay, Checkin, Gamification, MissionStatus } from "@/lib/types";
import { t } from "@/i18n";

function MissionRow({ mission }: { mission: MissionStatus }) {
  const current = Number(mission.current_value);
  const target = Number(mission.target_value);
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", mission.done && "text-text-3")}>
          {mission.done ? "✓" : "○"} {mission.name}
        </p>
        {!mission.done && mission.kind === "days_reviewed_week" && <p className="tabular text-xs text-text-2">{t.progress.daysOf(current, target)}</p>}
        {!mission.done && mission.kind === "group_weekly_pace" && (
          <>
            <p className="tabular text-xs text-text-2">{t.progress.pace(formatMoney(current), formatMoney(target))}</p>
            <p className="text-xs text-text-3">{t.progress.paceHint}</p>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={mission.done ? "success" : "neutral"}>{mission.done ? t.progress.missionDone : t.progress.missionPending}</Badge>
        <span className="tabular text-xs text-text-3">+{mission.xp} XP</span>
      </div>
    </li>
  );
}

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
  missions,
  achievements,
  calendar,
  checkins,
  today,
}: {
  overview: Gamification;
  missions: MissionStatus[];
  achievements: AchievementStatus[];
  calendar: CalendarDay[];
  checkins: Checkin[];
  today: string;
}) {
  const dayMissions = missions.filter((m) => m.period === "day");
  const weekMissions = missions.filter((m) => m.period === "week");
  const sources = overview.xp_by_source;
  const maxSource = Math.max(0, ...sources.map((s) => s.xp));
  const unlocked = achievements.filter((a) => a.unlocked_on).sort((a, b) => (b.unlocked_on ?? "").localeCompare(a.unlocked_on ?? ""));
  const locked = achievements.filter((a) => !a.unlocked_on);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold">{t.progress.title}</h1>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2 bg-primary-pale">
          <h2 className="text-xl font-extrabold">{overview.level !== null ? t.progress.levelName(overview.level, overview.level_name ?? "") : t.progress.title}</h2>
          <p className="tabular text-3xl font-extrabold">{t.progress.xpTotal(overview.xp_total)}</p>
          <Meter value={Number(overview.level_progress)} label={t.progress.title} />
          <p className="text-sm text-text-2">
            {overview.xp_to_next !== null ? t.progress.xpToNext(overview.xp_to_next, overview.next_level_name ?? "") : t.progress.maxLevel}
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">{t.progress.streak}</h2>
          <p className="tabular text-3xl font-extrabold">🔥 {t.progress.days(overview.streak)}</p>
          <p className="text-sm text-text-2">
            {t.progress.bestStreak(t.progress.days(overview.best_streak))} · {t.progress.daysMonth(overview.days_reviewed_month, overview.days_elapsed_month)}
          </p>
          <p className={cn("text-sm font-semibold", overview.reviewed_today ? "text-success" : "text-warning")}>
            {overview.reviewed_today ? t.review.doneToday : t.review.pendingToday}
          </p>
          <div>
            <ReviewDialog checkins={checkins} today={today} />
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="sec-today">
          <SectionTitle>
            <span id="sec-today">{t.progress.missionsToday}</span>
          </SectionTitle>
          <Card className="py-1">
            <ul className="divide-y divide-border">
              {dayMissions.map((m) => (
                <MissionRow key={m.mission_id} mission={m} />
              ))}
            </ul>
          </Card>
        </section>
        <section aria-labelledby="sec-week">
          <SectionTitle>
            <span id="sec-week">{t.progress.missionsWeek}</span>
          </SectionTitle>
          <Card className="py-1">
            <ul className="divide-y divide-border">
              {weekMissions.map((m) => (
                <MissionRow key={m.mission_id} mission={m} />
              ))}
            </ul>
          </Card>
        </section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="sec-calendar">
          <SectionTitle>
            <span id="sec-calendar">{t.progress.calendar}</span>
          </SectionTitle>
          <Card>
            <ActivityCalendar days={calendar} today={today} />
          </Card>
        </section>
        <section aria-labelledby="sec-sources">
          <SectionTitle>
            <span id="sec-sources">{t.progress.xpSources}</span>
          </SectionTitle>
          <Card>
            {sources.length === 0 ? (
              <p className="text-sm text-text-2">{t.progress.noXp}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {sources.map((s) => (
                  <li key={s.source ?? "achievements"}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">{s.source ?? t.progress.achievementsSource}</span>
                      <span className="tabular shrink-0 font-semibold">{s.xp} XP</span>
                    </div>
                    <div className="mt-1 h-1.5" aria-hidden>
                      <div className="h-full rounded-r-[4px] bg-series-1" style={{ width: `${maxSource > 0 ? (s.xp / maxSource) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <section aria-labelledby="sec-achievements">
        <SectionTitle>
          <span id="sec-achievements">{t.progress.achievements}</span>
        </SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...unlocked, ...locked].map((a) => (
            <li key={a.achievement_id}>
              <Card className={cn("flex h-full flex-col gap-1 py-3", !a.unlocked_on && "opacity-60")}>
                <p className="font-bold">
                  {a.unlocked_on ? "🏅" : "🔒"} {a.name}
                </p>
                {a.description && <p className="text-xs text-text-2">{a.description}</p>}
                <p className="tabular mt-auto text-xs text-text-3">
                  +{a.xp} XP · {a.unlocked_on ? t.progress.unlockedOn(formatDate(a.unlocked_on)) : t.progress.locked}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
