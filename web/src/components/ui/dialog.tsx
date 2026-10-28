"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "@/i18n";

// Native <dialog>: focus trap, Esc to close and backdrop come from the browser.
// On phones it opens as a bottom sheet, on desktop as a centred panel.
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[var(--radius-lg)] bg-card p-0 text-text
                 sm:m-auto sm:max-w-lg sm:rounded-[var(--radius-lg)]"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <h2 id="dialog-title" className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  );
}
