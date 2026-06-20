# Agent Source Of Truth

Use this file as the common routing map for every agent.

## Mandatory Read Order

1. `.agents/README.md`
2. `.agents/rules/project-rules.md`
3. `.agents/rules/git-rules.md`
4. `CLAUDE.md`
5. `docs/` (when working on a specific feature)

## Hard Rules

- Prefix shell commands with `rtk` when available.
- Prefer `rg` / `rg --files` for search over plain `grep`.
- All DB queries go through `lib/supabase/queries/` — never direct calls in components or API routes.
- All API routes validate auth BEFORE any DB operation.
- Parser/Exporter logic lives in `lib/parsers/` and `lib/exporters/` — pure functions, no side effects.
- AI translation buttons show "Coming Soon" toast — do NOT wire up AI calls.
- Every destructive operation (import, bulk delete, restore) must auto-create a version snapshot BEFORE proceeding.
- Use `createAdminClient()` (service role key) for all server-side mutations; `createClient()` for user-scoped reads.
- Do not commit `.env` files or secrets.
- Do not introduce `any` types — TypeScript strict mode.
