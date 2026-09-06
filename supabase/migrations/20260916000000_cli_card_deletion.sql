-- Explicit deletion is a sync state. Keep the last sheet and reserve its identity;
-- an absent file or an incomplete response is never evidence of deletion.
create table public.cli_card_tombstones (
  board_id uuid not null references public.boards(id) on delete cascade,
  external_id text not null,
  card_id uuid not null,
  revision text not null default gen_random_uuid()::text,
  snapshot jsonb not null,
  deleted_at timestamptz not null default clock_timestamp(),
  primary key (board_id, external_id),
  unique (card_id)
);
alter table public.cli_card_tombstones enable row level security;
revoke all on public.cli_card_tombstones from anon, authenticated;
grant all on public.cli_card_tombstones to service_role;

-- Capture authorized deletes from every caller, including administrator tools.
-- This does not grant permission to delete a card: existing cards RLS still applies.
create function public.cli_record_card_deletion() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  -- Parent-board deletion needs no tombstones and must remain cascade-safe.
  if exists (select 1 from boards where id=old.board_id) then
    insert into cli_card_tombstones(board_id,external_id,card_id,snapshot)
    values(old.board_id,old.external_id,old.id,jsonb_build_object(
      'source',old.source_text,'savedProjection',old.sync_projection,
      'projection',cli_card_projection(old.id)));
  end if;
  return old;
end $$;
create trigger cli_record_card_deletion before delete on public.cards
for each row execute function public.cli_record_card_deletion();

create function public.cli_reserve_deleted_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from cli_card_tombstones where board_id=new.board_id and external_id=new.external_id) then
    raise exception 'Card % was deleted; explicitly resolve its deletion before restoring it',new.external_id using errcode='23514';
  end if;
  return new;
end $$;
create trigger cli_reserve_deleted_identity before insert or update of board_id,external_id on public.cards
for each row execute function public.cli_reserve_deleted_identity();

create function public.cli_sync_snapshot_v4(p_board uuid) returns jsonb
language sql stable set search_path=public as $$
  select jsonb_build_object('tagGroups',s->'tagGroups','cards',
    (s->'cards') || coalesce((select jsonb_agg(t.snapshot || jsonb_build_object(
      'externalId',t.external_id,'cardId',t.card_id,'revision',t.revision,'deleted',true)
      order by t.external_id) from cli_card_tombstones t where t.board_id=p_board),'[]'::jsonb))
  from (select cli_sync_snapshot(p_board) s) snapshot
$$;

-- A separate receipt namespace prevents v3 and v4 operation IDs from colliding.
create table public.cli_sync_receipts_v4 (like public.cli_sync_receipts including all);
alter table public.cli_sync_receipts_v4 add foreign key (board_id) references public.boards(id) on delete cascade;
alter table public.cli_sync_receipts_v4 add foreign key (member_id) references public.members(id) on delete cascade;
alter table public.cli_sync_receipts_v4 enable row level security;
revoke all on public.cli_sync_receipts_v4 from anon, authenticated;
grant all on public.cli_sync_receipts_v4 to service_role;

create function public.cli_apply_sync_v4(p_board uuid,p_member uuid,p_operation uuid,p_cards jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_receipt cli_sync_receipts_v4%rowtype; v_item jsonb; v_old cards%rowtype;
  v_dead cli_card_tombstones%rowtype; v_revision text; v_id uuid;
  v_upserts jsonb := '[]'::jsonb; v_result jsonb; v_fingerprint text := md5(p_cards::text);
  v_child_operation uuid := gen_random_uuid();
begin
  if not exists(select 1 from members m where m.id=p_member and (m.role='owner' or exists(
    select 1 from project_members pm join boards b on b.project_id=pm.project_id
    where b.id=p_board and pm.member_id=m.id and pm.role='admin'))) then
    raise exception 'Board admin access required' using errcode='42501';
  end if;
  perform 1 from boards where id=p_board for update;
  select * into v_receipt from cli_sync_receipts_v4 where board_id=p_board and operation_id=p_operation;
  if found then
    if v_receipt.member_id<>p_member or v_receipt.fingerprint<>v_fingerprint then
      raise exception 'Operation id reused with different content' using errcode='23514';
    end if;
    return v_receipt.result;
  end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards)>1000 then
    raise exception 'Expected at most 1000 cards' using errcode='22023';
  end if;
  if (select count(*)<>count(distinct value->>'externalId') from jsonb_array_elements(p_cards)) then
    raise exception 'Duplicate card identity' using errcode='22023';
  end if;
  -- Protect revisions derived from lane peers and relations during the whole batch.
  perform 1 from cards where board_id=p_board order by id for update;
  perform 1 from cli_card_tombstones where board_id=p_board order by card_id for update;
  for v_item in select value from jsonb_array_elements(p_cards) loop
    select * into v_old from cards where board_id=p_board and external_id=v_item->>'externalId';
    select * into v_dead from cli_card_tombstones where board_id=p_board and external_id=v_item->>'externalId';
    v_id := coalesce(v_old.id,v_dead.card_id);
    v_revision := case when v_old.id is not null then cli_sync_revision(v_old.id) else v_dead.revision end;
    if v_item->>'cardId' is null then
      if v_id is not null or coalesce((v_item->>'deleted')::boolean,false) then
        raise exception 'Card % already exists or has a reserved deleted identity',v_item->>'externalId' using errcode='23514';
      end if;
    elsif v_id is null or v_id::text is distinct from v_item->>'cardId' or v_revision is distinct from v_item->>'revision' then
      raise exception 'Card % identity or revision changed',v_item->>'externalId' using errcode='23514';
    end if;
  end loop;
  -- Reconstitute only explicitly selected survivors, keeping the same immutable UUID.
  -- The normal v3 writer validates and rebuilds sheet fields, tags and outgoing links.
  for v_item in select value from jsonb_array_elements(p_cards) loop
    if coalesce((v_item->>'deleted')::boolean,false) then continue; end if;
    select * into v_dead from cli_card_tombstones where board_id=p_board and external_id=v_item->>'externalId';
    if found then
      delete from cli_card_tombstones where board_id=p_board and external_id=v_dead.external_id;
      insert into cards(id,board_id,external_id,title) values(v_dead.card_id,p_board,v_dead.external_id,v_item->'columns'->>'title');
      v_item := v_item || jsonb_build_object('revision',cli_sync_revision(v_dead.card_id));
    end if;
    v_upserts := v_upserts || jsonb_build_array(v_item);
  end loop;
  -- Restored stubs have no lane or relations yet. Keep every other request's
  -- original revision: never waive a concurrent edit by refreshing its revision.
  if jsonb_array_length(v_upserts)>0 then
    perform cli_apply_sync_v3(p_board,p_member,v_child_operation,v_upserts);
    update card_events set payload=jsonb_set(payload,'{operation}',to_jsonb(p_operation))
      where payload->>'operation'=v_child_operation::text;
    delete from cli_sync_receipts where board_id=p_board and operation_id=v_child_operation;
  end if;
  for v_item in select value from jsonb_array_elements(p_cards) loop
    if coalesce((v_item->>'deleted')::boolean,false) then
      delete from cards where board_id=p_board and id=(v_item->>'cardId')::uuid;
    end if;
  end loop;
  select jsonb_build_object('applied',coalesce(jsonb_agg(jsonb_build_object(
    'externalId',item->>'externalId','cardId',coalesce(c.id,t.card_id),
    'revision',case when c.id is not null then cli_sync_revision(c.id) else t.revision end,
    'deleted',c.id is null)),'[]'::jsonb)) into v_result
    from jsonb_array_elements(p_cards) item
    left join cards c on c.board_id=p_board and c.external_id=item->>'externalId'
    left join cli_card_tombstones t on t.board_id=p_board and t.external_id=item->>'externalId';
  insert into cli_sync_receipts_v4(board_id,operation_id,member_id,fingerprint,result)
    values(p_board,p_operation,p_member,v_fingerprint,v_result);
  return v_result;
end $$;

revoke all on function public.cli_record_card_deletion(), public.cli_reserve_deleted_identity(),
  public.cli_sync_snapshot_v4(uuid), public.cli_apply_sync_v4(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cli_sync_snapshot_v4(uuid), public.cli_apply_sync_v4(uuid,uuid,uuid,jsonb) to service_role;
