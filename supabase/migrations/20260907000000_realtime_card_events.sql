-- Card events feed browser notifications: the board page listens for inserts
-- and tells a member what a teammate just did. RLS's select side scopes
-- delivery to project members, same as the board doorbell tables.
alter publication supabase_realtime add table public.card_events;

-- 'commented' was never in the kind check, so addCardComment's event insert
-- has been failing silently since comments shipped. Admit it.
alter table public.card_events drop constraint card_events_kind_check;
alter table public.card_events add constraint card_events_kind_check
  check (kind in ('moved','edited','archived','restored','imported','created','commented'));
