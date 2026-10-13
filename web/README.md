# Spelserver och spelklient

`web/` är den aktiva Node-spelservern för blackjack och roulette, med
spelarnas sessioner, historik, serverägda kort/saldon och dealeruppspelning.
Entrypunkten är [server.mjs](server.mjs); molntjänsten är Render `croupier-v2`.
Vercels frontend ligger i [apps/croupier-frontend](../apps/croupier-frontend/README.md).

| Del | Ansvar |
| --- | --- |
| [public/](public/README.md) | Spelklient, presentation, kortprojektion och webbresurser. |
| [storage/](storage/README.md) | PostgreSQL, operatörsdata och publicerade presentationspaket. |
| `games/roulette/` | Rouletteregler, serverkommandon, åtkomst och lagring. |
| `generated-speech*`, `dealer-speech*`, `openclaw-chat.mjs` | Dealerchatt, talgenerering och referens till registrerade klipp. |
| `player-*`, `native-table.mjs`, `shoe-game.mjs` | Spelaridentitet, historik och serverägt spel. |

## Produkt och kompatibilitet

Den nya backofficeytan heter `/admin` och den nya lobbyn `/lobby`.
Övergången från `/control`, `/play` och `/game` är fortfarande pågående.
Spelmotor, autentisering och fungerande äldre länkar ska behållas under den.

`server.mjs` använder fortfarande `lab/lib/` för Studio-policy, autentisering,
registrerad media och provspelning. Mappnamnet är därför inte ett skäl att
ta bort den kopplingen. `lab-speech-bridge.mjs` ingår också i spelklientens talväg.

`studio-game-commands.mjs` hämtar det rena signeringskontraktet från
`packages/shared/studio-game-command.mjs`. Spelservern behöver därför inte
importera Studios HTTP-adapter `lab/lib/studio-game-authority.mjs` för att
kontrollera en kommandosignatur. Den gamla signeringsexporten finns kvar där
för kompatibilitet. Befintlig behörighetspolicy och lagringskontraktet i
`web/storage/studio-contract.mjs` används fortfarande.

OpenClaw-kopplingarna är aktiva: `openclaw-chat.mjs` använder minnes-/
kameraformat, inställningar och produktens taltransport; `presentation-api.mjs`
använder Director-beslut; `probe-runtime.mjs` och `player-probe-store.mjs`
använder provtal respektive minnesprojektion. `server.mjs` använder också
kameranormalisering och `native-p6-qa-hook.mjs` talets envelope-kontrakt.
`storage/studio-contract.mjs` validerar fortfarande social policy via OpenClaw.
Dessa importer från `open-claw/lab/src/` är kvar, liksom Astrids talväg.

`lissabon-profiles.mjs` är en avgränsad lokal profilfunktion: SQLite, gästdemo,
`HOST=127.0.0.1`, inga spelarkonton och flaggan `lissabon-stream-lane`.
Den aktiveras inte i PostgreSQL-läget. Lissabon är inget nytt produktområde;
flagga, profilcookie och lagrade ID:n är kvarvarande kompatibilitetsdetaljer.

## Start och data

Starta det lokala serverparet via [lab/start.mjs](../lab/start.mjs), från
Codex med `--no-open`. Följ [AGENTS.md](../AGENTS.md) om en enda lokal session.
`web/package.json` anger Node `>=22.16.0` och PostgreSQL-klienten `pg`.
`web/node_modules/` är installerade beroenden, inte projektkod.

Lokala SQLite-databaser ligger i Git-ignorerade `web/data/` eller den uttryckliga
`CROUPIER_DATA_DIR`. Den mappen innehåller tillstånd, inte disponibel demokod;
läs eller radera den inte som en del av vanlig mappstädning.
Tekniska kontrakt finns i [LOCAL-PRESENTATION-RUNTIME.md](../docs/LOCAL-PRESENTATION-RUNTIME.md).
