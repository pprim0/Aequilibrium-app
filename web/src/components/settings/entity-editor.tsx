"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Footer, useSubmit } from "@/components/accounts/forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { deleteEntity, saveEntity } from "@/app/actions/settings";
import { amountToInput, formatDate, formatMoney, keyToMonthInput, monthLabel } from "@/lib/format";
import { findEntity, type FieldDef, type OptionSource } from "@/lib/settings-entities";
import { t } from "@/i18n";

export type EntityOptions = Record<OptionSource, { value: string; label: string }[]>;
type RowData = Record<string, unknown>;

function toInput(field: FieldDef, value: unknown): string | boolean {
  if (field.type === "bool") return value === true;
  if (value === null || value === undefined) return "";
  switch (field.type) {
    case "money":
      return amountToInput(value as number);
    case "percent":
      return String(Math.round(Number(value) * 10000) / 100).replace(".", ",");
    case "month":
      return keyToMonthInput(Number(value));
    default:
      return String(value);
  }
}

function display(field: FieldDef, value: unknown, options: EntityOptions): string | null {
  if (field.type === "bool") return value === true ? field.label : null;
  if (value === null || value === undefined || value === "") return null;
  switch (field.type) {
    case "money":
      return formatMoney(value as number);
    case "percent":
      return `${Math.round(Number(value) * 10000) / 100}%`;
    case "month":
      return monthLabel(Number(value));
    case "date":
      return formatDate(String(value));
    case "select":
      return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case "ref":
      return options[field.source!]?.find((o) => o.value === value)?.label ?? null;
    default:
      return String(value);
  }
}

function EntityForm({
  entityKey,
  row,
  options,
  onDone,
}: {
  entityKey: string;
  row: RowData | null;
  options: EntityOptions;
  onDone: () => void;
}) {
  const entity = findEntity(entityKey)!;
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial = Object.fromEntries(entity.fields.map((field) => [field.key, toInput(field, row?.[field.key])]));
    // A new row starts on the first option of a required select, and active.
    for (const field of entity.fields) {
      if (!row && field.type === "select" && field.required && field.options?.length) initial[field.key] = field.options[0].value;
      if (!row && field.key === "is_active") initial[field.key] = true;
    }
    return initial;
  });
  const { error, pending, run, fieldError } = useSubmit(onDone);
  const set = (key: string, value: string | boolean) => setValues((cur) => ({ ...cur, [key]: value }));
  const id = (key: string) => `entity-${key}`;

  const remove = () => {
    if (!row) return;
    if (window.confirm(entity.deleteWarning ?? t.common.confirmDelete)) run(() => deleteEntity(entity.key, String(row.id)));
  };

  const visible = entity.fields.filter((field) => !field.hidden?.(values));
  const advanced = visible.filter((field) => field.advanced);
  const renderField = (field: FieldDef) => {
          if (field.type === "bool") {
            return (
              <label key={field.key} className="flex min-h-11 items-center gap-3 text-sm font-semibold text-text-2">
                <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={values[field.key] === true} onChange={(e) => set(field.key, e.target.checked)} />
                {field.label}
              </label>
            );
          }
          const value = values[field.key] as string;
          const common = {
            id: id(field.key),
            value,
            "aria-invalid": Boolean(fieldError(field.key)),
          };
          return (
            <Field key={field.key} label={field.required ? field.label : `${field.label} (${t.common.optional})`} htmlFor={id(field.key)} hint={field.hint} error={fieldError(field.key)}>
              {field.type === "select" || field.type === "ref" ? (
                <Select {...common} onChange={(e) => set(field.key, e.target.value)}>
                  {field.type === "ref" && <option value="">—</option>}
                  {(field.type === "select" ? field.options! : options[field.source!]).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  {...common}
                  autoComplete="off"
                  type={field.type === "date" ? "date" : field.type === "month" ? "month" : "text"}
                  inputMode={field.type === "money" || field.type === "percent" ? "decimal" : field.type === "int" ? "numeric" : undefined}
                  className={field.type === "money" || field.type === "percent" || field.type === "int" ? "tabular" : undefined}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
            </Field>
          );
  };

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveEntity(entity.key, row ? String(row.id) : null, values));
      }}
    >
      {visible.filter((field) => !field.advanced).map(renderField)}
      {advanced.length > 0 && (
        <details open={advanced.some((field) => fieldError(field.key))} className="rounded-[var(--radius-sm)] border border-border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t.settings.moreOptions}</summary>
          <div className="flex flex-col gap-4 pb-3">{advanced.map(renderField)}</div>
        </details>
      )}
      <Footer pending={pending} error={error} onDelete={row && entity.canDelete ? remove : undefined} />
    </form>
  );
}

export function EntityEditor({ entityKey, rows, options }: { entityKey: string; rows: RowData[]; options: EntityOptions }) {
  const entity = findEntity(entityKey)!;
  const [editing, setEditing] = useState<{ row: RowData | null } | null>(null);
  const titleField = entity.fields.find((field) => field.key === entity.titleField)!;
  const close = () => setEditing(null);

  const total = entity.key === "regra" ? rows.reduce((sum, r) => sum + Number(r.pct), 0) : null;

  return (
    <div className="flex flex-col gap-4">
      {entity.canCreate && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setEditing({ row: null })}>
            <Plus className="size-4" aria-hidden /> {t.settings.add}
          </Button>
        </div>
      )}
      {total !== null && rows.length > 0 && (
        <p className={Math.round(total * 10000) === 10000 ? "tabular text-sm font-semibold text-success" : "tabular text-sm font-semibold text-warning"}>
          {t.settings.ruleTotal(`${Math.round(total * 10000) / 100}%`)}
          {Math.round(total * 10000) !== 10000 && ` · ${t.settings.ruleTotalWrong}`}
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState>{t.settings.empty}</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
          {rows.map((row) => {
            const title = display(titleField, row[entity.titleField], options) ?? "—";
            const summary = entity.fields
              .filter((field) => field.key !== entity.titleField && !field.hidden?.(row) && field.key !== "emoji")
              .map((field) => display(field, row[field.key], options))
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={String(row.id)} className="flex min-h-16 items-center gap-2 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {typeof row.emoji === "string" && row.emoji ? `${row.emoji} ` : ""}
                    {title}
                  </p>
                  {summary && <p className="text-xs break-words text-text-2">{summary}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing({ row })} aria-label={t.settings.editTitle(title)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={editing !== null} onClose={close} title={editing?.row ? t.settings.editTitle(display(titleField, editing.row[entity.titleField], options) ?? "") : t.settings.newTitle}>
        {editing && <EntityForm entityKey={entity.key} row={editing.row} options={options} onDone={close} />}
      </Dialog>
    </div>
  );
}
