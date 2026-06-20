import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

export type DiffEntry = {
  key_name: string
  locale_code: string
  type: DiffType
  valueA: string | null
  valueB: string | null
  statusA: string | null
  statusB: string | null
}

type SnapshotKey = string // "key_name::locale_code"

function snapshotKey(keyName: string, localeCode: string): SnapshotKey {
  return `${keyName}::${localeCode}`
}

export async function diffVersions(
  projectId: string,
  versionIdA: string,
  versionIdB: string | 'current',
  branchId?: string
): Promise<DiffEntry[]> {
  const admin = createAdminClient()

  // Fetch snapshot A
  const { data: snapshotsA } = await admin
    .from('version_snapshots')
    .select('key_name, locale_code, value, status')
    .eq('version_id', versionIdA)

  const mapA = new Map<SnapshotKey, { value: string | null; status: string | null }>()
  for (const s of snapshotsA ?? []) {
    mapA.set(snapshotKey(s.key_name, s.locale_code), { value: s.value, status: s.status })
  }

  // Fetch snapshot B (or current translations)
  const mapB = new Map<SnapshotKey, { value: string | null; status: string | null }>()

  if (versionIdB === 'current') {
    const supabase = await createClient()

    const { data: keys } = await supabase
      .from('translation_keys')
      .select('id, key')
      .eq('project_id', projectId)

    if (keys?.length) {
      const keyIds = keys.map((k) => k.id)
      const keyNameById = Object.fromEntries(keys.map((k) => [k.id, k.key]))

      const { data: locales } = await supabase
        .from('locales')
        .select('id, code')
        .eq('project_id', projectId)

      const localeCodeById = Object.fromEntries((locales ?? []).map((l) => [l.id, l.code]))

      let transQuery = supabase
        .from('translations')
        .select('key_id, locale_id, value, status')
        .in('key_id', keyIds)
      if (branchId) transQuery = transQuery.eq('branch_id', branchId)
      const { data: translations } = await transQuery

      for (const t of translations ?? []) {
        const kName = keyNameById[t.key_id ?? '']
        const lCode = localeCodeById[t.locale_id ?? '']
        if (kName && lCode) {
          mapB.set(snapshotKey(kName, lCode), { value: t.value, status: t.status })
        }
      }
    }
  } else {
    const { data: snapshotsB } = await admin
      .from('version_snapshots')
      .select('key_name, locale_code, value, status')
      .eq('version_id', versionIdB)

    for (const s of snapshotsB ?? []) {
      mapB.set(snapshotKey(s.key_name, s.locale_code), { value: s.value, status: s.status })
    }
  }

  // Union of all keys
  const allKeys = new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys())])

  const entries: DiffEntry[] = []

  for (const k of Array.from(allKeys)) {
    const [key_name, locale_code] = k.split('::') as [string, string]
    const a = mapA.get(k) ?? null
    const b = mapB.get(k) ?? null

    let type: DiffType
    if (!a && b) {
      type = 'added'
    } else if (a && !b) {
      type = 'removed'
    } else if (a && b && (a.value !== b.value || a.status !== b.status)) {
      type = 'changed'
    } else {
      type = 'unchanged'
    }

    entries.push({
      key_name,
      locale_code,
      type,
      valueA: a?.value ?? null,
      valueB: b?.value ?? null,
      statusA: a?.status ?? null,
      statusB: b?.status ?? null,
    })
  }

  // Sort: changed first, then added, then removed, then unchanged
  const order: Record<DiffType, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 }
  entries.sort((a, b) => {
    const diff = order[a.type] - order[b.type]
    if (diff !== 0) return diff
    return a.key_name.localeCompare(b.key_name)
  })

  return entries
}
