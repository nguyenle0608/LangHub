-- ============================================================
-- 009: User organization summary RPC
-- ============================================================
-- The /projects page needs organization switcher data plus member/project
-- counts. This function collapses membership, organization, member count, and
-- project count reads into one Supabase request. SECURITY INVOKER keeps RLS in
-- force for the authenticated user.

create or replace function public.get_user_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  plan text,
  created_at timestamptz,
  role text,
  member_count bigint,
  project_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.slug,
    coalesce(o.plan, 'free') as plan,
    o.created_at,
    coalesce(m.role, 'viewer') as role,
    (
      select count(*)::bigint
      from members m_count
      where m_count.org_id = o.id
    ) as member_count,
    (
      select count(*)::bigint
      from projects p_count
      where p_count.org_id = o.id
    ) as project_count
  from members m
  join organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
  order by o.created_at asc;
$$;
