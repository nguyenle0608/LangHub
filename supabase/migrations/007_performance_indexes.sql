-- ============================================================
-- 007: Performance indexes for dashboard/editor hot paths
-- ============================================================
-- These indexes match the server-side filters used on first paint and
-- dashboard stats. They are safe to re-run and avoid transferring large row
-- sets when only counts/progress are needed.

create index if not exists idx_members_user_id
  on public.members(user_id);

create index if not exists idx_members_org_id
  on public.members(org_id);

create index if not exists idx_projects_org_id_created_at
  on public.projects(org_id, created_at desc);

create index if not exists idx_locales_project_id
  on public.locales(project_id);

create index if not exists idx_branches_project_default
  on public.branches(project_id, is_default);

create index if not exists idx_translation_keys_branch_key
  on public.translation_keys(branch_id, key);

create index if not exists idx_translations_branch_locale_status
  on public.translations(branch_id, locale_id, status);
