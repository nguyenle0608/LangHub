import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const cookieStore = await cookies()
  const cookieNext = cookieStore.get('oauth_next')?.value
  const next = getSafeNextPath(searchParams.get('next') ?? decodeCookieValue(cookieNext))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectAndClearOAuthNext(`${origin}${next}`)
    }
  }

  return redirectAndClearOAuthNext(`${origin}/login?error=auth_callback_failed`)
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/dashboard/projects'
  }

  return next
}

function decodeCookieValue(value: string | undefined) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function redirectAndClearOAuthNext(url: string) {
  const response = NextResponse.redirect(url)
  response.cookies.set('oauth_next', '', {
    path: '/',
    maxAge: 0,
  })
  return response
}
