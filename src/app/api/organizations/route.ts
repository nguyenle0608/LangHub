import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrganizations, createOrganization } from '@/lib/supabase/queries/organizations'
import { zodErrorResponse } from '@/lib/api/validation-error'

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgs = await getOrganizations(user.id)
  return NextResponse.json({ data: orgs })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = CreateOrgSchema.safeParse(body)
  if (!parsed.success) {
    return zodErrorResponse(parsed.error)
  }

  const result = await createOrganization(parsed.data.name, user.id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: result }, { status: 201 })
}
