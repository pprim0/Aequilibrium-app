"use client";

import { useState } from "react";
import { EditDialog, Footer, useSubmit } from "@/components/accounts/forms";
import { Field, Input } from "@/components/ui/field";
import { saveCategoryLimit, saveGroupBudget } from "@/app/actions/planning";
import { amountToInput } from "@/lib/format";
import type { ActionResult, Numeric } from "@/lib/types";
import { t } from "@/i18n";

function AmountForm({
  label,
  initial,
  onSave,
  onDone,
}: {
  label: string;
  initial: Numeric | null;
  onSave: (amount: string) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(initial === null ? "" : amountToInput(initial));
  const { error, pending, run, fieldError } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => onSave(amount));
      }}
    >
      <Field label={label} htmlFor="budget-amount" hint={t.budget.amountHint} error={fieldError("amount")}>
        <Input id="budget-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="tabular" autoFocus />
      </Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

export function GroupBudgetDialog({ id, name, budget }: { id: string; name: string; budget: Numeric | null }) {
  const title = t.budget.editGroup(name);
  return (
    <EditDialog title={title} label={title}>
      {(close) => <AmountForm label={t.tx.amount} initial={budget} onSave={(amount) => saveGroupBudget(id, amount)} onDone={close} />}
    </EditDialog>
  );
}

export function CategoryLimitDialog({ id, name, limit }: { id: string; name: string; limit: Numeric | null }) {
  const title = t.budget.editCategory(name);
  return (
    <EditDialog title={title} label={title}>
      {(close) => <AmountForm label={t.tx.amount} initial={limit} onSave={(amount) => saveCategoryLimit(id, amount)} onDone={close} />}
    </EditDialog>
  );
}
