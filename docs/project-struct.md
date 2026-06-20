# Project Structure

LangHub — Next.js 14 App Router, TypeScript strict, Supabase, Tailwind + shadcn/ui.

---

## Top-level layout

```
lang_hub/
├── src/
│   ├── app/              # Next.js routes (pages + API handlers)
│   ├── components/       # React components grouped by feature
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Server-side logic (DB queries, parsers, exporters)
│   └── types/            # Shared TypeScript types
├── supabase/
│   └── migrations/       # SQL migration files
├── docs/                 # Project documentation
├── .agents/              # Shared rules for AI agents
└── .claude/              # Claude Code settings and skills
```

---

## `src/app/` — Routes

### Auth group `(auth)/`

| Route | File | Notes |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Supabase email + Google OAuth |
| `/signup` | `(auth)/signup/page.tsx` | |
| `/auth/callback` | `auth/callback/route.ts` | OAuth redirect handler |

### Dashboard group `(dashboard)/`

Protected by layout — redirects unauthenticated users to `/login`.

| Route | File | Notes |
|---|---|---|
| `/projects` | `(dashboard)/projects/page.tsx` | Project list with stats |
| `/setup` | `(dashboard)/setup/page.tsx` | First-run org + project setup |
| `/orgs/[orgId]/settings` | `(dashboard)/orgs/[orgId]/settings/page.tsx` | Org member management |
| `/[projectId]/editor` | `(dashboard)/[projectId]/editor/page.tsx` | Main translation editor |
| `/[projectId]/keys` | `(dashboard)/[projectId]/keys/page.tsx` | Key list + duplicate finder |
| `/[projectId]/versions` | `(dashboard)/[projectId]/versions/page.tsx` | Version history + diff |
| `/[projectId]/import` | `(dashboard)/[projectId]/import/page.tsx` | Import wizard |
| `/[projectId]/export` | `(dashboard)/[projectId]/export/page.tsx` | Export sheet |
| `/[projectId]/settings` | `(dashboard)/[projectId]/settings/page.tsx` | Project settings |

### API routes `api/`

All routes validate auth via `supabase.auth.getUser()` before any DB operation.
Write operations use `createAdminClient()` (service role) to bypass RLS safely.

| Route | Methods | Notes |
|---|---|---|
| `/api/auth/signout` | POST | Sign out |
| `/api/organizations` | GET, POST | List / create orgs |
| `/api/organizations/[orgId]` | PATCH, DELETE | Update / delete org |
| `/api/organizations/[orgId]/members` | GET, POST | List / add members |
| `/api/organizations/[orgId]/members/[memberId]` | PATCH, DELETE | Update role / remove member |
| `/api/projects` | GET, POST | List / create projects |
| `/api/projects/[projectId]` | PATCH, DELETE | Update / delete project |
| `/api/projects/[projectId]/locales` | POST | Add locale (single or bulk) |
| `/api/projects/[projectId]/locales/[localeId]` | DELETE | Remove locale |
| `/api/keys` | GET, POST | List keys / create key |
| `/api/keys/[keyId]` | PATCH, DELETE | Update / delete key |
| `/api/keys/[keyId]/comments` | GET, POST | Key comments |
| `/api/keys/[keyId]/history` | GET | Key edit history |
| `/api/translations` | PATCH, POST | Update single / bulk upsert (with `status` param) |
| `/api/translations/invalidate` | POST | Invalidate cache / trigger revalidation |
| `/api/import` | POST | Import file — parses + upserts keys + translations |
| `/api/export` | GET | Export translations in chosen format |
| `/api/versions` | GET, POST | List versions / create snapshot |
| `/api/versions/[versionId]` | GET | Get version detail |
| `/api/versions/[versionId]/restore` | POST | Restore to snapshot |
| `/api/duplicates` | GET | Find duplicate keys |
| `/api/locales-list` | GET | Available locale codes + names |
| `/api/health` | GET | Health check |

---

## `src/components/` — Components

### `editor/`

Core translation editor components. All are client components (`'use client'`).

| File | Role |
|---|---|
| `TranslationTable.tsx` | Main spreadsheet — virtualised rows (`@tanstack/react-virtual`), sticky columns, filter/search sidebar, bulk selection, realtime subscription |
| `TranslationCell.tsx` | Individual cell — view mode (`line-clamp-3`) and edit mode (textarea, auto-save on blur) |
| `KeyDetailPanel.tsx` | Dialog showing all locales for one key — per-locale draft, Save / Review / Approve CTAs, char limit, StatusBadge |
| `BulkActionBar.tsx` | Bottom bar when rows are selected — Review all, Approve all, Delete (with auto-snapshot) |
| `AddKeySheet.tsx` | Sheet for creating a new translation key |
| `ManageLocalesDialog.tsx` | Add / remove locales with optimistic local state |
| `StatusBadge.tsx` | Pill badge for `empty / pending / reviewed / approved` |

### `organizations/`

| File | Role |
|---|---|
| `CreateOrgDialog.tsx` | Create new org |
| `OrgSettingsClient.tsx` | Member list + invite + role management |
| `OrgSwitcher.tsx` | Dropdown to switch between orgs in the nav |

### `projects/`

| File | Role |
|---|---|
| `ProjectsPageClient.tsx` | Client shell for project list — handles org switching |
| `ProjectCard.tsx` | Project card with locale progress bars |
| `CreateProjectDialog.tsx` | Multi-step dialog: name → base locale → create |
| `ProjectSettingsClient.tsx` | Project rename / delete |

### `keys/`

| File | Role |
|---|---|
| `DuplicateFinder.tsx` | Scans for duplicate key values, merge / link actions |

### `versions/`

| File | Role |
|---|---|
| `VersionsPage.tsx` | Version list with restore button |
| `VersionDiffView.tsx` | Side-by-side diff between two snapshots |

### `import/` and `export/`

| File | Role |
|---|---|
| `ImportWizard.tsx` | 5-step import wizard (upload → detect → preview → map → confirm) |
| `ExportPageClient.tsx` | Export page layout |
| `ExportSheet.tsx` | Format + locale selector, triggers download |

### `ui/`

shadcn/ui primitives: `button`, `badge`, `card`, `dialog`, `input`, `label`, `popover`, `command`, `sheet`, `slider`.
Custom: `LocaleCombobox.tsx` (searchable locale picker with flag + name).

---

## `src/hooks/`

| File | Role |
|---|---|
| `useRealtime.ts` | Subscribe to Supabase Realtime channel for a table + filter |
| `usePresence.ts` | Track online users in the same project (Supabase Presence) |

---

## `src/lib/` — Server-side logic

### `supabase/`

| File | Role |
|---|---|
| `server.ts` | `createClient()` — user-scoped client (anon key + cookies), used for auth checks |
| `client.ts` | `createBrowserClient()` — browser-side client |
| `admin.ts` | `createAdminClient()` — service role key, bypasses RLS, used for all mutations |
| `auth.ts` | Auth helpers (getUser, requireUser) |

### `supabase/queries/`

All DB access goes through these functions — components never call Supabase directly.

| File | Exports |
|---|---|
| `projects.ts` | `getProjects`, `getProjectsByOrg`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `addLocale`, `removeLocale` + stat helpers |
| `keys.ts` | `getKeys`, `createKey`, `updateKey`, `deleteKey`, `bulkDeleteKeys` |
| `translations.ts` | `updateTranslation`, `bulkUpsertTranslations` |
| `organizations.ts` | `getOrgs`, `getOrg`, `createOrg`, `updateOrg`, `deleteOrg`, `getMembers`, `addMember`, `updateMemberRole`, `removeMember` |

### `parsers/` and `exporters/`

Pure functions — no side effects, no Supabase calls.

| Format | Parser | Exporter |
|---|---|---|
| JSON | `parsers/json.ts` | `exporters/json.ts` |
| YAML | `parsers/yaml.ts` | `exporters/yaml.ts` |
| ARB (Flutter) | `parsers/arb.ts` | `exporters/arb.ts` |
| CSV | `parsers/csv.ts` | `exporters/csv.ts` |
| ZIP (multi-locale) | — | `exporters/zip.ts` |

Translation keys are stored as `dot.notation` strings in the DB and rebuilt to nested objects on export.

### `lib/locale-flag.ts`

Maps locale codes to flag emoji using Unicode regional indicator characters.

---

## `src/types/`

| File | Key types |
|---|---|
| `index.ts` | `TranslationStatus`, `TranslationKey`, `Translation`, `LocaleWithStats`, `ProjectWithStats`, `OrgWithStats`, `OrgMember`, `FilterState`, `MemberRole`, `VersionTag` |
| `database.ts` | Auto-generated from Supabase schema via `pnpm db:types` — do not edit manually |

---

## Status workflow

```
empty ──→ pending ──→ reviewed ──→ approved
             ↑_________________________________↑
             (editing a reviewed/approved cell resets to pending)
```

- A key's **overall status** is derived from all non-base locale translations via `keyOverallStatus()`
- Base locale behaves like any other locale — requires explicit Review + Approve CTAs
- Stats (sidebar counts, progress bars, project cards) exclude the base locale from percent calculations

---

## Architecture rules

- **No direct Supabase calls in components** — always go through `lib/supabase/queries/`
- **Admin client only in API routes** — after auth is validated via `getUser()`
- **Server Components by default** — `'use client'` only when interactivity is needed
- **Auto-snapshot before every destructive operation** — import, bulk delete, restore
- **AI translate** — not implemented in MVP; buttons show "Coming Soon" toast
