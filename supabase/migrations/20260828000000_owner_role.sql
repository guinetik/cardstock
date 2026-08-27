-- The Owner: whoever deploys the app and owns its infrastructure.
--
-- Access is a two-step gate. `members` is the allowlist — an email that is not
-- in it never gets a session, enforced at every entry point. Who may *write*
-- that allowlist is narrower still: only an owner invites.
--
-- The owner is bootstrapped from OWNER_EMAIL by `bun run db:seed-members`, but
-- the row is the source of truth from then on. Adding people works from SQL
-- today and from a UI later with no schema change.

-- Free text until now, so a typo ('onwer') silently cost someone their access.
alter table public.members
  add constraint members_role_check
  check (role in ('owner', 'admin', 'member'));

-- Co-owners are deliberately allowed: no unique index here, because rotating a
-- single owner address would otherwise mean a window with no owner at all.
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.email = public.current_email() and m.role = 'owner'
  )
$$;

-- Everyone signed in still reads the roster; only an owner writes it.
drop policy if exists members_write on public.members;
create policy members_owner_write on public.members for all
  using (public.is_owner()) with check (public.is_owner());

-- An invite is a `members` row *and* a `project_members` row. Narrowing only
-- the first would leave the gate open, so this one moves in step.
drop policy if exists project_members_rw on public.project_members;
create policy project_members_read on public.project_members for select
  using (public.is_project_member(project_id));
create policy project_members_owner_write on public.project_members for all
  using (public.is_owner()) with check (public.is_owner());

-- Called by anon from the login screen, before any mail is sent: is this
-- address invited? Security definer so it can see `members` without a session,
-- and returns only a boolean so the allowlist itself stays unreadable.
create or replace function public.is_invited(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.email = lower(trim(p_email))::citext
  )
$$;

revoke all on function public.is_invited(text) from public;
grant execute on function public.is_invited(text) to anon, authenticated;
