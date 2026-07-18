-- Serialize token issuance per organization so concurrent owner/admin requests
-- cannot race past the active-token cap.
create or replace function public.create_api_token(
  p_org_id uuid,
  p_user_id uuid,
  p_name text,
  p_token_hash text,
  p_token_prefix text,
  p_scope text,
  p_expires_at timestamptz default null,
  p_active_limit integer default 20
)
returns table(
  id uuid,
  name text,
  token_prefix text,
  scope text,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_active_limit < 1 or p_active_limit > 100
     or char_length(p_name) not between 1 and 100
     or p_token_hash !~ '^[0-9a-f]{64}$'
     or char_length(p_token_prefix) not between 6 and 20
     or p_scope not in ('read', 'write')
     or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'Invalid API token arguments';
  end if;

  if not exists (
    select 1 from public.members m
    where m.org_id = p_org_id
      and m.user_id = p_user_id
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Not authorized to create API tokens';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));
  if (
    select count(*) from public.api_tokens t
    where t.org_id = p_org_id
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now())
  ) >= p_active_limit then
    raise exception 'active_token_limit';
  end if;

  return query
  insert into public.api_tokens as t(org_id, name, token_hash, token_prefix, scope, expires_at, created_by)
  values (p_org_id, p_name, p_token_hash, p_token_prefix, p_scope, p_expires_at, p_user_id)
  returning
    t.id,
    t.name,
    t.token_prefix,
    t.scope,
    t.last_used_at,
    t.expires_at,
    t.revoked_at,
    t.created_at,
    t.created_by;
end;
$$;

revoke all on function public.create_api_token(uuid, uuid, text, text, text, text, timestamptz, integer) from public;
grant execute on function public.create_api_token(uuid, uuid, text, text, text, text, timestamptz, integer) to service_role;
