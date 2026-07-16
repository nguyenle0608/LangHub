## Why

The editor translation table shows per-language status filter icons for target languages, but the base language column hides that filter affordance. Users expect the base column to behave consistently with other language columns and be filterable from the header.

## What Changes

- Show the status filter icon in the base language column header.
- Allow the existing per-column status filter popover to work for base language columns.
- Keep existing active-filter chips and clear-all behavior for column filters.

## Capabilities

### Modified Capabilities
- `editor`: Improve language column filtering consistency by supporting base language column filters.

## Impact

- Affected UI: editor translation table language headers.
- Affected code: `src/components/editor/TranslationTable.tsx`.
- No API, database, or permission changes expected.
