# Roulette — 37 utfallsfilmer

[Till spelmanualen](README.md) · [Gemensamma klipp och format](../KLIPP-OCH-FORMAT.md)

**Status: produktionsmål och acceptanskrav, inte implementerat filmstöd på main.** Tillägget kommer från Jakobs uppdrag till ROULETTE-2 den 13 oktober 2026 och samordnas här. Bygg inga nya animationer innan filmerna finns. Den nuvarande prototypfilmen är inte en godkänd bank med 37 utfall. Dokumentet beställer ingen generering och godkänner inga kostnader eller publiceringar.

## Vad banken ska innehålla

En godkänd film för vart och ett av heltalen **0–36**, utan luckor eller dubletter. Varje film visar samma europeiska hjul, låsta kamera, bord, skala, belysning och maskregistrering. Bara den avsedda rundans rörelse och slututfall får skilja. Kulan ska synligt stanna i exakt det märkta facket. Hjulets nummerföljd och färger måste stämma med [rules.mjs](../../../web/games/roulette/rules.mjs); nollan är grön. En film med förvrängda, upprepade eller felordnade nummer är inte godkänd även om slutnumret ser rätt ut.

Hjul/kula är ett separat lager från dealern. Scenen använder **en vald dealer-idle**, återanvänd på mobil och desktop genom uttryckliga visningsprofiler. Inget behov av 37 dealerfilmer eller olika dealerklipp per skärm. Ingen inbakad dealer i utfallsfilmen om samma dealer också visas som separat lager.

Det gemensamma startläget ska vara låst. Silverkulans reflexer, skuggor, studs och rörelseoskärpa ska vara naturliga och konsekventa med samma hjul och ljus. Det är visuella acceptanskrav, inte mätbevis från prototypen. Spela den valda hela filmen från början efter kvittot; byt inte osynkroniserat till en annan utfallsfilm mitt i rörelsen. En framtida gest får bara initiera spelkommandot, aldrig välja vinnande ficka. Ingen sådan ny gest eller spelare byggs i denna dokumentändring.

Välj och lås en gemensam leveransprofil innan hela banken produceras: canvas/mått, crop, fps/tidsbas, codec, färgrymd, alfa eller separat mask, ljudpolicy, första/sista visningsläge och stoppmarkering. Utgångspunkten är ljudlösa hjulfilmer; eventuellt ljud kräver separat beslut. Prototypens 1916×1080/24 fps/361 rutor är mätdata, inte ett beslut att alla nya filer måste ha det formatet. Den äldre 15-sekundersbeställningen är inte heller en acceptansgräns. Första och sista läget ska kunna visas utan hopp mot rätt stillbild; slutbilden hålls, filmen loopas inte.

## Koppling till serverresultatet

Idag skapar [roomCommand](../../../web/games/roulette/room.mjs) ett resultat och ett kvitto inom plånbokstransaktionen. [storage](../../../web/games/roulette/storage.mjs) sparar spelarrunda, saldo och bokföring atomärt. Klienten får bland annat `round.id`, `round.event.outcome.number`, färg och avräkning. **Filmen följer ett bekräftat och sparat resultat; filmen bestämmer aldrig utfallet eller pengarna.**

Framtida filmintegration ska:

1. Låsa och spara samma kommando före sändning: spelar-/rumskontext, `requestId`, version, valuta och satsningar. Vänta på giltigt kvitto. Använd ingen lokal slump eller förvald film som senare tvingar ett serverutfall.
2. Välja exakt nummerpost ur den avsedda, versionsbundna filmbanken efter att kvittot bekräftats. Kontrollera rätt spel, rum/publicering, bankversion och godkänd filhash. Saknad eller ogiltig post får inte ersättas av närmaste nummer eller annan film.
3. Spela filmen en gång och visa serverns resultat, saldo och historik konsekvent även om media fallerar. Uppspelningens avslut får inte avräkna igen, skicka ett nytt spin eller ändra resultatet.
4. Vid tappat svar återförsöka exakt det sparade kommandot. Samma `requestId` med ändrad version/satsning/valuta avvisas; nytt ID är en ny runda och ingen reparation. Dagens server behåller 20 kvitton per scope, inte obegränsad historik. Om ett äldre kvitto inte kan återfås ska UI visa osäkerheten och läsa serverläget; ingen ny dragning för att gissa det förlorade resultatet.
5. Vid omladdning eller redan återspelat kvitto visa det redan avgjorda utfallet. Automatisk dubbel uppspelning får inte se ut som en andra satsning. En frivillig visuell repris är läsning av samma runda och märks som repris.

**Öppen implementation:** dagens roulettekvitto binder inte en 37-filmsbanks version eller filmhash. Ett kontrakt för att bevara rundans koppling till den publicerade medierevisionen måste införas och testas innan filmfunktionen kallas färdig. Att läsa senaste bank vid varje retry skulle kunna byta film för samma kvitto. Lägg inte till ett påhittat JSON-fält och anta att dagens API lagrar det.

## Registrering och versionsbyte

Den kommande bankdefinitionen behöver minst bank-ID/version, spelvariant, profil/maskversion och exakt 37 nummerposter med registrerat tillgångs-ID, SHA-256, byteantal, probe-data, slutnummer, resultatstillbild och godkännandereferens. Dessa är krav på det kommande kontraktet, inte ett färdigt importformat. URL eller filnamn ensamt är ingen stabil identitet.

Beskriv varje post med roll utfallsfilm, game roulette, handling, `targetPocketNumber`, mask/ROI/ankare och sista stabila frame-index med uttrycklig indexbas. Exportera reserv-PNG från den verifierade slutbilden och registrera även dess hash. Om fler varianter senare godkänns för ett nummer måste samma runda/retry behålla samma variant; dagens mål är fortfarande en godkänd film per nummer.

En ändrad fil eller mask ger ny granskning och ny bankrevision. Byt inte bytes bakom en redan accepterad hash och skriv inte om historiska rundor. Bekräfta att publicerings-/historikskydd bevarar både film och stillbild innan material pensioneras. Publiceringen ska kunna avvisa ofullständig bank och fel spelvariant. Val av lagring, schema och migrering ingår i en separat implementation med ordinarie mandat och grindar.

## Stillbildsreserv och tillgänglighet

Vid nätverksfel, avkodningsfel, saknad film, paus eller reducerad rörelse visas serverns nummer/färg och avräkning direkt. Använd en verifierad resultatstillbild för rätt nummer och bankrevision när den finns. Annars visas en neutral bordsvy med tydligt textresultat; visa aldrig en stillbild som föreställer ett annat vinnande nummer. Reservläget får inte fördröja kvittot på obestämd tid eller kräva en ny satsning.

Ladda inte ned och avkoda alla 37 filmer samtidigt som standard. Laddnings-/minnesstrategi måste mätas på måltelefoner. Förstoring av samma scen får inte skapa en andra dealer-idle med egen tid. Tangentbord, fokusåtergång, skärmläsarresultat, tyst autoplay-policy och reducerad rörelse behöver egen acceptans.

## Acceptans före publicering

| Område | Bevis som krävs |
| --- | --- |
| Alla 37 utfall | Full filmgranskning per hash: korrekt hjul och kula, rätt slutnummer/färg, inga morfande siffror eller kamerahopp. Några provrutor räcker inte. |
| Format och lager | Probe samt verklig avkodning, korrekt mask/alfa, ljudpolicy och gemensam geometri; två på varandra följande visningar utan felaktig skarv. |
| Serverkoppling | Isolerade prov av samtliga nummer, tappat svar, exakt retry, dubblettkvitto, inaktuell version och transaktionsrollback; ingen dubbel debitering eller slumpning. Styrda testutfall hör endast hemma i testfixturen. |
| Bankbyte | Samma kvitto behåller sin medierevision när en ny bank publiceras; fel hash, saknat nummer och fel spelvariant stoppas. |
| Reservläge | Mediafel, offline och reducerad rörelse visar korrekt kvitto/text/stillbild utan nytt spin. |
| Spelvy | Verklig sammansatt scen på mobil och desktop, läsbara marker/resultat, tangentbord/fokus, en aktiv dealer-idle och uppmätt laddning/minne. Sessionsbyte och utgången publicering får inte kringgå serverns behörighets-/publiceringskontroll eller visa en annan spelares väntande runda. |

Bankproduktion, rättslig/certifierad spelacceptans, betald generering och produktionsdata är inte godkända av att dessa krav finns i Git. Följ aktuell [migrationsplan](../../CLOUD-MIGRATION.md) för teknisk leverans; skapa ingen separat sprinttracker här.
