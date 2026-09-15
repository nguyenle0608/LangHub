# Application Preferences Specification

## Purpose

Application preferences define user-controlled web application settings that affect the local user experience without changing project translation data.
## Requirements
### Requirement: Theme mode selection
The system SHALL allow users to configure the web application's visual theme mode as one of `system`, `light`, or `dark`.

#### Scenario: User selects light mode
- **WHEN** the user changes the theme mode to `light`
- **THEN** the web application displays using the light theme regardless of the operating system color scheme

#### Scenario: User selects dark mode
- **WHEN** the user changes the theme mode to `dark`
- **THEN** the web application displays using the dark theme regardless of the operating system color scheme

#### Scenario: User selects system mode
- **WHEN** the user changes the theme mode to `system`
- **THEN** the web application displays using the operating system's current color scheme preference

### Requirement: Theme mode persistence
The system SHALL persist the user's selected theme mode for future visits in the same browser.

#### Scenario: Saved mode is restored
- **WHEN** a user revisits the web application after previously selecting a theme mode
- **THEN** the web application applies the saved theme mode without requiring the user to select it again

#### Scenario: No saved mode exists
- **WHEN** a user visits the web application without a saved theme mode
- **THEN** the web application uses `system` as the default theme mode

### Requirement: Effective theme consistency
The system SHALL apply the effective light or dark theme consistently across the web application shell and common user interface feedback.

#### Scenario: The selected mode affects app surfaces
- **WHEN** the user changes the theme mode
- **THEN** page backgrounds, text, cards, dialogs, popovers, sheets, forms, and notifications reflect the effective theme

#### Scenario: System preference changes while in system mode
- **WHEN** the selected theme mode is `system` and the operating system color scheme changes
- **THEN** the web application updates to the new effective light or dark theme

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

