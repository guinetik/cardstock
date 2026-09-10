begin;
insert into public.members(id,email,role) values
  ('97100000-0000-4000-8000-000000000001','checklist-member@example.test','member'),
  ('97100000-0000-4000-8000-000000000002','checklist-outsider@example.test','member');
insert into public.projects(id,slug,name) values('97100000-0000-4000-8000-000000000003','checklist-rls-test','Checklist');
insert into public.project_members(project_id,member_id) values('97100000-0000-4000-8000-000000000003','97100000-0000-4000-8000-000000000001');
insert into public.boards(id,project_id,slug,name) values('97100000-0000-4000-8000-000000000004','97100000-0000-4000-8000-000000000003','test','Test');
insert into public.cards(id,board_id,external_id,title,body_md) values('97100000-0000-4000-8000-000000000005','97100000-0000-4000-8000-000000000004','1','Test','Keep body');
set local role authenticated;
select set_config('request.jwt.claims','{"email":"checklist-member@example.test","role":"authenticated"}',true);
update public.cards set checklist_input='{"present":true,"items":[{"label":"One","completed":false},{"label":"Two","completed":true}]}',checklist_expected_revision=0 where id='97100000-0000-4000-8000-000000000005';
do $$
declare v_revision integer; v_id uuid;
begin
  if (select count(*) from public.card_checklist_items where card_id='97100000-0000-4000-8000-000000000005')<>2 then raise exception 'Member cannot read checklist'; end if;
  select checklist_revision into v_revision from public.cards where id='97100000-0000-4000-8000-000000000005';
  if v_revision<>1 then raise exception 'Revision not advanced'; end if;
  begin
    update public.cards set body_md='Lost body',checklist_input='{"present":true,"items":[]}',checklist_expected_revision=0 where id='97100000-0000-4000-8000-000000000005';
    raise exception 'Stale edit was allowed';
  exception when check_violation then null;
  end;
  if (select body_md from public.cards where id='97100000-0000-4000-8000-000000000005')<>'Keep body' then raise exception 'Body did not roll back'; end if;
  begin
    insert into public.card_checklist_items(card_id,label,position) values('97100000-0000-4000-8000-000000000005','Bypass',3);
    raise exception 'Direct child write bypassed revision checks';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims','{"email":"checklist-outsider@example.test","role":"authenticated"}',true);
do $$
declare n integer;
begin
  if exists(select 1 from public.card_checklist_items where card_id='97100000-0000-4000-8000-000000000005') then raise exception 'Outsider can read checklist'; end if;
  update public.cards set checklist_input='{"present":true,"items":[]}' where id='97100000-0000-4000-8000-000000000005';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Outsider can mutate checklist'; end if;
end $$;
rollback;
