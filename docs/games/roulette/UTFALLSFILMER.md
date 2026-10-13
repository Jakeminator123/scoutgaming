# Roulette — 37 utfall med gemensamt filmmaterial

[Till spelmanualen](README.md) · [Gemensamma klipp och format](../KLIPP-OCH-FORMAT.md)

[Flödesschema i Asymptote](underlag/roulette-filmflode.asy) visar det föreslagna pending/reveal-flödet. Asymptote-kompilator saknas lokalt; källan är inte renderingsverifierad.

**Status 13 oktober 2026:** Jakob har ändrat målet från 37 hela filmer till en kompakt lösning med 37 korrekta slutlägen. Ett isolerat geometriprov med separat kula finns; ingen utfallsrenderare eller fördröjd resultatvisning är inkopplad i spelmotorn. Det tidigare kravet att invänta 37 filmer före animationsprov är ersatt av detta uppdrag. Privata original bevaras. Proven är inte produktionsgodkännande.

## Vad banken ska innehålla

Ett godkänt visuellt utfall för vart och ett av heltalen **0–36**, utan luckor eller dubletter. Rekommendationen är ett gemensamt bord/hjul och **en separat, deterministiskt styrd kula med 37 kalibrerade mål**. Alternativet är ett gemensamt startklipp plus 37 korta hjulregioner för avslutet och 37 slutbilder. Banken behöver alltså inte innehålla 37 stora filmer. Alla utfall visar samma europeiska hjul, låsta kamera, bord, skala, belysning och maskregistrering. Bara den avsedda rundans rörelse och slututfall får skilja. Kulan ska synligt stanna i exakt det märkta facket. Hjulets nummerföljd och färger måste stämma med [rules.mjs](../../../web/games/roulette/rules.mjs); nollan är grön. En film med förvrängda, upprepade eller felordnade nummer är inte godkänd även om slutnumret ser rätt ut.

Hjul/kula är ett separat lager från dealern. Scenen använder **en vald dealer-idle**, återanvänd på mobil och desktop genom uttryckliga visningsprofiler. Inget behov av 37 dealerfilmer eller olika dealerklipp per skärm. Ingen inbakad dealer i utfallsfilmen om samma dealer också visas som separat lager.

Det gemensamma startläget ska vara låst. Silverkulans reflexer, skuggor, studs och rörelseoskärpa ska vara naturliga och konsekventa med samma hjul och ljus. Det är visuella acceptanskrav, inte mätbevis från prototypen. Det gemensamma förloppet måste ansluta utan hopp till det valda avslutet; byt inte osynkroniserat mellan filmer. En dealerhandling får aldrig välja vinnande ficka. Hjulimpuls och kulsläpp är två olika gester. Serverns offentliggörandegräns nedan måste vara bestämd innan spelkoppling.

Välj och lås en gemensam leveransprofil innan hela banken produceras: canvas/mått, crop, fps/tidsbas, codec, färgrymd, alfa eller separat mask, ljudpolicy, första/sista visningsläge och stoppmarkering. Utgångspunkten är ljudlösa hjulfilmer; eventuellt ljud kräver separat beslut. Prototypens 1916×1080/24 fps/361 rutor är mätdata, inte ett beslut att alla nya filer måste ha det formatet. Den äldre 15-sekundersbeställningen är inte heller en acceptansgräns. Första och sista läget ska kunna visas utan hopp mot rätt stillbild; slutbilden hålls, filmen loopas inte.

## Koppling till serverresultatet

Idag skapar [roomCommand](../../../web/games/roulette/room.mjs) ett resultat och ett kvitto inom plånbokstransaktionen. [storage](../../../web/games/roulette/storage.mjs) sparar spelarrunda, saldo och bokföring atomärt. Klienten får bland annat `round.id`, `round.event.outcome.number`, färg och avräkning. **Filmen följer ett bekräftat och sparat resultat; filmen bestämmer aldrig utfallet eller pengarna.**

Framtida filmintegration ska:

1. Låsa och spara samma kommando före sändning: spelar-/rumskontext, `requestId`, version, valuta och satsningar. Ett framtida pending/reveal-kontrakt måste skilja accepterad satsning från offentligt resultat. Använd ingen lokal slump eller förvald film som senare tvingar ett serverutfall.
2. Välja exakt nummerpost ur den avsedda, versionsbundna filmbanken först efter serverns offentliggörande. Kontrollera rätt spel, rum/publicering, bankversion och godkänd filhash. Saknad eller ogiltig post får inte ersättas av närmaste nummer eller annan film.
3. Spela filmen en gång och visa serverns resultat, saldo och historik konsekvent även om media fallerar. Uppspelningens avslut får inte avräkna igen, skicka ett nytt spin eller ändra resultatet.
4. Vid tappat svar återförsöka exakt det sparade kommandot. Samma `requestId` med ändrad version/satsning/valuta avvisas; nytt ID är en ny runda och ingen reparation. Dagens server behåller 20 kvitton per scope, inte obegränsad historik. Om ett äldre kvitto inte kan återfås ska UI visa osäkerheten och läsa serverläget; ingen ny dragning för att gissa det förlorade resultatet.
5. Vid omladdning återuppta neutral pending-vy före reveal; visa ett redan offentliggjort utfall efter reveal. Automatisk dubbel uppspelning får inte se ut som en andra satsning. En frivillig visuell repris är läsning av samma offentliga runda och märks som repris.

**Öppen implementation:** dagens roulettekvitto binder inte en 37-utfallsbanks version eller mediehash. Ett kontrakt för att bevara rundans koppling till den publicerade medierevisionen måste införas och testas innan funktionen kallas färdig. Att läsa senaste bank vid varje retry skulle kunna byta utfallsmedia för samma kvitto. Lägg inte till ett påhittat JSON-fält och anta att dagens API lagrar det.

## Registrering och versionsbyte

Den kommande bankdefinitionen behöver minst bank-ID/version, spelvariant, profil/maskversion och exakt 37 nummerposter med registrerade tillgångs-ID, SHA-256, byteantal, probe-data, slutnummer, resultatstillbild och godkännandereferens. Ett procedurspår behöver även fryst renderer-, geometri- och banversion. Dessa är krav på det kommande kontraktet, inte ett färdigt importformat. URL eller filnamn ensamt är ingen stabil identitet.

Beskriv varje post med roll utfallsmedia, game roulette, handling, `targetPocketNumber`, mask/ROI/ankare och sista stabila frame-index med uttrycklig indexbas, eller motsvarande reproducerbart stoppläge i den frysta renderaren. Exportera reserv-PNG från den verifierade slutbilden och registrera även dess hash. Om fler varianter senare godkänns för ett nummer måste samma runda/retry behålla samma variant; målet är ett godkänt, reproducerbart utfall per nummer.

En ändrad fil eller mask ger ny granskning och ny bankrevision. Byt inte bytes bakom en redan accepterad hash och skriv inte om historiska rundor. Bekräfta att publicerings-/historikskydd bevarar både film och stillbild innan material pensioneras. Publiceringen ska kunna avvisa ofullständig bank och fel spelvariant. Val av lagring, schema och migrering ingår i en separat implementation med ordinarie mandat och grindar.

## Stillbildsreserv och tillgänglighet

Före offentliggörandet ger mediafel en neutral väntvy med timeout/återhämtning, aldrig ett tidigt resultat. Efter offentliggörandet visas serverns nummer/färg och avräkning även vid nätverksfel, avkodningsfel, saknat media, paus eller reducerad rörelse. Använd en verifierad resultatstillbild för rätt nummer och bankrevision när den finns. Annars visas en neutral bordsvy med tydligt textresultat; visa aldrig en stillbild som föreställer ett annat vinnande nummer. Reservläget får inte fördröja kvittot på obestämd tid eller kräva en ny satsning.

Ladda inte ned och avkoda alla 37 filmer samtidigt som standard. Laddnings-/minnesstrategi måste mätas på måltelefoner. Förstoring av samma scen får inte skapa en andra dealer-idle med egen tid. Tangentbord, fokusåtergång, skärmläsarresultat, tyst autoplay-policy och reducerad rörelse behöver egen acceptans.

## Acceptans före publicering

| Område | Bevis som krävs |
| --- | --- |
| Alla 37 utfall | Full visuell granskning per hash/renderer och variant: korrekt hjul och kula, rätt slutnummer/färg, inga morfande siffror eller kamerahopp. Några provrutor räcker inte. |
| Format och lager | Probe samt verklig avkodning, korrekt mask/alfa, ljudpolicy och gemensam geometri; två på varandra följande visningar utan felaktig skarv. |
| Serverkoppling | Isolerade prov av samtliga nummer, tappat svar, exakt retry, dubblettkvitto, inaktuell version och transaktionsrollback; ingen dubbel debitering eller slumpning. Styrda testutfall hör endast hemma i testfixturen. |
| Bankbyte | Samma kvitto behåller sin medierevision när en ny bank publiceras; fel hash, saknat nummer och fel spelvariant stoppas. |
| Reservläge | Mediafel, offline och reducerad rörelse visar korrekt kvitto/text/stillbild utan nytt spin. |
| Spelvy | Verklig sammansatt scen på mobil och desktop, läsbara marker/resultat, tangentbord/fokus, en aktiv dealer-idle och uppmätt laddning/minne. Sessionsbyte och utgången publicering får inte kringgå serverns behörighets-/publiceringskontroll eller visa en annan spelares väntande runda. |

Lokala geometriprov ger inget produktionsgodkännande eller rättslig/certifierad spelacceptans. Följ aktuell [migrationsplan](../../CLOUD-MIGRATION.md) för teknisk leverans; skapa ingen separat sprinttracker här.

## Maskning och exakt en kula

Att mjuka upp cirka 0,1 sekund kan dölja en skarv, men garanterar inte att den blir osynlig. Vid originalets 24 fps är 0,1 sekund 2,4 rutor: två rutor är cirka 83 ms och tre 125 ms. Granska en liten tidsregistrerad hjulmask både i normal hastighet och ruta för ruta.

Kulans mål är ett fack i **roterande hjulkoordinater**, inte en fast bildpunkt oberoende av tiden. Lås källhash, faktisk bildstorlek/crop, tidsbas, kamerans perspektiv, hjulcentrum/ellips, 37 fackcentra och rotorns vinkel per ruta. Kalibrera kulradie, skugga/reflexer, studs, kontakt med fackets botten och vad som skymmer kulan. Ett rent underlag måste sakna gammal kula och kulskugga: separat lager får aldrig ge två kulor. Kulan får inte teleportera den sista sekunden.

Lokal `roulette_dealer_handoff/calibration.json` anger (960,330) som äldre handkontaktsmål vid navet, **inte** kulans släpp- eller stopplats. `ballRelease` och faktisk trigger-tid är fortfarande okalibrerade. Bestäm släppruta och plats mot filmens hash: kulan går från handen till ytterbanan utan dubblett eller glapp, motsatt rotorns rörelse. Äldre porträtttransform får inte blandas med nya landskapsfilmernas visningsprofil.

Runway passar för matchande dealerhandlingar och vilovarianter. Exakt nummerföljd och kontrollerad landning behöver verifierad geometri; genererad film är inte bevis för rätt fack. Den levererade bordfilmens provrutor har förvrängda/otydliga siffror och är inte godkänd som 37-facksgrund.

## Resultatsekretess: serverns gräns

Dagens kvitto innehåller redan nummer/färg, utbetalning, netto och saldo. [Rouletteklienten](../../../web/public/roulette/app.mjs) visar detta och läser historik. **Resultatet är alltså tillgängligt för klienten före en framtida film.** Även `/api/player`, `/api/profile` och roulettehistoriken måste omfattas av en ny gräns, annars kan saldo eller vinst avslöja resultatet. Generiska `/api/history` filtrerar idag blackjack och är inte roulettehistorik.

Oskärpa, dolda DOM-element, obskyra filnamn eller ett tidigt nedladdat nummerklipp ger inte sekretess. Klienten kan granska svar och filmbytes; se även [OWASP:s råd om känsliga data i klientlagring](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

Ett framtida serverkontrakt behöver:

1. Spara satsning/reservation, requestId, rund-ID, dolt utfall, pending-status, serverstyrd reveal-tid och fryst presentationsversion atomärt. Exakt bokföringsmodell utreds separat; inga plånboksändringar görs här.
2. Före reveal bara lämna neutrala fält. Ingen utfallsvald media-URL, nummer/färg, nettovinst, taltext, saldo efter vinst eller avslöjande historik. Samma neutrala material eller hela den gemensamma banken får förladdas oberoende av utfallet.
3. Servern publicerar kvitto och vinstinformation vid rätt gräns, oberoende av klientens `ended`-event. Behörighet och samma reveal-gräns gäller alla läsvägar och samtidiga sessioner.
4. Retry/omladdning återfår samma pending/avgjorda runda utan ny debitering eller dragning. Dagens 20 kvitton per scope är ingen obegränsad återställningsgaranti.

**En vanlig webbläsare kan inte garantera hemlighet ända till den fysiska bildrutan där kulan landar:** den behöver information för att rita det utfallsberoende avslutet. Bestäm en serverstyrd offentliggörandetid och acceptera en uttrycklig kort ledtid till bildstoppet, eller utred serverrenderad ström med begränsad buffert. Även en ström ger viss förhandsåtkomst till mottagna bilder. Kalla inte en lokal mask ett säkerhetsskydd.

Ett eventuellt kryptografiskt åtagande kräver en hemlig slumpnonce med tillräcklig entropi, bunden till runda och version. Hash av bara ett av 37 nummer kan provas uttömmande. Detta är ett designalternativ, inte implementerad rättvise- eller certifieringsfunktion.

Sekretessacceptansen måste omfatta spin, state, player/profile, roulettehistorik, samtidiga sessioner, preload/URL:er och reveal-tid. Testa rollback och reload både före och efter reveal samt exakt retry. Alla styrda utfall hör hemma i isolerad testfixtur.

## OpenClaw och automatiska variationer

Behåll andnings-idle som bas. Glasögonvarianten är en längre handling, inte en blinkning. Nästa filmer att ordna är **korrekt hjulimpuls och separat kulsläpp med återgång till vila**, därefter en kort blick/svagt leende. Speltal kräver exakt text, ljud, video och egen lipsyncacceptans.

OpenClaw får begära en tillåten neutral variant; en lokal sekvenskö avgör när den får spelas. Tillåt bara vid lugn idle utan pågående/väntande runda, tal eller annan gest. Kräv posekontroll, säkert avbrott, cooldown samt spärr för dold flik och reducerad rörelse. Första provvärde: slumpat 60–120 s mellan varianter, minst 45 s cooldown och högst en per minut. Detta är förslag, ingen publicerad regel. Bakgrundens befintliga intervallpolicy är separat. Agenten får aldrig välja utfall, lägga insats eller ändra avräkning.

## Uppmätta privata prov

Proven ligger utanför Git i `Codex visualizations/2026/10/13/01a13532-b75d-75f0-8507-e70a6c69612e/roulette-stop`.

| Prov | Resultat | Bevisgräns |
| --- | --- | --- |
| Bordets t=13–15 s, helbild 1916×1080 | 382 128 byte VP9, CRF 30, 24 fps | Omkodning av två sekunder, inget godkänt utfall |
| Samma intervall, ROI 680×320 vid (620,80) | 182 381 byte, cirka 52 % mindre | En region; ingen färdig mask/skarv eller uppmätt 37-bank |
| `roulette-stop-test.html` | 37 matematiska slutlägen × tre varianter; neutral gemensam början | Ritad schematisk rotor, inte kalibrerad originalfilm eller sekretessprov |
| `roulette-stopp-17-teknikprov.webm` | Verklig browserexport, VP9, 960×580, cirka 8,01 s, 909 951 byte | Ett visuellt prov; browserinspelning är ingen låst produktionsprofil |

Originalfilerna har inte skrivits över. Proven ändrar ingen spelmotor, publicerad rumsinställning eller ekonomisk hantering.
