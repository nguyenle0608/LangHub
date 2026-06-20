import type { Database } from './database'

export type TranslationStatus = 'empty' | 'pending' | 'reviewed' | 'approved'

export type MemberRole = 'owner' | 'admin' | 'translator' | 'viewer'

export type VersionTag = 'manual' | 'auto_import' | 'auto_bulk_delete' | 'auto_before_restore'

export type LocaleWithStats = {
  id: string
  code: string
  name: string
  is_base: boolean
  total: number
  approved: number
  percent: number
}

export type ProjectWithStats = {
  id: string
  name: string
  slug: string
  description: string | null
  base_locale: string | null
  created_at: string | null
  org_id: string | null
  key_count: number
  locale_count: number
  overall_percent: number
  locales: LocaleWithStats[]
}

type TranslationRow = Database['public']['Tables']['translations']['Row']
type KeyRow = Database['public']['Tables']['translation_keys']['Row']

export type Translation = TranslationRow

export type TranslationKey = KeyRow & { translations: Translation[] }

export type FilterState = {
  search: string
  status: TranslationStatus | 'all'
  tags: string[]
  localeId: string | null
}

export type OrgWithStats = {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string | null
  role: MemberRole
  member_count: number
  project_count: number
}

export type OrgMember = {
  id: string
  org_id: string
  user_id: string
  role: MemberRole
  created_at: string | null
  email: string | null
}
