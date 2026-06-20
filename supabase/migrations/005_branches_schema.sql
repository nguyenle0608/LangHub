-- ============================================================
-- 005: Branching (M1 — value-level branches)
-- Git-style branches for translation VALUES. Keys & locales stay
-- project-global; only translation value/status diverge per branch.
-- See docs/BRANCHING.md
--
-- Written idempotently so it is safe to re-run after a partial apply.
-- ============================================================

-- branches (= Git branches for translation values)
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,                                       -- 'main', 'feature-x'
  parent_branch_id uuid references branches(id) on delete set null,
  base_snapshot_id uuid references versions(id) on delete set null,  -- merge base (frozen fork point)
  is_default boolean default false,                         -- the 'main' branch
  is_locked boolean default false,                          -- archived / read-only
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(project_id, name)
);

create index if not exists idx_branches_project on branches(project_id);
-- At most one default branch per project
create unique index if not exists idx_branches_one_default on branches(project_id) where is_default;

-- ── translations: add branch_id ───────────────────────────────────────────
alter table translations add column if not exists branch_id uuid references branches(id) on delete cascade;

-- versions: record which branch a snapshot froze (legacy snapshots = null)
alter table versions add column if not exists branch_id uuid references branches(id) on delete set null;

-- ── Backfill: one 'main' branch per project, assign existing translations ──
do $$
declare
  proj record;
  main_id uuid;
begin
  for proj in select id from projects loop
    select id into main_id from branches where project_id = proj.id and is_default limit 1;
    if main_id is null then
      insert into branches (project_id, name, is_default, created_by)
      values (proj.id, 'main', true, null)
      returning id into main_id;
    end if;

    update translations t
    set branch_id = main_id
    from translation_keys tk
    where t.key_id = tk.id
      and tk.project_id = proj.id
      and t.branch_id is null;
  end loop;
end $$;

-- Any orphan translations (no key/project) can't get a branch — remove them (test data)
delete from translations where branch_id is null;

-- ── Enforce NOT NULL + swap unique constraint ─────────────────────────────
alter table translations alter column branch_id set not null;

-- Drop the old unique(key_id, locale_id); default constraint name from migration 001
alter table translations drop constraint if exists translations_key_id_locale_id_key;

-- Add the branch-scoped unique constraint (guarded for re-runs)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'translations'::regclass
      and conname = 'translations_branch_key_locale_key'
  ) then
    alter table translations
      add constraint translations_branch_key_locale_key unique (branch_id, key_id, locale_id);
  end if;
end $$;

create index if not exists idx_translations_branch on translations(branch_id);

-- ── RLS: branches readable by project members ─────────────────────────────
alter table branches enable row level security;

drop policy if exists "Project members can view branches" on branches;
create policy "Project members can view branches"
  on branches for select to authenticated
  using (project_id in (
    select p.id from projects p
    join members m on m.org_id = p.org_id
    where m.user_id = auth.uid()
  ));

-- Writes go through the service-role admin client (see lib/supabase/admin),
-- which bypasses RLS — matching the project's mutation convention.
