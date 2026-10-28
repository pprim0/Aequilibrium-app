"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";
import type { Lookups, Transaction } from "@/lib/types";
import { t } from "@/i18n";

type Ctx = {
  ready: boolean;
  openNew: () => void;
  openEdit: (tx: Transaction) => void;
};

const TxFormContext = createContext<Ctx>({ ready: false, openNew: () => {}, openEdit: () => {} });

export function useTxForm() {
  return useContext(TxFormContext);
}

// Owns the single "register / edit movement" sheet so the "+" button and any list can open it.
export function TxFormProvider({ lookups, children }: { lookups: Lookups; children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; editing: Transaction | null; key: number }>({
    open: false,
    editing: null,
    key: 0,
  });

  const openNew = useCallback(() => setState((s) => ({ open: true, editing: null, key: s.key + 1 })), []);
  const openEdit = useCallback((tx: Transaction) => setState((s) => ({ open: true, editing: tx, key: s.key + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const ready = lookups.accounts.length > 0 && lookups.categories.length > 0;
  const value = useMemo(() => ({ ready, openNew, openEdit }), [ready, openNew, openEdit]);

  return (
    <TxFormContext value={value}>
      {children}
      <Dialog open={state.open} onClose={close} title={state.editing ? t.tx.editTitle : t.tx.newTitle}>
        <TransactionForm key={state.key} lookups={lookups} editing={state.editing} onDone={close} />
      </Dialog>
    </TxFormContext>
  );
}
