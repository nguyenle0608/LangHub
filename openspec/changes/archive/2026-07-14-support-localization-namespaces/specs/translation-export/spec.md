## ADDED Requirements

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
