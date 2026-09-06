-- Safe CLI sync: one transactional batch, immutable identities and idempotent retries.
alter table public.cards add column sync_projection jsonb;
create table public.cli_sync_receipts (
  board_id uuid not null references public.boards(id) on delete cascade,
  operation_id uuid not null,
  member_id uuid not null references public.members(id) on delete cascade,
  fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (board_id, operation_id)
);
alter table public.cli_sync_receipts enable row level security;

create function public.cli_card_projection(p_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'frontmatter.title', c.title, 'frontmatter.status', c.status,
    'frontmatter.epic', c.epic, 'frontmatter.area', c.area,
    'frontmatter.assignee', coalesce(m.email::text, c.assignee),
    'frontmatter.raised_by', c.raised_by, 'frontmatter.raised', c.raised_on,
    'frontmatter.shipped', c.shipped_on, 'frontmatter.needs', c.needs,
    'frontmatter.summary', c.summary, 'frontmatter.lane', l.key,
    'frontmatter.rank', case when c.lane_id is null then null else
      (select count(*) from cards peer where peer.lane_id = c.lane_id and
        (peer.rank < c.rank or (peer.rank = c.rank and peer.external_id <= c.external_id))) end,
    'frontmatter.priority', c.priority, 'frontmatter.effort', c.effort,
    'frontmatter.planned_start', c.planned_start_date,
    'frontmatter.target', coalesce(c.target_date::text, c.target_label),
    'frontmatter.archived', to_char(c.archived_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    'frontmatter.archived_by', c.archived_by, 'frontmatter.color', c.color,
    'frontmatter.tags', coalesce((select jsonb_agg(ref order by ref) from (
      select g.key || ':' || t.key ref from card_tags ct join tags t on t.id=ct.tag_id
      join tag_groups g on g.id=t.group_id where ct.card_id=c.id) refs), '[]'::jsonb),
    'frontmatter.relates', coalesce((select jsonb_agg(target.external_id::bigint order by target.external_id::bigint)
      from card_links cl join cards target on target.id=cl.to_card
      where cl.from_card=c.id and cl.kind='relates'), '[]'::jsonb), 'body', c.body_md
  ) || coalesce((select jsonb_object_agg('frontmatter.' || key, value)
    from jsonb_each(c.frontmatter_extra)), '{}'::jsonb)
  from cards c left join lanes l on l.id=c.lane_id left join members m on m.id=c.assignee_id
  where c.id=p_id
$$;

-- Include derived fields: another card's move can change this card's exported rank.
create function public.cli_sync_revision(p_id uuid) returns text
language sql stable set search_path=public as $$
  select md5(c.updated_at::text || cli_card_projection(c.id)::text) from cards c where c.id=p_id
$$;

-- Relationship changes must also invalidate card revisions, including web edits.
create function public.cli_card_revision() returns trigger language plpgsql as $$
begin new.updated_at = greatest(clock_timestamp(), old.updated_at + interval '1 microsecond'); return new; end $$;
drop trigger cards_touch on public.cards;
create trigger cards_touch before update on public.cards for each row execute function public.cli_card_revision();
create function public.cli_relation_revision() returns trigger language plpgsql set search_path=public as $$
declare v_old uuid; v_new uuid;
begin
  if TG_TABLE_NAME='card_tags' then
    if TG_OP <> 'INSERT' then v_old=old.card_id; end if;
    if TG_OP <> 'DELETE' then v_new=new.card_id; end if;
  else
    if TG_OP <> 'INSERT' then v_old=old.from_card; end if;
    if TG_OP <> 'DELETE' then v_new=new.from_card; end if;
  end if;
  update cards set updated_at=clock_timestamp() where id in (v_old,v_new);
  if TG_OP='DELETE' then return old; else return new; end if;
end $$;
create trigger cli_tags_revision before insert or update or delete on public.card_tags for each row execute function public.cli_relation_revision();
create trigger cli_links_revision before insert or update or delete on public.card_links for each row execute function public.cli_relation_revision();

-- One SQL statement supplies a coherent MVCC snapshot of metadata, sources and revisions.
create function public.cli_sync_snapshot(p_board uuid) returns jsonb
language sql stable set search_path=public as $$
  select jsonb_build_object(
    'tagGroups', coalesce((select jsonb_agg(jsonb_build_object('key',g.key,'tags',
      coalesce((select jsonb_agg(jsonb_build_object('key',t.key) order by t.key) from tags t where t.group_id=g.id),'[]'::jsonb)) order by g.key)
      from tag_groups g where g.board_id=p_board),'[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('externalId',c.external_id,
      'cardId',c.id,'revision',cli_sync_revision(c.id),'source',c.source_text,
      'savedProjection',c.sync_projection,'projection',cli_card_projection(c.id)) order by c.external_id)
      from cards c where c.board_id=p_board),'[]'::jsonb))
$$;

create or replace function public.cli_apply_sync(p_board uuid, p_member uuid, p_operation uuid, p_cards jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_receipt cli_sync_receipts%rowtype; v_item jsonb; v_old cards%rowtype; v_row cards%rowtype;
  v_id uuid; v_lane uuid; v_epic uuid; v_member uuid; v_tag text; v_tag_ids uuid[]; v_ref text;
  v_ids uuid[] := '{}'; v_result jsonb; v_fingerprint text := md5(p_cards::text);
  v_position integer; v_previous double precision; v_next double precision;
begin
  if not exists (select 1 from members m where m.id=p_member and (m.role='owner' or exists (
    select 1 from project_members pm join boards b on b.project_id=pm.project_id
    where b.id=p_board and pm.member_id=m.id and pm.role='admin'))) then
    raise exception 'Board admin access required' using errcode='42501';
  end if;
  -- Serialize CLI batches/receipts. Web card writes still use their row locks.
  perform 1 from boards where id=p_board for update;
  select * into v_receipt from cli_sync_receipts where board_id=p_board and operation_id=p_operation;
  if found then
    if v_receipt.member_id <> p_member or v_receipt.fingerprint <> v_fingerprint then
      raise exception 'Operation id reused with different content' using errcode='23514';
    end if;
    return v_receipt.result;
  end if;
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards)>1000 then
    raise exception 'Expected at most 1000 cards' using errcode='22023';
  end if;
  if (select count(*) <> count(distinct value->>'externalId') from jsonb_array_elements(p_cards)) then
    raise exception 'Duplicate card identity' using errcode='22023';
  end if;
  -- Check every identity/revision before changing any content.
  for v_item in select value from jsonb_array_elements(p_cards) order by value->>'externalId' loop
    select * into v_old from cards where board_id=p_board and external_id=v_item->>'externalId' for update;
    if v_item->>'cardId' is null then
      if found then raise exception 'Card % was concurrently created',v_item->>'externalId' using errcode='23514'; end if;
    elsif not found or v_old.id::text <> v_item->>'cardId' or
      cli_sync_revision(v_old.id) is distinct from v_item->>'revision' then
      raise exception 'Card % identity or revision changed',v_item->>'externalId' using errcode='23514';
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_cards) order by value->>'lane', (value->>'rank')::double precision nulls last, value->>'externalId' loop
    v_id := (v_item->>'cardId')::uuid;
    select * into v_old from cards where id=v_id;
    v_row := jsonb_populate_record(null::cards, v_item->'columns');
    v_lane := null; v_member := null;
    if v_item->>'lane' is not null then
      select id into v_lane from lanes where board_id=p_board and key=v_item->>'lane';
      if not found then raise exception 'Unknown lane %',v_item->>'lane' using errcode='22023'; end if;
    end if;
    insert into epics(board_id,source_name) values(p_board,v_row.epic)
      on conflict(board_id,source_name) do update set source_name=excluded.source_name returning id into v_epic;
    if v_row.assignee is not null then
      select m.id into v_member from members m join project_members pm on pm.member_id=m.id
        join boards b on b.project_id=pm.project_id where b.id=p_board and m.email=v_row.assignee::citext;
    end if;
    -- Preserve raw fractional rank unless a position or lane actually changed.
    if v_id is not null and v_old.lane_id is not distinct from v_lane and
       (v_item->>'rank')::double precision is not distinct from (cli_card_projection(v_id)->>'frontmatter.rank')::double precision then
      v_row.rank := v_old.rank;
    elsif v_item->>'rank' is null then
      select coalesce(max(rank),0)+1 into v_row.rank from cards where lane_id=v_lane;
    else
      v_position := (v_item->>'rank')::integer;
      if v_lane is null or v_position < 1 or v_position::double precision <> (v_item->>'rank')::double precision or
         v_position > (select count(*)+1 from cards where lane_id=v_lane and id is distinct from v_id) then
        raise exception 'Invalid rank position for %',v_item->>'externalId' using errcode='22023';
      end if;
      v_previous := null; v_next := null;
      if v_position > 1 then
        select rank into v_previous from cards where lane_id=v_lane and id is distinct from v_id
          order by rank,external_id offset (v_position-2) limit 1;
      end if;
      select rank into v_next from cards where lane_id=v_lane and id is distinct from v_id
        order by rank,external_id offset (v_position-1) limit 1;
      if v_previous is not null and v_next is not null and v_previous=v_next then
        raise exception 'Lane contains tied ranks; reorder it on the board before syncing' using errcode='23514';
      end if;
      v_row.rank := case when v_previous is null then coalesce(v_next,1)-1
        when v_next is null then v_previous+1 else (v_previous+v_next)/2 end;
    end if;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into cards(id,board_id,external_id,title) values(v_id,p_board,v_item->>'externalId',v_row.title);
    end if;
    update cards set title=v_row.title,status=v_row.status,epic=v_row.epic,epic_id=v_epic,area=v_row.area,
      assignee=v_row.assignee,assignee_id=v_member,raised_by=v_row.raised_by,raised_on=v_row.raised_on,
      shipped_on=v_row.shipped_on,needs=v_row.needs,summary=v_row.summary,summary_edited_at=null,
      body_md=v_row.body_md,body_edited_at=null,lane_id=v_lane,rank=v_row.rank,priority=v_row.priority,
      effort=v_row.effort,planned_start_date=v_row.planned_start_date,target_date=v_row.target_date,
      target_label=v_row.target_label,archived_at=v_row.archived_at,archived_by=v_row.archived_by,
      color=v_row.color,source_text=v_row.source_text,source_hash=v_row.source_hash,
      source_path=(v_item->>'externalId')||'.md',lane_from_source=v_item->>'lane',
      frontmatter_extra=coalesce(v_row.frontmatter_extra,'{}'::jsonb),
      audience=case when v_item->>'cardId' is null then coalesce(v_row.audience,'all') else audience end
      where id=v_id;
    v_ids := array_append(v_ids,v_id);
  end loop;
  -- Every new identity now exists, so links may reference later cards or cycles.
  for v_item in select value from jsonb_array_elements(p_cards) loop
    select id into v_id from cards where board_id=p_board and external_id=v_item->>'externalId';
    delete from card_tags where card_id=v_id;
    for v_tag in select jsonb_array_elements_text(v_item->'tags') loop
      select array_agg(t.id) into v_tag_ids from tags t join tag_groups g on g.id=t.group_id where g.board_id=p_board
        and (g.key||':'||t.key=v_tag or (position(':' in v_tag)=0 and t.key=v_tag));
      if coalesce(array_length(v_tag_ids,1),0) <> 1 then
        raise exception 'Unknown or ambiguous tag %',v_tag using errcode='22023';
      end if;
      insert into card_tags(card_id,tag_id) values(v_id,v_tag_ids[1]) on conflict do nothing;
    end loop;
    delete from card_links where from_card=v_id and kind='relates';
    for v_ref in select jsonb_array_elements_text(v_item->'relates') loop
      -- Out-of-board references remain in source_text, never silently stripped.
      insert into card_links(from_card,to_card,kind) select v_id,id,'relates' from cards
        where board_id=p_board and external_id=v_ref on conflict do nothing;
    end loop;
    insert into card_events(card_id,actor,kind,payload)
      select v_id,email::text,'imported',jsonb_build_object('source','cli-sync','operation',p_operation) from members where id=p_member;
  end loop;
  for v_item in select value from jsonb_array_elements(p_cards) loop
    if v_item->>'rank' is not null and (v_item->>'rank')::bigint is distinct from
       (select (cli_card_projection(id)->>'frontmatter.rank')::bigint from cards where board_id=p_board and external_id=v_item->>'externalId') then
      raise exception 'Rank positions conflict; refresh the plan' using errcode='23514';
    end if;
  end loop;
  update cards set sync_projection=cli_card_projection(id) where id=any(v_ids);
  select jsonb_build_object('applied',coalesce(jsonb_agg(jsonb_build_object('externalId',external_id,'cardId',id,'revision',cli_sync_revision(id))),'[]'::jsonb))
    into v_result from cards where id=any(v_ids);
  insert into cli_sync_receipts(board_id,operation_id,member_id,fingerprint,result)
    values(p_board,p_operation,p_member,v_fingerprint,v_result);
  return v_result;
end $$;

revoke all on function public.cli_card_projection(uuid) from public,anon,authenticated;
revoke all on function public.cli_sync_revision(uuid) from public,anon,authenticated;
revoke all on function public.cli_sync_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.cli_apply_sync(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cli_card_projection(uuid), public.cli_sync_revision(uuid), public.cli_sync_snapshot(uuid), public.cli_apply_sync(uuid,uuid,uuid,jsonb) to service_role;
