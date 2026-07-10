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
