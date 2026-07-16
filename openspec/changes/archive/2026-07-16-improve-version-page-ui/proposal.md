## Why

The version comparison view currently makes the compare target selector feel cramped: branch/version names can be ellipsized even when the toolbar still has available space. Diff table rows also use prominent row coloring and borders that compete with the actual changed values, making the page feel visually noisy.

## What Changes

- Improve the compare selector area so the selected baseline and compare target can use available width before truncating.
- Replace the compact native select presentation with a clearer comparison control that communicates “from → to” while remaining responsive.
- Group compare, restore, and diff filters so the toolbar actions feel intentional instead of visually crowded.
- Make active filters obvious and provide a clear affordance to remove them.
- Soften diff table row styling by reducing full-row color intensity and avoiding heavy row borders.
- Keep semantic diff cues through subtle badges, left accents, dots, or value-level styling rather than loud row backgrounds.
- Preserve existing compare/filter/search/restore behavior; this is a UI/UX refinement only.

## Capabilities

### New Capabilities

### Modified Capabilities
- `version-history`: Improve usability and visual clarity of the version comparison UI.

## Impact

- Affected UI: version history comparison panel and diff table rows.
- Affected code: `src/components/versions/VersionDiffView.tsx` and possibly related version UI helpers/styles.
- No API, database, or permission changes are expected.
