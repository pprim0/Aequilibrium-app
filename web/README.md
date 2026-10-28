# Momentum Web

Next.js app (App Router) for Momentum: habits and personal finance. All numbers come from the SQL functions in `../supabase/migrations`.

## Setup

1. Apply the migrations in `../supabase/migrations` to a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. `npm install` and `npm run dev`.

## Checks

- `npm test` — unit tests (Vitest)
- `npm run lint`
- `npm run build`

Texts live in `src/i18n/pt-PT.ts`; formatting (EUR, dd/mm/aaaa, comma decimals) in `src/lib/format.ts`.
