# Blackjack

Samlad ingång för implementerat spel och dealerproduktion. Kodbas: main `426fa11417695025e2a0ee194825110f48f6b4af`, läst 13 oktober 2026. [Gemensamma källregler](../README.md) gäller. Underlagets bedömda fullständighet är **85 %**, med öppna frågor nedan.

## Läsordning

1. Denna manual: nuvarande spel, kodägande och vad som återstår.
2. [Dealerbank och media](DEALERBANK.md): poser, 30-filsplan, koordinater, format och motsägelser.
3. [Formatlåsning 7 oktober](FORMATLASNING.md): oförändrat historiskt paketbeslut, inte ett nytt globalt live-kontrakt.
4. [Källregister](KALLOR.json): alla mottagna dokument, deras hashes och frysta underlag.
5. [Gemensamma klipp och format](../KLIPP-OCH-FORMAT.md): samma ord för medietyp, handling, pose, visningsprofil och acceptans i båda spelen.

## Det spelet gör idag

Native blackjack är personliga serverstyrda rundor med upp till sju spelarplatser. Åtta kortlekar ger 416 kort; ett brännkort tas bort och cut-gränsen är 312 dragna kort. Ny blandning sker inför nästa runda när gränsen nåtts, aldrig mitt i en runda. Servern behåller kortordning, brännkort och privat hålkort.

Regler i [blackjack.mjs](../../../services/game/public/blackjack.mjs): S17 (dealern stannar även på mjuk 17), amerikanskt hålkort med peek, blackjack 3:2, försäkring 2:1, dubblering på två kort och efter split, högst fyra händer per plats. Delade ess får ett kort vardera. Ingen surrender. 21 efter split är vanlig 21, inte blackjack 3:2.

Sidoinsatser: Perfect Pairs ger 25:1 perfekt, 12:1 samma färg, 6:1 blandad färg. 21+3 ger 100:1 suited trips, 40:1 straight flush, 30:1 trips, 10:1 straight och 5:1 flush. Dessa är nettovinster; kodens retur inkluderar insatsen vid vinst. Servervägen kräver sju betsposter, huvudinsats minst 5 om platsen används, högst 2 000 per insatsfält och sidoinsats bara tillsammans med huvudinsats.

## Kodkarta och anropsflöde

| Ansvar | Aktuell källa |
| --- | --- |
| Spelregler, händer, split och sidoinsatser | [services/game/public/blackjack.mjs](../../../services/game/public/blackjack.mjs) |
| Beständig sko, versionskontroll, senaste request-kvitto | [services/game/shoe-game.mjs](../../../services/game/shoe-game.mjs) |
| SQLite-transaktion: sko, saldo och presentationskvitto | [services/game/native-table.mjs](../../../services/game/native-table.mjs) |
| PostgreSQL: samma ansvar med låst spelarrad | [services/game/postgres-native-table.mjs](../../../services/game/postgres-native-table.mjs) |
| Autentisering och POST /api/table | [services/game/server.mjs](../../../services/game/server.mjs) |
| Spelhändelser till presentation | [services/game/partner-presentation.mjs](../../../services/game/partner-presentation.mjs) |
| Fryst rum, speltyp och operatör | [packages/presentation/contracts/presentation-room.mjs](../../../packages/presentation/contracts/presentation-room.mjs) |
| Klippurval, idle och skobyten | [packages/presentation/runtime](../../../packages/presentation/runtime/) |
| Kortlagrets layout | [web/public/card-presentation](../../../services/game/public/card-presentation/README.md) |
| Forge-mål och geometriprofil | [dealer-forge-catalog.mjs](../../../apps/studio/lib/dealer-forge-catalog.mjs) |

Spelingången är /play/blackjack med operator, table och vid behov dealer i länken; Render äger spelservern. Native-kommandona är state, start, act, insurance och collect. Skrivkommandon behöver aktuell version och requestId. Exakt återförsök av senaste kommando ger sparat svar; samma requestId med annan indata avvisas. Detta ska inte beskrivas som en obegränsad historisk idempotensgaranti. Sko, saldo och bokföring skrivs atomärt; observations-/presentationshändelser får inte skapa nya drag efter commit.

Rum utan uttryckligt game-fält läses som blackjack. Ett rum har en speltyp och kopplar operatör, presentationLaneId och gameLaneId. Dealer, bord och bakgrund tas från bolagets publicerade paket. Delat presentationspaket gör inte blackjackens korthandlingar till roulettehändelser.

## Verifiering och gränser

Relevanta regressioner: [shoe-game](../../../test/shoe-game.mjs), [split-rules](../../../test/split-rules.mjs), [fuzz-blackjack](../../../test/fuzz-blackjack.mjs), [table-http](../../../test/table-http.mjs), [postgres-native-table](../../../test/postgres-native-table.mjs) och [local-presentation](../../../test/local-presentation.mjs). Använd Volta Node 24.21.0 och fyra testworkers där stödet finns. Databas- och browseracceptans ska köras isolerat; denna dokumentändring kör inga produktionstransaktioner.

Öppna luckor: vald desktopprofil för nya dealerpaket; fysisk kamera och bordsmått; skons hämtpunkt; uppmätt landnings-/överlämningsruta; korrekt handmask; godkända VILA/REDO per dealer; slutligt språk/manus/röst; WebM-alfa och exakt en ljudkälla i samtliga målspelare. En komplett 30-filsplan är inte en färdig bank. Befintliga medier är inte automatiskt godkända av deras filnamn, mått eller event-ID.

Äldre mediefamiljer kan ha andra koordinater, exempelvis Astrids 63×85-kort i ett liggande plan. Byt inte dem globalt till Paow/Dragges 79×106. Inga real-money- eller certifieringspåståenden följer av denna manual.
