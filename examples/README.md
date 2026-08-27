# Example tracker

Ten items in the frontmatter shape the ETL expects (see `docs/frontmatter.schema.json`). Import them into the demo board:

```sh
bun run db:reset
bun run db:seed-members
bun run etl:import --project demo --board backlog --source examples/tracker
```

Tags use the generic vocabulary: `area:<x>` or `cross-cutting`, `step-N` or a surface (`home`, `settings`, `login`, `email`), one kind (`bug` · `enhancement` · `nice-to-have` · `new-feature` · `question` · `internal`), objectives. Lane, rank, priority, effort and target are what `etl:export` writes back.
