import { NextResponse } from 'next/server'
import { PREFERRED_COUNTRY, formatLocaleLabel } from '@/lib/locale-code'

export interface LocaleOption {
  code: string        // "vi" (language) or "en-US" (language-region)
  name: string        // English language name, "English (Canada)" when regional
  nativeName: string  // Native language name
  flag: string        // Flag emoji from country cca2
  country: string     // Representative country name
  /** True for language-region entries, so the picker can group them. */
  regional?: boolean
}


// Sort order for display: most common languages first
const PRIORITY = ['en','zh','hi','es','fr','ar','bn','ru','pt','ur','id','de','ja','ko','vi','tr','it','nl','pl','fa','uk','ro','sv','cs','th','ms','da','fi','hu','el','he','nb']

function cca2ToFlag(cca2: string): string {
  // Regional Indicator A starts at U+1F1E6; offset by char code - 65 ('A')
  return cca2.toUpperCase().split('').map((c) =>
    String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))
  ).join('')
}

type V5Language = {
  bcp47: string
  iso639_1: string
  name: string
  native_name: string
}

type V5Country = {
  names: { common: string }
  codes: { alpha_2: string }
  languages?: V5Language[]
}

async function fetchAllCountries(): Promise<V5Country[]> {
  const apiKey = process.env.RESTCOUNTRIES_API_KEY
  const headers: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {}

  const base = 'https://api.restcountries.com/countries/v5?response_fields=names.common,codes.alpha_2,languages&limit=100'
  const all: V5Country[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const res = await fetch(`${base}&offset=${offset}`, {
      headers,
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`REST Countries v5 returned ${res.status}`)

    const json = await res.json() as { data: { objects: V5Country[]; meta: { more: boolean } } }
    all.push(...json.data.objects)
    hasMore = json.data.meta.more
    offset += 100
  }

  return all
}

export async function GET() {
  try {
    const countries = await fetchAllCountries()

    // One entry per language, plus one per language-region pair. The pairs were
    // previously computed and thrown away by the dedupe, which is why en-US and
    // en-CA could not be told apart — or even chosen.
    const localeMap = new Map<string, LocaleOption>()
    const regionalMap = new Map<string, LocaleOption>()

    for (const country of countries) {
      const alpha2 = country.codes.alpha_2
      if (!alpha2) continue // skip territories without a country code

      for (const lang of country.languages ?? []) {
        const code = lang.iso639_1 || lang.bcp47
        if (!code) continue

        const regionalCode = `${code.toLowerCase()}-${alpha2.toUpperCase()}`
        if (!regionalMap.has(regionalCode)) {
          regionalMap.set(regionalCode, {
            code: regionalCode,
            name: formatLocaleLabel(lang.name, alpha2.toUpperCase(), country.names.common),
            nativeName: lang.native_name || lang.name,
            flag: cca2ToFlag(alpha2),
            country: country.names.common,
            regional: true,
          })
        }

        const existing = localeMap.get(code)
        const isPreferred = country.codes.alpha_2 === PREFERRED_COUNTRY[code]

        if (!existing || isPreferred) {
          localeMap.set(code, {
            code,
            name: lang.name,
            nativeName: lang.native_name || lang.name,
            flag: cca2ToFlag(alpha2),
            country: country.names.common,
          })
        }
      }
    }

    const byPriorityThenName = (a: LocaleOption, b: LocaleOption) => {
      const pa = PRIORITY.indexOf(a.code)
      const pb = PRIORITY.indexOf(b.code)
      if (pa !== -1 && pb !== -1) return pa - pb
      if (pa !== -1) return -1
      if (pb !== -1) return 1
      return a.name.localeCompare(b.name)
    }

    // Plain languages stay at the top so the common case is unchanged; the
    // regional variants follow and are reached by searching.
    const languages = Array.from(localeMap.values()).sort(byPriorityThenName)
    const regional = Array.from(regionalMap.values())
      .filter((option) => !localeMap.has(option.code))
      .sort((a, b) => a.name.localeCompare(b.name))
    const all = [...languages, ...regional]

    return NextResponse.json(all, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('locales-list error:', err)

    // Fallback if API unreachable
    const fallback: LocaleOption[] = [
      { code:'en', name:'English',    nativeName:'English',         flag:'🇺🇸', country:'United States' },
      { code:'zh', name:'Chinese',    nativeName:'中文',             flag:'🇨🇳', country:'China' },
      { code:'hi', name:'Hindi',      nativeName:'हिन्दी',           flag:'🇮🇳', country:'India' },
      { code:'es', name:'Spanish',    nativeName:'Español',         flag:'🇪🇸', country:'Spain' },
      { code:'fr', name:'French',     nativeName:'Français',        flag:'🇫🇷', country:'France' },
      { code:'ar', name:'Arabic',     nativeName:'العربية',         flag:'🇸🇦', country:'Saudi Arabia' },
      { code:'pt', name:'Portuguese', nativeName:'Português',       flag:'🇧🇷', country:'Brazil' },
      { code:'ru', name:'Russian',    nativeName:'Русский',         flag:'🇷🇺', country:'Russia' },
      { code:'de', name:'German',     nativeName:'Deutsch',         flag:'🇩🇪', country:'Germany' },
      { code:'ja', name:'Japanese',   nativeName:'日本語',           flag:'🇯🇵', country:'Japan' },
      { code:'ko', name:'Korean',     nativeName:'한국어',           flag:'🇰🇷', country:'South Korea' },
      { code:'vi', name:'Vietnamese', nativeName:'Tiếng Việt',      flag:'🇻🇳', country:'Vietnam' },
      { code:'it', name:'Italian',    nativeName:'Italiano',        flag:'🇮🇹', country:'Italy' },
      { code:'nl', name:'Dutch',      nativeName:'Nederlands',      flag:'🇳🇱', country:'Netherlands' },
      { code:'tr', name:'Turkish',    nativeName:'Türkçe',          flag:'🇹🇷', country:'Turkey' },
      { code:'th', name:'Thai',       nativeName:'ภาษาไทย',        flag:'🇹🇭', country:'Thailand' },
      { code:'id', name:'Indonesian', nativeName:'Bahasa Indonesia',flag:'🇮🇩', country:'Indonesia' },
    ]
    return NextResponse.json(fallback)
  }
}
