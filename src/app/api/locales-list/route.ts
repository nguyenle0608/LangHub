import { NextResponse } from 'next/server'

export interface LocaleOption {
  code: string        // ISO 639-1 (e.g. "en") or ISO 639-3 (e.g. "zho")
  name: string        // English name of the language
  nativeName: string  // Native language name
  flag: string        // Flag emoji derived from country cca2
  country: string     // Representative country name
}

// ISO 639-3 → ISO 639-1 mapping for languages that have a 2-letter code
const ISO3_TO_ISO1: Record<string, string> = {
  abk:'ab', aar:'aa', afr:'af', aka:'ak', sqi:'sq', amh:'am', ara:'ar', arg:'an',
  hye:'hy', ava:'av', ave:'ae', aym:'ay', aze:'az', bam:'bm', bak:'ba', eus:'eu',
  bel:'be', ben:'bn', bis:'bi', bos:'bs', bre:'br', bul:'bg', mya:'my', cat:'ca',
  cha:'ch', che:'ce', nya:'ny', zho:'zh', chu:'cu', chv:'cv', cor:'kw', cos:'co',
  cre:'cr', hrv:'hr', ces:'cs', dan:'da', div:'dv', nld:'nl', dzo:'dz', eng:'en',
  epo:'eo', est:'et', ewe:'ee', fao:'fo', fij:'fj', fin:'fi', fra:'fr', fry:'fy',
  ful:'ff', glg:'gl', kat:'ka', deu:'de', ell:'el', grn:'gn', guj:'gu', hat:'ht',
  hau:'ha', heb:'he', her:'hz', hin:'hi', hmo:'ho', hun:'hu', ina:'ia', ind:'id',
  ile:'ie', gle:'ga', ibo:'ig', ipk:'ik', ido:'io', isl:'is', ita:'it', iku:'iu',
  jpn:'ja', jav:'jv', kau:'kr', kan:'kn', kaz:'kk', khm:'km', kik:'ki', kin:'rw',
  kir:'ky', kom:'kv', kon:'kg', kor:'ko', kur:'ku', lao:'lo', lat:'la', lav:'lv',
  lim:'li', lin:'ln', lit:'lt', lub:'lu', ltz:'lb', mkd:'mk', mlg:'mg', msa:'ms',
  mal:'ml', mlt:'mt', glv:'gv', mri:'mi', mar:'mr', mah:'mh', mon:'mn', nau:'na',
  nav:'nv', nob:'nb', nde:'nd', nep:'ne', ndo:'ng', nno:'nn', nor:'no', iii:'ii',
  nbl:'nr', oci:'oc', oji:'oj', chu2:'cu', orm:'om', ori:'or', oss:'os', pan:'pa',
  pli:'pi', fas:'fa', pol:'pl', pus:'ps', por:'pt', que:'qu', roh:'rm', run:'rn',
  ron:'ro', rus:'ru', san:'sa', srd:'sc', snd:'sd', sme:'se', smo:'sm', sag:'sg',
  srp:'sr', gla:'gd', sna:'sn', sin:'si', slk:'sk', slv:'sl', som:'so', sot:'st',
  spa:'es', sun:'su', swa:'sw', ssw:'ss', swe:'sv', tam:'ta', tel:'te', tgk:'tg',
  tha:'th', tir:'ti', bod:'bo', tuk:'tk', tgl:'tl', tsn:'tn', ton:'to', tur:'tr',
  tso:'ts', tat:'tt', twi:'tw', tah:'ty', uig:'ug', ukr:'uk', urd:'ur', uzb:'uz',
  ven:'ve', vie:'vi', vol:'vo', wln:'wa', cym:'cy', wol:'wo', xho:'xh', yid:'yi',
  yor:'yo', zha:'za', zul:'zu',
}

// Preferred country for each ISO 639-1 code (so we show the canonical flag)
const PREFERRED_COUNTRY: Record<string, string> = {
  en:'US', fr:'FR', de:'DE', es:'ES', zh:'CN', ja:'JP', ko:'KR', vi:'VN',
  pt:'BR', ar:'SA', ru:'RU', hi:'IN', it:'IT', nl:'NL', pl:'PL', tr:'TR',
  sv:'SE', da:'DK', nb:'NO', fi:'FI', cs:'CZ', sk:'SK', ro:'RO', hu:'HU',
  uk:'UA', el:'GR', th:'TH', id:'ID', ms:'MY', fa:'IR', he:'IL', sw:'TZ',
  bn:'BD', ta:'LK', te:'IN', ml:'IN', mr:'IN', ur:'PK', pa:'IN', gu:'IN',
  kn:'IN', or:'IN', am:'ET', ha:'NG', yo:'NG', ig:'NG', zu:'ZA', af:'ZA',
  ka:'GE', hy:'AM', az:'AZ', kk:'KZ', uz:'UZ', tg:'TJ', ky:'KG', tk:'TM',
  mn:'MN', my:'MM', km:'KH', lo:'LA', si:'LK', ne:'NP', bo:'CN', ug:'CN',
}

function cca2ToFlag(cca2: string): string {
  return cca2.toUpperCase().split('').map((c) => String.fromCodePoint(0x1f1e0 - 65 + c.charCodeAt(0))).join('')
}

type RestCountry = {
  name: { common: string }
  cca2: string
  languages?: Record<string, string>
}

export async function GET() {
  try {
    const res = await fetch(
      'https://restcountries.com/v3.1/all?fields=name,cca2,languages',
      {
        next: { revalidate: 86400 },
        headers: process.env.RESTCOUNTRIES_API_KEY
          ? { Authorization: `Bearer ${process.env.RESTCOUNTRIES_API_KEY}` }
          : {},
      }
    )

    if (!res.ok) throw new Error(`restcountries returned ${res.status}`)

    const countries = await res.json() as RestCountry[]

    // Build map: iso639-1 → best entry
    const localeMap = new Map<string, LocaleOption>()

    for (const country of countries) {
      if (!country.languages) continue

      for (const [iso3, langName] of Object.entries(country.languages)) {
        const iso1 = ISO3_TO_ISO1[iso3] ?? iso3
        const preferred = PREFERRED_COUNTRY[iso1]
        const existing = localeMap.get(iso1)

        // Use this country if: no entry yet, OR this is the preferred country
        if (!existing || country.cca2 === preferred) {
          localeMap.set(iso1, {
            code: iso1,
            name: langName,
            nativeName: langName,
            flag: cca2ToFlag(country.cca2),
            country: country.name.common,
          })
        }
      }
    }

    // Sort: preferred common languages first, then alphabetical
    const priority = ['en','zh','hi','es','fr','ar','bn','ru','pt','ur','id','de','ja','ko','vi','tr','it','nl','pl','fa','uk','ro','sv','cs','th','ms','da','fi','hu','el','he','nb']
    const all = Array.from(localeMap.values())
    all.sort((a, b) => {
      const pa = priority.indexOf(a.code)
      const pb = priority.indexOf(b.code)
      if (pa !== -1 && pb !== -1) return pa - pb
      if (pa !== -1) return -1
      if (pb !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(all, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch (err) {
    // Fallback to hardcoded common locales if API unreachable
    const fallback: LocaleOption[] = [
      { code:'en', name:'English',    nativeName:'English',    flag:'🇺🇸', country:'United States' },
      { code:'zh', name:'Chinese',    nativeName:'中文',        flag:'🇨🇳', country:'China' },
      { code:'hi', name:'Hindi',      nativeName:'हिन्दी',      flag:'🇮🇳', country:'India' },
      { code:'es', name:'Spanish',    nativeName:'Español',    flag:'🇪🇸', country:'Spain' },
      { code:'fr', name:'French',     nativeName:'Français',   flag:'🇫🇷', country:'France' },
      { code:'ar', name:'Arabic',     nativeName:'العربية',    flag:'🇸🇦', country:'Saudi Arabia' },
      { code:'pt', name:'Portuguese', nativeName:'Português',  flag:'🇧🇷', country:'Brazil' },
      { code:'ru', name:'Russian',    nativeName:'Русский',    flag:'🇷🇺', country:'Russia' },
      { code:'de', name:'German',     nativeName:'Deutsch',    flag:'🇩🇪', country:'Germany' },
      { code:'ja', name:'Japanese',   nativeName:'日本語',      flag:'🇯🇵', country:'Japan' },
      { code:'ko', name:'Korean',     nativeName:'한국어',      flag:'🇰🇷', country:'South Korea' },
      { code:'vi', name:'Vietnamese', nativeName:'Tiếng Việt', flag:'🇻🇳', country:'Vietnam' },
      { code:'it', name:'Italian',    nativeName:'Italiano',   flag:'🇮🇹', country:'Italy' },
      { code:'nl', name:'Dutch',      nativeName:'Nederlands', flag:'🇳🇱', country:'Netherlands' },
      { code:'tr', name:'Turkish',    nativeName:'Türkçe',     flag:'🇹🇷', country:'Turkey' },
      { code:'th', name:'Thai',       nativeName:'ภาษาไทย',   flag:'🇹🇭', country:'Thailand' },
      { code:'id', name:'Indonesian', nativeName:'Bahasa Indonesia', flag:'🇮🇩', country:'Indonesia' },
    ]
    console.error('locales-list fallback:', err)
    return NextResponse.json(fallback)
  }
}
