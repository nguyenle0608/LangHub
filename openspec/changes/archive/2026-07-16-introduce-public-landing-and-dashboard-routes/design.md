## Context

LangHub currently treats the product app as the whole site: `/` redirects to `/projects`, and dashboard routes live at top-level paths such as `/projects`, `/setup`, `/orgs/:orgId/settings`, and `/:projectId/editor`. This worked while building core features, but subscription readiness needs a public marketing homepage and a clearer distinction between unauthenticated product education and authenticated app management.

The app uses Next.js App Router route groups. The current `(dashboard)` group protects all app routes via layout/session checks, while middleware also redirects unauthenticated users away from any non-public route.

## Goals / Non-Goals

**Goals:**

- Make `/` a public Landing page instead of redirecting into the app.
- Move product management under `/dashboard` so app routes feel like a console/dashboard area.
- Preserve legacy top-level app URLs via redirects during the transition.
- Keep authenticated dashboard route protection intact.
- Add a polished but lightweight Landing page with marketing, feature, workflow, and pricing-preview sections.
- Keep navigation paths consistent after the route move.

**Non-Goals:**

- Implementing Stripe or real subscription enforcement.
- Creating full pricing, docs, blog, legal, or changelog pages.
- Changing database schema, Supabase auth providers, or authorization rules.
- Redesigning existing dashboard screens beyond route/path changes.

## Decisions

1. **Use `/dashboard` as the app namespace.**
   - `/dashboard/projects` becomes the primary authenticated app entry.
   - `/dashboard/:projectId/...` keeps project-scoped URLs compact while making the app namespace explicit.
   - Alternative considered: `/console`; rejected because `dashboard` is more accessible for SaaS users and non-developer stakeholders.

2. **Keep `/` public for both anonymous and authenticated users.**
   - Logged-in users can still view marketing/pricing content and use an “Open dashboard” CTA.
   - Auth pages should redirect authenticated users to `/dashboard/projects`, but `/` should not auto-redirect.

3. **Preserve legacy app URLs with server redirects.**
   - `/projects` → `/dashboard/projects`
   - `/setup` → `/dashboard/setup`
   - `/orgs/:orgId/settings` → `/dashboard/orgs/:orgId/settings`
   - `/:projectId/<known-section>` → `/dashboard/:projectId/<known-section>`
   - This avoids breaking bookmarks and in-flight links while moving internal navigation forward.

4. **Prefer moving route files over duplicating page implementations.**
   - Existing pages should live under the new dashboard paths.
   - Legacy paths should be small redirect pages, not duplicate app UIs.

5. **Keep Landing page dependency-free.**
   - Use existing Tailwind and icon system only.
   - Pricing preview should be static copy suitable for later subscription integration.

## Risks / Trade-offs

- **Route move can miss internal links** → Use text search for known legacy paths and update links in dashboard/auth flows.
- **Middleware can accidentally protect `/`** → Add `/` to public route handling and make auth-page redirects target `/dashboard/projects`.
- **Dynamic `/:projectId` legacy redirects can conflict with public routes** → Only redirect known project sections and leave other top-level paths untouched.
- **Legacy redirects add temporary route files** → Acceptable as migration compatibility; they can be removed in a later cleanup after analytics show low usage.
