# Project Rules — LangHub

> **Nguồn chính thống duy nhất** cho mọi quy tắc kiến trúc, convention, và ràng buộc.
> LangHub là web-based localization tool (Next.js 14, Supabase, Tailwind + shadcn/ui).

---

## 1. Architecture Overview

```
Browser ──► Next.js App Router ──► API Routes ──► Supabase (PostgreSQL + Realtime + Auth)
                │
                ├── Server Components (default — fetch data directly)
                ├── Client Components ("use client" — only when needed: state, effects, events)
                └── API Routes (/app/api/**) — server-side mutations with auth validation
```

### 1.1 Allowed Import Directions

| Layer | ✅ CAN import | ❌ CANNOT import |
|---|---|---|
| `components/ui/` | `lib/utils`, Tailwind, shadcn primitives | Business logic, Supabase, API |
| `components/editor/` | `components/ui/`, `lib/utils`, `types/`, hooks | Supabase directly, API routes |
| `hooks/` | `lib/supabase/`, `types/` | `components/` |
| `lib/supabase/queries/` | Supabase client, `types/` | Components, hooks, API response helpers |
| `lib/parsers/` | `types/` only | Supabase, components, hooks |
| `lib/exporters/` | `types/`, `lib/parsers/` | Supabase, components, hooks |
| `app/api/**` | `lib/supabase/queries/`, `lib/supabase/admin`, `types/` | Components, hooks |
| `app/(dashboard)/**` | All of the above | — |

---

## 2. Supabase Rules

### 2.1 Client Usage

| Context | Client to use | Why |
|---|---|---|
| Server Components (read) | `createClient()` | User-scoped RLS |
| API Routes (mutation) | `createAdminClient()` | Bypass RLS for server-side writes |
| API Routes (read with auth) | `createClient()` | Keep user-scoped RLS |
| Client Components | `createClient()` from browser | Real-time subscriptions only |

**Critical**: New Supabase `sb_publishable_*` key format + RLS policies fail silently even with
correct INSERT policy if the wrong client is used. Server-side mutations MUST use admin client.

### 2.2 Query Organization

- ALL DB queries live in `lib/supabase/queries/` — NEVER inline in components or API handlers.
- One file per entity group: `translations.ts`, `projects.ts`, `locales.ts`, etc.
- Export named functions: `getTranslations()`, `upsertTranslation()`, `deleteKey()`, etc.
- API routes call query functions — they never call Supabase directly.

### 2.3 Auth Validation

Every API route MUST follow this pattern:
```typescript
// 1. Create client
const supabase = createClient()

// 2. Get session FIRST — before any DB call
const { data: { session } } = await supabase.auth.getSession()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 3. Then proceed with admin client for mutations
const adminClient = createAdminClient()
const result = await someQueryFunction(adminClient, params)
```

---

## 3. Translation Data Model

```
projects (id, name, slug, owner_id)
  └── locales (id, project_id, language_code, is_default)
        └── translation_keys (id, project_id, key_name [dot.notation], description, status)
              └── translations (id, key_id, locale_id, value, status [draft|approved|needs_review])
```

### 3.1 Key Rules

- Translation keys stored as `dot.notation` strings in DB (`auth.login.title`).
- On export → rebuilt to nested JSON: `{ auth: { login: { title: "..." } } }`.
- `key_name` must be unique per project.
- Status values: `draft`, `approved`, `needs_review` — no other values.

---

## 4. Parser / Exporter Rules

- `lib/parsers/` — pure functions, no side effects, no DB calls.
  - Input: raw file content (string / Buffer).
  - Output: `ParsedKey[]` (flat list of `{ key: string, value: string }`).
- `lib/exporters/` — pure functions, no side effects, no DB calls.
  - Input: flat `TranslationEntry[]`.
  - Output: serialized string (JSON / YAML / PO / etc.).
- Parsers and exporters must be independently testable with no mocks.
- Supported formats: JSON, YAML, PO (gettext), ARB (Flutter), XLIFF.

---

## 5. Version / Snapshot System

**Rule**: EVERY destructive operation must auto-create a snapshot BEFORE proceeding.

Destructive operations:
- Bulk import (overwrite existing translations)
- Bulk delete (delete multiple keys at once)
- Restore from snapshot

Snapshot schema:
```sql
project_versions (id, project_id, created_at, snapshot_data jsonb, created_by uuid)
```

Do NOT skip snapshot creation as an optimization. This is a hard requirement.

---

## 6. Component Rules

### 6.1 Server vs Client

- Default to Server Components — fetch data at the top, pass down as props.
- Add `"use client"` ONLY when the component needs: `useState`, `useEffect`, event handlers, browser APIs.
- Never use `"use client"` just to avoid a prop-drilling issue — fix the props.

### 6.2 Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Page | `page.tsx` (default export) | `app/(dashboard)/[projectId]/page.tsx` |
| Layout | `layout.tsx` (default export) | `app/layout.tsx` |
| Component | PascalCase (named export) | `TranslationCell.tsx` |
| Hook | `use` prefix (named export) | `useTranslations.ts` |
| Utility | camelCase (named export) | `lib/utils.ts` |
| Query | camelCase verb (named export) | `getTranslationsByLocale()` |

### 6.3 Styling

- Tailwind CSS only — no inline styles, no CSS modules, no styled-components.
- Dark theme base — use zinc palette (`zinc-900`, `zinc-800`, `zinc-700`).
- Use shadcn/ui components — do NOT re-implement existing primitives.
- Responsive: mobile-first with `sm:`, `md:`, `lg:` breakpoints.

---

## 7. API Route Rules

```
/app/api/
  ├── projects/[projectId]/
  │     ├── route.ts         (GET project, PATCH project, DELETE project)
  │     ├── locales/
  │     │     └── [localeId]/route.ts
  │     └── keys/route.ts
  ├── translations/route.ts  (GET, POST, PATCH, DELETE)
  └── import/route.ts        (POST — multipart/form-data)
```

- Route handlers export named functions: `GET`, `POST`, `PATCH`, `DELETE`.
- Always return `NextResponse.json()` — never plain Response.
- Validate input with Zod at route entry before touching DB.
- Return proper HTTP status codes: 200, 201, 400, 401, 403, 404, 500.

---

## 8. AI Translation Rules

- AI_PLACEHOLDER: All AI translate buttons/features MUST show `"Coming Soon"` toast.
- Do NOT wire up any LLM API calls in MVP.
- Placeholder components are fine — just no actual AI calls.

---

## 9. TypeScript Rules

- Strict mode — no `any`, no `@ts-ignore` without justification comment.
- All types in `src/types/index.ts` unless type is component-local.
- Use Zod for all runtime validation (API inputs, form data).
- Prefer `interface` for object shapes, `type` for unions/intersections.
- No default exports except `page.tsx` and `layout.tsx`.

---

## 10. Testing Rules

- Test parsers and exporters first — they are pure functions, easiest to test.
- Use `vitest` — not Jest.
- Test files co-located: `lib/parsers/__tests__/json.test.ts`.
- No mocking of Supabase in unit tests — use integration tests for DB logic.
- Run `pnpm typecheck` and `pnpm lint` before committing.

---

## 11. Realtime Rules

- Realtime subscriptions only for translation status updates in the editor.
- Subscribe at the page/layout level, not in individual cells.
- Always unsubscribe in cleanup (`useEffect` return function).
- Do not use Realtime for initial data load — use Server Components.

---

## 12. Verification Checklist

Before any PR:
- [ ] `pnpm typecheck` passes (0 errors)
- [ ] `pnpm lint` passes (0 errors)
- [ ] `pnpm build` passes locally
- [ ] All new API routes validate auth
- [ ] All new DB queries go through `lib/supabase/queries/`
- [ ] No direct Supabase calls in components
- [ ] Destructive ops create snapshots
- [ ] AI features show "Coming Soon" — no real API calls
