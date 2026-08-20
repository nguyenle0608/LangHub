import { describe, expect, it } from 'vitest'
import {
  countryForLocale, formatLocaleLabel, isValidLocaleCode,
  localeToAndroidQualifier, normalizeLocaleCode, parseLocaleCode,
} from '../locale-code'

describe('normalizeLocaleCode', () => {
  it('canonicalises the shapes people paste', () => {
    expect(normalizeLocaleCode('en-US')).toBe('en-US')
    expect(normalizeLocaleCode('en_US')).toBe('en-US')
    expect(normalizeLocaleCode('EN-us')).toBe('en-US')
    expect(normalizeLocaleCode('  en-us  ')).toBe('en-US')
  })

  it('keeps an unqualified language as a language', () => {
    expect(normalizeLocaleCode('ms')).toBe('ms')
    expect(normalizeLocaleCode('MS')).toBe('ms')
    expect(normalizeLocaleCode('fil')).toBe('fil')
  })

  it('rejects things that are not locale codes', () => {
    for (const bad of ['', 'e', 'english', 'en-USA', 'en-U', '123', 'en-US-x']) {
      expect(normalizeLocaleCode(bad)).toBeNull()
    }
  })
})

describe('parseLocaleCode', () => {
  it('splits language from region', () => {
    expect(parseLocaleCode('en-CA')).toEqual({ language: 'en', region: 'CA' })
    expect(parseLocaleCode('ms')).toEqual({ language: 'ms', region: null })
  })
})

describe('isValidLocaleCode', () => {
  it('accepts only the canonical form', () => {
    expect(isValidLocaleCode('en-US')).toBe(true)
    expect(isValidLocaleCode('ms')).toBe(true)
    expect(isValidLocaleCode('en-us')).toBe(false)
    expect(isValidLocaleCode('EN')).toBe(false)
    expect(isValidLocaleCode('en_US')).toBe(false)
  })
})

describe('countryForLocale', () => {
  it('uses the region, which is what tells the variants apart', () => {
    expect(countryForLocale('en-US')).toBe('US')
    expect(countryForLocale('en-CA')).toBe('CA')
    expect(countryForLocale('en-MY')).toBe('MY')
  })

  it('falls back to the language\'s conventional country', () => {
    expect(countryForLocale('en')).toBe('US')
    expect(countryForLocale('ms')).toBe('MY')
  })

  it('returns null for an unknown language with no region', () => {
    expect(countryForLocale('xx')).toBeNull()
    expect(countryForLocale('not a code')).toBeNull()
  })
})

describe('localeToAndroidQualifier', () => {
  // values-en-US is not a qualifier Android recognises; the translations in
  // such a folder are silently ignored on device.
  it('writes a region as -r', () => {
    expect(localeToAndroidQualifier('en-US')).toBe('en-rUS')
    expect(localeToAndroidQualifier('zh-CN')).toBe('zh-rCN')
  })

  it('leaves an unqualified language alone', () => {
    expect(localeToAndroidQualifier('vi')).toBe('vi')
  })
})

describe('formatLocaleLabel', () => {
  it('names the country only when a region narrows the language', () => {
    expect(formatLocaleLabel('English', null)).toBe('English')
    expect(formatLocaleLabel('English', 'CA', 'Canada')).toBe('English (Canada)')
    expect(formatLocaleLabel('English', 'CA')).toBe('English (CA)')
  })
})
