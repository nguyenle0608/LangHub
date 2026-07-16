## ADDED Requirements

### Requirement: Authentication respects public homepage and dashboard namespace
The system SHALL treat the public homepage as unauthenticated marketing content while protecting dashboard routes.

#### Scenario: Anonymous user opens dashboard route
- **WHEN** an anonymous user opens a `/dashboard` route
- **THEN** the system redirects the user to login with the attempted dashboard path preserved as the next destination

#### Scenario: Authenticated user opens login page
- **WHEN** an authenticated user opens a public authentication page such as `/login` or `/signup`
- **THEN** the system redirects the user to `/dashboard/projects`

#### Scenario: Anonymous user opens root page
- **WHEN** an anonymous user opens `/`
- **THEN** the system does not require authentication

#### Scenario: Post-auth app entry targets dashboard
- **WHEN** authentication flow needs to send a user to the app home
- **THEN** the system uses `/dashboard/projects` as the default app destination
