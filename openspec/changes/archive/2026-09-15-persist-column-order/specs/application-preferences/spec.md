## ADDED Requirements

### Requirement: Editor column arrangement persistence
The system SHALL persist each project's editor column arrangement — the order of language columns, which columns are hidden, which are frozen, which are locked, and column widths — for future visits in the same browser.

#### Scenario: Saved arrangement is restored
- **WHEN** a user opens a project's editor after previously arranging its columns
- **THEN** the editor applies the saved order, visibility, freezing, locking and widths without requiring the user to arrange them again

#### Scenario: No saved arrangement exists
- **WHEN** a user opens a project's editor with no saved arrangement
- **THEN** the editor shows every language column in the project's own locale order, none hidden, none locked, with the key column frozen and default widths

#### Scenario: Arrangements do not leak between projects
- **WHEN** a user arranges the columns of one project and then opens a different project
- **THEN** the second project's columns are arranged by its own saved arrangement, or by the default when it has none

#### Scenario: Resetting clears what was saved
- **WHEN** a user chooses to reset all column settings
- **THEN** the editor returns to the default arrangement
- **AND** reopening the project does not restore the arrangement that was reset

### Requirement: Stale column arrangement tolerance
The system SHALL ignore parts of a saved column arrangement that no longer apply to a project, and SHALL apply the remainder rather than discarding the arrangement or failing.

#### Scenario: A saved locale has been removed from the project
- **WHEN** a saved arrangement names a locale the project no longer has
- **THEN** that locale is ignored
- **AND** the order of the remaining saved locales is preserved

#### Scenario: A locale has been added since the arrangement was saved
- **WHEN** a project has a locale the saved arrangement does not name
- **THEN** that locale is shown
- **AND** it appears after the locales the arrangement does name

#### Scenario: Stored data cannot be read
- **WHEN** stored arrangement data is missing, unreadable, or not in the expected shape
- **THEN** the editor uses the default arrangement
- **AND** the editor opens normally rather than reporting an error
