// Single source of truth for the translation key charset. Keys arrive from
// i18next, ARB, Android, and iOS files, so camelCase and kebab-case are both
// common in the wild — validating against a lowercase-only charset rejected
// valid files. Mirrored by the `apply_translation_import` SQL guard.
export const TRANSLATION_KEY_PATTERN = /^[A-Za-z0-9_.-]+$/
export const TRANSLATION_KEY_MAX_LENGTH = 200
export const TRANSLATION_KEY_FORMAT_HINT = 'Letters, numbers, dots, underscores, hyphens only'

export function isValidTranslationKey(key: string): boolean {
  return key.length > 0
    && key.length <= TRANSLATION_KEY_MAX_LENGTH
    && TRANSLATION_KEY_PATTERN.test(key)
}
