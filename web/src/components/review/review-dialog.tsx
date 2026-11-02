"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { saveCheckin, type CheckinInput } from "@/app/actions/review";
import { cn } from "@/lib/cn";
import type { Checkin } from "@/lib/types";
import { t } from "@/i18n";

function previousDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function fromCheckin(day: string, c?: Checkin): CheckinInput {
  return {
    day,
    reviewed: c?.reviewed ?? false,
    noExpenses: c?.no_expenses ?? false,
    paymentsConfirmed: c?.payments_confirmed ?? false,
    budgetChecked: c?.budget_checked ?? false,
    weeklyReview: c?.weekly_review ?? false,
    debtsGoalsReviewed: c?.debts_goals_reviewed ?? false,
    notes: c?.notes ?? "",
  };
}

type BooleanField = "reviewed" | "noExpenses" | "paymentsConfirmed" | "budgetChecked" | "weeklyReview" | "debtsGoalsReviewed";

const fields: { key: BooleanField; label: string }[] = [
  { key: "reviewed", label: t.review.reviewed },
  { key: "noExpenses", label: t.review.noExpenses },
  { key: "paymentsConfirmed", label: t.review.paymentsConfirmed },
  { key: "budgetChecked", label: t.review.budgetChecked },
  { key: "weeklyReview", label: t.review.weeklyReview },
  { key: "debtsGoalsReviewed", label: t.review.debtsGoalsReviewed },
];

function ReviewForm({ checkins, today, onDone }: { checkins: Checkin[]; today: string; onDone: () => void }) {
  const yesterday = previousDay(today);
  const find = (day: string) => checkins.find((c) => c.day === day);
  const [v, setV] = useState<CheckinInput>(fromCheckin(today, find(today)));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ xp: number; unlocked: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveCheckin(v);
      if (result.ok) setSaved({ xp: result.xpChange, unlocked: result.unlocked });
      else setError(result.error);
    });
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-lg font-bold text-success">
          {t.review.savedXp(saved.xp)}
        </p>
        {saved.unlocked.length > 0 && <p className="font-semibold">{t.review.unlocked(saved.unlocked.join(", "))}</p>}
        <Button onClick={onDone}>{t.common.close}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-text-2">{t.review.day}</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { day: today, label: t.review.today },
            { day: yesterday, label: t.review.yesterday },
          ].map(({ day, label }) => (
            <button
              key={day}
              type="button"
              aria-pressed={v.day === day}
              onClick={() => setV(fromCheckin(day, find(day)))}
              className={cn(
                "min-h-11 rounded-[var(--radius-sm)] border text-sm font-semibold",
                v.day === day ? "border-primary bg-primary-pale text-primary" : "border-border bg-card text-text-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col">
        {fields.map(({ key, label }) => (
          <label key={key} className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-[var(--primary)]"
              checked={v[key]}
              onChange={(e) => setV({ ...v, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <Field label={`${t.review.notes} (${t.common.optional})`} htmlFor="review-notes">
        <Input id="review-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} autoComplete="off" />
      </Field>
      {error && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}

export function ReviewDialog({ checkins, today }: { checkins: Checkin[]; today: string }) {
  const [open, setOpen] = useState(false);
  const reviewed = checkins.some((c) => c.day === today && c.reviewed);
  return (
    <>
      <Button variant={reviewed ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {reviewed ? t.review.edit : t.review.open}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.review.title}>
        {open && <ReviewForm checkins={checkins} today={today} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}
