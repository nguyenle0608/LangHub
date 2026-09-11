# Translation Export Specification

## Purpose

Define reliable, complete translation export behavior across branches, locales, status filters, supported file formats, and large projects.

## Requirements

### Requirement: Complete branch-scoped export
The system SHALL export all non-empty translations that match the resolved branch, selected locales, and selected status filter, even when the matching key or translation counts exceed a single data-service response page.

#### Scenario: Export project with hundreds of populated keys
- **WHEN** a user exports a selected locale from a branch containing hundreds of populated translation keys
- **THEN** the generated file contains every matching non-empty translation rather than an empty or truncated result

#### Scenario: Export project beyond one response page
- **WHEN** the matching keys or translations span multiple data-service pages
- **THEN** the system retrieves all pages and includes every matching translation in the generated output

#### Scenario: Apply selected status filter
- **WHEN** a user exports with a status filter such as approved-only or reviewed-and-approved
- **THEN** the generated output includes all and only non-empty translations matching that filter across every retrieved page

### Requirement: Explicit export failure
The system MUST return a failed export response when any required key, locale, or translation query fails, and MUST NOT return a successful partial or empty translation file for that failed request.

#### Scenario: Translation page query fails
- **WHEN** any translation data page cannot be retrieved
- **THEN** the export request fails with an actionable error and no translation file is downloaded

#### Scenario: Key page query fails
- **WHEN** any translation-key data page cannot be retrieved
- **THEN** the export request fails instead of serializing the pages retrieved before the failure

### Requirement: Valid empty locale export
The system SHALL distinguish successful retrieval with no matching non-empty translations from a data retrieval failure.

#### Scenario: Selected locale has no populated translations
- **WHEN** every required query succeeds but the selected locale has no non-empty translation matching the selected filter
- **THEN** the system produces a valid empty output for the selected format

### Requirement: Preserve export contracts
The system SHALL preserve existing output format, nesting, filename, locale-selection, and single-file or ZIP behavior while improving data retrieval reliability.

#### Scenario: Export one JSON locale
- **WHEN** a user exports one locale as JSON with nested output enabled
- **THEN** the system downloads the locale-named JSON file with dot-notation keys reconstructed as nested objects

#### Scenario: Export multiple locales
- **WHEN** a user exports multiple locales in a per-locale format
- **THEN** the system downloads a ZIP containing one correctly named file per selected locale

### Requirement: JSON export structure selection
The system SHALL allow users exporting JSON translations to choose between monolithic output and namespaced output.

#### Scenario: Default monolithic JSON export
- **WHEN** a user exports JSON without selecting namespaced output
- **THEN** the system preserves the existing one-file-per-locale JSON export behavior

#### Scenario: Select namespaced JSON export
- **WHEN** a user selects namespaced JSON output
- **THEN** the system groups exported translation keys by namespace and serializes each namespace as a separate JSON file

### Requirement: Namespaced JSON export grouping
The system SHALL split namespaced JSON export files by the first dot-notation key segment.

#### Scenario: Export namespaced feature files
- **WHEN** a locale has populated keys `authen.keyA` and `home.title`
- **THEN** namespaced JSON export produces an `authen.json` file containing `keyA` and a `home.json` file containing `title`

#### Scenario: Preserve nested key structure inside namespace files
- **WHEN** a locale has populated key `authen.login.title`
- **THEN** namespaced JSON export writes `login.title` as nested JSON inside `authen.json` rather than repeating the `authen` segment inside the file

#### Scenario: Handle root keys without namespace
- **WHEN** a locale has a populated key with no dot-notation namespace segment
- **THEN** namespaced JSON export includes that key in a deterministic reserved root JSON file rather than dropping it

### Requirement: Namespaced export respects locale and status filters
The system SHALL apply selected locales and status filters before generating namespaced JSON files.

#### Scenario: Export approved-only namespaced files
- **WHEN** a user exports JSON in namespaced mode with the approved-only filter
- **THEN** the generated namespace files include all and only non-empty approved translations for the selected locales

#### Scenario: Export selected locale only
- **WHEN** a user selects one locale for namespaced JSON export
- **THEN** the generated output includes files only for that selected locale

### Requirement: Include empty values in JSON export
The system SHALL allow users to include every translation key in JSON export output with an empty string value for missing or empty translations.

#### Scenario: Monolithic JSON includes empty values
- **WHEN** a user exports JSON in monolithic mode with include-empty enabled
- **THEN** the generated locale JSON contains every translation key and uses an empty string for keys without a populated value

#### Scenario: Namespaced JSON includes empty values
- **WHEN** a user exports JSON in namespaced mode with include-empty enabled
- **THEN** each namespace file contains the keys for that namespace and uses an empty string for keys without a populated value

#### Scenario: Empty namespace folder is still generated for selected locale
- **WHEN** a selected locale has no populated translations but include-empty is enabled
- **THEN** namespaced JSON export still creates the locale's namespace files with empty string values for the available keys

### Requirement: Namespaced export download package
The system SHALL package namespaced JSON export output so every generated namespace file can be downloaded by the user.

#### Scenario: One locale with multiple namespaces
- **WHEN** a selected locale contains populated keys across multiple namespaces
- **THEN** the export download contains one JSON file per namespace for that locale

#### Scenario: Multiple locales with multiple namespaces
- **WHEN** multiple locales are selected for namespaced JSON export
- **THEN** the export download contains a deterministic file layout that separates locales and namespaces without filename collisions

### Requirement: Preserve non-JSON export behavior
The system SHALL preserve existing export behavior for CSV, YAML, and ARB formats.

#### Scenario: Export non-JSON formats
- **WHEN** a user exports CSV, YAML, or ARB
- **THEN** the system uses the existing format behavior and does not apply namespaced JSON file splitting

### Requirement: API clients can retrieve project translations
The system SHALL allow read-capable tokens to retrieve a deterministic JSON key-to-value mapping for a locale and branch that belong to a project in the token's organization.

#### Scenario: Retrieve default-branch locale translations
- **WHEN** a token requests a valid project and locale without specifying a branch
- **THEN** the system resolves the project's default branch and returns only translations for that project, branch, and locale

#### Scenario: Locale belongs to another project
- **WHEN** a client supplies a locale that does not belong to the requested project
- **THEN** the system rejects the request before loading translations

### Requirement: API clients can export supported localization formats
The system SHALL expose existing supported export formats through a read-capable v1 endpoint using the same paginated data loader and serializers as the browser export workflow.

#### Scenario: Export a supported format
- **WHEN** a token requests a supported format, valid filter, valid project locales, and valid project branch
- **THEN** the system returns the complete export with the appropriate content type and filename

#### Scenario: Export query exceeds resource boundary
- **WHEN** any requested locale or branch belongs outside the requested project or token organization
- **THEN** the system returns a safe not-found or validation response and does not invoke the exporter

#### Scenario: Export data query fails
- **WHEN** any paginated key or translation query fails
- **THEN** the system returns an error response and MUST NOT return a partial export file
