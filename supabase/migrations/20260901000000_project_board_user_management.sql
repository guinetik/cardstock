-- First-class project, board, and membership creation.
-- These operations span multiple tables, so keep them atomic in Postgres rather
-- than leaving a half-created project or board when a later insert fails.

alter table public.project_members
  add constraint project_members_role_check
  check (role in ('admin', 'member'));

create or replace function public.create_project(
  p_slug text,
  p_name text,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_member_id uuid;
begin
  if not public.is_owner() then
    raise exception 'Only an owner can create projects' using errcode = '42501';
  end if;

  select id into v_member_id
  from public.members
  where email = public.current_email();

  insert into public.projects (slug, name, description)
  values (p_slug, p_name, nullif(trim(p_description), ''))
  returning id into v_project_id;

  insert into public.project_members (project_id, member_id, role)
  values (v_project_id, v_member_id, 'admin');

  return v_project_id;
end;
$$;

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
  if not public.is_owner() then
    raise exception 'Only an owner can invite users' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid project role' using errcode = '22023';
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
begin
  if not public.is_owner() then
    raise exception 'Only an owner can manage users' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.members
    where id = p_member_id and email = public.current_email()
  ) then
    raise exception 'You cannot remove your own project access' using errcode = '22023';
  end if;

  delete from public.project_members
  where project_id = p_project_id and member_id = p_member_id;
end;
$$;

revoke all on function public.create_project(text, text, text) from public;
revoke all on function public.create_board(uuid, text, text) from public;
revoke all on function public.invite_project_member(uuid, text, text, text) from public;
revoke all on function public.remove_project_member(uuid, uuid) from public;
grant execute on function public.create_project(text, text, text) to authenticated;
grant execute on function public.create_board(uuid, text, text) to authenticated;
grant execute on function public.invite_project_member(uuid, text, text, text) to authenticated;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
