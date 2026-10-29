# PostgreSQL och publicerad produktdata

`storage/` är aktiv lagrings- och publiceringskod. `services/game/server.mjs` kör
bara PostgreSQL och laddar modulerna här statiskt; de synkrona
SQLite-tvillingarna togs bort 27 oktober 2026. Mappen är inte ett äldre BO-demo.

| Modulgrupp | Ansvar |
| --- | --- |
| `postgres-store.mjs` | Appägd `pg`-pool och schemaläsning; SQL-/transaktionskärnan finns i `packages/storage/server`. |
| `async-*` | Spelar-/BO-autentisering, partner-API, historik, chattminne och probe. |
| `studio-contract.mjs`, `studio-repository.mjs`, `studio-runtime.mjs` | Appkomposition för dokument/registret och Render-start; sparad spelpolicy finns i `packages/presentation/server/saved-game-policy.mjs`. |
| `operator-package-reader.mjs`, `player-administration.mjs` | Appägda läsare och spelaradministration; operatörsstore, lifecycle och branding finns i `packages/operators`. |
| `presentation-package.mjs`, `frozen-*`, `published-layer-assets.mjs` | Publicerade paket, låsta dealer-/presentationsreferenser och åtkomst till publicerade lager. |

`postgres-store.mjs` använder `croupier_game` och `croupier_auth` och kräver
en explicit spelanslutning med TLS, skild från zones-databasen.
Studio-repositoryt arbetar i `croupier_studio` med `environment_id` och
`workspace_id`. Det är avsiktliga data- och behörighetsgränser.

`studio-runtime.mjs` kopplar servern till Studio-policy och registrerad media.
Gemensamma register- och dokumentkontrakt finns i `packages/studio-registry`;
SQL-kärnor finns i `packages/storage` och publiceringsregler i `packages/presentation/server`. Lagrat `lane`/sammansättnings-ID, rum-ID och
publicerade paket får inte bytas ut genom en mapp- eller namnändring.

Det finns inga migrationsfiler eller databasdumpar här. Schema och migrationer
ligger i [ops/neon-game/](../../../ops/neon-game/) och
[ops/neon-studio/](../../../ops/neon-studio/). Följ
[CLOUD-MIGRATION.md](../../../docs/CLOUD-MIGRATION.md) vid schemaändringar;
en fungerande kodimport bevisar inte att en migration är installerad.
`pg` installeras från `services/game/package.json`; `node_modules/` är lokala beroenden.
