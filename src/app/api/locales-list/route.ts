import { NextResponse } from 'next/server'

export interface LocaleOption {
  code: string        // ISO 639-1 (e.g. "vi") or BCP47 (e.g. "ca")
  name: string        // English language name
  nativeName: string  // Native language name
  flag: string        // Flag emoji from country cca2
  country: string     // Representative country name
}

// Preferred country (alpha_2) to use as the "canonical" flag for each language code
const PREFERRED_COUNTRY: Record<string, string> = {
  en:'US', fr:'FR', de:'DE', es:'ES', zh:'CN', ja:'JP', ko:'KR', vi:'VN',
  pt:'BR', ar:'SA', ru:'RU', hi:'IN', it:'IT', nl:'NL', pl:'PL', tr:'TR',
  sv:'SE', da:'DK', nb:'NO', fi:'FI', cs:'CZ', sk:'SK', ro:'RO', hu:'HU',
  uk:'UA', el:'GR', th:'TH', id:'ID', ms:'MY', fa:'IR', he:'IL', sw:'TZ',
  bn:'BD', ta:'LK', te:'IN', ml:'IN', mr:'IN', ur:'PK', pa:'IN', gu:'IN',
  kn:'IN', am:'ET', ha:'NG', yo:'NG', zu:'ZA', af:'ZA', ka:'GE', hy:'AM',
  az:'AZ', kk:'KZ', uz:'UZ', mn:'MN', my:'MM', km:'KH', lo:'LA', ne:'NP',
  si:'LK', ca:'AD', eu:'ES', gl:'ES', cy:'GB', is:'IS', sq:'AL', bs:'BA',
  sr:'RS', hr:'HR', sl:'SI', bg:'BG', mk:'MK', lv:'LV', lt:'LT', et:'EE',
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

    // Deduplicate: iso639_1 → best LocaleOption
    const localeMap = new Map<string, LocaleOption>()

    for (const country of countries) {
      const alpha2 = country.codes.alpha_2
      if (!alpha2) continue // skip territories without a country code

      for (const lang of country.languages ?? []) {
        const code = lang.iso639_1 || lang.bcp47
        if (!code) continue

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

    const all = Array.from(localeMap.values())
    all.sort((a, b) => {
      const pa = PRIORITY.indexOf(a.code)
      const pb = PRIORITY.indexOf(b.code)
      if (pa !== -1 && pb !== -1) return pa - pb
      if (pa !== -1) return -1
      if (pb !== -1) return 1
      return a.name.localeCompare(b.name)
    })

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
