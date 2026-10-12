# Aktuell handoff — Scoutgaming

Läget 12 oktober 2026, omskrivet mot koden på integrationsbranchen
`jakob/repo-ordning` och ajour med `origin/main` `deea75a5`.
Äldre avsnitt, inklusive per-rad-kvitton som inte upprepas här:
`git show 00ea55c5:docs/JOHN-HANDOFF.md`.

## 1. Aktuellt läge

Publik sajt: https://www.scoutgaming.tech (apex `scoutgaming.tech` är 308 till www).
Vercel-projekt `scoutgaming`. Spelmotor och plånbok: Render `croupier-v2`.
`/studio` är labbets Next-basePath, inte en produkt. Kort, sko, saldo och
utbetalning ägs av servern.

| Nivå | Vem | Adress | Meny i koden |
| --- | --- | --- | --- |
| 1 | Intern personal | `/control` | Studio, Spelbolag, Drift, System. Sidfot: Översikt och Guide & hjälp. Källa: `lab/lib/scout-navigation.mjs`. |
| 2 | Operatör | `/partner`, `/partner/login`, `/partner/{slug}` | Översikt, Spelrum, Team & behörigheter (kräver `team.read`), Integration. Källa: `lab/components/kevin-bo/partner-copy.mjs`. |
| 3 | Spelare | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack` | Lobby, profil (namn och språk), historik. Saldo är serverägt. |

**Nivå 1, sidor.** Studio: Dealers & klipp `/control/clips` (med fliken Skapa
material, tidigare Dealer Forge), Bord & bakgrunder `/control/library`,
Sammansättningar `/control/compositions`. Spelbolag: Bolag & team `/control/companies`, Spelrum
& publicering `/control/rooms`. Drift: `/control/administration?tab=operations`
och `?tab=finance`. System: `?tab=accounts`, `?tab=partners`, Agentmodeller
`/control/openclaw`, Intern agentchatt `/control/openclaw?tab=chat`.
Provspelning & logg `/control/rehearsal` är kontextuell (dealer, sammansättning,
bolag, rum), inte en global driftvy.

Sidor som finns kvar utan egen menyrad: Spelhändelser & villkor
`/control/events` (översikt utan `?event=`, editor med det), Klippbibliotek
`/control/videos`, Svarsbibliotek `/control/replies`, Probe `/control/probe`,
inloggning `/control/login` och lösenord `/control/set-password`.
`/control/administration?tab=media-review` finns kvar i administrationen.

**Omdirigeringar som ska fortsätta fungera.** `/` i labbet (permanent) och
query bevaras till `/control/clips`. `/control/preview` → `/control/compositions`.
`/control/lanes` → `/control/rooms`; `?tab=companies` → `/control/companies`.
`/control/activity` → `/control/rehearsal`. `/control/zones` och `/zones` →
`/control/preview` → sammansättningar. `/control/backgrounds` →
`/control/compositions`. `/control/tree` (permanent, query bevaras) →
`/control/events`. `/control/operator-chat` → `/control/openclaw?tab=chat`.
`/control/dealer-forge` → Dealers & klipp, fliken Skapa material, med dealer-,
sammansättnings-, bolags- och rumskontext bevarad även efter inloggning.
`/lissabon` → `/control`. Oprefixade `/videos`, `/events`, `/guide`, `/probe`,
`/openclaw`, `/administration`, `/activity` och `/tree` leder in i `/control/…`.
Gammal `lane` i Studio accepteras och länkar skrivs som `composition`
(`lab/lib/control-flow.mjs`). `/demo` leder till `/play` och behåller en giltig
`operator`. `/labb-lissabon` svarar 307 till Render-labbet.

**Nivå 2.** Vanliga partnerrutter faller inte tillbaka på demodata. Intern
admin använder samma N1-inloggning. Operatörspersonal ser bara aktiva
medlemskap. Bolag, roller och medlemskap skapas på `/control/companies`; ny
e-post får aktiveringslänk till `/partner/set-password`. Utseende och tillåtna
sammansättningar delar en editor, med `presentations.configure` och
revisionskontroll. `lab/components/kevin-bo/navigation.mjs` är prototypkatalogen
(Livebord, Pitbossar och liknande), inte den levande menyn.

**Nivå 3 och spelare.** Presentationen måste vara `local` eller `layered`.
Allt annat kastas med `Presentation requires registered cloud media`
(`web/public/app.mjs`). Layered använder `layered-presentation.mjs`. Övriga
publicerade rum använder `local-presentation.mjs` tillsammans med
`performance-player.mjs`. `dealer-engine.mjs` är kvar som Studios
originalmediareserv (`lab/lib/original-media-server.mjs`), inte som den
publicerade spelarens motor. `/dealer/…` och `/dealers/{astrid,vera,amira,mei}/…`
svarar 410 (`web/server.mjs`). Amira är inte en aktiv inbyggd dealer. Astrid,
Vera och Mei spelas bara när de är registrerade med giltig media och ingår i
den valda publiceringen. Produktionsläsningen 12 oktober (BASLINJE §8, endast
SELECT): ingen av Astrids 10 registerposter matchar de gamla Git-filerna, och
inget av 29 paket med presentationsdata pekar på dem via hash.

**Drift.** CI och Studio kör Node 24: `lab/package.json` anger 24.x
(`12a12fd6`). Migration 008 är körd i produktion, och båda runtime-kontrollerna
kräver nu exakt 001–008 (`91969107`). Historikrensningen är publicerad:
`Jakobs-v1` är `b9355ab824cd332835e7cc306862fcf53ad35f21`. Återställning:
`docs/ENVIRONMENT-RESTORATION.md`.

**Medieacceptans som fortfarande gäller.** Tal är ett set: exakt text, ljud,
video, frame-index, kalibrering och acceptansnotering. Annan ljud- eller
videohash upphäver tidigare visuellt godkännande. Välj inte talvideo på
ungefärlig längd, loopa inte en inspelad mening över fortsatt ljud, och använd
inte inklistrade munöverlägg. `node pipeline/audit-dealer-sync.mjs --probe`
plus två rehearsal-uppspelningar per dealer är kravet vid media- eller
spelarändring. Probe som matchar baslinjen är inte ett nytt läppsynkgodkännande.
12 oktober: alla fyra medieset matchade befintlig baslinje; inget nytt visuellt
godkännande. Tidigare saknade, ej godkända tagningar står kvar. Per-rad-resultat
och de daterade goodluck-kvittona ligger i den frysta handoffen, avsnitten
från 11 oktober (taltransport, egen röst, klippstyrning) och
"Acceptans som består". Zonbilden som fortfarande är den registrerade privata
PNG:n: 1080×1920, 1 628 428 byte, SHA-256
`eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`; fel molnkälla
ger 503 utan lokal reserv. Export 290×104 var pixelidentisk med befintlig zon.
`lipsync-overrides.json.pre-retime` flyttades byteidentiskt till Astrids
`source/calibration`, SHA-256
`28197cb52298d78842d972c1790373e121a43bb59fee727e66998a0379aa5ef1`.
Sparade projekt refererar 12 bankklipp i
`media/dealers/astrid/runtime/presentation` (72 276 298 byte, BASLINJE §8).
De ska inte avregistreras här.

**Regler som består, komprimerade.** Render äger kort, sko, slump, plånbok,
rundor, resultat och session. Studio sparar revisionsstyrd Neon-policy, inte
osparade utkast eller saldo. Alla fyra dealers delar spelaren. Gamla
BO-videoförhandsvisningar är tysta historikklipp. Observation följer den
verkliga spelfliken. Neon- eller Blob-fel stänger med fel, aldrig med
diskreserv eller fröprojekt. Den långa listan står i den frysta handoffen under
"Funktionella regler som aldrig får komprimeras bort".

## 2. Öppna kontroller och kända fel

### Bakgrundsklipp och bordsstorlek, 12 oktober 2026

Sammansättningens Bakgrund har nu valfria ljudlösa händelse-/intervallklipp
med maxlängd, tid mellan starter och rullande minutgränser. Basbild eller
videoloop återkommer efter slut/fel; dealerns tal och spelklocka är separata.
Bordet har procentfält och förstora/förminska per mobil-/datorformat.
Kontrakt, frysta lagergrants och capability 8 skyddar beständiga skrivningar.
Ingen SQL-migration, källflytt eller produktdataändring ingår; leveransen
bygger vidare på mergad V1 `dd837cf4`.

Riktade regressionsprov och nio verkliga Chrome-scenprov passerar, inklusive
två på varandra följande bakgrundsfilmer och felåtergång. Mediaaudit med
`--probe` bekräftar oförändrade fyra historiska set. Testerna använder
syntetiskt material och ger inget nytt läppsynkgodkännande. Full build/hook,
PR24 och main-CI passerar; `c320932a` är live på Vercel och Render med
capability 8. Produktionsprov bekräftade bakgrundsåtergång och bord 140→150→140 %
utan sparade dataändringar. Slutbilden fångade en float på fältrubriken som
sköt första bordskontrollen utanför panelen; följande fält bryter nu floaten.
Separat kvar: landningssidans Vercel-preview på `bf23b987` misslyckades i
befintlig `next/font`-laddare; produktionsbygget passerade. Spelrummens nya regler ska
väljas och publiceras uttryckligen i Studio. Användarguide och tekniskt
kontrakt finns i `lab/docs/README.md` respektive
`docs/LOCAL-PRESENTATION-RUNTIME.md`; A20/A21 bevarar modulerna vid flytt.

### Nästa uppdrag: lanes blir bara sammansättning, 12 oktober 2026

Jakobs mål: en mycket enklare modell. Behåll sammansättningen (dealer, bord,
bakgrund, placering). Lane-lagret ska inte finnas kvar som eget begrepp. Nivå 1
ska kunna bocka i och ur dealers per spelbolag och publicera. Ingen kod är
ändrad för detta ännu.

Nuläge (läst i produktion 12 oktober):
- Två lane-begrepp finns. Presentation lane = sammansättning: `project.lanes` i
  Studio-dokumentet, fryst i `operator_packages.lanes` vid publicering;
  spelrummet pekar med `room.presentationLaneId`. Game lane = intern
  uppspelningskonfiguration: `administration.gameLanes`
  (`gameLaneConfiguration` i `web/public/game-lanes.mjs`); spelrummet pekar
  med `room.gameLaneId`, och Render väljer med `?lane=`.
- Kompatibilitetsrester: URL-parametern `lane` (Studio skickar `composition`),
  `?lane=layer-preview&rehearsal=1` och flaggan
  `CROUPIER_STREAM_LANE=lissabon-stream-lane`.
- Sammansättningar: `mobile-phone` ("Mobile Phone Lane": amira, paow, astrid,
  vera) och `johns-johanna` ("Johns spelbolag · Johanna": johanna, astrid,
  paow; standarddealer paow). Namnen är missvisande. Bolag: sg-test (paket v15),
  johns-spelbolag (v14), nordic-bet (v1), kevins-spelbolag (v1, tomt).
- Omfång: `lane` finns i cirka 230 käll- och testfiler (web 43, lab/lib 38,
  lab/components 31, test 40, lab/test 55).

Fasta gränser: frysning vid publicering och publicerad historik skyddas;
befintliga rum ska spela oförändrat och gamla paket läsas som de är.
Lagringsfältet `lanes` och stabila ID:n behålls tills en migration är godkänd,
och en Studio-migration körs mot produktion före merge. Spelmotor, plånbok och
mediegodkännande rörs inte.

Start för nästa agent:
1. Läs lab/docs/TERMINOLOGI.md, AGENTS.md, docs/CLOUD-MIGRATION.md,
   web/public/game-lanes.mjs, web/presentation-room-contract.mjs och
   web/game-entry-operator.mjs.
2. Kartlägg utan att ändra var varje lane skapas, läses och fryses. Avgör om
   game lane kan härledas automatiskt från sammansättning plus spelrum.
3. Lägg en etappvis plan och vänta på Jakobs ja: (a) ordet lane syns aldrig i
   gränssnittet, och en kryssvy "Dealers hos bolaget" på nivå 1 skriver bolagets
   egen sammansättning; (b) game lane skapas bakom spelrummet; (c) först sist
   eventuellt schema- och fältnamn.
4. Provspela rummen hos sg-test, Johns och Nordic Bet före och efter varje etapp.

Samordning: ordningsplanens strukturvåg (`ordning/`, våg 3) flyttar samma
centrala moduler. Kör inte flytt och lane-förenkling på samma moduler samtidigt.

### Övrigt öppet

- Rättelsen för frysta paket utan `transition.shoe` (`e160af12`) är verifierad
  live på `91969107`: tre gröna GitHub-jobb, Vercel READY, Render live
  (`dep-db6b0649v7es739sh6g0`) och `/api/operators` 200 för Johns och Nordic Bet.
- Blandade frysta 16/17-eventpaket kan ge 409 vid publicering.
- Rotens env-filer är ännu inte konsoliderade.
- Full molnrehearsal och visuell talacceptans återstår. Astrid, Vera och Mei
  saknar `videoGenerationId` på grundloopens `idle.ready` och kan därför inte
  friskförklaras spelbara. Amira ska inte vara aktiv dealer.
- JN2-B: partnerns tema och utseendekontroller är inte visuellt accepterade.
  I ljust läge kan `--sg-text` (`#F2F1ED`) hamna på samma yta. Paketkorten är
  inte en provbordsförhandsvisning.
- Inte gjort: spelare, transaktioner och rapporter från spelmotorn (N2.4),
  marker (L4), partnerns lösenordsåterställning.
- GitGuardians senaste klassning i den tidigare handoffen: 0 öppna, 17
  ignorerade. Historisk skanning är `too_large`. Denna omskrivning läste inte
  om incidentlistan. En grön CI-körning är inte bevis på noll incidenter.
- Automatiserad korsdomänsnavigering till Studio avvisas
  (`studio_request_rejected`). Manuell länk och omladdning fungerade i det
  provet. Ingen skyddsregel lättades.
- Objektens existens i Blob och full visuell liveuppspelning är inte
  verifierade (`ordning/BASLINJE.md` §8).
- Upload-anteckningen om `kortflipp_kling_1080p.mp4` står kvar i
  `docs/CLOUD-MIGRATION.md`. Den är inte stängd här.
- Vercel-byggets nya logg för Node 24-låsningen (`12a12fd6`) är inte verifierad.

## 3. Senaste leveranser

Fjorton dagar räknat från 12 oktober 2026. Högst en kort leveransrad per
ämne. Provantalen är de tidigare agenternas, inte omkörda här.

**Env-städning och OpenClaw-namnbyte, 12 oktober (`8a8f434e`, `19c44902`, `deea75a5`).** `fe8b6372` passerar samtliga tre GitHub-jobb och är verifierad live på Vercel
och spelservern; den publika friläggningsmodulen matchar samma commit bytevis.
Gateway driftsattes med samma bevarade konfiguration. Director avslöjade däremot
ett tidigare paketeringsfel: `astrid-observation.mjs` importerar gemensamma
`web/public/dealer-identity.mjs`, men Docker-kontexten innehöll bara labbmappen.
Render återgick till den friska gamla Director-versionen. Båda nyckelnamnen
behölls. Hälsokontroll och admin visar anslutning samt oförändrade fem roller,
fyra modeller och konfigurationshash.

Director-paketet bevarar nu repo-sökvägar och kopierar endast sina faktiska
runtimefiler samt den gemensamma identitetsfilen. En Dockerfile-specifik
allowlist utesluter övriga filer, hemligheter och media. Render behöver Docker
context `.` med oförändrad Dockerfile-sökväg och Root Directory; Gateway har
kvar sin tidigare kontext. Tre isolerade paketprov, full commit-hook och samtliga
GitHub-jobb passerar för `19c44902`. Faktiskt Director-bygge och start är verifierade.
Efter borttagningen av gamla env-namnet är båda tjänsterna åter live på samma
commit och admin/hälsokontroller passerar med oförändrad konfiguration.
Exakta driftkvitton finns i `ENVIRONMENT-VARIABLES.md`.

Gatewayens startkod stöder nu `OPENCLAW_API_KEY` med prioritet över det
äldre namnet, uttryckligt tomt värde stänger av fallback, och barnprocessen
får endast det rättade namnet och OpenClaws interna lösenordsvariabel.
Blueprint, Compose, aktiva exempel och guider använder samma namn för
Director och Gateway. Äldre namnet finns kvar endast som kompatibilitet och
i daterade driftkvitton. 105 riktade Gateway-/konfigurations-/isolationsprov
passerar med Node 24.21.0; namnbytet bevarar sparad Gateway-konfiguration.

Gemini-nyckeln utan produktkonsument, tomma gamla `RUNPOD_ENDPOINT_ID` och
plattformsägda `VERCEL` är borttagna från båda aktiva lokala env-filerna med
privat backup. Render hade 37/53/16/10 env-poster för QA/spel/Director/Gateway;
samtliga återstående namn har produktkällreferenser. Det rättade Gateway-
namnet har lagts till i Director och Gateway med samma befintliga credential
och oförändrade övriga värden. Efter verifierad koddeploy togs endast det gamla
namnet bort med privat backup och läsback; Director/Gateway har åter 16/10 poster.
Omstart utan det gamla namnet och ny hälsokontroll passerar. Ingen modell,
media eller DB ändrades av env-migreringen. PAOWs nya talprofil och visuella
spelacceptans är fortfarande separata återstående steg; webbläsaren blockerade
den första provspelningsadressen för Astrid (`ERR_BLOCKED_BY_CLIENT`), så den
visuella fyrdealerskontrollen återstår. Ingen provinsats gjordes.

**Hemsidans separata byggtest, 12 oktober (`4ea767cf`).** Hemsidans middleware-test laddar nu `next/server` från hemsidans egen
Next-installation. Relativa Studio-importer använder fortfarande resolvern vid
`lab/middleware.ts`. Samma verkliga middleware transpileras och alla befintliga
assertioner för session, transport, alias och avvisade anrop består.
Det isolerade provet har enbart hemsidans beroenden: före rättningen gav det
`MODULE_NOT_FOUND`; efter rättningen passerar samma test. Alla 23 prov i filen
och hela hemsidans testsvit passerar med Node 24.21.0 och fyra workers.
Inga miljövärden, testgrindar eller produktflöden ändrades. GitHub-CI och ett
nytt isolerat Vercel-förhandsbygge ska verifieras efter leverans.

**PAOW-omstart och obligatorisk friläggning, 12 oktober (`0c04d1a2`, `c48fc657`).** Jakob bad uttryckligen om återställbar städning och en metodisk ombyggnad efter
att bord/bakgrund inte gick att lägga bakom PAOW. Via den ordinarie N1-vyn
granskades serverns konsekvenslista och `paow` arkiverades: 25 medieposter,
två sammansättningar (`mobile-phone`, `johns-johanna`) och fyra rum
(Testrummet, Johannas blackjack, ny-jhanna, nordic rum) hos SG-test, Johns
och Nordic Bet. Historik, originalfiler och bolagskonton finns kvar.
Ingen permanent radering eller direkt SQL-skrivning gjordes.

Ny dealer `paow-v2`, visningsnamn PAOW, är sparad med tomma klippkopplingar
och utan aktiv talprofil. Verifierad projektrevision efter omstart:
`studio-5a750fc4-3132-4eaa-b26b-77e73ce13ca2`. Alla 25 gamla medieposter är
arkiverade, noll raderade. Därefter skapades ett sparat utkast `PAOW · Studio`
(`paow-studio-14b6c188-ef58-4ad9-9028-4f6fb58a6de9`) med enbart `paow-v2`,
separat `Bord · Svart och guld` och `Bakgrund · Casino`. En verifierad grön
grundloop har återanvänts med oförändrade originalbytes som ny mediepost
`13d044b3-0582-4f8f-a754-75bb099a0237` och valts som standard för `idle.ready`.
Övriga klipp, talprofil och publicering återstår. Återställ inte gamla PAOW automatiskt:
återställning återför även hennes tidigare klippval och sammansättningar.

Grundfelet i scenredigeringen: saknad compositing-metadata tolkades som
fullbild, vilket dolde bords- och bakgrundslager och deras kontroller.
PAOW hade 25 poster för 13 unika videofiler; elva saknade metadata. Kopior
av samma video hade dessutom olika platskopplingar. Talprofilen fanns kvar;
den tidigare öppna fliken spelade Johanna, som saknade talprofil.

Dealerklipp friläggs nu obligatoriskt i Studio och gemensam uppspelning,
även genererat tal. Grön bakgrund är standard för äldre saknad metadata.
Explicit opaque är fortsatt läsbart i historik, men nekas vid nya skrivningar
och publicering. En verkligt inbakad scen måste ersättas med grön källfilm;
chromakey tar inte bort godtyckliga miljöer. Fel i friläggningen visar fel,
aldrig rå grön video. Tillåtna separata lager kan inte längre spärras enbart
av en gammal fullbildsmarkering. Originalbytes och frysta paket skrivs inte om.

Ändringen gör inga katalogflyttar. PR #19 granskad på `33be100b`; A20/A21
ska flytta kompositor/runtime atomärt med oförändrade URL:er efter denna
beteenderättning (PR-head vid leveransförberedelse `a12a4bc2`). Fortsätt ombyggnaden med en grundloop, ett separat bord
och en bakgrund före händelseklipp, tal och publicering. Godkänn två faktiska
uppspelningar och exakt tal-/videopar; en grön testsvit är inte läppsynksacceptans.

Den nya grundloopen är nu sparad med separat scen och anpassade mobil-/datorlägen.
Två uppspelningar i följd har provats i Studio med PAOWs faktiska originalfilm;
gröna ytor försvinner och bord/bakgrund är separata. Detta är grundloopens
scenprov, inte acceptans av händelseklipp, tal eller ett publicerat spelrum.
Publik rumskatalog och scenpreview respekterar samma uttryckliga lagergrants
även med äldre full-frame/baked-flaggor; 43 tenant-/paketprov passerar.
Talets fullfil och stream använder båda scenens gemensamma kompositor.
Native P6-kvittensen granskar nu den synliga scenbilden efter lyckad rendering,
med samma råvideo som dold ljudklocka. Saknad, dold eller skymd canvas samt
renderingsfel nekar kvittens; 64 stream-/ägarskapsprov och 46 talspelarprov passerar.

Verifiering: riktade UI-/runtime-/API-prov och TypeScript passerar.
Studio-produktionsbygge med Node 24.21.0 och fyra workers passerar (92 byggspår).
11 verkliga Chrome-prov med syntetiskt material passerar: transparenta pixlar,
två spelningar, källbyte, sena callbacks, fel och återhämtning samt separata lager.
`audit-dealer-sync --probe` bekräftar oförändrade fyra historiska medieset;
det är inget nytt visuellt läppsynksgodkännande. Bildkvitton och maskinbevis
ligger privat under `lab/data/platform-private/greenscreen-browser-20261012`
och `paow-rebuild-20261012`. Full ordinarie commit-hook passerar för
kodcommit `0c04d1a2`; inga kontroller hoppades över utöver svitens deklarerade skips.
Vercel-team och projekt är båda `scoutgaming`. Gamla `croupier-lab-ui.vercel.app`
är ett alias till samma driftsättning som www; `croupier-frontend.vercel.app`
och apex omdirigerar till www med 308. Inga domäner ändrades.

**Materialskapande i dealerns arbetsyta, 12 oktober (`d18a58e8`).** Dealer
Forge är samlat i **Dealers & klipp → Skapa material** för vald dealer.
Den separata menyposten och det dubbla registreringsformuläret är borttagna;
registrering och arkivering ligger kvar under Hantera dealers. Gamla
`/control/dealer-forge` omdirigerar till den nya fliken med säkert bevarad
dealer-, sammansättnings-, bolags- och rumskontext, även efter inloggning.

`studio_native_unavailable` berodde på att den interna Next-anpassningen
inte återställde `/studio` för `/api/forge`. Namespace-listan är rättad utan
att utöka behörigheter eller query-policy. Grundbilder begärs utan den
avvisade `?v`-parametern; hash byter bildens React-nyckel och privat media
har fortsatt `no-store`.

Materialutkast bevaras vid flikbyte och tillfälligt API-fel. Dealerbyte,
historik och sidlämning skyddas; sena lässvar från tidigare dealer ignoreras.
Otillgänglig anslutning spärrar skrivning och erbjuder återanslutning med
utkastet kvar. Jobbpollning pausas när fliken är dold. Efter generering
används befintliga Uppdatera klipplistan för att läsa in nytt material.

56 riktade prov passerar, inklusive transportens scope/roll/återkallning/CSRF,
komponenternas effekter, utkast, återanslutning, dealerbyte och omdirigering.
Ytterligare körning av material-, arbetsyte- och scen-navigation passerar
60 prov efter att den äldre komponentfixturen och flikantalet uppdaterats.
Studio-produktionsbygget med Node 24.21.0 passerar, inklusive TypeScript och
byggspårskontroll. Ordinarie fulla commit-hook passerar; de nya komponentproven
ingår även där. Villkorade miljöprov behåller sina befintliga skips.
Ingen betald generering, medieändring eller verklig DB-skrivning har gjorts.
Användarens öppna Forge-flik med osparade fält har lämnats orörd.

**Blackjackstart och granskning av uppspelningslogik, 12 oktober (`dda785ec`).**
`prepareTable` anropade `loadLabClipConfiguration` efter att funktionen tagits
bort i `7f7f6fc0`. ReferenceError låste bordet före serverns `state`, så inga
marker kunde läggas. Det kvarvarande anropet och dess kommentar är borttagna.
Den gamla funktionen gjorde redan inget för den gemensamma spelaren.

Regressionen kör verkliga `prepareTable`, `placeBet` och deal-knappens kod för
inloggad spelare, gäst och Studio-provspel. Den tidigare teststubben för den
borttagna funktionen dolde felet och är borttagen. Fyra prov föll med exakt
skärmbildens ReferenceError före rättningen; 17 riktade prov passerar efteråt.
Ett nytt bindningsprov i ordinarie pre-commit granskar spelklientens, urvalets
och kompositorns JavaScript utan runtime-stubbar. Vid A20/A21 måste dess
kataloger i `test/browser-runtime-bindings.mjs` följa samma atomära flytt.

Läsande jämförelse: main `dbc925c3`, Kevin `8837bcc5`, omorganisations-PR #19
`f3892c47`. 119 JavaScript-filer granskades utan ytterligare odefinierade
kodnamn. Gemensam kortgivning, hålkort/vändning, tal, hashverifierad videobuffer
och förberedelse av nästa klipp finns kvar. Buffring och kortöverlägg har
redan selektivt anpassats från Kevin; hans separata motor, demoplånbok,
identitet och mediabank ska inte helmergas för att rätta starten.

Kvar i befintlig omorganisation:
- `transitionClipsForDealer` har endast en testkonsument. Facken Till skon/
  Från skon är konfiguration; automatisk uppspelning är ännu inte inkopplad.
  Detta är ofärdigt arbete, inte belagt borttagen logik.
- A30/T7: `buildAssetsManifest(web/public, dealer)` gav 0 streams/deals/speech
  för Astrid, Vera, Amira och Mei. Partnerproducenten läser gamla sökvägar och
  erbjuder scenadresser som avsiktligt ger 410. Kräver ett uttryckligt
  partnerkontrakt mot publicerade paket, inte återaktiverad originalspelare.
- Kevins återhämtning efter browserpaus och filmvarianter för vila/redo är
  möjliga fortsättningar med egna mediekrav. A20/A21 ska fortsatt vara
  flyttar utan sådana beteendeändringar.

`audit-dealer-sync --probe` passerade för alla fyra historiska medieset;
inga media eller godkännanden ändrades. Det är inget nytt visuellt
lipsynkgodkännande. Amira är avvecklad som aktiv identitet; offline-start får
inte kringgå kravet på registrerad dealer och publicerat/sparat provpaket.
Full pre-commit-regression med Node 24.21.0 och högst fyra lokala testworkers
passerade. Fixen levererades i `dda785ec`; alla tre GitHub CI-jobb är gröna.
Vercel-deploy `dpl_DWJPqPpjsz8wzkDAsgx8ckK6Vh3E` är READY och den publika
`www.scoutgaming.tech/app.mjs` matchar den rättade källan (normaliserade
radslut). Render `/__cloud/version` bekräftar också `dda785ec`.
Inget verkligt spelarbelopp har använts för ett liveprov.

**Merge-samordning och CI-cache, 12 oktober (`45ff5c25`).** Övertagen av
merge-cd76. Merge gäller bara PR-author `Jakeminator123`, samma repo, mål
`main`, exakt aktuell head och granskade gröna kontroller. Worktree e37e togs
bort efter renhets-, privatfil-, process- och ancestrykontroll; den mergade
lokala `codex/john-n2-admin-partners` togs bort (fjärrgrenen består). 8e3c har
fyra egna commits och privat videoeditormaterial. d5ed blev senare tom och
oregistrerad genom en extern ändring; inget kommando från merge-cd76 raderade
den, och backup av dess privata reproduktioner är ännu inte verifierad. CI
använder samma FFmpeg/jq-installation i alla tre jobb, cache per Ubuntu-image
och ingen nedladdning vid komplett cacheträff. Studios två byggen återanvänder
`.next/cache`. Åttaminutersgränsen, alla tester och migrationsgrinden består.
Första Ubuntu-körningen på `45ff5c25` visade att offlineinstallationen behövde
peka APT:s arkivcache på samma mapp som download-only; kopplingen och fixturen
är rättade i `dbc925c3`. Tidsvinst och en riktig varm cacheträff återstår att mäta.

**Dealer Forge i produktion, 12 oktober (#16, #17, #18, `91969107`).**
Dealer Forge, nu fliken Skapa material, genererar en dealers klippbank via Runway från ett
VILA-foto; se lab/docs/README.md. Migration 008 kördes cirka 11:08 som
`croupier_game`; ledgern är 001–008 och båda runtime-kontrollerna kräver exakt
001–008. Testat: 24 Dealer Forge-tester inklusive felinjektion, migrations- och
runtimetester samt läsfråga mot produktion. Kvar: skapandet av Runway-avatar
journalförs inte (ett nätfel kan ge en extra avatar, ingen dubbel
klippdebitering). Första riktiga genereringen granskas i Dealers & klipp innan
något publiceras.

**Node 24 på Studio, 12 oktober (`12a12fd6`).** `lab/package.json` anger Node
24.x, samma huvudversion som CI. Vercel ska inte välja en framtida huvudversion
själv. Prov: låsfilsparitet och full precommit med Node 24.21.0. Kvar: Vercels
nya buildlogg.

**Frysta paket utan skoevent, 12 oktober (`e160af12`).** `/play` laddade men
`/api/operators` gav 503 när projektionen krävde 17 event även för publicerade
16-eventpaket. `transition.shoe` följer paketets frysta linjer. Obligatoriska
event och mediavalidering krävs kvar. 78 riktade prov. Läskontroll av Nordic
Bets oförändrade paket återskapade felet och gav därefter ett giltigt rum
lokalt. Inga produktionsdata ändrades. Kvar: live efter deploy.

**Publik bolagslista och GitGuardian, 12 oktober (`5ebe3ff4` i den gamla
anteckningen).** Listan utesluter bara bolag som spelvalideringen avvisar som
ospelbara. Lagringsfel stoppar fortfarande svaret. Johns spelbolag och Nordic
Bet syntes; SG-test blockerade inte listan. 62 riktade prov. Samma dag
klassades de då öppna GitGuardian-fynden till 0 öppna och 17 ignorerade, utan
ändrade behörigheter. Historisk skanning förblev `too_large`.

**Lokal städning och historikrensning, 12 oktober.** Åtta frikopplade
prototypfiler och tre Python-bytecodefiler togs bort. `lab/.next/cache`
rensades. Johanna/Paow-materialet committades inte. Historikrensningen
publicerades efter Jakobs engångsgodkännande av force-push. `Jakobs-v1` pekar
på `b9355ab`. Probe matchade befintlig baslinje. Detta är inget nytt
läppsynkgodkännande.

**Studio, partner och dealerarkiv, 12 oktober (`8e8aced`, `7eb9f7a9`,
`5df1a454`).** Fyra arbetsområden. Sammansättning är dealer, bord och
bakgrund. Spelrum är bolagets instans. Dealerarkiv räknar konsekvens, stänger
AI-tal och återställer utkast med tal av. N2: översikt, spelrum, team,
integration, skyddade utkast. Chrome kontrollerade omdirigering, tom
provspelning och mobilbredd. Kvar: full molnrehearsal.

**Lokala dealers avvecklade som reserv, 12 oktober.** Spelstart använder den
gemensamma presentationsspelaren. Tom konfiguration ger fel, inte en
reservdealer. Lokala dealer-URL:er ger 410. Amira får inte nyregistreras som
aktiv. Frysta paket kräver egna mediereferenser. Probe oförändrad. Kvar:
visuell acceptans av publicerade dealers.

**Dealer Forge, 12 oktober (PR #16 `234614e3`, PR #18 `f410c229`).** Studio har
`/api/forge`; sidan är sedan `d18a58e8` fliken Skapa material i Dealers & klipp. Migration `008-dealer-forge.sql` är
valfri vid deploy och körs i tre steg, först mot produktions-Neon, enligt
`docs/CLOUD-MIGRATION.md`. Den här omskrivningen ändrar inte den koden.

**N2-team, utkast och svarsbibliotek, 11–12 oktober.** Teamändringar använder
aktuella behörigheter och revision. Sista aktiva administratören skyddas.
Ändringsjournalen finns för intern admin och för partner med `team.read` plus
`team.roles.assign`. Granskad publicering kan återställas till nytt utkast.
Svarsbiblioteket är privat per dealer. PAOW:s sparade basklipp antecknades som
`dealer_desktop`, 1920×1080, 5 sekunder, utan att ett produktionspaket
publicerades i det provet. Kvar: JN2-B visuellt.

**Egen röst och Astrids taltransport, 11 oktober.** Registrerad dealer kan
spara röstprofil och referensbildruta. Ett tekniskt Astrid-svar i befintlig
SG-test-spelare gav texten "Hello Jakob, welcome to the table.", 1080×1920
H.264, AAC 24 kHz mono, 3,4177 s, ljudmedel −18,4 dB. Munrörelse syntes i
granskade bildrutor vid 0,6, 1,4 och 2,2 sekunder. Det är inte formell visuell
läppsynksacceptans. PAOW-profil antecknades senare som aktiv; visuell
acceptans återstår. Probe matchade de fyra baslinjerna.

**Spelaryta och gemensam väg, 7–11 oktober.** `/play` visar bolag med spelbara
rum. `/play/blackjack` utan spelmål går till lobbyn. `?operator=` begränsar
lane och dealer till paketet och överlever spelarinloggningen. Profil och
historik finns. Rehearsal: `?dealer=<namn>&rehearsal=1` och
`?lane=layer-preview&rehearsal=1`.

Äldre planer och inventeringar som låg under `random/` finns kvar i Git, till
exempel `git show 00ea55c5:random/checklista-2026-10-08.md` och
`git show 00ea55c5:random/losa-tradar-2026-10-07.md`. A01 tar bort katalogen
ur trädet. Ingen ny plats är känd.

## 4. Äldre avsnitt

Äldre avsnitt: `git show 00ea55c5:docs/JOHN-HANDOFF.md`.
