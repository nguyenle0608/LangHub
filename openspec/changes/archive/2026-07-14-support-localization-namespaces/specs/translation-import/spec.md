## ADDED Requirements

### Requirement: JSON import structure selection
The system SHALL allow users importing JSON translation files to choose between monolithic import and namespaced import behavior.

#### Scenario: Default monolithic JSON import
- **WHEN** a user imports `en.json` as JSON without selecting namespaced import
- **THEN** the system imports parsed JSON keys exactly as the current monolithic dot-notation keys for the selected locale

#### Scenario: Select namespaced JSON import
- **WHEN** a user selects namespaced import for JSON files
- **THEN** the system previews and imports each parsed JSON key with a namespace prefix derived from that file

### Requirement: Multiple JSON files per locale
The system SHALL allow multiple JSON files to target the same locale in a single namespaced import.

#### Scenario: Import feature files for one locale
- **WHEN** a user imports `authen.json` and `home.json` for the same locale in namespaced mode
- **THEN** the system accepts both files and treats their imported keys as separate namespaced key groups for that locale

#### Scenario: Prevent same-file duplicates
- **WHEN** a user adds the same source file more than once for the same import batch
- **THEN** the system avoids importing duplicate file entries unless the user intentionally resolves them before import

### Requirement: Bulk target locale assignment
The system SHALL allow users to assign one target locale to all selected import files in a single action.

#### Scenario: Set all selected files to one locale
- **WHEN** a user has selected multiple import files and chooses a target locale for all files
- **THEN** the system updates every selected file entry to use that target locale while preserving each file's format and namespace settings

#### Scenario: Continue per-file locale overrides
- **WHEN** a user applies a target locale to all files and then changes the locale for one file
- **THEN** the system uses the per-file locale selection for that file during preview and import

### Requirement: Namespace prefix from JSON file name
The system SHALL derive a default namespace from each JSON file name and prepend that namespace to each key imported from that file.

#### Scenario: Prefix flat JSON key
- **WHEN** `authen.json` contains `"keyA": "valueA"` and is imported in namespaced mode
- **THEN** the resulting translation key is `authen.keyA` for the selected locale

#### Scenario: Prefix nested JSON key
- **WHEN** `authen.json` contains `{ "login": { "title": "Sign in" } }` and is imported in namespaced mode
- **THEN** the resulting translation key is `authen.login.title` for the selected locale

#### Scenario: Show transformed keys before import
- **WHEN** the import preview is displayed for a namespaced JSON file
- **THEN** the preview shows the final namespaced dot-notation keys that will be created or updated

### Requirement: Namespaced duplicate handling
The system SHALL evaluate duplicate keys after applying the namespace prefix.

#### Scenario: Existing namespaced key duplicate
- **WHEN** `authen.json` contains `keyA` and `authen.keyA` already exists in the target branch
- **THEN** the import preview identifies `authen.keyA` as a duplicate and applies the selected overwrite or skip behavior to that key

#### Scenario: Existing empty target translation does not require overwrite
- **WHEN** an imported key already exists in the target branch but the selected target locale has no populated value for that key
- **THEN** the import preview treats the import as filling an empty translation rather than requiring overwrite confirmation

#### Scenario: Preview separates import action groups
- **WHEN** the import preview contains new keys, empty target translations to fill, and existing populated translations
- **THEN** the system displays separate per-file lists for new keys, fill-empty keys, and overwrite candidates

#### Scenario: Re-import single namespaced file updates existing key
- **WHEN** `authen.keyA` already exists from a previous namespaced import and the user later imports only `authen.json` containing `keyA` in namespaced mode
- **THEN** the system maps `keyA` to `authen.keyA` and updates or skips the existing namespaced key according to the selected conflict behavior

#### Scenario: Single namespaced file does not update monolithic key
- **WHEN** `authen.keyA` already exists and the user imports only `authen.json` containing `keyA` in namespaced mode
- **THEN** the system MUST NOT treat the incoming key as unprefixed `keyA`

#### Scenario: Different namespaces do not conflict
- **WHEN** `authen.json` and `home.json` both contain `title`
- **THEN** the system treats `authen.title` and `home.title` as different translation keys

### Requirement: Snapshot safety for namespaced import updates
The system MUST preserve the existing import snapshot safety behavior when a namespaced import updates or overwrites existing translations.

#### Scenario: Namespaced import overwrites existing translations
- **WHEN** a namespaced import updates one or more existing translation values
- **THEN** the system creates or participates in the same version snapshot safety flow used by existing import overwrite behavior

### Requirement: Non-JSON import compatibility
The system SHALL preserve existing import behavior for non-JSON formats.

#### Scenario: Import YAML, CSV, or ARB
- **WHEN** a user imports YAML, CSV, or ARB files
- **THEN** the system imports them using the existing format behavior without applying JSON filename namespaces
