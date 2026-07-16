## 1. Public Landing Page

- [x] 1.1 Replace the root redirect with a public Landing page at `/`.
- [x] 1.2 Add Landing page sections for hero, product value, workflow, features, and pricing preview.
- [x] 1.3 Add authentication-aware CTAs that point anonymous users to sign up/login and authenticated users to the dashboard.

## 2. Dashboard Route Namespace

- [x] 2.1 Move projects and setup pages under `/dashboard`.
- [x] 2.2 Move workspace settings under `/dashboard/orgs/{orgId}/settings`.
- [x] 2.3 Move project-scoped dashboard pages under `/dashboard/{projectId}/...`.
- [x] 2.4 Add legacy redirects from old app URLs to their dashboard equivalents.

## 3. Navigation and Auth Redirects

- [x] 3.1 Update dashboard navigation links to use `/dashboard` paths.
- [x] 3.2 Update project and workspace action links to use `/dashboard` paths.
- [x] 3.3 Update middleware public route handling and authenticated auth-page redirects.
- [x] 3.4 Update auth next/default destinations to use `/dashboard/projects`.

## 4. Validation

- [x] 4.1 Run TypeScript type checking.
- [x] 4.2 Run automated tests.
- [x] 4.3 Run production build.
