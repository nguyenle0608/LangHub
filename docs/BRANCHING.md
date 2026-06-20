# 🌿 Branching — Git-style branches for translations

> Status: **M1 + M2 implemented**. Keys are now per-branch (see §5 for what M2 added).
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

| | **M1 — value-level (DONE)** | **M2 — structural (DONE)** |
|---|---|---|
| Locales | Project-global | Project-global (unchanged) |
| Keys | Project-global | **Per-branch** (`translation_keys.branch_id`) |
| Translation `value`/`status` | Per-branch | Per-branch |
| "Add a key on a feature branch" | Appeared on all branches | **Stays on that branch until merge** |
| Merge conflict scope | Per (key, locale) **value** | Value + **key add** (delete/rename: see §5 limits) |

**Decision (history):** M1 shipped first (value-level), then M2 was added on top
(per-branch keys) as an additive migration — no rewrite, ~80% of the code carried over.

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

In M1 `translation_keys` and `locales` were global per project. **M2 (migration 006)
added `branch_id` to `translation_keys`** (unique `(branch_id, key)`); `locales` remain
global. See §5.

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

## 4b. Migrations & known limitations

### Migrations
- `005_branches_schema.sql` — branches table; `branch_id` on translations (+ versions);
  backfill a `main` branch per project; swap unique to `(branch_id, key_id, locale_id)`.
- `006_branch_keys.sql` — `branch_id` on `translation_keys`; backfill keys to `main`;
  swap unique `(project_id, key)` → `(branch_id, key)`. **Drops pre-existing non-default
  branches** (M1 branches shared the project's keys and would be orphaned under M2).

```bash
pnpm db:push                          # apply to the linked Supabase project
supabase gen types typescript --linked > src/types/database.ts   # regen types from remote
```
(`pnpm db:types` uses `--local`, which needs Docker; use `--linked` against remote.)

### Known limitations (acceptable for v1)
- **Merge propagates key ADDS, not deletes/renames.** A key present on the source but not
  the target is created in the target during merge. A key deleted or renamed on the source
  is NOT propagated — the target keeps its version. (Rename = delete+add, so it surfaces as
  a new key.)
- **Snapshots/Versions page operates on `main`.** `createSnapshot`/`restoreSnapshot` are
  branch-aware; the standalone Versions page UI defaults to `main`. Import auto-snapshots
  and merge backups target the correct branch.
- **Branch creation copies all keys + translation rows** (full copy, not delta). Fine for
  typical project sizes.

## 5. M2 — structural branching (implemented)

Keys are per-branch: `translation_keys.branch_id`, unique `(branch_id, key)`. Adding a key
on a branch no longer touches other branches until merge. Locales stay project-global.

### What M2 changed on top of M1
- **Migration 006** — see §4b.
- `createTranslationKey` creates the key on the **active branch only** (no cross-branch
  fan-out); `getTranslationKeys` filters keys by `branch_id`.
- `createBranch` now **copies keys** (new ids) and remaps each copied translation's
  `key_id` to the new key.
- **Merge** (`applyMerge`) auto-creates keys that exist on the source but not the target
  before applying their translations (`createdKeys` in the result).
- Branch-scoped: import (keys created on active branch), export, duplicate-finder,
  snapshot/restore name→id mapping, and project stats (key count on `main`).

### Reused unchanged from M1 (~80%)
`branches` table, branch switcher UI, `/api/branches`, the 3-way merge engine (matches by
`key_name::locale_code`, so it already tolerated per-branch key ids), and the snapshot system.

### Future (not done)
- Propagate key **delete/rename** through merge (currently add-only).
- Make the standalone Versions page branch-aware.
- Per-branch locales (rarely needed).
