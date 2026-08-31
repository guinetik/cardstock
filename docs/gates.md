# Board gates

A gate is a named milestone for one board: a set of tracker statuses and/or
lanes. First match wins. The timeline labels both words: Assess (calendar
health) and Gate (process). Hover either for the longer explanation. Pulse
(Built or Shipped) fills a timeline column.

Edit them on the project page, Gates section. Owners and project admins.
Saving writes `boards.settings.gates`. Until you save, the board behaves as
Built (`built` / `handed` plus `kind=built` lanes) then Shipped (`shipped` /
`done` plus `kind=done` lanes), with Shipped first.

New lanes do not join a saved gate until you tick them. Markdown files do not
carry a gate key.
