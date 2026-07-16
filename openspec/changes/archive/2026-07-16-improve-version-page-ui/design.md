## Context

The version history page has a left snapshot list and a right diff panel. The diff panel currently shows the selected snapshot name, an arrow icon, and a native select for the compare target in a compact row. Long names are truncated aggressively because the control area does not flex into available space. Diff rows combine colored row backgrounds with borders, which makes differences feel heavier than necessary and can distract from the actual values.

## Goals / Non-Goals

**Goals:**

- Make the compare target control easier to scan and less prone to unnecessary truncation.
- Preserve clear comparison context: selected snapshot vs current state or another snapshot.
- Organize compare, restore, and filter controls into clearer groups.
- Make active filter state discoverable and easy to clear.
- Reduce visual noise in diff rows while keeping changed/added/removed/unchanged states understandable.
- Keep the layout responsive and usable in the existing split-panel view.

**Non-Goals:**

- Changing version diff semantics or API responses.
- Rebuilding the versions page navigation or snapshot list.
- Adding new filters, sorting, or branch/version data sources.
- Changing restore behavior.

## Decisions

1. **Use a flexible compare control layout instead of a cramped inline label/select.**
   - The selected snapshot and compare target should sit in a flex/grid region that can grow across the toolbar before truncating.
   - Prefer labels like “Base” and “Compare with” or a small comparison card so users understand the two sides.

2. **Keep native select unless the implementation needs a custom popover.**
   - A styled native select is sufficient if it can occupy flexible width and avoid early ellipsis.
   - If native select styling cannot meet readability needs, a lightweight custom trigger can be used without changing behavior.

3. **Move diff state emphasis from entire row to subtle accents.**
   - Use a small badge/dot/left accent and value-level color for changed/added/removed rows.
   - Avoid strong full-row fills and heavy row borders; prefer `divide-y` or soft separators only where needed.

4. **Preserve density and scanability.**
   - Rows should remain compact enough for large diffs, but spacing should be comfortable and not look like error/high-alert cards.

5. **Treat filters as a visible toolbar group.**
   - Change-type chips, search, and locale filter should sit in one grouped area.
   - Active change-type chips should use a stronger selected state than inactive chips.
   - When any filter is active, show a clear-filters action so users can recover without hunting for the selected chip.
   - Avoid extra active-count badges if they add visual weight without improving recovery.

6. **Keep top-level actions lightweight.**
   - Restore should be a button aligned with the compare control, not placed inside its own card-like container.
   - Compare controls should align around a shared baseline so the toolbar feels like one composed control rather than separate boxes.

## Risks / Trade-offs

- **Too subtle state styling could reduce diff recognition** → Mitigation: keep type badges/dots and value-level color differences.
- **Long names can still overflow at very narrow widths** → Mitigation: allow the compare area to flex first, then truncate only at smaller breakpoints.
- **Custom select controls can reduce accessibility** → Mitigation: prefer native select unless a custom control is necessary.
