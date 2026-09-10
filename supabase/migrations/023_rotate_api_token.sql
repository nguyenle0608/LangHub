-- ============================================================
-- 023: Rotate an API token without an outage
-- ============================================================
-- Replacing a leaked or ageing token used to mean revoke-then-create: the old
-- secret dies the instant it is revoked, so every deployment holding it starts
-- failing until someone has pasted the new one everywhere. That gap is why
-- rotation gets postponed, which is the opposite of what a credential needs.
--
-- Rotation issues the replacement first and lets the old secret keep working
-- for a grace period, so the two overlap while configuration catches up. The
-- name and scope carry over, because the token's identity is what other systems
-- were configured against; only the secret changes.
--
-- The old secret retires through `expires_at`, not `revoked_at`. Authentication
-- rejects any non-null `revoked_at` outright, whatever its timestamp, so a
-- future `revoked_at` would end the grace period at the moment it began.
-- `expires_at` already means "valid until", which is exactly what a grace period
-- is, and reusing it keeps rotation out of the authentication path entirely.

alter table public.api_tokens
  add column if not exists replaced_by uuid references public.api_tokens(id) on delete set null;

comment on column public.api_tokens.replaced_by is
  'The token issued to replace this one. Lets the UI say "retiring" rather than "expiring soon", and keeps the chain auditable after the secret is gone.';

-- Unindexed foreign keys are scanned once per referencing row on delete; this
-- one points at the same table it lives in, so revoking a token would scan
-- every token in the system without it.
create index if not exists idx_api_tokens_replaced_by
  on public.api_tokens(replaced_by);

create or replace function public.rotate_api_token(
  p_org_id uuid,
  p_user_id uuid,
  p_token_id uuid,
  p_token_hash text,
  p_token_prefix text,
  p_grace_minutes integer default 0,
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
declare
  v_old public.api_tokens;
  v_retires_at timestamptz;
  v_new_id uuid;
begin
  if p_active_limit < 1 or p_active_limit > 100
     or p_token_hash !~ '^[0-9a-f]{64}$'
     or char_length(p_token_prefix) not between 6 and 20
     or p_grace_minutes < 0 or p_grace_minutes > 1440 then
    raise exception 'Invalid API token arguments';
  end if;

  if not exists (
    select 1 from public.members m
    where m.org_id = p_org_id
      and m.user_id = p_user_id
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Not authorized to rotate API tokens';
  end if;

  -- Same lock as create_api_token, so a rotation and a creation cannot both
  -- pass the cap check and leave the organization one token over.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  select * into v_old from public.api_tokens t
  where t.id = p_token_id and t.org_id = p_org_id
  for update;

  if v_old.id is null then
    raise exception 'token_not_found';
  end if;
  if v_old.revoked_at is not null
     or (v_old.expires_at is not null and v_old.expires_at <= now()) then
    -- Nothing to roll over from. Rotating a dead token would quietly mint a
    -- fresh credential from an expired one, which is a way to resurrect a
    -- deliberately retired token rather than a rotation.
    raise exception 'token_not_active';
  end if;

  -- The token being replaced does not count against the cap: it is on its way
  -- out. Counting it would make an organization at the limit unable to rotate,
  -- which turns the cap into a reason to keep an old credential alive.
  if (
    select count(*) from public.api_tokens t
    where t.org_id = p_org_id
      and t.id <> p_token_id
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now())
  ) >= p_active_limit then
    raise exception 'active_token_limit';
  end if;

  insert into public.api_tokens as t(
    org_id, name, token_hash, token_prefix, scope, expires_at, created_by
  )
  values (
    p_org_id, v_old.name, p_token_hash, p_token_prefix, v_old.scope,
    v_old.expires_at, p_user_id
  )
  returning t.id into v_new_id;

  if p_grace_minutes = 0 then
    update public.api_tokens t
    set revoked_at = now(), replaced_by = v_new_id
    where t.id = p_token_id;
  else
    -- least() so a grace period can only ever shorten the old token's life. A
    -- token already expiring in two minutes must not be granted an hour more
    -- because someone asked for a generous overlap.
    update public.api_tokens t
    set expires_at = least(
          coalesce(t.expires_at, 'infinity'::timestamptz),
          now() + make_interval(mins => p_grace_minutes)
        ),
        replaced_by = v_new_id
    where t.id = p_token_id;
  end if;

  return query
  select t.id, t.name, t.token_prefix, t.scope, t.last_used_at,
         t.expires_at, t.revoked_at, t.created_at, t.created_by
  from public.api_tokens t where t.id = v_new_id;
end;
$$;

revoke all on function public.rotate_api_token(uuid, uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.rotate_api_token(uuid, uuid, uuid, text, text, integer, integer)
  to service_role;
