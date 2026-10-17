# Spelserver och spelklient

`web/` är den aktiva Node-spelservern för blackjack och roulette, med
spelarnas sessioner, historik, serverägda kort/saldon och dealeruppspelning.
Entrypunkten är [server.mjs](server.mjs); molntjänsten är Render `croupier-v2`.
Vercels frontend ligger i [apps/web](../apps/web/README.md).

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

Studio-autentisering, gemensam roll-/åtgärdspolicy och validering av miljö/workspace
finns i [packages/studio-access](../packages/studio-access/), med kompatibla
återexporter från de äldre sökvägarna. Inloggningskontrollen kan användas av både
spelservern och Studio utan att importera `lab/` eller OpenClaw.
Den gemensamma rollnormaliseringen finns i samma paket:
`packages/studio-access/account-role.mjs`. Spelservern och Studios
kontotjänster använder samma regler.

Spelservern använder fortfarande `lab/lib/` för registrerad media,
projekt-/publiceringskontrakt, signerade Studio-kommandon och provspelning.
OpenClaw används fortfarande för bland annat Astrids observationer och
inställningar. Mappnamnen är därför inte ett skäl att ta bort de kopplingarna.
`lab-speech-bridge.mjs` ingår också i spelklientens talväg.

## Produktionsdrift

| Del | Aktivt ansvar |
| --- | --- |
| Vercel, team och projekt `scoutgaming` (Scout Gaming) | Webb, Admin, lobby och Studio med befintligt `/studio`-basePath. |
| Render `croupier-v2` | Spelmotorn; auktoritet för kort, saldo, rundor och live-spel. |
| Neon/PostgreSQL | Spel- och kontodata i `croupier_game`/`croupier_auth`, Studio-policy, revisioner och mediaregister i `croupier_studio`. Zondata har en separat databas. |
| Privat Blob | Mediefiler och färdiga talpaket; identiteter och metadata finns i Neon. |

Vercelpubliceringen ersätter alltså inte spelmotorn eller databasen. Produktionen
kör med `CROUPIER_DATABASE=postgres`, `CROUPIER_STUDIO_NEON_POLICY=1` och
`CROUPIER_MEDIA_STORAGE=blob`. SQLite-koden stöder lokal/offline-körning och
tester; Director/Gateway har även separat hjälptillstånd. SQLite är inte en
reservdatabas vid fel i produktionens PostgreSQL. Produktens tidigare Render-disk
är avvecklad. Ansvar och återställningsgränser beskrivs i
[CLOUD-MIGRATION.md](../docs/CLOUD-MIGRATION.md#ytor-och-datalagring--produktion-och-nya-qa)
och [ENVIRONMENT-RESTORATION.md](../docs/ENVIRONMENT-RESTORATION.md).

`studio-game-commands.mjs` hämtar det rena signeringskontraktet från
`packages/shared/studio-game-command.mjs`. Spelservern behöver därför inte
importera Studios HTTP-adapter `lab/lib/studio-game-authority.mjs` för att
kontrollera en kommandosignatur. Den gamla signeringsexporten finns kvar där
för kompatibilitet. Befintlig behörighetspolicy och lagringskontraktet i
`packages/studio-registry/server/document-contract.mjs` används fortfarande.

OpenClaw-kopplingarna är aktiva: `openclaw-chat.mjs` använder minnes-/
kameraformat, inställningar och produktens taltransport; `presentation-api.mjs`
använder Director-beslut; `probe-runtime.mjs` och `player-probe-store.mjs`
använder provtal respektive minnesprojektion. `server.mjs` använder också
kameranormalisering och `native-p6-qa-hook.mjs` talets envelope-kontrakt.
`storage/studio-contract.mjs` validerar fortfarande social policy via OpenClaw.
De gemensamma kontrakten kommer från `packages/director/`;
`director-settings.mjs` äger spelserverns miljöfilläsning med samma filordning,
alias och datarot. Director-tjänsten behåller HTTP, Gateway och signering.
Astrids talväg och den befintliga sociala policyn är oförändrade.

`lissabon-profiles.mjs` är en avgränsad lokal profilfunktion: SQLite, gästdemo,
`HOST=127.0.0.1`, inga spelarkonton och flaggan `lissabon-stream-lane`.
Den aktiveras inte i PostgreSQL-läget. Lissabon är inget nytt produktområde;
flagga, profilcookie och lagrade ID:n är kvarvarande kompatibilitetsdetaljer.

## Start och data

Öppna produkten via [lab/start.mjs](../lab/start.mjs), från Codex med
`--no-open` för att bara skriva adressen. Endast `--offline --no-open`
startar ett isolerat, tillfälligt serverpar utan externa tjänster.
Startalternativ finns i [användarguiden](../lab/docs/README.md).
Följ [AGENTS.md](../AGENTS.md) om en enda lokal fixtursession.
`web/package.json` anger Node `>=22.16.0` och PostgreSQL-klienten `pg`.
`web/node_modules/` är installerade beroenden, inte projektkod.

Lokala SQLite-databaser ligger i Git-ignorerade `web/data/` eller den uttryckliga
`CROUPIER_DATA_DIR`. Den mappen innehåller tillstånd, inte disponibel demokod;
läs eller radera den inte som en del av vanlig mappstädning.
Tekniska kontrakt finns i [LOCAL-PRESENTATION-RUNTIME.md](../docs/LOCAL-PRESENTATION-RUNTIME.md).

Medieruntime och videoregister komponerar spelserverns Blob- och
läsarportar i `storage/studio-media-runtime.mjs` respektive
`storage/video-registry.mjs`. De delar kärnor med Studio och bevarar de
befintliga preview-URL:erna. Lokalt projektläsande använder
`packages/studio-registry/server/local-project-reader.mjs`, utan Studios
skrivlås, historik eller arkiveringskod. Neonkonfigurationen får fortfarande
inte falla tillbaka till lokala authoringfiler. Presentation/idle och
genererat tal har separata återstående ägarsteg.
