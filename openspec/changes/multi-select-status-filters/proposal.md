## Why

The editor has two status filters — the **Status** list in the left sidebar and the **per-language column filter** — and both accept exactly one status at a time. The questions translators actually ask span more than one: "what still needs work" is *Untranslated + Pending*, and "what is not yet signed off" is *Untranslated + Pending + Reviewed*. Today that takes three passes, one status at a time, with no way to see the combined set or act on it as a whole — which defeats the point of the range selection and bulk actions the table already has.

The single-select shape is also the reason the sidebar's **Untranslated** and **Pending** counts cannot be reconciled with what is on screen: picking one hides the other, so a translator working a mixed queue never sees their real backlog.

## What Changes

- The sidebar **Status** filter accepts **multiple statuses at once**. Selecting Untranslated and Pending shows keys whose overall status is either — the statuses combine with **OR**, because `keyOverallStatus` gives each key exactly one status and AND would always be empty.
- The **per-language column filter** accepts multiple statuses for that language, on the same OR rule, so one column can ask for "Untranslated or Pending in `ja`".
- **All Keys** (sidebar) and **All** (column popover) become an explicit clear — they deselect every status rather than being one more option in the list.
- Each status row is a **toggle**: click to add, click again to remove. This matches the Tags filter, which is already multi-select in the same sidebar.
- The column filter popover **stays open** while statuses are toggled, so picking three is one visit rather than three.
- **Active-filter chips** show the combined selection (`Status: Untranslated, Pending`, `JA: Untranslated, Pending`). Removing the chip clears that filter's whole set.
- Filters continue to combine with **AND across different filters** (search, status, language, key tree, tags, column filters) and OR only *within* one status filter. This distinction is made explicit in the affordance's tooltip, since it is the one thing a user can get wrong.
- No change to how filters relate to each other otherwise: selecting a sidebar status still clears the "needs work by language" selection, since the two answer the same question in different ways.

**Not breaking.** No persisted or shared state carries a status filter — the editor puts only `?q=` in the URL — so a single selection simply becomes a set of one.

## Capabilities

### New Capabilities

None. This changes how an existing filter behaves; it does not introduce a new domain.

### Modified Capabilities

- `editor`: status filtering becomes multi-select. The existing requirement *Base language column exposes status filter* describes selecting "a status option" and must now describe selecting one or more; two new requirements cover the sidebar status filter and the OR-within / AND-across combination rule, which the spec does not state today.

## Impact

- `src/components/editor/TranslationTable.tsx` — `filterStatus` becomes a set; `columnFilters` becomes a map of locale → set. Touches the `filteredKeys` memo, the active-filter chips, `clearAllFilters`, the sidebar Status list, and the column-header filter popover.
- A new pure module under `src/lib/editor/` for "does this key match the selected statuses", so the OR/AND rule is testable without a grid — following `cell-selection.ts`.
- The `useEffect` that clears the cell range selection when filters change already depends on `filterStatus`; it keeps working with a `Set` because `useState` preserves identity between renders, the same way `selectedTreeKeyIds` already does in that dependency list.
- No API, database, or export changes. No migration.
