## Context

LangHub stores translation values by branch, key, and project-local locale. A project's base locale identifies the source text; target translations move through `empty`, `pending`, `reviewed`, and `approved`. Writes arrive through editor mutations, bulk operations, imports, branch workflows, and database RPCs. `translation_history` is an audit trail tied to a translation row and cascades on deletion, so it cannot serve as a durable organization memory.

The feature must reuse approved translations across projects in one organization while preserving the recently hardened tenant boundary. It must remain useful without AI infrastructure and must not add a high-latency request on every target keystroke.

## Goals / Non-Goals

**Goals:**
- Make approved translations reusable across projects in the same organization.
- Return deterministic exact and fuzzy suggestions using native PostgreSQL capabilities.
- Give translators terminology guidance and deterministic QA feedback.
- Capture all approved write paths and safely backfill existing approved data.
- Keep suggestions advisory: a human explicitly applies and saves them.
- Enforce organization isolation in tables, functions, routes, and tests.

**Non-Goals:**
- Semantic/vector similarity, machine translation, embeddings, or automatic translation.
- Cross-organization/shared marketplace memories.
- Automatic replacement, automatic approval, or background modification of translations.
- Full glossary import/export or synonym/forbidden-term modeling in the first release.
- Public REST API access to TM or glossary in the first release.

## Decisions

### Organization scope with locale codes

TM and glossary rows belong to an organization. Source and target locales are stored as normalized locale codes rather than locale row IDs because locale IDs are project-local. This enables reuse across projects while every lookup still begins from an authorized project and derives its organization server-side.

### Dedicated durable TM table

`translation_memory_entries` stores source/target text, normalized source, locale pair, provenance, quality, usage, and timestamps. Provenance foreign keys are nullable with `ON DELETE SET NULL`; deleting a key/project does not erase the organization's reusable pair, while deleting the organization cascades the entry. A stable fingerprint deduplicates the same organization, locale pair, normalized source, and target value.

TM is not reconstructed from `translation_history`: history is audit-oriented, may include low-quality intermediate values, does not directly model a source/target pair, and is deleted with its translation.

### Capture only approved pairs at the database boundary

An `AFTER INSERT OR UPDATE` translation trigger records a pair only when a non-base translation is `approved` and both source and target are non-empty. When an approved base-locale value changes, the trigger records pairs for currently approved targets of that key. This catches editor, bulk, import, restore, merge, and future RPC writes consistently. The trigger is idempotent through the fingerprint and does not make approval fail merely because the pair already exists.

Backfill uses the same insertion function over existing approved rows. It may scan all branches; the fingerprint removes identical duplicates while distinct historical approved pairs remain useful.

### Exact-first pg_trgm search

Migration 017 enables `pg_trgm` and adds a GIN trigram index on normalized source text plus a B-tree tenant/locale index. Normalization trims, collapses whitespace, and lowercases for matching while preserving original text for display.

Search always filters `org_id`, source locale, and target locale before ranking. Exact normalized equality is returned first at score `1.0`; fuzzy candidates use `similarity` with a default threshold of `0.55`, deterministic tie-breaking, and a hard result cap of five. Source strings shorter than four characters receive exact matches only to avoid noisy trigram results.

### Server-derived suggestion context

The editor requests assistance using project, branch, key, and target-locale identifiers. A cookie-authenticated server route verifies project access, validates that every child resource belongs to the project, loads the current base-locale value, and then executes the tenant-filtered search. The client cannot supply an arbitrary organization ID or combine resources from different projects.

Suggestions include only target text, score, exact/fuzzy kind, safe provenance labels, and usage metadata. Applying a suggestion updates the local draft only; the existing save and review workflow remains authoritative. Usage count is updated only after an explicit suggestion selection, through an organization-scoped mutation.

### Glossary as one required term per locale pair

`glossary_terms` stores an organization, source/target locale codes, source term, required target term, case/whole-word flags, description, creator, and timestamps. Version one enforces one normalized source term per organization and locale pair to prioritize consistency over synonyms.

Owners/admins manage terms in Workspace Settings through cookie-authenticated routes. Translators/viewers may read matching terms for authorized projects but cannot mutate them. All tables have RLS; privileged routes still perform explicit role and organization checks before using the admin client.

### Shared deterministic glossary matcher

A pure matcher is shared by editor guidance and QA. It treats terms as plain text, never executable regular expressions. Case-insensitive matching uses normalized comparison; whole-word matching uses Unicode-aware segmentation/fallback boundaries. If a source term occurs but the required target term does not, QA emits a warning rather than blocking save.

### Lazy editor integration

Suggestions load only when a user focuses a non-base target cell with non-empty base text, or when the source context changes. Requests are cached by organization/project/branch/key/target locale for the editing session and cancelled when focus moves. No search runs on each target-text keystroke. Exact and fuzzy suggestions plus glossary terms appear in a compact assistance panel; selecting an item fills the draft and keeps the cell dirty.

## Security Model

- Both tables enable RLS immediately in the creating migration.
- Organization members may select rows for their organizations; only owner/admin writes are permitted for glossary terms.
- Direct client writes to TM are denied; only the restricted capture/backfill/usage functions may mutate it.
- Functions use fixed `search_path`, minimum grants, bounded limits/thresholds, and explicit organization predicates.
- Cookie routes use `getUser()`, existing membership helpers, project/branch/key/locale relationship checks, and generic not-found outcomes for cross-tenant identifiers.
- Tests cover foreign organizations, mixed project child IDs, non-admin glossary mutation, deleted membership, and function/RLS bypass attempts.

## Failure Handling and Performance

- Suggestion lookup failure does not block translation editing; the panel shows a retryable unavailable state.
- Capture work is bounded to one key's locales and uses indexes; duplicate insertion is a no-op.
- Backfill is explicit and batched so deployment does not hold a long migration transaction on larger datasets.
- Query plans must demonstrate tenant/locale filtering and trigram index use on representative data.
- Empty values, base-to-base pairs, identical locale pairs, and unsupported/missing locale relationships are ignored.

## Rollout

1. Deploy migration with tables, RLS, functions, indexes, and capture trigger; keep UI unavailable.
2. Run bounded backfill and compare counts/samples against approved translations.
3. Deploy server search and glossary management with negative security tests.
4. Release editor suggestions and glossary QA behind `TRANSLATION_ASSISTANCE_ENABLED`.
5. Run live two-organization isolation, exact/fuzzy ranking, approval capture, and glossary QA smoke tests before enabling production.

## Risks / Trade-offs

- Trigram similarity is lexical, not semantic; unrelated paraphrases will not match. This is intentional for a deterministic first release.
- Organization-wide TM can surface an old but valid product phrasing. Provenance and explicit acceptance keep the translator in control.
- Database triggers add approval-write work. The bounded indexed lookup is more reliable than trying to keep every application write path synchronized.
- Retaining pairs after project/key deletion increases value but requires clear organization deletion semantics; organization deletion remains the hard retention boundary.

## Open Questions

- Whether a later release should let admins deactivate individual TM entries or bulk import/export TMX.
- Whether glossary synonyms, forbidden terms, and project overrides should be added after the single-required-term workflow is validated.
