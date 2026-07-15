## 1. Theme State Infrastructure

- [x] 1.1 Add a theme mode type with allowed values `system`, `light`, and `dark`, plus helpers for validating persisted values.
- [x] 1.2 Implement a client-side theme provider that defaults to `system`, persists the selected mode locally, resolves the effective theme, and toggles the `dark` class on the root element.
- [x] 1.3 Handle `prefers-color-scheme` changes while the selected mode is `system`.
- [x] 1.4 Add an early initialization strategy to reduce visible theme flash before hydration.

## 2. Theme Configuration UI

- [x] 2.1 Add a user-facing theme mode control with options for `System`, `Light`, and `Dark`.
- [x] 2.2 Place the control in an appropriate persistent web-app surface so users can change the setting after login.
- [x] 2.3 Ensure the control reflects the currently persisted mode on first render.

## 3. App Shell and Surface Styling

- [x] 3.1 Update `src/app/layout.tsx` so the root document no longer hardcodes dark mode and global providers wrap the app.
- [x] 3.2 Make the Sonner toaster follow the effective light or dark theme.
- [x] 3.3 Replace dark-only classes in auth and common shell surfaces with semantic theme tokens or explicit light/dark variants.
- [x] 3.4 Audit dialogs, sheets, popovers, forms, cards, and notifications for obvious contrast issues in both light and dark modes.

## 4. Verification

- [x] 4.1 Add or update tests for theme mode validation, persistence fallback, and effective theme resolution where practical.
- [x] 4.2 Manually verify `system`, `light`, and `dark` modes across auth and dashboard pages.
- [x] 4.3 Run the project's type check, lint, and relevant test suite.
