import { describe, it, expect } from 'vitest'
import { exportAndroidXML } from '../android'
import { exportIOSStrings } from '../ios'
import { parseAndroidXML } from '../../parsers/android'
import { parseIOSStrings } from '../../parsers/ios'

// ── Android strings.xml ─────────────────────────────────────────────────────

describe('exportAndroidXML', () => {
  it('wraps entries in a resources document', () => {
    const xml = exportAndroidXML({ app_name: 'LangHub', greeting: 'Hello' })
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>')
    expect(xml).toContain('<resources>')
    expect(xml).toContain('<string name="app_name">LangHub</string>')
    expect(xml).toContain('</resources>')
  })

  it('escapes XML, apostrophes, quotes and controls', () => {
    const xml = exportAndroidXML({ msg: `Tom & Jerry's "quote" <b>` })
    expect(xml).toContain(`<string name="msg">Tom &amp; Jerry\\'s \\"quote\\" &lt;b&gt;</string>`)
  })

  it('escapes leading @ and ?', () => {
    const xml = exportAndroidXML({ a: '@handle', b: '?query' })
    expect(xml).toContain('<string name="a">\\@handle</string>')
    expect(xml).toContain('<string name="b">\\?query</string>')
  })
})

describe('Android round-trip', () => {
  it('preserves values with special characters', () => {
    const original = {
      'auth.title': 'Sign in',
      'checkout.cta': `Tom & Jerry's "deal" <now>`,
      'greet.hi': 'Hello %1$s!\nLine two',
    }
    const parsed = parseAndroidXML(exportAndroidXML(original))
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.keys).toEqual(original)
  })

  it('parses single-quoted names and self-closing empty strings', () => {
    const xml = `<resources>
      <string name='only.key'>value</string>
      <string name="empty.key"/>
    </resources>`
    const r = parseAndroidXML(xml)
    expect(r.keys['only.key']).toBe('value')
    expect(r.keys['empty.key']).toBe('')
  })

  it('warns on unsupported plurals and string-arrays but still reads strings', () => {
    const xml = `<resources>
      <string name="a">A</string>
      <plurals name="n"><item quantity="one">one</item></plurals>
      <string-array name="arr"><item>x</item></string-array>
    </resources>`
    const r = parseAndroidXML(xml)
    expect(r.keys).toEqual({ a: 'A' })
    expect(r.warnings.some((w) => w.includes('plurals'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('string-array'))).toBe(true)
  })

  it('errors without a resources root', () => {
    expect(parseAndroidXML('<foo/>').errors).toHaveLength(1)
  })
})

// ── iOS Localizable.strings ─────────────────────────────────────────────────

describe('exportIOSStrings', () => {
  it('emits key = value pairs', () => {
    const out = exportIOSStrings({ 'auth.title': 'Sign in' })
    expect(out).toBe('"auth.title" = "Sign in";\n')
  })

  it('escapes quotes, backslashes and newlines', () => {
    const out = exportIOSStrings({ msg: 'Say "hi"\nnext\\path' })
    expect(out).toBe('"msg" = "Say \\"hi\\"\\nnext\\\\path";\n')
  })
})

describe('iOS round-trip', () => {
  it('preserves values with quotes and newlines', () => {
    const original = {
      'auth.title': 'Sign in',
      'msg.body': 'Say "hello"\nworld',
      'path.win': 'C:\\Users',
    }
    const parsed = parseIOSStrings(exportIOSStrings(original))
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.keys).toEqual(original)
  })

  it('ignores comments and reads valid pairs', () => {
    const strings = `/* Screen title */
"auth.title" = "Sign in";
// a line comment
"auth.subtitle" = "Welcome back";`
    const r = parseIOSStrings(strings)
    expect(r.keys).toEqual({ 'auth.title': 'Sign in', 'auth.subtitle': 'Welcome back' })
  })

  it('warns when nothing matches', () => {
    expect(parseIOSStrings('no pairs here').warnings).toHaveLength(1)
  })
})
