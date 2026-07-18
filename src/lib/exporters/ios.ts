// iOS / macOS Localizable.strings ("key" = "value"; pairs).

function escapeIOS(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // must run before other backslash escapes
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

export function exportIOSStrings(keys: Record<string, string>): string {
  const lines = Object.entries(keys).map(
    ([key, value]) => `"${escapeIOS(key)}" = "${escapeIOS(value)}";`
  )
  return lines.join('\n') + '\n'
}
