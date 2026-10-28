// Spins up an in-process Postgres (PGlite), applies the Supabase stub, the reconstructed
// live schema and every migration, and offers helpers to act as a given user.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const fixturesDir = join(here, 'fixtures');

export const USER_A = '00000000-0000-0000-0000-00000000000a';
export const USER_B = '00000000-0000-0000-0000-00000000000b';

function sqlFiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(dir, f));
}

export async function createDb({ extraSql = [] } = {}) {
  const db = new PGlite();
  for (const file of [...sqlFiles(fixturesDir), ...sqlFiles(migrationsDir), ...extraSql]) {
    try {
      await db.exec(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USER_A}', 'a@test.local'), ('${USER_B}', 'b@test.local');
  `);
  return db;
}

// Runs fn as an authenticated user (RLS applies), with "today" pinned.
export async function asUser(db, userId, today, fn) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    select set_config('momentum.today', '${today ?? ''}', false);
    set role authenticated;
  `);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

export async function one(db, sql, params = []) {
  const { rows } = await db.query(sql, params);
  return rows[0];
}

export async function all(db, sql, params = []) {
  const { rows } = await db.query(sql, params);
  return rows;
}

// Numeric comes back as string; compare money with cents precision.
export function money(value) {
  return value === null || value === undefined ? value : Math.round(Number(value) * 100) / 100;
}

// Inserts a movement resolving names to ids. Fields: date, amount, category, account, to, method, split, recurring, description.
export async function addTx(db, tx) {
  const sql = `
    insert into public.transactions (user_id, date, amount, type, category_id, account_id, to_account_id,
                                     payment_method_id, split_id, recurring_id, description)
    values (
      auth.uid(), $1::date, $2::numeric, coalesce($3, 'expense'),
      (select id from public.categories where name = $4),
      (select id from public.accounts where name = $5),
      (select id from public.accounts where name = $6),
      (select id from public.payment_methods where name = $7),
      $8::uuid,
      (select id from public.recurring_payments where description = $9),
      $10)
    returning id`;
  return one(db, sql, [
    tx.date, tx.amount, tx.type ?? null, tx.category ?? null, tx.account ?? null, tx.to ?? null,
    tx.method ?? null, tx.split ?? null, tx.recurring ?? null, tx.description ?? null,
  ]);
}
