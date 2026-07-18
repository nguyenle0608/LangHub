## Context

LangHub currently authenticates browser requests with Supabase cookie sessions. Several application services use the Supabase service-role client, so authorization is enforced in server routes by resolving each resource back to an organization and checking the caller's membership. The new public API introduces long-lived bearer credentials that have no browser session and therefore needs a parallel, explicit authorization context.

Export parsing/serialization is mostly reusable, but the current import route combines HTTP parsing, cookie authorization, snapshots, and multiple unchecked service-role writes. Exposing that route through bearer authentication would recreate the class of tenant and partial-write risks fixed by migration 013 and the centralized access gates.

The feature spans PostgreSQL migrations, server-only cryptography, public and cookie-authenticated routes, shared application services, organization settings UI, operational limits, documentation, and deployment verification.

## Goals / Non-Goals

**Goals:**

- Issue high-entropy organization tokens whose plaintext is shown once and never stored.
- Restrict token management to organization owners and admins through server routes.
- Authenticate bearer requests without cookies and enforce organization, project, branch, key, and locale consistency before any service-role query or mutation.
- Provide stable v1 project discovery, translation retrieval, export, and import contracts.
- Make public imports bounded, idempotent, fail-fast, snapshotted, and attributable to the calling token.
- Apply database-backed per-token request limits that work across serverless instances.
- Reuse shared import/export services so browser and public routes cannot drift.

**Non-Goals:**

- OAuth applications, delegated user authorization, per-project tokens, or fine-grained custom scope arrays.
- Browser CORS support for third-party origins; v1 targets CI/CD, scripts, and CLI clients.
- A first-party CLI or SDK in this change.
- Secret recovery or plaintext token display after creation.
- Anonymous or unauthenticated public data access.

## Decisions

### Token representation and storage

Tokens use `lh_` plus 32 cryptographically random bytes encoded as URL-safe text. The database stores a unique SHA-256 hex digest and a non-secret display prefix, never the bearer value. SHA-256 is sufficient because the input has 256 bits of entropy; password hashing would add cost without meaningful protection. The server validates the format and length before hashing.

`api_tokens.scope` is singular with values `read` or `write`; `write` is a superset that also permits reads. Tokens may expire or be non-expiring, but the UI defaults to a finite expiration and clearly warns before creating a non-expiring credential. Revocation is a timestamp and token rows are retained for audit history. Each organization is limited to 20 active tokens.

### Server-only token management

`api_tokens` has RLS enabled with no authenticated/anon policies. Owners and admins manage it through cookie-authenticated routes guarded by `assertOrgAccess(..., 'admin')`. Safe list responses explicitly select metadata and omit `token_hash`. Create responses include plaintext exactly once and use `Cache-Control: no-store`; tokens are never included in URLs or logs.

### Bearer authentication context

`authenticateApiToken(request)` uses the service-role client to look up a hash whose token is not revoked and not expired. Invalid, malformed, revoked, and expired credentials return the same 401 response. Successful authentication produces `{ tokenId, orgId, scope, createdBy }`. `last_used_at` is updated at most once per five minutes to avoid write amplification.

Public routes do not reuse cookie-user access helpers. They call token-aware resource gates that require `projects.org_id = context.orgId` and validate every child resource against the expected project/branch. Cross-organization resources return 404 to avoid confirming their existence.

### Database model for limits, idempotency, and audit

Migration `014_api_tokens.sql` creates:

- `api_tokens` for credential metadata and hashes.
- `api_rate_limit_buckets` plus an atomic database function that consumes per-token read/write quotas.
- `api_idempotency_keys` keyed by token and client key, with request hash, state, stored response, and expiry.
- `api_audit_events` for token-authenticated mutations, project/branch attribution, request ID, outcome, and bounded metadata.

The service role owns all writes. Direct Data API access to these tables is denied by RLS. Old rate-limit buckets and expired idempotency records are safe to prune asynchronously.

### Public API contract

All v1 responses use JSON error objects with a stable code, message, and request ID. `GET /api/v1/projects` is cursor-paginated. Project translation/export routes resolve an optional branch name or ID within the requested project and otherwise use the default branch. Locale codes are resolved only within that project.

The translation endpoint returns a deterministic key-to-value JSON object. Export delegates to the existing paginated export data loader and pure serializers. Query parameters use allowlists for format, filter, locale, and branch.

### Shared import service and transactional write boundary

The browser and public routes share a transport-independent import command containing project, branch, locale, parsed entries, options, and actor. Parsing and validation occur before privileged writes. The service enforces body size, maximum key count, key/value lengths, and project-resource consistency.

Before a destructive import the service creates or reuses the idempotency record and a pre-import snapshot. The actual key/translation/history mutation is performed through one transactional database RPC so a failed chunk cannot produce a success response or leave partially applied translation data. Token imports write an `api_audit_events` row; user imports retain their existing user attribution.

`Idempotency-Key` is mandatory for public imports. Reusing a key with the same request hash returns the stored completed response; reusing it with different content returns 409. An in-progress duplicate returns 409 or the completed result once available.

### Rate limits and request bounds

The initial quotas are 120 read requests and 10 write requests per token per minute. Exceeded requests return 429 with `Retry-After`. Public import accepts at most 5 MiB and 5,000 parsed keys; tighter existing field constraints continue to apply. Limits are enforced before expensive export/import work.

### Release strategy

The migration is backward compatible and may deploy before the application. Public routes remain disabled behind `PUBLIC_API_ENABLED` until the management UI, negative security tests, and live two-organization curl checks pass. Read routes are verified first; the write route is enabled only after idempotency, rate limiting, snapshot, and audit verification.

## Risks / Trade-offs

- **[Bearer token leakage grants organization access]** → Store only hashes, show plaintext once, use no-store responses, redact logs, support expiry/revocation, and document secret handling.
- **[Service-role queries bypass RLS]** → Require token-aware organization/resource gates and negative cross-org tests for every route.
- **[Import retries or failures duplicate/partially apply data]** → Require idempotency keys and use a transactional database mutation boundary after snapshot creation.
- **[Database-backed rate limiting adds a write per request]** → Use atomic minute buckets and throttle unrelated `last_used_at` updates; prune old buckets asynchronously.
- **[Audit and idempotency tables grow]** → Index retention columns and document scheduled cleanup.
- **[Write scope is broad within an organization]** → Keep only owner/admin token issuance, show scope prominently, default to read, and allow immediate revocation.
- **[Migration deploys before application]** → New tables are isolated by RLS and unused until the feature flag is enabled.

## Migration Plan

1. Land and deploy the existing authorization hardening application code.
2. Apply `014_api_tokens.sql`, regenerate database types, and verify RLS/constraints/functions in staging or the linked project.
3. Deploy token management and public API code with `PUBLIC_API_ENABLED=false`.
4. Create tokens through Org Settings and run automated and live two-organization negative tests.
5. Enable read routes, monitor errors/rate limits, then enable write import after idempotency and audit checks.

Rollback disables `PUBLIC_API_ENABLED`, revokes active tokens, and leaves the additive tables in place so audit history remains available. A later migration may remove them after retention requirements are satisfied.

## Open Questions

- Which production scheduler will prune expired idempotency records and old rate-limit buckets?
- Should non-expiring tokens remain available to all owner/admin users or only owners after the initial release?
