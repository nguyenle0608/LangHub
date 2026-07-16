## Why

LangHub is moving from an app-only experience toward a polished SaaS product with subscription readiness. The root URL currently redirects directly into the app, so there is no public homepage to explain the product, convert visitors, or frame pricing before sign-up.

## What Changes

- Replace the root redirect with a public Landing page at `/`.
- Move authenticated product management under a `/dashboard` namespace.
- Preserve old app URLs through redirects so existing links continue to work.
- Update navigation, auth redirects, middleware route protection, and app links to use the dashboard namespace.
- Add initial landing page sections for hero, product value, feature overview, workflow, and subscription/pricing preview.
- Keep subscription integration out of scope for this change; expose only marketing/pricing preview content.

## Capabilities

### New Capabilities
- `public-site`: Public marketing pages and conversion-oriented homepage behavior.
- `project-management`: Dashboard entry points for workspaces, projects, setup, and project-scoped management routes.

### Modified Capabilities
- `authentication`: Public/protected route behavior and post-auth redirects must account for the public homepage and dashboard namespace.

## Impact

- Affected routing: `/`, `/dashboard/*`, legacy redirects from `/projects`, `/setup`, `/orgs/*`, and project-scoped routes.
- Affected UI: new public landing page, dashboard navigation links, workspace/project settings links, auth CTAs.
- Affected middleware: public route allowlist and logged-in public auth redirects.
- No database, Supabase schema, subscription provider, or billing API changes are expected in this phase.
