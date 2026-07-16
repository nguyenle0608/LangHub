## Context

The key tree in `TranslationTable.tsx` filters visible keys via checkboxes on tree nodes. Selection state is held in `checkedKeyTreeNodeIds: Set<string>` — a set of *node IDs* the user clicked directly. `resolveCheckedTranslationKeyIds(tree, checkedNodeIds)` expands each checked node to its `descendantKeyIds` and returns the union of key IDs to filter by (or `null` when nothing is checked).

Two problems follow from storing raw node IDs:
1. The checkbox is a plain binary `<input type="checkbox">` (TranslationTable.tsx:155). Checking a folder puts only that folder's node ID in the set, so its child rows still render unchecked, and a folder with a mix of selected/unselected descendants shows nothing.
2. There is no notion of a folder being "partially" selected.

## Goals / Non-Goals

**Goals:**
- Render folder-like nodes with three states: checked, unchecked, indeterminate.
- Propagate checked state visually to descendants of a checked node.
- Keep the *set of filtered keys* produced by a given selection unchanged.
- Keep state-derivation logic pure and unit-testable in `translation-key-tree.ts`.

**Non-Goals:**
- Changing the filter composition (search, status, locale filters stay as-is).
- Persisting selection across sessions.
- Adding tri-state to leaf checkboxes (leaves are inherently binary).
- Touching the row-selection checkboxes in the table body (separate feature).

## Decisions

### Decision 1: Derive display state from effectively-selected key IDs, don't store it
Compute each node's display state (`'checked' | 'unchecked' | 'indeterminate'`) from the set of currently-selected key IDs and the node's `descendantKeyIds`:
- all descendants selected → `checked`
- none selected → `unchecked`
- some selected → `indeterminate`

This makes ancestor/descendant consistency automatic: a folder whose whole subtree is selected is `checked`, and every node beneath it is also `checked`, with no separate propagation bookkeeping.

Add a pure helper to `src/lib/translation-key-tree.ts`:
```ts
export type TreeNodeCheckState = 'checked' | 'unchecked' | 'indeterminate'
export function getKeyTreeNodeCheckStates(
  root: TranslationKeyTreeNode,
  selectedKeyIds: ReadonlySet<string>,
): Map<string, TreeNodeCheckState>
```
It returns a state per node ID in one pass, so `KeyTreeNodeRow` reads `states.get(node.id)` in O(1) instead of recomputing per render.

*Alternative considered:* keep `checkedKeyTreeNodeIds` (node IDs) and compute indeterminate by walking children. Rejected — mixing "clicked node IDs" with derived descendant state is exactly the current source of ambiguity; a checked folder + a separately-checked child would double-count and the "all descendants" test becomes awkward.

### Decision 2: Change selection state to a set of leaf key IDs
Replace `checkedKeyTreeNodeIds: Set<string>` (node IDs) with `selectedKeyIds: Set<string>` (translation key IDs). Toggling a node adds/removes its `descendantKeyIds`:
- node currently `checked` → remove all its `descendantKeyIds`
- node `unchecked` or `indeterminate` → add all its `descendantKeyIds`

The downstream filter then uses `selectedKeyIds` directly (empty set ⇒ show all), replacing the `resolveCheckedTranslationKeyIds` expansion step.

*Alternative considered:* keep node IDs and normalize on every toggle. Rejected — key IDs are the canonical thing the filter needs; expanding once at click time is simpler than expanding on every render.

*Ambiguity note:* the existing "parent path also exists as key" case (e.g. both `auth` and `auth.login.title`) is preserved because the exact `auth` key is its own leaf node with its own key ID, distinct from the `auth` folder node — selecting the folder adds descendant key IDs including `auth`'s, selecting the leaf adds only `auth`'s. This matches the current `descendantKeyIds` semantics.

### Decision 3: Wire `indeterminate` via a ref/effect
The DOM `indeterminate` property is not settable through a React attribute. Set it imperatively: attach a `ref` callback (or small `useEffect`) on the checkbox `<input>` that assigns `el.indeterminate = state === 'indeterminate'`. `checked` is set from `state === 'checked'`.

## Risks / Trade-offs

- **[State migration for `resolveCheckedTranslationKeyIds` callers]** → It is used only inside `TranslationTable.tsx` and its unit test. Replacing it with the leaf-key-ID model is contained; keep or remove the old function based on remaining callers (test will be updated).
- **[Performance on large trees]** → `getKeyTreeNodeCheckStates` is a single post-order pass over the tree using already-materialized `descendantKeyIds`; it is memoized on `[keyTree, selectedKeyIds]`, same cadence as the existing `checkedTreeKeyIds` memo. No regression expected.
- **[Empty selection semantics]** → A folder with zero descendant keys (shouldn't occur, but defensively) is treated as `unchecked` and toggling it is a no-op; documented in the helper.

## Migration Plan

Pure frontend change, no data or API migration. Ships in one PR; rollback is a straight revert.

## Open Questions

None.
