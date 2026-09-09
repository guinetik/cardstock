\set ON_ERROR_STOP on
begin;
-- All fixtures and queue changes roll back; this script sends no email.
delete from public.watch_notifications;
delete from public.card_watches;
insert into public.members(id,email,display_name,role) values
  ('24000000-0000-4000-8000-000000000001','watch-a@example.test','Watcher A','member'),
  ('24000000-0000-4000-8000-000000000002','watch-b@example.test','Watcher B','member'),
  ('24000000-0000-4000-8000-000000000003','watch-outsider@example.test','Outsider','member');
insert into public.projects(id,slug,name) values('24000000-0000-4000-8000-000000000010','watch-test','Watch test');
insert into public.project_members(project_id,member_id,role) values
  ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000001','member'),
  ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000002','member');
insert into public.boards(id,project_id,slug,name) values('24000000-0000-4000-8000-000000000020','24000000-0000-4000-8000-000000000010','board','Board');
insert into public.lanes(id,board_id,key,name,position,kind) values
  ('24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000020','now','NOW',1,'work'),
  ('24000000-0000-4000-8000-000000000031','24000000-0000-4000-8000-000000000020','done','DONE',2,'done');
insert into public.cards(id,board_id,external_id,title,lane_id) values
  ('24000000-0000-4000-8000-000000000040','24000000-0000-4000-8000-000000000020','24','Watch me','24000000-0000-4000-8000-000000000030');

set local role authenticated;
set local request.jwt.claims='{"email":"watch-a@example.test","role":"authenticated"}';
select public.set_card_watch('24000000-0000-4000-8000-000000000040',true);
select public.set_card_watch('24000000-0000-4000-8000-000000000040',true);
do $$ begin
  if (select count(*) from public.card_watches)<>1 then raise exception 'watch must be idempotent'; end if;
  begin
    perform public.claim_watch_email();
    raise exception 'member claimed email';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.watch_notifications where member_id='24000000-0000-4000-8000-000000000002' and email_state='pending')<>1 then raise exception 'watch announcement not queued by default'; end if;
  if exists(select 1 from public.watch_notifications where member_id='24000000-0000-4000-8000-000000000003') then raise exception 'announcement leaked to outsider'; end if;
end $$;

set local role authenticated;
set local request.jwt.claims='{"email":"watch-b@example.test","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.card_watches) then raise exception 'personal watches leaked'; end if;
  if (select count(*) from public.watch_notifications)<>1 then raise exception 'private notification RLS failed'; end if;
end $$;
update public.cards set lane_id='24000000-0000-4000-8000-000000000031' where id='24000000-0000-4000-8000-000000000040';
update public.cards set rank=200 where id='24000000-0000-4000-8000-000000000040';
reset role;
do $$ begin
  if (select count(*) from public.watch_notifications where kind='watchedMoved')<>1 then raise exception 'lane move missing or same-lane reorder duplicated'; end if;
  if not exists(select 1 from public.watch_notifications where kind='watchedMoved' and actor='watch-b@example.test' and body like '%NOW → DONE') then raise exception 'movement copy or actor incorrect'; end if;
end $$;

-- Own movement stays silent; browser preference off does not disable mail.
set local role authenticated;
set local request.jwt.claims='{"email":"watch-a@example.test","role":"authenticated"}';
update public.cards set lane_id='24000000-0000-4000-8000-000000000030' where id='24000000-0000-4000-8000-000000000040';
reset role;
do $$ begin
  if (select count(*) from public.watch_notifications where kind='watchedMoved')<>1 then raise exception 'own move notified'; end if;
end $$;

-- Outsiders cannot watch, inspect notifications, or tamper with another watch.
set local role authenticated;
set local request.jwt.claims='{"email":"watch-outsider@example.test","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.watch_notifications) then raise exception 'outsider read notification'; end if;
  begin
    perform public.set_card_watch('24000000-0000-4000-8000-000000000040',true);
    raise exception 'outsider watched card';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.card_watches;
    raise exception 'outsider deleted watch';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claims='{}';

-- Recipient selection, opt-out after enqueue, leases, retries and global throttle.
delete from public.watch_notifications where member_id<>'24000000-0000-4000-8000-000000000001';
update public.members set prefs='{"notifications":{"enabled":false,"email":{"watchStarted":false}}}' where id='24000000-0000-4000-8000-000000000001';
update public.watch_mail_clock set next_send_at=now()-interval '1 second';
do $$ declare v_job jsonb; v_retry jsonb; begin
  v_job := public.claim_watch_email();
  if v_job->>'to' is distinct from 'watch-a@example.test' then raise exception 'wrong recipient'; end if;
  if not exists(select 1 from public.watch_notifications where kind='watchStarted' and email_state='skipped') then raise exception 'queued opt-out ignored'; end if;
  if public.claim_watch_email()->>'waitMs' is null then raise exception 'global throttle missing'; end if;
  perform public.finish_watch_email((v_job->>'id')::uuid,gen_random_uuid(),null);
  if not exists(select 1 from public.watch_notifications where id=(v_job->>'id')::uuid and email_state='sending') then raise exception 'wrong lease finished'; end if;
  perform public.finish_watch_email((v_job->>'id')::uuid,(v_job->>'token')::uuid,'provider down');
  if not exists(select 1 from public.watch_notifications where id=(v_job->>'id')::uuid and email_state='pending' and next_attempt_at>now()) then raise exception 'failed mail not retried'; end if;
  update public.watch_notifications set next_attempt_at=now()-interval '1 second' where id=(v_job->>'id')::uuid;
  update public.watch_mail_clock set next_send_at=now()-interval '1 second';
  v_retry := public.claim_watch_email();
  if v_retry->>'token'=v_job->>'token' then raise exception 'retry must use new lease'; end if;
  perform public.finish_watch_email((v_retry->>'id')::uuid,(v_retry->>'token')::uuid,null);
  if not exists(select 1 from public.watch_notifications where id=(v_retry->>'id')::uuid and email_state='sent') then raise exception 'success not persisted'; end if;
end $$;

-- Service-role CLI identity propagates through the transactional wrapper.
update public.project_members set role='admin' where member_id='24000000-0000-4000-8000-000000000002';
select public.cli_apply_sync_v4('24000000-0000-4000-8000-000000000020','24000000-0000-4000-8000-000000000002',gen_random_uuid(),'[]');
update public.cards set lane_id='24000000-0000-4000-8000-000000000031' where id='24000000-0000-4000-8000-000000000040';
do $$ begin
  if (select count(*) from public.watch_notifications where kind='watchedMoved' and actor='watch-b@example.test')<>2 then raise exception 'service actor not preserved'; end if;
end $$;

-- Unwatch cancels pending movement. Revoke access also hides personal folders.
delete from public.card_watches where member_id='24000000-0000-4000-8000-000000000001';
update public.watch_mail_clock set next_send_at=now()-interval '1 second';
do $$ begin
  if public.claim_watch_email() is not null then raise exception 'unwatched movement delivered'; end if;
end $$;
insert into public.card_watches(card_id,member_id) values('24000000-0000-4000-8000-000000000040','24000000-0000-4000-8000-000000000001');
delete from public.project_members where member_id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims='{"email":"watch-a@example.test","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.card_watches) or exists(select 1 from public.watch_notifications) then raise exception 'revoked access still visible'; end if;
end $$;
reset role;
rollback;
select 'card watch and notification tests passed' as result;
