# 🌿 Branching — Git-style branches for translations

> Status: **M1 in progress**. M2 is a planned future extension (see §5).
> Last updated: Jun 2026

---

## 1. Goal

Treat a project's translations like a git repo:

- **Create branches** off any branch (default base = `main`)
- **Switch** the active branch in the editor and edit independently
- **Merge** a branch back into another with **per-cell conflict resolution** (3-way)
- Snapshots (version *tags*) stay as a separate, complementary read-only checkpoint system

A branch is a parallel working set of translation **values**. Two users can be checked
out on different branches at the same time (active branch is per-user, via URL param).

---

## 2. Two models

| | **M1 — value-level (BUILDING NOW)** | **M2 — structural (FUTURE)** |
|---|---|---|
| Keys & locales | Project-global (shared by all branches) | Per-branch (keys carry `branch_id`) |
| Translation `value`/`status` | Per-branch | Per-branch |
| "Add a key on a feature branch" | Appears on all branches (empty value) | Stays on that branch until merge |
| Merge conflict scope | Per (key, locale) **value** | Value **+ key added/removed/renamed** |
| Effort / risk | Moderate | ~2× (every key query becomes branch-scoped) |

**Decision:** ship **M1** first. It fully satisfies "switch back and forth + merge values
with per-cell conflict resolution". M2 is purely additive later (see §5) — no rewrite.

---

## 3. M1 data model

```
branches
  id, project_id → projects
  name                     -- 'main', 'feature-x'
  parent_branch_id → branches   -- where it forked from (nullable)
  base_snapshot_id → versions   -- frozen fork point = the 3-way MERGE BASE
  is_default boolean       -- exactly one 'main' per project
  is_locked boolean        -- archived / read-only
  created_by, created_at
  unique(project_id, name)

translations  (existing table, CHANGED)
  + branch_id → branches   -- NOT NULL after backfill
  unique(branch_id, key_id, locale_id)   -- was unique(key_id, locale_id)

versions  (existing table, additive)
  + branch_id → branches   -- which branch this snapshot froze (nullable, legacy = null)
```

`translation_keys` and `locales` are **unchanged** — global per project.

### Why `base_snapshot_id` reuses the snapshot system

Creating a branch takes a snapshot of the source branch at the fork point and stores its
`versions.id` as `base_snapshot_id`. That frozen copy is the **merge base** for 3-way
merge later. `version_snapshots` already stores `key_name` + `locale_code` as **strings**
(resilient to rename/delete) — exactly what merge needs to match cells across branches.

---

## 4. M1 implementation plan

### Phase 1 — migration (`005_branches_schema.sql`)
- Create `branches`; add `branch_id` to `translations` + `versions`
- Backfill: one `main` branch per project, assign all existing translations to it
- `NOT NULL` + swap unique constraint; indexes; RLS SELECT for branches

### Phase 2 — branch-aware data layer + API
- `branchId` param threaded through `getTranslationKeys`, `updateTranslation`,
  `createTranslationKey`, and `computeLocaleStats` in `queries/projects.ts`
- `lib/branches/` — `listBranches`, `createBranch` (copy rows + base snapshot),
  `deleteBranch`, `setDefaultBranch`
- `/api/branches` (GET list, POST create, DELETE), validates auth + role

### Phase 3 — editor switcher
- Active branch = `?branch=<id>` URL param (per-user), default = project's `main`
- Branch switcher dropdown in editor TopNav (reuse `GitBranch` icon)
- Presence channel scoped per branch: `editing:${projectId}:${branchId}`

### Phase 4 — merge engine + conflict UI
- 3-way: `base` (branch's `base_snapshot`) vs `target` (e.g. main now) vs `source` (branch now)
- Per (key_name, locale_code):
  - changed on one side only → take that side (auto)
  - both sides equal → no-op
  - both changed, differ → **conflict**
- Conflict UI lists conflicts; pick *ours* / *theirs* / hand-edit per cell
- Auto-snapshot target **before** applying (CLAUDE.md destructive-op rule)

### Phase 5 — wire the rest
- Import / export / bulk-delete / snapshot creation target the **active branch**
- Snapshot capture records `branch_id`

### Cross-cutting rule
**Every read/write that touches `translations` must filter/set `branch_id`.** Missing it
leaks data across branches. Audit list: `getTranslationKeys`, `updateTranslation`,
`createTranslationKey`, stats, import, export, diff, snapshot, bulk ops.

---

## 4b. Applying M1 + known limitations

### Apply the migration
The migration `supabase/migrations/005_branches_schema.sql` touches real data
(adds `branch_id`, backfills a `main` branch per project, swaps the unique
constraint). Apply it with:

```bash
pnpm db:push       # pushes to the linked Supabase project
pnpm db:types      # regenerate types (needs local Docker; types were hand-mirrored meanwhile)
```

`src/types/database.ts` was hand-edited to match what `db:types` will generate
(branches table + `branch_id` on translations/versions), so the app type-checks
before the migration is pushed.

### M1 known limitations (acceptable for v1)
- **Snapshots/Versions page operates on `main`.** `createSnapshot`/`restoreSnapshot`
  are branch-aware (take a `branchId`), but the standalone Versions page UI does
  not yet pass the active branch, so it defaults to `main`. Import auto-snapshots
  and merge backups DO target the correct branch.
- **Branch creation copies all translation rows** (full copy, not delta). Fine for
  typical project sizes; revisit if projects grow very large.
- **Merge re-bases the source branch** onto the post-merge target, so repeated
  merges stay clean. Deleting a branch cascade-deletes its translation rows.

## 5. M2 — future extension (structural branching)

Goal: keys (and optionally locales) also branch, so adding/removing keys on a branch does
not affect others until merge.

### Migration shape (same pattern as M1, additive)
```sql
alter table translation_keys add column branch_id uuid references branches(id);
update translation_keys set branch_id = <project main branch>;   -- backfill
-- swap unique (project_id, key) → (branch_id, key)
alter table translation_keys alter column branch_id set not null;
```
Locales *may* stay global (branching locales is rarely needed); decide at M2 time.

### What carries over from M1 (≈80% reuse)
- `branches` table, branch switcher UI, `/api/branches` — **unchanged**
- `branchId` threading — extend to key queries (additive)
- **Merge engine — unchanged**: already matches by `key_name::locale_code` string, so it
  inherently tolerates keys differing across branches. M2 only *adds* "key added / removed
  / renamed" cases to the conflict classifier + UI.
- Snapshot system — unchanged

### What M2 adds
- `branch_id` filter in every `translation_keys` query + copy keys on branch create
- Key-level diff (added/removed/renamed) in merge classifier
- Conflict UI rows for structural changes, not just value changes

### Cost of "M1 first" vs "M2 now"
One extra small, additive migration in the future — in exchange for shipping sooner and
validating the branch UX before taking on structural complexity. No teardown, no rewrite.
