-- Close tables that were created without RLS and tighten policies whose
-- previous checks did not enforce cross-table project/branch consistency.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- SECURITY DEFINER is intentional here: a policy on members cannot safely
-- query members again without recursion. The function only reveals the
-- caller's own role for one org and uses fully-qualified names.
create or replace function private.current_user_org_role(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.members m
  where m.org_id = p_org_id and m.user_id = auth.uid()
  limit 1
$$;

revoke all on function private.current_user_org_role(uuid) from public;
grant execute on function private.current_user_org_role(uuid) to authenticated;

alter table public.locales enable row level security;
alter table public.members enable row level security;
alter table public.translation_history enable row level security;
alter table public.versions enable row level security;
alter table public.version_snapshots enable row level security;
alter table public.version_stats enable row level security;

create policy "Project members can view locales"
  on public.locales for select to authenticated
  using (private.current_user_org_role((select p.org_id from public.projects p where p.id = project_id)) is not null);

create policy "Org members can view members"
  on public.members for select to authenticated
  using (private.current_user_org_role(org_id) is not null);

create policy "Project members can view translation history"
  on public.translation_history for select to authenticated
  using (exists (
    select 1
    from public.translations t
    join public.translation_keys tk on tk.id = t.key_id
    join public.projects p on p.id = tk.project_id
    where t.id = translation_id
      and private.current_user_org_role(p.org_id) is not null
  ));

create policy "Project members can view versions"
  on public.versions for select to authenticated
  using (private.current_user_org_role((select p.org_id from public.projects p where p.id = project_id)) is not null);

create policy "Project members can view version snapshots"
  on public.version_snapshots for select to authenticated
  using (exists (
    select 1
    from public.versions v
    join public.projects p on p.id = v.project_id
    where v.id = version_id
      and private.current_user_org_role(p.org_id) is not null
  ));

create policy "Project members can view version stats"
  on public.version_stats for select to authenticated
  using (exists (
    select 1
    from public.versions v
    join public.projects p on p.id = v.project_id
    where v.id = version_id
      and private.current_user_org_role(p.org_id) is not null
  ));

-- The original comments_select policy used USING (true), exposing every
-- comment to any database role. Scope all comment actions through the key's
-- project membership and keep deletion author-only.
drop policy if exists "comments_select" on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_delete" on public.comments;

create policy "Project members can view comments"
  on public.comments for select to authenticated
  using (exists (
    select 1
    from public.translation_keys tk
    join public.projects p on p.id = tk.project_id
    where tk.id = key_id
      and private.current_user_org_role(p.org_id) is not null
  ));

create policy "Project members can create own comments"
  on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.translation_keys tk
      join public.projects p on p.id = tk.project_id
      where tk.id = key_id
        and private.current_user_org_role(p.org_id) is not null
    )
  );

create policy "Comment authors can delete comments"
  on public.comments for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.translation_keys tk
      join public.projects p on p.id = tk.project_id
      where tk.id = key_id
        and private.current_user_org_role(p.org_id) is not null
    )
  );

-- Organization creation is performed by the server's service role. Prevent
-- direct anon-key clients from creating ownerless organizations.
drop policy if exists "Authenticated users can create orgs" on public.organizations;

-- Keys must belong to the same project as their branch.
drop policy if exists "Translators and above can create keys" on public.translation_keys;
drop policy if exists "Translators and above can update keys" on public.translation_keys;

create policy "Translators and above can create keys"
  on public.translation_keys for insert to authenticated
  with check (
    private.current_user_org_role((select p.org_id from public.projects p where p.id = project_id))
      in ('owner', 'admin', 'translator')
    and exists (select 1 from public.branches b where b.id = branch_id and b.project_id = project_id)
  );

create policy "Translators and above can update keys"
  on public.translation_keys for update to authenticated
  using (
    private.current_user_org_role((select p.org_id from public.projects p where p.id = project_id))
      in ('owner', 'admin', 'translator')
  )
  with check (
    private.current_user_org_role((select p.org_id from public.projects p where p.id = project_id))
      in ('owner', 'admin', 'translator')
    and exists (select 1 from public.branches b where b.id = branch_id and b.project_id = project_id)
  );

-- A translation's branch, key, and locale must all resolve to one project.
drop policy if exists "Translators and above can insert translations" on public.translations;
drop policy if exists "Translators and above can update translations" on public.translations;

create policy "Translators and above can insert translations"
  on public.translations for insert to authenticated
  with check (exists (
    select 1
    from public.translation_keys tk
    join public.branches b on b.id = branch_id and b.id = tk.branch_id
    join public.locales l on l.id = locale_id and l.project_id = tk.project_id
    join public.projects p on p.id = tk.project_id and b.project_id = p.id
    where tk.id = key_id
      and private.current_user_org_role(p.org_id) in ('owner', 'admin', 'translator')
  ));

create policy "Translators and above can update translations"
  on public.translations for update to authenticated
  using (exists (
    select 1
    from public.translation_keys tk
    join public.projects p on p.id = tk.project_id
    where tk.id = key_id
      and private.current_user_org_role(p.org_id) in ('owner', 'admin', 'translator')
  ))
  with check (exists (
    select 1
    from public.translation_keys tk
    join public.branches b on b.id = branch_id and b.id = tk.branch_id
    join public.locales l on l.id = locale_id and l.project_id = tk.project_id
    join public.projects p on p.id = tk.project_id and b.project_id = p.id
    where tk.id = key_id
      and private.current_user_org_role(p.org_id) in ('owner', 'admin', 'translator')
  ));
