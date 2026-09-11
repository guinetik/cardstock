-- Filter before computing card projections/revisions. Keep vocabulary and the
-- selected live card or tombstone in the same statement snapshot.
create function public.cli_sync_card_snapshot(p_board uuid, p_external_id text)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'tagGroups', coalesce((select jsonb_agg(jsonb_build_object('key',g.key,'tags',
      coalesce((select jsonb_agg(jsonb_build_object('key',t.key) order by t.key)
        from tags t where t.group_id=g.id),'[]'::jsonb)) order by g.key)
      from tag_groups g where g.board_id=p_board),'[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('externalId',c.external_id,
      'cardId',c.id,'revision',cli_sync_revision(c.id),'source',c.source_text,
      'savedProjection',c.sync_projection,'projection',cli_card_projection(c.id)))
      from cards c where c.board_id=p_board and c.external_id=p_external_id),'[]'::jsonb)
      || coalesce((select jsonb_agg(t.snapshot || jsonb_build_object(
        'externalId',t.external_id,'cardId',t.card_id,'revision',t.revision,'deleted',true))
        from cli_card_tombstones t where t.board_id=p_board and t.external_id=p_external_id),'[]'::jsonb))
$$;

revoke all on function public.cli_sync_card_snapshot(uuid,text) from public, anon, authenticated;
grant execute on function public.cli_sync_card_snapshot(uuid,text) to service_role;
