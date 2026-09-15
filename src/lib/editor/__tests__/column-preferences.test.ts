import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  clearColumnPreferences,
  columnPreferencesKey,
  defaultColumnPreferences,
  moveLocale,
  parseColumnPreferences,
  readColumnPreferences,
  serializeColumnPreferences,
  writeColumnPreferences,
  type ColumnPreferences,
} from '../column-preferences'

const LOCALES = ['vi', 'en', 'fr']

function preferences(overrides: Partial<ColumnPreferences> = {}): ColumnPreferences {
  return { ...defaultColumnPreferences(), ...overrides }
}

describe('parseColumnPreferences', () => {
  it('round trips what was written', () => {
    const saved = preferences({
      order: ['fr', 'vi', 'en'],
      hidden: ['en'],
      frozen: ['key', 'vi'],
      locked: ['fr'],
      keyWidth: 300,
      localeWidths: { vi: 250 },
    })
    expect(parseColumnPreferences(serializeColumnPreferences(saved), LOCALES)).toEqual(saved)
  })

  it('uses the default when nothing is stored', () => {
    expect(parseColumnPreferences(null, LOCALES)).toEqual(defaultColumnPreferences())
  })

  it('starts with the key column frozen, matching the editor default', () => {
    expect(defaultColumnPreferences().frozen).toEqual(['key'])
  })

  describe('a project whose locales have changed', () => {
    it('drops a locale the project no longer has, keeping the order of the rest', () => {
      const stored = serializeColumnPreferences(preferences({ order: ['fr', 'gone', 'vi', 'en'] }))
      expect(parseColumnPreferences(stored, LOCALES).order).toEqual(['fr', 'vi', 'en'])
    })

    it('says nothing about a locale added since, leaving it to sort last', () => {
      // The editor already sorts ids it does not find in the order to the end,
      // so a new locale needs no entry here — only an absence.
      const stored = serializeColumnPreferences(preferences({ order: ['fr', 'vi'] }))
      expect(parseColumnPreferences(stored, [...LOCALES, 'ja']).order).toEqual(['fr', 'vi'])
    })

    it('drops a removed locale from hidden, frozen, locked and widths too', () => {
      const stored = serializeColumnPreferences(preferences({
        hidden: ['gone', 'en'],
        frozen: ['key', 'gone'],
        locked: ['gone', 'fr'],
        localeWidths: { gone: 200, vi: 250 },
      }))
      const parsed = parseColumnPreferences(stored, LOCALES)

      expect(parsed.hidden).toEqual(['en'])
      expect(parsed.frozen).toEqual(['key'])
      expect(parsed.locked).toEqual(['fr'])
      expect(parsed.localeWidths).toEqual({ vi: 250 })
    })

    it('keeps the non-locale columns, which no locale list contains', () => {
      // 'key' and 'status' are columns but not locales. A filter that only knows
      // locale ids would quietly unfreeze the key column on every read.
      const stored = serializeColumnPreferences(preferences({ hidden: ['status'], frozen: ['key'] }))
      const parsed = parseColumnPreferences(stored, LOCALES)

      expect(parsed.hidden).toEqual(['status'])
      expect(parsed.frozen).toEqual(['key'])
    })
  })

  describe('data that cannot be trusted', () => {
    it('falls back on JSON that does not parse', () => {
      expect(parseColumnPreferences('{"order":', LOCALES)).toEqual(defaultColumnPreferences())
    })

    it('falls back on valid JSON of the wrong shape', () => {
      expect(parseColumnPreferences('"a string"', LOCALES)).toEqual(defaultColumnPreferences())
      expect(parseColumnPreferences('[1,2,3]', LOCALES)).toEqual(defaultColumnPreferences())
      expect(parseColumnPreferences('null', LOCALES)).toEqual(defaultColumnPreferences())
    })

    it('ignores a field of the wrong type rather than discarding the rest', () => {
      const parsed = parseColumnPreferences(
        JSON.stringify({ order: 'fr', hidden: ['en'], keyWidth: 'wide', localeWidths: [1, 2] }),
        LOCALES
      )
      expect(parsed.order).toEqual([])
      expect(parsed.hidden).toEqual(['en'])
      expect(parsed.keyWidth).toBeNull()
      expect(parsed.localeWidths).toEqual({})
    })

    it('drops a width that is not a usable number', () => {
      const parsed = parseColumnPreferences(
        JSON.stringify({ keyWidth: -10, localeWidths: { vi: 0, en: NaN, fr: 220 } }),
        LOCALES
      )
      expect(parsed.keyWidth).toBeNull()
      expect(parsed.localeWidths).toEqual({ fr: 220 })
    })

    it('drops a non-string inside an array of ids', () => {
      const parsed = parseColumnPreferences(JSON.stringify({ order: ['fr', 42, null, 'vi'] }), LOCALES)
      expect(parsed.order).toEqual(['fr', 'vi'])
    })
  })
})

/**
 * A real Map behind the Storage interface.
 *
 * jsdom in this project does not provide `window.localStorage` at all, which
 * the module already survives — but surviving it is not the same as storing,
 * and these tests are about storing. A stub also makes the failure modes below
 * something a test can ask for rather than something an environment happens to
 * do.
 */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, String(value)) },
    removeItem: (key) => { entries.delete(key) },
    clear: () => entries.clear(),
    key: (index) => Array.from(entries.keys())[index] ?? null,
    get length() { return entries.size },
    ...overrides,
  } as Storage
}

describe('storage access', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

  function useStorage(storage: Storage) {
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  }

  beforeEach(() => { useStorage(fakeStorage()) })

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis as object, 'localStorage')
    vi.restoreAllMocks()
  })

  it('writes and reads back through localStorage', () => {
    writeColumnPreferences('project-a', preferences({ order: ['fr', 'vi'] }))
    expect(readColumnPreferences('project-a', LOCALES).order).toEqual(['fr', 'vi'])
  })

  it('keys storage per project, so one arrangement cannot reach another', () => {
    writeColumnPreferences('project-a', preferences({ order: ['fr'] }))
    writeColumnPreferences('project-b', preferences({ order: ['vi'] }))

    expect(readColumnPreferences('project-a', LOCALES).order).toEqual(['fr'])
    expect(readColumnPreferences('project-b', LOCALES).order).toEqual(['vi'])
    expect(columnPreferencesKey('project-a')).not.toBe(columnPreferencesKey('project-b'))
  })

  it('forgets an arrangement that was cleared', () => {
    writeColumnPreferences('project-a', preferences({ order: ['fr'] }))
    clearColumnPreferences('project-a')
    expect(readColumnPreferences('project-a', LOCALES)).toEqual(defaultColumnPreferences())
  })

  it('returns the default when reading throws', () => {
    // Private browsing and storage-blocking extensions throw on access rather
    // than returning null, so a `typeof window` guard would not catch this.
    useStorage(fakeStorage({ getItem: () => { throw new Error('blocked') } }))
    expect(readColumnPreferences('project-a', LOCALES)).toEqual(defaultColumnPreferences())
  })

  it('does not throw when writing is refused', () => {
    // Quota exceeded, or storage disabled. Not remembering the arrangement is
    // acceptable; taking the editor down over a preference is not.
    useStorage(fakeStorage({ setItem: () => { throw new Error('quota') } }))
    expect(() => writeColumnPreferences('project-a', preferences())).not.toThrow()
  })

  it('does not throw when clearing is refused', () => {
    useStorage(fakeStorage({ removeItem: () => { throw new Error('blocked') } }))
    expect(() => clearColumnPreferences('project-a')).not.toThrow()
  })

  it('does not throw when the environment has no storage at all', () => {
    // What this project's test environment actually does, and what a server
    // render would do.
    Reflect.deleteProperty(globalThis as object, 'localStorage')
    expect(() => writeColumnPreferences('project-a', preferences())).not.toThrow()
    expect(readColumnPreferences('project-a', LOCALES)).toEqual(defaultColumnPreferences())
  })
})

describe('moveLocale', () => {
  const ALL = ['a', 'b', 'c', 'd']

  it('moves a locale later', () => {
    expect(moveLocale(ALL, ALL, 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a locale earlier', () => {
    expect(moveLocale(ALL, ALL, 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })

  it('moves one to the front', () => {
    expect(moveLocale(ALL, ALL, 'c', 'a')).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves one to the end', () => {
    expect(moveLocale(ALL, ALL, 'a', 'd')).toEqual(['b', 'c', 'd', 'a'])
  })

  it('does nothing when dropped on itself', () => {
    const current = [...ALL]
    expect(moveLocale(current, ALL, 'b', 'b')).toBe(current)
  })

  it('falls back to the full list on the first reorder', () => {
    // Order is empty until something is dragged. Without the fallback the first
    // drag computes positions against an empty array and silently does nothing.
    expect(moveLocale([], ALL, 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('leaves the order alone when an id is not in it', () => {
    const current = [...ALL]
    expect(moveLocale(current, ALL, 'ghost', 'b')).toBe(current)
    expect(moveLocale(current, ALL, 'a', 'ghost')).toBe(current)
  })

  it('reorders a stored subset without resurrecting what it omits', () => {
    // After a locale is removed from the project, the stored order is shorter
    // than the project's list. The move must work within what is stored.
    expect(moveLocale(['b', 'c'], ALL, 'c', 'b')).toEqual(['c', 'b'])
  })
})
