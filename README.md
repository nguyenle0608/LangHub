# LangHub

Web-based localization management for mobile and web developers. Import, translate, review, and export strings across multiple locales — similar to Lokalise and Gridly.

## Features

- **Translation Editor** — virtualized spreadsheet with inline editing, sticky columns, and real-time collaboration
- **Status Workflow** — `empty` → `pending` → `reviewed` → `approved` per locale per key; bulk Review all / Approve all
- **Key Management** — add, rename, tag keys; duplicate detection with merge/link; comment threads; full edit history
- **Version Snapshots** — point-in-time snapshots with diff viewer; auto-snapshot before every destructive operation
- **Import** — JSON, ARB, CSV, YAML with 5-step wizard, preview, and namespace prefixing
- **Export** — JSON (nested or flat), ARB, CSV, YAML; single locale → direct download, multi-locale → ZIP
- **Organizations** — multi-org support with member roles (owner / admin / translator / viewer)
- **Keyboard shortcuts** — `⌘K` / `Ctrl+K` to add key, `Esc` to close panels

## Tech Stack

- Next.js 14 (App Router, TypeScript strict)
- Supabase (PostgreSQL, Auth, Realtime)
- Tailwind CSS + shadcn/ui (dark theme, zinc base)
- Deployed on Vercel

## Local Development

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account (or local Supabase CLI)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd lang_hub
pnpm install

# Environment variables
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Push database schema
pnpm db:push

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (localhost:3000) |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm db:push` | Apply Supabase migrations |
| `pnpm db:types` | Regenerate TypeScript types from DB schema |

## Deployment (Vercel)

1. Push to GitHub and import the repo in Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
   - `PUBLIC_API_ENABLED` (`false` until public API security smoke tests pass)
3. Deploy — Vercel auto-detects Next.js

## Database Migrations

Migrations live in `supabase/migrations/`. Apply with:

```bash
# Remote (Supabase dashboard)
pnpm db:push

# Local Supabase CLI
supabase db reset
```

## Project Structure

See [`docs/project-struct.md`](docs/project-struct.md) for a detailed breakdown.

## Architecture Notes

- **Admin client** (`createAdminClient` with service role key) is used for all server-side mutations — bypasses RLS safely because auth is validated at the API route level before any DB operation
- **Read-only client** (`createClient` with anon key) is used for auth checks only
- All DB queries are in `lib/supabase/queries/` — components never call Supabase directly
- Auto-snapshot fires before every destructive operation (import, bulk delete, restore) — rollback is always one click away
- Public API tokens are stored only as SHA-256 hashes; v1 routes remain unavailable unless `PUBLIC_API_ENABLED=true`

## Public API operations

Rate-limit buckets and idempotency records are intentionally retained for short-lived replay and diagnostics. Schedule the cleanup SQL in [`docs/public-api-operations.md`](docs/public-api-operations.md) daily after enabling v1.
