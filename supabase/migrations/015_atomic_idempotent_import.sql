-- Complete public import mutation and its idempotency response in one database
-- transaction. Calling the existing mutation function here remains part of the
-- wrapper transaction, so a failed idempotency update rolls back every write.
create or replace function public.apply_idempotent_translation_import(
  p_project_id uuid,
  p_branch_id uuid,
  p_locale_id uuid,
  p_entries jsonb,
  p_api_token_id uuid,
  p_request_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_snapshot_id uuid,
  p_filename text,
  p_skipped integer default 0,
  p_total integer default 0,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_response jsonb;
begin
  if p_api_token_id is null
     or p_idempotency_key is null
     or p_request_hash !~ '^[0-9a-f]{64}$'
     or p_snapshot_id is null
     or p_filename is null
     or p_skipped < 0
     or p_total < 0 then
    raise exception 'Invalid idempotent import arguments';
  end if;

  if not exists (
    select 1
    from public.api_idempotency_keys i
    where i.token_id = p_api_token_id
      and i.idempotency_key = p_idempotency_key
      and i.request_hash = p_request_hash
      and i.state = 'in_progress'
      and i.expires_at > now()
  ) then
    raise exception 'Idempotency reservation is not active';
  end if;

  v_result := public.apply_translation_import(
    p_project_id,
    p_branch_id,
    p_locale_id,
    p_entries,
    p_actor_user_id,
    p_api_token_id,
    p_request_id
  ) || jsonb_build_object(
    'skipped', p_skipped,
    'total', p_total,
    'snapshotId', p_snapshot_id,
    'filename', p_filename
  );
  v_response := jsonb_build_object('data', v_result);

  update public.api_idempotency_keys
  set state = 'completed',
      response_status = 200,
      response_body = v_response,
      snapshot_id = p_snapshot_id,
      updated_at = now()
  where token_id = p_api_token_id
    and idempotency_key = p_idempotency_key
    and request_hash = p_request_hash
    and state = 'in_progress';

  if not found then
    raise exception 'Failed to complete idempotent import';
  end if;

  return v_result;
end;
$$;

revoke all on function public.apply_idempotent_translation_import(uuid, uuid, uuid, jsonb, uuid, uuid, text, text, uuid, text, integer, integer, uuid) from public;
grant execute on function public.apply_idempotent_translation_import(uuid, uuid, uuid, jsonb, uuid, uuid, text, text, uuid, text, integer, integer, uuid) to service_role;
