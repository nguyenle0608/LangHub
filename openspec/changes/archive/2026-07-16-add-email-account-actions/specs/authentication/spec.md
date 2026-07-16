## ADDED Requirements

### Requirement: Login can remember email address
The system SHALL let users opt into remembering their email address on the current browser without storing their password.

#### Scenario: Remember email after successful login
- **WHEN** a user signs in with email/password while Remember me is selected
- **THEN** the system stores the email address locally for future login forms

#### Scenario: Forget stored email when option is cleared
- **WHEN** a user signs in with email/password while Remember me is not selected
- **THEN** the system removes any previously remembered login email

#### Scenario: Prefill remembered email
- **WHEN** a remembered email exists on the current browser and the user opens the login page
- **THEN** the email field is prefilled and Remember me is selected

### Requirement: User can request a password reset email
The system SHALL provide a forgot-password flow for email/password users to request a Supabase password reset email.

#### Scenario: Request reset email
- **WHEN** a user submits a valid email address on the forgot-password page
- **THEN** the system asks Supabase Auth to send a password reset email with the app reset callback URL

#### Scenario: Reset request accepted
- **WHEN** Supabase accepts the reset email request
- **THEN** the system shows a success message instructing the user to check email

#### Scenario: Reset request fails
- **WHEN** Supabase rejects the reset email request
- **THEN** the system shows the returned error message and keeps the user on the forgot-password page

### Requirement: Password reset callback establishes recovery session
The system SHALL exchange a valid Supabase password recovery callback code server-side and redirect the user to change password.

#### Scenario: Valid reset callback
- **WHEN** a reset email link redirects back with a valid authorization code
- **THEN** the system exchanges the code for a Supabase session and redirects to the change-password page

#### Scenario: Invalid reset callback
- **WHEN** the reset callback is missing a code or the code exchange fails
- **THEN** the system redirects to forgot password with a reset callback failure state

### Requirement: User can change password after reset or authenticated account access
The system SHALL let a user with an active recovery/session or authenticated account session set a new password.

#### Scenario: Change password succeeds
- **WHEN** a user with an active session submits matching valid new passwords
- **THEN** the system updates the Supabase Auth password and shows a success state

#### Scenario: Authenticated user opens change password from account menu
- **WHEN** an authenticated user selects Change password from the account menu
- **THEN** the system opens the change-password page

#### Scenario: Account menu is consistent across authenticated pages
- **WHEN** an authenticated user opens the account menu from projects or editor pages
- **THEN** the system shows a consistent Change password and Sign out menu experience

#### Scenario: Authenticated user leaves change password
- **WHEN** an authenticated user opens change password from the account menu and chooses to go back
- **THEN** the system returns to the projects page without signing the user out

#### Scenario: Passwords do not match
- **WHEN** the user submits different password and confirmation values
- **THEN** the system does not call Supabase and shows a validation error

#### Scenario: Password too short
- **WHEN** the user submits a new password shorter than eight characters
- **THEN** the system does not call Supabase and shows a validation error

#### Scenario: Change password fails
- **WHEN** Supabase rejects the password update
- **THEN** the system shows the returned error message and keeps the user on the change-password page
