-- Fork a branch inside the database.
--
-- The copy used to run from the API route: page the source branch's keys into
-- Node, insert them back 200 at a time, read every translation row, then insert
-- those 500 at a time. Forking a 1191-key branch measured ~12.9s that way and
-- spent nearly all of it on round trips, which put it past the serverless
-- function timeout on a deploy.
--
-- Both copies are set-based here, so the work is two INSERT ... SELECT
-- statements regardless of project size, and the whole fork — branch row
-- included — is one transaction. A failure can no longer leave a branch that
-- looks complete but is missing keys, which previously had to be cleaned up by
-- hand after the fact.
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
