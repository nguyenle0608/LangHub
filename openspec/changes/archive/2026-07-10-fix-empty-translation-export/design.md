## Context

The export route currently loads branch keys in one request, then places every key UUID into a single PostgREST `in(key_id, ...)` filter when loading translations. For projects with hundreds of keys, the encoded GET URL can exceed an upstream limit. Because the route ignores the translation query error, it treats the failed request as an empty result and returns a successful `{}` JSON file. The key query is also subject to PostgREST's default row limit, so projects above that limit can be exported incompletely.

Export is branch-scoped and may include one or several selected locales. The serializers already expect in-memory maps, so data retrieval can be made bounded without changing JSON, YAML, ARB, CSV, or ZIP output contracts.

## Goals / Non-Goals

**Goals:**

- Retrieve every key and relevant translation for the resolved branch regardless of normal PostgREST row limits.
- Avoid request URLs whose size grows with the number of translation keys.
- Treat any failed data page as an export failure and return an actionable non-success response.
- Preserve branch, locale, status-filter, nesting, filename, and multi-locale behavior.
- Cover the regression with automated tests, including large datasets and valid empty locales.

**Non-Goals:**

- Changing export file schemas or adding new formats.
- Exporting null or blank values as populated translations.
- Changing translation statuses, branch semantics, or import behavior.
- Streaming serializers or redesigning exports as background jobs.

## Decisions

### Paginate branch keys and translations independently

Load keys using stable ordered range pages, and load translations using `branch_id` plus selected `locale_id` filtering with range pages. Build a key-ID lookup from the fetched keys and discard any translation whose key is not in that lookup before serialization.

This removes the unbounded `key_id IN (...)` URL while retaining branch and locale scope. It also supports more than 1,000 rows. Querying translations by branch and selected locales is preferred over chunking key UUIDs because URL size then depends only on the typically small locale selection, not project size.

Alternative considered: split `keyIds` into fixed-size `IN` batches. This would address the immediate URL-size issue, but it retains an unnecessary coupling between request count and key count and requires careful batch-size tuning for different proxies.

### Fail the whole export when any page fails

The retrieval layer will return or throw the first Supabase error, and the route will respond with a non-success JSON error rather than invoke a serializer with partial data. A successful query with no non-empty values remains valid and may produce `{}` for JSON.

Alternative considered: export successfully fetched pages and display a warning. Partial translation files are unsafe because they look authoritative and there is no portable way to embed completeness metadata in every supported format.

### Keep retrieval separate from serialization

Introduce focused branch-export data loading helpers, leaving `exportJSON`, `exportYAML`, `exportARB`, `exportCSV`, and ZIP assembly unchanged. Tests can exercise pagination/error behavior independently and verify the route does not serialize failed or partial results.

Alternative considered: add paging directly inside the route. A helper provides a smaller test surface and prevents the route from accumulating query-loop details.

## Risks / Trade-offs

- [Large branches require multiple round trips] → Use a bounded page size and fetch only columns required by export.
- [Rows can change between pages during an export] → Use deterministic ordering and treat the export as a best-effort point-in-time read; transactional snapshots/background export are outside this fix.
- [A branch can contain many translation rows across locales] → Restrict translation pages to selected locale IDs and required columns.
- [A successful empty locale and a failed query both previously produced `{}`] → Preserve `{}` only after all pages complete successfully; propagate every page error.
- [Range pagination can skip/duplicate rows if ordering is unstable] → Order by a unique stable column such as `id` on every page.

## Migration Plan

No database migration or public API migration is required. Deploy the query/helper and route changes together with regression tests. Rollback consists of reverting those code changes; stored translation data is unaffected.

## Open Questions

None required before implementation.
