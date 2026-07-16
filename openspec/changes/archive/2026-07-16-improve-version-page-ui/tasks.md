## 1. Compare Control Layout

- [x] 1.1 Inspect the current version diff toolbar layout and identify where truncation occurs.
- [x] 1.2 Redesign the compare selector area to flex into available width before truncating.
- [x] 1.3 Add clear labels or visual grouping for base version and compare target.
- [x] 1.4 Verify long version names remain readable on normal desktop widths and degrade gracefully on narrow widths.
- [x] 1.5 Separate compare/restore actions from filtering controls so the top toolbar is easier to scan.
- [x] 1.6 Align restore as a lightweight action beside compare instead of inside a separate container.

## 2. Diff Row Visual Treatment

- [x] 2.1 Replace prominent full-row color backgrounds with subtle state indicators.
- [x] 2.2 Remove or soften per-row borders so the table feels less visually heavy.
- [x] 2.3 Preserve clear added/removed/changed/unchanged semantics using badges, dots, left accents, or value-level styling.
- [x] 2.4 Ensure unchanged rows are visually quieter than changed rows when expanded.
- [x] 2.5 Make active diff filters visually prominent and provide a clear-filters action.
- [x] 2.6 Simplify the filter toolbar by removing the active-filter count while keeping clear affordance.

## 3. Validation

- [x] 3.1 Run TypeScript type checking.
- [x] 3.2 Run automated tests.
- [x] 3.3 Run production build.
