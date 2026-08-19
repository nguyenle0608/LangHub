// Which keys of a staged import file the user has chosen to import. The preview
// offers three groups — brand new keys, keys whose translation is still empty,
// and keys that would overwrite an existing value — and every one of them is
// de-selectable, so a selection set spans all three.

export interface SelectableFile {
  newKeys?: string[]
  fillKeys?: string[]
  duplicateKeys?: string[]
}

/** Every dot-key a file offers, across the three preview groups. */
export function allKeysOf(entry: SelectableFile): string[] {
  return [...(entry.newKeys ?? []), ...(entry.fillKeys ?? []), ...(entry.duplicateKeys ?? [])]
}

/** How many of one group's keys are currently selected. */
export function countSelected(groupKeys: string[] | undefined, selected: Set<string> | undefined): number {
  if (!groupKeys?.length || !selected?.size) return 0
  return groupKeys.reduce((sum, dotKey) => sum + (selected.has(dotKey) ? 1 : 0), 0)
}

/**
 * Add or remove only the given group's keys.
 *
 * A selection set spans all three groups, so replacing it wholesale here would
 * discard the other groups' choices — "None" on new keys would silently clear
 * the duplicate overwrites the user had ticked.
 */
export function applyGroupSelection(
  selected: Set<string> | undefined,
  groupKeys: string[],
  checked: boolean
): Set<string> {
  const next = new Set(selected ?? [])
  for (const dotKey of groupKeys) {
    if (checked) next.add(dotKey)
    else next.delete(dotKey)
  }
  return next
}

/**
 * The keys to send as `skipKeys`: everything the file offers that the user left
 * un-selected. New keys included — they used to be force-imported.
 */
export function computeSkipKeys(entry: SelectableFile, selected: Set<string> | undefined): string[] {
  const chosen = selected ?? new Set<string>()
  return allKeysOf(entry).filter((dotKey) => !chosen.has(dotKey))
}
