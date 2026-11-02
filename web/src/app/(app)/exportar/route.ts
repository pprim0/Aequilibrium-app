import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { t } from "@/i18n";

const BACKUP_TABLES = [
  "user_settings", "accounts", "category_groups", "categories", "payment_methods", "recurring_payments", "installments",
  "income_sources", "shortcuts", "goals", "monthly_plans", "investment_valuations", "transactions", "allocation_rules",
  "daily_checkins", "xp_rules", "levels", "missions", "achievements", "achievement_unlocks", "xp_ledger",
  "habits", "habit_logs",
];

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Runs as the signed-in user, so RLS limits the export to their own rows.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const today = todayISO();
  if (request.nextUrl.searchParams.get("formato") === "json") {
    const entries = await Promise.all(
      BACKUP_TABLES.map(async (table) => {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw new Error(`${table}: ${error.message}`);
        return [table, data] as const;
      }),
    );
    const body = JSON.stringify({ exported_at: new Date().toISOString(), ...Object.fromEntries(entries) }, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="momentum-${today}.json"`,
      },
    });
  }

  const [transactions, categories, accounts, methods] = await Promise.all([
    supabase.from("transactions").select("*").order("date").order("created_at"),
    supabase.from("categories").select("id, name"),
    supabase.from("accounts").select("id, name"),
    supabase.from("payment_methods").select("id, name"),
  ]);
  for (const r of [transactions, categories, accounts, methods]) if (r.error) throw new Error(r.error.message);
  const name = (rows: { id: string; name: string }[] | null, id: string | null) => rows?.find((r) => r.id === id)?.name ?? "";

  const splitNumbers = new Map<string, number>();
  const lines = (transactions.data ?? []).map((tx) => {
    let split = "";
    if (tx.split_id) {
      if (!splitNumbers.has(tx.split_id)) splitNumbers.set(tx.split_id, splitNumbers.size + 1);
      split = String(splitNumbers.get(tx.split_id));
    }
    const [y, m, d] = String(tx.date).split("-");
    return [
      `${d}/${m}/${y}`,
      tx.description,
      Number(tx.amount).toFixed(2).replace(".", ","),
      t.types[tx.type] ?? tx.type,
      name(categories.data, tx.category_id),
      name(accounts.data, tx.account_id),
      name(accounts.data, tx.to_account_id),
      name(methods.data, tx.payment_method_id),
      split,
      tx.note,
    ]
      .map(csvCell)
      .join(";");
  });
  // BOM and semicolons so Excel in pt-PT opens accents and columns correctly.
  const body = `﻿${[t.settings.csvHeaders.join(";"), ...lines].join("\r\n")}\r\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="momentum-movimentos-${today}.csv"`,
    },
  });
}
