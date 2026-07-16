## Why

Email/password users need common account recovery conveniences: remembering their login email, requesting a password reset, and setting a new password from an email reset link. These flows reduce login friction and support users who cannot access their account.

## What Changes

- Add a "Remember me" option to email login that stores the email locally for future login attempts.
- Add a "Forgot password" page that sends Supabase password reset emails.
- Add a reset callback route that exchanges Supabase email recovery codes server-side and redirects to password change.
- Add a "Change password" page where a user with a valid reset/session can set a new password.
- Add auth route access rules for the new public reset entry points.

## Capabilities

### New Capabilities
- `authentication`: Covers email/password login, remembered login email, password reset email requests, reset callback handling, and password changes.

### Modified Capabilities

## Impact

- Affected UI: login page, forgot password page, change password page.
- Affected routes: new reset callback route and middleware public-route allow-list.
- Affected auth infrastructure: Supabase browser/server clients for reset email, recovery callback exchange, and password update.
- External configuration: Supabase redirect allow-list should include the app reset callback URL for local and deployed environments.
- No database schema changes or new runtime dependencies are required.
