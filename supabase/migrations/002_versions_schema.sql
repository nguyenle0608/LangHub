-- versions (= Git tags cho translations)
create table versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,          -- 'v1.0', 'Before import March', 'Sprint 12'
  description text,
  tag text,                    -- 'manual' | 'auto_import' | 'auto_bulk_delete' | 'auto_before_restore'
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- snapshot data (copy toàn bộ translations tại thời điểm tạo version)
create table version_snapshots (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references versions(id) on delete cascade,
  key_id uuid references translation_keys(id) on delete cascade,
  locale_id uuid references locales(id) on delete cascade,
  key_name text not null,      -- lưu lại tên key phòng khi bị rename
  locale_code text not null,   -- lưu lại locale code phòng khi bị xoá
  value text,
  status text,
  unique(version_id, key_id, locale_id)
);

-- stats cache (tránh query toàn bộ snapshots)
create table version_stats (
  version_id uuid primary key references versions(id) on delete cascade,
  total_keys int default 0,
  total_locales int default 0,
  approved_count int default 0,
  pending_count int default 0,
  empty_count int default 0
);

create index idx_versions_project on versions(project_id);
create index idx_version_snapshots_version on version_snapshots(version_id);
