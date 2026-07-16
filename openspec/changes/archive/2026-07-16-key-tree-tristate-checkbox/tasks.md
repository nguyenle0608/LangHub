## 1. Tree state-derivation helper

- [x] 1.1 Add `TreeNodeCheckState` type (`'checked' | 'unchecked' | 'indeterminate'`) to `src/lib/translation-key-tree.ts`
- [x] 1.2 Add pure `getKeyTreeNodeCheckStates(root, selectedKeyIds)` that returns a `Map<string, TreeNodeCheckState>` in a single tree pass, deriving each node's state from how many of its `descendantKeyIds` are in `selectedKeyIds` (all → checked, none → unchecked, some → indeterminate; empty-descendant nodes → unchecked)
- [x] 1.3 Add a helper (or reuse `descendantKeyIds`) to enumerate a node's descendant key IDs for toggle operations — reused existing `node.descendantKeyIds`, no new helper needed

## 2. Unit tests

- [x] 2.1 In `src/lib/__tests__/translation-key-tree.test.ts`, cover `getKeyTreeNodeCheckStates`: fully selected folder → checked, partial → indeterminate, none → unchecked, checked-ancestor implies checked descendants
- [x] 2.2 Cover the parent-path-also-a-key ambiguity case (`auth` leaf vs `auth` folder) producing distinct states

## 3. TranslationTable selection state

- [x] 3.1 Replace `checkedKeyTreeNodeIds: Set<string>` (node IDs) with `selectedTreeKeyIds: Set<string>` (translation key IDs) in `src/components/editor/TranslationTable.tsx`
- [x] 3.2 Rewrite `toggleKeyTreeChecked(nodeId)`: if the node's current state is checked → remove its descendant key IDs; else (unchecked/indeterminate) → add its descendant key IDs
- [x] 3.3 Replace the `checkedTreeKeyIds` memo / `resolveCheckedTranslationKeyIds` usage so `filteredKeys` filters directly on `selectedTreeKeyIds` (empty set ⇒ show all); update the selection-count chip and "clear selection" action to use the new state
- [x] 3.4 Add a memo computing `getKeyTreeNodeCheckStates(keyTree, selectedTreeKeyIds)` and thread it into `KeyTreeNodeRow`
- [x] 3.5 Remove `resolveCheckedTranslationKeyIds` if no callers remain (and drop it from the test) — removed, replaced by `getKeyTreeNodeCheckStates`

## 4. Checkbox rendering (tri-state)

- [x] 4.1 In `KeyTreeNodeRow`, read the node's `TreeNodeCheckState` from the map instead of `checkedNodeIds.has(node.id)`
- [x] 4.2 Wire the `<input type="checkbox">` `indeterminate` DOM property via a ref/effect; set `checked` from `state === 'checked'`
- [x] 4.3 Update the row highlight styling to treat both checked and indeterminate as "active" as appropriate, and update the `aria-label`/accessibility to reflect the three states — added `aria-checked="mixed"` for indeterminate

## 5. Verification

- [x] 5.1 `pnpm typecheck` and `pnpm lint` pass
- [x] 5.2 `pnpm test` passes (new helper tests included)
- [x] 5.3 Manually verify in the editor: checking a folder checks all descendants; unchecking one child flips the folder to indeterminate; unchecking all flips it back to unchecked; filtered key list matches selection — verified live in browser: checking `academy.buttons` checked all 8 leaves and made `academy` indeterminate (aria-checked="mixed"); unchecking `buttons` cleared the whole subtree and returned `academy` to unchecked
