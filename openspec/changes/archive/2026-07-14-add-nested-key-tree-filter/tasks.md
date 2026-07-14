## 1. Tree Model and Filtering Logic

- [x] 1.1 Add a typed tree node model for root, folder, and leaf translation-key items.
- [x] 1.2 Implement a utility that converts flat translation key names into a nested tree rooted at `{}` using dot-separated segments.
- [x] 1.3 Handle flat keys, empty or malformed segments, and cases where a parent path is also a complete key.
- [x] 1.4 Implement selection helpers that resolve checked tree node IDs into the matching set of translation key IDs or names.
- [x] 1.5 Add unit tests for tree construction and selected-node filtering behavior.

## 2. Nested Key Tree UI

- [x] 2.1 Add a nested key tree view to the translation workspace alongside the existing key list/table controls.
- [x] 2.2 Render `{}` as the root folder and render parent path segments with folder-like affordances.
- [x] 2.3 Render a checkbox before every root, folder, and leaf item.
- [x] 2.4 Support expanding/collapsing folder nodes without losing checkbox selection state.
- [x] 2.5 Visually distinguish exact leaf keys from folder nodes when a parent path also exists as a real key.

## 3. Compose With Existing Translation Key Filters

- [x] 3.1 Add checked tree node state to the translation table/editor client state.
- [x] 3.2 Apply tree filtering to visible translation keys, showing all keys when no tree item is checked.
- [x] 3.3 Compose tree filtering with existing search/status/locale filters so all active filters apply together.
- [x] 3.4 Ensure selecting multiple tree items shows the union of all matching descendant or exact keys.

## 4. Verification

- [x] 4.1 Verify the UI with nested keys such as `auth.login.title`, `auth.logout`, and `settings.profile.name`.
- [x] 4.2 Verify flat keys remain directly under `{}` and can be selected individually.
- [x] 4.3 Verify `auth` as a real key can be filtered separately from descendants under the `auth` folder.
- [x] 4.4 Run the project test suite and lint/type checks relevant to the changed files.
