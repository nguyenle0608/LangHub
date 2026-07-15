-- ============================================================
-- 010: Editor bootstrap RPC
-- ============================================================
-- The editor shell needs project metadata, locales, branches, active branch,
-- and the current user's org role before fetching the first key window. This
-- function collapses those reads into one Supabase request. SECURITY INVOKER
-- keeps the existing RLS policies in force for the authenticated user.

create or replace function public.get_editor_bootstrap(
  p_project_id uuid,
  p_branch_id uuid default null
)
returns table (
  project jsonb,
  branches jsonb,
  active_branch_id uuid,
  role text
)
language sql
stable
security invoker
set search_path = public
as $$
  with project_row as (
    select p.*
    from projects p
    where p.id = p_project_id
    limit 1
  ),
  locale_agg as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'code', l.code,
            'name', l.name,
            'is_base', coalesce(l.is_base, false),
            'total', 0,
            'approved', 0,
            'percent', 0
          )
          order by coalesce(l.is_base, false) desc, l.code asc
        ),
        '[]'::jsonb
      ) as locales,
      count(*)::int as locale_count
    from locales l
    where l.project_id = p_project_id
  ),
  branch_rows as (
    select b.*
    from branches b
    where b.project_id = p_project_id
  ),
  branch_agg as (
    select coalesce(
      jsonb_agg(to_jsonb(b) order by coalesce(b.is_default, false) desc, b.created_at asc),
      '[]'::jsonb
    ) as branches
    from branch_rows b
  ),
  active_branch as (
    select coalesce(
      (
        select b.id
        from branch_rows b
        where p_branch_id is not null and b.id = p_branch_id
        limit 1
      ),
      (
        select b.id
        from branch_rows b
        where coalesce(b.is_default, false) = true
        limit 1
      ),
      (
        select b.id
        from branch_rows b
        order by b.created_at asc
        limit 1
      )
    ) as id
  ),
  user_role as (
    select m.role
    from project_row p
    join members m on m.org_id = p.org_id
    where m.user_id = auth.uid()
    limit 1
  )
  select
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'description', p.description,
      'base_locale', p.base_locale,
      'created_at', p.created_at,
      'org_id', p.org_id,
      'key_count', 0,
      'locale_count', coalesce(la.locale_count, 0),
      'overall_percent', 0,
      'locales', coalesce(la.locales, '[]'::jsonb)
    ) as project,
    coalesce(ba.branches, '[]'::jsonb) as branches,
    ab.id as active_branch_id,
    coalesce(ur.role, 'viewer') as role
  from project_row p
  cross join locale_agg la
  cross join branch_agg ba
  cross join active_branch ab
  left join user_role ur on true;
$$;
