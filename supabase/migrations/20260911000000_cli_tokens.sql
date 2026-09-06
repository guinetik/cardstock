-- cardstock — personal access tokens for the CLI.
--
-- A token acts as its member and carries exactly that member's permissions.
-- Only the SHA-256 of the secret is stored; the plaintext is shown once at
-- mint time and cannot be recovered afterwards.
create table public.cli_tokens (
  id text primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index cli_tokens_member on public.cli_tokens (member_id);

alter table public.cli_tokens enable row level security;

-- The website manages a member's own tokens through its cookie-authenticated
-- client. The token API uses a service client and performs access checks in
-- its route wrapper.
create policy cli_tokens_own on public.cli_tokens for all
  using (
    member_id in (
      select m.id from public.members m where m.email = public.current_email()
    )
  )
  with check (
    member_id in (
      select m.id from public.members m where m.email = public.current_email()
    )
  );
