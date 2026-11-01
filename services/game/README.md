# Spelbackend, regelkärna och spelklient

`services/game/` är spelbackendens samlade kod: regelkärna, sessioner, historik, saldo, delat bord, spelklient och talintegration. Render-tjänstens namn `croupier-v3` är en driftidentitet, inte ett påstående att all kod här är spelregler. Entrypunkten är [server.mjs](server.mjs); i drift kör den på Render `croupier-v3` bakom gatewayn i [ops/cloud](../../ops/cloud/README.md). Spelskalet finns i [apps/web](../../apps/web/README.md), talingressen i `apps/speech/` och Admin, partnerportal och lobby i [apps/studio](../../apps/studio/README.md).

| Del | Ansvar |
| --- | --- |
| [public/](public/README.md) | Spelklient, kortprojektion och appägda webbresurser |
| [storage/](storage/README.md) | PostgreSQL-pooler, läsarportar och publicerade presentationspaket |
| `games/roulette/` | Rouletteregler, kommandon, åtkomst och lagring |
| `generated-speech*`, `dealer-speech*`, `moving-speech-*`, `openclaw-chat.mjs` | Dealerchatt, tal och registrerade klipp |
| `games/blackjack/round.mjs`, `core.mjs` | Gemensamma handregler och ren regelkärna |
| `games/blackjack/table/` | Platser, kommandon, samtidighet och plånboks-/lagringsadaptrar kring kärnan |
| `player-*`, `postgres-native-table.mjs`, `shoe-game.mjs`, `preview-table.mjs` | Spelaridentitet, historik och kvarvarande native-/provspelsadaptrar |

Blackjack har en gemensam handregelklass men ännu olika kommando- och lagringsadaptrar. Nativeadaptern behövs bland annat av Admins Provspel och sparade rundor; den får inte raderas enbart för att det delade bordet är påslaget. [Blackjackguiden](../../docs/games/blackjack/README.md) beskriver gränsen, testerna och villkoren för fortsatt avveckling.

Spelarsessioner från den pensionerade BO-överlämningen (`bo:`) godtas inte längre; de kräver en ny inloggning. Aktuella konto-, lokala och partnerinloggningar behåller sina behörighetskontroller. [administrator-session.mjs](administrator-session.mjs) läser den aktuella administratörens signerade session för gemensam utloggning; den skapar inga spelarsessioner. Partnerportalens aktiva `lab_sessions` är en separat konsument och påverkas inte av denna avveckling.

## Vad som får ändras

Spelkärnan bestämmer regler, slump, sko, kort och utfall. Presentation, navigation, sittperspektiv, insatsrutornas UI, rumspublicering och tal är andra ansvar och får förbättras eller ersättas. En befintlig adapter får också avvecklas när dess aktiva anrop har ersatts. Mappnamnet är inget ändringsförbud. Behörighet, atomisk bokföring och serverägda utfall ska fortfarande fungera efter ändringen.

TTS och GPU-arbete utförs utanför regelkärnan. Vissa taladaptrar delar fortfarande Render-process med spelet; en framtida tjänsteuppdelning kan isolera start- och driftfel utan att ändra blackjackreglerna. Jakob-2:s läppsynk är pausad enligt senaste beslut, oberoende av denna kodgräns.

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
- Genererat tal kräver Neon-journal för GPU-sessioner, strömförfrågningar och fullfilsjobb; fullfilernas ljud och video går via den privata Blob-adaptern. Det finns ingen valbar diskjournal eller separat operatörs-QA-reservation. Isolerade prov använder samma journal med syntetiska SQL-/providerportar.
- `CROUPIER_STREAM_LANE=lissabon-stream-lane` är ett anslutnings-ID som `ops/cloud/config.mjs` sätter för spelprocessen; det är ingen panelpost. Lissabon-gästprofilerna är borttagna.
- Miljövariabler: [ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md#render-croupier-v3-spelmotorn). Deploy och kontroller: [RENDER-V3](../../ops/cloud/RENDER-V3.md). Driftkarta och schemaordning: [CLOUD-MIGRATION](../../docs/CLOUD-MIGRATION.md). Backup och återgång: [ENVIRONMENT-RESTORATION](../../docs/ENVIRONMENT-RESTORATION.md). Tekniska format: [LOCAL-PRESENTATION-RUNTIME](../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## Köra och testa

- `services/game/package.json` kräver Node `>=24`; containern kör Node 24. Installera med `npm ci` i `services/game`.
- Enda devDependency är `@electric-sql/pglite` (PostgreSQL i WASM) för modultester via `test/fixtures/pglite-pool.mjs`, som installerar schemat från `ops/neon-game/`. PGlite har en session och bevisar inte låsning mellan anslutningar; det gör CI:s PostgreSQL. Containern installerar med `--omit=dev`.
- Motorn över HTTP mot riktig PostgreSQL: `node tools/run-engine-qa.mjs --postgres-bin <bin>`; sviten `sh .githooks/pre-commit-full engine`.
- Produkten öppnas via den publicerade lobbyn (`node apps/studio/start.mjs --no-open` skriver adressen). Det finns ingen lokal serverstart av produkten.
