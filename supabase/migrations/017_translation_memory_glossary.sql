-- Organization Translation Memory and terminology management.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to authenticated, service_role;

create table public.translation_memory_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_locale text not null check (char_length(source_locale) between 1 and 50 and source_locale ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'),
  target_locale text not null check (char_length(target_locale) between 1 and 50 and target_locale ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'),
  source_text text not null check (char_length(source_text) between 1 and 100000),
  source_normalized text not null check (char_length(source_normalized) between 1 and 100000),
  target_text text not null check (char_length(target_text) between 1 and 100000),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{32}$'),
  project_id uuid references public.projects(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  key_id uuid references public.translation_keys(id) on delete set null,
  quality text not null default 'approved' check (quality = 'approved'),
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lower(source_locale) <> lower(target_locale)),
  unique (org_id, fingerprint)
);

create index translation_memory_tenant_locale_idx
  on public.translation_memory_entries(org_id, source_locale, target_locale);
create index translation_memory_source_trgm_idx
  on public.translation_memory_entries using gin(source_normalized extensions.gin_trgm_ops);
create index translation_memory_recent_idx
  on public.translation_memory_entries(org_id, updated_at desc);

create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_locale text not null check (char_length(source_locale) between 1 and 50 and source_locale ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'),
  target_locale text not null check (char_length(target_locale) between 1 and 50 and target_locale ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'),
  source_term text not null check (char_length(btrim(source_term)) between 1 and 500),
  source_normalized text not null check (char_length(source_normalized) between 1 and 500),
  target_term text not null check (char_length(btrim(target_term)) between 1 and 500),
  case_sensitive boolean not null default false,
  whole_word boolean not null default true,
  description text check (description is null or char_length(description) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lower(source_locale) <> lower(target_locale)),
  unique (org_id, source_locale, target_locale, source_normalized)
);

create index glossary_terms_tenant_locale_idx
  on public.glossary_terms(org_id, source_locale, target_locale, source_normalized);

alter table public.translation_memory_entries enable row level security;
alter table public.glossary_terms enable row level security;

create policy "Organization members can view translation memory"
  on public.translation_memory_entries for select to authenticated
  using (private.current_user_org_role(org_id) is not null);

create policy "Organization members can view glossary terms"
  on public.glossary_terms for select to authenticated
  using (private.current_user_org_role(org_id) is not null);

create policy "Organization admins can create glossary terms"
  on public.glossary_terms for insert to authenticated
  with check (
    private.current_user_org_role(org_id) in ('owner', 'admin')
    and (created_by is null or created_by = auth.uid())
  );

create policy "Organization admins can update glossary terms"
  on public.glossary_terms for update to authenticated
  using (private.current_user_org_role(org_id) in ('owner', 'admin'))
  with check (private.current_user_org_role(org_id) in ('owner', 'admin'));

create policy "Organization admins can delete glossary terms"
  on public.glossary_terms for delete to authenticated
  using (private.current_user_org_role(org_id) in ('owner', 'admin'));

grant select on public.translation_memory_entries to authenticated;
grant select on public.glossary_terms to authenticated;
grant insert, update, delete on public.glossary_terms to authenticated;
grant select, insert, update, delete on public.translation_memory_entries to service_role;
grant select, insert, update, delete on public.glossary_terms to service_role;

create or replace function private.normalize_translation_assistance_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]]+', ' ', 'g'))
$$;

revoke all on function private.normalize_translation_assistance_text(text) from public;
grant usage on schema private to service_role;
grant execute on function private.normalize_translation_assistance_text(text) to authenticated, service_role;

create or replace function private.store_translation_memory_pair(
  p_org_id uuid,
  p_source_locale text,
  p_target_locale text,
  p_source_text text,
  p_target_text text,
  p_project_id uuid,
  p_branch_id uuid,
  p_key_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_normalized text;
  v_source_locale text := lower(btrim(p_source_locale));
  v_target_locale text := lower(btrim(p_target_locale));
  v_target_text text := btrim(p_target_text);
  v_fingerprint text;
  v_id uuid;
begin
  v_source_normalized := private.normalize_translation_assistance_text(p_source_text);
  if p_org_id is null or v_source_normalized = '' or v_target_text = ''
     or v_source_locale = '' or v_target_locale = ''
     or v_source_locale = v_target_locale then
    return null;
  end if;

  v_fingerprint := md5(
    p_org_id::text || chr(0) || v_source_locale || chr(0) || v_target_locale || chr(0)
    || v_source_normalized || chr(0) || v_target_text
  );

  insert into public.translation_memory_entries(
    org_id, source_locale, target_locale, source_text, source_normalized,
    target_text, fingerprint, project_id, branch_id, key_id
  ) values (
    p_org_id, v_source_locale, v_target_locale, btrim(p_source_text), v_source_normalized,
    v_target_text, v_fingerprint, p_project_id, p_branch_id, p_key_id
  )
  on conflict (org_id, fingerprint) do update set
    project_id = excluded.project_id,
    branch_id = excluded.branch_id,
    key_id = excluded.key_id,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.store_translation_memory_pair(uuid, text, text, text, text, uuid, uuid, uuid) from public;

create or replace function public.capture_approved_translation_memory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_org_id uuid;
  v_base_locale text;
  v_current_locale text;
  v_source_value text;
  v_target record;
begin
  if new.status <> 'approved' or btrim(coalesce(new.value, '')) = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and old.value is not distinct from new.value then
    return new;
  end if;

  select tk.project_id, p.org_id, lower(p.base_locale), lower(l.code)
    into v_project_id, v_org_id, v_base_locale, v_current_locale
  from public.translation_keys tk
  join public.projects p on p.id = tk.project_id
  join public.locales l on l.id = new.locale_id and l.project_id = p.id
  join public.branches b on b.id = new.branch_id and b.project_id = p.id and tk.branch_id = b.id
  where tk.id = new.key_id;

  if v_org_id is null then return new; end if;

  if v_current_locale = v_base_locale then
    for v_target in
      select t.value, lower(l.code) as locale
      from public.translations t
      join public.locales l on l.id = t.locale_id and l.project_id = v_project_id
      where t.branch_id = new.branch_id
        and t.key_id = new.key_id
        and t.status = 'approved'
        and lower(l.code) <> v_base_locale
        and btrim(coalesce(t.value, '')) <> ''
    loop
      perform private.store_translation_memory_pair(
        v_org_id, v_base_locale, v_target.locale, new.value, v_target.value,
        v_project_id, new.branch_id, new.key_id
      );
    end loop;
  else
    select s.value into v_source_value
    from public.translations s
    join public.locales sl on sl.id = s.locale_id and sl.project_id = v_project_id
    where s.branch_id = new.branch_id
      and s.key_id = new.key_id
      and lower(sl.code) = v_base_locale
      and btrim(coalesce(s.value, '')) <> ''
    limit 1;

    if v_source_value is not null then
      perform private.store_translation_memory_pair(
        v_org_id, v_base_locale, v_current_locale, v_source_value, new.value,
        v_project_id, new.branch_id, new.key_id
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_approved_translation_memory() from public;

create trigger capture_approved_translation_memory_trigger
after insert or update of value, status on public.translations
for each row execute function public.capture_approved_translation_memory();

create or replace function public.search_translation_memory(
  p_org_id uuid,
  p_source_locale text,
  p_target_locale text,
  p_source_text text,
  p_limit integer default 5,
  p_threshold double precision default 0.55
)
returns table(
  id uuid,
  source_text text,
  target_text text,
  score double precision,
  match_kind text,
  project_id uuid,
  usage_count integer,
  last_used_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select private.normalize_translation_assistance_text(p_source_text) as normalized
  ), candidates as (
    select
      tm.id, tm.source_text, tm.target_text,
      case
        when tm.source_normalized = input.normalized then 1.0::double precision
        else extensions.similarity(tm.source_normalized, input.normalized)::double precision
      end as score,
      case when tm.source_normalized = input.normalized then 'exact' else 'fuzzy' end as match_kind,
      tm.project_id, tm.usage_count, tm.last_used_at, tm.updated_at
    from public.translation_memory_entries tm
    cross join input
    where tm.org_id = p_org_id
      and tm.source_locale = lower(btrim(p_source_locale))
      and tm.target_locale = lower(btrim(p_target_locale))
      and input.normalized <> ''
      and (
        tm.source_normalized = input.normalized
        or (
          char_length(input.normalized) >= 4
          and tm.source_normalized OPERATOR(extensions.%) input.normalized
          and extensions.similarity(tm.source_normalized, input.normalized)
            >= greatest(0.3, least(coalesce(p_threshold, 0.55), 1.0))
        )
      )
  )
  select c.id, c.source_text, c.target_text, c.score, c.match_kind,
         c.project_id, c.usage_count, c.last_used_at
  from candidates c
  order by (c.match_kind = 'exact') desc, c.score desc, c.usage_count desc,
           c.updated_at desc, c.id
  limit greatest(1, least(coalesce(p_limit, 5), 5))
$$;

revoke all on function public.search_translation_memory(uuid, text, text, text, integer, double precision) from public;
grant execute on function public.search_translation_memory(uuid, text, text, text, integer, double precision) to authenticated, service_role;

create or replace function public.record_translation_memory_usage(p_org_id uuid, p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role'
     and private.current_user_org_role(p_org_id) is null then
    return false;
  end if;

  update public.translation_memory_entries
  set usage_count = usage_count + 1, last_used_at = now(), updated_at = now()
  where id = p_entry_id and org_id = p_org_id;
  return found;
end;
$$;

revoke all on function public.record_translation_memory_usage(uuid, uuid) from public;
grant execute on function public.record_translation_memory_usage(uuid, uuid) to authenticated, service_role;

create or replace function public.backfill_translation_memory(
  p_after_translation_id uuid default null,
  p_batch_size integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_processed integer := 0;
  v_last_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  for v_row in
    select
      t.id, t.value as target_value, t.branch_id, t.key_id,
      tk.project_id, p.org_id, lower(p.base_locale) as source_locale,
      lower(tl.code) as target_locale, source_t.value as source_value
    from public.translations t
    join public.translation_keys tk on tk.id = t.key_id and tk.branch_id = t.branch_id
    join public.projects p on p.id = tk.project_id
    join public.locales tl on tl.id = t.locale_id and tl.project_id = p.id
    join public.locales sl on sl.project_id = p.id and lower(sl.code) = lower(p.base_locale)
    join public.translations source_t
      on source_t.branch_id = t.branch_id and source_t.key_id = t.key_id and source_t.locale_id = sl.id
    where t.status = 'approved'
      and lower(tl.code) <> lower(p.base_locale)
      and btrim(coalesce(t.value, '')) <> ''
      and btrim(coalesce(source_t.value, '')) <> ''
      and (p_after_translation_id is null or t.id > p_after_translation_id)
    order by t.id
    limit greatest(1, least(coalesce(p_batch_size, 500), 2000))
  loop
    perform private.store_translation_memory_pair(
      v_row.org_id, v_row.source_locale, v_row.target_locale,
      v_row.source_value, v_row.target_value,
      v_row.project_id, v_row.branch_id, v_row.key_id
    );
    v_processed := v_processed + 1;
    v_last_id := v_row.id;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'nextCursor', case when v_processed = 0 then null else v_last_id end
  );
end;
$$;

revoke all on function public.backfill_translation_memory(uuid, integer) from public;
grant execute on function public.backfill_translation_memory(uuid, integer) to service_role;

create or replace function public.normalize_glossary_term()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source_locale := lower(btrim(new.source_locale));
  new.target_locale := lower(btrim(new.target_locale));
  new.source_term := btrim(new.source_term);
  new.target_term := btrim(new.target_term);
  new.source_normalized := private.normalize_translation_assistance_text(new.source_term);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.normalize_glossary_term() from public;

create trigger normalize_glossary_term_trigger
before insert or update of source_locale, target_locale, source_term, target_term
on public.glossary_terms
for each row execute function public.normalize_glossary_term();
