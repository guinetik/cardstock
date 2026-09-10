-- The checklist is relational; Markdown is an interchange format only.
alter table public.cards
  add column checklist_present boolean not null default false,
  add column checklist_revision integer not null default 0,
  add column checklist_edited_at timestamptz,
  add column checklist_input jsonb,
  add column checklist_expected_revision integer;
comment on column public.cards.checklist_input is 'Transactional write envelope, consumed and cleared by trigger. Never a second source of truth.';

create table public.card_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  label text not null check(length(btrim(label)) > 0 and label !~ E'[\r\n]'),
  completed boolean not null default false,
  position integer not null check(position >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(card_id, position) deferrable initially deferred
);
alter table public.card_checklist_items enable row level security;
create policy card_checklist_items_read on public.card_checklist_items for select
  using (exists(select 1 from public.cards c where c.id=card_id));
revoke all on public.card_checklist_items from anon, authenticated;
grant select on public.card_checklist_items to authenticated;
grant all on public.card_checklist_items to service_role;

-- Parent RLS authorizes the write. This trigger's elevated access only writes
-- children of that authorized parent; foreign child identities are rejected.
create function public.apply_card_checklist_items() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_items jsonb; v_item jsonb; v_before jsonb; v_after jsonb;
  v_id uuid; v_ids uuid[] := '{}'; v_position integer := 0; v_present boolean;
begin
  if new.checklist_input is null then return new; end if;
  if new.checklist_expected_revision is not null and new.checklist_expected_revision <> new.checklist_revision then
    raise exception 'Checklist changed. Reload the latest list before retrying.' using errcode='23514';
  end if;
  if jsonb_typeof(new.checklist_input->'present') is distinct from 'boolean'
     or jsonb_typeof(new.checklist_input->'items') is distinct from 'array' then
    raise exception 'Invalid checklist section' using errcode='22023';
  end if;
  v_present := (new.checklist_input->>'present')::boolean or new.checklist_present;
  v_items := new.checklist_input->'items';
  if not v_present and jsonb_array_length(v_items)>0 then
    raise exception 'A non-empty checklist must have a section' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('label',label,'completed',completed) order by position),'[]'::jsonb)
    into v_before from card_checklist_items where card_id=new.id;
  select coalesce(jsonb_agg(jsonb_build_object('label',value->>'label','completed',value->'completed') order by ord),'[]'::jsonb)
    into v_after from jsonb_array_elements(v_items) with ordinality as item(value,ord);
  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item->'label') is distinct from 'string' or length(btrim(v_item->>'label'))=0
       or v_item->>'label' ~ E'[\r\n]' or jsonb_typeof(v_item->'completed') is distinct from 'boolean' then
      raise exception 'Checklist items need a non-empty single-line label and a completion flag' using errcode='22023';
    end if;
    if v_item->>'id' is not null and not exists(select 1 from card_checklist_items where id=(v_item->>'id')::uuid and card_id=new.id) then
      raise exception 'Checklist item does not belong to this card' using errcode='22023';
    end if;
  end loop;
  if v_before is distinct from v_after or new.checklist_present is distinct from v_present then
    -- Plain Markdown replacement can omit IDs. Identical imports never churn IDs.
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_id := coalesce((v_item->>'id')::uuid, gen_random_uuid());
      if v_id=any(v_ids) then raise exception 'Duplicate checklist identity' using errcode='22023'; end if;
      v_ids := array_append(v_ids,v_id);
      insert into card_checklist_items(id,card_id,label,completed,position)
        values(v_id,new.id,v_item->>'label',(v_item->>'completed')::boolean,v_position)
        on conflict(id) do update set label=excluded.label,completed=excluded.completed,
          position=excluded.position,updated_at=clock_timestamp();
      v_position := v_position+1;
    end loop;
    delete from card_checklist_items where card_id=new.id and not(id=any(v_ids));
    update cards set checklist_present=v_present,checklist_revision=checklist_revision+1,
      checklist_input=null,checklist_expected_revision=null where id=new.id;
    insert into card_events(card_id,kind,actor,payload) values(new.id,'edited',
      coalesce(nullif(current_setting('cardstock.actor',true),''),current_email()::text,'etl'),
      jsonb_build_object('checklist',jsonb_build_object('before',v_before,'after',v_after)));
  else
    update cards set checklist_input=null,checklist_expected_revision=null where id=new.id;
  end if;
  return new;
end $$;
create trigger cards_apply_checklist after insert or update of checklist_input on public.cards
  for each row when (new.checklist_input is not null) execute function public.apply_card_checklist_items();
revoke all on function public.apply_card_checklist_items() from public,anon,authenticated;

alter function public.cli_card_projection(uuid) rename to cli_card_projection_v4;
create function public.cli_card_projection(p_id uuid) returns jsonb
language sql stable set search_path=public as $$
  select cli_card_projection_v4(c.id) || jsonb_build_object('checklist',jsonb_build_object(
    'present',c.checklist_present,'items',coalesce((select jsonb_agg(jsonb_build_object(
      'label',s.label,'completed',s.completed) order by s.position) from card_checklist_items s where s.card_id=c.id),'[]'::jsonb)))
  from cards c where c.id=p_id
$$;
revoke all on function public.cli_card_projection(uuid) from public,anon,authenticated;
grant execute on function public.cli_card_projection(uuid) to service_role;

-- Keep existing transactional validation and receipt behavior. The v3 writer
-- is also used internally by v4 for restores, so it must apply children inline.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.cli_apply_sync_v3(uuid,uuid,uuid,jsonb)'::regprocedure);
  if position('body_md=v_row.body_md,body_edited_at=null,' in definition)=0 then
    raise exception 'Unexpected CLI writer; checklist migration needs review';
  end if;
  definition := replace(definition,'body_md=v_row.body_md,body_edited_at=null,',
    'body_md=v_row.body_md,body_edited_at=null,checklist_input=v_row.checklist_input,checklist_edited_at=null,');
  execute definition;
end $$;

create function public.cli_apply_sync_v5(p_board uuid,p_member uuid,p_operation uuid,p_cards jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
begin
  return cli_apply_sync_v4(p_board,p_member,p_operation,p_cards);
end $$;
revoke all on function public.cli_apply_sync_v5(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cli_apply_sync_v5(uuid,uuid,uuid,jsonb) to service_role;
