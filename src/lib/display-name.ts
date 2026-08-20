/**
 * "ada@example.com" → "ada".
 *
 * Kept apart from queries/users.ts so client components can use it without
 * pulling the admin Supabase client into the browser bundle.
 */
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return 'Unknown'
  const local = email.split('@')[0]
  return local && local.length > 0 ? local : email
}
