-- ============================================================
-- 022: Don't rebuild translation memory while forking a branch
-- ============================================================
-- Creating a branch started timing out:
--
--   POST /api/branches -> canceling statement due to statement timeout
--
-- fork_branch copies the source branch's translations with one set-based
-- INSERT ... SELECT, which is why it is fast. But
-- capture_approved_translation_memory_trigger is FOR EACH ROW, and it returns
-- early only while a row is not approved. Once a project's translations are
-- approved — which is what "Approve all" does to all of them — every one of
-- the ~11,000 copied rows runs the full trigger body: a four-table join, then
-- a sibling lookup and an upsert into translation_memory_entries. One
-- statement becomes tens of thousands, inside a single transaction.
--
-- The work is also pointless. Translation memory is scoped to the org and
-- deduplicated on (org_id, fingerprint), and a fork copies pairs the source
-- branch already captured. Re-capturing them writes no new information — it
-- rewrites rows that are already there, with the same values.
--
-- So the fork says it is a fork, and the trigger steps aside. The flag is set
-- with is_local = true, so it lasts exactly as long as the fork's transaction
-- and cannot leak into another statement on the same pooled connection.

create or replace function public.capture_approved_translation_memory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_org_id uuid;
  v_base_locale text;
  v_current_locale text;
  v_source_value text;
  v_target record;
begin
  -- Set only by fork_branch, and only for its own transaction.
  if pg_catalog.current_setting('langhub.forking_branch', true) = 'on' then
    return new;
  end if;

  if new.status <> 'approved' or btrim(coalesce(new.value, '')) = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and old.value is not distinct from new.value then
    return new;
  end if;

  select tk.project_id, p.org_id, lower(p.base_locale), lower(l.code)
    into v_project_id, v_org_id, v_base_locale, v_current_locale
  from public.translation_keys tk
  join public.projects p on p.id = tk.project_id
  join public.locales l on l.id = new.locale_id and l.project_id = p.id
  join public.branches b on b.id = new.branch_id and b.project_id = p.id and tk.branch_id = b.id
  where tk.id = new.key_id;

  if v_org_id is null then return new; end if;

  if v_current_locale = v_base_locale then
    for v_target in
      select t.value, lower(l.code) as locale
      from public.translations t
      join public.locales l on l.id = t.locale_id and l.project_id = v_project_id
      where t.branch_id = new.branch_id
        and t.key_id = new.key_id
        and t.status = 'approved'
        and lower(l.code) <> v_base_locale
        and btrim(coalesce(t.value, '')) <> ''
    loop
      perform private.store_translation_memory_pair(
        v_org_id, v_base_locale, v_target.locale, new.value, v_target.value,
        v_project_id, new.branch_id, new.key_id
      );
    end loop;
  else
    select s.value into v_source_value
    from public.translations s
    join public.locales sl on sl.id = s.locale_id and sl.project_id = v_project_id
    where s.branch_id = new.branch_id
      and s.key_id = new.key_id
      and lower(sl.code) = v_base_locale
      and btrim(coalesce(s.value, '')) <> ''
    limit 1;

    if v_source_value is not null then
      perform private.store_translation_memory_pair(
        v_org_id, v_base_locale, v_current_locale, v_source_value, new.value,
        v_project_id, new.branch_id, new.key_id
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_approved_translation_memory() from public;

-- fork_branch, unchanged except for the flag. Kept whole rather than patched,
-- because a `create or replace` has to restate the entire body anyway.
create or replace function public.fork_branch(
  p_project_id uuid,
  p_source_branch_id uuid,
  p_name text,
  p_actor_user_id uuid
)
returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_org_id uuid;
  v_branch public.branches;
begin
  if v_name is null or v_name = '' then
    raise exception 'Branch name is required';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Branch name must be 100 characters or fewer';
  end if;

  -- The source branch has to belong to the project being forked.
  select p.org_id into v_org_id
  from public.projects p
  join public.branches b on b.project_id = p.id and b.id = p_source_branch_id
  where p.id = p_project_id;

  if v_org_id is null then
    raise exception 'Project and source branch do not match';
  end if;

  -- The route authorizes before calling, but this runs as security definer, so
  -- it re-checks rather than trusting its caller.
  if p_actor_user_id is null or not exists (
    select 1 from public.members m
    where m.org_id = v_org_id
      and m.user_id = p_actor_user_id
      and m.role in ('owner', 'admin', 'translator')
  ) then
    raise exception 'User is not authorized to create branches in this project';
  end if;

  -- Reported before the insert so the caller gets this wording rather than a
  -- raw constraint violation; the unique index is still what guarantees it.
  if exists (
    select 1 from public.branches
    where project_id = p_project_id and name = v_name
  ) then
    raise exception 'Branch "%" already exists', v_name;
  end if;

  -- Transaction-local: reset the moment this fork commits or rolls back.
  perform pg_catalog.set_config('langhub.forking_branch', 'on', true);

  insert into public.branches(project_id, name, parent_branch_id, is_default, created_by)
  values (p_project_id, v_name, p_source_branch_id, false, p_actor_user_id)
  returning * into v_branch;

  -- Keys are per-branch (M2), so each fork gets its own rows.
  insert into public.translation_keys(
    project_id, branch_id, key, description, tags, platforms,
    char_limit, is_plural, plural_forms, created_by
  )
  select
    p_project_id, v_branch.id, k.key, k.description, k.tags, k.platforms,
    k.char_limit, k.is_plural, k.plural_forms, p_actor_user_id
  from public.translation_keys k
  where k.branch_id = p_source_branch_id;

  -- Remap key_id onto the rows just created. translation_keys is unique on
  -- (branch_id, key), so matching by name pairs each source key with exactly
  -- one copy — the same correspondence the Node version built as a map.
  insert into public.translations(branch_id, key_id, locale_id, value, status)
  select v_branch.id, nk.id, t.locale_id, t.value, t.status
  from public.translations t
  join public.translation_keys ok
    on ok.id = t.key_id and ok.branch_id = p_source_branch_id
  join public.translation_keys nk
    on nk.branch_id = v_branch.id and nk.key = ok.key
  where t.branch_id = p_source_branch_id;

  return v_branch;
end;
$$;

revoke all on function public.fork_branch(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fork_branch(uuid, uuid, text, uuid) to service_role;
