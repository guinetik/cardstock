-- Project admin is a real capability, not a label.
--
-- Site role is owner | member (one owner). Admin lives on project_members.
-- The owner sees every project and acts as a project admin everywhere.
-- A project admin may create/import/export boards and invite members on that
-- project. Ordinary members use the boards; they do not invite or create them.

-- ---------------------------------------------------------------- site role
update public.members
set role = 'member'
where role = 'admin';

update public.members
set role = 'member'
where role = 'owner'
  and id not in (
    select id from public.members
    where role = 'owner'
    order by created_at, email
    limit 1
  );

alter table public.members
  drop constraint if exists members_role_check;

alter table public.members
  add constraint members_role_check
  check (role in ('owner', 'member'));

alter table public.members
  alter column role set default 'member';

create unique index if not exists members_one_owner
  on public.members ((true))
  where role = 'owner';

-- ---------------------------------------------------------------- helpers
create or replace function public.is_project_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where pm.project_id = p and m.email = public.current_email()
  )
$$;

create or replace function public.is_project_admin(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where pm.project_id = p
      and m.email = public.current_email()
      and pm.role = 'admin'
  )
$$;

-- Used by members SELECT so the policy does not recurse into members RLS.
create or replace function public.shares_project_with(p_member_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.project_members mine
    join public.members actor on actor.id = mine.member_id
    join public.project_members theirs on theirs.project_id = mine.project_id
    where actor.email = public.current_email()
      and theirs.member_id = p_member_id
  )
$$;

revoke all on function public.is_project_admin(uuid) from public;
revoke all on function public.shares_project_with(uuid) from public;
grant execute on function public.is_project_admin(uuid) to authenticated;
grant execute on function public.shares_project_with(uuid) to authenticated;

-- ---------------------------------------------------------------- RPCs
create or replace function public.create_board(
  p_project_id uuid,
  p_slug text,
  p_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'Project not found' using errcode = '42501';
  end if;
  if not public.is_project_admin(p_project_id) then
    raise exception 'Only an owner or project admin can create a board'
      using errcode = '42501';
  end if;

  insert into public.boards (project_id, slug, name)
  values (p_project_id, p_slug, p_name)
  returning id into v_board_id;

  insert into public.lanes (board_id, key, name, position, kind)
  values
    (v_board_id, 'unsorted', 'Unsorted', 0, 'inbox'),
    (v_board_id, 'now', 'Now', 1, 'work'),
    (v_board_id, 'next', 'Next', 2, 'work'),
    (v_board_id, 'done', 'Done', 3, 'done'),
    (v_board_id, 'archive', 'Archive', 4, 'archive');

  return v_board_id;
end;
$$;

create or replace function public.invite_project_member(
  p_project_id uuid,
  p_email text,
  p_display_name text default null,
  p_role text default 'member'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid project role' using errcode = '22023';
  end if;
  if public.is_owner() then
    null;
  elsif public.is_project_admin(p_project_id) then
    if p_role <> 'member' then
      raise exception 'Only an owner can invite a project admin'
        using errcode = '42501';
    end if;
  else
    raise exception 'Only an owner or project admin can invite users'
      using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found' using errcode = '22023';
  end if;

  insert into public.members (email, display_name, role)
  values (
    lower(trim(p_email))::citext,
    nullif(trim(p_display_name), ''),
    'member'
  )
  on conflict (email) do update
    set display_name = coalesce(excluded.display_name, public.members.display_name)
  returning id into v_member_id;

  insert into public.project_members (project_id, member_id, role)
  values (p_project_id, v_member_id, p_role)
  on conflict (project_id, member_id) do update set role = excluded.role;

  return v_member_id;
end;
$$;

create or replace function public.remove_project_member(
  p_project_id uuid,
  p_member_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_site text;
  v_target_project text;
begin
  if exists (
    select 1 from public.members
    where id = p_member_id and email = public.current_email()
  ) then
    raise exception 'You cannot remove your own project access'
      using errcode = '22023';
  end if;

  select m.role, pm.role
    into v_target_site, v_target_project
  from public.members m
  join public.project_members pm
    on pm.member_id = m.id and pm.project_id = p_project_id
  where m.id = p_member_id;

  if v_target_site is null then
    raise exception 'Project member not found' using errcode = '22023';
  end if;

  if public.is_owner() then
    null;
  elsif public.is_project_admin(p_project_id) then
    if v_target_site = 'owner' or v_target_project <> 'member' then
      raise exception 'Only an owner can remove a project admin'
        using errcode = '42501';
    end if;
  else
    raise exception 'Only an owner or project admin can manage users'
      using errcode = '42501';
  end if;

  delete from public.project_members
  where project_id = p_project_id and member_id = p_member_id;
end;
$$;

-- ---------------------------------------------------------------- members RLS
drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (
  public.is_owner()
  or email = public.current_email()
  or public.shares_project_with(id)
);

create policy members_self_update on public.members for update
  using (email = public.current_email())
  with check (email = public.current_email());

create or replace function public.members_protect_identity() returns trigger
language plpgsql as $$
begin
  -- Seed, migrations, and the service role bypass RLS by being the table
  -- owner; this trigger still fires, so only JWT sessions are constrained.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_owner() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.email is distinct from old.email then
    raise exception 'You cannot change your role or email'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists members_protect_identity on public.members;
create trigger members_protect_identity
  before update on public.members
  for each row execute function public.members_protect_identity();

-- Membership writes go through the RPCs (security definer). Direct table
-- inserts from the client are closed even for the owner.
drop policy if exists project_members_owner_write on public.project_members;
