-- A durable, private notification per recipient. Email delivery is independent
-- of whether a browser is open; the browser subscribes only to its own rows.
create table public.watch_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  kind text not null check(kind in ('watchStarted','watchedMoved')),
  actor text,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  email_state text not null default 'pending' check(email_state in ('pending','sending','sent','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  last_error text
);
create index watch_notifications_inbox on public.watch_notifications(member_id,created_at desc);
create index watch_notifications_pending on public.watch_notifications(next_attempt_at)
  where email_state in ('pending','sending');
alter table public.watch_notifications enable row level security;
create policy watch_notifications_read on public.watch_notifications for select to authenticated
  using(member_id=(select id from public.members where email=current_email())
    and is_project_member(card_project(card_id)));
revoke all on public.watch_notifications from anon,authenticated;
grant select on public.watch_notifications to authenticated;
grant all on public.watch_notifications to service_role;
alter publication supabase_realtime add table public.watch_notifications;

-- Do not inherit browser permission: an absent email preference means on.
create function public.watch_email_allowed(p_member uuid,p_card uuid,p_kind text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from members m join cards c on c.id=p_card
    join boards b on b.id=c.board_id
    where m.id=p_member and
      (m.role='owner' or exists(select 1 from project_members pm where pm.member_id=m.id and pm.project_id=b.project_id))
      and (m.prefs #> array['notifications','email',p_kind]) is distinct from 'false'::jsonb
      and (p_kind='watchStarted' or exists(select 1 from card_watches w where w.card_id=c.id and w.member_id=m.id)));
$$;
revoke all on function public.watch_email_allowed(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.watch_email_allowed(uuid,uuid,text) to service_role;

create function public.announce_card_watch() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_card cards%rowtype; v_actor members%rowtype; v_project uuid; v_context text;
begin
  select * into v_card from cards where id=new.card_id;
  select * into v_actor from members where id=new.member_id;
  select b.project_id,p.name||' / '||b.name into v_project,v_context
    from boards b join projects p on p.id=b.project_id where b.id=v_card.board_id;
  insert into watch_notifications(member_id,card_id,kind,actor,title,body,email_state)
    select m.id,new.card_id,'watchStarted',v_actor.email::text,
      coalesce(nullif(v_actor.display_name,''),split_part(v_actor.email::text,'@',1))
        ||' is watching #'||v_card.external_id||' — '||v_card.title,
      v_context,
      case when watch_email_allowed(m.id,new.card_id,'watchStarted') then 'pending' else 'skipped' end
    from members m where (m.role='owner' or exists(
      select 1 from project_members pm where pm.member_id=m.id and pm.project_id=v_project))
      -- Rapid watch/unwatch toggles should not flood a project's inboxes.
      and not exists(select 1 from watch_notifications n where n.member_id=m.id
        and n.card_id=new.card_id and n.kind='watchStarted' and n.actor=v_actor.email::text
        and n.created_at>now()-interval '5 minutes');
  return new;
end $$;
create trigger announce_card_watch after insert on public.card_watches
  for each row execute function public.announce_card_watch();

-- Watch the actual lane column, covering drag, bulk moves, lane deletion and
-- CLI sync without depending on the several audit-event payload formats.
create function public.notify_watched_card_move() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_actor text; v_who text; v_context text; v_from text; v_to text;
begin
  if old.lane_id is not distinct from new.lane_id then return new; end if;
  v_actor := coalesce(current_email()::text,nullif(current_setting('cardstock.actor',true),''));
  select coalesce(nullif(display_name,''),split_part(email::text,'@',1)) into v_who from members where email=v_actor::citext;
  select p.name||' / '||b.name into v_context from boards b join projects p on p.id=b.project_id where b.id=new.board_id;
  select name into v_from from lanes where id=old.lane_id;
  select name into v_to from lanes where id=new.lane_id;
  insert into watch_notifications(member_id,card_id,kind,actor,title,body,email_state)
    select m.id,new.id,'watchedMoved',v_actor,
      coalesce(v_who,'Someone')||' moved #'||new.external_id||' — '||new.title,
      v_context||E'\n'||coalesce(v_from,'No lane')||' → '||coalesce(v_to,'No lane'),
      case when watch_email_allowed(m.id,new.id,'watchedMoved') then 'pending' else 'skipped' end
    from card_watches w join members m on m.id=w.member_id
    where w.card_id=new.id and m.email::text is distinct from v_actor
      and (m.role='owner' or exists(select 1 from project_members pm join boards b on b.project_id=pm.project_id
        where pm.member_id=m.id and b.id=new.board_id));
  return new;
end $$;
create trigger notify_watched_card_move after update of lane_id on public.cards
  for each row execute function public.notify_watched_card_move();

-- CLI runs with a service role: carry the already-validated member identity
-- into the trigger, scoped to this transaction. Keep protocol 4 unchanged.
alter function public.cli_apply_sync_v4(uuid,uuid,uuid,jsonb) rename to cli_apply_sync_v4_without_watch_actor;
create function public.cli_apply_sync_v4(p_board uuid,p_member uuid,p_operation uuid,p_cards jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
begin
  perform set_config('cardstock.actor',coalesce((select email::text from members where id=p_member),''),true);
  return cli_apply_sync_v4_without_watch_actor(p_board,p_member,p_operation,p_cards);
end $$;
revoke all on function public.cli_apply_sync_v4(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cli_apply_sync_v4(uuid,uuid,uuid,jsonb) to service_role;

-- One global slot avoids exceeding the managed mail endpoint's 10/minute
-- limit even if several requests/cron invocations drain the queue together.
create table public.watch_mail_clock (
  id boolean primary key default true check(id),
  next_send_at timestamptz not null default now()
);
insert into public.watch_mail_clock(id) values(true);
alter table public.watch_mail_clock enable row level security;
revoke all on public.watch_mail_clock from anon,authenticated;
grant all on public.watch_mail_clock to service_role;

create function public.claim_watch_email() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_next timestamptz; v_row watch_notifications%rowtype; v_email text; v_path text;
begin
  select next_send_at into v_next from watch_mail_clock where id=true for update;
  if v_next>clock_timestamp() then return jsonb_build_object('waitMs',ceil(extract(epoch from v_next-clock_timestamp())*1000)); end if;
  loop
    select * into v_row from watch_notifications
      where email_state in ('pending','sending') and next_attempt_at<=clock_timestamp()
      order by next_attempt_at,created_at limit 1 for update skip locked;
    if not found then return null; end if;
    -- Check again at delivery: opting out, unwatching or losing access also
    -- cancels mail already queued. Expire failures after a week.
    if not watch_email_allowed(v_row.member_id,v_row.card_id,v_row.kind)
      or v_row.created_at<now()-interval '7 days' then
      update watch_notifications set email_state='skipped' where id=v_row.id;
      continue;
    end if;
    exit;
  end loop;
  update watch_mail_clock set next_send_at=clock_timestamp()+interval '7 seconds' where id=true;
  update watch_notifications set email_state='sending',attempts=attempts+1,
    next_attempt_at=clock_timestamp()+interval '2 minutes',claim_token=gen_random_uuid()
    where id=v_row.id returning * into v_row;
  select email::text into v_email from members where id=v_row.member_id;
  select '/p/'||p.slug||'/b/'||b.slug||'/c/'||c.external_id into v_path
    from cards c join boards b on b.id=c.board_id join projects p on p.id=b.project_id where c.id=v_row.card_id;
  return jsonb_build_object('id',v_row.id,'token',v_row.claim_token,'to',v_email,
    'title',v_row.title,'body',v_row.body,'path',v_path);
end $$;

create function public.finish_watch_email(p_id uuid,p_token uuid,p_error text default null) returns void
language sql security definer set search_path=public as $$
  update watch_notifications set email_state=case when p_error is null then 'sent' else 'pending' end,
    last_error=left(p_error,500),claim_token=null,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer)
    where id=p_id and claim_token=p_token and email_state='sending';
$$;
revoke all on function public.claim_watch_email(),public.finish_watch_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_watch_email(),public.finish_watch_email(uuid,uuid,text) to service_role;
revoke all on function public.announce_card_watch(),public.notify_watched_card_move() from public,anon,authenticated;
