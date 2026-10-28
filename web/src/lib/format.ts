// pt-PT formatting and parsing: "1 234,56 €", "dd/mm/aaaa", comma decimals.

const LOCALE = "pt-PT";
export const APP_TIMEZONE = "Europe/Lisbon";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  // Intl uses a narrow no-break space as the group separator; keep it.
  return moneyFormatter.format(n === 0 ? 0 : n);
}

/** "2026-10-28" → "28/10/2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/** "2026-10-28" → "28/10". */
export function formatShortDate(iso: string | null | undefined): string {
  return formatDate(iso).slice(0, 5);
}

/**
 * Reads what the user typed as an amount. Accepts "12,5", "12.50", "1 234,56", "1.234,56", "€ 3".
 * Returns null when it is not a valid number.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[€\s  ]/g, "").trim();
  if (!s) return null;
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // The last separator is the decimal one; the other groups thousands.
    const decimal = lastComma > lastDot ? "," : ".";
    const group = decimal === "," ? "." : ",";
    s = s.split(group).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split(".").join("");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return negative ? -n : n;
}

/** Amount for an input field: 12.5 → "12,50". */
export function amountToInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toFixed(2).replace(".", ",");
}

/** Today's date (YYYY-MM-DD) in the given timezone. */
export function todayISO(timeZone: string = APP_TIMEZONE, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 202611 → "Nov 26". */
export function monthLabel(key: number): string {
  return `${MONTHS[(key % 100) - 1]} ${String(Math.floor(key / 100)).slice(2)}`;
}

/** 202611 → "novembro de 2026". */
export function monthLongLabel(key: number): string {
  return `${MONTHS_LONG[(key % 100) - 1]} de ${Math.floor(key / 100)}`;
}

export function shiftMonthKey(key: number, months: number): number {
  const total = Math.floor(key / 100) * 12 + (key % 100) - 1 + months;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}

/** <input type="month"> value "2026-11" ↔ 202611. */
export function monthInputToKey(value: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
}

export function keyToMonthInput(key: number | null | undefined): string {
  if (!key) return "";
  return `${Math.floor(key / 100)}-${String(key % 100).padStart(2, "0")}`;
}

export function isMonthKey(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value % 100 >= 1 && value % 100 <= 12 && value > 190000;
}
