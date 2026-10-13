# Roulette

## Aktuell spelarkoppling, 13 oktober 2026

`codex/roulette-anna-binding` kopplar en uttrycklig `dealers[].rouletteIdle`
till den befintliga `/play/roulette`-spelaren. Admins andnings-/glasögonkort
kan kopplas, sparas och återläsas som utkast. Publicering fryser bas, högst tre
varianter, inramning och handpolygoner med exakta medierevisioner. Blackjack
använder fortsatt sitt eget idle. Nya bindningar kräver runtime **v15**;
ingen SQL-migration. Äldre rouletterum utan sådan bindning förblir spelbara
med `dealer:null`, aldrig med blackjackfilmen.

Anna-provet använder den befintliga andningsfilmen i alpha-WebM, MP4-bakgrunden
och `web/public/roulette/assets/anna-roulette-table-v1.png`. Glasögon-v2 har
nu underkänts visuellt: friläggningen ger hål i händer och fluga. Filen är
bortvald i slutprovet; variantstödet inväntar korrigerade bytes. Bilden är ett nytt
transparent bordslager från den godkända målbilden, genererat med den inbyggda
bildgeneratorn; [prompt och kalibrering](UTFALLSFILMER.md#annas-kopplade-scen-13-oktober-2026)
finns sparade. Det ersätter inte andra bord. Bordets exakta katalogidentitet
väljer rätt klickgeometri; ett okänt bord får använda satsningsmenyn.

Två på varandra följande UI-rundor kördes utan omladdning i faktisk spelarkod,
med riktig frozen-capture och offentliga preview-/room-läsare men isolerad
SQLite och lokala mediebytes: **33 svart, sedan 6 svart**, testsaldo 500 → 495
→ 500 USD. Det är inte en livepublicering eller godkännande av kompletta
spelfilmer. Det tidigare basprovet saknade hjulstart och utfallsanimation.
Fortsättningen ritar nu exakta 37 hjulsiffror från motorns `WHEEL` och en
separat kula som under 8,5–12 sekunder landar i serverkvittots fack, på olika
ställen runt hjulet beroende på rundans ID. Annas
placering och MP4-filen är oförändrade. [Kalibrering, tester och kvarvarande
sekretessgräns](UTFALLSFILMER.md#exakt-rotor-och-en-kula-i-den-riktiga-spelaren).
Bakgrund och Anna fortsätter mellan rundorna; en valfri variant startar tidigast
efter tre basloopar och inte under en pågående serverbegäran.

En ny tiosekunders startfilm är skapad och frilagd efter Jakobs godkännande.
Valfritt `rouletteStart` kopplar filmens egen tid till hjulstart/kulsläpp och
återgång till idle. Två tekniska UI-rundor gav 8 svart → 3 röd. Gesten behöver
förbättras före produktionsgodkännande; se [granskningen](UTFALLSFILMER.md#ny-startfilm-och-variationsspelning).
Godkänt material ska gå via mediebank och Vercel Blob, inte Runways tillfälliga URL.

`tools/roulette-ui-fixture.mjs --scene-manifest <privat JSON>` återspelar samma
kedja utan produktionskonto. Manifestet anger explicit lokala filer och SHA-256,
framing, foregroundPolygons samt vanliga composition settings. Test-UUID:n är
isolerade och får inte användas som produktionsregistrets identiteter.

[Signaler, materialinventering och klippkarta](KLIPPKARTA.md) beskriver de
separata blackjack-/roulettefacken, bild-/videolagren och vad som återstår
före automatisk spelkoppling.

[Genomförandeplan och trackingutredning](UTFALLSFILMER.md#genomförandeplan-säkert-material-först)
anger nästa steg, jämför OpenCV/Ultralytics/SAM 2 och innehåller en färdig
fråga till en specialistagent. Det gamla [kulprovet](underlag/roulette-stop-test.html)
bevaras enbart som historiskt geometriprov. Jakob har uttryckligen valt bort det
som produktionsunderlag. Fortsättningen använder riktiga `/play/roulette` och
dess befintliga videosystem; se [aktuellt genomförande](UTFALLSFILMER.md#produktionsspår-threejs-och-annas-spelarkoppling).

Jakob har godkänt en [visuell målbild för Anna och bordet](UTFALLSFILMER.md#godkänd-visuell-målbild-13-oktober-2026).
Den tidigare lokala spelarplaceringen är underkänd. Bildens perspektiv,
bordshöjd och handkontakt styr fortsättningen; rörlig spelacceptans återstår.

## Anna Jonsson: roulettefack, alfa och Runway-prov (13 oktober 2026)

**Status för den ursprungliga startuppsättningen:** implementerat på featuregrenen `codex/roulette-alpha-media`, inte ett kvitto på publicerad Anna eller färdig utfallsbank. Jakob beställde uttryckligen Runway-prov denna dag. Originalen, genererade filmer, exakta promptar, mätningar och ett fristående scenprov sparas privat utanför Git i Codex visualizations/2026/10/12/01a1319d-73c5-7801-8e65-27e47532075b. Senare samma dag tillkom [kompakt utfallsplan och isolerat kulprov](UTFALLSFILMER.md) samt [verifiering av levererade original](KLIPPKARTA.md#nya-lokala-original-13-oktober). De ändrar ingen spelmotor eller plånbok.

### Importkontrakt till mediaagenten

Biblioteket får en egen Roulette-grupp via `lab/lib/roulette-media.mjs` och `dealerMediaEvents(project)`. Den ändrar inte projektets blackjack-event, kortfack, publicering eller runtime/readiness-version.

| Fack | Fil | game / action | Pose |
| --- | --- | --- | --- |
| roulette.reference / VILA | frilagd PNG | roulette / reference | VILA → VILA |
| roulette.idle / breathing | WebM eller grön MP4 | roulette / breathing | explicit granskning, initialt unverified |
| roulette.idle / glasses-clean | WebM eller grön MP4 | roulette / glasses-clean | explicit granskning, initialt unverified |
| roulette.wheel-start / wheel-start | WebM eller grön MP4 | roulette / wheel-start | explicit granskning, initialt unverified |

Poser väljs separat bland VILA, WHEEL och unverified. En film med samma poser kan ha en annan handling. Roulettefack är registrering och provning, **inte automatisk spelkoppling**. `videoFitsEvent` accepterar inte dem som blackjackhändelser. Den nya separata mediaassistentens utkast måste anslutas till samma katalog av dess ägare; den kopplingen ingår inte här.

Forge använder uttryckligen `blackjackMediaSlots(project)` och behåller sin
canonical katalog med 40 blackjackfack inklusive poser/lager. Roulettefacken
hör till den utökade intagskatalogen `dealerMediaSlots`; de kan inte bli
ospecificerade givnings-, sko- eller reaktionsjobb. Ett roulette-slotId avvisas
före providersubmission och innan ett genereringsjobb sparas. `videoFitsLine`
och `videoFitsEvent` avvisar roulette i blackjackens runtime. En roulette-Forge
kräver eget accepterat rörelse-/geometrikontrakt innan den kan öppnas.

Metadataformatet beskriver PNG för VILA-referensen, men aktuell native
prepare-väg avvisar PNG med `studio_media_content_type_unsupported` före grant.
VILA är därför en lokal bildreferens tills lagringskedjan stöder den; tidigare
PNG-kvitton är inte bevis för dagens API. WebM-intaget bevarar bytes/hash.
`compositing: {mode: "alpha"}` behåller originalets alfa och stänger av
grönnycklingen, även på gröna detaljer i dealern. Grön MP4 kan fortfarande
väljas som green-screen. En svart bakgrund är inte alfa.

**Ordning vid driftsättning:** nya PNG-/alfa-/roulettefält kräver ett exakt
v12-svar från Render (`mediaAlpha=png-vp9-v1`, `rouletteMedia=action-pose-slots-v1`).
V11:s dealerSets och materialTrash behålls. Native prepare, commit och classify
kontrollerar stödet före Blob-grant/bytehämtning och utanför SQL; registrering och
omklassificering kontrollerar samma avgränsade rättighet igen inne i transaktionen.
Ett klartecken för äldre metadata ger inte rätt att lägga till alfa eller
roulettefält. Frysta paket med nya media omfattas också. Äldre/downgrade-svar
eller saknade flaggor ger `studio_presentation_runtime_update_required` (503),
utan ny registerskrivning. Motorn måste stödja v12 före första nya registrering;
en redan uppdaterad webbapp håller utkastet spärrat tills dess. Efter registrering
får motorn inte rullas tillbaka till en parser som saknar stöd för sparade records.
Ingen migration eller automatisk publicering behövs för denna spärr.

Kontrollen har två nivåer: servern kontrollerar PNG:s avkodade alfapixlar respektive VP9-WebM:s alfamarkering och BlockAdditional-payload; webbläsaren avkodar början, mitten och slutet före alfauppladdning/omklassificering. Helt opaka och helt tomma rutor avvisas. Tre stickprov bevisar inte alla filmrutor, fina hårkanter eller rätt handkontakt. Serverns spårkontroll ensam bevisar inte en användbar matta. Godkänn varje klipp visuellt innan publicering. Förhandsvisningen stöder både PNG och video med samma friläggnings-/visningsprofil.

### Faktiskt producerad startuppsättning

Alla filmer är tysta, 24 fps och har fast kamera. Runway gav 1916×1080 för dealerfilmerna, trots 1080p-beställningen. Behåll faktiska mått; automatisk beskärning/förstoring utifrån filnamn är förbjuden.

| Fil | Mått / längd | Granskning |
| --- | --- | --- |
| runway-idle-alpha.webm | 1916×1080 / 10,042 s | Andningsvila; avkodad alfa och två sammanhängande starter i privat scenprov |
| runway-glasses-alpha-v2.webm | 1916×1080 / 10,042 s | Tar av/rengör/sätter på glasögon; andra friläggningen har faktisk alfa, två starter provade |
| original spin_transparent.webm | 1080×1920 / 10,042 s | Hjulstart återanvänds; geometrisk handträff ännu inte accepterad |
| runway-bg-source.mp4 | 2206×946 / 10 s | Liten gardinrörelse; annan bildkvot än originalbakgrunden, behöver matchande stillposter |
| runway-table-source.mp4 | 1920×1080 / 10 s | **Underkänt:** tillagd ljus hjulränna och förändrad geometri. Får inte användas som utfallsfilm |

Första `runway-glasses-alpha.webm` hade alfaspår men helt opaka avkodade rutor. Den är underkänd och behålls enbart som negativt testbevis. Friläggningen gjordes om med subjektet `woman`; originalfilmen ändrades inte. Godkänd alfateknik är fortfarande inte produktionstillstånd eller bevis på en sömlös viloloop.

SHA-256: andningsvila `02700429c0536003694dd0e595f3b5d5864bf12e580c0539c252f1793d8a1a34`; glasögon v2 `f64d2b014bb28704ed99d5f220268466b4153fc489044eb6204a16aa647ffcb4`.
Runway-jobb: andning `4f2e9a3a-c191-448b-951c-df194071ac27`, glasögon `d42e38b2-b663-4be2-9cdb-b8b54303bb37`, glasögon-alfa v2 `849f42a6-77e2-4b2f-9d48-839ccca4c625`, bord `6fb63dd2-8a33-4de5-b147-15903c8c553d`, bakgrund `ce24bb05-be84-4645-b790-ab5fac615ec5`. Starta inte om betalda jobb bara för att en signerad länk löpt ut.

### Låst provgeometri och händer framför bordet

Logisk scen: **1920×1080**. Koordinater är bildpunkter från övre vänstra hörnet. Mobil skalar hela scenen tillsammans och erbjuder närbild; den kräver inte en separat dealerfilm.

| Lager / källa | x | y | visad bredd | källmått |
| --- | ---: | ---: | ---: | --- |
| Bord | 134,4 | 270 | 1651,2 | 1672×941 |
| Anna VILA PNG | 580 | 42 | 1104 | 1672×941 |
| Ny andning / glasögon | 580 | 42 | 1104 | 1916×1080 |
| Ursprunglig hjulstart | 551 | −82 | 1048 | 1080×1920 |

Höjden beräknas proportionellt. Dessa är **egna visningsprofiler per format**, inte en beskärning. Profilen är sparad i det privata scenprovet och dess JSON. Den äldre koordinatguidens (960,330) med skala 2/3 är ett separat mål och får inte blandas med dessa placeringar.

Lagerordning: bakgrund → kropp → bord → händer/armar. Kropp och händer kommer från **ett videoelement och samma avkodade bildruta**, med samma skala, position och klocka. Samma ruta kopieras till en 1080×1920 aktöryta; en kompletterande mask avgör vad som ligger framför bordet. Två spelande videoelement används inte.

Privat maskprov: 270×480 arbetsmask, ljus skjorta/hud (R>70, G>53, B>35), begränsad till respektive källbilds y-band 470–805 för VILA, 539–924 för nya landskapsfilmer och 385–755 för porträttfilmen. Masken korsas med bordets alfa >127. Maskcache invalidieras för varje ny ruta. Detta är en **heuristisk provmask**, ingen färdig semantisk produktionsmask. Profilens handen-mot-hjulet-träff är fortfarande fel: den ursprungliga gesten når cirka x772 medan spindeln ligger vid x960. Flytta inte hela dealern per ruta för att dölja felet. Kalibrera/beställ en ny matchande gest och en tidsregistrerad mask innan spelkoppling.

### Föreslagen händelsekedja (ännu inte inkopplad i roulette)

1. Laddad scen visar VILA; reducerad rörelse visar stillbild. Att välja marker/ändra insats startar ingen hjulgest.
2. **Spela** skickar sparat kommando med requestId, version och satsningar. Vid tappat svar återförsöks exakt samma kommando. Ingen ny dragning och ingen gissad vinnarfilm.
3. Först efter serverns bekräftade satsning startar hjulgesten en gång, deduplicerad per spelar-/rumsscope + rund-ID. Ett återläst kvitto får inte starta gesten två gånger. Dagens API lämnar redan slutresultatet; sekretess under filmen kräver det ännu inte implementerade pending/reveal-kontraktet i UTFALLSFILMER.md.
4. En kalibrerad releaseFrame i en separat kulsläppsgest anger när en enda kula lämnar handen. Hjulimpulsens cue styr rotorn; kulsläppets cue styr kulan. Den neutrala gemensamma rörelsen får inte antyda ett annat slututfall.
5. Serverns offentliggjorda utfall väljer ett av 37 godkända slutlägen: separat styrd kula eller kort hjulavslut. Före reveal ger mediafel neutral väntvy; efter reveal stillbord + begriplig resultattext. En felande bana får inte ersättas av lokal slump eller fel nummer. Se UTFALLSFILMER.md.
6. Återgång sker till en kompatibel VILA-pose efter sekvensen. Sessionsbyte avbryter tidigare scope. Glasögonvarianten får köras under lugn vila, aldrig över hjulstart/resultat; låt den avsluta säkert eller använd verifierad övergång.

Det nya importstödet bygger inte denna orkestrering, en 37-utfallsbank eller en publicerad Anna-konfiguration. De privata spelknapparna provar bara en gång per klick. Framtida releaseFrame, kontaktyta och posegodkännande måste bindas till filens hash, inte dess namn.

Bakgrund: befintlig background-playback-policy har intervallstöd. För prov kan regeln vara everyMs=25000, maxDurationMs=10000, cooldownMs=25000, maxPerMinute=3, maxSecondsPerMinute=30. Budgeten kan skjuta upp starter; 25 sekunder är ungefärligt. Använd första rutan i den genererade filmen som stillposter med samma geometri. Lägg en prioriteringsspärr för hjulgest/resultat innan detta kopplas till roulette. Pausa vid dold flik och använd stillbild vid reducerad rörelse. Ingen sådan ny rumsregel är publicerad här.

### Exakta genereringspromptar

Originalbilden för Anna används som både start- och slutreferens. Svart genereringsbakgrund friläggs därefter; MP4-originalet bevaras. Den isolerade friläggningen använder subjektet `woman`.

**Andningsvila**
> Locked-off photorealistic studio cutout of the exact woman in the reference. Preserve her identity, glasses, black waistcoat, white shirt, bow tie, hands clasped at waist, right-side position, scale, full image bounds and empty left side. One subtle natural breathing cycle, a single gentle blink, a barely perceptible friendly smile. Hands stay clasped, feet and body stay in place. End in exactly the initial resting pose for a seamless VILA to VILA loop. Static plain black background, no scenery, no table, no props, no camera motion, no zoom, no lighting change, no talking. Only subtle realistic human motion; preserve hand anatomy and glasses.

**Glasögonvariant**
> Single continuous photorealistic locked-camera cutout of the exact mature female casino croupier in the reference image. Keep her face, hair, clothes, body position, right-side framing, scale and all empty space unchanged. She gently removes her eyeglasses with both hands, carefully cleans one lens with a small white lens cloth, puts the same glasses back on, and returns her hands to the exact clasped resting pose in the reference. Calm modest expression, realistic fingers and optical reflections. Start and finish at the same resting pose, pause briefly at each end. Static pure black background. No table, environment, camera move, zoom, speech or lighting changes. A natural quiet idle variation, not a theatrical performance.

**Bakgrundsvariation**
> Photorealistic empty elegant casino room, exactly the architecture and composition of the reference. Locked tripod camera, fixed lens and framing throughout. All furniture, walls, woodwork and lamps remain unchanged. Only one very gentle ripple travels through the sheer curtain in the far left window, settles, and returns to the exact still starting appearance. The rest of the room stays still. No people, no dealer, no tables, no new objects, no lighting flicker, no camera motion or zoom. Quiet natural ambient movement appropriate behind a casino dealer; clean seamless still start and end.

**Underkänt bordprov — historik, inte nästa produktionsprompt**
> Static tripod shot, exact supplied roulette table from the player's perspective. Every part of the table, green betting cloth, printed numbers, wooden surround, brass spindle, padding, camera framing and illumination stays absolutely fixed. Only the inner roulette rotor turns smoothly clockwise at steady realistic speed. A single small polished silver roulette ball circles counterclockwise in the OUTER ivory ball track, staying on that outer track throughout the shot. It never drops into a numbered pocket and never indicates a winning number. Physically believable specular reflections and motion blur. No dealer, no hands, no new objects, no zoom, no moving camera, no morphing wood or markings. Retain the flat black exterior background. This is a neutral transitional spin plate, not a roulette outcome.

Formuleringen ”ivory ball track” var fel för originalbordet och får inte återanvändas. Nästa bordbeställning ska uttryckligen låsa den befintliga mörka rännan, alla markeringar och kamera; full filmgranskning mot originalet krävs även då. AI-film ensam garanterar inte exakt europeisk nummerföljd eller RNG-styrd landning.

### Bevis och gränser

Privata kvitton: `anna-intake-receipts.json` (fyra faktiska filer genom isolerad native uppladdning/återläsning, idempotent commit, ny repository-instans och oförändrade originalhashar), `anna-browser-alpha-receipts.json` (avkodade pixlar och avvisat opakt motexempel), `runway-measurements.json` (faktiska mått/fps/hash), `runway-starter-manifest.json` (prompt/jobbreferenser). Testcachen använder simulerad privat Blob och isolerad minnespool, **inte produktions-Neon eller en verklig Blob-publicering**. Desktop- och mobilprov har sparats; det är Chromium med emulerad mobilbredd, inte fysisk iOS-/Android-acceptans. Kantkvalitet, helrörelse, sömlös skarv och handkontakt är fortsatt manuell acceptans före produktion.


Samlad ingång för implementerat spel och mottaget medieunderlag. Ursprunglig kodinventering: main `426fa11417695025e2a0ee194825110f48f6b4af`; roulettevyn är senare levererad på `161957f1ca56bf35bdb09a2926b6a48c384b3e9a`, verifierat 13 oktober 2026. Underlagets bedömda fullständighet är **75 %**. [Källregler](../README.md), [teknisk referens](TEKNIK.md) och [källregister](KALLOR.json).

## Implementerat på main

För klippbegrepp och format, börja i [gemensamma referensen](../KLIPP-OCH-FORMAT.md). [37 kompakta utfall](UTFALLSFILMER.md) beskriver det nya produktionsmålet, kopplingen till sparade serverkvitton och acceptanskraven. Utfallsstödet är ännu inte implementerat på granskad main. Webbplatsens AI-funktion ingår inte i dokumentationsuppdraget.

Europeisk roulette med enkel nolla, 37 fack och oberoende serverdrag via crypto.randomInt(0,37). [Generatorn](../../../web/games/roulette/index.mjs) accepterar operatörs-, rums- och rund-ID, inte seed eller önskat nummer. Nollan ingår inte i röd/svart, jämn/udda eller låg/hög. [Satsningskatalogen](../../../web/games/roulette/rules.mjs) har straight, split, street/trio, corner, six-line, dozen, column och outside. Nettovinster: 35:1, 17:1, 11:1, 8:1, 5:1, 2:1 respektive 1:1. Ingen La Partage eller En Prison. Gränser: 1–2 000 per fält och 10 000 per runda.

POST /api/roulette/table hanterar state och spin. Servern kontrollerar session, spelare/valuta och publicerat rum. Spin tar requestId, aktuell version, bets och context. [room.mjs](../../../web/games/roulette/room.mjs) validerar/avräknar; [storage.mjs](../../../web/games/roulette/storage.mjs) skriver saldo, transaktioner och kvitto atomärt i SQLite eller PostgreSQL. Exakt återförsök använder samma sparade kommando, aldrig ett nytt slumpanrop för att ersätta ett borttappat svar. De senaste 20 kvittona bevaras per spelar-/operatörs-/rumsscope; gamla versioner avvisas.

Spelingång: /play/roulette?operator=<slug>&table=<room-id>&dealer=<dealer-id>. Native demo/inloggning delas med blackjack, men roulette har egna regler och ingen sko. Detta är personliga rundor, inte ett gemensamt tidsstyrt multiplayerhjul. Partner-launch-konton är spärrade tills roulette stöds i deras plånbokskontrakt.

Den separata /roulette-test är en publik noindex-testyta utan spelkonton, insatser eller databassaldo. Blanda inte dess stateless provsnurr med rummets beständiga kommandon.

## Scen och kodägande

| Ansvar | Källa |
| --- | --- |
| Rumstillgång och publiceringskontroll | [access.mjs](../../../web/games/roulette/access.mjs) |
| Sida och resurser | [http.mjs](../../../web/games/roulette/http.mjs) |
| HTML, CSS och interaktion | [web/public/roulette](../../../web/public/roulette/) |
| Dealer/bord/bakgrund från fryst paket | [scene.mjs](../../../web/public/roulette/scene.mjs) |
| Gemensam publicerad scen | [published-scene.mjs](../../../web/public/published-scene.mjs) |
| Bolag, game och rum | [presentation-room-contract.mjs](../../../web/presentation-room-contract.mjs) |

Scenen läser /api/operators/<slug>/rooms/<room-id>/preview med revision och dealer. Ett rum har en speltyp; återanvända bakgrunder gör inte blackjackens rörelsebank till en roulettebank. Den frysta blackjackkopplingen `idle.ready` lämnas inte ut för roulette. En egen publicerad roulettekoppling för dealer återstår. Serverns kvitto bestämmer resultat och saldo; bildens eller en AI-films sista nummer gör det aldrig.

## Mottagen bordsspecifikation

[roulette_specifikation.json](underlag/roulette_specifikation.json) hittades i Desktop/videoskapare/roulette/, inte i den angivna bord/-mappen. Originalbytes bevaras med hash. Det är en prototypspecifikation med uppgifter från dess författare, ingen ny egen bild-/videomätning.

Den anger en RGBA-PNG på 1672×941, 2 229 281 byte, bildhash dcf2fe0eb5332bce7d599f3e41bc210b14a3bc9605444acc41634a2c2e28976b. Ingen verifierad ICC/färgrymd; delar av bordet har alpha 253/255. Kamera, fysisk bordsskala och kontakt mot VILA/REDO är inte uppmätta. Källan anger upprepade/otydliga hjulnummer, overifierad europeisk nummerföljd, overifierat satsningsmönster och productionApproved=false.

Beställningen begärde 15 sekunder, 1080p och stilla kamera. Beställd timing är 0–0,6 stilla, 0,6–4 acceleration, 4–7 fart, 7–14,4 inbromsning och 14,4–15 stilla. I denna äldre fil är actualOutput fortfarande okänt och SUBMITTED_PENDING bara en historisk status. Den ska inte användas för att starta om ett betalt jobb.

Svart videobakgrund är inte alfa. Global borttagning av svart skulle även skada svarta nummerfält och räcken. En statisk mask kan skydda bordets omgivning men bevisar inte korrekt sifferföljd inne i rotorn. Förslaget om separat stel rotor och kontrollerad vinkel är en produktionsidé, inte implementerat utfallsstöd.

## Levererad roulettevy i PR47

[PR47](https://github.com/Jakeminator123/scoutgaming/pull/47), sluthead `c2623d9bde84904df85c53927ca30e8a40e314f9`, är mergad till main som `161957f1ca56bf35bdb09a2926b6a48c384b3e9a`. Senare källmetadata finns i [media-specification.json](../../../web/games/roulette/media-specification.json). Egna leveranskontroller 13 oktober: samtliga faktiska PR-/main-CI-steg gröna, Vercel Production READY med www på exakt merge-SHA och Render LIVE med exakt `/__cloud/version` och HTTP200 health. De sex publika UI-filerna gav HTTP200 och hashmatch mot mergekoden. Ägarens separata browserkontroll omfattade huvudvyn, Mer och fokusåtergång utan satsningar.

Ägarens kvitto där beskriver MP4/H.264/yuv420p, 1916×1080, 361 rutor, 24 fps, 15,041667 sekunder, 10 317 238 byte, inget ljud/alfa; hash 7702cec6f0ec5ec2e1767608781588e8f6b182a0fbc652a952706f8288314195. Rutor 0/180/360 uppges granskade. Full rörelse, skarv, maskregistrering och utfallsmappning är inte godkända. Detta är senare dokumenterat ägarbevis, inte en egen ny mätning i denna uppgift.

Den levererade vyn lägger satsningar på fotografiskt bord med mobilförstoring och tillgänglig dialog. Marker, ångra, Spela och Mer finns i huvudvyn; övriga val ligger i Mer. Runtime har frivilligt stöd för statisk PNG-alpha-mask. Förslagen om ny dealer till spelarens högra sida och ankare för ögon/händer är fortfarande okalibrerade. Nya privata dealerfiler är inte publicerade eller accepterade som idle. Blackjack-template med null-geometri ersätter inte blackjackens befintliga Forge-kontrakt.

## Vad saknas före godkänd medieintegration?

Verifierad hjul-/satsningsgrafik mot kodens europeiska sekvens och färger; kalibrerad kamera/bord/dealer; registrerad mask och fullrörelsegranskning; vald koppling mellan dekorativ film och serverhändelser; godkända roulette-specifika poser/rörelser/tal om sådana ska införas. Dessutom krävs riktig mobil/desktop, tangentbord, reducerad rörelse, fokusåtergång och sammansatt publicerad scen.

Regel-, HTTP-, SQLite- och isolerade PostgreSQL-prov beskrivs i [TEKNIK.md](TEKNIK.md). Inget produktionssaldo ändras för acceptanstester. Dokumenten ger inget mandat till datamigration, ny publicering, byte av PAOW/Johanna eller betald filmgenerering.
