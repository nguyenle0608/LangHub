import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options) {
              supabaseResponse.cookies.set(name, value, options)
            } else {
              supabaseResponse.cookies.set(name, value)
            }
          })
        },
      },
    }
  )

  // Middleware runs before every dashboard page render. Avoid
  // `auth.getUser()` here because it performs a Supabase Auth round-trip, and
  // dashboard layouts/pages already call `getUser()` for trusted validation.
  // `getSession()` is used only for fast redirect UX and token refresh cookie
  // handling; do not authorize sensitive data from this middleware result.
  const { data: { session } } = await supabase.auth.getSession()
  const path = request.nextUrl.pathname

  const isPublicRoute = PUBLIC_ROUTES.some((r) => path.startsWith(r))
  const isApiRoute = path.startsWith('/api/')
  const isStaticRoute = path.startsWith('/_next/')

  if (!isStaticRoute && !isApiRoute && !isPublicRoute && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isPublicRoute && session && !path.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)'],
}
