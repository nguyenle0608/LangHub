## MODIFIED Requirements

### Requirement: Checkbox filtering from key tree
The system SHALL allow users to filter visible translation keys by checking items in the nested key tree, and SHALL represent folder selection using a three-state checkbox (checked, unchecked, indeterminate).

#### Scenario: No checked items shows all keys
- **WHEN** no folder or key item is checked in the nested key tree
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

#### Scenario: Folder is checked when all descendants are selected
- **WHEN** every descendant key of a folder is part of the current selection
- **THEN** the system SHALL render that folder's checkbox in the checked state

#### Scenario: Folder is indeterminate when some descendants are selected
- **WHEN** at least one but not all descendant keys of a folder are part of the current selection
- **THEN** the system SHALL render that folder's checkbox in the indeterminate state

#### Scenario: Folder is unchecked when no descendants are selected
- **WHEN** none of a folder's descendant keys are part of the current selection
- **THEN** the system SHALL render that folder's checkbox in the unchecked state

#### Scenario: Descendants of a checked ancestor render as checked
- **WHEN** a folder is in the checked state
- **THEN** the system SHALL render every descendant folder and leaf under it in the checked state

#### Scenario: Toggling a checked or indeterminate folder deselects its subtree
- **WHEN** a user clicks the checkbox of a folder that is currently checked or indeterminate
- **THEN** the system SHALL remove every descendant key of that folder from the selection

#### Scenario: Toggling an unchecked folder selects its subtree
- **WHEN** a user clicks the checkbox of a folder that is currently unchecked
- **THEN** the system SHALL add every descendant key of that folder to the selection
