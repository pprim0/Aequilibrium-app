"use client";

import { useState } from "react";
import { useSubmit, Footer } from "@/components/accounts/forms";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { saveSettings } from "@/app/actions/settings";
import type { SettingsInput } from "@/lib/settings-entities";
import { t } from "@/i18n";

const f = t.settings.fields;
const pct = (v: unknown) => String(Math.round(Number(v) * 10000) / 100).replace(".", ",");

export function GeneralForm({ settings, accounts }: { settings: Record<string, unknown>; accounts: { value: string; label: string }[] }) {
  const thresholds = (settings.alert_thresholds as number[]) ?? [0.7, 0.9, 1];
  const [v, setV] = useState<SettingsInput>({
    financial_month_start_day: String(settings.financial_month_start_day ?? 1),
    default_account_id: String(settings.default_account_id ?? ""),
    alert_1: pct(thresholds[0]),
    alert_2: pct(thresholds[1]),
    alert_3: pct(thresholds[2]),
    tracking_start_date: String(settings.tracking_start_date ?? ""),
    rest_days_per_week: String(settings.rest_days_per_week ?? 1),
    min_review_days_week: String(settings.min_review_days_week ?? 5),
    min_review_days_month: String(settings.min_review_days_month ?? 15),
    min_days_for_projection: String(settings.min_days_for_projection ?? 7),
    free_to_spend_mode: String(settings.free_to_spend_mode ?? "actual"),
    show_habits: settings.show_habits === true,
  });
  const [saved, setSaved] = useState(false);
  const { error, pending, run, fieldError } = useSubmit(() => setSaved(true));
  const set = (key: Exclude<keyof SettingsInput, "show_habits">) => (e: { target: { value: string } }) => {
    setSaved(false);
    setV({ ...v, [key]: e.target.value });
  };
  const number = (key: Exclude<keyof SettingsInput, "show_habits">, label: string, hint?: string) => (
    <Field label={label} htmlFor={key} hint={hint} error={fieldError(key)}>
      <Input id={key} inputMode="numeric" value={v[key]} onChange={set(key)} className="tabular" />
    </Field>
  );

  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          run(() => saveSettings(v));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {number("financial_month_start_day", f.monthStartDay, t.settings.hints.monthStart)}
          <Field label={f.defaultAccount} htmlFor="default_account_id" error={fieldError("default_account_id")}>
            <Select id="default_account_id" value={v.default_account_id} onChange={set("default_account_id")}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.freeMode} htmlFor="free_to_spend_mode" error={fieldError("free_to_spend_mode")}>
            <Select id="free_to_spend_mode" value={v.free_to_spend_mode} onChange={set("free_to_spend_mode")}>
              <option value="actual">{t.settings.freeModes.actual}</option>
              <option value="projected">{t.settings.freeModes.projected}</option>
            </Select>
          </Field>
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
            checked={v.show_habits}
            onChange={(e) => {
              setSaved(false);
              setV({ ...v, show_habits: e.target.checked });
            }}
          />
          <span>
            {t.settings.showHabits}
            <span className="block text-xs font-normal text-text-2">{t.settings.showHabitsHint}</span>
          </span>
        </label>
        <details
          open={["tracking_start_date", "alert_1", "rest_days_per_week", "min_review_days_week", "min_review_days_month", "min_days_for_projection"].some((key) => fieldError(key))}
          className="rounded-[var(--radius-sm)] border border-border px-3"
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.settings.moreOptions}</summary>
          <div className="flex flex-col gap-4 pb-3">
        <Field label={f.trackingStart} htmlFor="tracking_start_date" error={fieldError("tracking_start_date")}>
          <Input id="tracking_start_date" type="date" value={v.tracking_start_date} onChange={set("tracking_start_date")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={f.alert1} htmlFor="alert_1" error={fieldError("alert_1")}>
            <Input id="alert_1" inputMode="decimal" value={v.alert_1} onChange={set("alert_1")} className="tabular" />
          </Field>
          <Field label={f.alert2} htmlFor="alert_2">
            <Input id="alert_2" inputMode="decimal" value={v.alert_2} onChange={set("alert_2")} className="tabular" />
          </Field>
          <Field label={f.alert3} htmlFor="alert_3">
            <Input id="alert_3" inputMode="decimal" value={v.alert_3} onChange={set("alert_3")} className="tabular" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {number("rest_days_per_week", f.restDays)}
          {number("min_review_days_week", f.minWeek)}
          {number("min_review_days_month", f.minMonth)}
          {number("min_days_for_projection", f.minProjection)}
        </div>
          </div>
        </details>
        {saved && (
          <p role="status" className="text-sm font-semibold text-success">
            {t.settings.savedOk}
          </p>
        )}
        <Footer pending={pending} error={error} />
      </form>
    </Card>
  );
}
