-- ============================================================
-- 021: Index the foreign keys that a branch delete has to walk
-- ============================================================
-- Deleting a branch with a real amount of content timed out:
--
--   DELETE /api/branches -> canceling statement due to statement timeout
--
-- The delete itself is one row. The cost is the cascade: ~700 translation_keys
-- and ~11,000 translations, and for every one of those rows Postgres must
-- visit each table that references it. A referencing column with no index is a
-- sequential scan *per deleted row*, which turns a cascade into O(n * m) and
-- runs past the statement timeout on a project of ordinary size.
--
-- None of these columns had an index. Each one below is on the referencing
-- side of a foreign key that a branch delete reaches:

-- translations -> translation_history (on delete cascade)
-- Walked ~11,000 times, once per deleted translation. The worst of them.
create index if not exists idx_translation_history_translation_id
  on public.translation_history(translation_id);

-- translation_keys -> version_snapshots (on delete cascade)
-- Walked once per deleted key, over the largest table in the schema: every
-- import writes a snapshot row per key per locale.
create index if not exists idx_version_snapshots_key_id
  on public.version_snapshots(key_id);

-- translation_keys -> translation_keys (no action)
-- Self-reference with no action declared, so the delete does not cascade — it
-- *verifies* that nothing points at the row, scanning the whole table to do it.
create index if not exists idx_translation_keys_reference_key_id
  on public.translation_keys(reference_key_id);

-- translation_keys -> translation_memory_entries (on delete set null)
create index if not exists idx_translation_memory_entries_key_id
  on public.translation_memory_entries(key_id);

-- The branch row itself is deleted once, so these are scanned once each rather
-- than per row. Cheap to index, and they keep the cost of a delete flat as
-- these tables grow.
create index if not exists idx_versions_branch_id
  on public.versions(branch_id);

create index if not exists idx_translation_memory_entries_branch_id
  on public.translation_memory_entries(branch_id);

create index if not exists idx_api_audit_events_branch_id
  on public.api_audit_events(branch_id);

create index if not exists idx_branches_parent_branch_id
  on public.branches(parent_branch_id);
