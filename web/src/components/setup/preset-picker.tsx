"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { applyPreset } from "@/app/actions/setup";
import { t } from "@/i18n";

export function PresetPicker({ presets }: { presets: { key: string; name: string; description: string | null }[] }) {
  const [error, action, pending] = useActionState(applyPreset, null);
  return (
    <div className="flex flex-col gap-3">
      {presets.map((p) => (
        <Card key={p.key} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">{p.name}</p>
            {p.description && <p className="text-sm text-text-2">{p.description}</p>}
          </div>
          <form action={action}>
            <input type="hidden" name="preset" value={p.key} />
            <Button type="submit" disabled={pending}>
              {pending ? t.setup.applying : t.setup.apply}
            </Button>
          </form>
        </Card>
      ))}
      {error && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
