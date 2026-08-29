do $$
declare
  definition text;
begin
  select pg_get_constraintdef(oid)
    into definition
    from pg_constraint
   where conrelid = 'public.cards'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%color%';

  if definition is null then
    raise exception 'cards.color check constraint is missing';
  end if;

  if definition not like '%rose%'
    or definition not like '%IS NULL%'
    or definition not like '%orange%'
    or definition not like '%amber%'
    or definition not like '%green%'
    or definition not like '%cyan%'
    or definition not like '%blue%'
    or definition not like '%indigo%'
    or definition not like '%violet%'
    or definition not like '%pink%'
  then
    raise exception 'cards.color check constraint is incomplete: %', definition;
  end if;
end
$$;
