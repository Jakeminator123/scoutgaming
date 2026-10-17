# Gemensam PostgreSQL-gräns

`server/postgres-store.mjs` äger produktens befintliga SQL-dialekt, de explicita
schemana `croupier_game`/`croupier_auth`, parameterbindning och en gemensam
AsyncLocalStorage-/transaktionsimplementation. Detta är den befintliga
produktfacaden, inte en generell databasplattform.

Kärnan får en pool. `assertInstalled` får schematext explicit eller en
`readProductSchema`-port; checksumma och migrationskontroll har en implementation.
Web äger pg 8.16.3, poolinställningar och originalschemats läsning i
`web/storage/postgres-store.mjs`. Studio äger sina Neon-pooler och schemaläsning.
Schemafilerna ligger kvar under `ops/`. Kärnan läser inga appfiler och skapar
inga provideranslutningar. Studio-dokumentens repository ägs fortsatt av
`packages/studio-registry`.
