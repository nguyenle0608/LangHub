## 1. Shared Namespace Utilities

- [x] 1.1 Add shared utilities for deriving and sanitizing namespace names from JSON filenames.
- [x] 1.2 Add shared utilities for prefixing parsed JSON keys with a namespace and detecting transformed-key collisions.
- [x] 1.3 Add shared utilities for splitting flat dot-notation keys into namespace groups for JSON export, including deterministic root-key handling.
- [x] 1.4 Add unit tests for namespace derivation, key prefixing, collision detection, namespace splitting, and root-key grouping.

## 2. Namespaced JSON Import

- [x] 2.1 Extend import data structures to carry JSON import structure mode and per-file namespace metadata.
- [x] 2.2 Update import preview so namespaced JSON files show the final prefixed dot-notation keys.
- [x] 2.3 Update duplicate detection to compare transformed namespaced keys against existing branch keys.
- [x] 2.4 Allow multiple JSON files to target the same locale in one namespaced import batch while preserving duplicate file safeguards.
- [x] 2.5 Update `/api/import` validation and parsing so the server applies the same namespaced key transformation before creating or updating keys/translations.
- [x] 2.6 Ensure namespaced imports that overwrite/update translations use the existing snapshot safety flow.
- [x] 2.7 Add import tests covering re-importing one namespaced JSON file after a previous namespaced import and updating/skipping the existing prefixed keys correctly.
- [x] 2.8 Add import tests covering flat keys, nested keys, duplicate handling, same-locale multiple files, overwrite/skip behavior, and non-JSON compatibility.
- [x] 2.9 Add bulk target locale assignment for all selected import files while preserving per-file overrides.
- [x] 2.10 Treat existing empty target-locale translations as fillable imports rather than overwrite conflicts in preview.
- [x] 2.11 Split import preview per file into separate new, fill-empty, and overwrite candidate key lists.

## 3. Namespaced JSON Export

- [x] 3.1 Extend export data structures and request validation to support JSON output structure mode: monolithic or namespaced.
- [x] 3.2 Update the export UI to expose monolithic vs namespaced JSON export while keeping monolithic as the default.
- [x] 3.3 Implement namespaced JSON grouping after locale/status filtering and before serialization.
- [x] 3.4 Generate namespaced JSON files without repeating the namespace segment inside each file.
- [x] 3.5 Package namespaced export output with a deterministic layout for one or more locales and namespaces.
- [x] 3.6 Preserve existing CSV, YAML, ARB, and monolithic JSON export behavior.
- [x] 3.7 Add export tests covering namespace file splitting, nested JSON reconstruction, root-key output, locale/status filters, ZIP layout, and non-JSON compatibility.
- [x] 3.8 Add include-empty export option so monolithic and namespaced JSON include all keys with empty string values when requested.

## 4. Validation and Regression

- [x] 4.1 Run relevant parser/exporter unit tests and API route tests.
- [x] 4.2 Run type checking and linting for changed TypeScript/TSX files.
- [x] 4.3 Manually verify the import flow with `authen.json` containing `keyA` results in key `authen.keyA`.
- [x] 4.4 Manually verify importing only `authen.json` again updates/skips existing `authen.keyA` rather than creating/updating `keyA`.
- [x] 4.5 Manually verify namespaced JSON export can round-trip back through namespaced import without changing key names.
- [x] 4.6 Confirm existing monolithic import/export flows still produce the previous file shapes and key names.
