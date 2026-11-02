"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { useSubmit } from "@/components/accounts/forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { deleteMyAccount } from "@/app/actions/settings";
import { t } from "@/i18n";

const linkClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-4 text-sm font-semibold hover:bg-muted";

export function DataPanel() {
  const [confirm, setConfirm] = useState("");
  const { error, pending, run, fieldError } = useSubmit(() => {});
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="font-bold">{t.settings.exportTitle}</h2>
        <p className="text-sm text-text-2">{t.settings.exportHint}</p>
        <div className="flex flex-wrap gap-2">
          {/* Plain links: these are file downloads, not page navigations. */}
          <a href="/exportar?formato=csv" className={linkClass}>
            <Download className="size-4" aria-hidden /> {t.settings.exportCsv}
          </a>
          <a href="/exportar?formato=json" className={linkClass}>
            <Download className="size-4" aria-hidden /> {t.settings.exportJson}
          </a>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 border-error/30">
        <h2 className="font-bold text-error">{t.settings.deleteTitle}</h2>
        <p className="text-sm text-text-2">{t.settings.deleteHint}</p>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(() => deleteMyAccount(confirm));
          }}
        >
          <Field label={t.settings.deleteConfirmLabel} htmlFor="delete-confirm" error={fieldError("confirm")}>
            <Input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </Field>
          {error && !error.field && (
            <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
              {error.message}
            </p>
          )}
          <div>
            <Button type="submit" variant="danger" disabled={pending || confirm.trim() !== t.settings.deleteWord}>
              <Trash2 className="size-4" aria-hidden /> {t.settings.deleteButton}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
