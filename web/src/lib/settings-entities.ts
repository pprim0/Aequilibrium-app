// What can be edited in Settings. This list is also the server's whitelist: only these tables and
// fields can be written through the generic editor, and values are validated here.
import { monthInputToKey, parseAmount } from "@/lib/format";
import { t } from "@/i18n";

const f = t.settings.fields;

export type OptionSource = "accounts" | "creditAccounts" | "categories" | "groups" | "methods" | "recurring" | "goals" | "rules";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "money" | "int" | "percent" | "date" | "month" | "bool" | "select" | "ref";
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  /** Shown under "Mais opções" in the form. */
  advanced?: boolean;
  options?: { value: string; label: string }[];
  source?: OptionSource;
  hidden?: (values: Record<string, unknown>) => boolean;
};

export type EntityDef = {
  key: string;
  table: string;
  title: string;
  description: string;
  fields: FieldDef[];
  titleField: string;
  orderBy: string;
  canCreate: boolean;
  canDelete: boolean;
  deleteWarning?: string;
  validate?: (values: Record<string, unknown>) => { error: string; field?: string } | null;
};

const kindOptions = ["expense", "income", "debt_payment", "saving", "transfer", "investment"].map((value) => ({ value, label: t.types[value] }));

export const ENTITIES: EntityDef[] = [
  {
    key: "rendimentos",
    table: "income_sources",
    title: t.settings.sections.income,
    description: t.settings.descriptions.income,
    titleField: "name",
    orderBy: "valid_from",
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "amount", label: f.amount, type: "money", required: true },
      { key: "category_id", label: f.category, type: "ref", source: "categories" },
      { key: "tag", label: f.tag, type: "text", hint: t.settings.hints.tag, advanced: true },
      { key: "expected_day", label: f.expectedDay, type: "int", min: 1, max: 31, advanced: true },
      { key: "valid_from", label: f.validFrom, type: "date", required: true },
      { key: "valid_to", label: f.validTo, type: "date", advanced: true },
    ],
    validate: (v) => (v.valid_to && v.valid_from && String(v.valid_to) < String(v.valid_from) ? { error: t.settings.errors.dateOrder, field: "valid_to" } : null),
  },
  {
    key: "plano",
    table: "monthly_plans",
    title: t.settings.sections.plan,
    description: t.settings.descriptions.plan,
    titleField: "month_key",
    orderBy: "month_key",
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "month_key", label: f.month, type: "month", required: true, hint: t.settings.hints.financialMonth },
      {
        key: "kind",
        label: f.planKind,
        type: "select",
        required: true,
        options: [
          { value: "debts", label: t.settings.planKinds.debts },
          { value: "goal", label: t.settings.planKinds.goal },
        ],
      },
      { key: "amount", label: f.amount, type: "money", required: true },
      { key: "account_id", label: f.debt, type: "ref", source: "creditAccounts", hint: t.settings.hints.planDebt, hidden: (v) => v.kind === "goal" },
      { key: "goal_id", label: f.goal, type: "ref", source: "goals", hidden: (v) => v.kind !== "goal" },
    ],
    validate: (v) => (v.kind === "goal" && !v.goal_id ? { error: t.settings.errors.goalRequired, field: "goal_id" } : null),
  },
  {
    key: "grupos",
    table: "category_groups",
    title: t.settings.sections.groups,
    description: t.settings.descriptions.groups,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: true,
    canDelete: true,
    deleteWarning: t.settings.warnings.group,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "monthly_budget", label: f.monthlyBudget, type: "money" },
      { key: "allocation_rule_id", label: f.allocationBlock, type: "ref", source: "rules", advanced: true },
    ],
  },
  {
    key: "categorias",
    table: "categories",
    title: t.settings.sections.categories,
    description: t.settings.descriptions.categories,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: true,
    canDelete: true,
    deleteWarning: t.settings.warnings.category,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "kind", label: f.kind, type: "select", required: true, options: kindOptions, hint: t.settings.hints.kind, advanced: true },
      { key: "group_id", label: f.group, type: "ref", source: "groups" },
      {
        key: "nature",
        label: f.nature,
        type: "select",
        required: true,
        advanced: true,
        options: [
          { value: "variable", label: t.settings.natures.variable },
          { value: "fixed", label: t.settings.natures.fixed },
        ],
      },
      { key: "own_limit", label: f.ownLimit, type: "money" },
      { key: "default_account_id", label: f.defaultAccount, type: "ref", source: "accounts", hint: t.settings.hints.defaultAccount, advanced: true },
      { key: "default_to_account_id", label: f.defaultToAccount, type: "ref", source: "accounts", advanced: true, hidden: (v) => !["transfer", "saving", "debt_payment", "investment"].includes(String(v.kind)) },
      { key: "benefit_eligible", label: f.benefitEligible, type: "bool", advanced: true, hidden: (v) => v.kind !== "expense" },
      { key: "emoji", label: f.emoji, type: "text", advanced: true },
      { key: "is_archived", label: f.archived, type: "bool", advanced: true },
    ],
  },
  {
    key: "atalhos",
    table: "shortcuts",
    title: t.settings.sections.shortcuts,
    description: t.settings.descriptions.shortcuts,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "description", label: f.description, type: "text" },
      { key: "category_id", label: f.category, type: "ref", source: "categories" },
      { key: "payment_method_id", label: f.method, type: "ref", source: "methods" },
      { key: "account_id", label: f.account, type: "ref", source: "accounts", advanced: true },
      { key: "recurring_id", label: f.recurring, type: "ref", source: "recurring", advanced: true },
      { key: "usual_amount", label: f.usualAmount, type: "money", hint: t.settings.hints.usualAmount, advanced: true },
    ],
  },
  {
    key: "metodos",
    table: "payment_methods",
    title: t.settings.sections.methods,
    description: t.settings.descriptions.methods,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "account_id", label: f.account, type: "ref", source: "accounts" },
    ],
  },
  {
    key: "regra",
    table: "allocation_rules",
    title: t.settings.sections.rule,
    description: t.settings.descriptions.rule,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "pct", label: f.percent, type: "percent", required: true },
      {
        key: "source",
        label: f.ruleSource,
        type: "select",
        required: true,
        options: [
          { value: "expense_groups", label: t.settings.ruleSources.expense_groups },
          { value: "saving", label: t.settings.ruleSources.saving },
          { value: "investment", label: t.settings.ruleSources.investment },
        ],
      },
    ],
  },
  {
    key: "xp",
    table: "xp_rules",
    title: t.settings.sections.xp,
    description: t.settings.descriptions.xp,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: false,
    canDelete: false,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "xp", label: f.xp, type: "int", required: true, min: 0, max: 10000 },
      { key: "is_active", label: f.active, type: "bool" },
    ],
  },
  {
    key: "niveis",
    table: "levels",
    title: t.settings.sections.levels,
    description: t.settings.descriptions.levels,
    titleField: "name",
    orderBy: "level",
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "level", label: f.level, type: "int", required: true, min: 1, max: 1000 },
      { key: "name", label: f.name, type: "text", required: true },
      { key: "min_xp", label: f.minXp, type: "int", required: true, min: 0, max: 10000000 },
    ],
  },
  {
    key: "missoes",
    table: "missions",
    title: t.settings.sections.missions,
    description: t.settings.descriptions.missions,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: false,
    canDelete: false,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "is_active", label: f.active, type: "bool" },
    ],
  },
  {
    key: "conquistas",
    table: "achievements",
    title: t.settings.sections.achievements,
    description: t.settings.descriptions.achievements,
    titleField: "name",
    orderBy: "sort_order",
    canCreate: false,
    canDelete: false,
    fields: [
      { key: "name", label: f.name, type: "text", required: true },
      { key: "description", label: f.description, type: "text" },
      { key: "xp", label: f.xp, type: "int", required: true, min: 0, max: 100000 },
      { key: "is_active", label: f.active, type: "bool" },
    ],
  },
];

export function findEntity(key: string): EntityDef | undefined {
  return ENTITIES.find((e) => e.key === key);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NormalizeResult = { ok: true; values: Record<string, unknown> } | { ok: false; error: string; field?: string };

/** Turns what the form sent into database values. Unknown keys are ignored. */
export function normalizeEntity(entity: EntityDef, raw: Record<string, unknown>): NormalizeResult {
  const values: Record<string, unknown> = {};
  for (const field of entity.fields) {
    const input = raw[field.key];
    if (field.type === "bool") {
      values[field.key] = input === true;
      continue;
    }
    const text = typeof input === "string" ? input.trim() : "";
    if (!text) {
      if (field.required) return { ok: false, error: t.settings.errors.required(field.label), field: field.key };
      values[field.key] = null;
      continue;
    }
    switch (field.type) {
      case "text":
        values[field.key] = text;
        break;
      case "money": {
        const amount = parseAmount(text);
        if (amount === null || amount < 0) return { ok: false, error: t.tx.errors.amount, field: field.key };
        values[field.key] = amount;
        break;
      }
      case "percent": {
        const pct = parseAmount(text.replace("%", ""));
        if (pct === null || pct < 0 || pct > 100) return { ok: false, error: t.settings.errors.percent, field: field.key };
        values[field.key] = Math.round(pct * 100) / 10000;
        break;
      }
      case "int": {
        const n = Number(text);
        if (!Number.isInteger(n) || (field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
          return { ok: false, error: t.settings.errors.range(field.label, field.min ?? 0, field.max ?? 0), field: field.key };
        }
        values[field.key] = n;
        break;
      }
      case "date":
        if (!ISO_DATE.test(text)) return { ok: false, error: t.tx.errors.date, field: field.key };
        values[field.key] = text;
        break;
      case "month": {
        const key = monthInputToKey(text);
        if (key === null) return { ok: false, error: t.tx.errors.date, field: field.key };
        values[field.key] = key;
        break;
      }
      case "select":
        if (!field.options?.some((o) => o.value === text)) return { ok: false, error: t.settings.errors.required(field.label), field: field.key };
        values[field.key] = text;
        break;
      case "ref":
        if (!UUID.test(text)) return { ok: false, error: t.settings.errors.required(field.label), field: field.key };
        values[field.key] = text;
        break;
    }
  }
  // Fields hidden for this choice must not keep a stale value.
  for (const field of entity.fields) {
    if (field.hidden?.(values) && field.type !== "bool") values[field.key] = null;
  }
  const problem = entity.validate?.(values);
  return problem ? { ok: false, ...problem } : { ok: true, values };
}

export type SettingsInput = {
  financial_month_start_day: string;
  default_account_id: string;
  alert_1: string;
  alert_2: string;
  alert_3: string;
  tracking_start_date: string;
  rest_days_per_week: string;
  min_review_days_week: string;
  min_review_days_month: string;
  min_days_for_projection: string;
  free_to_spend_mode: string;
  show_habits: boolean;
};

export function normalizeSettings(raw: SettingsInput): NormalizeResult {
  const int = (key: Exclude<keyof SettingsInput, "show_habits">, min: number, max: number, label: string) => {
    const n = Number(raw[key]);
    return Number.isInteger(n) && n >= min && n <= max ? n : { error: t.settings.errors.range(label, min, max), field: key };
  };
  const checks = [
    ["financial_month_start_day", int("financial_month_start_day", 1, 28, f.monthStartDay)],
    ["rest_days_per_week", int("rest_days_per_week", 0, 6, f.restDays)],
    ["min_review_days_week", int("min_review_days_week", 1, 7, f.minWeek)],
    ["min_review_days_month", int("min_review_days_month", 1, 31, f.minMonth)],
    ["min_days_for_projection", int("min_days_for_projection", 1, 31, f.minProjection)],
  ] as const;
  const values: Record<string, unknown> = {};
  for (const [key, result] of checks) {
    if (typeof result !== "number") return { ok: false, ...result };
    values[key] = result;
  }
  const alerts = [raw.alert_1, raw.alert_2, raw.alert_3].map((a) => parseAmount(a.replace("%", "")));
  if (alerts.some((a) => a === null || a <= 0)) return { ok: false, error: t.settings.errors.percent, field: "alert_1" };
  const [a1, a2, a3] = alerts as number[];
  if (!(a1 < a2 && a2 < a3)) return { ok: false, error: t.settings.errors.alertOrder, field: "alert_1" };
  values.alert_thresholds = [a1, a2, a3].map((a) => Math.round(a * 100) / 10000);
  if (raw.tracking_start_date && !ISO_DATE.test(raw.tracking_start_date)) return { ok: false, error: t.tx.errors.date, field: "tracking_start_date" };
  values.tracking_start_date = raw.tracking_start_date || null;
  if (raw.default_account_id && !UUID.test(raw.default_account_id)) return { ok: false, error: f.defaultAccount, field: "default_account_id" };
  values.default_account_id = raw.default_account_id || null;
  if (raw.free_to_spend_mode !== "actual" && raw.free_to_spend_mode !== "projected") return { ok: false, error: f.freeMode, field: "free_to_spend_mode" };
  values.free_to_spend_mode = raw.free_to_spend_mode;
  values.show_habits = raw.show_habits === true;
  return { ok: true, values };
}
