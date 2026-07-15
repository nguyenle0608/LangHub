## Context

LangHub already uses Tailwind CSS with class-based dark mode and CSS variables for both `:root` and `.dark`. The root layout currently forces `<html class="dark">`, the Sonner toaster is hardcoded to dark, and some layouts use dark-only utility classes. This makes the app effectively dark-only despite light tokens being present.

This change adds an application-level theme preference that can be `system`, `light`, or `dark`, with `system` resolving from the user's operating system preference. The preference is client-side UI configuration and does not require Supabase persistence for this iteration.

## Goals / Non-Goals

**Goals:**
- Support light and dark visual themes across the web app.
- Provide a user-facing way to choose `system`, `light`, or `dark`.
- Persist the selected mode locally across browser sessions.
- Keep Tailwind's existing class-based dark mode and shadcn-compatible CSS token model.
- Ensure auth pages, dashboard pages, dialogs, sheets, popovers, and toasts respect the effective theme.

**Non-Goals:**
- Storing theme preferences in the database or syncing them across devices.
- Adding project-specific or organization-specific theme settings.
- Redesigning color palettes beyond making existing light/dark tokens usable.
- Supporting custom colors, high-contrast mode, or more than the three requested modes.

## Decisions

1. **Use a client-side theme provider with a persisted mode.**
   - Decision: Add a root client provider that reads/writes a local preference such as `langhub-theme-mode` with allowed values `system`, `light`, and `dark`.
   - Rationale: Theme preference is device/browser-specific and does not need a backend round trip.
   - Alternative considered: Persisting on the user profile in Supabase. This would enable cross-device sync but requires schema and settings-model work outside this request.

2. **Keep Tailwind `darkMode: ['class']` and toggle the `dark` class on `<html>`.**
   - Decision: Resolve the effective theme in the provider and apply/remove the `dark` class on `document.documentElement`.
   - Rationale: The project is already configured for class-based dark mode and shadcn-style CSS variables.
   - Alternative considered: Switching to media-query dark mode. This would make explicit light/dark overrides harder and conflict with the requested three-state config.

3. **Default new users to `system`.**
   - Decision: When no saved preference exists, use `system` and resolve with `prefers-color-scheme`.
   - Rationale: This respects user/device expectations while still allowing explicit override.
   - Alternative considered: Keep dark as the default. That preserves the current look but does not meet the user's request to allow system-based configuration.

4. **Move theme-aware UI to semantic tokens where practical.**
   - Decision: Replace dark-only layout utilities such as `bg-zinc-950` and `text-zinc-100` with token-based or light/dark paired classes.
   - Rationale: Existing global tokens are intended to support both modes and reduce future theme regressions.
   - Alternative considered: Add only `dark:` variants next to every hardcoded class. This is quick but increases maintenance overhead and misses semantic token benefits.

5. **Make Sonner follow the effective theme.**
   - Decision: Render the toaster with the current effective theme instead of a hardcoded dark theme.
   - Rationale: Toasts are visible UI and must match the selected mode.
   - Alternative considered: Leave toasts dark-only. This would create inconsistent light-mode UI.

## Risks / Trade-offs

- [Risk] Theme flash during initial load before client hydration → Mitigation: initialize the root class as early as practical, and use a small inline script or provider initialization pattern if needed.
- [Risk] Existing hardcoded dark utility classes create unreadable areas in light mode → Mitigation: audit auth/dashboard/common UI surfaces and convert obvious dark-only classes to semantic tokens or paired variants.
- [Risk] Local storage is unavailable or blocked → Mitigation: gracefully fall back to `system` in memory without breaking page render.
- [Risk] System preference changes while the app is open may not update → Mitigation: when mode is `system`, subscribe to `prefers-color-scheme` changes and update the effective theme.
