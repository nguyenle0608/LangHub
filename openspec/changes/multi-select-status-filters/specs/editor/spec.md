## ADDED Requirements

### Requirement: Sidebar status filter accepts multiple statuses
The system SHALL let a user filter the editor key list by one or more key statuses at once. A key SHALL be shown when its overall status matches ANY selected status. Selecting no status SHALL mean no status filtering is applied.

#### Scenario: User selects a second status
- **WHEN** a user has selected Untranslated in the sidebar status filter and then selects Pending
- **THEN** both statuses are shown as selected
- **AND** the key list contains every key whose overall status is Untranslated or Pending

#### Scenario: User deselects one of several statuses
- **WHEN** a user has Untranslated and Pending selected and selects Pending again
- **THEN** Pending is no longer selected
- **AND** the key list contains only keys whose overall status is Untranslated

#### Scenario: User clears the status filter
- **WHEN** a user has one or more statuses selected and chooses "All Keys"
- **THEN** no status is selected
- **AND** the key list is not filtered by status

#### Scenario: Deselecting the last status shows every key
- **WHEN** a user deselects the only remaining selected status
- **THEN** the key list is not filtered by status
- **AND** "All Keys" is shown as the active state

#### Scenario: Per-status counts stay independent of the selection
- **WHEN** a user has one or more statuses selected
- **THEN** each status row still shows the total number of keys with that status in the project, not the number remaining after filtering

### Requirement: Filters combine as OR within a status filter and AND across filters
The system SHALL combine multiple statuses selected within a single status filter with OR, and SHALL combine different filters — search, sidebar status, language, key tree, tags, and each language column filter — with AND. The system SHALL make this distinction discoverable from the filter affordance.

#### Scenario: Two statuses in one filter widen the result
- **WHEN** a user selects Untranslated and Pending in the sidebar status filter
- **THEN** the key list contains keys of either status, and is at least as large as selecting either one alone

#### Scenario: A status filter and a tag filter narrow the result
- **WHEN** a user selects Untranslated and Pending in the sidebar status filter and also selects a tag
- **THEN** the key list contains only keys that carry that tag AND whose overall status is Untranslated or Pending

#### Scenario: Conflicting filters can legitimately return nothing
- **WHEN** the combination of active filters matches no key
- **THEN** the key list is empty rather than falling back to a wider result
- **AND** the active filters remain visible so the user can see which combination produced it

#### Scenario: User discovers the combination rule
- **WHEN** a user inspects the language column filter affordance
- **THEN** the affordance explains that statuses within it combine with OR and that it combines with other active filters using AND

### Requirement: Active-filter chips show a multi-status selection
The system SHALL represent each active status filter as a single chip listing every selected status, and removing that chip SHALL clear that filter's entire selection.

#### Scenario: Chip lists every selected status
- **WHEN** a user has Untranslated and Pending selected in the sidebar status filter
- **THEN** one chip is shown naming both statuses

#### Scenario: Removing the chip clears the whole selection
- **WHEN** a user removes a status filter chip that names more than one status
- **THEN** every status in that filter is deselected
- **AND** other active filters are unaffected

#### Scenario: Each language column filter gets its own chip
- **WHEN** two different language columns each have statuses selected
- **THEN** one chip is shown per language column, each naming its own language and its own selected statuses

#### Scenario: Clear all removes every status selection
- **WHEN** a user clears all filters
- **THEN** the sidebar status filter and every language column status filter are emptied

## MODIFIED Requirements

### Requirement: Base language column exposes status filter
The system SHALL show the per-column status filter affordance for base language columns in the editor translation table. The affordance SHALL accept one or more statuses for that column, and a row SHALL be shown when that column's translation matches ANY selected status.

#### Scenario: Base language header is visible
- **WHEN** a user views the editor translation table with a base language column
- **THEN** the base language header shows the same status filter icon used by other language columns

#### Scenario: User filters the base language column
- **WHEN** a user selects one or more status options from the base language column filter
- **THEN** the table filters rows to those whose base language translation matches any of the selected statuses

#### Scenario: User selects several statuses without reopening the filter
- **WHEN** a user selects a status option in a language column filter
- **THEN** the filter stays open so further statuses can be selected or deselected in the same visit

#### Scenario: User clears a language column filter
- **WHEN** a user chooses "All" in a language column filter
- **THEN** no status is selected for that column
- **AND** the table is not filtered by that column's status

#### Scenario: Base column filter is active
- **WHEN** a base language column filter has one or more statuses selected
- **THEN** the filter icon uses the active filter styling and the active-filter chips include that column filter with every selected status named
