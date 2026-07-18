## Why

Translators repeatedly encounter source text that LangHub has already translated, but the editor currently makes them search manually or translate it again. Organizations also lack a shared terminology source, so product terms can drift between translators and projects. Translation Memory (TM) and an organization Glossary turn approved work into durable, reusable data, improve consistency, and create compounding product value without requiring a vector database or AI service.

## What Changes

- Add organization-scoped Translation Memory entries for approved source/target pairs, including provenance, usage metadata, exact lookup, and fuzzy ranking backed by PostgreSQL `pg_trgm`.
- Capture TM entries from every approved translation path at the database boundary and backfill existing approved translations without coupling TM retention to translation-history rows.
- Add an authorized suggestion service that resolves the active key's base-locale source text and target locale, returns exact results before fuzzy results, and never crosses organization boundaries.
- Add editor suggestions on target-cell focus with confidence, provenance, and explicit click-to-apply behavior; suggestions never auto-save or bypass review.
- Add organization-level glossary terms per source/target locale pair with owner/admin management and read access for organization members.
- Show relevant glossary terms beside translation suggestions and add deterministic QA warnings when required target terminology is missing.
- Add RLS, locked-down functions, role checks, bounded queries, normalization rules, and negative multi-tenant tests for both capabilities.

## Capabilities

### New Capabilities
- `translation-memory`: Capture, backfill, search, rank, retain, and reuse approved organization translation pairs.
- `terminology-management`: Manage organization glossary terms and validate target translations against applicable terminology.

### Modified Capabilities
- `editor`: Present TM and glossary context while editing target-locale cells and apply a selected suggestion without saving automatically.

## Impact

- Database: new migration `017_translation_memory_glossary.sql`, `pg_trgm`, TM/glossary tables, membership RLS, indexes, capture/search functions, and generated Supabase types.
- Server: new translation-assistance query/service and owner/admin glossary management routes with project-to-organization authorization.
- UI: editor suggestion panel and Workspace Settings glossary management panel.
- QA: reusable glossary matcher and missing-required-term warning integrated with existing cell QA.
- Operations: migration deployment, bounded approved-data backfill, tenant-isolation tests, query-plan verification, and live exact/fuzzy/glossary smoke tests.
