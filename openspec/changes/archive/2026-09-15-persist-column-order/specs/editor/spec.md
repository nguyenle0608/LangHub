## ADDED Requirements

### Requirement: Language columns reorder from the Columns popup
The system SHALL allow a user to change the order of language columns by dragging them within the Columns popup, in addition to dragging column headers in the table.

#### Scenario: User drags a language within the popup
- **WHEN** a user drags a language entry to a new position in the Columns popup
- **THEN** the entry moves to that position in the popup list
- **AND** the table's language columns follow the same order

#### Scenario: The popup reflects the current order
- **WHEN** a user opens the Columns popup
- **THEN** language entries are listed in the order their columns currently appear in the table

#### Scenario: Reordering from the header is reflected in the popup
- **WHEN** a user reorders language columns by dragging a column header
- **AND** then opens the Columns popup
- **THEN** the popup lists the languages in the new order

#### Scenario: A hidden language can still be reordered
- **WHEN** a user reorders a language that is currently hidden
- **THEN** the new position is remembered
- **AND** the column appears in that position when it is shown again

#### Scenario: Reordering does not change other column settings
- **WHEN** a user reorders a language in the Columns popup
- **THEN** that language's visibility, freezing, locking and width are unchanged
