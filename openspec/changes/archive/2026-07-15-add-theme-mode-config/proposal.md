## Why

LangHub currently forces the web app into dark mode, even though the design tokens already define light and dark palettes. Users should be able to choose a readable theme that matches their preference or operating system setting.

## What Changes

- Add light theme support across the web UI by removing hardcoded dark-only root configuration.
- Add a web theme mode configuration with three options: `system`, `light`, and `dark`.
- Persist the selected theme mode locally so the app keeps the user's choice across sessions.
- Apply the effective theme before/at initial render to avoid visible theme flashes where practical.
- Ensure notifications and core layouts follow the selected effective theme.

## Capabilities

### New Capabilities
- `application-preferences`: Covers user-controlled application-level preferences such as visual theme mode.

### Modified Capabilities
- None.

## Impact

- Affected UI shell: `src/app/layout.tsx`, global theme tokens in `src/app/globals.css`, and auth/dashboard layout styling that currently assumes dark mode.
- New client-side theme provider/control components may be added under `src/components` or `src/lib`.
- No database schema, Supabase API, import/export format, or authentication behavior changes are expected.
