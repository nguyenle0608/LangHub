## Context

LangHub uses Next.js App Router with Supabase Auth for browser and server authentication. Email/password login already exists, and protected routes redirect unauthenticated users to `/login` with a `next` destination. Google OAuth needs to integrate with the same Supabase session and protected-route flow without introducing Firebase or a second identity provider stack.

OAuth redirects are sensitive because Supabase only allows configured redirect URLs and browser-side URL session detection can conflict with a server-side callback exchange. The design keeps Supabase Auth as the source of truth while making the app callback URL stable for both localhost and production.

## Goals / Non-Goals

**Goals:**

- Allow users to sign in or sign up with Google through Supabase Auth.
- Exchange the OAuth code server-side and establish the normal Supabase session cookies.
- Return users to a safe intended destination after login, defaulting to `/projects`.
- Avoid open redirects and avoid Supabase redirect allow-list mismatches caused by dynamic query strings.
- Avoid duplicate browser-side OAuth URL processing that can trigger excessive `history.replaceState()` calls.
- Keep auth UI ordering consistent by placing social login below the email/password form.

**Non-Goals:**

- Replacing Supabase Auth with Firebase or another auth provider.
- Adding password reset, remember-me, or change-password flows in this change.
- Adding new database tables, migrations, or role/organization authorization behavior.
- Persisting Google profile metadata beyond the Supabase Auth user/session.

## Decisions

1. **Use Supabase Google OAuth instead of Firebase Auth.**
   - Rationale: Existing auth, middleware, session, and RLS assumptions already depend on Supabase Auth.
   - Alternative considered: Firebase Auth. Rejected because it would require a second session model and additional synchronization with Supabase-backed data.

2. **Exchange OAuth codes in the server callback route.**
   - Rationale: `/auth/callback` can call `exchangeCodeForSession` and set Supabase cookies in the server response, matching the SSR auth model.
   - Alternative considered: Let the browser client detect and exchange the URL session. Rejected because it conflicts with the server callback flow and can cause repeated URL mutation.

3. **Keep the Supabase `redirectTo` URL clean and stable.**
   - Rationale: `http://localhost:3000/auth/callback` and the production callback can be allow-listed exactly or with a wildcard. Adding dynamic `next` query parameters risks redirect fallback to the Supabase Site URL.
   - Alternative considered: Pass `next` in the callback query string. Rejected after local testing redirected to the production Netlify domain.

4. **Store post-login destination in a short-lived app cookie.**
   - Rationale: A same-site `oauth_next` cookie preserves the intended destination without changing the Supabase callback URL. The callback sanitizes the path and clears the cookie after use.
   - Alternative considered: Store destination in localStorage. Rejected because the server callback route needs to read the value before redirecting.

5. **Disable browser-side session detection in the Supabase browser client.**
   - Rationale: The app handles OAuth code exchange on the server, so browser auto-detection is redundant and can produce `history.replaceState` loops.
   - Alternative considered: Keep defaults. Rejected due to observed console errors during Google login testing.

## Risks / Trade-offs

- **Supabase/Google redirect configuration mismatch** → Mitigation: Use a stable callback URL and document that localhost and production callback URLs must be in Supabase redirect allow-list.
- **Cookie destination tampering** → Mitigation: Only allow relative paths starting with `/` and reject protocol-relative paths (`//`), falling back to `/projects`.
- **Expired or missing `oauth_next` cookie** → Mitigation: Default callback destination is `/projects`.
- **Client-side session state briefly stale after OAuth** → Mitigation: Server callback establishes cookies and protected pages read trusted user state server-side.
