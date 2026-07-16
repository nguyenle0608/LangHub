## 1. OAuth Configuration and Flow

- [x] 1.1 Enable and configure the Google provider in Supabase Auth outside the codebase.
- [x] 1.2 Ensure Supabase redirect allow-list includes localhost and production callback URLs.
- [x] 1.3 Start Google OAuth from login using the current origin `/auth/callback` URL.
- [x] 1.4 Start Google OAuth from sign-up using the current origin `/auth/callback` URL.

## 2. Callback and Redirect Handling

- [x] 2.1 Exchange the OAuth authorization code for a Supabase session in the server callback route.
- [x] 2.2 Preserve the intended destination using short-lived same-site state before OAuth redirect.
- [x] 2.3 Sanitize all post-login destinations and fall back to `/projects` for unsafe or missing values.
- [x] 2.4 Clear the stored OAuth destination after callback completion.
- [x] 2.5 Redirect callback failures back to login with a user-facing failure state.

## 3. Client Session Compatibility

- [x] 3.1 Disable browser-side OAuth URL session detection because server callback owns code exchange.
- [x] 3.2 Update browser auth watching to use local session state instead of repeated user endpoint validation.
- [x] 3.3 Verify Google login does not trigger repeated `history.replaceState()` calls or `/auth/v1/user` 403 loops.

## 4. Auth UI

- [x] 4.1 Show the Google social login action on the login page.
- [x] 4.2 Show the Google social login action on the sign-up page.
- [x] 4.3 Place social login below the email/password form on auth pages.
- [x] 4.4 Keep loading and disabled states coordinated between password and Google auth actions.

## 5. Validation

- [x] 5.1 Run TypeScript type checking.
- [x] 5.2 Run the automated test suite.
- [x] 5.3 Run a production build.
- [x] 5.4 Manually test localhost Google login redirects back to localhost rather than production.
