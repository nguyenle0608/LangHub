-- Dashboard data for the Manage Branches page in one round trip.
-- SECURITY INVOKER keeps the caller's RLS policies in force.

create or replace function public.get_branches_dashboard(p_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  name text,
  parent_branch_id uuid,
  is_default boolean,
  is_locked boolean,
  base_snapshot_id uuid,
  created_by uuid,
  created_at timestamptz,
  key_count bigint,
  locale_count bigint,
  approved_percent integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with project_locales as (
    select
      count(*)::bigint as locale_count,
      coalesce(array_agg(id) filter (where not coalesce(is_base, false)), '{}'::uuid[]) as non_base_locale_ids,
      count(*) filter (where not coalesce(is_base, false))::bigint as non_base_locale_count
    from public.locales
    where project_id = p_project_id
  ),
  branch_key_counts as (
    select branch_id, count(*)::bigint as key_count
    from public.translation_keys
    where project_id = p_project_id
    group by branch_id
  ),
  approved_counts as (
    select t.branch_id, count(*)::bigint as approved_count
    from public.translations t
    join public.translation_keys k on k.id = t.key_id
    cross join project_locales pl
    where k.project_id = p_project_id
      and t.locale_id = any(pl.non_base_locale_ids)
      and t.status = 'approved'
    group by t.branch_id
  )
  select
    b.id,
    b.project_id,
    b.name,
    b.parent_branch_id,
    b.is_default,
    b.is_locked,
    b.base_snapshot_id,
    b.created_by,
    b.created_at,
    coalesce(kc.key_count, 0)::bigint as key_count,
    pl.locale_count,
    case
      when coalesce(kc.key_count, 0) = 0 or pl.non_base_locale_count = 0 then 0
      else round((coalesce(ac.approved_count, 0)::numeric / (kc.key_count * pl.non_base_locale_count)) * 100)::integer
    end as approved_percent
  from public.branches b
  cross join project_locales pl
  left join branch_key_counts kc on kc.branch_id = b.id
  left join approved_counts ac on ac.branch_id = b.id
  where b.project_id = p_project_id
  order by b.is_default desc, b.created_at asc;
$$;
