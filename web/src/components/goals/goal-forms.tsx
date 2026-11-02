"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { EditDialog, Footer, useSubmit } from "@/components/accounts/forms";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { addInvestmentAsset, archiveGoal, saveGoal, saveValuation, type GoalInput } from "@/app/actions/planning";
import { amountToInput } from "@/lib/format";
import type { GoalRow, InvestmentSummary } from "@/lib/types";
import { t } from "@/i18n";

function GoalForm({ goal, onDone }: { goal?: GoalRow; onDone: () => void }) {
  const isFormula = goal?.target_type === "formula";
  const [v, setV] = useState<GoalInput>({
    id: goal?.id,
    name: goal?.name ?? "",
    isFormula,
    target: goal?.target_amount != null ? amountToInput(goal.target_amount) : "",
    factor: String(goal?.target_formula?.factor ?? "").replace(".", ","),
    roundUp: String(goal?.target_formula?.round_up ?? "").replace(".", ","),
    targetDate: goal?.target_date ?? "",
    priority: String(goal?.priority ?? 2),
  });
  const { error, pending, run, fieldError } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveGoal(v));
      }}
    >
      <Field label={t.goals.name} htmlFor="goal-name" error={fieldError("name")}>
        <Input id="goal-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      {isFormula ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.goals.factor} htmlFor="goal-factor" error={fieldError("factor")}>
            <Input id="goal-factor" inputMode="decimal" value={v.factor} onChange={(e) => setV({ ...v, factor: e.target.value })} className="tabular" />
          </Field>
          <Field label={t.goals.roundUp} htmlFor="goal-round" error={fieldError("roundUp")}>
            <Input id="goal-round" inputMode="decimal" value={v.roundUp} onChange={(e) => setV({ ...v, roundUp: e.target.value })} className="tabular" />
          </Field>
          <p className="col-span-2 -mt-2 text-xs text-text-3">{t.goals.formulaHint}</p>
        </div>
      ) : (
        <Field label={t.goals.target} htmlFor="goal-target" error={fieldError("target")}>
          <Input id="goal-target" inputMode="decimal" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} placeholder="0,00" className="tabular" />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t.goals.targetDate} (${t.common.optional})`} htmlFor="goal-date" error={fieldError("targetDate")}>
          <Input id="goal-date" type="date" value={v.targetDate} onChange={(e) => setV({ ...v, targetDate: e.target.value })} />
        </Field>
        <Field label={t.goals.priority} htmlFor="goal-priority">
          <Select id="goal-priority" value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })}>
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {t.goals.priorities[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Footer
        pending={pending}
        error={error}
        onDelete={
          goal && !isFormula
            ? () => {
                if (window.confirm(t.goals.archiveConfirm)) run(() => archiveGoal(goal.id));
              }
            : undefined
        }
      />
    </form>
  );
}

export function GoalDialog({ goal }: { goal?: GoalRow }) {
  const title = goal ? t.goals.editGoal : t.goals.newGoal;
  return (
    <EditDialog title={title} label={goal ? `${t.common.edit} ${goal.name}` : title} isNew={!goal}>
      {(close) => <GoalForm goal={goal} onDone={close} />}
    </EditDialog>
  );
}

function ValuationForm({ item, today, onDone }: { item: InvestmentSummary; today: string; onDone: () => void }) {
  const [value, setValue] = useState(item.current_value != null ? amountToInput(item.current_value) : "");
  const [date, setDate] = useState(today);
  const { error, pending, run, fieldError } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveValuation(item.category_id, value, date));
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.goals.currentValue} htmlFor="val-amount" error={fieldError("value")}>
          <Input id="val-amount" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" className="tabular" autoFocus />
        </Field>
        <Field label={t.goals.valuedOn} htmlFor="val-date" error={fieldError("valuedOn")}>
          <Input id="val-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Footer pending={pending} error={error} />
    </form>
  );
}

export function ValuationDialog({ item, today }: { item: InvestmentSummary; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <TrendingUp className="size-4" aria-hidden /> {t.goals.updateValue}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.goals.valueTitle(item.name)}>
        {open && <ValuationForm item={item} today={today} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function AssetForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const { error, pending, run, fieldError } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addInvestmentAsset(name));
      }}
    >
      <Field label={t.goals.assetName} htmlFor="asset-name" error={fieldError("name")}>
        <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

export function AssetDialog() {
  return (
    <EditDialog title={t.goals.newAsset} label={t.goals.newAsset} isNew>
      {(close) => <AssetForm onDone={close} />}
    </EditDialog>
  );
}
