-- The sheet as it was handed to us. Export is a line edit of this, never a
-- render of the row, so an untouched file comes back byte-identical.
alter table public.cards add column source_text text;
