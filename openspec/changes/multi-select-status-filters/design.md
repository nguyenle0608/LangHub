## Context

Both status filters live in `src/components/editor/TranslationTable.tsx`:

- `filterStatus: FilterStatus` — a single value, where `'all'` is a sentinel meaning "no filtering". The sidebar renders five rows and the active one is `filterStatus === item.id && !selectedLocaleId`.
- `columnFilters: Map<localeId, FilterStatus>` — one status per language column, where a column with no entry is unfiltered and `'all'` is used in the popover to delete the entry.

Both feed the `filteredKeys` memo, which applies every filter in sequence with AND. Two details of the current code matter for this change:

- **The sidebar and the column filter ask different questions.** The sidebar matches `keyOverallStatus(key, locales)`, a derived single status per key that scores only the non-base locales. A column filter matches that one locale's own `translation.status`, with `'empty'` additionally covering a missing or blank value. They must stay separate predicates.
- **The `'all'` sentinel exists only because the state is scalar.** With a set, "no statuses selected" already means "not filtered", so the sentinel stops carrying its weight and would become a value that must never end up *inside* the set.

Adjacent precedent in the same sidebar: `filterTags: Set<string>` is already a multi-select toggle list. It combines with AND (a key must carry every selected tag), which is correct for tags and wrong for statuses — a key has exactly one overall status, so AND across two statuses is always empty.

## Goals / Non-Goals

**Goals:**

- Both status filters accept a set of statuses, matching with OR inside the filter.
- The OR-within / AND-across rule is expressed once, in tested pure functions, rather than re-derived at each call site.
- The existing single-status behavior is preserved exactly when the set holds one status.
- No regression in the cell-range selection, which is cleared when filters change.

**Non-Goals:**

- Persisting filters in the URL or across reloads. Only `?q=` is in the URL today; adding more is a separate change.
- Changing what `keyOverallStatus` means, or how a column's `'empty'` is defined.
- Making the sidebar status filter and the "needs work by language" filter co-exist. They answer the same question two ways and stay mutually exclusive, as today.
- Multi-select for the tag filter's combination rule (it stays AND) or for the key tree.

## Decisions

### Represent both filters as sets, and drop the `'all'` sentinel from the stored value

`filterStatus: Set<KeyStatus>` and `columnFilters: Map<localeId, Set<KeyStatus>>`, where `KeyStatus = 'empty' | 'pending' | 'reviewed' | 'approved'` — the existing `FilterStatus` minus `'all'`. An empty set, or an absent map entry, means unfiltered.

*Why:* it makes the illegal state unrepresentable. With `'all'` kept as a member, `{'all', 'pending'}` is constructible and meaningless, and every predicate would have to special-case it. `'all'` survives only as a UI affordance — the "All Keys" row and the "All" popover item are buttons that clear the set, not options that live in it.

*Alternative considered:* keep `FilterStatus` and add a separate `filterStatuses` set alongside it. Rejected — two sources of truth for one filter, and every read has to decide which wins.

*Alternative considered:* a bitmask. Rejected — four statuses do not justify it, and it reads worse in the devtools than a set of strings.

### Put the matching rules in a pure module, not inline in the memo

A new `src/lib/editor/status-filter.ts`, following `cell-selection.ts` from the Key-column change:

- `toggleStatus(set, status)` — the add/remove used by both toggle lists.
- `matchesKeyStatus(selected, keyStatus)` — `selected.size === 0 || selected.has(keyStatus)`.
- `matchesColumnStatus(selected, translation)` — the same rule plus the `'empty'`-covers-blank-or-missing detail that the column filter has today.
- `formatStatusList(selected)` — the chip label, so the sidebar chip and every column chip read the same way and in a stable order.

*Why:* the empty-set-means-everything rule is the one thing that is easy to get backwards, and it is currently about to appear in four places (two predicates, two chip builders). It needs no React to verify.

*Why a stable order:* a `Set` preserves insertion order, so `Untranslated, Pending` and `Pending, Untranslated` would render differently for the same filter depending on click order. The formatter sorts by the natural status progression (empty → pending → reviewed → approved), which is also the order the sidebar lists them.

### Keep one chip per filter, not one chip per status

`Status: Untranslated, Pending` as a single chip whose removal clears the set, rather than two chips each removing one status.

*Why:* the chip row already carries search, language, key tree, tags and one chip per filtered column. A four-status selection across three columns would add twelve chips and push everything else off the row. Individual statuses are removed where they were selected — the sidebar row or the popover item — which is one click away and shows the counts.

*Trade-off accepted:* removing a single status from a multi-status filter is no longer possible from the chip. This is the smaller cost.

### The column popover stays open while toggling

The popover items are already plain buttons inside `PopoverContent`, so they do not dismiss on click; no change is needed beyond not adding one. Picking three statuses becomes one visit instead of three.

### `useState` identity keeps the selection-clearing effect correct

`useEffect(() => setSelRange(null), [search, filterStatus, selectedLocaleId, selectedTreeKeyIds, groupBy])` clears the Excel-style cell selection when the visible rows change, because the coordinates would be stale. A `Set` is compared by identity, and `useState` hands back the same object until it is replaced — `selectedTreeKeyIds`, already a `Set`, sits in that same dependency list and works.

The rule this imposes on the implementation: **never build a new set during render**. Every update goes through the `setFilterStatus(prev => ...)` form. A `new Set(...)` computed in the render body would change identity every render and clear the user's cell selection continuously.

`columnFilters` is not in that dependency list today, which is a pre-existing gap — changing a column filter can leave a stale selection. Out of scope here; noted so it is not mistaken for something this change introduced.

## Risks / Trade-offs

- **A set rebuilt during render silently breaks the cell selection** → Every mutation uses the functional-update form; the design states it, and the implementation keeps set construction inside the setter callbacks and inside `toggleStatus`.
- **OR vs AND is invisible, and a user who expects AND reads an empty result as a bug** → The spec requires the affordance to explain it; the column filter's `title` already warns that filters combine with AND, and gains the within-filter OR rule.
- **The sidebar's active-state logic (`filterStatus === item.id && !selectedLocaleId`) is load-bearing for mutual exclusion with the language filter** → It becomes `filterStatus.has(item.id) && !selectedLocaleId`, and "All Keys" becomes `filterStatus.size === 0 && !selectedLocaleId`. Selecting a status still clears `selectedLocaleId`, unchanged.
- **Counts could be misread as "how many after filtering"** → They stay whole-project counts, as today. The spec pins this so a later change does not quietly redefine them.
- **A wider result set is slower to render** → The table is already virtualized and streams up to the full project (1190 keys in the largest local project); selecting every status is equivalent to no filter, which is the default view. No new cost.

## Migration Plan

None required. No persisted state, no URL parameter, no database or API involvement. The change is confined to client component state; a deploy replaces the old behavior and a rollback restores it with nothing to undo.

## Open Questions

- Should the sidebar Status header show a count of selected statuses, the way the Tags header shows `N on`? Consistent, but the status rows are always visible so the selection is never hidden — unlike tags, which scroll. Deferred to implementation; not spec-bearing either way.
