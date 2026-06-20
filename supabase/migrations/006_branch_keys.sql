-- ============================================================
-- 006: Structural branching (M2) — keys carry branch_id
-- Keys are now per-branch: adding/removing a key on a branch does not
-- affect other branches until merged. Builds on 005 (value-level branches).
-- See docs/BRANCHING.md §5.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- 1. Drop M1 branches that predate per-branch keys.
--    Under M1 a non-default branch shared the project's (main) keys and only
--    owned translation rows. Under M2 each branch owns its keys, so these
--    legacy branches would have zero keys. Drop them (test data) — recreate
--    via the branch switcher, which now copies keys too.
delete from branches where is_default = false;

-- 2. Add branch_id to translation_keys
alter table translation_keys add column if not exists branch_id uuid references branches(id) on delete cascade;

-- 3. Backfill: assign each project's keys to its main (default) branch
do $$
declare
  proj record;
  main_id uuid;
begin
  for proj in select id from projects loop
    select id into main_id from branches where project_id = proj.id and is_default limit 1;
    if main_id is not null then
      update translation_keys set branch_id = main_id
      where project_id = proj.id and branch_id is null;
    end if;
  end loop;
end $$;

-- Drop any keys still without a branch (project had no main branch — shouldn't happen)
delete from translation_keys where branch_id is null;

-- 4. Enforce NOT NULL + swap unique (project_id, key) → (branch_id, key)
alter table translation_keys alter column branch_id set not null;

-- Drop the old unique(project_id, key) by locating it dynamically (attname cast
-- to text to avoid name[]=text[] operator errors)
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'translation_keys'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['key','project_id']
  loop
    execute format('alter table translation_keys drop constraint %I', con.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'translation_keys'::regclass
      and conname = 'translation_keys_branch_key_key'
  ) then
    alter table translation_keys
      add constraint translation_keys_branch_key_key unique (branch_id, key);
  end if;
end $$;

create index if not exists idx_translation_keys_branch on translation_keys(branch_id);
