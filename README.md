# LangHub

Web-based localization management for mobile and web developers. Import, translate, review, and export strings across multiple locales — similar to Lokalise and Gridly.

## Features

- **Translation Editor** — virtualized spreadsheet with inline editing, sticky columns, and real-time collaboration
- **Status Workflow** — `empty` → `pending` → `reviewed` → `approved` per locale per key; bulk Review all / Approve all
- **Key Management** — add, rename, tag keys; duplicate detection with merge/link; comment threads; full edit history
- **Version Snapshots** — point-in-time snapshots with diff viewer; auto-snapshot before every destructive operation
- **Branches** — per-project translation branches with merge back into the base branch
- **QA Checks** — automated checks for placeholder mismatches, empty values, and length issues
- **Glossary & Translation Memory** — org-level glossary (CSV import/export) plus TM suggestions in the editor, behind `TRANSLATION_ASSISTANCE_ENABLED`
- **Import** — JSON, ARB, CSV, YAML, Android XML, iOS `.strings` with 5-step wizard, preview, and namespace prefixing
- **Export** — JSON (nested or flat), ARB, CSV, YAML, Android XML, iOS `.strings`; single locale → direct download, multi-locale → ZIP
- **Organizations** — multi-org support with member roles (owner / admin / translator / viewer)
- **Public API** — token-authenticated `/api/v1/*` routes with rate limiting and idempotency, behind `PUBLIC_API_ENABLED`
- **Theming** — light / dark / system modes
- **Keyboard shortcuts** — `⌘K` / `Ctrl+K` to add key, `Esc` to close panels

## Tech Stack

- **Framework** — Next.js 14.2 (App Router), React 18, TypeScript strict
- **Database & Auth** — Supabase (PostgreSQL, Auth, Realtime) via `@supabase/ssr`
- **UI** — Tailwind CSS 3.4 + shadcn/ui on Radix UI and Base UI, `lucide-react` icons, `sonner` toasts, `cmdk` command palette, TanStack Virtual for the editor grid
- **Validation** — Zod for all forms and API input
- **Parsing / export** — `papaparse` (CSV), `js-yaml` (YAML), `jszip` (multi-locale ZIP)
- **Testing** — Vitest + Testing Library + jsdom
- **Tooling** — pnpm, ESLint (`eslint-config-next`)
- **Deploy** — Netlify (`@netlify/plugin-nextjs`), Node 20

## Local Development

### Prerequisites

- Node.js 20 (matches the Netlify build)
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

## Deployment (Netlify)

1. Push to GitHub and connect the repo in Netlify
2. Set environment variables in Netlify for the Production deploy context:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL=https://lang-hub.netlify.app`
   - `PUBLIC_API_ENABLED=true` (enables `/api/v1/*`; use `false` for rollback)
   - `TRANSLATION_ASSISTANCE_ENABLED=false` until the TM/Glossary application deploy is verified, then change it to `true`
   - `RESTCOUNTRIES_API_KEY` when the REST Countries account requires authenticated requests
3. Trigger a new production deploy after adding or changing environment variables

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
- Translation Memory and Glossary editor assistance remains unavailable unless `TRANSLATION_ASSISTANCE_ENABLED=true`

## Public API operations

Rate-limit buckets and idempotency records are intentionally retained for short-lived replay and diagnostics. Schedule the cleanup SQL in [`docs/public-api-operations.md`](docs/public-api-operations.md) daily after enabling v1.
