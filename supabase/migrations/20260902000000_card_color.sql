alter table public.cards
  add column color text
  check (
    color is null
    or color in (
      'rose',
      'orange',
      'amber',
      'green',
      'cyan',
      'blue',
      'indigo',
      'violet',
      'pink'
    )
  );

comment on column public.cards.color is
  'Optional board-card tint mirrored from frontmatter; null keeps the neutral surface.';
