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
