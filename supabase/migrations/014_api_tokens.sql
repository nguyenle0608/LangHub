-- Organization API tokens and the security primitives required by /api/v1.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 6 and 20),
  scope text not null default 'read' check (scope in ('read', 'write')),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > created_at)
);

create index api_tokens_org_created_idx on public.api_tokens(org_id, created_at desc);
create index api_tokens_active_org_idx on public.api_tokens(org_id)
  where revoked_at is null;

create table public.api_rate_limit_buckets (
  token_id uuid not null references public.api_tokens(id) on delete cascade,
  request_kind text not null check (request_kind in ('read', 'write')),
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (token_id, request_kind, bucket_start)
);

create index api_rate_limit_buckets_retention_idx
  on public.api_rate_limit_buckets(bucket_start);

create table public.api_idempotency_keys (
  token_id uuid not null references public.api_tokens(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'in_progress' check (state in ('in_progress', 'completed', 'failed')),
  response_status integer,
  response_body jsonb,
  snapshot_id uuid references public.versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (token_id, idempotency_key)
);

create index api_idempotency_keys_retention_idx
  on public.api_idempotency_keys(expires_at);

create table public.api_audit_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.api_tokens(id) on delete set null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  request_id uuid not null,
  action text not null check (char_length(action) between 1 and 100),
  outcome text not null check (outcome in ('success', 'failure')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index api_audit_events_org_created_idx
  on public.api_audit_events(org_id, created_at desc);
create index api_audit_events_token_created_idx
  on public.api_audit_events(token_id, created_at desc);

-- All API credential/control tables are server-only. RLS is deliberately
-- enabled without anon/authenticated policies; service-role operations bypass
-- it after explicit server authorization.
alter table public.api_tokens enable row level security;
alter table public.api_rate_limit_buckets enable row level security;
alter table public.api_idempotency_keys enable row level security;
alter table public.api_audit_events enable row level security;

-- The linked project uses the new deny-by-default Data API grants, so grant
-- only the service role used by server-side routes and RPCs.
grant select, insert, update, delete on public.api_tokens to service_role;
grant select, insert, update, delete on public.api_rate_limit_buckets to service_role;
grant select, insert, update, delete on public.api_idempotency_keys to service_role;
grant select, insert, update, delete on public.api_audit_events to service_role;

-- Atomically consume a fixed-window quota shared by every application instance.
create or replace function public.consume_api_rate_limit(
  p_token_id uuid,
  p_request_kind text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket_start timestamptz;
  v_count integer;
begin
  if p_request_kind not in ('read', 'write')
     or p_limit < 1
     or p_window_seconds < 1
     or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit parameters';
  end if;

  if not exists (
    select 1 from public.api_tokens t
    where t.id = p_token_id
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now())
  ) then
    raise exception 'Inactive API token';
  end if;

  v_bucket_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limit_buckets(token_id, request_kind, bucket_start, request_count)
  values (p_token_id, p_request_kind, v_bucket_start, 1)
  on conflict (token_id, request_kind, bucket_start)
  do update set request_count = public.api_rate_limit_buckets.request_count + 1
  returning request_count into v_count;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_bucket_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid, text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer) to service_role;

-- Transactional import mutation. HTTP parsing, request-size validation,
-- snapshot creation, and idempotency reservation happen before this RPC.
create or replace function public.apply_translation_import(
  p_project_id uuid,
  p_branch_id uuid,
  p_locale_id uuid,
  p_entries jsonb,
  p_actor_user_id uuid default null,
  p_api_token_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_key text;
  v_value text;
  v_key_id uuid;
  v_translation_id uuid;
  v_old_value text;
  v_old_status text;
  v_org_id uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_was_new boolean;
begin
  if jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) < 1
     or jsonb_array_length(p_entries) > 5000 then
    raise exception 'Entries must be an array containing 1 to 5000 items';
  end if;

  select p.org_id into v_org_id
  from public.projects p
  join public.branches b on b.project_id = p.id and b.id = p_branch_id
  join public.locales l on l.project_id = p.id and l.id = p_locale_id
  where p.id = p_project_id;

  if v_org_id is null then
    raise exception 'Project, branch, and locale do not match';
  end if;

  if p_api_token_id is not null and not exists (
    select 1 from public.api_tokens t
    where t.id = p_api_token_id
      and t.org_id = v_org_id
      and t.scope = 'write'
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now())
  ) then
    raise exception 'API token is not authorized for this import';
  end if;

  if p_api_token_id is null and (
    p_actor_user_id is null or not exists (
      select 1 from public.members m
      where m.org_id = v_org_id
        and m.user_id = p_actor_user_id
        and m.role in ('owner', 'admin', 'translator')
    )
  ) then
    raise exception 'User is not authorized for this import';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    v_key := v_entry->>'key';
    v_value := coalesce(v_entry->>'value', '');

    if v_key is null or char_length(v_key) < 1 or char_length(v_key) > 200
       or v_key !~ '^[a-z0-9_.]+$'
       or char_length(v_value) > 100000 then
      raise exception 'Invalid import entry';
    end if;

    select tk.id into v_key_id
    from public.translation_keys tk
    where tk.branch_id = p_branch_id and tk.key = v_key;

    v_was_new := v_key_id is null;
    if v_was_new then
      insert into public.translation_keys(project_id, branch_id, key, created_by)
      values (p_project_id, p_branch_id, v_key, p_actor_user_id)
      returning id into v_key_id;
      v_created := v_created + 1;

      insert into public.translations(branch_id, key_id, locale_id, value, status)
      select p_branch_id, v_key_id, l.id, null, 'empty'
      from public.locales l
      where l.project_id = p_project_id
      on conflict (branch_id, key_id, locale_id) do nothing;
    end if;

    if btrim(v_value) <> '' then
      select t.id, t.value, t.status
      into v_translation_id, v_old_value, v_old_status
      from public.translations t
      where t.branch_id = p_branch_id
        and t.key_id = v_key_id
        and t.locale_id = p_locale_id;

      insert into public.translations(
        branch_id, key_id, locale_id, value, status, translated_by, updated_at
      ) values (
        p_branch_id, v_key_id, p_locale_id, v_value, 'pending', p_actor_user_id, now()
      )
      on conflict (branch_id, key_id, locale_id)
      do update set
        value = excluded.value,
        status = excluded.status,
        translated_by = excluded.translated_by,
        updated_at = excluded.updated_at
      returning id into v_translation_id;

      insert into public.translation_history(
        translation_id, old_value, new_value, old_status, new_status, changed_by
      ) values (
        v_translation_id, v_old_value, v_value, v_old_status, 'pending', p_actor_user_id
      );

      if not v_was_new then
        v_updated := v_updated + 1;
      end if;
    end if;
  end loop;

  if p_api_token_id is not null then
    insert into public.api_audit_events(
      token_id, org_id, project_id, branch_id, request_id, action, outcome, metadata
    ) values (
      p_api_token_id,
      v_org_id,
      p_project_id,
      p_branch_id,
      p_request_id,
      'translations.import',
      'success',
      jsonb_build_object('created', v_created, 'updated', v_updated, 'locale_id', p_locale_id)
    );
  end if;

  return jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'total', jsonb_array_length(p_entries)
  );
end;
$$;

revoke all on function public.apply_translation_import(uuid, uuid, uuid, jsonb, uuid, uuid, uuid) from public;
grant execute on function public.apply_translation_import(uuid, uuid, uuid, jsonb, uuid, uuid, uuid) to service_role;
