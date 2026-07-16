## Why

LangHub is moving toward subscription readiness, but authenticated users currently only have quick account actions in the avatar popup. Users need a dedicated place to understand their account identity, password action, workspace access, and current plan before billing/subscription management is added.

## What Changes

- Add an authenticated Account settings surface under the dashboard.
- Show the user's email, account identifier, default workspace, workspace role, workspace list, and current account-level plan.
- Add an Account settings entry to the user popup and continue showing account plan in that popup.
- Provide a clear Change password action from the account surface.
- Keep real billing/subscription management as a disabled/coming-soon affordance; no payment provider integration is included.

## Capabilities

### New Capabilities

### Modified Capabilities
- `authentication`: authenticated users can open an account-management surface from the account menu and view account identity, plan, workspace access, and password actions.

## Impact

- Adds `/dashboard/account` route and dashboard UI for account overview.
- Updates the shared user account menu to include account settings and plan display.
- Reads existing Supabase Auth user/session data and organization member role data.
- No database schema, billing provider, or subscription enforcement changes.
