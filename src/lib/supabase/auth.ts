'use server'

import { redirect } from 'next/navigation'
import { createClient } from './server'

export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect('/projects')
}

export async function signUp(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })
  if (error) return { error: error.message }
  if (data.url) redirect(data.url)
}
