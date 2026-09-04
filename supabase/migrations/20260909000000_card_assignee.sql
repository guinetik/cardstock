-- One assignee per card, drawn from the project roster.
-- Spec: docs/superpowers/specs/2026-09-03-card-assignee-design.md
--
-- Two columns, exactly as `epic_id` / `epic`: the FK is the live relation the
-- app joins on, the text is what the tracker file says. A file may name an
-- email that belongs to nobody yet — import keeps the text and leaves the FK
-- null rather than dropping the line, because the file is the source of truth.
--
-- There is deliberately NO constraint tying the assignee to `project_members`:
-- import must be able to carry an off-roster email. The roster rule is enforced
-- in `assignCard`, the only path a person takes interactively.
alter table public.cards
  add column assignee_id uuid references public.members(id) on delete set null,
  add column assignee    citext;

create index cards_board_assignee on public.cards (board_id, assignee_id);
