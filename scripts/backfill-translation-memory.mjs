import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
let cursor = null
let total = 0

for (;;) {
  const { data, error } = await supabase.rpc('backfill_translation_memory', {
    p_after_translation_id: cursor,
    p_batch_size: 500,
  })
  if (error) throw error
  const processed = Number(data?.processed ?? 0)
  total += processed
  cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null
  if (processed === 0 || !cursor) break
}

console.log(JSON.stringify({ backfilled: total }))
