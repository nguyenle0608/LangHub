## Overview

Add a lightweight authenticated account-management surface that centralizes user identity, password action, workspace access, and account-level subscription context. This prepares LangHub for subscription work without introducing billing provider integration or enforcing plan limits.

## Approach

- Add `/dashboard/account` as a protected dashboard route.
- Reuse existing Supabase Auth session data for account identity.
- Reuse organization membership data for workspace role, workspace list, member/project counts, and plan display.
- Update the shared account menu to show plan information and link to Account settings.
- Keep subscription management as a disabled "coming soon" affordance until billing is implemented.

## Data Model

No schema changes.

Existing sources:
- Supabase Auth user: `id`, `email`, `created_at`.
- `getOrganizations(user.id)`: organization name, plan, role, project count, member count.
- `getOrganizationPlan(orgId)`: direct plan lookup for project-scoped/editor contexts.

## UI Behavior

- Account menu displays the account plan badge and workspace role badge when available.
- Account menu includes Account settings, Change password, and Sign out actions. Account settings preserves the current dashboard path as a safe return target.
- Account settings page shows:
  - account profile information
  - security action for password changes
  - workspaces with role and usage counts
  - subscription overview with the current plan and billing marked as coming soon

## Non-Goals

- No Stripe/payment provider integration.
- No plan enforcement or feature limits.
- No editable user profile fields beyond linking to the existing change-password flow.
