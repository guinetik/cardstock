-- Let the board page hear about changes as they happen.
-- Realtime applies the tables' RLS `select` side, so members only receive
-- rows for the projects they belong to.
alter publication supabase_realtime add table public.cards, public.lanes, public.card_tags;
