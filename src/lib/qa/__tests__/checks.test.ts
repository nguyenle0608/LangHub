import { describe, it, expect } from 'vitest'
import { checkTranslation, extractPlaceholders, extractTags } from '../checks'

const rules = (source: string, target: string) => checkTranslation(source, target).map((i) => i.rule)

describe('extractPlaceholders', () => {
  it('extracts printf, iOS, ICU and mustache placeholders', () => {
    expect(extractPlaceholders('Hi %s and %@').sort()).toEqual(['%@', '%s'])
    expect(extractPlaceholders('Hi {name}, {{count}} left')).toContain('{name}')
    expect(extractPlaceholders('Hi {name}, {{count}} left')).toContain('{{count}}')
  })

  it('normalizes positional/width printf and brace whitespace', () => {
    expect(extractPlaceholders('%1$02d')).toEqual(['%d'])
    expect(extractPlaceholders('{ name }')).toEqual(['{name}'])
  })

  it('ignores literal %%', () => {
    expect(extractPlaceholders('100%% done')).toEqual([])
  })

  it('counts empty positional braces {} (easy_localization / Flutter)', () => {
    expect(extractPlaceholders('You have {} items')).toEqual(['{}'])
    expect(extractPlaceholders('{} + {} = {}')).toEqual(['{}', '{}', '{}'])
    expect(extractPlaceholders('{ }')).toEqual(['{}'])
  })
})

describe('extractTags', () => {
  it('captures open, close and self-closing tags', () => {
    expect(extractTags('<b>hi</b><br/>')).toEqual(['b', '/b', 'br'])
  })
})

describe('checkTranslation', () => {
  it('passes a clean translation', () => {
    expect(checkTranslation('Hello {name}', 'Hola {name}')).toEqual([])
  })

  it('skips empty source or target', () => {
    expect(checkTranslation('Hello {name}', '')).toEqual([])
    expect(checkTranslation('', 'Hola')).toEqual([])
  })

  it('flags a missing placeholder', () => {
    expect(rules('Hello {name}', 'Hola')).toContain('placeholder-missing')
  })

  it('flags a missing empty positional brace {}', () => {
    expect(rules('You have {} items', 'Tienes elementos')).toContain('placeholder-missing')
    expect(checkTranslation('You have {} items', 'Tienes {} elementos')).toEqual([])
  })

  it('flags count mismatch of {} placeholders', () => {
    expect(rules('{} of {}', '{}')).toContain('placeholder-missing')
  })

  it('flags an unexpected placeholder', () => {
    expect(rules('Hello', 'Hola {name}')).toContain('placeholder-extra')
  })

  it('allows placeholder reordering (printf positional)', () => {
    expect(checkTranslation('%1$s bought %2$s', '%2$s comprado por %1$s')).toEqual([])
  })

  it('flags a missing printf specifier', () => {
    expect(rules('You have %d items', 'Tienes elementos')).toContain('placeholder-missing')
  })

  it('flags mismatched HTML tags', () => {
    expect(rules('Click <b>here</b>', 'Haz clic aquí')).toContain('html-mismatch')
  })

  it('accepts matching HTML tags', () => {
    expect(rules('Click <b>here</b>', 'Haz clic <b>aquí</b>')).not.toContain('html-mismatch')
  })

  it('flags leading and trailing whitespace differences', () => {
    expect(rules('Hello', ' Hello')).toContain('leading-whitespace')
    expect(rules('Hello', 'Hello ')).toContain('trailing-whitespace')
  })

  it('does not flag whitespace when it matches the source', () => {
    expect(rules(' Hello ', ' Hola ')).toEqual([])
  })

  it('reports multiple issues at once', () => {
    const r = rules('Hi {name}', 'Hola {nombre} ')
    expect(r).toContain('placeholder-missing')
    expect(r).toContain('placeholder-extra')
    expect(r).toContain('trailing-whitespace')
  })
})
