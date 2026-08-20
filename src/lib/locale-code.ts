/**
 * Locale codes: a language, optionally qualified by a region.
 *
 * `ms` and `en-US` are both valid — the region is what separates `en-US` from
 * `en-CA`, which hold different translations of the same key. Everything that
 * derives from a code (the flag, the Android resource folder) has to read the
 * region rather than assume the whole code is a language.
 */

/** Canonical form: lowercase language, uppercase region. */
export const LOCALE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/

export interface ParsedLocale {
  /** ISO 639 language subtag, lowercase. */
  language: string
  /** ISO 3166-1 alpha-2 region subtag, uppercase, or null when unqualified. */
  region: string | null
}

/**
 * The country whose flag stands for a language when no region is given.
 * Shared so the picker, the flag helper and the catalog cannot drift apart.
 */
export const PREFERRED_COUNTRY: Record<string, string> = {
  en: 'US', fr: 'FR', de: 'DE', es: 'ES', zh: 'CN', ja: 'JP', ko: 'KR', vi: 'VN',
  pt: 'BR', ar: 'SA', ru: 'RU', hi: 'IN', it: 'IT', nl: 'NL', pl: 'PL', tr: 'TR',
  sv: 'SE', da: 'DK', nb: 'NO', fi: 'FI', cs: 'CZ', sk: 'SK', ro: 'RO', hu: 'HU',
  uk: 'UA', el: 'GR', th: 'TH', id: 'ID', ms: 'MY', fa: 'IR', he: 'IL', sw: 'TZ',
  bn: 'BD', ta: 'LK', te: 'IN', ml: 'IN', mr: 'IN', ur: 'PK', pa: 'IN', gu: 'IN',
  kn: 'IN', am: 'ET', ha: 'NG', yo: 'NG', zu: 'ZA', af: 'ZA', ka: 'GE', hy: 'AM',
  az: 'AZ', kk: 'KZ', uz: 'UZ', mn: 'MN', my: 'MM', km: 'KH', lo: 'LA', ne: 'NP',
  si: 'LK', ca: 'AD', eu: 'ES', gl: 'ES', cy: 'GB', is: 'IS', sq: 'AL', bs: 'BA',
  sr: 'RS', hr: 'HR', sl: 'SI', bg: 'BG', mk: 'MK', lv: 'LV', lt: 'LT', et: 'EE',
}

/**
 * Accepts the shapes people actually paste — `en_US`, `EN-us`, `en-us` — and
 * returns the canonical `en-US`, or null if it is not a locale code at all.
 */
export function normalizeLocaleCode(input: string): string | null {
  const trimmed = input.trim().replace(/_/g, '-')
  const match = /^([A-Za-z]{2,3})(?:-([A-Za-z]{2}))?$/.exec(trimmed)
  if (!match) return null
  const language = match[1]!.toLowerCase()
  const region = match[2]?.toUpperCase()
  return region ? `${language}-${region}` : language
}

export function parseLocaleCode(code: string): ParsedLocale | null {
  const normalized = normalizeLocaleCode(code)
  if (!normalized) return null
  const [language, region] = normalized.split('-')
  return { language: language!, region: region ?? null }
}

export function isValidLocaleCode(code: string): boolean {
  return LOCALE_CODE_PATTERN.test(code)
}

/**
 * The country a code's flag should show: its own region when it has one, so
 * `en-US` and `en-CA` are told apart at a glance, otherwise the language's
 * conventional country.
 */
export function countryForLocale(code: string): string | null {
  const parsed = parseLocaleCode(code)
  if (!parsed) return null
  return parsed.region ?? PREFERRED_COUNTRY[parsed.language] ?? null
}

/**
 * Android resource qualifier. A region is written `-r` + region, so `en-US`
 * belongs in `values-en-rUS`; `values-en-US` is not a qualifier Android
 * recognises and the translations in it are silently ignored.
 */
export function localeToAndroidQualifier(code: string): string {
  const parsed = parseLocaleCode(code)
  if (!parsed) return code
  return parsed.region ? `${parsed.language}-r${parsed.region}` : parsed.language
}

/** Human label: "English (United States)" when a region narrows the language. */
export function formatLocaleLabel(languageName: string, region: string | null, countryName?: string): string {
  if (!region) return languageName
  return `${languageName} (${countryName ?? region})`
}
