## Context

The editor table renders language columns with flag/code, progress percent, and a per-column status filter icon. The base language column is visually marked with a `base` badge, but the filter icon was only rendered for non-base locales.

## Decision

Render the same per-column status filter popover for every visible locale, including the base locale. This keeps the UI consistent and reuses existing `columnFilters` behavior, active-filter chips, and clear-all logic.

## Non-Goals

- Adding text/value filtering for base values.
- Changing translation status semantics.
- Redesigning the full editor toolbar or table header.
