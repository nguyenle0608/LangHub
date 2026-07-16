## Context

LangHub uses Next.js App Router and Supabase Auth for email/password authentication. The current login page signs users in with email/password and redirects to projects. Signup already creates Supabase Auth users. The missing email-account actions are browser-local email remembrance and Supabase's reset-password email flow.

Supabase password recovery links return an authorization code that must be exchanged for a session before the user can update their password. To avoid dynamic redirect URL matching issues, this design uses a dedicated clean callback URL for reset links.

## Goals / Non-Goals

**Goals:**

- Let users opt into remembering their login email on the current browser.
- Let users request a password reset email from a dedicated page.
- Exchange password recovery callbacks server-side and route users to password change.
- Let users set a new password after opening a valid reset link.
- Keep reset links and callback routes compatible with localhost and production allow-lists.

**Non-Goals:**

- Implementing admin-driven password changes.
- Changing Supabase password policy or adding custom password strength rules beyond existing minimum length validation.
- Adding database tables, audit logs, or email templates.
- Changing Google OAuth behavior in this branch.

## Decisions

1. **Remember only the email address, not the session.**
   - Rationale: Supabase already controls session persistence. Storing the email gives the expected convenience without weakening auth controls.
   - Alternative considered: Short-lived/non-persistent Supabase sessions when unchecked. Rejected because Supabase SSR cookie persistence is centralized and not easily toggled per sign-in without broad auth-client changes.

2. **Use Supabase `resetPasswordForEmail` for forgot password.**
   - Rationale: Keeps reset token generation, email delivery, and security with Supabase Auth.
   - Alternative considered: Custom reset tokens. Rejected because it would add schema and security complexity.

3. **Use a dedicated clean reset callback route.**
   - Rationale: `/auth/reset-password` can be allow-listed directly and exchange the recovery code before redirecting to `/change-password`.
   - Alternative considered: Add query parameters to `/auth/callback`. Rejected to avoid redirect allow-list mismatch risk.

4. **Update password from a client page after recovery session exists.**
   - Rationale: Supabase Auth requires an authenticated/recovery session for `updateUser({ password })`; the reset callback establishes that session.

## Risks / Trade-offs

- **Reset callback URL not allow-listed** → Mitigation: Document that Supabase redirect allow-list must include localhost and production `/auth/reset-password` URLs.
- **Remembered email stored on shared device** → Mitigation: Store only the email and let users uncheck Remember me to remove it.
- **User opens change-password without recovery/session** → Mitigation: Middleware redirects unauthenticated users to login; the page also checks for an active user before update.
