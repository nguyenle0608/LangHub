-- Bootstrap data for the Manage Branches page in one Supabase request.
-- Depends on 011 get_branches_dashboard(). SECURITY INVOKER keeps RLS active.

create or replace function public.get_branches_bootstrap(p_project_id uuid)
returns table (
  project jsonb,
  branches jsonb,
  role text
)
language sql
stable
security invoker
set search_path = public
as $$
  with project_row as (
    select p.*
    from public.projects p
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
    from public.locales l
    where l.project_id = p_project_id
  ),
  branch_agg as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'project_id', b.project_id,
          'name', b.name,
          'parent_branch_id', b.parent_branch_id,
          'is_default', b.is_default,
          'is_locked', b.is_locked,
          'base_snapshot_id', b.base_snapshot_id,
          'created_by', b.created_by,
          'created_at', b.created_at,
          'key_count', b.key_count,
          'locale_count', b.locale_count,
          'approved_percent', b.approved_percent
        )
        order by coalesce(b.is_default, false) desc, b.created_at asc
      ),
      '[]'::jsonb
    ) as branches
    from public.get_branches_dashboard(p_project_id) b
  ),
  user_role as (
    select m.role
    from project_row p
    join public.members m on m.org_id = p.org_id
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
    coalesce(ur.role, 'viewer') as role
  from project_row p
  cross join locale_agg la
  cross join branch_agg ba
  left join user_role ur on true;
$$;
