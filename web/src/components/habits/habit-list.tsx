"use client";

import { useOptimistic, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Footer, useSubmit } from "@/components/accounts/forms";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { archiveHabit, saveHabit, toggleHabit, type HabitInput } from "@/app/actions/habits";
import { cn } from "@/lib/cn";
import type { HabitOverview } from "@/lib/types";
import { t } from "@/i18n";

const REVEAL = 88;

function HabitForm({ habit, onDone }: { habit?: HabitOverview; onDone: () => void }) {
  const [v, setV] = useState<HabitInput>({
    id: habit?.habit_id,
    name: habit?.name ?? "",
    emoji: habit?.emoji ?? "",
    frequency: habit?.frequency_type ?? "daily",
    weekdays: habit?.weekdays ?? [],
    timesPerWeek: String(habit?.target_per_period ?? 3),
    time: habit?.time_of_day?.slice(0, 5) ?? "",
  });
  const { error, pending, run, fieldError } = useSubmit(onDone);
  const isSystem = Boolean(habit?.system_key);

  function toggleDay(day: number) {
    setV((cur) => ({
      ...cur,
      weekdays: cur.weekdays.includes(day) ? cur.weekdays.filter((d) => d !== day) : [...cur.weekdays, day],
    }));
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveHabit(v));
      }}
    >
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field label={t.habits.name} htmlFor="habit-name" error={fieldError("name")}>
          <Input id="habit-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="off" />
        </Field>
        <Field label={t.habits.emoji} htmlFor="habit-emoji">
          <Input id="habit-emoji" value={v.emoji} onChange={(e) => setV({ ...v, emoji: e.target.value })} autoComplete="off" placeholder="✅" />
        </Field>
      </div>
      {!isSystem && (
        <Field label={t.habits.frequency} htmlFor="habit-frequency">
          <Select id="habit-frequency" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as HabitInput["frequency"] })}>
            <option value="daily">{t.habits.daily}</option>
            <option value="specific_days">{t.habits.specific}</option>
            <option value="weekly">{t.habits.weekly}</option>
          </Select>
        </Field>
      )}
      {v.frequency === "specific_days" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-text-2">{t.habits.weekdaysLabel}</legend>
          <div className="flex flex-wrap gap-1.5">
            {t.habits.weekdayOrder.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={v.weekdays.includes(day)}
                onClick={() => toggleDay(day)}
                className={cn(
                  "size-11 rounded-full border text-xs font-semibold",
                  v.weekdays.includes(day) ? "border-primary bg-primary-pale text-primary" : "border-border bg-card text-text-2",
                )}
              >
                {t.habits.weekdayNames[day]}
              </button>
            ))}
          </div>
          {fieldError("weekdays") && (
            <p role="alert" className="mt-1 text-xs font-medium text-error">
              {fieldError("weekdays")}
            </p>
          )}
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        {v.frequency === "weekly" && (
          <Field label={t.habits.timesPerWeek} htmlFor="habit-times" error={fieldError("times")}>
            <Input id="habit-times" inputMode="numeric" value={v.timesPerWeek} onChange={(e) => setV({ ...v, timesPerWeek: e.target.value })} />
          </Field>
        )}
        <Field label={`${t.habits.timeOfDay} (${t.common.optional})`} htmlFor="habit-time">
          <Input id="habit-time" type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
        </Field>
      </div>
      <Footer
        pending={pending}
        error={error}
        onDelete={
          habit && !isSystem
            ? () => {
                if (window.confirm(t.habits.archiveConfirm)) run(() => archiveHabit(habit.habit_id));
              }
            : undefined
        }
      />
    </form>
  );
}

function HabitCard({ habit, onEdit }: { habit: HabitOverview; onEdit: () => void }) {
  const [done, setDone] = useOptimistic(habit.done_today);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; y: number; start: number; active: boolean } | null>(null);
  const isSystem = Boolean(habit.system_key);

  function toggle() {
    const next = !done;
    setError(null);
    startTransition(async () => {
      setDone(next);
      const result = await toggleHabit(habit.habit_id, next);
      if (!result.ok) setError(result.error);
    });
  }

  function archive() {
    if (!window.confirm(t.habits.archiveConfirm)) {
      setOffset(0);
      return;
    }
    startTransition(async () => {
      const result = await archiveHabit(habit.habit_id);
      if (!result.ok) setError(result.error);
    });
  }

  // Swipe left reveals delete. The system habit cannot be deleted, so it does not swipe.
  function onPointerDown(e: ReactPointerEvent) {
    if (isSystem || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, start: offset, active: false };
  }
  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.active) {
      if (Math.abs(e.clientY - d.y) > 10) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < 8) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setOffset(Math.min(0, Math.max(-REVEAL, d.start + dx)));
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d?.active) setOffset((cur) => (cur < -REVEAL / 2 ? -REVEAL : 0));
  }

  const unit = habit.streak_unit === "weeks" ? t.progress.weeks(habit.current_streak) : t.progress.days(habit.current_streak);

  return (
    <li className="relative overflow-hidden rounded-[var(--radius-md)]">
      {!isSystem && offset < 0 && (
        <button
          type="button"
          onClick={archive}
          className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-1 bg-error text-xs font-semibold text-on-primary"
        >
          <Trash2 className="size-5" aria-hidden />
          {t.habits.archive}
        </button>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        className="relative flex min-h-18 items-center gap-3 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 transition-transform"
      >
        <button
          type="button"
          onClick={toggle}
          aria-pressed={done}
          aria-label={done ? t.habits.unmark(habit.name) : t.habits.markDone(habit.name)}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border-2",
            done ? "border-primary bg-primary text-on-primary" : "border-border text-transparent hover:border-primary",
          )}
        >
          <Check className="size-6" aria-hidden />
        </button>
        <span aria-hidden className="text-2xl">
          {habit.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold", done && "text-text-3 line-through")}>{habit.name}</p>
          <p className="text-xs text-text-2">
            🔥 {unit}
            {habit.frequency_type === "weekly" && ` · ${t.habits.times(habit.done_this_week, habit.target_per_period)}`}
            {habit.time_of_day && ` · ${habit.time_of_day.slice(0, 5)}`}
          </p>
          {isSystem && <p className="text-xs text-text-3">{t.habits.system}</p>}
          {error && (
            <p role="alert" className="text-xs font-medium text-error">
              {error}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`${t.common.edit} ${habit.name}`}>
          <Pencil className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

export function HabitList({ habits }: { habits: HabitOverview[] }) {
  const [editing, setEditing] = useState<{ habit?: HabitOverview } | null>(null);
  const today = habits.filter((h) => h.scheduled_today);
  const others = habits.filter((h) => !h.scheduled_today);
  const close = () => setEditing(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t.habits.title}</h1>
        <Button variant="secondary" size="sm" onClick={() => setEditing({})}>
          <Plus className="size-4" aria-hidden /> {t.habits.newHabit}
        </Button>
      </div>
      {habits.length === 0 && <p className="text-sm text-text-2">{t.habits.empty}</p>}
      {today.length > 0 && (
        <section aria-labelledby="habits-today">
          <h2 id="habits-today" className="mb-2 font-bold">
            {t.habits.today}
          </h2>
          <ul className="flex flex-col gap-2">
            {today.map((h) => (
              <HabitCard key={h.habit_id} habit={h} onEdit={() => setEditing({ habit: h })} />
            ))}
          </ul>
        </section>
      )}
      {others.length > 0 && (
        <section aria-labelledby="habits-others">
          <h2 id="habits-others" className="mb-2 font-bold">
            {t.habits.others}
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map((h) => (
              <HabitCard key={h.habit_id} habit={h} onEdit={() => setEditing({ habit: h })} />
            ))}
          </ul>
        </section>
      )}
      {habits.length > 0 && <p className="text-xs text-text-3">{t.habits.swipeHint}</p>}
      <Dialog open={editing !== null} onClose={close} title={editing?.habit ? t.habits.editHabit : t.habits.newHabit}>
        {editing && <HabitForm habit={editing.habit} onDone={close} />}
      </Dialog>
    </div>
  );
}
