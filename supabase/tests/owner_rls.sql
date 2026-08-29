-- Access-control tests. Run against a seeded local database:
--
--   bun run db:test
--
-- Every check runs as `authenticated` with a forged JWT claim, which is exactly
-- what RLS sees in production. Raises on the first failure; prints ok at the end.

\set ON_ERROR_STOP on

begin;

-- Fixtures, independent of whatever db:seed-members put there.
-- There can be only one owner, so demote the seeded one for this transaction
-- (the rollback at the end puts them back).
update public.members set role = 'member' where role = 'owner';
insert into public.members (email, role) values
  ('t-owner@example.test', 'owner'),
  ('t-member@example.test', 'member')
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
    insert into public.members (email, role) values ('t-sneak@example.test', 'member');
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
  if v_role <> 'member' then
    raise exception 'member role changed to %, expected member', v_role;
  end if;
end $$;

-- The owner can invite.
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"email":"t-owner@example.test","role":"authenticated"}';
  insert into public.members (email, role) values ('t-invited@example.test', 'member');
  set local role postgres;
  if not exists (select 1 from public.members where email = 't-invited@example.test') then
    raise exception 'the owner must be able to invite';
  end if;
end $$;

-- Project creation is atomic: the owner is attached, and every new board has
-- the minimal workflow needed to receive markdown cards.
do $$
declare
  v_project uuid;
  v_board uuid;
  v_owner uuid;
  v_count int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"email":"t-owner@example.test","role":"authenticated"}';
  select public.create_project('t-created-project', 'Created project', null)
    into v_project;
  select id into v_owner from public.members where email = 't-owner@example.test';
  if not exists (
    select 1 from public.project_members
    where project_id = v_project and member_id = v_owner and role = 'admin'
  ) then raise exception 'project creator was not attached as admin'; end if;

  select public.create_board(v_project, 'roadmap', 'Roadmap') into v_board;
  select count(*) into v_count from public.lanes where board_id = v_board;
  if v_count <> 5 then raise exception 'new board has % lanes, expected 5', v_count; end if;

  perform public.invite_project_member(
    v_project, 't-project-user@example.test', 'Project User', 'member'
  );
  if not exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where pm.project_id = v_project
      and m.email = 't-project-user@example.test'
      and pm.role = 'member'
  ) then raise exception 'invited user was not attached to project'; end if;
  set local role postgres;
end $$;

-- A non-owner cannot manufacture a project through the atomic function.
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"email":"t-member@example.test","role":"authenticated"}';
  begin
    perform public.create_project('t-sneak-project', 'Sneak project', null);
    raise exception 'a non-owner must not create projects';
  exception when insufficient_privilege then
    null; -- expected
  end;
  set local role postgres;
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

-- One owner. A second owner row is refused.
do $$
begin
  begin
    insert into public.members (email, role)
    values ('t-second-owner@example.test', 'owner');
    raise exception 'a second owner row must be rejected';
  exception when unique_violation then
    null;
  end;
end $$;

-- Site role admin is gone; admin is a project role.
do $$
begin
  begin
    insert into public.members (email, role)
    values ('t-site-admin@example.test', 'admin');
    raise exception 'members_role_check should reject site role admin';
  exception when check_violation then
    null;
  end;
end $$;

-- Owner sees a project they are not attached to; a member of that project
-- does not become an admin by being on the allowlist.
do $$
declare
  v_project uuid;
  v_member uuid;
  v_admin uuid;
  v_ok boolean;
  v_count int;
begin
  insert into public.projects (slug, name)
  values ('t-admin-project', 'Admin project')
  returning id into v_project;
  select id into v_member from public.members where email = 't-member@example.test';
  insert into public.members (email, role)
  values ('t-proj-admin@example.test', 'member')
  returning id into v_admin;
  insert into public.project_members (project_id, member_id, role) values
    (v_project, v_admin, 'admin'),
    (v_project, v_member, 'member');

  set local role authenticated;
  set local request.jwt.claims =
    '{"email":"t-owner@example.test","role":"authenticated"}';
  select public.is_project_member(v_project) into v_ok;
  if not v_ok then raise exception 'owner must see an unattached project'; end if;
  select public.is_project_admin(v_project) into v_ok;
  if not v_ok then raise exception 'owner must be project admin everywhere'; end if;

  set local request.jwt.claims =
    '{"email":"t-proj-admin@example.test","role":"authenticated"}';
  select public.is_project_admin(v_project) into v_ok;
  if not v_ok then raise exception 'project admin should be is_project_admin'; end if;
  perform public.create_board(v_project, 'admin-board', 'Admin board');

  begin
    perform public.invite_project_member(
      v_project, 't-admin-invited-admin@example.test', null, 'admin'
    );
    raise exception 'a project admin must not invite another admin';
  exception when insufficient_privilege then
    null;
  end;
  perform public.invite_project_member(
    v_project, 't-admin-invited-member@example.test', 'Invited', 'member'
  );

  set local request.jwt.claims =
    '{"email":"t-member@example.test","role":"authenticated"}';
  select public.is_project_admin(v_project) into v_ok;
  if v_ok then raise exception 'plain member must not be is_project_admin'; end if;
  begin
    perform public.create_board(v_project, 'sneak-board', 'Sneak board');
    raise exception 'a project member must not create a board';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.invite_project_member(
      v_project, 't-member-invited@example.test', null, 'member'
    );
    raise exception 'a project member must not invite';
  exception when insufficient_privilege then
    null;
  end;

  -- Prefs persist; role does not.
  update public.members
    set prefs = '{"inboxSort":"oldest"}'::jsonb
    where email = 't-member@example.test';
  if not found then raise exception 'a member must be able to update prefs'; end if;
  begin
    update public.members
      set role = 'owner'
      where email = 't-member@example.test';
    if found then raise exception 'a member must not change their site role'; end if;
  exception when insufficient_privilege then
    null;
  end;

  -- Teammates are visible; a member of no shared project is not.
  select count(*) into v_count from public.members
    where email = 't-proj-admin@example.test';
  if v_count <> 1 then
    raise exception 'a member must see a teammate, got %', v_count;
  end if;
  select count(*) into v_count from public.members
    where email = 't-invited@example.test';
  if v_count <> 0 then
    raise exception 'a member must not see an unrelated allowlisted person';
  end if;

  set local request.jwt.claims =
    '{"email":"t-proj-admin@example.test","role":"authenticated"}';
  begin
    perform public.remove_project_member(v_project, v_admin);
    raise exception 'a project admin must not remove themselves';
  exception when sqlstate '22023' then
    null;
  end;
  perform public.remove_project_member(v_project, v_member);
  if exists (
    select 1 from public.project_members
    where project_id = v_project and member_id = v_member
  ) then raise exception 'project admin should remove a member'; end if;

  perform public.invite_project_member(
    v_project, 't-member@example.test', null, 'member'
  );
  -- Promote the member to admin as postgres so the next check is about
  -- removing an admin, not about membership.
  set local role postgres;
  update public.project_members
    set role = 'admin'
    where project_id = v_project and member_id = v_member;
  set local role authenticated;
  set local request.jwt.claims =
    '{"email":"t-proj-admin@example.test","role":"authenticated"}';
  begin
    perform public.remove_project_member(v_project, v_member);
    raise exception 'a project admin must not remove another admin';
  exception when insufficient_privilege then
    null;
  end;

  set local request.jwt.claims =
    '{"email":"t-owner@example.test","role":"authenticated"}';
  perform public.invite_project_member(
    v_project, 't-owner-invited-admin@example.test', null, 'admin'
  );
  if not exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where pm.project_id = v_project
      and m.email = 't-owner-invited-admin@example.test'
      and pm.role = 'admin'
  ) then raise exception 'owner must be able to invite a project admin'; end if;

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
