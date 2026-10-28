"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { deleteTransaction, saveTransaction, type TxInput } from "@/app/actions/transactions";
import { amountToInput, formatMoney, parseAmount } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TX_TYPES, TYPES_WITH_DESTINATION, type Category, type Lookups, type Shortcut, type Transaction } from "@/lib/types";
import { t } from "@/i18n";

type Line = { categoryId: string; amount: string };

// Order in the category picker: what is registered most often first.
const KIND_ORDER = ["expense", "income", "debt_payment", "saving", "transfer", "investment"];

function CategoryOptions({ categories }: { categories: Category[] }) {
  return (
    <>
      <option value="">{t.tx.chooseCategory}</option>
      {KIND_ORDER.filter((kind) => TX_TYPES.includes(kind as never)).map((kind) => {
        const list = categories.filter((c) => c.kind === kind);
        if (list.length === 0) return null;
        return (
          <optgroup key={kind} label={t.types[kind]}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ""}
                {c.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

export function TransactionForm({
  lookups,
  editing,
  onDone,
}: {
  lookups: Lookups;
  editing: Transaction | null;
  onDone: () => void;
}) {
  const { accounts, categories, paymentMethods, shortcuts, settings, today } = lookups;
  const activeAccounts = accounts.filter((a) => !a.is_archived || a.id === editing?.account_id || a.id === editing?.to_account_id);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const methodById = useMemo(() => new Map(paymentMethods.map((m) => [m.id, m])), [paymentMethods]);

  const [date, setDate] = useState(editing?.date ?? today);
  const [shortcutId, setShortcutId] = useState(editing?.shortcut_id ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [methodId, setMethodId] = useState(editing?.payment_method_id ?? "");
  const [accountId, setAccountId] = useState(editing?.account_id ?? settings?.default_account_id ?? "");
  const [toAccountId, setToAccountId] = useState(editing?.to_account_id ?? "");
  const [recurringId, setRecurringId] = useState(editing?.recurring_id ?? "");
  const [usualAmount, setUsualAmount] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { categoryId: editing?.category_id ?? "", amount: editing ? amountToInput(editing.amount) : "" },
  ]);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const kinds = lines.map((l) => categoryById.get(l.categoryId)?.kind).filter(Boolean);
  const needsDestination = kinds.some((k) => TYPES_WITH_DESTINATION.includes(k!));
  const isCreditPurchase = kinds.includes("expense") && accountById.get(accountId)?.type === "credit";
  const total = lines.reduce((sum, l) => sum + (parseAmount(l.amount) ?? 0), 0);

  function setLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    if (patch.categoryId !== undefined) {
      const category = categoryById.get(patch.categoryId);
      if (category?.default_to_account_id && TYPES_WITH_DESTINATION.includes(category.kind)) {
        setToAccountId(category.default_to_account_id);
      }
    }
  }

  function applyShortcut(sc: Shortcut) {
    setShortcutId(sc.id);
    setDescription(sc.description ?? sc.name);
    setRecurringId(sc.recurring_id ?? "");
    setUsualAmount(sc.usual_amount != null ? formatMoney(sc.usual_amount) : null);
    if (sc.payment_method_id) setMethodId(sc.payment_method_id);
    const method = sc.payment_method_id ? methodById.get(sc.payment_method_id) : undefined;
    setAccountId(sc.account_id ?? method?.account_id ?? settings?.default_account_id ?? "");
    if (sc.category_id) setLine(0, { categoryId: sc.category_id });
  }

  function changeMethod(id: string) {
    setMethodId(id);
    const method = methodById.get(id);
    if (method?.account_id) setAccountId(method.account_id);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const payload: TxInput = {
      id: editing?.id,
      date,
      description,
      note,
      paymentMethodId: methodId,
      accountId,
      toAccountId: needsDestination ? toAccountId : "",
      shortcutId,
      recurringId,
      lines,
    };
    startTransition(async () => {
      const result = await saveTransaction(payload);
      if (result.ok) onDone();
      else setError({ message: result.error, field: result.field });
    });
  }

  function remove() {
    if (!editing || !window.confirm(t.common.confirmDelete)) return;
    startTransition(async () => {
      const result = await deleteTransaction(editing.id);
      if (result.ok) onDone();
      else setError({ message: result.error });
    });
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!editing && shortcuts.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-text-2">{t.tx.shortcuts}</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {shortcuts.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => applyShortcut(sc)}
                aria-pressed={shortcutId === sc.id}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold",
                  shortcutId === sc.id ? "border-primary bg-primary-pale text-primary" : "border-border bg-card text-text-2",
                )}
              >
                {sc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {lines.map((line, i) => (
        <div key={i} className={cn("grid gap-3", split && "rounded-[var(--radius-sm)] border border-border p-3")}>
          <Field
            label={split ? `${t.tx.amount} ${i + 1}` : t.tx.amount}
            htmlFor={`amount-${i}`}
            error={fieldError(`amount-${i}`)}
            hint={i === 0 && usualAmount ? t.tx.usualAmount(usualAmount) : undefined}
          >
            <Input
              id={`amount-${i}`}
              inputMode="decimal"
              autoComplete="off"
              placeholder={t.tx.amountPlaceholder}
              value={line.amount}
              onChange={(e) => setLine(i, { amount: e.target.value })}
              aria-invalid={Boolean(fieldError(`amount-${i}`))}
              className="tabular text-2xl font-bold"
              autoFocus={i === 0 && !editing}
            />
          </Field>
          <Field label={t.tx.category} htmlFor={`category-${i}`} error={fieldError(`category-${i}`)}>
            <Select
              id={`category-${i}`}
              value={line.categoryId}
              onChange={(e) => setLine(i, { categoryId: e.target.value })}
              aria-invalid={Boolean(fieldError(`category-${i}`))}
            >
              <CategoryOptions categories={categories} />
            </Select>
          </Field>
          {split && lines.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="justify-self-start">
              <Trash2 className="size-4" aria-hidden /> {t.tx.removePart}
            </Button>
          )}
        </div>
      ))}

      {!editing && (
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-text-2">
            <input
              type="checkbox"
              className="size-5 accent-[var(--primary)]"
              checked={split}
              onChange={(e) => {
                setSplit(e.target.checked);
                if (!e.target.checked) setLines((ls) => ls.slice(0, 1));
              }}
            />
            {t.tx.split}
          </label>
          {split && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-3">{t.tx.splitHint}</p>
              <p className="tabular text-sm font-semibold">{t.tx.splitTotal(formatMoney(total))}</p>
              <Button variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, { categoryId: "", amount: "" }])}>
                <Plus className="size-4" aria-hidden /> {t.tx.addPart}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.tx.date} htmlFor="date" error={fieldError("date")}>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label={t.tx.paymentMethod} htmlFor="method">
          <Select id="method" value={methodId} onChange={(e) => changeMethod(e.target.value)}>
            <option value="">{t.tx.noMethod}</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className={cn("grid gap-3", needsDestination && "grid-cols-2")}>
        <Field label={t.tx.account} htmlFor="account">
          <Select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        {needsDestination && (
          <Field label={t.tx.toAccount} htmlFor="toAccount" error={fieldError("toAccount")}>
            <Select id="toAccount" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">—</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {isCreditPurchase && <p className="rounded-[var(--radius-sm)] bg-info-pale px-3 py-2 text-xs text-info">{t.tx.creditHint}</p>}

      <Field label={t.tx.description} htmlFor="description">
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
      </Field>
      <Field label={`${t.tx.note} (${t.common.optional})`} htmlFor="note">
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
      </Field>

      {error && !error.field?.startsWith("amount") && !error.field?.startsWith("category") && error.field !== "toAccount" && error.field !== "date" && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
          {error.message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-card px-4 pt-3">
        {editing && (
          <Button variant="danger" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" aria-hidden /> {t.common.delete}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </div>
    </form>
  );
}
