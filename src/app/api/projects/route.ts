import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createProject, getProjects } from '@/lib/supabase/queries/projects'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  baseLocale: z.string().min(2).max(10).default('en'),
  baseLocaleName: z.string().max(100).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await getProjects(user.id)
  return NextResponse.json({ data: projects })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = CreateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createProject({
    userId: user.id,
    name: parsed.data.name,
    baseLocale: parsed.data.baseLocale,
    ...(parsed.data.description ? { description: parsed.data.description } : {}),
    ...(parsed.data.baseLocaleName ? { baseLocaleName: parsed.data.baseLocaleName } : {}),
  })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: result }, { status: 201 })
}
