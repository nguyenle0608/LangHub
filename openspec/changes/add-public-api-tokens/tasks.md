## 1. Database and Generated Types

- [x] 1.1 Create `014_api_tokens.sql` with token, rate-limit bucket, idempotency, and audit-event tables, constraints, retention indexes, and deny-by-default RLS
- [x] 1.2 Add the atomic rate-limit consumption function and transactional import mutation RPC with locked search paths and restricted execution grants
- [x] 1.3 Apply the migration to the linked Supabase project, regenerate `src/types/database.ts`, and verify remote migration state

## 2. Token Core and Security Gates

- [x] 2.1 Implement server-only token generation, format validation, SHA-256 hashing, and safe prefix helpers
- [x] 2.2 Implement bearer authentication with generic 401 outcomes, revoked/expired checks, and throttled `last_used_at`
- [x] 2.3 Implement scope enforcement, token-to-project/branch/locale authorization gates, and safe v1 error/request-ID helpers
- [x] 2.4 Implement database-backed read/write rate-limit consumption and response headers
- [x] 2.5 Add unit tests for token entropy/format/hash, malformed/unknown/revoked/expired authentication, scope inheritance, throttling, rate limits, and cross-org gates

## 3. Organization Token Management

- [x] 3.1 Add cookie-authenticated owner/admin routes to safely list and create organization tokens with active-token limits and no-store one-time secrets
- [x] 3.2 Add owner/admin token revocation with organization-scoped token IDs and retained audit metadata
- [x] 3.3 Add route tests proving non-admin denial, cross-org denial, secret/hash redaction, expiration validation, and immediate revocation
- [x] 3.4 Add the Org Settings token panel for list, create, one-time copy, expiration/scope selection, and revoke workflows

## 4. Shared Export and Public Read API

- [x] 4.1 Extract a transport-independent export command/service reused by the cookie route and public routes
- [x] 4.2 Add cursor-paginated `GET /api/v1/projects` with bearer auth, rate limiting, deterministic ordering, and organization scoping
- [x] 4.3 Add `GET /api/v1/projects/{id}/translations` with project-scoped branch/locale resolution and deterministic JSON output
- [x] 4.4 Add `GET /api/v1/projects/{id}/export` with allowlisted parameters, complete paginated data, and existing format serializers
- [x] 4.5 Add contract and negative security tests for pagination, invalid cursors, read/write tokens, cross-org projects, mismatched branches/locales, query failures, and partial-export prevention

## 5. Shared Import Service and Public Write API

- [x] 5.1 Extract transport-independent parse, namespace, validation, snapshot, and import command types from the browser route
- [x] 5.2 Implement request-size, key-count, key/value-length, format, branch, locale, and organization validation before privileged writes
- [x] 5.3 Implement idempotency reservation/replay/conflict handling and connect the shared service to the transactional import RPC
- [x] 5.4 Refactor the browser import route to use the shared service while preserving user attribution and existing behavior
- [x] 5.5 Add write-scoped `POST /api/v1/projects/{id}/import` with mandatory `Idempotency-Key`, write rate limit, pre-import snapshot, token audit event, and no partial success
- [x] 5.6 Add tests for missing/reused/conflicting idempotency keys, oversized imports, snapshot failure, transaction rollback, concurrent retries, read-token denial, audit attribution, and cross-resource denial

## 6. Documentation, Release Controls, and Verification

- [x] 6.1 Add `PUBLIC_API_ENABLED` release gating and verify disabled routes reveal no project or token information
- [x] 6.2 Extend `/docs` with token security, v1 contracts, errors, pagination, limits, idempotency, curl examples, and GitHub Actions secret usage
- [x] 6.3 Add cleanup guidance for expired idempotency records and old rate-limit buckets
- [x] 6.4 Run typecheck, lint, unit/route tests, build, OpenSpec verification, and security-focused change review
- [x] 6.5 Create live read and write tokens and curl every v1 route, including two-organization denial, revoked/expired credentials, rate limiting, idempotent replay, and real export/import verification
