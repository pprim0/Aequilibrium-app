// The onboarding edits a preset document (see apply_setup in supabase/migrations). Rows there
// reference each other by name, so removing or renaming a row must fix every reference.

export type SetupAccount = {
  name: string;
  type: string;
  opening_balance?: number;
  opening_date?: string;
  debt_strategy?: string | null;
  is_credit_card?: boolean;
  credit_limit?: number | null;
  /** Name in the preset, kept while editing so a rename can update references. */
  _original?: string;
};

type Row = Record<string, unknown>;

export type SetupData = {
  settings?: Row & { default_account?: string; financial_month_start_day?: number };
  accounts?: SetupAccount[];
  groups?: (Row & { name: string; monthly_budget?: number | null })[];
  categories?: (Row & { name: string; kind: string; tag?: string })[];
  payment_methods?: Row[];
  recurring_payments?: Row[];
  installments?: Row[];
  income_sources?: (Row & { name: string; tag?: string; category?: string; amount?: number })[];
  shortcuts?: Row[];
  goals?: (Row & { name: string; target_type?: string; target_amount?: number; category?: string; target_formula?: { factor?: number } })[];
  monthly_plans?: Row[];
  habits?: (Row & { name: string; system_key?: string })[];
  achievements?: (Row & { key?: string; xp?: number; condition?: Row })[];
  [key: string]: unknown;
};

export function isCredit(account: SetupAccount) {
  return account.type === "credit";
}

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Copy for editing, remembering each account's preset name. */
export function startEditing(preset: SetupData): SetupData {
  const copy = JSON.parse(JSON.stringify(preset)) as SetupData;
  copy.accounts = (copy.accounts ?? []).map((a) => ({ ...a, _original: a.name }));
  return copy;
}

/** A debt added during onboarding needs a way to be paid and its own achievement. */
function addDebtSupport(data: SetupData, account: SetupAccount) {
  const categories = data.categories ?? (data.categories = []);
  const alreadyPaid = categories.some((c) => c.default_to_account === account.name && c.kind === "debt_payment");
  if (!alreadyPaid) {
    const name = `Dívida: ${account.name}`;
    const debtGroup = data.groups?.find((g) => categories.some((c) => c.kind === "debt_payment" && c.group === g.name))?.name;
    if (!categories.some((c) => c.name === name)) {
      categories.push({ name, kind: "debt_payment", nature: "fixed", default_to_account: account.name, group: debtGroup, emoji: "💳" });
    }
  }
  const achievements = data.achievements ?? (data.achievements = []);
  const hasAchievement = achievements.some((a) => a.condition?.type === "debt_cleared" && a.condition?.account === account.name);
  const baseXp = achievements.find((a) => a.key === "debt_first_100")?.xp;
  if (!hasAchievement && baseXp !== undefined) {
    achievements.push({
      key: `debt_${slug(account.name)}`,
      name: `${account.name}: paga`,
      description: `Dívida "${account.name}" a zero`,
      xp: baseXp,
      condition: { type: "debt_cleared", account: account.name },
    });
  }
}

/**
 * Produces the document for apply_setup: applies account renames everywhere and drops references
 * to anything that was removed, so the database never sees a dangling name.
 */
export function finalizeSetup(edited: SetupData, today: string): SetupData {
  const data = JSON.parse(JSON.stringify(edited)) as SetupData;
  const accounts = data.accounts ?? [];

  const renames = new Map<string, string>();
  for (const a of accounts) if (a._original && a._original !== a.name) renames.set(a._original, a.name);
  const current = new Set(accounts.map((a) => a.name));
  // Names that existed before editing and no longer do: removed, unless renamed.
  const rename = (name: unknown) => (typeof name === "string" && renames.has(name) ? renames.get(name) : name);
  const alive = (name: unknown) => {
    const n = rename(name);
    return typeof n === "string" && current.has(n) ? n : undefined;
  };

  const creditNames = new Set(accounts.filter(isCredit).map((a) => a.name));

  data.accounts = accounts.map((a) => {
    const { _original, ...rest } = a;
    void _original;
    return {
      ...rest,
      opening_date: rest.opening_date ?? today,
      opening_balance: isCredit(rest) ? -Math.abs(rest.opening_balance ?? 0) : (rest.opening_balance ?? 0),
      debt_strategy: isCredit(rest) ? (rest.debt_strategy ?? "plan") : null,
    };
  });

  // Categories that pay a debt that no longer exists have no reason to stay.
  const removedCategories = new Set<string>();
  data.categories = (data.categories ?? []).filter((c) => {
    if (c.kind === "debt_payment" && c.default_to_account && !alive(c.default_to_account)) {
      removedCategories.add(c.name);
      return false;
    }
    return true;
  });
  for (const c of data.categories) {
    if (c.default_to_account) c.default_to_account = alive(c.default_to_account);
    if (c.default_account) c.default_account = alive(c.default_account);
  }

  // A method tied to a removed account (e.g. Klarna) goes away with it.
  const removedMethods = new Set<unknown>();
  data.payment_methods = (data.payment_methods ?? []).flatMap((m) => {
    if (!m.account) return [m];
    const account = alive(m.account);
    if (!account) {
      removedMethods.add(m.name);
      return [];
    }
    return [{ ...m, account }];
  });
  for (const r of data.recurring_payments ?? []) if (r.account) r.account = alive(r.account);
  for (const i of data.income_sources ?? []) if (i.account) i.account = alive(i.account);
  for (const g of data.goals ?? []) if (g.account) g.account = alive(g.account);
  data.installments = (data.installments ?? [])
    .map((i) => ({ ...i, account: alive(i.account) }))
    .filter((i) => i.account);

  const goalNames = new Set((data.goals ?? []).map((g) => g.name));
  data.monthly_plans = (data.monthly_plans ?? [])
    .map((p) => (p.account ? { ...p, account: alive(p.account) } : p))
    .filter((p) => (p.kind !== "goal" || goalNames.has(p.goal as string)) && !(p.kind === "debts" && "account" in p && p.account === undefined));
  if (creditNames.size === 0) data.monthly_plans = data.monthly_plans.filter((p) => p.kind !== "debts");

  data.shortcuts = (data.shortcuts ?? [])
    .filter((s) => !removedCategories.has(s.category as string))
    .map((s) => ({
      ...s,
      ...(s.account ? { account: alive(s.account) } : {}),
      ...(removedMethods.has(s.payment_method) ? { payment_method: undefined } : {}),
    }));

  const liveCredit = (name: unknown) => {
    const n = alive(name);
    return n && creditNames.has(n) ? n : undefined;
  };
  data.achievements = (data.achievements ?? [])
    .map((a) => (a.condition?.type === "debt_cleared" ? { ...a, condition: { ...a.condition, account: liveCredit(a.condition.account) } } : a))
    .filter((a) => a.condition?.type !== "debt_cleared" || a.condition?.account);

  for (const account of data.accounts.filter(isCredit)) addDebtSupport(data, account);
  // A card is a way to pay, so it needs a payment method.
  for (const card of data.accounts.filter((a) => a.is_credit_card)) {
    const methods = data.payment_methods ?? (data.payment_methods = []);
    if (!methods.some((m) => m.account === card.name)) methods.push({ name: card.name, account: card.name });
  }

  const settings = data.settings ?? (data.settings = {});
  settings.default_account = (alive(settings.default_account) as string | undefined) ?? data.accounts.find((a) => a.type === "checking")?.name ?? data.accounts.find((a) => a.type === "cash")?.name;
  return data;
}
