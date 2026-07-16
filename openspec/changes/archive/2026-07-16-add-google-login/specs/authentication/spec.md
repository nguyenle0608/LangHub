## ADDED Requirements

### Requirement: Email and password login preserves intended destination
The system SHALL redirect a user who signs in with email and password to the originally requested safe in-app path when one is provided, otherwise to the projects page.

#### Scenario: Password login with protected route destination
- **WHEN** an unauthenticated user is redirected to login from a protected in-app path and then signs in with valid email/password credentials
- **THEN** the system redirects the user to that protected in-app path

#### Scenario: Password login without destination
- **WHEN** a user opens the login page directly and signs in with valid email/password credentials
- **THEN** the system redirects the user to the projects page

#### Scenario: Unsafe destination is ignored
- **WHEN** the login destination is missing, absolute, or protocol-relative
- **THEN** the system redirects the user to the projects page

### Requirement: Google OAuth login starts from auth pages
The system SHALL allow users to start Google OAuth authentication from the login and sign-up pages while keeping email/password auth available.

#### Scenario: User starts Google login
- **WHEN** a user clicks the Google social login action on the login page
- **THEN** the system starts Supabase Google OAuth using the current origin callback URL

#### Scenario: User starts Google sign-up
- **WHEN** a user clicks the Google social login action on the sign-up page
- **THEN** the system starts Supabase Google OAuth using the current origin callback URL

#### Scenario: Social login appears after password form
- **WHEN** a user views the login or sign-up page
- **THEN** the email/password form appears before the Google social login action

### Requirement: Google OAuth callback establishes a Supabase session
The system SHALL exchange a successful Google OAuth callback code for a Supabase session on the server and redirect the user to a safe in-app destination.

#### Scenario: Successful Google OAuth callback
- **WHEN** Google OAuth redirects back with a valid authorization code
- **THEN** the system exchanges the code for a Supabase session and redirects the user to the intended safe in-app destination

#### Scenario: Successful callback without stored destination
- **WHEN** Google OAuth redirects back with a valid authorization code and no valid stored destination exists
- **THEN** the system redirects the user to the projects page

#### Scenario: Failed Google OAuth callback
- **WHEN** the callback code is missing or cannot be exchanged for a Supabase session
- **THEN** the system redirects the user to the login page with an authentication callback failure state

### Requirement: OAuth redirect state is local and short-lived
The system SHALL preserve the intended post-OAuth destination without adding dynamic query parameters to the Supabase OAuth callback URL.

#### Scenario: Login stores destination before OAuth
- **WHEN** a user starts Google OAuth from the login page
- **THEN** the system stores the safe intended destination in short-lived same-site state before redirecting to Google

#### Scenario: Callback consumes stored destination
- **WHEN** the OAuth callback completes
- **THEN** the system reads the stored destination, redirects to a safe path, and clears the stored destination state

### Requirement: Browser auth client does not process OAuth URL sessions
The browser-side Supabase client SHALL NOT automatically detect OAuth sessions from the URL when the server callback route owns OAuth code exchange.

#### Scenario: Browser client initializes after OAuth callback
- **WHEN** the browser Supabase client initializes after a Google OAuth callback flow
- **THEN** it does not attempt a second URL-session exchange or repeatedly mutate browser history

### Requirement: Auth watcher avoids unnecessary user validation calls
The client-side auth watcher SHALL use local session state for account-change detection instead of repeatedly validating the user with the Supabase user endpoint.

#### Scenario: Auth watcher checks active account
- **WHEN** the app checks for account changes in the browser
- **THEN** it reads the current session user id and only notifies when it differs from the known user id
