import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // OAuth PKCE callback is exchanged in /auth/callback on the server.
        // Keeping browser URL detection enabled can make supabase-js also try
        // to process the callback URL and repeatedly call history.replaceState.
        detectSessionInUrl: false,
      },
    }
  )
}
