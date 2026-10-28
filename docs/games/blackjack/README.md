# Blackjack

Produktens spel i drift: Johns Bet med dealern PAOW. Spelmotorn (`services/game`, Render `croupier-v3`) äger sko, kort, saldo och utbetalningar; presentationen påverkar dem aldrig. [Gemensamma källregler](../README.md) och [klipp och format](../KLIPP-OCH-FORMAT.md) gäller. Dealerbankens poser, talfack och koordinater står i [DEALERBANK](DEALERBANK.md).

## Regler

- Åtta kortlekar (416 kort), ett brännkort och cut efter 312 dragna kort. Ny blandning sker inför nästa runda, aldrig mitt i en runda. Servern behåller kortordning, brännkort och dolt hålkort.
- S17, amerikanskt hålkort med peek, blackjack 3:2, försäkring 2:1, dubblering på två kort och efter split, högst fyra händer per plats. Delade ess får ett kort vardera. Ingen surrender. 21 efter split är vanlig 21.
- Sidoinsatser (nettovinst): Perfect Pairs 25:1 perfekt, 12:1 samma färg, 6:1 blandad färg. 21+3 100:1 suited trips, 40:1 straight flush, 30:1 trips, 10:1 straight, 5:1 flush.
- Sju spelarplatser (box 0–6). Det delade bordets insatsgränser kommer från rummets frysta spelkonfiguration. Den kvarvarande nativeadaptern har minst 5 och högst 2 000 per insatsfält. Sidoinsats kräver huvudinsats i båda fallen.

## Kodkarta

| Ansvar | Källa |
| --- | --- |
| Gemensamma handregler, split, försäkring och utbetalningar | [games/blackjack/round.mjs](../../../services/game/games/blackjack/round.mjs) |
| V3:s rena regelkärna, explicit slump, skobevis och ekonomiska effekter | [games/blackjack/core.mjs](../../../services/game/games/blackjack/core.mjs) |
| Delat bord: koordinator, portar, PostgreSQL | [games/blackjack/table/](../../../services/game/games/blackjack/table/) |
| Delade rummets kommandon över HTTP | [shared-room-http.mjs](../../../services/game/shared-room-http.mjs), [shared-room-command.mjs](../../../services/game/shared-room-command.mjs) |
| Nativekompatibilitet: tidigare konstruktor och svarform, samma handregler | [public/blackjack.mjs](../../../services/game/public/blackjack.mjs) |
| Nativesko, versionskontroll och senaste kommandokvitto | [shoe-game.mjs](../../../services/game/shoe-game.mjs) |
| Native: PostgreSQL-transaktion för sko, saldo och presentationskvitto | [postgres-native-table.mjs](../../../services/game/postgres-native-table.mjs) |
| Admins isolerade provspel, utan produktens saldo | [preview-table.mjs](../../../services/game/preview-table.mjs) |
| Val av exakt en spelklient | [shared-room-entry.mjs](../../../services/game/shared-room-entry.mjs) |
| Spelhändelser till presentation | [partner-presentation.mjs](../../../services/game/partner-presentation.mjs) |
| Fryst rum, speltyp och bolag | [presentation-room.mjs](../../../packages/presentation/contracts/presentation-room.mjs) |
| Klippurval, vila och skobyten | [packages/presentation/runtime](../../../packages/presentation/runtime/) |
| Kortlagrets layout | [card-presentation](../../../services/game/public/card-presentation/README.md) |
| Forge-mål och geometriprofil | [dealer-forge-catalog.mjs](../../../apps/studio/lib/dealer-forge-catalog.mjs) |

## Kommandon och rum

Spelingången är `/play/blackjack` (eller `/game?game=blackjack`) med bolag, rum och vid behov dealer. Ett rum utan uttryckligt `game` läses som blackjack. Rummet kopplar bolag, `presentationLaneId` och `gameLaneId`; dealer, bord och bakgrund kommer från bolagets publicerade paket.

**Delat bord:** `POST /api/shared-room/<roomId>/command` använder det delade rummets kommando- och kvittokontrakt, med bland annat `join`, `bet`, `ready`, `act`, `insurance`, `next` och `wait`. Auktoritativa ögonblicksbilder kommer genom rumskanalen. Detta är inte nativeprotokollets `start`/`collect`. [shared-room-command-contract.mjs](../../../services/game/shared-room-command-contract.mjs) är kontraktskällan.

**Kvarvarande nativeadapter:** `POST /api/table` har `state`, `start`, `act`, `insurance` och `collect`. Skrivkommandon kräver aktuell `version` och `requestId`. Exakt återförsök av senaste kommando ger det sparade svaret; samma `requestId` med annan indata avvisas. Det är ingen obegränsad historisk idempotens. Sko, saldo och bokföring skrivs atomärt, och presentationshändelser kan inte skapa nya drag efter commit.

`withSharedRoomEntry` väljer exakt en klient utifrån serverns flagga och sparade rum. Att båda adaptrarna finns betyder inte att två motorer samtidigt avgör samma delade runda.

## Regelkärna och delat bord

`core.mjs` (`newGame`, `step`) returnerar `{state, events, publicEvents, effects, view}` utan SQL, nätverk, klocka eller lagrat saldo. Slump kommer bara från den injicerade `random`; produktionsadaptern är [secure-random.mjs](../../../services/game/games/blackjack/secure-random.mjs). Insats, försäkring, dubblering, split och utbetalning returneras som `effects` per box. Finansieringen är serverns `funding = {available, reserved}`: rundstart och försäkring prövas mot reservationer, dubblering och split mot `available` (saldo minus öppna reservationer).

Delat bord (`table/coordinator.mjs`) samordnar platser, insatsfönster, turer, deadlines, återanslutning och kommandokvitton kring `step`. Lagring går via SQL-fria portar i `table/ports.mjs` och en arbetsenhet `runLocked`; tidsövergångar är ticks som en scheduler kör. Presentationen skrivs till en outbox i samma transaktion och levereras efter commit; mottagaren avvisar äldre versioner (`createPresentationGate`). I drift kopplas koordinatorn till PostgreSQL genom `table/postgres-runtime.mjs`, `postgres-store.mjs` och `postgres-wallet.mjs`. Flaggan `CROUPIER_SHARED_TABLE_ENABLED` styr delat bord. Den är på i både produktion och preview efter O03; driftstatus och återgång följs i [NEXT-AGENT](../../NEXT-AGENT.md) och [ENVIRONMENT-VARIABLES](../../ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling).

## Varför nativeadaptern inte raderas ännu

Admins Provspel använder `preview-table.mjs`; partnerintegration, nativa presentations-/talkonsumenter och sparade `blackjack_tables` har andra kontrakt än delade bord. Överlämningen efter O03 dokumenterar dessutom en oavslutad nativerunda och en förgodkänd återgång med delat bord av. Kontrollera aktuellt läge före avveckling; en tom tabell eller genomförd Neon-migrering räcker inte som bevis.

Native och V3 delar nu handregler genom `round.mjs`. Kompatibilitetsmodulen behåller bara den tidigare konstruktorns standardsko och utelämnar V3:s `sideResults` ur nativehänder. Båda skornas slumpanrop, sparformat, API:er, plånboksadaptrar och V3:s commit/reveal-bevis är oförändrade. Reglerna för split och utbetalning ska inte återinföras i kompatibilitetsmodulen.

Nästa avveckling kräver att provspel och partnerflöden har ersättningar, att sparade rundor och saldon är hanterade samt att talkonsumenter och återgång är verifierade. Den kräver separat granskning; denna samordning av handregler migrerar eller raderar inga produktionsdata.

## Verifiering och gränser

| Prov | Vad det faktiskt verifierar |
| --- | --- |
| [shoe-game](../../../test/shoe-game.mjs) | Nativekommandon, JSON-återläsning, handregelkompatibilitet, oförändrad svarform och skydd mot dubbel utbetalning. Registrerat i gameplay-sviten. |
| [split-rules](../../../test/split-rules.mjs) | Fasta splitfall och seedad simulering genom kompatibilitetsmodulen och därmed samma handregler. Körs uttryckligen av `Game rules split check` i CI. |
| [fuzz-blackjack](../../../test/fuzz-blackjack.mjs) | Den kvarvarande nativekommandovägen (`shoe-game.mjs`), inte V3:s funding-, outbox- eller låskontrakt. Inte ett statistiskt certifieringstest. |
| [blackjack-core](../../../test/blackjack-core.mjs), [blackjack-sidebets](../../../test/blackjack-sidebets.mjs) | V3:s effekter, finansiering, dolda kort, skobevis och utbetalningstabell. Frysta Kevin-fixturer är testorakel, inte ytterligare en produktväg. |
| [blackjack-table](../../../test/blackjack-table.mjs), [postgres-shared-table](../../../test/postgres-shared-table.mjs) | Delade bord, samtidighet och lagringskontrakt; riktig PostgreSQL körs via den isolerade CI-harnessen. |
| [table-http](../../../test/table-http.mjs), [postgres-native-table](../../../test/postgres-native-table.mjs), [preview-table](../../../test/preview-table.mjs) | Fortfarande använda native- och provspelsadaptrar; behåll tills konsumenterna avvecklats. |

Databas- och webbläsaracceptans körs i CI eller isolerad preview, aldrig mot riktiga spelare. Att en testfil heter `native`, `local`, `Astrid` eller `lissabon` räcker inte för att radera den: följ aktiv konsument och beteende. Inga real-money- eller certifieringspåståenden följer av denna guide. Kortmått följer vald filmprofil; ändra dem inte globalt.
