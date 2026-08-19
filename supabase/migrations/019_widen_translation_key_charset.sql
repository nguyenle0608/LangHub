-- Translation keys arrive from i18next, ARB, Android, and iOS files, where
-- camelCase and kebab-case names are both ordinary. The original charset guard
-- accepted lowercase only, so importing a real app catalog failed on the first
-- camelCase key. Widen the guard to match src/lib/translation-keys.ts.
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
       or v_key !~ '^[A-Za-z0-9_.-]+$'
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

revoke all on function public.apply_translation_import(uuid, uuid, uuid, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_translation_import(uuid, uuid, uuid, jsonb, uuid, uuid, uuid) to service_role;
