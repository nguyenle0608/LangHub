import { createClient } from '../server'
import { createAdminClient } from '../admin'
import type { MemberRole, OrgMember, OrgWithStats } from '@/types'

// ── Reads: user-scoped client (RLS applies) ────────────────────────────────

export async function getOrganizations(userId: string): Promise<OrgWithStats[]> {
  const supabase = await createClient()

  const { data: orgRows, error: orgRowsError } = await supabase.rpc('get_user_organizations')
  if (!orgRowsError && orgRows && orgRows.length > 0) {
    return orgRows.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      created_at: org.created_at,
      role: org.role as MemberRole,
      member_count: Number(org.member_count ?? 0),
      project_count: Number(org.project_count ?? 0),
    })) satisfies OrgWithStats[]
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[perf] get_user_organizations RPC failed; falling back to client queries: ${orgRowsError?.message ?? 'unknown error'}`
    )
  }

  const { data: memberships } = await supabase
    .from('members')
    .select('org_id, role')
    .eq('user_id', userId)

  if (!memberships?.length) return []

  const orgIds = memberships.map((m) => m.org_id).filter((id): id is string => id !== null)
  if (!orgIds.length) return []

  const { data: orgs } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds)
    .order('created_at', { ascending: true })

  if (!orgs?.length) return []

  const [{ data: memberCounts }, { data: projectCounts }] = await Promise.all([
    supabase
      .from('members')
      .select('org_id')
      .in('org_id', orgIds),
    supabase
      .from('projects')
      .select('org_id')
      .in('org_id', orgIds),
  ])

  const memberCountMap: Record<string, number> = {}
  for (const m of memberCounts ?? []) {
    if (m.org_id) memberCountMap[m.org_id] = (memberCountMap[m.org_id] ?? 0) + 1
  }

  const projectCountMap: Record<string, number> = {}
  for (const p of projectCounts ?? []) {
    if (p.org_id) projectCountMap[p.org_id] = (projectCountMap[p.org_id] ?? 0) + 1
  }

  const roleMap: Record<string, MemberRole> = {}
  for (const m of memberships) {
    if (m.org_id && m.role) roleMap[m.org_id] = m.role as MemberRole
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan ?? 'free',
    created_at: org.created_at,
    role: roleMap[org.id] ?? 'viewer',
    member_count: memberCountMap[org.id] ?? 0,
    project_count: projectCountMap[org.id] ?? 0,
  })) satisfies OrgWithStats[]
}

// ── Writes: admin client (service role) ───────────────────────────────────

export async function createOrganization(
  name: string,
  userId: string
): Promise<{ id: string; slug: string } | { error: string }> {
  const admin = createAdminClient()
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const slug = `${baseSlug}-${Date.now()}`

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, slug, plan: 'free' })
    .select('id, slug')
    .single()

  if (orgError || !org) return { error: orgError?.message ?? 'Failed to create organization' }

  const { error: memberError } = await admin
    .from('members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })

  if (memberError) return { error: memberError.message }

  return { id: org.id, slug: org.slug }
}

export async function updateOrganization(
  orgId: string,
  data: { name?: string }
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update(data)
    .eq('id', orgId)
  return error ? { error: error.message } : { success: true }
}

export async function deleteOrganization(orgId: string): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('organizations').delete().eq('id', orgId)
  return error ? { error: error.message } : { success: true }
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const admin = createAdminClient()

  const { data: members } = await admin
    .from('members')
    .select('id, org_id, user_id, role, created_at')
    .eq('org_id', orgId)

  if (!members?.length) return []

  // Fetch emails from auth.users via admin API
  const userIds = members.map((m) => m.user_id).filter((id): id is string => id !== null)
  const emailMap: Record<string, string> = {}

  try {
    // listUsers returns up to 1000 users; for MVP this is sufficient
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of usersData?.users ?? []) {
      if (userIds.includes(u.id)) {
        emailMap[u.id] = u.email ?? ''
      }
    }
  } catch {
    // If admin user listing fails, emails will be null — non-critical
  }

  return members.map((m) => ({
    id: m.id,
    org_id: m.org_id ?? '',
    user_id: m.user_id ?? '',
    role: (m.role ?? 'viewer') as MemberRole,
    created_at: m.created_at,
    email: m.user_id ? (emailMap[m.user_id] ?? null) : null,
  })) satisfies OrgMember[]
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: MemberRole
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()

  // Look up user by email via admin API
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = usersData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (!user) return { error: 'No user found with that email address' }

  // Check if already a member
  const { data: existing } = await admin
    .from('members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'User is already a member of this workspace' }

  const { error } = await admin
    .from('members')
    .insert({ org_id: orgId, user_id: user.id, role })

  return error ? { error: error.message } : { success: true }
}

export async function updateMemberRole(
  memberId: string,
  role: MemberRole
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('members').update({ role }).eq('id', memberId)
  return error ? { error: error.message } : { success: true }
}

export async function removeMember(memberId: string): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('members').delete().eq('id', memberId)
  return error ? { error: error.message } : { success: true }
}

export async function getUserOrgRole(orgId: string, userId: string): Promise<MemberRole | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single()
  return data?.role ? (data.role as MemberRole) : null
}
