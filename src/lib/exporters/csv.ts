/**
 * Delimited exports: a key column followed by one column per locale.
 *
 * CSV and TSV are separate formats. They differ in more than the delimiter —
 * what has to be quoted differs too, since a comma is ordinary text in a TSV
 * and a tab is ordinary text in a CSV.
 */

type Translations = Record<string, Record<string, string>> // keyName → localeCode → value

function buildTable(
  keyNames: string[],
  locales: string[],
  translations: Translations,
  delimiter: string,
  escape: (value: string) => string
): string {
  const header = ['key', ...locales].map(escape).join(delimiter)
  const rows = keyNames.map((key) => {
    const cells = [key, ...locales.map((locale) => translations[key]?.[locale] ?? '')]
    return cells.map(escape).join(delimiter)
  })
  return [header, ...rows].join('\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function tsvEscape(value: string): string {
  // A comma needs no quoting here, but a tab does — unquoted it would open a
  // new column. Newlines are quoted so the value can be put back together on
  // the way in; see the reader in parsers/delimited.
  if (value.includes('\t') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportCSV(keyNames: string[], locales: string[], translations: Translations): string {
  return buildTable(keyNames, locales, translations, ',', csvEscape)
}

export function exportTSV(keyNames: string[], locales: string[], translations: Translations): string {
  return buildTable(keyNames, locales, translations, '\t', tsvEscape)
}
