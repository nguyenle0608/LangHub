## Why

LangHub currently supports email/password authentication, but users who already rely on Google accounts need a faster and lower-friction sign-in option. Adding Google OAuth improves onboarding and aligns the auth flow with common SaaS expectations while keeping Supabase Auth as the single session provider.

## What Changes

- Add Google OAuth sign-in/sign-up using Supabase Auth.
- Add an OAuth callback flow that exchanges the Supabase code server-side and redirects users back to the intended in-app destination.
- Preserve protected-route intent during authentication using a safe, short-lived local cookie rather than query-bearing Supabase redirect URLs.
- Show a friendly login error if the OAuth callback cannot complete.
- Keep browser-side Supabase auth handling compatible with server-side callback exchange to avoid duplicate URL session processing.
- Move social login actions below the email/password form on auth pages.

## Capabilities

### New Capabilities
- `authentication`: Covers user sign-in, sign-up, OAuth login, callback handling, session continuity, and auth-related redirects.

### Modified Capabilities

## Impact

- Affected UI: `/login` and `/signup` auth pages.
- Affected routes: `/auth/callback` server route.
- Affected auth infrastructure: Supabase browser/server clients and session watcher behavior.
- External configuration: Supabase Google provider and redirect allow-list; Google OAuth client settings.
- No database schema changes or new runtime dependencies are required.
