## Why

Developers need a secure, automation-friendly way to pull and push LangHub translations from CI/CD pipelines, scripts, and future CLI tooling without browser sessions. The new public surface must build on the recently hardened multi-tenant authorization model so bearer tokens cannot become a second path around organization boundaries.

## What Changes

- Add owner/admin-managed organization API tokens with one-time plaintext display, SHA-256 storage, read/write scopes, expiration, revocation, safe metadata listing, and bounded active-token counts.
- Add bearer-token authentication, token-scoped organization/project authorization, generic authentication failures, throttled usage timestamps, audit attribution, and database-backed request limiting.
- Add versioned public endpoints to paginate organization projects, read project translations, and export existing localization formats.
- Add an idempotent, size-bounded public import endpoint backed by a shared import service that checks every database write and records the calling token.
- Refactor cookie-authenticated import/export handlers to share application services with the public API rather than duplicating privileged service-role logic.
- Add organization-settings token management UI and API documentation with curl and GitHub Actions examples.
- Add negative security tests for malformed, expired, revoked, under-scoped, cross-organization, and cross-resource requests.

## Capabilities

### New Capabilities
- `developer-api-access`: Organization API token lifecycle, bearer authentication, scopes, tenant authorization, usage limits, idempotency, audit identity, and the versioned public REST surface.

### Modified Capabilities
- `project-management`: Allow token-scoped, paginated project discovery for an organization.
- `translation-export`: Allow authenticated public API clients to retrieve translations and existing export formats while enforcing token organization, project, branch, and locale boundaries.
- `translation-import`: Allow write-scoped public API clients to perform bounded, idempotent, auditable imports through the same validated import service as the browser workflow.

## Impact

- Database: new migration `014_api_tokens.sql` plus token usage/idempotency/audit support and regenerated Supabase types.
- Server: new `src/lib/api-tokens/`, shared import/export application services, cookie-authenticated token management routes, and `src/app/api/v1/` routes.
- UI/docs: organization settings token panel and expanded public documentation.
- Operations: database migration deployment, application deployment, security smoke tests, and live bearer-token curl verification.
