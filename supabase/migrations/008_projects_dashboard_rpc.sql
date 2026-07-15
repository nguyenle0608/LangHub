-- ============================================================
-- 008: Dashboard project summary RPC
-- ============================================================
-- The /projects page needs project metadata, locales, key counts, and progress
-- for one organization. Computing that through the JS client used multiple
-- network round-trips (projects, locales, branches, key counts, approved
-- counts). This RPC lets Postgres compute the summary in one request while
-- keeping the function SECURITY INVOKER so existing RLS policies still apply.

create or replace function public.get_projects_dashboard(p_org_id uuid)
returns table (
  id uuid,
  org_id uuid,
  name text,
  slug text,
  description text,
  base_locale text,
  created_at timestamptz,
  key_count bigint,
  locale_count bigint,
  overall_percent integer,
  locales jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with project_rows as (
    select p.id, p.org_id, p.name, p.slug, p.description, p.base_locale, p.created_at
    from projects p
    where p.org_id = p_org_id
  ),
  main_branches as (
    select b.project_id, b.id as branch_id
    from branches b
    join project_rows p on p.id = b.project_id
    where b.is_default = true
  ),
  key_counts as (
    select mb.project_id, count(tk.id)::bigint as key_count
    from main_branches mb
    left join translation_keys tk on tk.branch_id = mb.branch_id
    group by mb.project_id
  ),
  locale_stats as (
    select
      p.id as project_id,
      l.id,
      l.code,
      l.name,
      coalesce(l.is_base, false) as is_base,
      coalesce(kc.key_count, 0)::bigint as total,
      count(t.id)::bigint as approved
    from project_rows p
    left join main_branches mb on mb.project_id = p.id
    left join key_counts kc on kc.project_id = p.id
    join locales l on l.project_id = p.id
    left join translations t
      on t.branch_id = mb.branch_id
      and t.locale_id = l.id
      and t.status = 'approved'
    group by p.id, l.id, l.code, l.name, l.is_base, kc.key_count
  ),
  locale_agg as (
    select
      project_id,
      count(*)::bigint as locale_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'code', code,
            'name', name,
            'is_base', is_base,
            'total', total,
            'approved', approved,
            'percent', case when total > 0 then round((approved::numeric / total::numeric) * 100)::int else 0 end
          )
          order by is_base desc, code asc
        ),
        '[]'::jsonb
      ) as locales,
      sum(approved) filter (where not is_base)::bigint as non_base_approved,
      count(*) filter (where not is_base)::bigint as non_base_count
    from locale_stats
    group by project_id
  )
  select
    p.id,
    p.org_id,
    p.name,
    p.slug,
    p.description,
    p.base_locale,
    p.created_at,
    coalesce(kc.key_count, 0)::bigint as key_count,
    coalesce(la.locale_count, 0)::bigint as locale_count,
    case
      when coalesce(kc.key_count, 0) > 0 and coalesce(la.non_base_count, 0) > 0
        then round((coalesce(la.non_base_approved, 0)::numeric / (kc.key_count::numeric * la.non_base_count::numeric)) * 100)::int
      else 0
    end as overall_percent,
    coalesce(la.locales, '[]'::jsonb) as locales
  from project_rows p
  left join key_counts kc on kc.project_id = p.id
  left join locale_agg la on la.project_id = p.id
  order by p.created_at desc;
$$;
