## Why

LangHub currently treats each locale as a single monolithic localization file, which does not fit projects that split translations by feature/module (for example `authen.json`, `home.json`, and `settings.json` for the same `en` locale). Supporting namespaced import/export lets teams keep feature-based file organization while preserving LangHub's existing nested dot-notation key model.

## What Changes

- Add a namespaced import mode for JSON imports where each uploaded JSON file for a locale can be imported under a namespace derived from the file name.
- Allow multiple JSON files to target the same locale in one import flow, producing normal translation keys prefixed with the file namespace (for example `authen.json` with `keyA` becomes `authen.keyA`).
- Support re-importing a single JSON namespace file later so existing namespaced keys are updated correctly using the same filename-derived namespace mapping.
- Preserve the existing monolithic import behavior as the default/backward-compatible path.
- Add an export mode selector so users can export JSON as either:
  - monolithic files: one locale file containing all keys, as today; or
  - namespaced files: per-locale feature files split by the first key segment.
- Keep the persisted translation key model unchanged: keys remain dot-notation strings in the existing `translation_keys` table; namespacing is an import/export transformation, not a new database hierarchy.

## Capabilities

### New Capabilities

- `translation-import`: Formalizes import behavior and adds namespaced JSON import for multiple files per locale.

### Modified Capabilities

- `translation-export`: Adds selectable monolithic vs namespaced JSON export behavior.

## Impact

- Import UI/API: `/Users/nguyenle/Workspace/LangHub/src/components/import/ImportWizard.tsx`, `/Users/nguyenle/Workspace/LangHub/src/app/api/import/route.ts`
- Export UI/API: `/Users/nguyenle/Workspace/LangHub/src/components/export/ExportSheet.tsx`, `/Users/nguyenle/Workspace/LangHub/src/app/api/export/route.ts`
- Parser/exporter utilities: `/Users/nguyenle/Workspace/LangHub/src/lib/parsers/json.ts`, `/Users/nguyenle/Workspace/LangHub/src/lib/exporters/json.ts`, `/Users/nguyenle/Workspace/LangHub/src/lib/exporters/zip.ts`, `/Users/nguyenle/Workspace/LangHub/src/lib/exporters/data.ts`
- Tests: parser/exporter/API tests around JSON import/export and duplicate handling.
- No database migration expected; namespace is represented by key prefixes.
