## Why

Translation keys often use nested dot notation that represents a logical hierarchy, but a flat key list makes it hard to understand structure or focus on a specific section. A tree-style key view will make nested key groups easier to browse and filter, especially for projects with many keys.

## What Changes

- Add a nested key tree view that represents parent key segments as folder-like nodes.
- Represent the root `{}` as the top-level folder containing the entire key hierarchy.
- Add a checkbox before every tree item, including folders and leaf keys, to filter the translation key list by selected node(s).
- Selecting a parent folder filters to all descendant keys; selecting a leaf filters to that specific key.
- Preserve the existing translation key management behavior while adding this as an additional browsing/filtering mode.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `translation-keys`: Add hierarchical nested-key browsing and checkbox-based filtering for translation keys.

## Impact

- Affected UI for translation key browsing/search/filtering in the project translation workspace.
- Adds client-side transformation from flat translation keys into a folder-like tree model.
- Adds filter state for checked tree nodes and applies it to the visible key list/editor rows.
- No database schema, API, or dependency changes are expected.
