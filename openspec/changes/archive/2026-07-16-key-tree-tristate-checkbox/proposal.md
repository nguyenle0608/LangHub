## Why

The key tree checkbox is currently binary (checked / unchecked) and only tracks the exact node the user clicked. When a user checks a folder, its child rows still render as unchecked, and a folder with only some descendants selected gives no visual signal at all. This makes the current selection state ambiguous and hard to reason about, especially in deep key trees.

## What Changes

- Introduce a three-state checkbox (checked, unchecked, indeterminate) for every folder-like node in the key tree.
- A folder renders **checked** when all of its descendant keys are selected, **indeterminate** when only some are selected, and **unchecked** when none are.
- Checked state propagates downward visually: descendants of a checked ancestor render as checked.
- Clicking a checked or indeterminate folder deselects its whole subtree; clicking an unchecked folder selects its whole subtree.
- Leaf checkboxes remain two-state (checked / unchecked).
- The resulting set of filtered keys is unchanged — this is a selection-state and visual enhancement, not a change to which keys a given selection matches.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `translation-keys`: The "Checkbox filtering from key tree" requirement gains three-state checkbox behavior (checked/unchecked/indeterminate) with downward propagation of checked and indeterminate states across folder nodes.

## Impact

- `src/components/editor/TranslationTable.tsx` — `KeyTreeNodeRow` checkbox rendering (indeterminate ref wiring) and the `toggleKeyTreeChecked` selection logic.
- `src/lib/translation-key-tree.ts` — add a helper to derive per-node display state (checked/unchecked/indeterminate) from the current selection and the tree structure.
- `src/lib/__tests__/translation-key-tree.test.ts` — unit coverage for the new state-derivation helper.
- No database, API, or export/import behavior changes.
