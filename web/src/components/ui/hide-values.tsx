"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { t } from "@/i18n";

const STORAGE_KEY = "momentum-hide-values";
const ATTRIBUTE = "data-hide-values";
const EVENT = "momentum-hide-values-change";

// Runs before the first paint (see the root layout), so amounts never flash when hidden.
export const HIDE_VALUES_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")==="1")document.documentElement.setAttribute("${ATTRIBUTE}","")}catch(e){}`;

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function HideValuesButton() {
  const hidden = useSyncExternalStore(
    subscribe,
    () => document.documentElement.hasAttribute(ATTRIBUTE),
    () => false,
  );

  function toggle() {
    const root = document.documentElement;
    const next = !root.hasAttribute(ATTRIBUTE);
    root.toggleAttribute(ATTRIBUTE, next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Without storage the choice simply lasts until the page is reloaded.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  const label = hidden ? t.home.showValues : t.home.hideValues;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-muted hover:text-text"
    >
      {hidden ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
    </button>
  );
}
