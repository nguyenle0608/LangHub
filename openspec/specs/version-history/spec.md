# version-history Specification

## Purpose

Define requirements for version history comparison and restore UI behavior.

## Requirements

### Requirement: Version comparison selector uses available space
The system SHALL present the version comparison selector so selected version names and compare targets use available toolbar width before truncating.

#### Scenario: Long comparison names with available space
- **WHEN** a user views a version comparison with long snapshot names and the diff toolbar has horizontal space available
- **THEN** the selector area expands to show more of the names instead of truncating them prematurely

#### Scenario: Narrow comparison layout
- **WHEN** the available toolbar width is limited
- **THEN** the selector remains usable and truncates text only as needed without breaking the controls

### Requirement: Version comparison context is clear
The system SHALL make it clear which version is the base and which target is being compared.

#### Scenario: Comparing snapshot to current state
- **WHEN** a user compares a selected snapshot with the current state
- **THEN** the UI clearly labels or visually distinguishes the selected snapshot from the current-state target

#### Scenario: Comparing snapshot to another snapshot
- **WHEN** a user selects another snapshot as the compare target
- **THEN** the UI clearly communicates the selected snapshot-to-snapshot comparison

### Requirement: Version comparison toolbar actions are visually grouped
The system SHALL organize compare selection, restore action, and filter controls into visually distinct groups.

#### Scenario: Compare and restore controls are shown together
- **WHEN** a user views the version comparison toolbar
- **THEN** the compare selector and restore action are aligned as related top-level actions without placing restore inside a separate card-like container

#### Scenario: Filter controls are shown as a filter group
- **WHEN** diff filtering controls are available
- **THEN** change-type chips, search, and locale filtering are visually grouped together without unnecessary active-count clutter

### Requirement: Active diff filters are discoverable and clearable
The system SHALL make active diff filters obvious and provide a clear way to remove them.

#### Scenario: Change-type filter is active
- **WHEN** a user selects a change-type filter chip
- **THEN** the selected chip uses a prominent selected state that is visually distinct from inactive chips

#### Scenario: One or more filters are active
- **WHEN** a user has an active change type, locale, or search filter
- **THEN** the UI shows a clear-filters action while preserving a lightweight toolbar layout

#### Scenario: User clears active filters
- **WHEN** a user activates the clear-filters action
- **THEN** change-type, locale, and search filters reset to their default unfiltered state

### Requirement: Diff rows use subtle state styling
The system SHALL avoid overly prominent full-row coloring and heavy row borders in the diff table while preserving the meaning of added, removed, changed, and unchanged states.

#### Scenario: Changed row display
- **WHEN** a row represents a changed translation value
- **THEN** the row uses subtle state indicators and value-level styling rather than a loud full-row background

#### Scenario: Added or removed row display
- **WHEN** a row represents an added or removed value
- **THEN** the row remains visually identifiable without relying on heavy borders or high-intensity row fills

#### Scenario: Unchanged row display
- **WHEN** unchanged rows are shown
- **THEN** they appear visually quieter than changed rows
