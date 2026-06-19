export type TranslationStatus = 'empty' | 'pending' | 'reviewed' | 'approved'

export type MemberRole = 'owner' | 'admin' | 'translator' | 'viewer'

export type VersionTag = 'manual' | 'auto_import' | 'auto_bulk_delete' | 'auto_before_restore'

export type LocaleWithStats = {
  id: string
  code: string
  name: string
  is_base: boolean | null
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
