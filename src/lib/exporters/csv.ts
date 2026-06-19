// rows: array of { key, [localeCode]: value }
export function exportCSV(
  keyNames: string[],
  locales: string[],
  translations: Record<string, Record<string, string>> // keyName → localeCode → value
): string {
  const header = ['key', ...locales].map(csvEscape).join(',')
  const rows = keyNames.map((k) => {
    const cols = [k, ...locales.map((l) => translations[k]?.[l] ?? '')]
    return cols.map(csvEscape).join(',')
  })
  return [header, ...rows].join('\n')
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
