## 1. Auth Specification

- [x] 1.1 Create OpenSpec proposal for email account actions.
- [x] 1.2 Create design for remember-email, forgot-password, reset callback, and change-password flows.
- [x] 1.3 Create authentication delta spec covering the new behavior.

## 2. Login Remember Me

- [x] 2.1 Add Remember me checkbox to the email login form.
- [x] 2.2 Prefill remembered email from browser storage on login page load.
- [x] 2.3 Store or clear remembered email after successful email/password login.

## 3. Forgot Password

- [x] 3.1 Add forgot-password page with email input and success/error states.
- [x] 3.2 Link login page to forgot-password page.
- [x] 3.3 Send reset emails with Supabase `resetPasswordForEmail` and clean reset callback URL.

## 4. Change Password

- [x] 4.1 Add reset callback route that exchanges recovery code and redirects to change-password.
- [x] 4.2 Add change-password page with password confirmation validation.
- [x] 4.3 Update Supabase Auth password from change-password page and show success state.
- [x] 4.4 Update middleware public routes for forgot-password and reset callback.
- [x] 4.5 Add Change password entry to authenticated account menu.
- [x] 4.6 Reuse shared user account menu across projects and editor pages.

## 5. Validation

- [x] 5.1 Run TypeScript type checking.
- [x] 5.2 Run automated tests.
- [x] 5.3 Run production build.
