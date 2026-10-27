# Spelserver och spelklient

`services/game/` äger den auktoritativa Node-spelservern för blackjack och
roulette: sessioner, historik, kort, shoe, saldo, utbetalningar och spelklient.
Entrypunkten är [server.mjs](server.mjs); molntjänsten är Render `croupier-v2`.
Vercels frontend finns i [apps/web](../../apps/web/README.md), talingressen i
`apps/speech/` och Admin/Partner/Lobby i [apps/studio](../../apps/studio/README.md).

| Del | Ansvar |
| --- | --- |
| [public/](public/README.md) | Spelklient, kortprojektion och appägda webbresurser. |
| [storage/](storage/README.md) | Appägda PostgreSQL-pooler, läsarportar och publicerade presentationspaket. |
| `games/roulette/` | Rouletteregler, serverkommandon, åtkomst och lagring. |
| `generated-speech*`, `dealer-speech*`, `openclaw-chat.mjs` | Game-adaptrar för dealerchatt, tal och registrerade klipp. |
| `player-*`, `native-table.mjs`, `shoe-game.mjs` | Spelaridentitet, historik och serverägt spel. |

## Gemensamma ägare och produktkontrakt

Gemensam auth- och rollpolicy finns i `packages/studio-access`. Register,
media- och dokumentkontrakt ägs av `packages/studio-registry`; transaktionskärnor
av `packages/storage` och operatörsregler av `packages/operators`.
Game behåller sina pooler, miljöval och läsarportar. Studio behåller sina
HTTP-adaptrar, skrivlås och appkomposition.

`packages/presentation` äger delade presentationskontrakt, uppspelning,
urval och genererat tals serverkärnor. `packages/navigation` äger gemensamma
navigationskontrakt och `packages/shared` bland annat kommandosignering och
den rena shoe-regeln. Shuffle, kort, wallet och utbetalningar förblir gameägda.

`packages/director` äger Director-kontrakt och delade regler. Game-adaptern
`director-settings.mjs` väljer samma miljöfiler och historiska datarot som
före flytten. OpenClaw-tjänsten behåller HTTP, Gateway och signering.
Dess lokala fler-tjänstbootstrap använder avsiktligt game-ägda
`partner-api.mjs#installPartnerApi`; den kopplingen gör inte partner-API:t
till ett neutralt bibliotek.

Taladaptrarna återanvänder också den befintliga gemensamma gatewaykoden under
`services/astrid-gpu-worker/gateway/` för providerkällor, workerbindning och
strömtransport. Det är ett uttryckligt beroende; flytten skapar inget nytt
bibliotek eller någon ny tjänst.

Publika `/admin`, `/partner`, `/lobby`, `/play/blackjack`, `/play/roulette`
och `/studio`-kontrakt ändras inte av källflytten. Befintliga kompatibilitets-
URL:er, protokollvärdet `owner:web`, medie-ID:n och proveniens med `web/public/`
behålls. En fysisk källsökväg är inte en ny medieidentitet eller ett nytt rum.
`lab-speech-bridge.mjs` är fortfarande en del av spelklientens talväg.

## Drift, start och data

Vercel äger webb, Admin/Lobby/Partner/Studio och talingress. Render äger
spelmotorn. Neon/PostgreSQL äger spel-, konto-, Studio- och publiceringsdata;
Blob äger mediebytes. Produktionens `CROUPIER_DATABASE=postgres`,
`CROUPIER_STUDIO_NEON_POLICY=1` och `CROUPIER_MEDIA_STORAGE=blob` innebär
ingen fallback till lokala authoringfiler eller SQLite vid molnfel.

Öppna produkten via [apps/studio/start.mjs](../../apps/studio/start.mjs),
från Codex med `--no-open`. Det lokala `--offline`-fixturparet är pensionerat 27 oktober 2026.
Följ [användarguiden](../../apps/studio/docs/README.md) och [AGENTS.md](../../AGENTS.md).
`services/game/package.json` anger Node `>=22.16.0`; produktionscontainern
använder Node 24. Installerade beroenden hör till `services/game/node_modules/`.

Den historiska standardroten för lokal SQLite är fortfarande Git-ignorerade
`web/data/`, eller den uttryckliga `CROUPIER_DATA_DIR`. Källflytten flyttar
inte privata data, originalmedia eller gamla dependencyinstallationer.
De lokala Lissabon-gästprofilerna (`lissabon-profiles.mjs`, `/api/lissabon/profiles`,
`CROUPIER_LISSABON_PROFILES`) togs bort 22 oktober 2026; lanevärdet
`lissabon-stream-lane` i `CROUPIER_STREAM_LANE` är kvar som anslutnings-ID.

Aktuell drift och schemaansvar finns i [CLOUD-MIGRATION.md](../../docs/CLOUD-MIGRATION.md).
Återställningsgränser finns i [ENVIRONMENT-RESTORATION.md](../../docs/ENVIRONMENT-RESTORATION.md)
och tekniska format i [LOCAL-PRESENTATION-RUNTIME.md](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
