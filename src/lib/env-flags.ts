/**
 * Reading a boolean out of the environment.
 *
 * The strict `=== 'true'` this replaces was defensible and still cost an
 * afternoon: a variable set to `TRUE` left every v1 endpoint answering 404,
 * which is exactly what a deployment that has not been rebuilt looks like, and
 * exactly what a wrong project id looks like. There is no log line and no way
 * to tell the three apart from outside.
 *
 * Accepting the obvious spellings removes that trap without loosening
 * anything. The flag is off unless the value is an explicit yes, so an unset,
 * empty, misspelled or hostile value still fails closed — the only change is
 * that a value whose author plainly meant "on" now behaves that way.
 */
const ENABLED = new Set(['true', '1', 'yes', 'on'])

export function isFlagEnabled(value: string | undefined): boolean {
  return value !== undefined && ENABLED.has(value.trim().toLowerCase())
}
