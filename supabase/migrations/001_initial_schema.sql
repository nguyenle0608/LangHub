-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'free' check (plan in ('free','pro','enterprise')),
  created_at timestamptz default now()
);

-- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  base_locale text default 'en',
  created_at timestamptz default now(),
  unique(org_id, slug)
);

-- locales per project
create table locales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  code text not null,        -- 'vi', 'ja', 'ko', 'fr'
  name text not null,        -- 'Tiếng Việt'
  is_base boolean default false,
  created_at timestamptz default now(),
  unique(project_id, code)
);

-- translation keys (dot.notation)
create table translation_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  key text not null,                    -- 'auth.login.button'
  description text,
  tags text[] default '{}',
  platforms text[] default '{}',        -- ['ios','android','web']
  char_limit int,
  is_plural boolean default false,
  plural_forms jsonb,                   -- {zero:'',one:'%d item',other:'%d items'}
  reference_key_id uuid references translation_keys(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(project_id, key)
);

-- translations (value per key per locale)
create table translations (
  id uuid primary key default gen_random_uuid(),
  key_id uuid references translation_keys(id) on delete cascade,
  locale_id uuid references locales(id) on delete cascade,
  value text,
  status text default 'empty'
    check (status in ('empty','pending','reviewed','approved')),
  -- AI placeholders (Phase 8)
  ai_suggestion text,
  ai_model text,
  ai_suggested_at timestamptz,
  translated_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  unique(key_id, locale_id)
);

-- audit log
create table translation_history (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid references translations(id) on delete cascade,
  old_value text,
  new_value text,
  old_status text,
  new_status text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);

-- members
create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'translator'
    check (role in ('owner','admin','translator','viewer')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- indexes
create index idx_translation_keys_project on translation_keys(project_id);
create index idx_translations_key_locale on translations(key_id, locale_id);
create index idx_translations_status on translations(status);
create index idx_translation_keys_tags on translation_keys using gin(tags);

-- RLS
alter table organizations enable row level security;
alter table projects enable row level security;
alter table translation_keys enable row level security;
alter table translations enable row level security;

-- Realtime
alter publication supabase_realtime add table translations;
