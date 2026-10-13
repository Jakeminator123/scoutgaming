# PostgreSQL och publicerad produktdata

`storage/` är aktiv lagrings- och publiceringskod. `web/server.mjs` väljer
den när `CROUPIER_DATABASE=postgres`; SQLite-implementationerna för lokal drift
ligger huvudsakligen direkt under `web/`. Mappen är inte ett äldre BO-demo.

| Modulgrupp | Ansvar |
| --- | --- |
| `postgres-store.mjs` | Asynkron `pg`-pool, transaktioner, schemaval och kontroll av installerad speldatabas. |
| `async-*` | PostgreSQL-versioner av spelar-/BO-autentisering, partner-API, historik, chattminne och probe. |
| `studio-contract.mjs`, `studio-repository.mjs`, `studio-runtime.mjs`, `studio-game-policy.mjs` | Scope, revisioner, Studio-dokument/media och spelpolicyn som servern läser. |
| `operator-*`, `partner-branding.mjs`, `player-administration.mjs` | Operatörer, livscykel, varumärkesdata och spelaradministration. |
| `presentation-package.mjs`, `frozen-*`, `published-layer-assets.mjs` | Publicerade paket, låsta dealer-/presentationsreferenser och åtkomst till publicerade lager. |

`postgres-store.mjs` använder `croupier_game` och `croupier_auth` och kräver
en explicit spelanslutning med TLS, skild från zones-databasen.
Studio-repositoryt arbetar i `croupier_studio` med `environment_id` och
`workspace_id`. Det är avsiktliga data- och behörighetsgränser.

`studio-runtime.mjs` kopplar servern till Studio-policy och registrerad media.
Importerna från `lab/lib/` är fortfarande aktiva kontrakt, även när nya UI:n
heter `/admin` och `/lobby`. Lagrat `lane`/sammansättnings-ID, rum-ID och
publicerade paket får inte bytas ut genom en mapp- eller namnändring.

Det finns inga migrationsfiler eller databasdumpar här. Schema och migrationer
ligger i [ops/neon-game/](../../ops/neon-game/) och
[ops/neon-studio/](../../ops/neon-studio/). Följ
[CLOUD-MIGRATION.md](../../docs/CLOUD-MIGRATION.md) vid schemaändringar;
en fungerande kodimport bevisar inte att en migration är installerad.
`pg` installeras från `web/package.json`; `node_modules/` är lokala beroenden.
