const LOCALE_TO_CCA2: Record<string, string> = {
  en:'US', fr:'FR', de:'DE', es:'ES', zh:'CN', ja:'JP', ko:'KR', vi:'VN',
  pt:'BR', ar:'SA', ru:'RU', hi:'IN', it:'IT', nl:'NL', pl:'PL', tr:'TR',
  sv:'SE', da:'DK', nb:'NO', fi:'FI', cs:'CZ', sk:'SK', ro:'RO', hu:'HU',
  uk:'UA', el:'GR', th:'TH', id:'ID', ms:'MY', fa:'IR', he:'IL', sw:'TZ',
  bn:'BD', ta:'LK', ur:'PK', ka:'GE', hy:'AM', az:'AZ', kk:'KZ', mn:'MN',
  my:'MM', km:'KH', lo:'LA', ne:'NP', si:'LK', ca:'AD', is:'IS', sq:'AL',
  sr:'RS', hr:'HR', bg:'BG', lv:'LV', lt:'LT', et:'EE',
}

export function localeFlag(code: string): string {
  const cca2 = LOCALE_TO_CCA2[code]
  if (!cca2) return '🌐'
  return cca2.toUpperCase().split('').map((c) =>
    String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))
  ).join('')
}
