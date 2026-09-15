## Why

Language columns can already be dragged into a different order in the editor header, but the arrangement is held in component state and is gone on the next reload. Someone who works in two languages out of sixteen rearranges them every time they open the project, which teaches them not to bother.

The Columns popup is where column arrangement is otherwise managed — hide, freeze, lock, widths, reset — but it is the one place that cannot reorder. Dragging in the header means finding a column that may be scrolled out of view and dragging it across the ones between; from the popup the whole list is visible at once and a move is one short drag.

## What Changes

- Column order survives a reload, per project, alongside the other column settings that are currently also lost: hidden, frozen and locked columns, and column widths.
- The Columns popup lists language columns in their current order with a drag handle, so they can be rearranged there as well as in the header.
- "Reset all" clears the saved arrangement, not only the in-memory one.
- Preferences are stored per project. Two projects with different languages do not share an arrangement, and a saved order that names a locale the project no longer has is ignored rather than treated as an error.

## Capabilities

### New Capabilities

None. Column arrangement is an existing editor concern, and persisting a local user setting is an existing application-preferences concern.

### Modified Capabilities

- `editor`: adds a requirement that language columns can be reordered from the Columns popup, not only from the table header.
- `application-preferences`: adds a requirement that editor column arrangement — order, visibility, freezing, locking and widths — persists per project for future visits, and that an arrangement referring to locales a project no longer has is discarded.

## Impact

- `src/components/editor/TranslationTable.tsx` — `localeOrder`, `hiddenCols`, `frozenCols`, `lockedCols`, `keyColWidth` and `localeColWidths` become persisted state; the Columns popover gains a reorderable list.
- A new module under `src/lib/editor/` for reading and writing the stored arrangement, following `src/lib/theme.ts`: a pure, testable shape with the storage key and the validation in one place.
- No database, API or migration changes. This is a per-browser preference, like the theme, and does not belong to the project's data.
- No change to what a column *does* — visibility, freezing, locking and editing behaviour are untouched. Only the arrangement is remembered, and only the way to change it is extended.
