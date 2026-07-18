## 1. Database, RLS, and Generated Types

- [ ] 1.1 Create migration `017_translation_memory_glossary.sql` enabling `pg_trgm` and adding organization-scoped TM/glossary tables, constraints, nullable provenance, fingerprints, tenant/locale indexes, and trigram index
- [ ] 1.2 Enable RLS in the creating migration with member reads, owner/admin glossary writes, and no direct client TM writes
- [ ] 1.3 Add fixed-search-path, restricted capture/search/usage/backfill functions and an approval capture trigger covering target approval and approved base-source changes
- [ ] 1.4 Add a bounded idempotent approved-data backfill path that can run in batches outside the migration transaction
- [ ] 1.5 Deploy migration 017, regenerate `src/types/database.ts`, inspect representative query plans, and verify the remote migration state

## 2. Pure Matching and Translation Memory Service

- [ ] 2.1 Implement shared source normalization and safe locale-code normalization consistent with database behavior
- [ ] 2.2 Implement typed TM search results with exact-first ordering, fuzzy threshold, five-result cap, short-source behavior, and safe provenance mapping
- [ ] 2.3 Implement a pure glossary matcher with literal case/whole-word behavior and glossary QA issue generation
- [ ] 2.4 Add unit tests for whitespace/case normalization, exact/fuzzy ordering, Unicode/short strings, literal metacharacters, whole-word matching, and missing-term warnings

## 3. Authorized Assistance API

- [ ] 3.1 Add a cookie-authenticated assistance route that accepts project/branch/key/target-locale identifiers and derives organization/base source server-side
- [ ] 3.2 Reuse existing authorization helpers to enforce member access plus project-to-branch/key/locale relationships before any admin query
- [ ] 3.3 Return bounded TM suggestions and applicable glossary terms with no-store behavior and safe failure responses
- [ ] 3.4 Add an explicit suggestion-acceptance mutation that tenant-scopes the TM entry and updates usage metadata without saving the translation
- [ ] 3.5 Add route tests for role access, empty base text, foreign org, mixed child identifiers, malformed input, query failure, and usage mutation scoping

## 4. Editor Translation Assistance

- [ ] 4.1 Add a lazy assistance panel to target-cell editing with loading, empty, unavailable, exact/fuzzy confidence, provenance, and glossary sections
- [ ] 4.2 Load on non-base cell focus/source-context change, cancel stale requests, cache by editing context, and avoid per-target-keystroke searches
- [ ] 4.3 Apply a selected TM target to the local draft only and preserve dirty/save/review semantics
- [ ] 4.4 Integrate glossary consistency warnings into existing cell QA without blocking saves
- [ ] 4.5 Add component tests for focus behavior, request cancellation/cache, explicit apply, no auto-save, failure fallback, and glossary warnings

## 5. Glossary Management

- [ ] 5.1 Add owner/admin cookie routes for paginated list/create/update/delete with locale validation, normalized duplicate conflicts, and generic cross-org not-found behavior
- [ ] 5.2 Add route tests for owner/admin success, translator/viewer denial, deleted membership, duplicate terms, metacharacters, and foreign term IDs
- [ ] 5.3 Add Workspace Settings glossary UI with locale-pair filters, create/edit/delete, case-sensitive and whole-word controls, descriptions, and pagination
- [ ] 5.4 Add management UI tests for permissions, validation, conflict feedback, and destructive-action confirmation

## 6. Rollout and Verification

- [ ] 6.1 Add `TRANSLATION_ASSISTANCE_ENABLED` release gating and document safe rollout/backfill/rollback operations
- [ ] 6.2 Run typecheck, lint, focused/full tests, production build, OpenSpec verification, and security-focused change review
- [ ] 6.3 Deploy the application disabled, run batched TM backfill, and validate counts plus sampled approved source/target pairs
- [ ] 6.4 Run live exact, fuzzy, short-source, new-approval capture, suggestion acceptance, glossary CRUD/QA, and two-organization isolation smoke tests
- [ ] 6.5 Enable the feature in production and verify editor latency/error behavior without affecting translation save paths
