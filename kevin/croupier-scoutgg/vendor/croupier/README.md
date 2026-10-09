# Croupier rule engine

Unmodified files from `scout-gg/croupier`, commit `3c2b70b914d83e94db3b5cd0e965647d93ae17ae`:

- `web/shoe-game.mjs` → `shoe-game.mjs`
- `web/public/blackjack.mjs` → `public/blackjack.mjs`

One local change in `shoe-game.mjs`: `start` takes optional per-table limits (`req.limits = {min, max, sideMax}`, from the Table Studio presets in `server/studio-tables.mjs`). Without them the original caps apply (main bet at least 5, every stake at most 2000). Re-apply it when the file is replaced.

Pinned here so Emil's demo is portable and does not depend on an absolute checkout path. Do not reimplement rules in the presentation layer. Updates should replace both files from a reviewed Croupier revision and rerun table and presentation tests.

`server/table-service.mjs` supplies a separate SQLite transaction and guest session for this demo only. The original Croupier databases and production wallet are never opened.
