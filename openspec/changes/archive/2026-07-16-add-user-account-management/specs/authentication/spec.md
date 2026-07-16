## ADDED Requirements

### Requirement: Authenticated users can manage account overview
The system SHALL provide authenticated users with an account overview that shows identity, security, workspace access, and account-level subscription context.

#### Scenario: User opens account settings from account menu
- **WHEN** an authenticated user selects Account settings from the user account menu
- **THEN** the system opens the dashboard account settings page

#### Scenario: Account overview shows account identity and security action
- **WHEN** an authenticated user opens account settings
- **THEN** the system shows their account avatar, email, account identifier, and a Change password action

#### Scenario: Account overview shows workspace access
- **WHEN** an authenticated user belongs to one or more workspaces
- **THEN** the system shows each workspace with its role, member count, project count, and navigation actions

#### Scenario: Account overview shows subscription context
- **WHEN** an authenticated user opens account settings
- **THEN** the system shows the current account-level plan and indicates billing management is coming soon

### Requirement: Account menu shows account type
The system SHALL show the authenticated user's current account-level plan in the shared account menu.

#### Scenario: User opens account menu with account-level plan
- **WHEN** an authenticated user opens the account menu and an account-level plan is available
- **THEN** the system shows the plan as the user's account type

#### Scenario: User opens account menu without account-level plan
- **WHEN** an authenticated user opens the account menu and no account-level plan is available
- **THEN** the system shows Free account as the fallback account type

#### Scenario: Account settings preserves source navigation
- **WHEN** an authenticated user opens account settings from an authenticated dashboard page
- **THEN** the account settings page provides a Back action to the source dashboard page
