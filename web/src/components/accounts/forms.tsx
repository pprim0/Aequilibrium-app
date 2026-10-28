"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import {
  deleteAccount,
  deleteInstallment,
  deleteRecurring,
  saveAccount,
  saveInstallment,
  saveRecurring,
  type AccountInput,
  type InstallmentInput,
  type RecurringInput,
} from "@/app/actions/accounts";
import { amountToInput, keyToMonthInput } from "@/lib/format";
import {
  ACCOUNT_TYPES,
  type Account,
  type ActionResult,
  type Category,
  type Installment,
  type RecurringPayment,
} from "@/lib/types";
import { t } from "@/i18n";

type FormError = { message: string; field?: string } | null;

/** Button that opens a dialog with a form; `children` gets a close callback. */
export function EditDialog({
  title,
  label,
  isNew,
  children,
}: {
  title: string;
  label: string;
  isNew?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {isNew ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> {label}
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={label}>
          <Pencil className="size-4" aria-hidden />
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {open && children(() => setOpen(false))}
      </Dialog>
    </>
  );
}

function useSubmit(onDone: () => void) {
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) onDone();
      else setError({ message: result.error, field: result.field });
    });
  };
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  return { error, pending, run, fieldError };
}

function Footer({ pending, onDelete, error }: { pending: boolean; onDelete?: () => void; error: FormError }) {
  return (
    <>
      {error && !error.field && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
          {error.message}
        </p>
      )}
      <div className="flex gap-3 pt-2">
        {onDelete && (
          <Button variant="danger" onClick={onDelete} disabled={pending}>
            <Trash2 className="size-4" aria-hidden /> {t.common.delete}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </div>
    </>
  );
}

function confirmDelete(run: (fn: () => Promise<ActionResult>) => void, fn: () => Promise<ActionResult>) {
  if (window.confirm(t.common.confirmDelete)) run(fn);
}

// ---------------------------------------------------------------- account
export function AccountForm({ account, today, onDone }: { account?: Account; today: string; onDone: () => void }) {
  const [v, setV] = useState<AccountInput>({
    id: account?.id,
    name: account?.name ?? "",
    type: account?.type ?? "checking",
    amount: account ? amountToInput(Math.abs(Number(account.opening_balance))) : "",
    openingDate: account?.opening_date ?? today,
    debtStrategy: account?.debt_strategy ?? "plan",
    archived: account?.is_archived ?? false,
  });
  const { error, pending, run, fieldError } = useSubmit(onDone);
  const isCredit = v.type === "credit";
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveAccount(v));
      }}
    >
      <Field label={t.accounts.name} htmlFor="acc-name" error={fieldError("name")}>
        <Input id="acc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      </Field>
      <Field label={t.accounts.type} htmlFor="acc-type">
        <Select id="acc-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as AccountInput["type"] })}>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.accountTypes[type]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isCredit ? t.accounts.owedAmount : t.accounts.openingBalance} htmlFor="acc-amount" error={fieldError("amount")}>
          <Input id="acc-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0,00" className="tabular" />
        </Field>
        <Field label={t.accounts.openingDate} htmlFor="acc-date" error={fieldError("openingDate")}>
          <Input id="acc-date" type="date" value={v.openingDate} onChange={(e) => setV({ ...v, openingDate: e.target.value })} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-text-3">{t.accounts.openingDateHint}</p>
      {isCredit && (
        <Field label={t.accounts.debtStrategy} htmlFor="acc-strategy">
          <Select id="acc-strategy" value={v.debtStrategy} onChange={(e) => setV({ ...v, debtStrategy: e.target.value as "plan" | "installments" })}>
            <option value="plan">{t.debtStrategies.plan}</option>
            <option value="installments">{t.debtStrategies.installments}</option>
          </Select>
        </Field>
      )}
      {account && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-text-2">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={v.archived} onChange={(e) => setV({ ...v, archived: e.target.checked })} />
          {t.accounts.archived}
        </label>
      )}
      <Footer pending={pending} error={error} onDelete={account ? () => confirmDelete(run, () => deleteAccount(account.id)) : undefined} />
    </form>
  );
}

// ---------------------------------------------------------------- recurring payment
export function RecurringForm({
  item,
  categories,
  accounts,
  onDone,
}: {
  item?: RecurringPayment;
  categories: Category[];
  accounts: Account[];
  onDone: () => void;
}) {
  const [v, setV] = useState<RecurringInput>({
    id: item?.id,
    description: item?.description ?? "",
    categoryId: item?.category_id ?? "",
    amount: item ? amountToInput(item.amount) : "",
    dayOfMonth: item?.day_of_month ? String(item.day_of_month) : "",
    intervalMonths: String(item?.interval_months ?? 1),
    anchorMonth: keyToMonthInput(item?.anchor_month),
    startMonth: keyToMonthInput(item?.start_month),
    endMonth: keyToMonthInput(item?.end_month),
    accountId: item?.account_id ?? "",
  });
  const { error, pending, run, fieldError } = useSubmit(onDone);
  const expenseCategories = categories.filter((c) => c.kind === "expense" || c.id === v.categoryId);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveRecurring(v));
      }}
    >
      <Field label={t.tx.description} htmlFor="rec-desc" error={fieldError("description")}>
        <Input id="rec-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.tx.amount} htmlFor="rec-amount" error={fieldError("amount")}>
          <Input id="rec-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0,00" className="tabular" />
        </Field>
        <Field label={t.accounts.dayOfMonth} htmlFor="rec-day" error={fieldError("day")}>
          <Input id="rec-day" inputMode="numeric" value={v.dayOfMonth} onChange={(e) => setV({ ...v, dayOfMonth: e.target.value })} placeholder={t.common.optional} />
        </Field>
      </div>
      <Field label={t.tx.category} htmlFor="rec-cat">
        <Select id="rec-cat" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
          <option value="">{t.tx.chooseCategory}</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.accounts.everyNMonths} htmlFor="rec-interval" error={fieldError("interval")}>
          <Input id="rec-interval" inputMode="numeric" value={v.intervalMonths} onChange={(e) => setV({ ...v, intervalMonths: e.target.value })} />
        </Field>
        {Number(v.intervalMonths) > 1 && (
          <Field label={t.accounts.anchorMonth} htmlFor="rec-anchor">
            <Input id="rec-anchor" type="month" value={v.anchorMonth} onChange={(e) => setV({ ...v, anchorMonth: e.target.value })} />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.accounts.startMonth} htmlFor="rec-start">
          <Input id="rec-start" type="month" value={v.startMonth} onChange={(e) => setV({ ...v, startMonth: e.target.value })} />
        </Field>
        <Field label={t.accounts.endMonth} htmlFor="rec-end">
          <Input id="rec-end" type="month" value={v.endMonth} onChange={(e) => setV({ ...v, endMonth: e.target.value })} />
        </Field>
      </div>
      <Field label={t.tx.account} htmlFor="rec-account">
        <Select id="rec-account" value={v.accountId} onChange={(e) => setV({ ...v, accountId: e.target.value })}>
          <option value="">—</option>
          {accounts.filter((a) => !a.is_archived).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Footer pending={pending} error={error} onDelete={item ? () => confirmDelete(run, () => deleteRecurring(item.id)) : undefined} />
    </form>
  );
}

// ---------------------------------------------------------------- installment
export function InstallmentForm({
  item,
  creditAccounts,
  today,
  onDone,
}: {
  item?: Installment;
  creditAccounts: Account[];
  today: string;
  onDone: () => void;
}) {
  const [v, setV] = useState<InstallmentInput>({
    id: item?.id,
    accountId: item?.account_id ?? creditAccounts.find((a) => a.debt_strategy === "installments")?.id ?? creditAccounts[0]?.id ?? "",
    amount: item ? amountToInput(item.amount) : "",
    dueDate: item?.due_date ?? today,
    description: item?.description ?? "",
  });
  const { error, pending, run, fieldError } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveInstallment(v));
      }}
    >
      <Field label={t.accounts.creditAccount} htmlFor="inst-account" error={fieldError("account")}>
        <Select id="inst-account" value={v.accountId} onChange={(e) => setV({ ...v, accountId: e.target.value })}>
          {creditAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.tx.amount} htmlFor="inst-amount" error={fieldError("amount")}>
          <Input id="inst-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0,00" className="tabular" />
        </Field>
        <Field label={t.accounts.dueDate} htmlFor="inst-date" error={fieldError("dueDate")}>
          <Input id="inst-date" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
        </Field>
      </div>
      <Field label={`${t.tx.description} (${t.common.optional})`} htmlFor="inst-desc">
        <Input id="inst-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <Footer pending={pending} error={error} onDelete={item ? () => confirmDelete(run, () => deleteInstallment(item.id)) : undefined} />
    </form>
  );
}

// Client entry points for the (server-rendered) accounts page.
export function AccountDialog({ account, today }: { account?: Account; today: string }) {
  return (
    <EditDialog title={account ? t.accounts.editAccount : t.accounts.newAccount} label={account ? `${t.common.edit} ${account.name}` : t.accounts.newAccount} isNew={!account}>
      {(close) => <AccountForm account={account} today={today} onDone={close} />}
    </EditDialog>
  );
}

export function RecurringDialog({ item, categories, accounts }: { item?: RecurringPayment; categories: Category[]; accounts: Account[] }) {
  return (
    <EditDialog title={item ? t.accounts.editRecurring : t.accounts.newRecurring} label={item ? `${t.common.edit} ${item.description}` : t.accounts.newRecurring} isNew={!item}>
      {(close) => <RecurringForm item={item} categories={categories} accounts={accounts} onDone={close} />}
    </EditDialog>
  );
}

export function InstallmentDialog({ item, creditAccounts, today }: { item?: Installment; creditAccounts: Account[]; today: string }) {
  if (creditAccounts.length === 0) return null;
  return (
    <EditDialog title={item ? t.accounts.editInstallment : t.accounts.newInstallment} label={item ? t.accounts.editInstallment : t.accounts.newInstallment} isNew={!item}>
      {(close) => <InstallmentForm item={item} creditAccounts={creditAccounts} today={today} onDone={close} />}
    </EditDialog>
  );
}
