## ADDED Requirements

### Requirement: Nested key tree view
The system SHALL provide a tree view of translation keys derived from their nested key paths.

#### Scenario: Root folder is displayed
- **WHEN** a user opens the nested key tree view for a project
- **THEN** the system SHALL display `{}` as the root folder containing all translation keys

#### Scenario: Parent segments are displayed as folders
- **WHEN** translation keys include dot-separated paths such as `auth.login.title`
- **THEN** the system SHALL display `auth` and `login` as folder-like parent nodes before the `title` key item

#### Scenario: Flat keys remain visible
- **WHEN** translation keys do not contain nested path separators
- **THEN** the system SHALL display those keys as leaf items directly under the `{}` root folder

### Requirement: Checkbox filtering from key tree
The system SHALL allow users to filter visible translation keys by checking items in the nested key tree.

#### Scenario: No checked items shows all keys
- **WHEN** no root, folder, or key item is checked in the nested key tree
- **THEN** the system SHALL show all translation keys that match the other active filters

#### Scenario: Checking a folder filters descendants
- **WHEN** a user checks a folder item in the nested key tree
- **THEN** the system SHALL show translation keys under that folder and its descendants, composed with the other active filters

#### Scenario: Checking a leaf filters exact key
- **WHEN** a user checks a leaf key item in the nested key tree
- **THEN** the system SHALL show that exact translation key, composed with the other active filters

#### Scenario: Multiple checked items are additive
- **WHEN** a user checks multiple tree items
- **THEN** the system SHALL show the union of translation keys matched by each checked item, composed with the other active filters

### Requirement: Parent key and key path ambiguity handling
The system SHALL preserve distinct filtering behavior when a parent path is also a complete translation key.

#### Scenario: Parent path also exists as key
- **WHEN** translation keys include both `auth` and `auth.login.title`
- **THEN** the system SHALL allow filtering the exact `auth` key separately from filtering descendants under the `auth` folder
