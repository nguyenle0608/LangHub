## ADDED Requirements

### Requirement: Product management lives under dashboard namespace
The system SHALL expose authenticated workspace and project management routes under the `/dashboard` namespace.

#### Scenario: User opens dashboard projects
- **WHEN** an authenticated user opens `/dashboard/projects`
- **THEN** the system shows the projects dashboard for the selected or default workspace

#### Scenario: User opens dashboard setup
- **WHEN** an authenticated user with no workspace opens `/dashboard/setup`
- **THEN** the system shows the workspace setup experience

#### Scenario: User opens dashboard workspace settings
- **WHEN** an authorized workspace admin opens `/dashboard/orgs/{orgId}/settings`
- **THEN** the system shows workspace settings for that workspace

#### Scenario: User opens dashboard project route
- **WHEN** an authenticated user opens `/dashboard/{projectId}/editor` or another known project management section
- **THEN** the system shows the corresponding project management screen

#### Scenario: Editor user returns to projects
- **WHEN** an authenticated user clicks the back-to-projects action from the editor header
- **THEN** the system navigates to `/dashboard/projects`

### Requirement: Legacy app routes redirect to dashboard routes
The system SHALL preserve legacy app URLs by redirecting them to equivalent dashboard URLs.

#### Scenario: Legacy projects URL
- **WHEN** a user opens `/projects`
- **THEN** the system redirects to `/dashboard/projects`

#### Scenario: Legacy setup URL
- **WHEN** a user opens `/setup`
- **THEN** the system redirects to `/dashboard/setup`

#### Scenario: Legacy workspace settings URL
- **WHEN** a user opens `/orgs/{orgId}/settings`
- **THEN** the system redirects to `/dashboard/orgs/{orgId}/settings`

#### Scenario: Legacy project section URL
- **WHEN** a user opens a legacy known project section URL such as `/{projectId}/editor`
- **THEN** the system redirects to `/dashboard/{projectId}/editor`
