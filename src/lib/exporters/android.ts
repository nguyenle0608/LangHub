// Android string resources (res/values/strings.xml).
// Keys are written verbatim into the name attribute; escaping follows the
// Android resource rules so the file compiles and renders identically.

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAndroidValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // must run before other backslash escapes
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/^([@?])/, '\\$1') // leading @ or ? are reserved
}

export function exportAndroidXML(keys: Record<string, string>): string {
  const lines = ['<?xml version="1.0" encoding="utf-8"?>', '<resources>']
  for (const [key, value] of Object.entries(keys)) {
    lines.push(`    <string name="${escapeAttr(key)}">${escapeAndroidValue(value)}</string>`)
  }
  lines.push('</resources>')
  return lines.join('\n') + '\n'
}
