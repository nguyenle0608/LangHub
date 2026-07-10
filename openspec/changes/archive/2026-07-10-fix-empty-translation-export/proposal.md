## Why

Exporting a locale from a project with hundreds of translation keys can silently produce an empty JSON object even though populated translations exist. The export flow must remain complete and fail visibly when its data queries cannot be fulfilled, so users do not mistake a backend query failure for valid empty translation data.

## What Changes

- Export all translation keys and matching locale values without relying on one oversized key-ID filter request.
- Support projects beyond Supabase/PostgREST per-request row and URL-size limits through bounded pagination or batching.
- Surface export data-query failures to the client instead of returning a successful empty file.
- Distinguish a genuinely empty locale from an unexpected failure, while preserving the selected status filter and output format behavior.
- Add regression coverage for large projects, query failures, and valid empty translations.

## Capabilities

### New Capabilities

- `translation-export`: Defines reliable, complete export behavior for selected locales and supported file formats, including large projects and explicit failure handling.

### Modified Capabilities

None.

## Impact

- Export API data retrieval and response handling in `src/app/api/export/route.ts`.
- Existing branch-scoped pagination utilities or a shared export-oriented query helper.
- Export regression tests for large key sets and Supabase query errors.
- No breaking API or file-format change is intended.
