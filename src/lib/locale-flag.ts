import { countryForLocale } from './locale-code'

/**
 * Flag for a locale code.
 *
 * Region-qualified codes take their own flag — en-US is 🇺🇸 and en-CA is 🇨🇦 —
 * because in a list of locales the flag is the thing that tells them apart.
 * A bare language falls back to its conventional country.
 */
export function localeFlag(code: string): string {
  const cca2 = countryForLocale(code)
  if (!cca2) return '🌐'
  return cca2.toUpperCase().split('').map((c) =>
    String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))
  ).join('')
}
