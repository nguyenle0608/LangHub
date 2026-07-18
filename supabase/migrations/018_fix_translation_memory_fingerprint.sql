-- PostgreSQL text cannot contain chr(0). Use an unambiguous JSON encoding for
-- the deduplication fingerprint instead.

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

  v_fingerprint := md5(jsonb_build_array(
    p_org_id::text, v_source_locale, v_target_locale, v_source_normalized, v_target_text
  )::text);

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
