## 1. Export Data Retrieval

- [x] 1.1 Add a typed export-data query helper that retrieves branch translation keys in deterministic, bounded pages and returns the complete key set.
- [x] 1.2 Retrieve branch translations for only the selected locales in deterministic, bounded pages without placing all key UUIDs in one PostgREST `IN` filter.
- [x] 1.3 Validate fetched translations against the complete branch key lookup and propagate any key, locale, or translation page error without returning partial data.

## 2. Export Route Integration

- [x] 2.1 Update `src/app/api/export/route.ts` to use the paginated export-data helper while preserving branch resolution, locale selection, status filters, serializers, filenames, and ZIP behavior.
- [x] 2.2 Convert retrieval failures into actionable non-success JSON responses so the client does not download a misleading empty or partial file.
- [x] 2.3 Preserve valid empty outputs when all data queries succeed but no non-empty translation matches the selected locale and filter.

## 3. Regression Coverage

- [x] 3.1 Add Vitest coverage proving a populated locale with 600+ keys exports complete data across multiple translation pages.
- [x] 3.2 Add coverage for more than one key page, status filtering across pages, and multi-locale export behavior.
- [x] 3.3 Add coverage proving a failed page aborts export while a successfully queried empty locale still produces the expected empty format output.

## 4. Verification

- [x] 4.1 Run the targeted export tests and the full Vitest suite.
- [x] 4.2 Run TypeScript type checking and linting, then manually verify a single-locale nested JSON export and a multi-locale ZIP export.
