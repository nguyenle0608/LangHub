# 🌐 LangHub — Master Project Document
> **Tài liệu tổng hợp đầy đủ** — đọc file này là đủ context để tiếp tục dự án trên bất kỳ device nào.
> Cập nhật lần cuối: Jun 2026 | Version: Plan v2

---

## 1. TỔNG QUAN DỰ ÁN

### Là gì?
**LangHub** — Web-based Localization Management Tool, tương tự Lokalise / Gridly.
Giúp team quản lý bản dịch (multi-language) cho Mobile App và Web App một cách chuyên nghiệp.

### Tại sao build?
Thay thế quy trình thủ công (Excel, file JSON rải rác, copy-paste) bằng một platform tập trung:
đội dev, designer, translator cùng làm việc trên một tool duy nhất.

### Target users
- Mobile developers (Flutter/iOS/Android) cần quản lý `.arb`, `.strings`, `.json`
- Web developers cần quản lý `i18n JSON`, `YAML`
- Translator / Localization manager review và approve bản dịch
- PM / Product Owner theo dõi tiến độ dịch thuật

### Định hướng sản phẩm
- **MVP**: Internal tool → dùng cho team nhỏ (<10 người), host trên Vercel free
- **Phase sau**: SaaS public với billing (Stripe), CLI tool, GitHub integration
- **Benchmarks**: Lokalise (UX/workflow), Gridly (spreadsheet editor layout)

---

## 2. TECH STACK

| Layer | Công nghệ | Lý do chọn |
|---|---|---|
| Frontend + API | Next.js 14 (App Router, TypeScript strict) | 1 repo, SSR, API Routes built-in |
| Database | Supabase PostgreSQL | Free tier, Realtime + Auth sẵn có |
| Realtime / Auth | Supabase Realtime + Auth | Presence, live sync, Google OAuth |
| UI | Tailwind CSS + shadcn/ui | Dark theme, zinc base, accessible |
| Deploy | Vercel | Free, auto CI/CD từ GitHub push |
| Package manager | pnpm | Nhanh hơn npm/yarn |
| Validation | Zod | Type-safe validation cho form + API |
| Testing | Vitest | Fast, compatible với Next.js |
| **AI Engine** | ~~OpenAI / Anthropic~~ | **Không có trong MVP** — Phase 8 sau |

### Dependencies MVP (không có AI packages)
```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "^18",
    "typescript": "^5",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.4",
    "tailwindcss": "^3",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "class-variance-authority": "^0.7",
    "zod": "^3",
    "js-yaml": "^4",
    "papaparse": "^5",
    "jszip": "^3",
    "@tanstack/react-virtual": "^3",
    "sonner": "^1"
  },
  "devDependencies": {
    "vitest": "^1",
    "@testing-library/react": "^15"
  }
}
```

### Environment Variables
```bash
# .env.local (gitignored) — copy từ .env.example
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # server-side only, NEVER expose

NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI — KHÔNG dùng trong MVP, thêm khi làm Phase 8
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

---

## 3. KIẾN TRÚC & TÍNH NĂNG CORE

### 3.1 Các tính năng MVP (7 Phases)

| # | Feature | Mô tả |
|---|---|---|
| ✅ | **Auth** | Login/Signup email+password + Google OAuth, protected routes |
| ✅ | **Project Management** | Tạo project, thêm/xoá locales, mời member theo role |
| ✅ | **Translation Editor** | Spreadsheet-style table (key × locale), inline edit, realtime sync |
| ✅ | **Key Management** | Add key (dot.notation), Duplicate Finder (merge/link/delete), Key Detail panel |
| ✅ | **Version System** | Git-tag-style snapshot, diff viewer, selective restore |
| ✅ | **Import** | JSON (nested/flat), ARB (Flutter), CSV (multi-locale), YAML |
| ✅ | **Export** | JSON, ARB, CSV, YAML, ZIP multi-locale |
| 🔮 | **AI Engine** | Tách riêng Phase 8 — hiện tại chỉ "Coming Soon" button |

### 3.2 Quyết định kiến trúc quan trọng

**Nested JSON → Flat DB → Rebuild on Export**
```
Input:  { "auth": { "login": { "title": "Sign In" } } }
DB:     key = "auth.login.title", value = "Sign In"
Export: rebuild → { "auth": { "login": { "title": "Sign In" } } }
```

**Translation Status Flow**
```
empty → pending → reviewed → approved
                           ↑
               (AI suggestion field: ai_suggestion, ai_model — placeholder cho Phase 8)
```

**Version System — giống Git tags**
- Mỗi version = snapshot toàn bộ translations tại 1 thời điểm
- Lưu `key_name` và `locale_code` dạng text (không chỉ FK) → historical record không bị mất khi rename
- Auto-snapshot tự động tạo TRƯỚC mọi destructive operation (import, bulk delete, restore)
- Diff viewer: compare 2 versions, hiện changed/added/removed

**AI Engine — tách hoàn toàn khỏi MVP**
- Button "✨ AI Translate" hiển thị nhưng show "Coming Soon" toast
- DB schema đã có sẵn columns: `ai_suggestion`, `ai_model`, `ai_suggested_at`
- Khi làm Phase 8: thêm `lib/ai/translate.ts` + openai/anthropic packages

### 3.3 Roles & Permissions

| Role | Quyền |
|---|---|
| owner | Toàn quyền, xoá project, billing |
| admin | Manage members, tạo/xoá keys, restore versions |
| translator | Edit translations, comment |
| viewer | Chỉ đọc, export |

---

## 4. DATABASE SCHEMA

### Migration 001 — Core Schema

```sql
-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'free' check (plan in ('free','pro','enterprise')),
  created_at timestamptz default now()
);

-- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  base_locale text default 'en',
  created_at timestamptz default now(),
  unique(org_id, slug)
);

-- locales per project
create table locales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  code text not null,        -- 'vi', 'ja', 'ko', 'fr'
  name text not null,        -- 'Tiếng Việt'
  is_base boolean default false,
  created_at timestamptz default now(),
  unique(project_id, code)
);

-- translation keys (dot.notation)
create table translation_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  key text not null,                    -- 'auth.login.button'
  description text,
  tags text[] default '{}',
  platforms text[] default '{}',        -- ['ios','android','web']
  char_limit int,
  is_plural boolean default false,
  plural_forms jsonb,                   -- {zero:'',one:'%d item',other:'%d items'}
  reference_key_id uuid references translation_keys(id),  -- for key linking
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(project_id, key)
);

-- translations (value per key per locale)
create table translations (
  id uuid primary key default gen_random_uuid(),
  key_id uuid references translation_keys(id) on delete cascade,
  locale_id uuid references locales(id) on delete cascade,
  value text,
  status text default 'empty'
    check (status in ('empty','pending','reviewed','approved')),
  -- AI placeholders (Phase 8)
  ai_suggestion text,
  ai_model text,
  ai_suggested_at timestamptz,
  translated_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  unique(key_id, locale_id)
);

-- audit log
create table translation_history (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid references translations(id) on delete cascade,
  old_value text,
  new_value text,
  old_status text,
  new_status text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);

-- members
create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'translator'
    check (role in ('owner','admin','translator','viewer')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- indexes
create index idx_translation_keys_project on translation_keys(project_id);
create index idx_translations_key_locale on translations(key_id, locale_id);
create index idx_translations_status on translations(status);
create index idx_translation_keys_tags on translation_keys using gin(tags);

-- RLS
alter table organizations enable row level security;
alter table projects enable row level security;
alter table translation_keys enable row level security;
alter table translations enable row level security;

-- Realtime
alter publication supabase_realtime add table translations;
```

### Migration 002 — Version System

```sql
-- versions (= Git tags cho translations)
create table versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,          -- 'v1.0', 'Before import March', 'Sprint 12'
  description text,
  tag text,                    -- 'manual' | 'auto_import' | 'auto_bulk_delete' | 'auto_before_restore'
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- snapshot data (copy toàn bộ translations tại thời điểm tạo version)
create table version_snapshots (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references versions(id) on delete cascade,
  key_id uuid references translation_keys(id) on delete cascade,
  locale_id uuid references locales(id) on delete cascade,
  key_name text not null,      -- lưu lại tên key phòng khi bị rename
  locale_code text not null,   -- lưu lại locale code phòng khi bị xoá
  value text,
  status text,
  unique(version_id, key_id, locale_id)
);

-- stats cache (tránh query toàn bộ snapshots)
create table version_stats (
  version_id uuid primary key references versions(id) on delete cascade,
  total_keys int default 0,
  total_locales int default 0,
  approved_count int default 0,
  pending_count int default 0,
  empty_count int default 0
);

create index idx_versions_project on versions(project_id);
create index idx_version_snapshots_version on version_snapshots(version_id);
```

---

## 5. FOLDER STRUCTURE

```
langhub/
├── CLAUDE.md                          ← Claude Code đọc file này đầu tiên
├── .env.local                         ← gitignored
├── .env.example
├── package.json
├── next.config.ts
├── tailwind.config.ts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 ← root layout + providers
│   │   ├── page.tsx                   ← redirect → /projects
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             ← dashboard shell + nav
│   │   │   ├── projects/page.tsx      ← project list (grid cards)
│   │   │   └── [projectId]/
│   │   │       ├── layout.tsx         ← project nav sidebar
│   │   │       ├── editor/page.tsx    ★ main translation table
│   │   │       ├── import/page.tsx    ← import wizard
│   │   │       ├── export/page.tsx    ← export dialog
│   │   │       ├── keys/page.tsx      ← key management + dup finder
│   │   │       ├── versions/page.tsx  ★ version history + diff
│   │   │       └── settings/page.tsx
│   │   └── api/
│   │       ├── projects/route.ts
│   │       ├── keys/route.ts
│   │       ├── translations/route.ts
│   │       ├── import/route.ts
│   │       ├── export/route.ts
│   │       ├── health/route.ts        ← {status:'ok'}
│   │       └── versions/
│   │           ├── route.ts           ← GET list, POST create
│   │           └── [versionId]/
│   │               ├── route.ts       ← GET detail, DELETE
│   │               └── restore/route.ts
│   │
│   ├── components/
│   │   ├── editor/
│   │   │   ├── TranslationTable.tsx   ← main grid (virtualized)
│   │   │   ├── KeyRow.tsx
│   │   │   ├── TranslationCell.tsx    ← inline edit + char counter
│   │   │   ├── StatusBadge.tsx
│   │   │   └── BulkActionBar.tsx
│   │   ├── keys/
│   │   │   ├── AddKeyForm.tsx         ← sheet, dot.notation, live preview
│   │   │   ├── DuplicateFinder.tsx    ← group by value, merge/link/delete
│   │   │   └── KeyDetailPanel.tsx     ← right panel: history/comments/info
│   │   ├── versions/
│   │   │   ├── VersionList.tsx
│   │   │   ├── VersionCard.tsx        ← manual vs auto visual distinction
│   │   │   ├── VersionDiffView.tsx    ← changed/added/removed color coded
│   │   │   ├── CreateVersionDialog.tsx
│   │   │   └── RestoreVersionDialog.tsx
│   │   ├── import/
│   │   │   └── ImportWizard.tsx       ← 5-step: upload→config→preview→import→done
│   │   ├── export/
│   │   │   └── ExportDialog.tsx       ← sheet: locale select, format, filter
│   │   └── ui/                        ← shadcn/ui components
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              ← browser client
│   │   │   ├── server.ts              ← server/RSC client
│   │   │   └── queries/
│   │   │       ├── projects.ts
│   │   │       ├── keys.ts
│   │   │       ├── translations.ts
│   │   │       └── versions.ts
│   │   ├── parsers/                   ← pure functions, testable
│   │   │   ├── json.ts                ← flatten nested ↔ dot.notation
│   │   │   ├── arb.ts                 ← Flutter, @@locale detection
│   │   │   ├── csv.ts                 ← multi-locale columns
│   │   │   ├── yaml.ts
│   │   │   └── __tests__/
│   │   ├── exporters/                 ← mirror của parsers
│   │   │   ├── json.ts, arb.ts, csv.ts, yaml.ts, zip.ts
│   │   └── versions/
│   │       ├── snapshot.ts            ← createSnapshot(), restoreSnapshot()
│   │       └── diff.ts                ← diffVersions() → DiffEntry[]
│   │
│   ├── hooks/
│   │   ├── useTranslations.ts
│   │   ├── useRealtime.ts             ← Supabase Realtime subscription
│   │   └── usePresence.ts             ← who is editing which key
│   │
│   └── types/
│       ├── database.ts                ← generated: pnpm db:types
│       └── index.ts                   ← app-level types
│
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql
        └── 002_versions_schema.sql
```

---

## 6. CLAUDE.md (file đặt ở root project)

> Copy nguyên đoạn này vào file `CLAUDE.md` ở root khi bắt đầu project.
> Claude Code tự đọc file này mỗi khi bắt đầu session.

```markdown
# LangHub — Localization Management Tool

## Project Overview
Web-based localization tool for managing multi-language translations.
Similar to Lokalise / Gridly. Target: Mobile App & Web App developers.
AI Translation is a FUTURE feature — do NOT implement AI calls in MVP.

## Tech Stack
- Framework: Next.js 14 (App Router, TypeScript strict)
- Database: Supabase (PostgreSQL + Realtime + Auth)
- Styling: Tailwind CSS + shadcn/ui (dark theme, zinc base)
- Deploy: Vercel
- Package manager: pnpm

## Key Commands
- pnpm dev           → start dev server (localhost:3000)
- pnpm build         → production build
- pnpm lint          → eslint check
- pnpm typecheck     → tsc --noEmit
- pnpm test          → vitest
- pnpm db:push       → supabase db push (apply migrations)
- pnpm db:types      → generate TypeScript types from Supabase

## Coding Conventions
- TypeScript strict mode, no `any`
- Functional components only, no class components
- Named exports (no default exports except page.tsx/layout.tsx)
- Tailwind for all styling, no inline styles
- Server Components by default, "use client" only when needed
- Zod for all form validation and API input validation
- Error boundaries on all major page sections

## Critical Rules
- NEVER commit .env files
- All DB queries go through lib/supabase/queries/ — NOT direct calls in components
- All API routes must validate auth before any DB operation
- Parser/Exporter logic in lib/parsers/ and lib/exporters/ (pure functions, no side effects)
- Translation keys stored as dot.notation in DB, rebuilt to nested on export
- AI_PLACEHOLDER: Any AI translate button shows "Coming Soon" toast — do not wire up
- Version system: EVERY destructive operation (import, bulk delete, restore)
  must auto-create a snapshot BEFORE proceeding
```

---

## 7. BUILD PLAN — 8 PHASES

### Timeline tổng quan

| Phase | Nội dung | Thời gian | Ghi chú |
|---|---|---|---|
| 0 | Project Setup | 30 phút | Scaffold, config |
| 1 | Database + Auth | 2-3 giờ | Schema, login/signup |
| 2 | Project & Locale Management | 2-3 giờ | CRUD, stats |
| 3 | Translation Editor ⭐ | 4-5 giờ | Core feature |
| 4 | Key Management | 3-4 giờ | Add, dup finder, detail panel |
| 5 | Version System ⭐ | 3-4 giờ | Snapshot, diff, restore |
| 6 | Import / Export | 3-4 giờ | Parsers + exporters |
| 7 | Polish + Deploy | 2-3 giờ | Production ready |
| 8 | AI Engine | tích hợp sau | POST-MVP |
| **Total MVP** | | **~22-26 giờ** | |

---

### PHASE 0 — Project Setup

**Mục tiêu:** Scaffold Next.js + Supabase + shadcn/ui, sẵn sàng code

```
Claude Code Prompt:

"Set up a new Next.js 14 project called 'langhub' with:
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui (init with dark theme, zinc base color)
- pnpm as package manager
- Supabase client (@supabase/supabase-js, @supabase/ssr)
- Zod for validation
- Vitest for unit tests

Create:
- lib/supabase/client.ts  → browser Supabase client
- lib/supabase/server.ts  → server/RSC Supabase client
- src/types/database.ts   → placeholder
- .env.example with all required vars
- Full folder structure as defined in CLAUDE.md
- Do NOT create any pages yet"
```

✅ **Checklist:** `pnpm dev` runs · shadcn dark theme works · folders created

---

### PHASE 1 — Database + Auth

**Mục tiêu:** Schema apply lên Supabase + Auth pages

```
Claude Code Prompt — Step 1 (Schema):

"Create migration files:
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_versions_schema.sql
(SQL content đã có trong MASTER PLAN section 4)

Run: pnpm db:push
Then: pnpm db:types"
```

```
Claude Code Prompt — Step 2 (Auth):

"Create Auth pages:
- app/(auth)/login/page.tsx   → email+password + Google OAuth button
- app/(auth)/signup/page.tsx  → email+password + confirm password
- app/(auth)/layout.tsx       → centered card layout, dark, LangHub logo
- lib/supabase/auth.ts        → signIn, signUp, signOut, getUser helpers
- middleware.ts               → protect /dashboard/* routes, redirect /login

Use shadcn Card, Input, Button, Label.
On login success → redirect to /projects."
```

✅ **Checklist:** Migrations applied · Login/signup works · Protected routes redirect

---

### PHASE 2 — Project & Locale Management

```
Claude Code Prompt:

"Build Projects dashboard:

1. lib/supabase/queries/projects.ts
   - getProjects(userId): list projects + stats (key count, locale count, completion %)
   - createProject(data): insert org + project + base locale in 1 transaction
   - getProject(projectId): single project with locales list

2. app/(dashboard)/projects/page.tsx (Server Component)
   - Grid of ProjectCard components
   - 'New Project' button → CreateProjectDialog (shadcn Dialog)

3. components/projects/ProjectCard.tsx
   - Name, locale flags row, key count, overall completion % progress bar
   - Color: green >80%, yellow 50-80%, red <50%
   - Click → navigate to /[projectId]/editor

4. app/(dashboard)/[projectId]/settings/page.tsx
   - Edit name/description
   - Locale management: list with %, add locale (select from common list), remove (warn)
   - Danger zone: Delete Project (type name to confirm)"
```

✅ **Checklist:** Create project · Add locales (vi, ja, ko) · Stats show correctly

---

### PHASE 3 — Translation Editor ⭐ Core

```
Claude Code Prompt — Step 1 (Data layer):

"Build translation queries and API:

1. lib/supabase/queries/translations.ts
   - getTranslationKeys(projectId, filters?): keys + translations all locales joined
     Filters: status | tags | search (key name OR value) | locale
   - updateTranslation(keyId, localeId, value, status):
     upsert translations + insert translation_history row
   - createTranslationKey(data): insert key + create empty translation rows for all locales

2. app/api/translations/route.ts
   PATCH: auth check → Zod validate → upsert → history → return updated

3. src/types/index.ts
   TranslationKey, Translation, TranslationStatus, LocaleWithStats, FilterState"
```

```
Claude Code Prompt — Step 2 (Table UI):

"Build Translation Table at app/(dashboard)/[projectId]/editor/page.tsx

Layout (Gridly/Lokalise style, full viewport):
┌─ TopNav 48px ─────────────────────────────────────────────────┐
├─ Toolbar 44px ────────────────────────────────────────────────┤
├─ StatsBar 36px ───────────────────────────────────────────────┤
├─ PresenceBar 28px (blue tint, realtime) ──────────────────────┤
│                                                                │
│  Sidebar 220px  │  Table flex-1 (overflow-x scroll)  │ Panel 300px │
└────────────────────────────────────────────────────────────────┘

TopNav:
- Logo + breadcrumb (Org / Project / Version)
- Progress bar 'Overall 72%'
- Import btn | Export btn | 'AI Translate' btn (disabled, Coming Soon tooltip) | Avatar

Toolbar:
- Search input | Filter chips [All][Untranslated][Pending] | +Add Key | Bulk | Columns

StatsBar: 179 Approved · 31 Untranslated · 14 Pending · 24 In Review

PresenceBar: colored dots + 'Minh Tuấn is editing auth.login.button'

Left Sidebar:
- Nav: All Keys, Untranslated (warn badge), Pending (warn badge), Activity Log, Screenshots, Glossary
- Tags: list with counts
- Languages: each locale row with flag + name + % badge colored

Table:
- Sticky header: [☐] Key/Desc | Tags | 🇺🇸 EN (Base) | 🇻🇳 VI 96% | 🇯🇵 JA 78% | Status
- Virtualized rows (@tanstack/react-virtual)
- Row states: default / hover (show Edit+Copy) / selected (blue bg) / editing (border-left blue)
- TranslationCell: click → textarea inline, Ctrl+Enter save, Escape cancel
- Char counter if key.char_limit set

Right Panel (shown on row click):
- Header: key name (mono), description, tags, char limit
- Tabs: History | Comments | Screenshot | TM
- History: timeline with avatars, old→new value, locale badge
- Comments: textarea + Post button"
```

```
Claude Code Prompt — Step 3 (Realtime + Presence):

"Add Supabase Realtime to TranslationTable:

1. hooks/useRealtime.ts
   - Subscribe to translations table for current projectId
   - On UPDATE/INSERT: patch local state without full refetch
   - Cleanup on unmount

2. hooks/usePresence.ts
   - Supabase Realtime Presence channel per project
   - Track: { userId, userName, keyId, localeId } on cell focus
   - Broadcast clear on cell blur
   - Show in PresenceBar above table
   - Show faint colored border on cell another user is editing

Wire both into TranslationTable.tsx"
```

✅ **Checklist:** Table renders · Inline edit+save · Filter works · 2 tabs sync realtime · Presence bar shows

---

### PHASE 4 — Key Management

```
Claude Code Prompt — Step 1 (Add Key Form):

"Build AddKeyForm as a right-side Sheet (slides from right, 640px wide):

Fields:
- Key name: mono font, validate /^[a-z0-9_.]+$/, unique in project
  Auto-suggest namespace from existing keys (combobox)
- Description: textarea, max 500 chars
- Tags: multi-select with existing + create new
- Platform: checkbox [iOS][Android][Web][Desktop]
- Char limit: number input + range slider (optional)
- Plural forms: toggle → show zero/one/other table
- Base value (EN): text input

Right side live preview:
- JSON nested output (syntax highlighted)
- ARB output
- Key summary card

On save: POST /api/keys → add key + empty translations all locales → flash row in table"
```

```
Claude Code Prompt — Step 2 (Duplicate Finder):

"Build Duplicate Finder at app/(dashboard)/[projectId]/keys/page.tsx (tab view)

1. lib/supabase/queries/keys.ts
   findDuplicateGroups(projectId):
     GROUP BY base locale value, HAVING count > 1
   mergeKeys(parentKeyId, childKeyIds):
     AUTO-CREATE version snapshot first (tag='auto_merge')
     Delete child keys (cascade)
   linkKeys(parentKeyId, childKeyId):
     SET reference_key_id = parentKeyId on child (do not delete)

2. UI:
   - Yellow banner: 'X duplicate groups found → saves Y translation efforts'
   - Strategy explanation cards: Link / Merge / Delete
   - Per group: shared value + radio to pick Parent + per-child actions
   - 'Merge All' → confirm dialog → auto-snapshot → execute"
```

```
Claude Code Prompt — Step 3 (Key Detail Panel):

"Extend KeyDetailPanel with:

Tab History:
- translation_history for all locales of this key
- Timeline with avatar dot + name + time + locale badge + new→old value
- [↩ Restore] per history row → confirm → restore that locale value

Tab Comments:
- Create migration: comments(id, key_id, user_id, message, created_at)
- List + textarea + Post button

Tab Info:
- Created by/at, platforms, char limit, tags (inline editable)
- Rename key input + Save
- Referenced by: list of keys that link to this one
- [🗑 Delete Key] danger button"
```

✅ **Checklist:** Add key validates · Dup groups correct · Merge auto-snapshots · Right panel tabs work

---

### PHASE 5 — Version System ⭐

```
Claude Code Prompt — Step 1 (Core Logic):

"Build version/snapshot system at lib/versions/:

lib/versions/snapshot.ts:

createSnapshot(projectId, userId, { name, description, tag }):
  1. BEGIN transaction
  2. INSERT into versions
  3. SELECT all translations + keys + locales for this project
  4. Bulk INSERT into version_snapshots
     (key_name and locale_code stored as TEXT, not just FKs)
  5. Compute stats → INSERT version_stats
  6. COMMIT
  Returns: version with stats

restoreSnapshot(versionId, projectId, userId, options):
  options: { scope: 'all'|'locale'|'keys', localeId?, keyIds?, createBackupFirst: boolean }
  1. If createBackupFirst → createSnapshot(tag='auto_before_restore')
  2. Fetch version_snapshots filtered by options
  3. For each: UPSERT translations + INSERT translation_history
  4. Return { restored: number, skipped: number, backupVersionId? }

lib/versions/diff.ts:

diffVersions(versionIdA, versionIdB | 'current'):
  type DiffEntry = {
    key_name: string
    locale_code: string
    type: 'added' | 'removed' | 'changed' | 'unchanged'
    valueA: string | null
    valueB: string | null
    statusA: string | null
    statusB: string | null
  }
  1. Fetch snapshots A → Map<key+locale, snapshot>
  2. Fetch snapshots B (or current translations if 'current') → Map
  3. Union all keys, classify each
  4. Return sorted: changed first, then added, then removed"
```

```
Claude Code Prompt — Step 2 (API Routes):

"Build version API:

app/api/versions/route.ts
  GET  ?projectId=  → getVersions list with stats
  POST { projectId, name, description } → createSnapshot() → return version

app/api/versions/[versionId]/route.ts
  GET    → version detail + snapshot rows (paginated 50/page)
  DELETE → owner/admin only, manual versions only

app/api/versions/[versionId]/restore/route.ts
  POST { scope, localeId?, keyIds?, createBackupFirst }
       → auth check (admin+)
       → restoreSnapshot()
       → return { restored, skipped, backupVersionId }"
```

```
Claude Code Prompt — Step 3 (Version List UI):

"Build Versions page at app/(dashboard)/[projectId]/versions/page.tsx

Layout: 2-column
  Left 380px: version list  |  Right flex-1: diff viewer

VersionList:
  'Create Version' button → CreateVersionDialog
  Sorted newest first, search by name
  Visual distinction: 🏷 manual (blue outline) vs ⚡ auto (gray, smaller)

VersionCard shows:
  ┌────────────────────────────────────────────────────┐
  │ 🏷 v1.2.0 — Before Sprint 14               [···]  │
  │ Minh Tuấn · Jun 14, 2026 · 14:32                  │
  │ 'Snapshot before importing new marketing copy'     │
  │ 248 keys · 6 locales                               │
  │ ████████░░ 179 ✅  31 ⏳  38 ○                    │
  │ [↩ Restore]  [🔍 View Diff]  [⬇ Export]           │
  └────────────────────────────────────────────────────┘
  Auto-snapshot cards: smaller, no delete button, gray

CreateVersionDialog:
  Name input (required), description textarea
  Preview: 'Will snapshot 248 keys × 6 locales = 1,488 records'"
```

```
Claude Code Prompt — Step 4 (Diff Viewer):

"Build VersionDiffView at components/versions/VersionDiffView.tsx

Controls bar:
  Compare: [v1.2.0 ▾] ↔ [Current State ▾]
  Filter: [All ▾] Locale: [All ▾] [🔍 search key]
  Summary: '12 changed · 3 added · 1 removed · 232 same'
  [↩ Restore to v1.2.0] button right

Diff table columns: Key | Locale | Before | After
Row colors:
  Yellow left-border + strikethrough Before = changed
  Green subtle bg = added (Before empty)
  Red subtle bg = removed (After empty, deleted key)

[Show 232 unchanged ▾] collapsed toggle

RestoreVersionDialog:
  Scope: [All] [Specific locale] [Specific keys]
  Warning: 'A backup snapshot will be created first'
  Checkbox: createBackupFirst (default on)"
```

```
Claude Code Prompt — Step 5 (Auto-snapshot Triggers):

"Wire auto-snapshots into destructive operations:

1. app/api/import/route.ts — BEFORE processing:
   createSnapshot({ name: 'Auto: Before import ' + filename, tag: 'auto_import' })

2. app/api/keys/route.ts — DELETE bulk handler:
   createSnapshot({ name: 'Auto: Before deleting ' + count + ' keys', tag: 'auto_bulk_delete' })

3. ImportWizard.tsx Step 3 (Confirm):
   Show blue info box: '⚡ Auto-snapshot will be created before import'
   Optional checkbox: 'Also create named version' → name input

4. BulkActionBar.tsx when Delete selected:
   Show confirm dialog:
   '⚠️ Delete 5 keys? A snapshot will be created automatically.'
   [Cancel] [Create Snapshot & Delete]"
```

✅ **Checklist:** Create snapshot · Version list + stats · Diff viewer correct colors · Restore + auto-backup · Import/delete auto-snapshot

---

### PHASE 6 — Import / Export

```
Claude Code Prompt — Step 1 (Parsers):

"Build pure TypeScript parsers at lib/parsers/:

type ParseResult = {
  keys: Record<string, string>   // dot.notation → value
  locale?: string                // detected locale code
  errors: string[]
  warnings: string[]
}

lib/parsers/json.ts — parseJSON(content): ParseResult
  Auto-detect nested vs flat
  Flatten: {auth:{login:{title:'x'}}} → {'auth.login.title':'x'}

lib/parsers/arb.ts — parseARB(content): ParseResult
  Skip @-prefixed metadata keys
  Extract @@locale → result.locale

lib/parsers/csv.ts — parseCSV(content): ParseResult[]
  First col = 'key', remaining = locale codes
  Return one ParseResult per locale column (papaparse)

lib/parsers/yaml.ts — parseYAML(content): ParseResult
  Same flattening as JSON (js-yaml)

lib/parsers/__tests__/parsers.test.ts — 3 tests per parser (vitest)"
```

```
Claude Code Prompt — Step 2 (Exporters):

"Build exporters at lib/exporters/:

json.ts  — exportJSON(keys, nested=true): string
  Rebuild dot.notation → nested → JSON.stringify(2)

arb.ts   — exportARB(keys, locale, descriptions?): string
  @@locale header, @key metadata blocks

csv.ts   — exportCSV(rows: {key, locales}[]): string
  Header row: key + locale codes

yaml.ts  — exportYAML(keys): string
  Rebuild nested, js-yaml dump

zip.ts   — exportZIP(files: {name,content}[]): Promise<Buffer>
  jszip, return buffer"
```

```
Claude Code Prompt — Step 3 (Import Wizard):

"Build ImportWizard at app/(dashboard)/[projectId]/import/page.tsx
5-step wizard with step indicator at top.

Step 1 Upload: drag&drop, detect format from extension
Step 2 Configure: locale mapping (JSON→select, ARB→auto-detect, CSV→column map), namespace prefix
Step 3 Preview:
  - Parse client-side, show table
  - Conflict badges: 🔵 New | 🟡 Update | ⚫ Skip
  - '⚡ Auto-snapshot will be created before import'
  - Optional named version checkbox
Step 4 Import: POST /api/import, progress bar
Step 5 Done: summary + [View in Editor]"
```

```
Claude Code Prompt — Step 4 (Export Dialog):

"Build ExportDialog as right Sheet:
- Section 1: Select locales (checkboxes + flag + %)
- Section 2: Format radio (JSON/ARB/CSV/YAML) + sub-options
- Section 3: Filter (All/Approved only/Reviewed+Approved/Tags)
- Section 4: Preview ('3 files in ZIP')
- Export button → POST /api/export → download file/ZIP"
```

✅ **Checklist:** Parse nested JSON · ARB @@locale detection · CSV multi-locale · Export nested JSON · ZIP 3 locales · Conflict detection

---

### PHASE 7 — Polish & Deploy

```
Claude Code Prompt — Step 1 (Polish):

"Add finishing touches:
1. Loading: Skeleton rows in TranslationTable, skeleton cards on Projects
2. Empty states (inline SVG illustration):
   - No projects: 'Create your first project'
   - No keys: 'Import a file or add your first key'
   - No versions: 'No snapshots yet — create one before your next import'
   - No diff changes: '✓ No differences'
3. Toast (sonner): import success, translation saved (debounced 5s), version created/restored
4. Keyboard shortcuts (show in ? dialog):
   - Ctrl+K: open Add Key
   - Ctrl+Enter: save cell edit
   - Escape: close panels
   - Ctrl+Z: undo last translation change
   - Ctrl+S: create snapshot (on versions page)
5. Versions nav link in project sidebar with snapshot count badge"
```

```
Claude Code Prompt — Step 2 (Deploy):

"Production checklist:
1. pnpm build — fix all errors
2. pnpm typecheck — zero errors
3. app/api/health/route.ts → {status:'ok', timestamp, version:'1.0.0'}
4. Verify all env vars in .env.example
5. Create README.md with setup + deploy instructions"
```

✅ **Deploy checklist:** `pnpm build` 0 errors · `pnpm typecheck` 0 errors · Vercel connected GitHub · Supabase production URL · Full flow test

---

### PHASE 8 — AI Engine (POST-MVP)

> Tích hợp SAU khi MVP stable và được dùng thực tế.

**Chuẩn bị đã có sẵn trong MVP:**
- DB columns: `translations.ai_suggestion`, `ai_model`, `ai_suggested_at`
- Button "✨ AI Translate" đã có trong toolbar (show "Coming Soon" toast)
- Architecture sẵn sàng để thêm `lib/ai/translate.ts`

**Scope Phase 8:**
- Thêm packages: `openai@^4`, `@anthropic-ai/sdk@^0.24`
- `lib/ai/translate.ts` — wrapper pluggable (OpenAI GPT-4o hoặc Claude)
- Wire up AI Translate button → batch translate missing strings
- Review flow: `ai_suggestion` hiển thị inline, Accept/Reject per cell
- Translation Memory: tìm similar strings trong project
- Glossary: inject vào AI prompt để thuật ngữ nhất quán

---

## 8. UI DESIGN APPROACH

### Wireframe hay Prototype luôn?
**→ Prototype luôn.** Bỏ qua Figma wireframe truyền thống.

| Workflow cũ | Với Claude |
|---|---|
| Brief → Wireframe (1-2 ngày) → Review → Hi-fi (2-3 ngày) → Dev | Brief → HTML Prototype (30 phút) → Iterate |
| Feedback trên static image | Feedback trên UI chạy được thật |
| Context mất khi handoff | Handoff Claude Code → dùng luôn code đó |

**Exception:** Khi chưa chắc về information architecture → hỏi Claude map user flow dạng text/ASCII trước.

### Workflow 3 bước
```
1. Flow Diagram     (10 phút)  → text diagram các screen + transitions
2. Screen Prototype (20-30 phút/screen) → HTML/React chạy được, 1 prompt = 1 screen
3. Handoff Claude Code → convert prototype → Next.js component
```

### Cấu trúc prompt UI chuẩn (5 thành phần)
```
[1] Context    → tên tool, dark/light theme, reference design (Lokalise/Gridly)
[2] Screen     → tên màn hình cụ thể
[3] Layout     → kích thước exact: "220px sidebar | flex-1 table | 300px panel"
[4] Components → liệt kê từng element với content thật (không lorem ipsum)
[5] States     → default, hover, empty, loading, error
```

**Rule vàng: 1 prompt = 1 screen.**

### UI Reference
- **Gridly**: spreadsheet layout, resizable columns, row/column freeze
- **Lokalise**: right panel (history/comments), presence indicator, status workflow
- **Linear**: keyboard shortcuts, command palette, minimal chrome
- **Colors**: #0d1117 bg, #161b22 surface, #2563eb accent, zinc grays

---

## 9. TIPS KHI DÙNG CLAUDE CODE

| Tình huống | Làm gì |
|---|---|
| Bắt đầu phase mới | `/clear` để reset context, tránh nhiễu từ phase cũ |
| Task phức tạp (Phase 3, 5) | `Shift+Tab` → Plan Mode, review plan trước khi implement |
| Gặp lỗi TypeScript/build | Paste toàn bộ error message, đừng tóm tắt |
| Sau mỗi phase | `pnpm build && pnpm typecheck` — catch lỗi sớm |
| Phase 5 version diff logic | Tách 2 prompts: logic (`snapshot.ts`, `diff.ts`) trước, UI sau |
| Version restore | Luôn test với `createBackupFirst: true` trước |
| Parser/Exporter | Viết test trước, sau đó implement (TDD nhẹ) |
| Component phức tạp | 1 prompt = 1 component, không nhét nhiều component vào 1 prompt |

---

## 10. QUICK REFERENCE

### Key URLs khi chạy
```
http://localhost:3000           → landing / redirect
http://localhost:3000/login     → auth
http://localhost:3000/projects  → dashboard
http://localhost:3000/[id]/editor   → translation table
http://localhost:3000/[id]/versions → version history
http://localhost:3000/api/health    → health check
```

### pnpm Commands
```bash
pnpm dev              # start dev
pnpm build            # production build
pnpm typecheck        # tsc check
pnpm test             # vitest
pnpm db:push          # apply migrations to Supabase
pnpm db:types         # regenerate TypeScript types
```

### Supabase Tables
```
organizations         → multi-tenant root
projects              → localization projects
locales               → languages per project
translation_keys      → keys (dot.notation)
translations          → values per key per locale
translation_history   → audit log
members               → user-project membership + roles
versions              → snapshot metadata
version_snapshots     → full snapshot data
version_stats         → stats cache
```

### Status Values
```
Translation:  empty → pending → reviewed → approved
Version tag:  manual | auto_import | auto_bulk_delete | auto_before_restore
Member role:  owner | admin | translator | viewer
```
