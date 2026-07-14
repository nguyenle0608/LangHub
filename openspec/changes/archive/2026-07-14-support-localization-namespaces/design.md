## Context

LangHub stores translation keys as dot-notation strings and renders them as nested groups in the editor. The current import/export experience assumes a monolithic localization file per locale: importing `en.json` maps the file contents directly into keys for the `en` locale, and exporting JSON produces one locale file such as `en.json`.

Many production applications split localization by feature or module while still using one locale. For example, a project may keep `authen.json`, `home.json`, and `settings.json` for English. LangHub can support this without changing persistence by treating the feature file name as the first dot-notation segment during import and by splitting JSON export on the first key segment during namespaced export.

Current relevant architecture:

```
ImportWizard
  └─ parses files client-side for preview/duplicate detection
  └─ POST /api/import
       └─ parseJSON / parseYAML / parseCSV / parseARB
       └─ create/update translation_keys + translations

ExportSheet
  └─ POST /api/export
       └─ fetchExportData(branch, locales)
       └─ buildExportLookup(keys, translations, filter)
       └─ exportJSON/exportYAML/exportCSV/exportARB
       └─ create ZIP when multiple files are produced
```

## Goals / Non-Goals

**Goals:**

- Support importing multiple JSON files into the same locale by prefixing each imported key with a namespace derived from the file name.
- Preserve existing monolithic JSON import/export as the default behavior.
- Support JSON export in two modes:
  - monolithic: current one-file-per-locale behavior;
  - namespaced: one file per namespace per locale, split by the first key segment.
- Keep the database schema unchanged by representing namespace as a dot-notation key prefix.
- Keep duplicate detection, overwrite/skip choices, and snapshot safety coherent when namespaced imports create or update existing keys.

**Non-Goals:**

- Introduce a new database table or first-class namespace entity.
- Change how the editor displays or edits translation keys beyond naturally showing prefixed dot-notation groups.
- Add namespaced import/export behavior for ARB, CSV, or YAML in this change.
- Add project-wide namespace management, renaming, deletion, or metadata.
- Change translation status workflow or approval behavior.

## Decisions

### Decision 1: Namespace is a key prefix, not a persisted entity

Namespaced import SHALL transform parsed JSON keys before persistence:

```
file: authen.json
content: { "login": { "title": "Sign in" }, "keyA": "valueA" }

parsed keys:        login.title, keyA
namespaced keys:   authen.login.title, authen.keyA
```

Rationale:
- The editor already understands dot-notation grouping.
- Branching, version history, duplicate detection, and export filtering already operate on key strings.
- Avoids schema migration and avoids introducing namespace lifecycle complexity.

Alternative considered: Add `namespace` column to `translation_keys`. This would support richer namespace metadata, but it creates migration, uniqueness, branch-copy, merge, import, and export complexity that is not needed for the requested behavior.

### Decision 2: Namespaced import is explicit and JSON-only

Import should expose an import structure/mode for JSON files:

- `monolithic`: existing behavior; parsed keys are imported as-is.
- `namespaced`: for JSON files, parsed keys are prefixed with a namespace derived from the source file name.

The same mode must apply whether the batch contains many feature files or only one feature file. If a project already has `authen.keyA` from a previous namespaced import, a later single-file import of `authen.json` in namespaced mode must resolve `keyA` to `authen.keyA` and update the existing key rather than creating or updating an unprefixed `keyA`.

Rationale:
- A file named `en.json` is often a locale file, not a namespace file. Making namespacing explicit avoids accidentally importing `en.keyA`.
- JSON is the user-requested format and the most natural format for feature-split nested files.
- Existing ARB/CSV/YAML behavior remains stable.

Alternative considered: Auto-detect namespacing when multiple files target the same locale. This is convenient, but ambiguous: teams might upload multiple monolithic files for different locales or stage several files accidentally.

### Decision 3: Namespace defaults to sanitized base filename but can be shown/overridden

The namespace default should be derived from the file basename without extension, sanitized into a valid dot-notation segment. For example:

```
authen.json       → authen
user-profile.json → user_profile or user-profile-compatible sanitized segment
Auth Screen.json  → auth_screen
```

The import preview should show the resulting prefixed keys so users can catch surprises before import.

Rationale:
- Filename-derived namespace matches the user’s mental model.
- Sanitization prevents invalid or hard-to-handle key paths.
- Preview is the safety net for destructive overwrite/skip choices.

Alternative considered: Require manual namespace entry for every file. This is safer but cumbersome for large feature-based imports.

### Decision 4: Namespaced export splits by first key segment

For JSON export, namespaced mode should group each locale’s keys by the first dot segment:

```
authen.login.title = "Sign in"
authen.logout      = "Sign out"
home.title         = "Home"

namespaced export:
  en/authen.json → { "login": { "title": "Sign in" }, "logout": "Sign out" }
  en/home.json   → { "title": "Home" }
```

Keys without a dot segment need deterministic handling. They should be exported to a reserved root file (for example `_root.json`) rather than being dropped.

Rationale:
- Splitting on the first segment is simple, predictable, and reversible with namespaced import.
- Root-key handling avoids data loss.

Alternative considered: Let users choose an arbitrary namespace depth. That adds UI and filename complexity and can be considered later if teams need two-level file structures.

### Decision 5: Preserve current download shape where possible, but ZIP for multiple namespaced files

Monolithic JSON export keeps the current behavior: one selected locale downloads one JSON file; multiple selected locales download a ZIP.

Namespaced JSON export may produce multiple files even for one locale, so it should return a ZIP when more than one output file is produced. If exactly one file is produced, direct download is acceptable but not required; a ZIP is also acceptable if kept consistent and communicated in the UI.

Rationale:
- Namespaced export naturally produces a file tree.
- ZIP support already exists for multi-file export.

## Risks / Trade-offs

- [Risk] Filename-derived namespaces can collide after sanitization (`auth-screen.json` and `auth_screen.json`) → Mitigation: detect namespace collisions in the import preview and require user correction or deterministic conflict handling before import.
- [Risk] Existing keys that already include a feature-like first segment may be split unexpectedly during namespaced export → Mitigation: namespaced export is explicit; monolithic remains default.
- [Risk] Root keys do not belong to a namespace → Mitigation: export them into a documented reserved root file and import that file without duplicating the reserved segment when appropriate.
- [Risk] Duplicate/overwrite preview may differ from server-side import if transformation logic diverges between client and API → Mitigation: centralize namespace normalization/key prefixing in shared utilities used by both preview and API.
- [Risk] Import overwrite is destructive → Mitigation: keep existing snapshot behavior for imports that overwrite/update translations and ensure namespaced imports participate in the same safety path.

## Migration Plan

No database migration is expected.

Implementation can ship behind explicit UI controls:

1. Add shared namespace/key transformation utilities.
2. Extend import preview and API payload to include JSON import structure/mode and per-file namespace.
3. Extend export UI and API payload to include JSON output structure/mode.
4. Add tests for transformation, duplicate detection, API import, API export, and ZIP file layout.
5. Add a regression case for re-importing one namespaced JSON file after a previous namespaced import.
6. Keep default mode monolithic so existing users and automated flows are unchanged.

Rollback strategy: remove/hide the new UI controls and ignore new request fields. Existing imported namespaced keys remain ordinary dot-notation keys and continue to work in monolithic mode.

## Open Questions

- Should namespace segments allow hyphens, or should they normalize to underscores to match the current add-key validation pattern?
- What exact reserved filename should hold root keys in namespaced export (`_root.json`, `common.json`, or configurable)?
- Should namespaced import support explicit namespace override in the first release, or only show the derived namespace in preview?
