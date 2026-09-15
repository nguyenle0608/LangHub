## 1. The preferences module

- [x] 1.1 Create `src/lib/editor/column-preferences.ts` with the storage key builder (`langhub-columns:<projectId>`), a `ColumnPreferences` type covering order, hidden, frozen, locked, key width and locale widths, and the default value
- [x] 1.2 Add `parseColumnPreferences(raw: string | null, localeIds: string[]): ColumnPreferences` — drops stored locales the project no longer has, keeps the order of the ones it does, and returns the default for missing, malformed or wrong-shaped data rather than throwing
- [x] 1.3 Add `serializeColumnPreferences(preferences: ColumnPreferences): string`
- [x] 1.4 Add `readColumnPreferences` / `writeColumnPreferences` / `clearColumnPreferences`, each wrapping `localStorage` in try/catch so private browsing and storage-blocking extensions cannot stop the editor opening
- [x] 1.5 Write `src/lib/editor/__tests__/column-preferences.test.ts` covering: round trip; a removed locale dropped while the rest keep their order; an added locale absent from storage; corrupt JSON; valid JSON of the wrong shape; a numeric width where an array belongs; and `localStorage` throwing on read and on write

## 2. Persisting the arrangement

- [x] 2.1 Add an isomorphic layout effect helper (`useLayoutEffect` on the client, `useEffect` on the server) and use it to apply `readColumnPreferences(project.id, project.locales.map(l => l.id))` to `localeOrder`, `hiddenCols`, `frozenCols`, `lockedCols`, `keyColWidth` and `localeColWidths` after mount. A lazy `useState` initialiser cannot be used: the editor is server-rendered, so reading storage during the first render makes the server and client disagree — see the hydration decision in design.md
- [x] 2.1a Guard the effect so it applies once per project, not on every render, and re-reads when `project.id` changes
- [x] 2.2 Write the arrangement whenever order, hidden, frozen or locked changes
- [x] 2.3 Write column widths on a debounce, since a resize drag fires continuously — the other settings change once per click and write immediately
- [x] 2.4 Make "Reset all" clear the stored entry as well as the in-memory state, so reopening the project does not restore what was reset
- [x] 2.5 Confirm switching projects reads that project's own arrangement and never the previous one

## 3. Reordering in the Columns popup

- [x] 3.1 Render the language entries in the Columns popover in current column order, each with a `GripVertical` handle and `draggable`
- [x] 3.2 Wire the existing `handleColDragStart` / `handleColDragOver` / `handleColDrop` to the popover entries rather than writing new handlers — they already hold the first-reorder fallback, and a second implementation of one gesture drifts from the first
- [x] 3.3 Show a drop indicator on the entry being dragged over, matching what the table header already does
- [x] 3.4 Include hidden languages in the list, so a hidden column can be given a position it takes when shown again
- [x] 3.5 Confirm reordering leaves that language's visibility, freezing, locking and width untouched

## 4. Verification

- [x] 4.1 Add tests for the reorder move itself — moving a language earlier, later, to the first position, to the last, and onto itself as a no-op
- [x] 4.2 In the browser: reorder in the header, reload, confirm the order holds; reorder in the popup, confirm the table follows; hide a column, reorder it, show it, confirm its position
- [x] 4.3 In the browser: open two projects with different locales and confirm their arrangements stay separate
- [x] 4.4 Remove a locale from a project that has a saved arrangement naming it, and confirm the editor opens with the remaining order intact
- [x] 4.5 Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `next build`
