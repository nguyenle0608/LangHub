## ADDED Requirements

### Requirement: Base language column exposes status filter
The system SHALL show the per-column status filter affordance for base language columns in the editor translation table.

#### Scenario: Base language header is visible
- **WHEN** a user views the editor translation table with a base language column
- **THEN** the base language header shows the same status filter icon used by other language columns

#### Scenario: User filters the base language column
- **WHEN** a user selects a status option from the base language column filter
- **THEN** the table filters rows by that base language column status

#### Scenario: Base column filter is active
- **WHEN** a base language column filter is active
- **THEN** the filter icon uses the active filter styling and the active-filter chips include that column filter
