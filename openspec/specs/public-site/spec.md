# public-site Specification

## Purpose

Define requirements for LangHub public marketing pages and conversion-oriented homepage behavior.

## Requirements

### Requirement: Public homepage explains LangHub
The system SHALL provide a public homepage at the root URL that explains LangHub before a user signs in.

#### Scenario: Anonymous visitor opens root URL
- **WHEN** an anonymous visitor opens `/`
- **THEN** the system shows a public Landing page instead of redirecting to the app dashboard

#### Scenario: Landing page shows core product value
- **WHEN** a visitor views the Landing page
- **THEN** the page presents LangHub's localization workflow, core features including live collaboration presence, and subscription-oriented pricing preview

#### Scenario: Landing page shows authentication calls to action
- **WHEN** a visitor views the Landing page
- **THEN** the page provides clear sign-in and get-started calls to action

#### Scenario: Landing page supports theme selection
- **WHEN** a visitor views the Landing page
- **THEN** the page provides theme controls and displays the app logo correctly in light and dark themes

#### Scenario: Authenticated user opens root URL
- **WHEN** an authenticated user opens `/`
- **THEN** the system allows the user to view the Landing page and offers a clear path to open the dashboard plus an account menu for authenticated actions

#### Scenario: Dashboard user clicks app logo from projects
- **WHEN** an authenticated user clicks the LangHub logo from the projects dashboard header
- **THEN** the system navigates to the public Landing page
