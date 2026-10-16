# Roulette — 37 utfall med gemensamt filmmaterial

[Till spelmanualen](README.md) · [Gemensamma klipp och format](../KLIPP-OCH-FORMAT.md)

## Startgest v2 och live-registrering

Efter beställningen att färdigställa demorummet skapades v2 i Jakobs Runway-
workspace, task `c1bbe9de-e213-43fa-ac29-4f560ea43eb2`. Käll-MP4:
1920×1080, 24 fps, 10,042 s, SHA-256
`961958a45ad2cff6a6dd1e618e6b8666c246e0d838d323020c4acb71b02f78c9`.
Friläggning `ac90a0e2-8b28-4089-889c-84668184d29e` med ämnet
`the woman` gav fungerande alfa. Den tidigare körningen med lång ämnestext
gav helt opak alfa trots alpha-metadata och är underkänd.

Slutfil `anna-wheel-start-v2-clean.webm`, 13 223 797 byte, SHA-256
`c03eac6a3d4e4776cce6eeaa5d4d4ce4000cfd4ebfd972017e52d65a6b485b85`.
En isolerad rest i vänster bildkant avlägsnades genom crop av 10 pixlar och
transparent pad tillbaka till samma 1920×1080. Inga dealerpixlar flyttades.
FFmpeg använde libvpx-vp9-avkodning och förlustfri yuva420p-kodning.
Original, exakt prompt och granskningsbilder sparas privat i roulette-stop.

Demoprofil: VILA → VILA, framing `{scale:1,x:0,y:0}`, längd 10042 ms,
impuls 3208 ms, kulsläpp 5000 ms, design `roulette-anna-v1`, handregion
`[[[0.47,0.34],[0.84,0.34],[0.84,0.62],[0.47,0.62]]]`.
Agentens visuella kontroll visar handkontakt/svep över hjulet, återgång till
vila och bibehållen placering. Kulsläppet är en animerad visualisering;
detta är ingen fysisk mätning av en verklig roulettekula eller ett nytt
mänskligt godkännande. Hjulets canvas komponeras nu i bordslagret före
handmasken, så att de korrigerade siffrorna inte ritas ovanpå fingrarna.

Live registrerat via Admins ordinarie Blob/Neon-flöde: vilofilm
`8852479c-8aea-46d2-a033-16df41f10b8f` och MP4-bakgrund
`2c7feba2-70f1-44ee-9b6f-19e478313385`. Viloposer och framing
`{scale:0.66,x:0.15,y:-0.16}` är sparade. Egen sammansättning:
`anna-roulette-demorum-fc7785ae-6747-4a5e-b229-04c1ce4247c4`.
Startfilm `96deca4e-3716-4db8-9a51-997ffa906a3b` och bord
`7e31ab32-8074-4b63-b1bb-4e6bee772421` är också registrerade via ordinarie
privata Blob/Neon-flöde. Startprofilen ovan och idle-handregionen är sparade.
Sammansättningen tillåter endast Anna, Anna-roulettebordet och MP4-salongen.
Admin avrundar bordbredden till 1,04 i mobil och desktop; övrig kalibrering
är lager 1/0/0, bordets x/y 0/0 och tableFront=false. Den lilla skillnaden
mot lokalt prov (1,044565) granskades i de två produktionsspelningarna:
Annas placering och händer vid bordskanten bevaras.
PR101 är live som `a6509318`, v15 bekräftad. PR114 (`1fd552d3`) rättar
spelbunden förkontroll och v15-acceptans. **14 oktober 2026:** eget bolag
`scoutgaming-demo`, paketversion 1, har publicerat rummet
`room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea` via ordinarie Admin-flöde.
SG-tests äldre paket och två arkiverade rum konverterades inte.
Två spel genom `/lobby`, utan omladdning, gav 17 svart och 15 svart;
5 på rött förlorade 5, sedan gav 5 på svart 10 tillbaka. Slutligt demosaldo
var samma som före provet. Startfilm och återgång till idle fungerade båda
gångerna med MP4-bakgrund. Agentens visuella demoacceptans och serverkvitton
är sparade privat i `anna-live-acceptance.json` och två `anna-live-round-*.png`.
[Spela Anna-demot](https://www.scoutgaming.tech/play/roulette?operator=scoutgaming-demo&table=room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea&dealer=anna-jonsson).
V1-starten och den opaka v2-friläggningen får inte publiceras.

Admin har uttryckliga starttider/bordval och handregion för exakt idle-fil.
Pose/inramning sparas separat med SHA och tidigare metadata som CAS-villkor.
Spelvalet skiljer borden i bibliotek och sammansättningar; maskens visuella
acceptans görs i den riktiga spelaren, inte i kompositionseditorns provbild.

[Flödesschema i Asymptote](underlag/roulette-filmflode.asy) visar det föreslagna pending/reveal-flödet. Asymptote-kompilator saknas lokalt; källan är inte renderingsverifierad.

**Status 14 oktober 2026:** Den riktiga `/play/roulette`-spelaren ritar 37 korrekta fack och en kula mot serverkvittots nummer. Rundans ID ger reproducerbar variation i slutvinkel, 3–5 rotorvarv, 5–7 kulvarv och 8,5–12 sekunders visning. Anna-bordets perspektiv och MP4-bakgrund bevaras. Demorummet är publicerat och två spel med låtsasmarker är verifierade. Serverstyrd pending/reveal återstår: utfallet kan fortfarande läsas i nätverkssvaret före den visuella landningen. Privata original bevaras.

## Ny startfilm och variationsspelning

Jakob godkände uppladdning av den godkända målbilden till sitt Runway-konto
och en tiosekundersfilm. Generering `d9e1bab9-d760-4b7c-a0b2-f2744865ca68`
gav 1960×1056, 10,041 s, utan ljud; MP4 SHA-256
`b17c0a108e6edcc119a2b5fca7ef156709fef9e742a000809f78da8fb6ebf524`.
Friläggning `d66e85b2-a833-4e5f-9b9c-ccff8134f2b5` gav alpha-WebM,
10,042 s, 737393 byte, SHA-256
`f3c706a0cef16d3f3e7bf4b5e10ac524d3974c552d0bccc8a55be4f22d9b6f8a`.
Original, prompt, granskningsmanifest och bildrutor ligger privat i samma
`roulette-stop`-mapp som tidigare bevis; inga signerade leverantörs-URL:er i Git.

**Visuell bedömning: granskningsklipp, inte produktionsgodkänt.** Första och
sista bildrutorna har vilohänder; friläggningen bevarar händer/fluga/glasögon
i granskade rutor. Gesten är däremot ett presenterande svep, inte en tydlig
tangentiell hjulimpuls följd av ett trovärdigt kulsläpp. Testprofilen använder
framing `{scale:1,x:0,y:0}`, impuls 2500 ms och släpp 4500 ms för teknisk
kopplingsgranskning. Dessa tider är provisoriska och ska inte publiceras som
accepterad fysisk kalibrering. Ingen ytterligare generering beställd.

Valfritt `dealers[].rouletteStart` binder exakt media-UUID, bordsdesign,
duration, impuls/släpptid och egen handregion. Frozen capture och preview
bevarar profilen; roulette/action/alpha/VILA→VILA och egna bildmått kontrolleras.
Spelaren jämför avkodad duration med profilen (högst 100 ms avvikelse),
spelar klippet en gång och låter videons tid styra rotorstart och kulsläpp.
En saknad/trasig startfilm lämnar idle och MP4 användbara. Rätt valt bord
måste matcha; ett annat bord får aldrig ärva handkalibreringen.
Admin kan fortfarande koppla idle-korten; ett användargränssnitt för att
redigera startfilmens bordsprofil och cue-tider återstår. `rouletteStart`
är nu ett validerat spar-/publiceringskontrakt, inte en färdig tidseditor.

Runtime v1–14 behåller mains exakta kontrakt; v14 gäller kategoripapperskorg.
**Både rouletteIdle och rouletteStart kräver v15**, med separata featuregrindar.
Ingen SQL-migration. Material som senare godkänns ska registreras via befintlig
mediebank med hash och rouletteklassning och lagras i Vercel Blob. Tillfälliga
Runway-URL:er är inte produktionslagring. Ingen Blob-/Neon-/rums-publicering utförd.

Två sammanhängande faktiska UI-rundor med startfilmen: **8 svart → 3 röd**,
saldo 500 → 495 → 500 USD, isolerad SQLite, oförändrad MP4. Privata bevis:
`anna-start-round-1.png`, `anna-start-round-2.png`, `anna-start-motion.png`,
`anna-start-evidence.json`. Föregående varierade stopp-prov gav 31 svart → 0 grön.
Landskapsvyn fyller fönstret med spelkontroller under bordet och erbjuder
helskärm under Mer. Vid 1440×900 är dokumenthöjden 900 utan scroll.
33 fokuserade spel-/renderingstester passerade; full leveranskontroll redovisas
i handoff. Dessa tekniska prov ersätter inte gestens visuella godkännande.

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

## Genomförandeplan: säkert material först

Planen uppdaterades efter Jakobs uppdrag den 13 oktober att spara, committa och pusha arbetet samt undersöka rörelsespårning. Det fristående [geometriprovet](underlag/roulette-stop-test.html) är versionshanterat som historiskt underlag, men Jakob har därefter uttryckligen avvisat det för produktion. Det får inte kopplas till spelet, publiceras som spelmaterial eller ersätta den riktiga roulettevyn. Original, frilagda filmer och provexporter bevaras privat; deras identiteter finns i [klippkartan](KLIPPKARTA.md#nya-lokala-original-13-oktober).

| Ordning | Arbete | Klart när |
| --- | --- | --- |
| 1 | Lås VILA-PNG, befintlig andnings-WebM och rätt glasögon-v2 till exakta roulettefack och hash. Behåll videoposer som unverified | Isolerat intagsprov bevarar bytes och spel/handling; opak v1 och blackjackfack avvisas. Ingen slutsats om verklig dealerregistrering eller publicering från fixture-ID |
| 2 | Lås en korrekt nummerkrans och stabil kamera. Markera hjulcentrum, 37 fack, skala/perspektiv och ett rent underlag utan gammal kula | Numren stämmer mot rules.mjs, geometri håller hela klippet och det finns en definierad plats för en enda kula |
| 3 | Prova lokal OpenCV-spårning på en kopia av hjulfilmen. Börja med rotorlandmärken/optiskt flöde; verifiera manuella referensrutor | Sparad vinkelbana, markerade bortfall och felmått mot handmärkta rutor. Ingen accepterad bana byggd på morfande siffror |
| 4 | Vid behov jämför SAM 2-masker och specialtränad YOLO-detektering med den enklare baslinjen | Bättre uppmätt noggrannhet på samma provrutor; hårdvara, versioner, licens och bearbetningstid dokumenterade |
| 5 | Skapa matchande hjulimpuls/kulsläpp, kontrollera en kula från hand till ytterbana, därefter en extra kort vilovariant | Släpp-/kontaktrutor, masker och start/slutposer godkända per hash, berörda övergångar utan hopp |
| 6 | Koppla granskad geometri och 37 mål till fryst presentation och serverns pending/reveal-kontrakt | Isolerade tester för samtliga utfall, saldo/historik, retry/reload och mediefel; riktad mobil-/desktopkontroll när ändringen berör visningen |

Steg 1 är teknisk förberedelse. Native PNG-lagring är spärrad i den aktuella kodversionen, så VILA stannar som lokal referens. Verklig dealer, bolag, rum och kompositionsrevision måste väljas ur de sparade registren före beständig import. Vi fyller inte luckorna med påhittade UUID:er. Steg 2–6 är kvarvarande implementation/acceptans, inte redan aktiverade funktioner.

## Produktionsspår: Three.js och Annas spelarkoppling

Utgångspunkt är mergad grund `6ee5d3aa`, `/play/roulette` →
`roulette/scene.mjs` → `published-scene.mjs` → den gemensamma WebGL-kompositorn.
Lagerordningen förblir bakgrundsvideo → frilagd Anna → roulettebord. Annas
lobbyteaser är separat material och får inte användas som roulettehandling.

**Rekommendation:** prova Three.js för exakt en kula och vid behov en korrekt
rotor i samma scen. [Three.js VideoTexture](https://threejs.org/docs/pages/VideoTexture.html)
kan använda ett befintligt videoelement och
[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) ger en
3D-renderingsväg. Repot använder redan en lokal Three.js-distribution i
`web/public/actor-compositor.mjs`; roulettekompositorn använder egen WebGL.
Återanvänd befintlig version efter kompatibilitetskontroll. Installera inte en
ny motor eller byt hela scenuppspelningen enbart för kulans skull.

Det finns flera projekt med namnet Gravity.js. Den granskade
[@idevgames/Gravity-JS](https://idev-games.github.io/Gravity-JS/) beskriver
CSS-/DOM-kroppar och kollisioner. Den löser inte vår kamerapassning,
videoocklusion eller exakta slutposition. Valet av Three.js är en
arkitekturbedömning, inte ett färdigt eller prestandamätt rouletteutfall.

Kulan behöver en granskad kamera, radie, hjulplan, 37 korrekta fack, djupmask
för hjulkanten och en tidsbestämd bana. Samma dekoder/tidsbas ska bära Annas
kropp och händer. Fri fysiksimulering får aldrig välja ett annat nummer än
servern. Utfall får inte skickas i förväg bara för att renderaren behöver det;
pending/reveal-kontraktet ovan måste omfatta hela klientens insyn.

### Godkänd visuell målbild, 13 oktober 2026

Jakob godkände den bifogade bilden `codex-clipboard-974c63a8-ccb7-4bd9-bc79-6c34db1123b3.png`
som visuell riktning: lägre bortre bordskant, sammanhållet perspektiv, Anna
till höger och synliga händer som vilar naturligt på kanten. Den tidigare
önskan om cirka 25 graders sänkning är en visuell beskrivning, inte uppmätt
kamerakalibrering. Matcha den godkända bilden; lägg inte automatiskt ytterligare
25 graders rotation på den.

Exakt godkänd bilaga: **1673×901**, **2 386 679 byte**, SHA-256
`f1039dd96a028745b68f9e975ed51c0c07d02b2e552032e30d11528373684c78`.
En oförändrad privat kopia sparas i denna chats Codex-artefakter under
`roulette-stop/reference/anna-roulette-visual-target-2026-10-13.png`.
Den äldre originalbilden har andra bytes och annat utsnitt; den ersätter
inte detta godkännandekvitto. Bilden är en sammansatt referens, inte ett
nyregistrerat bord, dealerklipp eller publicerat rum.

Den tidigare lokala spelarplaceringen är **visuellt underkänd**: bordets
höjd/perspektiv och Annas händer motsvarade inte målbilden. De två tekniskt
fungerande UI-spelen nedan är därför inte godkända rehearsal-spelningar.
Bildgodkännandet omfattar inte hjulsiffrorna, en färdig handmask, filmens
skarvar, kulbana eller någon publicering.

Fortsätt genom att låsa referensens utsnitt och registrera bord, Anna och
bakgrund i samma koordinatsystem. Bord/hjul och insatsytor måste följa samma
geometri. Händer framför bordet ska använda samma videobildruta som kroppen
med en granskad mask. Korrigera hjulets 37 fack/nummer och prova sedan rörliga
lager i riktiga `/play/roulette`, inklusive två på varandra följande
rehearsal-spelningar. Godkänd stillbild ersätter inte den kontrollen.

### Tekniska prov och återstående bindning

- Andningsfilmen och glasögon-v2 med verifierad alfa finns. Ingen ny betald
  film har genererats i denna fortsättning. Hjulimpuls, exakt kulsläpp och
  godkända återgångar till VILA återstår; gamla felaktiga handtagningen ersätter
  inte dessa. De 37 slutlägena är ännu inte färdiga spelmedier.
- Ett fel i publicerad preview är rättat: `alpha` följer nu med från den
  frysta posten till klienten, precis som `green-screen`. Regressionen provar
  v2/v3, bytehämtning och att samma persons blackjack-idle fortfarande nekas
  i roulette. Det tillför ingen automatisk roulettebindning.
- `tools/roulette-ui-fixture.mjs` kan nu ta `--dealer-video <alpha.webm>`,
  `--background-video <background.mp4>` och valfria
  `--scene-settings <composition.json>`. Filerna ska vara förhandsverifierade;
  verktyget mäter hash/storlek men verifierar inte alfa eller visuell kvalitet.
  Det kör produktens riktiga roulettekod med SQLite i minnet på 127.0.0.2.
  Descriptorerna är fixturer: provet går inte genom verklig import/publicering.
- Anna har visats bakom produktens roulettebord tillsammans med befintlig
  gardin-MP4. Bakgrunden har SHA256
  `b08fdc4da326534d6e5e1c448f5da364ebf373c1a581eb96e3e64e24666c1854`,
  3 455 652 byte. Andningsfilmens hash finns i klippkartan. Två efterföljande
  testspel återgick till öppna satsningar utan omladdning eller loggade JS-fel.
  Detta godkänner inte poseövergångar, lipsync, loopskarvar eller livepublicering.

Provplaceringen sparas privat som `anna-player-settings-unapproved.json`.
Standardplaceringen gömde den breda Anna-filen bakom bordet: renderaren
använder fortfarande en 1080×1920-aktöryta. Den tillfälliga kompositionen
kompenserar för detta matematiskt; den är inte godkänd hand-/hjulkalibrering.
Bakgrundens 2206×946 beskärs med befintlig cover-passning. Lås samma utsnitt
för stillposter före skarpa bakgrundsbyten.

Nästa fullständiga kodsteg är ett **explicit sparat roulette-idle-val per
registrerad dealer**, separat från `idle.ready`. Det måste gå genom
projektvalidering, UI, fryst paketvalidering/capture, rumskompatibilitet och
paketsammanslagning samt versions-/readinessgrind och previewns byteväg.
Nya mediepreconditions måste förenas med befintliga playback-preconditions;
dagens `events?.mediaPreconditions ?? captured.mediaPreconditions` får inte
tappa rouletteposterna. En inventariefil eller ett mänskligt namn är ingen
publiceringsauktoritet. Spelarvyn behåller därför `dealer:null` för roulette
tills en egen fryst bindning finns. Därefter väljs faktiskt sparad Anna,
bolag och rum. Verifieringen gäller det ändrade beteendet; rehearsal används
vid ett konkret visuellt problem eller på Jakobs begäran, utan fast spelantal.

## Kan Ultralytics eller Python hjälpa?

**Ja, som mätverktyg vid förberedelsen av filmerna.** Vår rekommendation är analys en gång per källhash och därefter granskade koordinater/masker vid uppspelning. Förinspelat material behöver inte analyseras med en stor modell under varje spelares runda. Detta är vår arkitekturbedömning, inte ett uppmätt prestandalöfte.

Det är modeller och algoritmer, inte en bildbank som ger färdiga roulettefilmer. Detektion hittar exempelvis en kula i en ruta; tracking kopplar samma objekt mellan rutor; segmentering ger pixelmasken. En tränad modell innehåller inlärda vikter. Modellens befintliga kategorier och upplösning garanterar inte att en liten blank roulettekula hittas.

| Metod | Relevant funktion | Vår föreslagna roll |
| --- | --- | --- |
| [OpenCV: optiskt flöde](https://docs.opencv.org/4.x/d4/dee/tutorial_optical_flow.html) | Lucas–Kanade följer bildpunkter mellan rutor; Farnebäck ger ett tätare rörelsefält | Första baslinje för hjullandmärken och rörelse med låst kamera |
| [OpenCV: homografi](https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html) | Relaterar en plan yta mellan perspektiv | Mappa hjulplanet; kulan ovanför planet och händer kräver ytterligare djupmodell/mask |
| [Ultralytics Track](https://docs.ultralytics.com/modes/track/) | Kombinerar detektion och objekt-ID över tiden, exempelvis med ByteTrack eller BoT-SORT | Kandidat om en anpassad detektor behövs för kulan; prova beskuren hjulregion och märk rouletteexempel för träning/utvärdering |
| [Meta SAM 2](https://github.com/facebookresearch/sam2) | Punkt-/boxstyrd segmentering och spridning av objektmasker genom video | Kandidat för händer framför bordet och kulmask, med manuella korrigeringar vid bortfall |

Ingen modell är installerad eller benchmarkad i detta arbete. Nära realtid går inte att lova från en leverantörs demo: det beror på hårdvara, modell, bildstorlek och avkodning. Lås paket-/modellversioner och kontrollera [Ultralytics licensalternativ](https://www.ultralytics.com/license) innan kod eller vikter införs i produkten. Metas originaldistribution och Ultralytics paketering är olika distributionsvägar; granska den faktiskt valda koden och vikterna.

Spårning får inte användas för att bestämma spelutfallet. Den kan mäta synlig rörelse men varken laga felordnade AI-genererade siffror, upptäcka en osynlig/saknad kula med säkerhet eller ge sekretess för redan skickade resultat.

### Minsta jämförelseprov

- Använd den låsta källhashen och en lokal arbetskopia. Märk referensrutor över hela förloppet och tätare runt släpp/landning; håll tränings- och kontrollrutor isär om en detektor tränas.
- Mät rotorvinkelfel, kulcentrumfel relativt kuldiametern, maskkvalitet, bortfall och felaktiga detektioner. Följ synlighet uttryckligen: gissad/interpolerad position är inte en observation. Bortfall får aldrig bli ett godkänt slutläge.
- Föreslagen första kontrollgräns är centrumfel högst en fjärdedel av synlig kuldiameter på manuellt märkta kontrollrutor, noll objektbyten och exakt rätt fack för alla 37 renderade utfall. Gränsen ska låsas efter att kulans verkliga pixelstorlek och mätosäkerhet fastställts; den är inte uppnådd nu.
- Rapportera total tid, avkodning separat, bildrutor/sekund samt CPU/GPU/minne på faktisk maskin. Jämför samma källrutor och upplösning. Vi prioriterar reproducerbar kvalitet före livehastighet.
- Exportförslag: källhash, frameIndex med indexbas 0, faktisk presentationstid, rotorvinkel, kulcentrum/radie, synlighet, osäkerhet, maskreferens och metod-/modellversion. Formatet behöver valideras innan det blir ett runtimekontrakt; inga påhittade fält antas lagras av dagens API.

## Fråga att ge en specialistagent

> Utforma en lokal, reproducerbar kalibreringskedja för ett förinspelat europeiskt roulettehjul (37 fack, låst kamera, 1916×1080, 24 fps). Vi vill återanvända en grundfilm och styra exakt en separat kula till serverns redan fastställda nummer. Jämför OpenCV-landmärken/optiskt flöde och perspektivmodell mot anpassad YOLO-tracking och SAM 2-masker. Originalets nummerkrans är ännu inte godkänd och kulsläppsrutan saknar kalibrering: ange vad som måste bytas eller märkas manuellt, och avvisa gissningar vid morfning/ocklusion. Föreslå minsta dataset, mätbara acceptansgränser, kontrollrutor, hårdvarutest och versionsbundet JSON/maskformat. Skilj faktisk observation från syntetisk bana. Håll dealerhandlingar spelspecifika och återanvänd befintlig roulette-idle. Analysen ska ske före publicering, inte styra pengar eller utfall. Serverns reveal-gräns gäller även saldo, historik och valda medie-URL:er. Leverera kod-/licensalternativ och en liten verifierbar första milstolpe, utan produktionsskrivningar eller betalda jobb.
# Annas kopplade scen, 13 oktober 2026

Aktuell geometripassning ersätter de underkända tidigare provprofilerna.
Godkänd målbild: `f1039dd96a028745b68f9e975ed51c0c07d02b2e552032e30d11528373684c78`.
Transparent bord: `web/public/roulette/assets/anna-roulette-table-v1.png`,
1708×920, 1079892 byte, SHA-256
`dde67a019edbaf972e0a14d1cd359fb8b6de76d2bf518c954cfaf62a2eaf0966`.
Katalog-ID `roulette-anna-v1`, alltid game `roulette`. Källbildens AI-siffror
är felaktiga; den nedan beskrivna spelarrenderingen ersätter sifferringen.

Logisk spelaryta 1920×1080. Både Annas andningsfilm och glasögon-v2 är
1916×1080 och har `framing={scale:0.66,x:0.15,y:-0.16}`.
Dealer-/bakgrundstransform `{scale:1,x:0,y:0}`; bord
`{width:1.044565,x:0,y:0}`. Normaliserad handregion i källvideon:
`[[[0.585,0.65],[0.87,0.65],[0.87,0.77],[0.71,0.82],[0.64,0.845],[0.615,0.848],[0.595,0.82]]]`.
Den gemensamma rendereraren ritar kroppen och händerna ur samma avkodade ruta.
En 480×270 arbetsmatta inom regionen släpper fram hud/ljusa ärmar, inte västen,
och uppdateras med videorutan. Detta är en kalibrerad färgheuristik, inte en
generell segmenteringsmodell; annan klädsel/ljussättning behöver ny granskning.
Bytt basfilm i Admin rensar tidigare handmask och varianter.

Privata bevis ligger i Codex visualizations/2026/10/13/
01a13532-b75d-75f0-8507-e70a6c69612e/roulette-stop:
`anna-scene-manifest.json`, `anna-accepted-base-round-1.png`, `anna-accepted-base-round-2.png`,
`anna-base-two-rounds-evidence.json` (33 svart, 6 svart). Filnamnets accepted
anger agentens val av tekniskt fungerande bas, inte Jakobs visuella godkännande.
De innehåller två faktiska motorutslag med
ett isolerat testsaldo, inte produktionspublicering. Matchande hjulstart och
utfallsanimering saknades i detta första basprov; se fortsättningen nedan.

**Ny visuell bedömning:** glasögon-v2:s alfaspår är tekniskt giltigt men
filmen har synliga hål i händer och fluga mot MP4-bakgrunden. Den togs ur
det slutliga Anna-manifestet; start-/slutpose är fortfarande unverified.
Behåll originalet som underlag men publicera inte detta klipp.

Bildgenerator: inbyggd imagegen, transparent_background=true, godkänd målbild
som enda referens. Exakt prompt:

> Use case: background-extraction. Edit target: the supplied approved roulette scene. Deliver a transparent PNG foreground table layer for a layered game scene. Remove the entire woman, including her hands, arms, and clothing, and remove the entire casino background. Keep ONLY the roulette table and roulette wheel. Preserve the table's EXACT position, scale, shape, perspective, lighting, materials, green felt and printed layout within the original wide image canvas. Do not center, zoom, tilt, extend or reframe the table. Keep the empty transparent upper region where the room and woman were. Reconstruct only the small wooden rim that was hidden under her hands. Preserve the front edge being cropped at the image's bottom. Do not invent another table or add chips, balls or people. All space outside the table must have actual alpha transparency, not a checkerboard. This is an extraction of the approved composition; keep the original approximately 1673:901 aspect ratio and spatial registration.

## Exakt rotor och en kula i den riktiga spelaren

`web/public/roulette/wheel.mjs` ritar en separat canvas endast för verifierat
design-ID `roulette-anna-v1`; samma publicerade bordstransform gäller även i
förstoringen. `WHEEL` och `pocketColor` importeras från spelmotorns regler:
inga bildgenererade siffror eller slumpval av utfall. Rotorn har 37 fack,
ett grönt 0, rätt ordning och färger. Den orörda PNG:n är ett källmaterial;
den korrigerade sifferringen finns i spelaren, inte inbakad i filen.

Kalibrering i bildens 1708×920-koordinater: rotormitt `(848,480)`,
ytterradie 146, innerradie 80, perspektivets y-skala 0,315. Kulbanan går från
mitt `(848,461)`/radie 196 till `(848,480)`/radie 107. Mässingsaxelns kontur
maskerar den bakomliggande rotorn/kulan. En enda kula ritas per ruta.
Rotorn accelererar, kulan går motsols och fångas i det fastställda facket
vid 80 procent av de nio sekunderna; därefter följer den samma fack till
stopp. Slutnumret placeras framtill. Detta är kontrollerad presentation,
inte en fysiksimulering eller nytt slumputfall. Inget Runway-/Three.js-jobb
behövs och inga 37 stora filmer lagras.

`app.mjs` använder endast `result.round.event.outcome.number` från bekräftat
serverkvitto. Spelkontrollerna är låsta tills visningen är klar. Scene-ready
inväntas med begränsad väntan; fel/stängning avslutar visningen utan nytt
kommando. Reducerad rörelse ger direkt slutläge. Bakgrundsflik har en timer
utöver requestAnimationFrame. En omladdning återger redan bokförd rundas
slutläge; ett okänt kvitto återhämtas med samma request-ID.

**Sekretess kvarstår som separat serverarbete:** dagens API bokför och skickar
nummer, saldo och payout före animationen. Fördröjd text är ingen sekretess;
refresh, nätverk och andra saldovyer kan redan visa resultatet. Inför verklig
pending/reveal med samordnad historik/saldo innan någon sådan garanti ges.

Testerna i `test/roulette-wheel.mjs` och `test/roulette-room-http.mjs` ingår
i ordinarie fulla pre-commit. De provar alla 37 slutnummer vid flera
startvinklar, fångat fack under inbromsning, kontinuitet, två efterföljande
spelningar, reducerad rörelse, dold flik, mediafel och långsam scenstart.
Mänsklig rörelsebedömning och ett separat accepterat Anna-handkast återstår.

Slutkontroll av `07b33c4f`: full pre-commit 3392 pass, 0 fail, 11 skip.
I faktisk spelare med oförändrat Anna-/MP4-manifest gick två rundor efter
omladdning i följd: **30 röd, 2 svart**. Saldo 495 → 490 → 495 USD;
varje runda hade en insats på 5 USD och ett unikt kvitto. Första kvittot gav
ingen payout, andra 10 USD. Slutkulan låg i motsvarande fack. Inga fångade
browserfel/varningar. Två skärmbilder och `anna-wheel-two-rounds-evidence.json`
sparades privat i samma roulette-stop-mapp. Den tidigare rundan 19 i samma
testserver föregick omladdningen och ingår inte i dessa två slutrundor.
Detta verifierar lokal produktkod med isolerad databas, inte driftsatt
produktionspublicering eller ett mänskligt slutgodkännande av rörelsen.
