-- Watching is personal, and always bounded by current project access.
create table public.card_watches (
  card_id uuid not null references public.cards(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, member_id)
);
create index card_watches_member on public.card_watches(member_id, created_at desc);
alter table public.card_watches enable row level security;
create policy card_watches_read on public.card_watches for select to authenticated
  using (member_id = (select id from public.members where email=public.current_email())
    and public.is_project_member(public.card_project(card_id)));
grant select on public.card_watches to authenticated;
revoke insert, update, delete on public.card_watches from anon, authenticated;
grant all on public.card_watches to service_role;

create function public.set_card_watch(p_card uuid, p_watching boolean) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_member uuid;
begin
  select id into v_member from members where email=current_email();
  if v_member is null or not is_project_member(card_project(p_card))
    or not exists(select 1 from cards where id=p_card) then
    raise exception 'Card not found or access denied' using errcode='42501';
  end if;
  if p_watching is null then raise exception 'Choose whether to watch'; end if;
  if p_watching then
    insert into card_watches(card_id,member_id) values(p_card,v_member) on conflict do nothing;
  else
    delete from card_watches where card_id=p_card and member_id=v_member;
  end if;
  return p_watching;
end $$;
revoke all on function public.set_card_watch(uuid,boolean) from public, anon;
grant execute on function public.set_card_watch(uuid,boolean) to authenticated;
