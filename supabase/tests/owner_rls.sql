-- Access-control tests. Run against a seeded local database:
--
--   bun run db:test
--
-- Every check runs as `authenticated` with a forged JWT claim, which is exactly
-- what RLS sees in production. Raises on the first failure; prints ok at the end.

\set ON_ERROR_STOP on

begin;

-- Fixtures, independent of whatever db:seed-members put there.
insert into public.members (email, role) values
  ('t-owner@example.test', 'owner'),
  ('t-member@example.test', 'admin')
on conflict (email) do update set role = excluded.role;

do $$
declare
  v_ok boolean;
begin
  ---------------------------------------------------------------- helpers
  set local role authenticated;

  set local request.jwt.claims = '{"email":"t-owner@example.test","role":"authenticated"}';
  select public.is_owner() into v_ok;
  if not v_ok then raise exception 'owner should be is_owner()'; end if;
  select public.is_member() into v_ok;
  if not v_ok then raise exception 'owner should be is_member()'; end if;

  set local request.jwt.claims = '{"email":"t-member@example.test","role":"authenticated"}';
  select public.is_owner() into v_ok;
  if v_ok then raise exception 'plain member must not be is_owner()'; end if;
  select public.is_member() into v_ok;
  if not v_ok then raise exception 'plain member should be is_member()'; end if;

  set local request.jwt.claims = '{"email":"t-stranger@example.test","role":"authenticated"}';
  select public.is_member() into v_ok;
  if v_ok then raise exception 'stranger must not be is_member()'; end if;

  ---------------------------------------------------------------- allowlist writes
  -- A member who is not the owner cannot grow the allowlist.
  set local request.jwt.claims = '{"email":"t-member@example.test","role":"authenticated"}';
  begin
    insert into public.members (email, role) values ('t-sneak@example.test', 'admin');
    raise exception 'a non-owner member must not insert into members';
  exception when insufficient_privilege then
    null; -- expected
  end;

  -- Nor promote themselves.
  begin
    update public.members set role = 'owner' where email = 't-member@example.test';
    if found then raise exception 'a non-owner member must not promote themselves'; end if;
  exception when insufficient_privilege then
    null; -- expected
  end;
  set local role postgres;
end $$;

-- Self-promotion really did not take.
do $$
declare v_role text;
begin
  select role into v_role from public.members where email = 't-member@example.test';
  if v_role <> 'admin' then
    raise exception 'member role changed to %, expected admin', v_role;
  end if;
end $$;

-- The owner can invite.
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"email":"t-owner@example.test","role":"authenticated"}';
  insert into public.members (email, role) values ('t-invited@example.test', 'admin');
  set local role postgres;
  if not exists (select 1 from public.members where email = 't-invited@example.test') then
    raise exception 'the owner must be able to invite';
  end if;
end $$;

-- A stranger with a perfectly valid session sees nothing at all.
do $$
declare v_count int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"email":"t-stranger@example.test","role":"authenticated"}';
  select count(*) into v_count from public.cards;
  if v_count <> 0 then raise exception 'stranger saw % cards', v_count; end if;
  select count(*) into v_count from public.projects;
  if v_count <> 0 then raise exception 'stranger saw % projects', v_count; end if;
  select count(*) into v_count from public.members;
  if v_count <> 0 then raise exception 'stranger saw % members', v_count; end if;
  set local role postgres;
end $$;

-- is_invited answers for anon, normalises, and does not leak the list.
do $$
begin
  if not public.is_invited('  T-Owner@Example.TEST ') then
    raise exception 'is_invited should normalise case and whitespace';
  end if;
  if public.is_invited('t-stranger@example.test') then
    raise exception 'is_invited must be false for a stranger';
  end if;
end $$;

-- role is constrained, so a typo cannot quietly cost someone their access.
do $$
begin
  begin
    insert into public.members (email, role) values ('t-typo@example.test', 'onwer');
    raise exception 'members_role_check should reject an unknown role';
  exception when check_violation then
    null; -- expected
  end;
end $$;

rollback;

\echo 'owner_rls: ok'
