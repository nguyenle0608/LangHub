## 1. Matching rules as a pure module

- [x] 1.1 Create `src/lib/editor/status-filter.ts` exporting `KeyStatus` (`'empty' | 'pending' | 'reviewed' | 'approved'`) and `STATUS_ORDER`, the natural progression used for stable display order.
- [x] 1.2 Implement `toggleStatus(selected: ReadonlySet<KeyStatus>, status: KeyStatus): Set<KeyStatus>` — returns a new set with the status added or removed. Used by both toggle lists so the add/remove rule exists once.
- [x] 1.3 Implement `matchesKeyStatus(selected, keyStatus)` — true when the set is empty (unfiltered) or contains the key's overall status. Covers spec *Sidebar status filter accepts multiple statuses*.
- [x] 1.4 Implement `matchesColumnStatus(selected, translation)` — same empty-set rule, plus the existing detail that `'empty'` matches a translation with no value, a blank value, or status `'empty'`. Covers spec *Base language column exposes status filter*.
- [x] 1.5 Implement `formatStatusList(selected)` — human labels joined for a chip, sorted by `STATUS_ORDER` so click order cannot change the label. Covers spec *Active-filter chips show a multi-status selection*.
- [x] 1.6 Write `src/lib/editor/__tests__/status-filter.test.ts`: empty set matches everything for both predicates; single status matches exactly as the current behavior does; two statuses match either; `'empty'` matches missing, blank and explicitly-empty translations; `toggleStatus` adds then removes and never mutates its input; `formatStatusList` is order-stable regardless of insertion order.

## 2. Sidebar status filter

- [x] 2.1 Change `filterStatus` state in `TranslationTable.tsx` from `FilterStatus` to `Set<KeyStatus>`, initialised empty. Narrow the `FilterStatus` type or replace its use so `'all'` can no longer be stored.
- [x] 2.2 Update the `filteredKeys` memo to use `matchesKeyStatus(filterStatus, keyOverallStatus(k, locales))`, replacing the `filterStatus !== 'all'` branch.
- [x] 2.3 Make each sidebar status row a toggle: `onClick` calls `setFilterStatus((prev) => toggleStatus(prev, item.id))` and still clears `selectedLocaleId`. **Never construct the set during render** — identity must stay stable or the cell-selection effect fires every render (see design).
- [x] 2.4 Make "All Keys" clear the set (`setFilterStatus(new Set())` inside the handler), and mark it active when `filterStatus.size === 0 && !selectedLocaleId`. Other rows are active when `filterStatus.has(item.id) && !selectedLocaleId`.
- [x] 2.5 Confirm the per-status counts still come from `stats` (whole-project totals), not from `filteredKeys`. Covers spec scenario *Per-status counts stay independent of the selection*.

## 3. Per-language column status filter

- [x] 3.1 Change `columnFilters` from `Map<string, FilterStatus>` to `Map<string, Set<KeyStatus>>`.
- [x] 3.2 Update the `filteredKeys` memo's `columnFilters.forEach` branch to use `matchesColumnStatus`, and to skip a locale whose set is empty.
- [x] 3.3 Make each popover status option a toggle via `toggleStatus`, writing back into a new `Map` inside the setter callback. Delete the locale's entry when its set becomes empty, so an unfiltered column holds no entry.
- [x] 3.4 Make the popover's "All" item clear that locale's entry, and mark it active when the locale has no entry or an empty set.
- [x] 3.5 Keep `isFiltered` (the blue filter icon) true whenever the locale's set is non-empty. Covers spec scenario *Base column filter is active*.
- [x] 3.6 Verify the popover does not dismiss when an option is clicked, so several statuses can be picked in one visit. Covers spec scenario *User selects several statuses without reopening the filter*.
- [x] 3.7 Extend the filter button's `title` to state that statuses within the column combine with OR while filters combine with AND. Covers spec scenario *User discovers the combination rule*.

## 3b. Status column header popover (not in the original plan)

Found during implementation: a **third** affordance drives `filterStatus` — the popover on the Status column header, whose own tooltip says "Same filter as the sidebar Status list". Two filter states, three affordances. `pnpm typecheck` surfaced it.

- [x] 3b.1 Make the Status column header popover's options toggle through `toggleStatus`, and its "All" clear the set, matching the sidebar.
- [x] 3b.2 Mark the header's filter icon active on `filterStatus.size > 0`, and each option on `filterStatus.has(opt.id)`.
- [x] 3b.3 Extend its `title` with the OR rule.
- [x] 3b.4 Point the "BY LANGUAGE" rows at `new Set()` instead of `'all'` when they clear the status filter, keeping the two mutually exclusive.

## 4. Active-filter chips and clear-all

- [x] 4.1 Replace the sidebar status chip with a single chip labelled `Status: ${formatStatusList(filterStatus)}`, shown when `filterStatus.size > 0`, whose remove clears the whole set.
- [x] 4.2 Replace each column chip with `${CODE}: ${formatStatusList(set)}`, one per locale with a non-empty set, whose remove deletes that locale's entry.
- [x] 4.3 Update `clearAllFilters` to reset `filterStatus` to an empty set and `columnFilters` to an empty map. Covers spec scenario *Clear all removes every status selection*.
- [x] 4.4 Drive all three status option lists from `STATUS_ORDER` + `STATUS_LABEL` rather than three hardcoded arrays. This also fixes an existing inconsistency: the column popover said **Empty** while its own chip said **Untranslated**.

## 5. Verification

- [x] 5.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all clean. (`pnpm test` needs `npm run build` in `cli/` first.)
- [x] 5.2 In the running editor: select Untranslated then Pending in the sidebar and confirm the row count is the sum of the two statuses' counts, and that deselecting Pending returns to Untranslated alone.
- [x] 5.3 In the running editor: select two statuses in one language column filter without the popover closing, and confirm both the icon styling and a single combined chip.
- [x] 5.4 Confirm a status filter combined with a tag filter narrows rather than widens, and that a contradictory combination yields an empty list with the chips still visible. Covers spec *Filters combine as OR within a status filter and AND across filters*.
- [x] 5.5 Drag-select a cell range, then toggle a status, and confirm the selection clears once — not that the grid becomes unusable from an identity-unstable set.
- [x] 5.6 Confirm no console errors and no writes to `/api/translations` during filtering.
