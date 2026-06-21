import { cache } from 'react'
import { createClient } from './server'

// Cached per server request: layouts and pages both read the user during a
// single render, so cache() collapses those into one Supabase auth call.
// Kept out of auth.ts because that file is a "use server" actions module and
// can only export async server actions, not a cache()-wrapped read.
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
