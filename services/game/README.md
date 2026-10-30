# Spelmotorn och spelklienten

`services/game/` är spelmotorn för blackjack och roulette: sessioner, historik, kort, sko, saldo, utbetalningar, delat bord och spelklienten. Entrypunkten är [server.mjs](server.mjs); i drift kör den på Render `croupier-v3` bakom gatewayn i [ops/cloud](../../ops/cloud/README.md). Spelskalet finns i [apps/web](../../apps/web/README.md), talingressen i `apps/speech/` och Admin, partnerportal och lobby i [apps/studio](../../apps/studio/README.md).

| Del | Ansvar |
| --- | --- |
| [public/](public/README.md) | Spelklient, kortprojektion och appägda webbresurser |
| [storage/](storage/README.md) | PostgreSQL-pooler, läsarportar och publicerade presentationspaket |
| `games/roulette/` | Rouletteregler, kommandon, åtkomst och lagring |
| `generated-speech*`, `dealer-speech*`, `moving-speech-*`, `openclaw-chat.mjs` | Dealerchatt, tal och registrerade klipp |
| `games/blackjack/round.mjs`, `core.mjs`, `table/` | Gemensamma handregler och V3:s delade bord |
| `player-*`, `postgres-native-table.mjs`, `shoe-game.mjs`, `preview-table.mjs` | Spelaridentitet, historik och kvarvarande native-/provspelsadaptrar |

Blackjack har en gemensam handregelklass men ännu olika kommando- och lagringsadaptrar. Nativeadaptern behövs bland annat av Admins Provspel och sparade rundor; den får inte raderas enbart för att det delade bordet är påslaget. [Blackjackguiden](../../docs/games/blackjack/README.md) beskriver gränsen, testerna och villkoren för fortsatt avveckling.

## Delade paket

- `packages/studio-access`: auth- och rollpolicy.
- `packages/studio-registry`: register-, medie- och dokumentkontrakt; `packages/storage`: transaktionskärnor; `packages/operators`: regler för bolag (operatörer).
- `packages/presentation`: presentationskontrakt, uppspelning, urval och genererat tals serverkärnor.
- `packages/navigation`: navigationskontrakt; `packages/shared`: bland annat kommandosignering och den rena sko-regeln.
- `packages/director`: Director-kontrakt; game-adaptern `director-settings.mjs` väljer miljöfiler och datarot.
- `services/astrid-gpu-worker/gateway/`: talreläets providerkällor, workerbindning och strömtransport.

Spelmotorn behåller sina pooler, miljöval och läsarportar. Blandning, kort, plånbok och utbetalningar ägs alltid här. Publika vägar (`/admin`, `/partner`, `/lobby`, `/play/blackjack`, `/play/roulette`, `/studio`), protokollvärdet `owner:web` och medie-ID:n med proveniens `web/public/` är stabila kontrakt.

## Drift och data

- Neon äger spel-, konto-, Admin- och publiceringsdata; Blob äger mediebytes. Motorn kör bara PostgreSQL (ingen variabel väljer databas), kör alltid med Neon som Studio-register och privat Blob (fast i koden, ingen variabel väljer dem) och har ingen SQLite- eller diskreserv; satt `CROUPIER_DATA_DIR` stoppar starten.
- `CROUPIER_STREAM_LANE=lissabon-stream-lane` är ett anslutnings-ID som `ops/cloud/config.mjs` sätter för spelprocessen; det är ingen panelpost. Lissabon-gästprofilerna är borttagna.
- Miljövariabler: [ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md#render-croupier-v3-spelmotorn). Deploy och kontroller: [RENDER-V3](../../ops/cloud/RENDER-V3.md). Driftkarta och schemaordning: [CLOUD-MIGRATION](../../docs/CLOUD-MIGRATION.md). Backup och återgång: [ENVIRONMENT-RESTORATION](../../docs/ENVIRONMENT-RESTORATION.md). Tekniska format: [LOCAL-PRESENTATION-RUNTIME](../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## Köra och testa

- `services/game/package.json` kräver Node `>=22.16.0`; containern kör Node 24. Installera med `npm ci` i `services/game`.
- Enda devDependency är `@electric-sql/pglite` (PostgreSQL i WASM) för modultester via `test/fixtures/pglite-pool.mjs`, som installerar schemat från `ops/neon-game/`. PGlite har en session och bevisar inte låsning mellan anslutningar; det gör CI:s PostgreSQL. Containern installerar med `--omit=dev`.
- Motorn över HTTP mot riktig PostgreSQL: `node tools/run-engine-qa.mjs --postgres-bin <bin>`; sviten `sh .githooks/pre-commit-full engine`.
- Produkten öppnas via den publicerade lobbyn (`node apps/studio/start.mjs --no-open` skriver adressen). Det finns ingen lokal serverstart av produkten.
