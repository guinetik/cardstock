begin;
insert into public.members(id,email,role) values
  ('97200000-0000-4000-8000-000000000001','stencil-member@example.test','member'),
  ('97200000-0000-4000-8000-000000000002','stencil-outsider@example.test','member');
insert into public.projects(id,slug,name) values('97200000-0000-4000-8000-000000000003','stencil-rls-test','Stencil');
insert into public.project_members(project_id,member_id) values('97200000-0000-4000-8000-000000000003','97200000-0000-4000-8000-000000000001');
insert into public.boards(id,project_id,slug,name) values('97200000-0000-4000-8000-000000000004','97200000-0000-4000-8000-000000000003','test','Test');
insert into public.tag_groups(id,board_id,key,name) values('97200000-0000-4000-8000-000000000005','97200000-0000-4000-8000-000000000004','kind','Kind');
insert into public.tags(id,group_id,key,name) values('97200000-0000-4000-8000-000000000006','97200000-0000-4000-8000-000000000005','bug','Bug');
insert into public.boards(id,project_id,slug,name) values('97200000-0000-4000-8000-000000000007','97200000-0000-4000-8000-000000000003','other','Other');
insert into public.tag_groups(id,board_id,key,name) values('97200000-0000-4000-8000-000000000008','97200000-0000-4000-8000-000000000007','kind','Kind');
insert into public.tags(id,group_id,key,name) values('97200000-0000-4000-8000-000000000009','97200000-0000-4000-8000-000000000008','bug','Bug');

set local role authenticated;
select set_config('request.jwt.claims','{"email":"stencil-member@example.test","role":"authenticated"}',true);
do $$
declare v_id uuid;
begin
  insert into public.card_stencils(board_id,name,body_md)
    values('97200000-0000-4000-8000-000000000004','Integration','## Checklist' || chr(10) || '- [ ] Credentialing')
    returning id into v_id;
  insert into public.card_stencil_tags(stencil_id,tag_id) values(v_id,'97200000-0000-4000-8000-000000000006');
  if (select count(*) from public.card_stencils where board_id='97200000-0000-4000-8000-000000000004')<>1 then
    raise exception 'Member cannot read its own stencil';
  end if;

  -- A duplicate name on the same board is refused.
  begin
    insert into public.card_stencil_tags(stencil_id,tag_id) values(v_id,'97200000-0000-4000-8000-000000000009');
    raise exception 'A stencil accepted another board''s tag';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.card_stencils(board_id,name) values('97200000-0000-4000-8000-000000000004','Integration');
    raise exception 'Duplicate stencil name was allowed';
  exception when unique_violation then null;
  end;

  -- effort mirrors the cards constraint.
  begin
    insert into public.card_stencils(board_id,name,effort) values('97200000-0000-4000-8000-000000000004','Bad effort','XL');
    raise exception 'Invalid effort was allowed';
  exception when check_violation then null;
  end;

  -- Deleting a board tag cascades it out of the stencil.
  delete from public.tags where id='97200000-0000-4000-8000-000000000006';
  if exists(select 1 from public.card_stencil_tags where stencil_id=v_id) then
    raise exception 'Tag deletion did not cascade out of the stencil';
  end if;
end $$;

select set_config('request.jwt.claims','{"email":"stencil-outsider@example.test","role":"authenticated"}',true);
do $$
declare n integer;
begin
  if exists(select 1 from public.card_stencils where board_id='97200000-0000-4000-8000-000000000004') then
    raise exception 'Outsider can read stencils';
  end if;
  update public.card_stencils set name='Hijacked' where board_id='97200000-0000-4000-8000-000000000004';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Outsider can mutate stencils'; end if;
  delete from public.card_stencils where board_id='97200000-0000-4000-8000-000000000004';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Outsider can delete stencils'; end if;
  begin
    insert into public.card_stencils(board_id,name) values('97200000-0000-4000-8000-000000000004','Intruder');
    raise exception 'Outsider can create stencils';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
