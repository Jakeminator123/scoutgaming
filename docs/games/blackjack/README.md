# Blackjack

Produktens spel i drift: Johns Bet med dealern PAOW. Spelmotorn (`services/game`, Render `croupier-v3`) äger sko, kort, saldo och utbetalningar; presentationen påverkar dem aldrig. [Gemensamma källregler](../README.md) och [klipp och format](../KLIPP-OCH-FORMAT.md) gäller. Dealerbankens poser, talfack och koordinater står i [DEALERBANK](DEALERBANK.md).

## Regler

- Åtta kortlekar (416 kort), ett brännkort och cut efter 312 dragna kort. Ny blandning sker inför nästa runda, aldrig mitt i en runda. Servern behåller kortordning, brännkort och dolt hålkort.
- S17, amerikanskt hålkort med peek, blackjack 3:2, försäkring 2:1, dubblering på två kort och efter split, högst fyra händer per plats. Delade ess får ett kort vardera. Ingen surrender. 21 efter split är vanlig 21.
- Sidoinsatser (nettovinst): Perfect Pairs 25:1 perfekt, 12:1 samma färg, 6:1 blandad färg. 21+3 100:1 suited trips, 40:1 straight flush, 30:1 trips, 10:1 straight, 5:1 flush.
- Sju spelarplatser (box 0–6). Huvudinsats minst 5 om platsen används, högst 2 000 per insatsfält, sidoinsats bara med huvudinsats.

## Kodkarta

| Ansvar | Källa |
| --- | --- |
| Regler, händer, split och sidoinsatser | [public/blackjack.mjs](../../../services/game/public/blackjack.mjs) |
| Ren regelkärna utan I/O | [games/blackjack/core.mjs](../../../services/game/games/blackjack/core.mjs) |
| Beständig sko, versionskontroll, kommandokvitto | [shoe-game.mjs](../../../services/game/shoe-game.mjs) |
| PostgreSQL-transaktion för sko, saldo och presentationskvitto | [postgres-native-table.mjs](../../../services/game/postgres-native-table.mjs) |
| Delat bord: koordinator, portar, PostgreSQL | [games/blackjack/table/](../../../services/game/games/blackjack/table/) |
| Autentisering och `POST /api/table` | [server.mjs](../../../services/game/server.mjs) |
| Spelhändelser till presentation | [partner-presentation.mjs](../../../services/game/partner-presentation.mjs) |
| Fryst rum, speltyp och bolag | [presentation-room.mjs](../../../packages/presentation/contracts/presentation-room.mjs) |
| Klippurval, vila och skobyten | [packages/presentation/runtime](../../../packages/presentation/runtime/) |
| Kortlagrets layout | [card-presentation](../../../services/game/public/card-presentation/README.md) |
| Forge-mål och geometriprofil | [dealer-forge-catalog.mjs](../../../apps/studio/lib/dealer-forge-catalog.mjs) |

## Kommandon och rum

Spelingången är `/play/blackjack` (eller `/game?game=blackjack`) med bolag, rum och vid behov dealer. Kommandona är `state`, `start`, `act`, `insurance` och `collect`. Skrivkommandon kräver aktuell `version` och `requestId`. Exakt återförsök av senaste kommando ger det sparade svaret; samma `requestId` med annan indata avvisas. Det är ingen obegränsad historisk idempotens. Sko, saldo och bokföring skrivs atomärt, och presentationshändelser kan inte skapa nya drag efter commit.

Ett rum utan uttryckligt `game` läses som blackjack. Rummet kopplar bolag, `presentationLaneId` och `gameLaneId`; dealer, bord och bakgrund kommer från bolagets publicerade paket.

## Regelkärna och delat bord

`core.mjs` (`newGame`, `step`) returnerar `{state, events, publicEvents, effects, view}` utan SQL, nätverk, klocka eller saldo. Slump kommer bara från den injicerade `random`; produktionsadaptern är [secure-random.mjs](../../../services/game/games/blackjack/secure-random.mjs). Insats, försäkring, dubblering, split och utbetalning returneras som `effects` per box. Finansieringen är serverns `funding = {available, reserved}`: rundstart och försäkring prövas mot reservationer, dubblering och split mot `available` (saldo minus öppna reservationer).

Delat bord (`table/coordinator.mjs`) samordnar platser, insatsfönster, turer, deadlines, återanslutning och kommandokvitton kring `step`. Lagring går via SQL-fria portar i `table/ports.mjs` och en arbetsenhet `runLocked`; tidsövergångar är ticks som en scheduler kör. Presentationen skrivs till en outbox i samma transaktion och levereras efter commit; mottagaren avvisar äldre versioner (`createPresentationGate`). I drift kopplas koordinatorn till PostgreSQL genom `table/postgres-runtime.mjs`, `postgres-store.mjs` och `postgres-wallet.mjs`. Flaggan `CROUPIER_SHARED_TABLE_ENABLED` styr delat bord: på i stagingen, av i produktionen tills O03 (se [ENVIRONMENT-VARIABLES](../../ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling)).

## Verifiering och gränser

Regressioner: [shoe-game](../../../test/shoe-game.mjs), [split-rules](../../../test/split-rules.mjs), [fuzz-blackjack](../../../test/fuzz-blackjack.mjs), [table-http](../../../test/table-http.mjs), [postgres-native-table](../../../test/postgres-native-table.mjs), [blackjack-table](../../../test/blackjack-table.mjs) och [local-presentation](../../../test/local-presentation.mjs). Databas- och webbläsaracceptans körs i CI eller isolerad staging, aldrig mot riktiga spelare.

Inga real-money- eller certifieringspåståenden följer av denna guide. Äldre dealerfamiljer kan ha andra kortmått (Astrids 63×85 i liggande plan); byt dem inte globalt till PAOW:s 79×106.
