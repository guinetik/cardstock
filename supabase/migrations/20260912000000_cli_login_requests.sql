-- One-time device authorization requests for `cardstock login`.
create table public.cli_login_requests (
  user_code text primary key,
  device_hash text not null unique,
  device_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  member_id uuid references public.members(id) on delete cascade,
  consumed_at timestamptz
);

create index cli_login_requests_expiry on public.cli_login_requests (expires_at);

alter table public.cli_login_requests enable row level security;

-- The approval page runs with the member's cookie. It can attach only that
-- member to a live, unconsumed request; the service-role poller completes it.
create or replace function public.approve_cli_login(p_user_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select id into v_member_id from public.members where email = public.current_email();
  if v_member_id is null then return false; end if;
  update public.cli_login_requests
  set member_id = v_member_id, approved_at = now()
  where user_code = p_user_code
    and expires_at > now()
    and consumed_at is null
    and approved_at is null;
  return found;
end;
$$;

-- Claiming and minting happen in one transaction, so a poll race cannot issue
-- two credentials or replay an already completed request.
create or replace function public.complete_cli_login(
  p_device_hash text,
  p_token_id text,
  p_token_name text,
  p_token_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  update public.cli_login_requests
  set consumed_at = now()
  where device_hash = p_device_hash
    and expires_at > now()
    and approved_at is not null
    and consumed_at is null
  returning member_id into v_member_id;
  if v_member_id is null then return null; end if;
  insert into public.cli_tokens (id, member_id, name, token_hash)
  values (p_token_id, v_member_id, p_token_name, p_token_hash);
  return v_member_id;
end;
$$;
