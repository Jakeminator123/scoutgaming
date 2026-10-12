# Aktuell handoff — Scoutgaming

## Dealer Forge i produktion, 12 oktober 2026

/control/dealer-forge (Studio) genererar en dealers klippbank via Runway från ett
VILA-foto; se lab/docs/README.md. Levererat i #16 (jobbjournal, idempotenta
beställningar, felklassning), #17 (skofacken) och #18 (seed vid samtidiga försök).
Migration 008 kördes ~11:08 som croupier_game; ledgern är 001–008 och båda
runtime-kontrollerna kräver nu exakt 001–008. Testat: 24 Dealer Forge-tester
inklusive felinjektion, migrations- och runtimetester samt läsfråga mot produktion.
Kvar: skapandet av Runway-avatar journalförs inte (ett nätfel kan ge en extra
avatar, ingen dubbel klippdebitering). Första riktiga genereringen granskas i
Dealers & klipp innan något publiceras.

## Publik bolagskatalog: äldre frysta paket, 12 oktober 2026

/play laddade men /api/operators gav 503 efter det valfria skoeventet.
Den frysta projektprojektionen krävde den nya 17-eventmallen även för redan
publicerade 16-eventpaket. Projektionen följer nu paketets frysta linjer för
transition.shoe; obligatoriska event och medie-/paketvalidering krävs fortsatt.
Regressionen täcker gammalt och nytt paket, oförändrat innehåll, fryst talval
samt avvisning av saknad obligatorisk linje. Den faller utan rättningen.
78 riktade tester passerade. Läskontroll av Nordic Bets oförändrade paket
återskapade felet och ger nu ett giltigt spelrum i lokal produktionskod.
Inga produktionsdata eller migrationer ändrades. Liveutfall verifieras efter deploy.


## Rensning av lokala prototyper och cache, 12 oktober 2026

Åtta frikopplade prototypfiler är borttagna: den gamla riggade bordsspelaren,
grön-waiting-spelaren, packed-speech, performance-authoring samt dealer-studio
och collection-export-review med respektive HTML. Importsökning, exportnamn
och en konservativ modulanalys fann inga konsumenter i aktuell kod eller tester.
Tre genererade Python-bytecodefiler är också borttagna. Gemensam .gitignore
skyddar nu Next-/Nuxt-cache, .cache/.turbo, testresultat, Python-cache,
virtuella miljöer, byggmetadata och loggar. node_modules var redan ignorerat.

754 995 884 byte disponibel lab/.next/cache rensades efter tom sessionspost
och kontroll av Node-processernas script/identitet. Övrig .next-runtime,
beroenden, sparade data, råmedia och kalibreringar bevarades. Det pågående
lokala 3lager-materialet med Johanna/Paow är kvar och lades inte till i Git.

Verifiering: 11 ignore-prov, full precommit-regression med 2 874 godkända
prov/11 villkorliga undantag/0 fel, samt audit-dealer-sync --probe. Alla fyra
medieset matchar befintlig baseline; detta är inget nytt visuellt
lipsynkgodkännande. Aktiva spel-/Studio-/partner-moduler har bevarats.

Historikrensningen är publicerad efter Jakobs uttryckliga godkännande av ett
engångsundantag från force-push-förbudet. Nio brancher och tre historiska taggar
uppdaterades atomiskt med exakta gamla SHA:n som leases. Main före/efter är
1667d25e2427c220982f9388b6d684328e4c9cd9 respektive
40c38c49b75dd8614a4da65f32d6c1bbe66ab462; filträdet är identiskt.
Alla 24 skyddade branch-/stash-/arbetskopietillstånd har identiska filträd.
3 996 äldre media-/Kevin-blobbar rensades; den filtrerade Git-kopian är
1 589 627 782 byte, jämfört med originalbundlens 4 504 287 614 byte.
En oberoende färsk GitHub-klon mäter 1 587 059 164 byte med alla tolv refs
verifierade. Lokal .git minskade från 4 661 041 880 till 1 612 773 938 byte:
3 048 267 942 byte frigjort. Båda integritetskontrollerna passerade.
Full regression på färska main: 2 875 pass, 11 villkorliga undantag, 0 fel.
Git-integritet och systemkartans blockerande kontroll passerade. Detta är
inte ett nytt visuellt mediegodkännande eller full GitGuardian-historiktäckning.

Alla sju befintliga lokala arbetskopior följer motsvarande nya commits med
oförändrade index och arbetsfiler. Originalhistorik, reflog-exklusiva objekt
och Git-metadata är säkerhetskopierade privat utanför repot; återställning och
råd för andra kloner finns i ENVIRONMENT-RESTORATION.md. Jakobs-v1 pekar nu
på b9355ab824cd332835e7cc306862fcf53ad35f21. Vanlig leveranspolicy och hook
förbjuder fortfarande force-push/andra brancher. Inga DB-/Blob-data ändrades.
GitHubs rapporterade lagringsstorlek kan dröja och äldre PR-referenser kan
behålla objekt. Historiska commit-ID:n i äldre dokument är ursprunglig proveniens.

## Offentlig bolagslista och GitGuardian, 12 oktober 2026

Publika /api/operators svarade 503 fast Johns spelbolag och Nordic Bet hade
läsbara spelrum; SG test game providers rum svarade 503. Listan utesluter nu
endast ett bolag som den riktiga spelvalideringen uttryckligen avvisar som
ospelbart, efter verifierat bolagsägarskap och fryst paket. Lagringsfel,
främmande data och korrupta paket stoppar fortsatt svaret. Inga bolag eller
rum ändras av katalogläsningen. 62 riktade prov passerade, inklusive
pensionerad dealer, bolagsordning, HEAD och tenant-/lagringsfel. Kod 5ebe3ff4
är verifierad live på Vercel dpl_9UmrNSYEKZr2CohshU2AqiQkfTyL och Render
dep-db66cggu01pc73f9i9jg, med grön GitHub-körning 38204816606. Full lokal
kontroll: 2 874 godkända, 11 villkorliga undantag, inga fel. Publik GET ger
Johns spelbolag (tre rum, paket 14) och Nordic Bet (ett rum, paket 1). Webbvyn
visar båda bolagen, och Nordic Bet leder till nordic rum med korrekt
operator/table/dealer i speladressen. SG-test svarar fortsatt 503 för egen
ospelbar publicering men blockerar inte listan. Inget spel startades.
Den interna sammansättningsetiketten tas bort från spelarkortet: Nordic Bet
ska inte visas med ett återanvänt konfigurationsnamn som nämner Johns bolag.
Bolag, rum och vald dealer är kvar. Befintligt lobbyprov skyddar detta;
19 lobbyprov och frontendens typkontroll passerar.

GitGuardians befintliga skyddade API fungerar med incidents:read och
sources:read. Samtliga 34 förekomster i de 12 öppna Scoutgaming-fynden
kontrollerades mot sina exakta Git-versioner: 26 förekomster var filhashar
under expectedHashes i docs/system-map/contracts.json, samtliga omräknade
SHA-256 matchade. Åtta förekomster var rena konfigurationsfixturer i
ops/cloud/test/container-entry.test.mjs utan databasanslutning.
Åtta hashfynd (37867511, 37867512, 37879729–37879732, 37880359, 37880360)
klassades som false_positive och fyra fixturefynd (37862641, 37863164–37863166)
som test_credential i den inloggade GitGuardian-webbvyn. Efterläsning visade
0 öppna och 17 ignorerade incidenter; de fem tidigare ignorerade ändrades inte.
Bevakningen är aktiv. Historisk skanning är fortfarande too_large och ger
inte full historisk täckning; detta kräver separat lösning för leverantörens
storleksgräns. Inga API-behörigheter, detektorer, exclusions eller hemligheter
ändrades. Andra repon i samma workspace ingår inte i denna klassning.

## Samlat kontroll- och partnerflöde, 12 oktober 2026

N1 har fyra arbetsområden: Studio, Spelbolag, Drift och System. Skapa dealer
→ bygg sammansättning → publicera till spelbolag → skapa spelrum → öppna
bolagets portal eller provspel. Sammansättning är dealer/bord/bakgrund;
spelrum är bolagets spelbara instans av en publicerad sammansättning.
De gamla interna lane-fälten finns kvar som kompatibilitet och automatisk
speladapter, men är inte ett separat användarsteg. Gamla länkar omdirigeras
med bibehållet dealer-, bolags- och rumssammanhang. Provspelning & logg är
kontextuell, och redovisningen skiljer beslut från faktisk uppspelning.

N2 samlar översikt, spelrum, team och integration. Utseende, förhandsvisning
och publicering finns i rummets sammanhang. Osparade ändringar skyddas även
vid kontobyte och utloggning. Tomma vyer hittar inte på bolag eller dealers.

N1 kan arkivera bolag och rum med återställning. Dealerarkivering visar en
serverberäknad konsekvenslista och stänger AI-tal, arkiverar egna klipp och
sammansättningar samt tar bort berörda aktiva rum/publiceringar i samma
transaktion. Samtidiga ändringar kräver en ny konsekvenslista. Återställning
skapar utkast med tal avstängt; permanent radering är en separat batch med
befintligt skydd för historiskt publicerad media. Runtime v7 krävs för det
nya dealerarkivet, även vid permanent radering. Inga produktionsposter eller
Blob-filer har ändrats under utvecklingen.

Verifierat: 174 riktade UI/session/navigation-prov, 39 dealer-UI/loggprov och
153 domänprov med rollback, behörighet, samtidighet och historik passerade.
Grupperna överlappar och ska inte summeras. Produktionsbygget passerade.
Chrome verifierade gamla lane-länkens omdirigering, kontextuell tom provspelning,
sammansättningarnas tomvy och mobilmenyn vid uppmätta 320–400 CSS-pixlar.
Inget horisontellt överflöde sågs i dessa vyer. Isolerat serverpar stoppat;
bolagsdata var avsiktligt otillgänglig i offline-provet.
Commit 8e8aced levererade grundändringen; hela lokala commitkontrollen passerade
med 2 827 godkända prov och 11 villkorliga undantag. GitHub kör även hela
Lab-sviten (1 665 prov) och hittade 11 äldre fixture-/routefel. Följdfixen
uppdaterar explicit dealerval, tom projektstart, observationens browser-API och
skyddade canonical-rutter, och hanterar null från Nexts URL-hook. Hela Lab-
sviten passerar nu (1 664 godkända, två miljövillkorade undantag), liksom
produktionsbygget med typkontroll. Tom spelstart ger avsiktligt 503 även för
gamla alias; bord, kort, saldo och omstart fungerar i isolerade prov. Samma
regressioner ingår nu även i commitkontrollen.
Commit 5df1a454 verifierades på main, med grön GitHub-körning 38202259662,
Vercel READY på www.scoutgaming.tech. Spelmotorn verifierades live på Render med 7eb9f7a. Hela
lokala commitkontrollen passerade med 2 872 godkända prov och 11 villkorliga
undantag. Inloggad Chrome-läsning verifierade fyra verkliga bolag, Johns tre
spelrum och paketversion 14 i både N1 och N2, samt partnerkatalogens riktiga
bolag. Interna länkar behöll bolags- och rumskontext. Den gamla etiketten
Mobile Phone Lane normaliseras i N2:s paketval, översikt och rumstabell;
sparade identifierare och paketdata behålls. Provspelningen visar rums- och
bolagsnamn; tekniska ID:n styr fortsatt observationens identitet.
Arkiveringsförhandsvisningen för PAOW hämtade aktuell påverkan på klipp,
sammansättningar, rum och bolag och avbröts utan arkivering.

Direkt automation gav korsdomänsmarkerad cors-navigering och avvisades av
anropsskyddet; interna länkar och normal omladdning fungerade. Ingen skyddsregel ändrades.
Inga bolag, rum, dealers, media eller utkast ändrades under produktionsprovet.
Fullt molnprovspel och visuell talacceptans återstår, bland annat eftersom
Astrid/Vera/Mei saknar grundloopens videoGenerationId. Trackerpunkter som
kräver sådan acceptans lämnas öppna.


## Avveckling av lokala dealers, 12 oktober 2026

Jakobs beslut: Amira ska inte vara en aktiv dealer. Astrid, Vera och Mei är
inte inbyggda lokala dealers eller standardval. De kan spelas när de uttryckligen
registrerats i Studio med egen giltig media och ingår i vald publicering.
Neon-/Blob-klipp och historiska dokument bevaras som material. Ingen råmedia,
kalibrering, produktionsdatabas eller Blob har raderats eller skrivits om.

Spelstart använder den gemensamma presentationsspelaren och ger ett tydligt
fel vid tom/ofullständig konfiguration. Ingen lokal bank eller reservdealer
startas. Lokala dealer-URL:er ger 410, även kodade/Windows-varianter. Offline
startar tomt. Gamla klipppolicyer skapar inte längre aktiva bindningar vid
inläsning och gamla variantnamn upphöjs inte automatiskt till standardklipp.
Amira får inte nyregistreras eller återinföras via lokal projektsparning;
befintliga historiska poster kan fortfarande läsas/bevaras. Borttagen aktiv
spelbana kan lämnas null även när andra banor finns, utan implicit ersättare.

Frysta paket kräver egna mediereferenser för alla dealers, inklusive gamla
namn. Rumsadaptern måste vara aktiv, tillåten och registrerad i paketet. Ett
sparat spelarval stoppar föregående sidas initiering innan navigering. Första
scenen hålls dold bakom laddningsytan tills vald spelare presenterar en bildruta.

Verifierat efter slutändringarna: 18 registrerings-/historik-/sparprov, 59
uppspelnings-/frysta händelseprov och 33 ban-/entry-/policyprov passerade.
Övriga riktade media-, kort-, val- och pakettester passerade; grupper överlappar
och ska inte summeras. Isolerat offline-HTTP-prov gav avsedda 503/410 och
städade server/tempdata. Synkgranskning --probe PASS, oförändrad mediebaslinje;
detta är inte ny visuell läppsynkacceptans.

Chrome-provet använde verkliga local-film-player.mjs, presentation-startup.mjs
och produktens CSS på det gemensamma testserverparet. Scenen var hidden före
första presenterade bildrutan och visible därefter. Två kompletta uppspelningar,
två presenterade starter, noll fel, state=ready. Tillfälliga HTML-/MP4-fixturer
togs bort efter hashkontroll och provfliken stängdes. Detta tekniska startprov
ersätter inte full molnrehearsal eller visuell acceptans av publicerade dealers.

Leverans samordnas med flow-restructure, inklusive modell-/UI-ändringar och
dealerarkiv. Exakt fryst ägarlista finns lokalt i lab/data/legacy-delivery-files.json.
Samlad fullhook passerade för 8e8aced. Full molnrehearsal återstår; läskontrollen
av molndata visar att Astrid, Vera och Mei saknar baseline-videoGenerationId på
idle.ready och därför inte kan friskförklaras spelbara. Följdcommit och
GitHub-kontroller krävs innan Render levererar den nya runtime-versionen.
GitGuardian på 8e8aced: 12 öppna av 17, partiella platser, historisk skanning
too_large och väntande GitHub-suite. Ingen friskförklaring eller incidentåtgärd.

## Börja här: överlämning 12 oktober 2026

### Samlad snabbgranskning och nästa steg, 12 oktober 2026

Chatten ”Fortsätt Croupier-handoff” har levererat team/journal i e9e623dd och
utkast/publicering/återställning i 270aaa38. Båda är förfäder till main d57df5c6,
som vid denna kontroll matchar GitHub exakt, har grön CI 38191014202 och Vercel
READY dpl_AZdysZfua2KBxkmbXva795wTLFCY. De berörda N2-filerna är oförändrade
sedan 270aaa38. Huvudcheckouten samt chattarnas a1f5, 1068 och 36da är rena;
sidoworktrees är äldre frysta utgångspunkter, inte osparade leveranser.
Fortsätt i C:\Users\jakem\Projects\croupier på main. Inget återställs från de
äldre arbetskopiorna. Separat pågående arbete i ”Anpassa desktopvyn för dealern”
ingår inte i detta avslut och ska samordnas innan gemensam integration.

Den snabba granskningen fann ingen ny funktionell regression i de granskade
N2-vägarna. Detta är ingen fullständig ny säkerhets-/produktacceptans. Live
lästes Johns paketversion 14, spelrum och beständiga publiceringshistorik utan
skrivningar. Ingen ny SQL-, provider-, runtime- eller medieändring utfördes.

**Bekräftad visuell skuld, inte färdig N2-design:**
- partner-appearance.module.css använder --sg-text från Studios mörka tema.
  I partnerns ljusa tema blir formulärtexten #F2F1ED på ytan #F2F1ED; partnerns
  egen textfärg --ink är #0A0B0D. Kopplingen fanns redan före 270aaa38.
- PartnerPackageView visar samma fullständiga paketlista före flera olika
  inställningsvyer. Korten har 0 px padding och visar MIME, mått, råa ID:n och
  långa filnamn. De ersätter inte en visuell provbordsförhandsvisning.
- Partnerns skal använder --ink/--paper medan formulär och knappar använder
  --sg-* och sg-btn. Gemensam temakoppling, spacing och arbetsflödesstruktur
  saknas. Funktionstesterna innebär inte att helhetsvyn är visuellt accepterad.

Prioritera JN2-B i befintlig tracker: först text/ytor och fokuskontrast i båda
lägena; därefter en sammanhållen redigeringsvy med kompakt paketinformation,
begripliga namn och förhandsvisning. Bevara utkast, revisioner, granskat
publicera/återställ och alla tenant-/behörighetsgränser. Kontrollera riktig
livekomponent i 360/820/1440 px, SV/EN och ljust/mörkt. Därefter återstår breda
JN2-D (logo/chips/knappar/full spelförhandsvisning) samt JN2-E–K enligt trackern.
Visuella fel dokumenterades, men ingen oombedd omdesign gjordes i snabbgranskningen.

Den egna förbrukade studio-navigation-fixture.mjs har tagits bort och dess
processer är stoppade. Privata testkvitton, råmedia, env och återanvändbar CRUD-QA
bevaras. Standardtaket är 5 USD per avgränsad testomgång; detta pass kostade 0 USD.
GitGuardian: 12 befintliga öppna incidenter, partiella platser och ofullständig
historisk skanning kvarstår. Ingen friskförklaring eller incidentåtgärd gjordes.

### Studio: verifierat basklipp, Svarsbibliotek och dealerhantering

Slutkontroll 12 oktober: 03edad7d3b53b0ec3306e80d5db2db8c1f459e82 är Vercel
READY (dpl_7ok2qqXMWEVJu47iHzUjx4GXEAZ6). Alla tre kontroller i CI 38190272297
är SUCCESS. Render är separat verifierad LIVE på 77b3de84; den senaste ändringen
gäller bara Studio-diagnostik och feltext. Hela lokala kontrollen gav 2 661 PASS,
11 SKIP och 0 FAIL; 26 riktade requestprov och TypeScript passerade.

Intern navigering PAOW → Svarsbibliotek → Grundloop bevarar dealer och scen.
Ett riktigt klick från en extern lokal HTML-sida öppnade PAOW:s privata bibliotek
i Codex-webbläsaren. Serverkvittot på exakt 03edad7d visade navigate/document,
crossSite=true och ingen Origin eller server action. Jakob bekräftade därefter
att samma direktlänk öppnas när han själv klistrar in den i en ny Chrome-flik.

Den automatiserade Chrome-vägen gav däremot cors/document redan vid middleware,
och avvisades som avsett med studio_request_rejected. Detta är en kvarstående
begränsning i testvägen, inte belägg för att normal användarnavigering misslyckas.
Exakt komponent som ändrar metadata före middleware är inte identifierad.
Ingen generell cors-lättnad infördes. Transportdiagnosen innehåller bara fasta
enum-/booleanflaggor, aldrig cookie-, Origin-, URL-, query-, identitets- eller
tokenvärden. N1-, Origin- och API-kontroller är bevarade. Den rena länkfixturens
egna processer stoppades efter proven; inga produktdata skrevs.

12 oktober: PAOW:s sparade basklipp är dealer_desktop, 1920×1080 och 5 sekunder.
I den inloggade produktionsvyn verifierades byte till det äldre porträttklippet
och tillbaka som osparat utkast, därefter omladdning till sparat desktopklipp.
Videon spelade utan mediefel. Den separata AI-talreferensen behölls. Kontrollen
sparade eller publicerade inget produktionspaket.

Svarsbibliotekets gemensamma privata lagring verifierades hela vägen: ett eget
syntetiskt Astrid-svar sparades med Render-konfigurationen, lästes och kategoriserades
i Vercels inloggade UI, och lästes tillbaka från Render-sidan med exakt text,
kategori och revision 2. Privat ljud och video spelade färdigt utan mediefel.
Samtliga tre egna testobjekt raderades; inga befintliga objekt berördes.
PAOW:s bibliotek laddades separat med rätt dealer och tio kategorier.

Dealerhantering verifierades i verkliga LabStudio-komponenten och ordinarie
API/repository mot en ny isolerad lokal PostgreSQL: skapa, spara, omladdning,
papperskorg, omladdning, återställ och omladdning. Alla tre skrivningar gav 200.
SQL-historiken visade 4→5→4→5 dealers; återställda dealers och 80 klipprader var
exakt identiska med sparningen före arkivering. Egna processer och temporär
databas stängdes och togs bort. Privat fixture och underlag finns under
lab/data/platform-private/dealer-crud-qa/ och följer inte med i Git.

Basdealers och dealers som fortfarande används skyddas fortsatt mot radering.
Permanent borttagning av media kräver Blob-kontroller och minst 15 minuter efter
arkivering; det steget ingick inte i browserprovet. 74 riktade befintliga prov
täcker dealerregistrering, livscykel och borttagning.

Scenvalet (lane) följer nu dealerflikar, utgående klipplänkar och webbläsarhistorik.
33 riktade navigeringsprov passerar. Direktlänkar till kända Control-dokument
har en snäv normalisering av webbläsarens navigeringsmetadata före routing-/SSR-gränsen.
Undantaget gäller endast GET-dokument utan body eller server action; Origin,
cookie, N1-behörighet och API-kontroller behålls. 24 request-/navigeringsprov och
provet mot den verkliga middleware-kedjan passerar. Två oberoende granskningar
fann ingen säkerhetsregression. Slutbygge, fullhook och exakt live-revision
redovisas i leveransmeddelandet.

### Gemensam namnväckning och sparning av genererade dealersvar

CI-komplettering: OpenClaws separata produkttalprov avvisar nu en verkligt
ogiltig dealeridentitet i stället för den avsiktligt stödda Vera. Samtycke,
modell-, JPEG- och före-provider-kontroller behålls. Tolv positiva prov täcker
sex dealers och båda granskade bildmodeller, inklusive återspelning utan nytt
modellanrop och nekad dealerändring under samma requestId.

12 oktober: publika dealerpresentationer delar röstkontroll, separat kameraopt-in,
namnväckning efter vald dealer och hopfälld mobilchatt. Astrid/Vera/Amira/Mei samt
registrerade PAOW/Dragge stöds; Studio-provspel behåller sin isolering. Mobilens
44px-knappar ligger i en smal högerkant utanför ansiktet. Normal lyssning och paus
under dealer-/chattsvar visas; enbart bordets busy-status blockerar inte väckning.
Generiska observation/transcription-rutter validerar aktuell publicering, session,
profil och vald dealer, även genom de två exakta Vercel-proxyvägarna.

Obetald röstkontroll och exakt bildreferens förbereds parallellt med modellsvaret.
Betald TTS/GPU behåller färskhetskontroller och startar efter exakt text. Positiv
röstbehörighet cachas högst60sekunder; referenscachen rymmer fyra bilder. Färdiga
streamsvar arkiveras efter sista bildrutan som privat exakt text, WAV och MP4 i
det separata Blob-svarsbiblioteket; mikrofonljud ingår aldrig. Gemensam64MiB-budget
begränsar infångning och väntande sparningar. Sparningen blockerar inte media.

Riktig privat Blob/SDK-kontroll verifierade save, omläsning efter rekonstruktion,
Range-läsning, arbetsyteisolering och samtidiga kategoribyten: en vinnare/en409.
Endast tre egna syntetiska objekt användes och samtliga raderades. SDK:s svaga
GET-ETag normaliseras endast inför kategoribyte mot samma auktoritativa HEAD-version;
race mellan GET/HEAD eller HEAD/PUT skriver aldrig över senaste kategorierna.
Riktiga SDK-konfliktklasser mappas till409 även när error.name är Error.

Verifiering: riktade röst-/HTTP-/stream-/routing-/lagringsprov passerar och ingår
i ordinarie fullhook. Offlineprov i verklig spelare körde två efterföljande
greeting-uppspelningar för Astrid, Vera, Amira och Mei utan rapporterat
repetitionsfel; mobil360x800 kontrollerades. Assetbaslinjen ändras inte. Detta är
ingen ny mänsklig läppsynksacceptans, fysisk mikrofonväckning eller uppmätt förbättrad
live-latens. RunPod-kallstart och observerad NVENC→CPU-fallback återstår som
prestandabegränsningar. Aktuell kontomappning finns i ENVIRONMENT-VARIABLES.md;
PAOW/Dragges kloner finns kvar i Kevins workspace tills tillgång på Jakobs konto
är verifierad. Ingen nyckel-/kontoändring, betald generering eller DB-ändring här.


### Studio: privat Svarsbibliotek per dealer

12 oktober: Svarsbibliotek är en egen dealerflik på /control/replies?dealer=<id>. Den visar sparade genererade svar med exakt text, språk, tid, profilrevision samt privat ljud och video. Tio gemensamma kategorier kan filtreras och ändras. Biblioteket genererar, återanvänder, godkänner eller publicerar inga svar. Talgranskning av inspelade klipp finns fortsatt under vald dealer → Klipp → Tal-klipp & ljud.

N1-API:t kräver aktuell intern adminbehörighet och låter aldrig klienten välja miljö/workspace. Privat Blob-metadata och media binds till miljö, workspace och dealer; inga oskopade fallback eller offentliga lagringsreferenser lämnas ut. Kategoriändringar använder revisionskontroll och atomisk ETag-precondition med ny behörighetskontroll före skrivning. Range/HEAD går genom samma privata mediegräns. Förlorat skrivsvar stäms av genom läsning, utan blind omskrivning.

Ett synligt Byt basklipp inkluderar även egna idle-klipp som redan används som variation. Bytet ersätter bara primärklippets video och längd, behåller samtliga basvikter och andra variationer, och lämnar gamla uppladdningen och AI-talreferensen kvar. Det är ett utkast tills inställningarna sparas och paketet publiceras. 19 riktade tester verifierar även dubbelklick, ändrad media, avbruten läsning och sena svar.

Utkast och konflikter skyddas vid sid-, dealer- och filterbyte. Sena svar får inte återvisa en tidigare dealer. Returlänkar bevarar scen, händelse, variant och situation; dealerbyte rensar den gamla dealerns klippkontext. Rader med osparade val hålls synliga även om en samtidig kategoriändring annars skulle filtrera bort dem.

Verifiering: 142 samlade kontext-/dealer-/scen-/event-/Probe-/admin-/biblioteksprov, 15 API-/queryprov och fem privata lagringsprov passerar, liksom 20 befintliga request-/mediaprov, TypeScript och Next-produktionsbygge. Nya tester registreras i ordinarie fullhook; inga tester kring spelkort, plånbok eller taluppspelning tas bort. Produktionsläsningens utfall redovisas i leveransmeddelandet.

Automatisk infångning från avslutade genererade svar ingår nu i röstleveransen ovan. Blob och Studio-scope är konfigurerade och den gemensamma lagringen har verifierats med egna syntetiska testobjekt enligt acceptansnoteringen överst. Tidigare artefakter importeras inte. Detta är ingen ny mänsklig läppsynksacceptans eller verifiering av ett nytt betalt genereringsförlopp.

### JN2-D: sparade utkast, granskad publicering och återställning, 12 oktober 2026

N2 har nu separata beständiga utkast, granskning med ändringslista och berörda rum, uttrycklig publicering samt återställning av en tidigare publicerad version till ett nytt utkast. Bolagets standard och rumsundantag använder samma tillåtna lager- och dealerurval som det frysta N1-paketet. Återgång till standard är en granskad ändring. Rättighetsfel, konflikter, ändrat grundpaket och försenade svar efter bolagsbyte behåller egna ändringar och blockerar inaktuell publicering. Historiken visar de senaste 20 publicerade versionerna; äldre revisioner finns kvar i lagringen.

Migration 007 tillämpades 2026-10-11T23:40:18.298Z efter verifierad kompatibilitetsrevision 508c8f33d01c8d3f427df2adf2b5860377f8f269 på Vercel READY, Render LIVE och grön GitHub CI. SQL-checksumma 4f93746eee72041c6e97181e314a0e2f86f38c2813958421c7cc48f6351e7d4b; kedja 001–007 verifierad, inga väntande migrationer, noll utkastrader vid installation och noll affärsskrivningar/backfill. Paket, publiceringsmarkör och beständig journal skrivs i samma transaktion. Stora journalposter hänvisar till kompletta oföränderliga utkastrevisioner och deras SHA256; alla steg kontrollerar samma paketstorleksgräns före mutation.

Spelet kontrollerar den publicerade revisionen före nästa runda. Vid en ny revision bevaras ännu ej skickade insatsval inför omladdning; ingen runda eller insats startas automatiskt. Pågående rundor behåller sitt frysta mediepaket när enbart N2-utseendet ändras. Ändrade N1-medier, återkallad åtkomst och fel bolag förblir spärrade. Den exakta autentiserade appearance-rutten går genom Vercel till Render, utan ett öppet generellt operatörs-API.

Verifiering: 27 isolerade native Windows/PostgreSQL-kontroller, med separata auth-/operatörsdatabaser, verklig samtidighet, rollback, stora utkast med 28 rum och omstart. 24 browserkontroller på faktiska komponenter i SV/EN och 360/1440 px; 11 integrationstester kör verkliga server-/klientfunktioner och proxyrutten. Förhandsvisningen använder gemensam kompositor och publicerat tillåtet mediaurval. Browserfixturen använde syntetiska bilder; verkliga dealerfilmer och samtliga spelfaser är inte accepterade genom det provet. Fullhook och slutliga produktionskvitton anges i leveransrapporten. TypeScript och gemensamt Lab-produktionsbygge passerade. Testkostnad 0 USD inom taket 5 USD; ingen WSL eller betald AI/GPU-generering.

Breda JN2-D är fortsatt öppet för logotyper, chips, knappstilar och full preview av spelhändelser/dealerfilm. De kräver ett gemensamt kontrakt genom N2 och N3 och separat uppspelningsacceptans. Speldata, transaktioner, rapporter och JN2-E–K återstår enligt befintlig tracker. Arbete och kopplingar utgår från main. Dealermapparna är fortfarande aktiv originalbank för video, ljud och kalibrering och har inte raderats. En första extern sidnavigation gav en oidentifierad 403 i requestnormaliseringen; omladdning och intern navigering fungerade med aktuell N1-session. Säkerhetsgränserna ändrades inte för detta.

### Studio: dealerhierarki och gemensamt lagerbibliotek

12 oktober: dealerflikar Grundloop, Klipp, Scen & format, Tal & automatik och Inställningar samt gemensamma brödsmulor ersätter den splittrade navigeringen. Fackets inställningar visas direkt. Händelsevyn väljer exakta fack utan det äldre pilträdet. Talgranskning följer vald dealer och behåller exakta medieidentiteter/revisioner. Andra dealers får inte Astrids Probe eller kvarhängande chatsvar. Borttagning av sammansättning är synlig, med befintlig bekräftelse och oförändrade publicerade paket.

Bord & bakgrunder har en egen sida på /control/library med två flikar, uppladdning, förhandsvisning, användning och borttagning/ångra. Uppladdning ändrar inga scenval; revisionskonflikter behåller utkast och samtidig fjärranvändning av en borttagen fil blockerar rebase. Dealerflikbyten bevarar utkast, röstformulär och uppladdningskö. Ej applicerade röstfält skyddas vid dealerbyte, historik och sidbyte; Ångra ändringar i talformuläret återställer formuläret. Referensknappen väljer första bildrutan i det verifierade grundklippet men kräver befintlig bildgranskning innan sparande.

Verifiering: 64 dealerarbetsyteprov, 80 kontext-/event-/Probe-/talgranskningsprov, 19 biblioteksprov och 24 globala navigationsprov passerar; gemensam TypeScript och Next-produktionsbygge passerar. Nya regressioner ingår i ordinarie fullhook som leveransgrind. Lokal webbläsarkontroll använder isolerade testdata och avstängda externa tjänster, inklusive 390 px mobilvy utan horisontellt överflöde. Offline-adapterns befintliga /api/clip-controls-fel begränsar originalbanksprovet; uppladdning till molnbiblioteket och produktionsuppspelning verifieras inte i denna offline-session. Ingen DB-migration eller ändring av media, spelmotor eller publicerade paket.

Kvar från önskad målbild: Probe är fortfarande Astrid-specifik. Geometri är sammansättningsägd, inte en ärvd dealerstandard; mobil/helskärm har separata formatinställningar. Automatisk referens vid uppladdning, fristående referensbild, dealerövergripande geometriskt arv och generell proaktiv AI-talpolicy kräver separat kompatibel runtime-/datamodellsutveckling och verklig uppspelningsacceptans. Ingen ny läppsynksacceptans görs av dessa UI-tester.

### JN2-C: team, behörigheter och beständig ändringsjournal

Produktionsförberedelsen verifierades på både Vercel READY och Render LIVE med SHA `d72f392f8c91532c84252c6efdb524f471616c78`, grön GitHub CI samt fungerande N1-session till Johns bolag. Migration006 tillämpades därefter 12 oktober 00:14 svensk tid (11 oktober 22:14 UTC): checksumma `a8775d0329262194340fd6365da4b1d316459d894e6fd3b93106ecde7199b474`, kedja001–006 verifierad, inga väntande migrationer, journalen tom vid installation och noll affärsskrivningar. Slutkoden kräver därefter006; produktionsrevision och slutlig läskontroll redovisas i leveransrapporten.

Slutimplementationen bygger på main, efter förberedelsecommit `d72f392f8c91532c84252c6efdb524f471616c78`. Inga gamla John-/Kevin-brancher eller externa skisser används som runtimekälla. Team visar aktuella medlemmar, faktiska rättigheter och delegerbarhet; inbjudan, rollbyte, avstängning och återaktivering går genom det befintliga scoped API:t med ny behörighetskontroll och revisionsskydd. Självuppgradering, rättigheter utanför aktörens egna, skyddade roller och borttagning av sista aktiva administratören nekas. Försenade eller nekade svar får inte återvisa gammal åtkomst eller gamla teamdata.

Additiv Studio-migration `006-operator-audit.sql` skapar `operator_audit_events`. Operatörs-, roll-, medlemskaps- och paketändringar samt audit sparas i samma transaktion; auditfel avbryter skrivningen. Journalen avgränsas till miljö/workspace/bolag och innehåller verklig aktör, åtkomstklass, åtgärd/resurs, före/efter-revision, tid, request-ID och utvalda säkra ändringsfält. Inga lösenord, token eller e-postadresser loggas. Bevaras tills en uttrycklig retentionpolicy beslutas; ingen app-raderingsväg eller historisk backfill. Team visar journalen för intern admin och partner med både `team.read` och `team.roles.assign`, med 25 poster per sida och SV/EN.

Konto- och operatörsdatabaser förblir separata. Aktiveringsfel efter operatörscommit kompenseras till inbjudet medlemskap, med samma aktör/request-ID i aktiverings- och kompensationsposten; detta är ingen distribuerad transaktion.

Verifiering: 11 riktiga PostgreSQL-prov på Windows med två tomma isolerade databaser, konkurrerande adminändringar, stale CAS, bolagsgränser, återkallade rättigheter, auditfel/rollback, aktivering/inloggning/replay, uppskjutet auth-COMMIT-fel/kompensation/nytt försök och beständighet efter databasomstart. Dessutom 18 browserprov av riktiga Team/Journal-komponenter på SV/EN i 360/1440 px, inklusive tangentbord, bekräftelser, paginering och sena svar efter 403. De 25 fokuserade sluttesterna för UI, journal och QA-koppling passerar. Slutbygge/TypeScript passerar; ordinarie fullhook är leveransgrind. Förberedelseversionen passerade 2 455 tester/9 skip/0 fail. Ny permanent SQL-täckning körs i befintlig CI-runner med separat auth-/operatörsdatabas och riktig omstart; lokal testfil utan fixture är uttryckligen SKIP och räknas inte som SQL-bevis.

Ingen WSL, inga betalda AI-/GPU-testanrop och inga skrivtester mot verkliga användarkonton. Budgettaket är fortsatt 5 USD totalt per avgränsad testomgång. QA-processer och testdatabaser städas av sina fixtures. Isolerade kvitton finns privat i `lab/data/platform-private/n2-pg-qa/evidence.json` och `n2-ui-qa/evidence.json`; leveransloggar ligger i `n2-audit-rollout/`.

Legacygranskningen fann att originalbanken `media/dealers/{astrid,vera,amira,mei}` fortfarande används av runtime, originalmediaserver och publicerade alias (1 616 layoutposter/978 alias). Ingen flyttbar applogik hittades där. Mapparna och aktiva `services/astrid-gpu-worker` bevaras; radering kräver en separat verifierad originalbanks-/runtime-migrering. En enda övergiven publik `lipsync-overrides.json.pre-retime` har flyttats byteidentiskt till Astrids `source/calibration` (SHA256 `28197cb52298d78842d972c1790373e121a43bb59fee727e66998a0379aa5ef1`). Fyra dealerprober och nio medielayouttester PASS. Ingen ny visuell läppsynksacceptans; PAOW-provet hoppas över enligt Jakob.

Kvar: JN2-D–K i befintlig tracker; utkast/publicering, auktoritativ speldata och de beroende drift-/RG-/rapportflödena är egna implementationer. Flera varumärken/marknader per bolag, nya RG-/integrationsskrivrättigheter, lösenordsåterställning och 2FA ingår inte i denna teamleverans. GitGuardian har fortfarande 12 öppna incidenter, partiella platser och ofullständig historisk skanning; grön CI friskförklarar inte dem.


### Förberedelse för JN2-C, 12 oktober 2026

Team/behörigheter och beständig operatörsjournal har verifierats isolerat: 11 riktiga PostgreSQL-prov (inklusive konkurrens, separat konto-commit med kompensation och databasomstart) och 18 browserprov på SV/EN i 360/1440 px. Windows native; ingen WSL eller betald generering. Slutimplementationen väntar på en säker trestegsleverans: denna kompatibilitetsversion känner igen endast verifierade migrationskedjor 001–005 eller 001–006 men kräver ännu inte 006; båda produktionsvärdarna ska köra den före additiv migration 006; först därefter levereras journalkonsumenterna. 006 är uttryckligen valfri enbart i denna förberedelseversion, övriga struktur- och checksummegrindar består. Inga produktionsdata eller scheman har ändrats i detta steg. Full acceptans/leverans rapporteras när sista steget verifierats.


### Snabb N2-kontroll och standardtestbudget, 11 oktober 2026

Jakob har satt standardbudgeten till **högst 5 USD totalt per avgränsad testomgång**, över samtliga betalda testtjänster. Följ förbrukningen inom omgången; en större budget kräver nytt mandat. Detta ersätter det tidigare engångsmandatet på 1 USD för nya tester, men nollställer ingen historisk kostnadsjournal och ändrar inte tjänsternas tekniska budgetspärrar.

Jakob uppger att PAOW fungerar i runtime och har uttryckligen valt att hoppa över handoffens punkt 1. Ingen ny tal-/GPU-körning eller visuell läppsynksattestering utfördes i detta pass.

På ren main `2fb18004b9dc2656ea30227d87ec81750faf6eb0` passerade 86 riktade tester med `node --test --test-concurrency=4 --test-reporter=dot`: `test/partner-access-policy.mjs`, `test/operator-store.mjs`, `test/studio-partner-epoch.mjs` samt Labs `partner-admin-workspace`, `partner-team-api`, `partner-branding-api`, `partner-session` och `partner-set-password`. De täcker begränsade/återkallade roller och sessioner, bolagsavgränsning, nekade skrivningar, revisionskonflikter och skydd för sista administratören med syntetiska konton och minnes-/SQLite-fixturer. Detta är inte acceptans av samtidighet mot riktig PostgreSQL eller hela browserflödet med separata konto-/operatörsdatabaser; dessa punkter förblir öppna. WSL inventerades endast; ingen PostgreSQL installerades eller startades. Inga produktionsdata ändrades och inga betalda provideranrop gjordes.

Remote main och godkänd GitHub CI bekräftades på samma SHA; Vercels senaste produktionsdeployment `dpl_H5z8WtQjR3yB9UFmi2Y4sDsJoYpc` var READY på denna revision. Render har inte återverifierats i detta pass. GitGuardian hade fortsatt 12 öppna incidenter (17 totalt), partiella platsuppgifter och ofullständig historisk skanning; ingen incident ändrades.

Nästa byggsteg i befintlig tracker: JN2-C (team/rättigheter och beständig ändringsjournal), JN2-D (sparade brandutkast, granskad publicering/återställning) och JN2-E (bolagsavgränsad speldata). Därefter F–H: verklig bordsdrift, spelarhistorik/ansvarsfullt spel och avstämda rapporter/exporter. I–K är senare flöden för dealerkatalog/statistik, integrationer/kontosäkerhet och onboarding. JN2-A/B:s återstående acceptanskrav står kvar.
### Samlad granskning och städning, 11 oktober 2026

Denna mainleverans sammanför LANDES/BOLAGs och LOBBYSTRUKTURs tidigare godkända arbete på `52bcab1f` med granskad [PR #12](https://github.com/Jakeminator123/scoutgaming/pull/12), fryst på `c125deb9a022ab72839c8bf89e1463e8567512e5`. Granskningen krävde tydligt kontobyte/utloggning och rätt återinloggning för en utgången N1-session; båda är rättade. Ordinarie fullhook: 2 453 PASS/9 skip/0 fail; bygge, TypeScript och PR-kontroller passerar. Bolagsavgränsad skrivning, återkallade/begränsade roller, riktig Postgres-konkurrens och formell visuell läppsynksacceptans är fortfarande separata öppna acceptanskrav.

Alla tre samarbetande agenter har kontrollerat sina egna arbetsrester och stoppat sina egna tillfälliga QA-servrar. CARTESIA har raderat 25 förbrukade ändringsskript och två temporära fixture-/buildmappar med 12 filer ur sin privata artifactkatalog. Testloggar, bild-/ljud-/videokvitton och återanvändbara provverktyg bevaras utanför Git. Råmedia, kalibrering, env, databaser och lagrade kundfiler har inte rensats. Användarguiden och produktbeskrivningen i AGENTS är uppdaterade; äldre PAOW- och N2-beskrivningar nedan är historik.

### Dealer- och klipppapperskorg samt rensad klippstyrning, 11 oktober 2026

Samordnat mellan LANDES/BOLAG och CARTESIA, med LOBBYSTRUKTURs källfrys. De inaktiva fasvalen i Sammansättning är borttagna tillsammans med deras oanvända UI-kod. Sparade lane.openclaw/probe/idle-värden behålls och valideras vid redigering/publicering. Klippstyrningen finns i dealerns verkliga klippfack, grundloop och varianter. Spelhändelsernas aktiva kopplingar och gemensamma originalbank består. LOBBYSTRUKTUR bidrar även med två dealerneutrala chattstatusar: ”Dealern tänker…” och ”Slå på ljudet för att höra dealerns svar.”, så att PAOW inte benämns Astrid.

Egna dealers kan flyttas till papperskorg med sina klippval, idlepolicy och uppladdningar, och återställas som en sparad serverrevision. Biblioteket har även papperskorg/återställning för enskilda uppladdningar. Permanent radering är en separat åtgärd med serverkontrollerad förhandskontroll och slutlig bekräftelse, både för ett klipp och för hela dealern med dess filer. Alla aktuella dokument/paket och andra miljöers objektalias kontrolleras; grunddealers, originalbank, aktiva talprofiler och publicerade beroenden skyddas. Dealerpurge väntar minst 15 minuter från arkivering för att gamla uppladdningsrättigheter ska löpa ut. Klipppurge inväntar kvarvarande uppladdningsrättigheter. Avbruten permanent radering är hållbar och kan slutföras; återställning spärras efter första permanenta steget. Borttagna objekt får inte återaktiveras genom historik eller ett gammalt uppladdnings-ID.

Raderingens databasförberedelse och revisionskontroll sker under miljölås samt gemensamt objektlås; Blob-anrop sker efter avslutad transaktion. Borttagningsmarkörer sparas för säkra återförsök. Runtimekontrakt v5/trash-v1 spärrar åtgärder tills rätt backend är publicerad. Befintlig JSONB-lagring används, ingen SQL-migration krävs. Inga verkliga dealers eller filer har raderats under verifieringen; fel-, återförsöks- och beroendefall använder isolerade databasfixturer och fake Blob.

Verifierat före commit: 192 riktade backendtester; hela Lab 1367 PASS/2 skip/0 fail, separat TypeScript och produktionsbygge med fyra workers inklusive 82 byggspår. Fullsviten hittade äldre UI-testkontrakt och ett reentrant lås som saknades i SQL-fixturen; dessa är rättade. Ett verkligt glapp där uppskjuten navigering kunde fortsätta under en ny lifecycle-/intakeåtgärd är också rättat och regressionstestat. Dealer audit --probe matchar alla fyra originalbaslinjer; tidigare saknade, ej godkända tagningar kvarstår. Astrid, Vera, Amira och Mei har även körts med Play twice/goodluck i isolerad faktisk spelare utan insatser: Astrid visar 2/2 completed, övrigas kontroller återaktiveras utan Playback failed; inga browserfel i det granskade förloppet. Detta är ett regressionsprov, ingen läppsynksattestering. Lokal Control-SSR visar nya papperskorgen men det återanvända produktionsbyggets /studio-prefix matchar inte offlinelägets tomma basePath; interaktiv UI-kontroll utfördes därefter mot rätt publicerad profil på `52bcab1f`. Fullhookens första kontroller hittade fem nya rutter utan systemkartepost och äldre tester som avvisade v5; ruttinventeringen och kontrakttäckningen är kompletterade utan ändring av assurance-baslinjer. Ordinarie fullhook passerade: 2 387 PASS/9 skip/0 fail. CI `38172416050` hade alla tre jobb godkända; Vercel `dpl_6g3GM8YNmZsZYf8mmmYuPDj6n2h8` var READY på www och Render `dep-db5v5mavcj2c73f3gal0` LIVE på exakt `52bcab1f`, med v5/trash-v1. Liveprovet verifierade papperskorgen, PAOWs nio klipp, beroendeskydd och borttagna inaktiva fasval utan verklig radering. Visuell läppsynksacceptans är fortfarande separat.

GitGuardian läst på remote5a23f93a:17 incidenter/12 öppna/5 ignored, sex öppna utan plats; källincidenttäckning complete-for-source, platstäckning partial, övervakning aktiv och historisk scan too_large. Inga incidenter ändrade eller friskförklarade.


### PAOW: originalnyckel och miljösynk, 11 oktober 2026

Nycklarna från rotens felplacerade `.env` är avstämda mot `.env.local` och användande tjänster; detaljer utan värden finns i ENVIRONMENT-VARIABLES. PAOW och Dragge svarar 200 med sina originalröster. Canonical ElevenLabs-nyckel är sparad och återläst på Render; inga alternativa röster, GitHub-secrets eller TTS-nycklar på GPU/Vercel. Vercels OpenClaw/Resend är synkade som Sensitive och övriga värden oförändrade. Lokala Cartesia-kopior följer fungerande Render-konto. De privata env-filerna är fortsatt Git-ignorerade.

Implementation a041e48b har fullhook 2380 PASS/9 skip, CI38168414253 SUCCESS och Vercel dpl_8ywaD3iPNSJ9iU5z18q32GVCuqC8 READY. Workerbygge38168475522 SUCCESS; privat GHCR-tagg sha-a041e48b9085a3cc4e324fa960551dde2822229b, publicerad digest sha256:292ecb89721b0ddbc26e197807b378ca98a6a4ea8e68bbc63c35d86211c4383d. Senare produktionskvitto från LOBBYSTRUKTUR: 5a23f93a live på Vercel och Render, CROUPIER_DEALER_SPEECH_PROFILES=1 och PAOWs sparade profil aktiv med originalröst WZVEBKUreb9jAKojf0QF, eleven_v3 och egen idle-frame. RunPod endpoint zsudl8tmzcmiv1 har uppdaterats via normal New release till ovanstående a041e48b-image. Två efterföljande svar aa772504-ced2-4db5-8788-b575ac735d5e och ab274b9b-89c5-4c4b-903a-1b37b830db35 completed/safe_error null; första kalla förloppet tog cirka57.6–79.1s, nästa varma5.4s. Ytterligare tre användarmeddelanden completed. GPUjobbet avslutades sedan COMPLETED/reason bye. Inga insatser eller balansändringar. Teknisk kedja verifierad av den andra agenten; formell visuell läppsynksacceptans återstår. En tidigare browseravbruten körning cancelled/failed räknas separat.

GitGuardian på remote f8e5bdfd: 17 observerade incidenter, 12 öppna, partiell platstäckning, aktiv övervakning och historisk too_large. Inga incidenter ändrades.

### Johns N2: första kodleverans på egen granskningsbranch, 11 oktober 2026

`codex/john-n2-admin-partners` utgår från `f8e5bdfd` och är synkad med main `52bcab1f`, enligt Jakobs uttryckliga branch-/PR-mandat. Intern admin använder samma färskt kontrollerade N1-login till den riktiga partnerkatalogen och bolagsvyn. Johns spelbolag och SG:s bolag läses från befintligt operatörslager, även utan publicerat paket. Inga konton, extra medlemskap eller partnercookies skapas. Demo North/South och normal fixture-fallback är borttagna; N1-skyddad diagnostikförhandsvisning är avsiktligt kvar.

N1- och partnerkontext är separata; N1 har företräde om båda cookies finns, och ogiltig/återkallad N1-kontext faller inte tillbaka till kundcookie. Partnerns medlemskapsgräns består. Teamläsning kräver `team.read`; teamändringar kontrollerar exakt rättighet igen under operatörslås. Utseendeskrivning behåller resursvalidering/CAS och verklig adminaktör. Beständig audit samt konkurrensacceptans mot riktiga, separata konto-/operatörslager återstår.

Johns visuella grund finns nu i befintliga React-komponenter: sidomeny A, PageHeader, neutrala ljusa ytor/lime, mörkt läge, EN/SV, bolagsval och mobil sidväljare. Partneringångens saknade N1-stylingberoende är ersatt med egen CSS. Paket/bord kommer från snapshot; speldata märks ej ansluten och får inga exempelbelopp. Övriga affärsflöden/toppmeny B är senare leveranser i samma tracker.

Verifierat före PR: backend/åtkomst 44 PASS, navigation/visuell regression 22 PASS, ytrouter 13 PASS och uppdaterad previewtestharness 11 PASS. Slutligt Lab-produktionsbygge/TypeScript med fyra workers samt 82 byggspår passerar efter main-synk `52bcab1f`. Faktiska UI-komponenter har browserprovats med syntetisk fixtur vid 360/820/1440 CSS-px, inklusive sök, språk/tema, refresh och navigation utan horisontell overflow. Detta bevisar inte verkligt produktionslogin eller DB-konkurrens. Ordinarie fullhook på kodcommit `684864b618010caf11d2c7bef719b8fa8faf8e17`: 2 442 PASS/9 skip/0 fail i 55 testgrupper. Tidigare stopp på äldre previewharness och saknad lokal `ws`-dependency är åtgärdade, verifieringen omkörd; ingen hook eller täckning bortkopplad.

Efter granskningskomplettering i [PR #12](https://github.com/Jakeminator123/scoutgaming/pull/12) finns Byt konto/Logga ut även i den riktiga katalogen och bolagsvyn, på SV/EN och mobil. Serverns uttryckliga åtkomstklass väljer befintliga logout-API:er: admin avslutar eventuell sekundär partnersession och sedan N1; partner avslutar endast sin egen session. Fel stoppar navigation och visar möjlighet att försöka igen. Ogiltig/utgången N1-cookie återgår till N1-login med säker, exakt partner-undersida som returnTo, inte till extra kundlogin. Partnerlogin behåller sin befintliga landning på `/partner`; exakt undersideretur utlovas endast för N1. Äldre README- och trackerbeskrivningar är tydligt historiska.

Komplettering verifierad: 29 ytrouter-/navigationstester och 29 fokuserade sessions-/visuella-/previewtester PASS, noll skip; TypeScript och Lab-produktionsbygge inklusive 82 byggspår PASS. Browserprov av faktiska komponenter med isolerad fixtur bekräftar N1-/partnerkontobyte, korrekt slutdestination vid utloggning, POST-anropsordning och serverfel utan sidbyte, i SV/EN, ljust/mörkt läge och vid 360/1440 CSS-px. Inga verkliga produktionssessioner avslutades. Ordinarie fullhook på kodcommit `00511089a922c3df1f7cde81d19701a1094ef194`: 2 453 PASS/9 skip/0 fail i 55 testgrupper, inklusive sessionssviten. Ingen hook eller täckning bortkopplad.

`docs/CLOUD-MIGRATION.md` är uppdaterad i samma tracker. JN2-A/B lämnas öppna tills verklig N1 → Johns/SG, direktlänk/refresh, återkallade/begränsade roller samt tenant-/databasprov är godkända efter granskning/deployment. Inga produktions-DB-, migrations-, media-, provider- eller env-skrivningar och ingen merge/deployment har utförts.

GitGuardian-läsning före slutlig push på remote main `52bcab1f`: 17 observerade incidenter, 12 öppna/5 ignored; incidenttäckning complete-for-source, platstäckning partial (sex öppna utan plats), repoövervakning aktiv och historisk scan too_large. Ett tidigare tillfälligt anslutningsfel är därmed ersatt av färskt läskvitto. Commitkontrollen är fortfarande queued; gröna Actions eller PR-checks är inte bevis på ett incidentfritt repo. Inga incidenter ändrade eller säkerhetsläget friskförklarat. Dokumentkvitto `72ba457a` passerade ordinarie dokumenthook: 25 PASS/0 skip/0 fail.

### Johns N2-skiss: konkret integrationsplan, 11 oktober 2026

Befintliga `docs/CLOUD-MIGRATION.md` är uppdaterad med elva öppna delsteg JN2-A–K, vart och ett med frontend, backend, databas, beroenden och verifiering. Ingen ny tracker. Första leveransen är samma adminlogin till riktiga bolag i N2 och Johns visuella grund: Demo North/South försvinner ur normal navigering, riktiga bolag består. Därefter följer beständig audit och utkast/publicering, bolagsavgränsad speldata, drift/RG/rapporter och separat verifierade utökningar. Befintlig Next/Vercel-, Studio-Neon- och Render/spel-Neon-arkitektur återanvänds.

Läsande produktgranskning bekräftade att Johns spelbolag finns i N1 Bolag & team och i `/play`. Intern admin får däremot exempeldata i `/partner/sg-test`: `surface-page.tsx` väljer riktig partnerdata endast med `partner_session`. Detta ska lösas med uttrycklig, färskt auktoriserad adminkontext, inte extra kundlogin eller dubblettbolag. Startsidan använder dessutom CSS-klasser som saknas i den importerade stilmallen. Johns fristående skiss är funktionellt underlag med simulerade data/anrop, inte färdig backend.

Denna leverans ändrar endast tracker och handoff. Kodinventeringens bas är main `9d151fa6`; liveobservationernas exakta deployment-SHA är inte fastställd. Inga produkt-, DB-, roll-, konto-, nyckel-, paket- eller driftändringar utförda i denna uppgift. Separat partnerlogin och skrivning i produktion är inte provade. `git diff --check` passerar; ordinarie dokumentationshook är leveransgrind. Alla implementationspunkter är fortsatt öppna och produktacceptans kräver verkligt flöde samt tenant-/databasprov, inte mockdata.

GitGuardian läst inför leverans på main `a041e48b`: 17 observerade incidenter, 12 öppna och 5 ignored; incidenttäckning complete-for-source, platstäckning partial (sex öppna utan plats), repoövervakning aktiv och historisk scan too_large. Commitkontrollen är queued. Inga incidenter ändrade eller friskförklarade.

### Egen röst och läppsynk för registrerade dealers, 11 oktober 2026

Gemensam leverans från LOBBYSTRUKTUR och CARTESIA. Dealerregistreringen kan spara en privat v2-talprofil med egen Cartesia-/ElevenLabs-röst, modell och en visuellt vald bildruta ur dealerns egen video. ElevenLabs språk och avsiktliga röstinställningar kan anges utan dolda förval. En ändrad profil, videohash, tidsposition eller röstinställning gör den tidigare bindningen ogiltig. Video med naturlig rörelse är fortsatt förberedelse; den nya strömmande vägen använder en exakt stillbild och påstår inte naturlig andning. Grundloop och talunderlag har skilda uppgifter.

Spelmotorn kontrollerar bolagets publicerade dealer, sessionen, originalröstens åtkomst och källvideons ägare/hash innan GPU-arbete. Referensen avkodas till PNG på servern med begränsad FFmpeg-körning. En v3-worker binds till dealer, profilrevision och bildhash; samma bindning följer via Vercels WebSocket-brygga. Text, verkligt genererat ljud och videobilder tillhör samma svar. Klienten använder befintlig bord-/bakgrundskomposition. En annan dealers röst/avatar, fel worker eller gammal profil får inte användas som reserv. Originaldealernas befintliga flöden och serverägda kort/plånbok består. Ingen migration eller bolagstilldelning ändras.

**Historisk leveransstatus vid a041e48b (ersatt av produktionskvittot ovan): inte aktiverad för PAOW.** `CROUPIER_DEALER_SPEECH_PROFILES` förblir av. Inga env-, databas-, publicerings- eller providerinställningar har ändrats av denna leverans. Ny workerimage måste byggas från levererad SHA, få verifierad privat digest och provas på separat testendpoint före aktivering. Kall avatarförberedelse måste rymmas inom sessionens 90 sekunder; riktig WSS/ljud/bild och visuell läppsynksacceptans återstår. Grön lokal mockverifiering är inte fungerande PAOW i produktion.

**Historisk röstanskaffning vid a041e48b; ersatt av PAOWs produktionskvitto ovan.** PAOWs originalröst ska behållas. Kevin bekräftar att PAOW och Dragge är klonröster i hans ElevenLabs-konto. Läsning av Kevin53fb0bfd00b2086ee547bf62def44347a0a2e948 visar att `ELEVENLABS_VIDEO_KEY` används för vanlig TTS och att separat RunPod därefter skapar läppsynken; namnet är inte en videonyckel. PAOW på svenska använder `eleven_v3`, stability0.5/similarity_boost0.85/speaker_boost true; andra språk använder multilingual_v2 med andra inställningar. Ingen automatisk aliasering mot main:s API-/OC-nycklar införs. Vid denna tidpunkt behövde workspace-delning eller säker valvöverföring ordnas med Kevin via GitHub inbox #11; den senare nyckelavstämningen är klar enligt produktionskvittot ovan. Ingen hemlighet ska läggas i issue, kod eller chatt. PAOW hade då ännu ingen sparad talprofil. Den senare profilen är aktiv med originalrösten bevarad; formell visuell acceptans återstår. En faktisk bildruta från hennes registrerade grundloop har granskats privat, med oförändrad källvideo och utan AI-generering. Aktuellt material har grön bakgrund; publicerad fullframe-policy ändras inte automatiskt.

Verifierat: 99 backend/cloud/gatewaytester, 14 riktiga/lokala WebSocket-transporttester och 15 Pythonworkerprov inklusive FFmpeg PASS. Profil/referens 15 PASS; P6/klientström 58 PASS. Hela Lab-sviten 1322 PASS/2 skip före sista valfria röstfälten; efter dessa passerade riktade profil-/referenstester och slutligt produktionsbygge/TypeScript inklusive 77 byggspår. Audit --probe matchar alla fyra originaldealerbaslinjer; tidigare saknade tagningar och mänsklig läppsynksacceptans kvarstår. Astrid, Vera, Amira och Mei har även genomfört två goodluck-uppspelningar i följd i faktisk isolerad spelare; kontroller återaktiverades och inga browserfel registrerades. Detta är ett regressionsprov, ingen ny läppsynksattestering. Egna QA-servrar och testflik stoppade. Ordinarie fullhook är leveransgrind vid commit. GitGuardian läst på 9d151fa6:17 incidenter/12 öppna/5 ignored, sex öppna utan plats; incidenttäckning complete-for-source, platstäckning partial, övervakning aktiv och historisk scan too_large. Inga incidenter ändrade eller friskförklarade.

### Uppspelning och Spelhändelser & villkor, 11 oktober 2026

Samordnat med CARTESIA och LOBBYSTRUKTUR. Spelhändelserna behålls som spelmotorns kontrakt: dealer + händelse + exakt situation väljer ett inspelat klippfack. Äldre riktningar som Deal vänster är samlingsgrupper, inte en andra uppspelningsmotor. Familjeöversiktens länkar tappade tidigare situationen; nu följer exakt box/replik med och ett regressionstest täcker alla Astrids familjelänkar. Äldre händelseträd och testanimationer ligger kvar under stängd Avancerat. Eventtestets timerstyrda taldemo är borttagen; riktiga testanrop, tillåtna lägen och beslutsspår finns kvar.

Sidorna skiljer nu inspelade klipp från AI-tal. Automatiska grundloopvariationer är tidsstyrda utan modell. Vanligt OpenClaw-klippval får publik spelhändelse och tillåtna varianter; eventtestets extra sammanhang är simulerat. Den separata chattreaktionen får observerad chatt (högst 8 meddelanden/3 200 tecken). Ny text/röst/läppsynk är ett annat förlopp. Uppspelning visar separata kvittokedjor och talförlopp; urval innebär inte visad bild eller godkänd läppsynk.

Runtimegranskningen visade att lane.openclaw/probe/idle sparas men inte läses som styrning av nuvarande spelare. Den då levererade Sammansättning märkte därför fälten **Avancerat · sparat styrunderlag / Ännu inte kopplat till uppspelningen** (editorn har senare tagits bort enligt papperskorgsleveransen ovan) och länkar till aktiva dealerpolicyer och småprat. Värden, validering, sparning, publicering, serverägda spelregler och media lämnas oförändrade. Guide, ordlista och guide.json beskriver samma ansvar.

Verifierat före commit: 16 riktade tester, hela Lab-sviten 1 321 PASS/2 skip/0 fail, TypeScript och produktionsbygge med fyra workers inklusive byggspårskontroll. Ordinarie fullhook körs vid commit. Inga DB-, provider-, env- eller medieskrivningar; ingen ny tal- eller läppsynkacceptans påstås. GitGuardian läst på remote a3099298: 17 incidenter/12 öppna, partiell platstäckning (flera API429), aktiv repoövervakning, historisk skanning too_large och väntande commitkontroll.

LOBBYSTRUKTUR har dessutom lämnat slutkvitto för a3099298: CI38164798637 SUCCESS alla tre jobb, Vercel dpl_AJ2UhSnphqTzXwwSrAeU77xwWtsn READY/www och Render dep-db5tiiqvcj2c73f1kj4g LIVE med exakt SHA från /__cloud/version. Senare PAOW-talaktivering samordnas separat mellan de andra agenterna.

### Lokal repetition och publicerad produkt, 11 oktober 2026

Den localhost-vy med original/V2-dealerväljare som Jakob såg kom från vår isolerade mediarepetition på port 4194. Den använder tillfällig SQLite/testdata utan publicerat bolagspaket. Normal `lab/start.mjs` startar lokalt Studio och spelmotor, inte Next-frontenden för `/play`. Det var därför inte en jämförbar vy av det publicerade bolagets Vercelflöde.

`node lab/start.mjs --product` öppnar nu den publicerade bolagslobbyn och lämnar före lokala anslutningar, bygge och serverstart; `--no-open` skriver bara adressen. Ordinarie lokalstart förklarar samma skillnad i terminalen. Jämförelse-fixturens länkar anger `rehearsal=1`, och endast serverbekräftad loopback-isolering får sidtitel och baner **Isolerad mediarepetition**, förklaring om testdata samt fungerande produkt-/lobbylänkar till www. Ingen produktion kan aktivera märkningen med en URL-parameter. Bolagsval, spelregler och publiceringspaket ändras inte.

Verifierat: produktgenvägens test och fem rena game-entrytester PASS; verkliga HTTP-fixturetester ingår i fullhooken. Baner och produktlänk kontrollerade i webbläsare på desktop och 390 CSS-pixlar. Oberoende sexfilsgranskning utan blockerande fynd. Egen testflik stängd och port4194 utan listener efter provet. Den senaste returlänksrättningen är dessutom HTTP-testad i CARTESIAs fullhook 2355PASS/9skip/0fail på det gemensamma frysta trädet. Egen slutleverans passerade ordinarie fullhook: 2355 PASS, 9 överhoppade, 0 fel. GitGuardian på föregående fjärr-main56b4d1b1: 17 observerade incidenter, 12 öppna, platstäckning partiell, aktiv övervakning och historisk skanning too_large; ingen säkerhetsfriskförklaring görs.

Lobbyversion `6ee55e9183d0541b555e0786fee6b4b2512cbea0` har CI38160345686 success, Vercel READY med www-alias och Render live med exakt SHA via `/__cloud/version`. SG-test/revision15 visar rätt tilldelning. PAOW/Johanna previewmetadata svarar200; dealer/bord/bakgrund HEAD200, byteintervall206, gammal revision409 och otilldelad dealer404. Stor Johanna-preview, riktiga bildkort, bakgrundsbyte och paus verifierade på www utan att starta spel eller betald generation. PAOWs egen talaktivering är fortfarande separat, inte verifierad av detta UI-prov.

### Astrids taltransport: 404-rättning, 11 oktober 2026

Produktionens `/lipsync-worker` och `/speech-stream` svarade med Nexts HTML-404 även vid WebSocket-handshake. Astrid kunde skapa ny svarstext men stannade i `video-queue` med `generated_speech_session_worker_failed`; RunPod laddade modellen men rapporterade `session failed`. Render väntar på GPU-sessionen före Cartesia, vilket även förklarar det uteblivna ljudet. Produktionsnycklarnas närvaro, aktiveringsflaggor och Astrid-endpoint verifierades på spelmotorn `croupier-v2`; inga lokala env-filer eller hemligheter kopierades till drift.

De två exakta publika socketvägarna får nu en explicit Node-service `speech` i samma Vercel-projekt. Den återanvänder befintlig native-bridge, Render-auth, engångsbiljetter, worker-bearer och tids-/kögränser. Enbart serverexporter under Next-appens vanliga `api/` gav inga publicerade Next-rutter. Servicebygget använder frontendens låsta beroenden; nycklar och spel-/providerägarskap stannar på befintliga tjänster. Övriga URL:er får inte åtkomst genom talservicen.

Transportens rena konfiguration ligger i `platform-configuration.mjs`; frontendroutern reexporterar samma funktioner. Valideringsfunktionerna är byte-identiska efter flytten. Det förhindrar att den fristående Node-byggaren följer frontendroutern till browsermoduler med absoluta UI-importer. Första molnbygget stoppade före promotion på just denna beroendegräns; ingen betald generation användes för felsökningen.

Före slutleverans: 35 riktade transport-/routingtester PASS, inklusive riktiga relay-bytes genom den nya servicen och nekad främmande ägare/token/återspelning. Efter beroendeisoleringen är även 22 routingtester gröna. Faktisk `@vercel/node`-paketering inkluderar entrypoint, dispatcher, befintlig bridge och ws (40 filer); källorna oförändrade av provet. Första fullhook: 2355 PASS, 9 överhoppade, 0 fel. Slutlig fullhook: 2355 PASS, 9 överhoppade, 0 fel. CARTESIA verifierade Vercel56b4d1b175afe25668fd8c57e5c34322067de5b6 READY/www med Render6ee55e91 oförändrad. Ett enda nytt chattanrop i befintlig SG-test/Astrid-spelare gav texten "Hello Jakob, welcome to the table.", publik WebSocket101, 104 binärpaket/6 136 464 byte, 81 workerframes och completed:true/source:generated-lipsync-stream. Exakt mottagen MP4 hade 1080×1920 H264 och AAC24k mono, 3,4177 sekunder; ljudet var inte tyst (mean −18,4 dB/max −1,5 dB). Munrörelse syntes i granskade frames vid 0,6/1,4/2,2 sekunder. Första synliga frame kom efter 54,992 sekunder och avslut efter 58,225 sekunder, varav worker audio_analysis tog 16,410 sekunder. Latens och mänsklig kvalitetsacceptans kvarstår; reviewStatus:pending bevaras. Inga nycklar, databas- eller providerinställningar ändrades. Mediefil och sanerat provkvitto hålls privat utanför Git. Provet gäller Astrids transport, inte PAOWs egen talaktivering.

**Status:** Jakob har därefter beställt förenklad bolagsadministration och ett gemensamt dealerbibliotek. Arbetet har samordnats mellan administrationschatten, dealerchatten och lobbychatten. Den ursprungliga lobbygranskningen var skrivskyddad; Jakob har därefter beställt en separat förbättring av den publika lobbyn. Den tidigare leveransen c48c6754 är fortsatt baslinje; nedanstående tillägg beskriver den nya leveransen.

Detta avsnitt är aktuell sammanställning. Daterade anteckningar längre ned är historiska kvitton och felsökningsspår. Deras ord som "återstår", "inte levererat" och "aktuellt" gäller den angivna tidpunkten. Historiska påståenden om saknat Provspela, trasig webview, tom Amira-scen och väntande c48c6754-deploy är ersatta av verifieringen här. Olösta frågor nedan är däremot fortfarande öppna.

### Dealerpreview, talunderlag och registrerad chatt, 11 oktober 2026

Lobbyn får stor dealerpreview, riktiga dealerporträtt och bildval för tillåtna bord/bakgrunder. Kevin-porträtten kommer från fa8501a3387e391c7d428cf0aac47e6b058b9ddf; exakta källor och SHA256 finns i frontendens images/lobby/source-provenance.json. Ingen Kevin-autentisering, lagring, spelmotor eller röstkoppling följer med. Tillgänglighet styrs fortsatt av bolagets publicerade rum. Preview och varje medieläsning kontrollerar färsk bolagsstatus, rum, paketrevision och tilldelning. Endast fryst grundloop och tillåtna lager exponeras via no-store-proxy; utkast, röstprofiler och privata lagringsadresser lämnas inte ut. Fullframe/mixad mediepolicy får ärlig porträttreserv; inga påhittade lager. Motion stannar utanför synfältet och vid minskad rörelse.

Dealerregistreringen får en inaktiv talprofil: egen Cartesia/ElevenLabs-röst och modell samt referens till egen video med exakt hash och granskad tidsposition. Valen är stillbild från videoposition eller video med naturlig rörelse. Detta sparar underlag, inte en ny bildfil eller aktiverad avatar. Profilen följer inte med publika paket. Astrids befintliga worker tar fortsatt sin förberedda avatar; egen PAOW-röst/avatar/worker och övergång till grundloop måste verifieras separat innan ljud/läppsynk kan aktiveras.

Registrerade dealers som PAOW kan nu använda textchatt och separat spelarägt minne genom en exakt publicerad bolags-/rums-/revisions-/dealer-kontext. Servern läser om publiceringen under asynkrona svar och sessionsägaren även efter minnesskrivning. Registrerade dealers är text-only utan verifierat genererat media; de får inte någon annans röst eller Astrids video. De fyra originalens befintliga chattväg består. Inga migrationer, providerinställningar, kostnadsgränser, verkliga spelardata eller publiceringspaket ändras.

Verifiering före commit: 100 frontendtester, TypeScript och Next-produktionsbygge godkända; gemensamt Labbygge/TypeScript och 77 byggspår godkända. 48 workspace/chatt-HTTP-tester samt 3 isolerade medietester passerade. Audit --probe matchar alla fyra dealerbaslinjer; befintliga saknade taltagningar och manuell läppsynksacceptans kvarstår. Astrid, Vera, Amira och Mei provades med två goodluck-uppspelningar i verkliga spelaren på isolerad localhost4194; kontroller återaktiverades utan repetitionsfel. Detta är regressionsprov, ingen ny visuell läppsynksattestering. Mobil lobby provad vid 390 CSS-pixlar utan overflow, tangentbordsbyte och lagerbyte fungerade. Alla egna lokala serverprocesser och testflikar stoppades efter provet. Fullhook och produktionskvittot följer leveransens faktiska SHA.

Administrationsleverans d13bc9df68a9a10d218ba6a6b24807179fde0ff5 passerade fullhook 2351/9/0 (pass/skip/fail) och publicerades. Dess två överlämnade CSS-rättningar (temabakgrund och obrutet Bolag-etikett) följer denna leverans; riktad tema/overview-kontroll 6/6. CARTESIA äger en separat rättning av produktionens WebSocket-404 för Astrids videotjänst. Jakob har även beställt tydligare lokal start efter att den isolerade original/V2-repetitionen förväxlats med bolagets publicerade Vercelflöde; den uppgiften följer efter denna leverans.

### Översikt och arbetsområden, 11 oktober 2026

Översikt får valt bolag, nästa relevanta steg och dealer → sammansättning → publicering → spelrum. Publiceringsstatus använder den befintliga publika rumslistans strikta bolags-/URL-kontrakt; Studio visar bara sparade namn och ID:n. Vid fel, laddning eller ändrad paketversion visas ingen bekräftad rumsstatus. Bolagsbyte tömmer föregående data och avbrutna/sena svar kan inte återställa den. Inga nya API:er eller skrivåtgärder införs.

Talgranskning ligger visuellt under Studio med bevarad adress och identitetsbunden manuell bedömning. Administrationsflikar delas per Studio, Drift och Administration. Äldre classic/high/vip-standarder förklaras separat från bolagsägda rum. Aktiva event-/2D-klippskopplingar behålls; läppsynksacceptans, CAS, behörigheter, osparat-skydd och spelregler ändras inte.

Verifiering inför leverans: 97 riktade tester och fyra fullständiga berörda hookgrupper (344 tester) gröna; TypeScript, gemensamt Lab-produktionsbygge med fyra workers och 77 byggspår godkända. Även isolerat offlinebygge är grönt, men den inloggade /control-sidan kräver native Studio-konfiguration och kunde inte visuellt granskas i offline-gästprovet. Fullhook och visuell produktionskontroll genomförs vid leverans. Inga riktiga bolag, behörigheter, publiceringspaket eller mediafiler ändras av verifieringen.

Dealeragentens separata leverans är verifierad på main `72003249` (kod `af7f790a`): fullhook 2293 godkända, 9 överhoppade, 0 fel; GitHub CI `38157984326` grön och Vercel `dpl_8DWH3CziP8X662eTZ5Puf2efAaB2` READY på www. PAOW:s nio klipp, sidindelning, facklänkar, Veras klippkontroller och Sammansättningens uppspelningspanel kontrollerade live. Detta kvitto gäller inte lobbyagentens separata chattbackend som levereras efteråt.

### Administration och dealerbibliotek, 11 oktober 2026

Bolagsadministrationen utgår från ett valt bolag. Spelrum & publicering och Team & behörigheter behåller bolaget i länkarna. Bolagslistan är sökbar; endast valt bolags medlemsformulär visas. Adressnamn föreslås från bolagsnamnet, och inbjudan/befintligt konto använder ett gemensamt inmatningsfält. Svenska rollnamn och verkliga behörigheter visas utan interna revisionsnummer. Spara roll visas när en roll ändrats. Interna konton & spelare och API & integrationer är tydligt separata.

Spelrum visas före paketurvalet. Nytt rum publicerar vald presentation i samma serveråtgärd; befintliga rum uppdateras via Uppdatera publicerade presentationer. Tekniska driftverktyg ligger kvar under Avancerat. Ingen ändring i API-behörigheter, CAS/revisionsskydd, transaktioner, idempotens, publiceringsvalidering eller spärren mot att ta bort sista bolagsadministratören.

Verifierat: 110 riktade tester, TypeScript, gemensamt Next-produktionsbygge med fyra workers och kontroll av 77 byggspår. Verklig lokal routing behåller bolaget och ger inga konsolfel. Layout med fiktiv SSR-data granskad i mörkt/ljust tema och vid 390 CSS-pixlar. Det isolerade serverparet använder tom testdatabas och avstängda externa tjänster; bolagsteamets layoutprov är inte ett kvitto på produktionsinbjudningar. Ingen riktig inbjudan, kontoändring eller paketpublicering utfördes.

Dealerchatten levererar separat det gemensamma biblioteket för registrerade dealers, kategorier och upp till 50 filer per intag. Blandade MP4/WebM och MP3/WAV granskas och mappas individuellt; ljud kräver exakt talreplik och ersätter inte lipsynkad talvideo. Återställbar borttagning skyddar sparade användningar. Nya dealer-/klippmetadata ägs av Neon och bytes av privat Blob; gemensam runtime-metadata finns i media/catalog. Befintliga inspelade bytes är oförändrade. Se teknisk detalj och kvarstående mediaacceptans i LOCAL-PRESENTATION-RUNTIME.md.

Dealerbibliotekets implementation är klar: bulkval med individuell mappning till box/replik, MP4/WebM/MP3/WAV och återställbar arkivering. Isolerad verifiering med helt frånvarande media/dealers laddar PAOW:s eget register samt originalens grundloopar, talmetadata och klippinventering. Katalogen behåller exakta metadata-byte och hashkontroller. UI-prov: tio blandade filer, separat mappning, låst dealerbyte under intag, separat PAOW-vy och mobilbredd 390 CSS-pixlar. Inget testmedia laddades upp i produktion. Befintlig tal-/videoacceptans ändrades inte; originalmapparna behålls som pipeline- och kalibreringsunderlag.

Jakob förmedlade den 11 oktober obekräftade uppgifter från Kevins separata miljö: Astrid använder enligt Kevin Cartesia sonic-3.5 med Freja, medan Dragge och PAOW har klonade ElevenLabs-röster samt varsin MuseTalk-endpoint på RunPod; Mårten saknar röst. Uppgifterna är integrationsunderlag, inte verifierad produktion. Rekommenderad modell är en separat talprofil per dealer och språk med leverantör, röst, modell och avatar/endpoint. Ingen nyckel, endpoint, leverantör eller betald körning aktiverades från Slack-uppgifterna.

### Fack, varianter och mediehantering, 11 oktober 2026

Dealerbiblioteket har en gemensam kategorinavigation med exakta fack. Saknad eller ej vald grundloop markeras som krav i rött; saknade deal-videor för exakt destination är rekommendationer i gult. Originalinventering kontrolleras separat och ger okänd status vid läsfel. Arkiverad, otillgänglig, främmande dealer eller ljudfil räknas inte som ett färdigt videofack. Sex filer visas per sida, även efter filtrering på ett fack. Fackets inställningar öppnar klippval, varianter och villkor utan en andra kategorimeny.

Probe heter AI-småprat vid inaktivitet i gränssnitt och guide; teknisk route och runtime är oförändrade. Sammansättning visar Uppspelning · regler, slump och OpenClaw. Bord/bakgrund kan tas bort ur utkastets bibliotek när ingen presentation refererar filen; ångra återställer metadata medan sidan är öppen. Inga Blob-bytes, publicerade paket, dealerprofiler eller providerinställningar ändras.

Verifierat: 64 riktade tester, TypeScript och ett Next-produktionsbygge med fyra workers. UI-prov i separat tom testdatabas visade sex klipp/sida, återställning till första sidan vid fackbyte, korrekt variantfack och rött/gult för en nyskapad testdealer. audit-dealer-sync --probe matchar alla fyra originalens regressionsbaslinje; tidigare visuell läppsynkacceptans ändras inte. Lokalt /api/clip-controls svarade 500 och visas därför som okänd originalstatus, inte som saknad eller godkänd media. Uppspelningspanelen lyfts ur en extra Avancerat-nivå och vald fackeditor rullas fram. Fullhook passerade med 2293 godkända, 9 hoppade över och 0 fel (2302 totalt). 77 byggspår kontrollerade. Produktionsdrift verifieras efter push. Testserverparet är stoppat. Andra agenters lobby-, översikts- och talprofilarbete ingår inte i denna commit.

Skrivskyddad PAOW-granskning: SG test publicerar revision 15 med PAOW i rum room-e46c60e2-8857-7b37-9363-5a37cff9e49a. Render körde 69e2407e; dess /chat och chattminne accepterar bara de fyra originaldealers, vilket förklarar invalid_chat_context före OpenClaw. Render har GENERATED_SPEECH, CLOUD_GENERATED_SPEECH och STREAMING aktiverade samt Cartesia-, RunPod- och OpenClaw-inställningar. Ingen ElevenLabs-inställning fanns bland tjänstens 51 egna miljövariabler; workspace-listan innehöll inga envgrupper; providerbehörigheter är inte verifierade. Vercels motsvarande talflaggor är avstängda, men talruntime ligger på Render. Inga miljövariabler ändrades och inga betalda anrop gjordes. Lobbystruktur-agenten äger den samordnade backendfixen och talprofilarbetet; denna UI-leverans löser inte PAOW:s tal eller lipsynk.

### Publik bolagslobby, 11 oktober 2026

Startsidan och dess statiska/animerade spelkort leder nu till /play med Välj bolag. /demo omdirigerar till samma lobby och bevarar endast en giltig operator-parameter. Den generella ingången visar alltid bolagsval; lokalt sparat bolag hoppar inte över steget. Därefter väljs publicerat rum, tilldelad dealer och tillåtna miljöval. Layouten är inspirerad av Kevins Table Studio, men ingen Kevin-inloggning, bordslagring, API, spelmotor, talvideo eller konfiguration har importerats. Befintliga publika katalog- och spelstartskontrakt består. Illustration och valsammanfattning påstår inte att vara en exakt medieförhandsvisning; privata medieadresser exponeras inte.

Verifierat före commit: 84 frontendtester, explicit TypeScript-kontroll och Next-produktionsbygge. En kortlivad frontend-fixture använde endast fiktiva GET-svar och ingen DB/spelmotor: /demo behöll operator, bolags-/rums-/dealerbyte och pilknappar fungerade, fullframe dolde miljöval, /play visade bolagsval trots sparat bolag, 390 CSS-pixlar hade ingen horisontell overflow och konsolen var felfri. Fixtureprocesserna är stoppade. audit-dealer-sync --probe passerade baslinjen för alla fyra befintliga dealeruppsättningar; detta är inte ny mänsklig läppsynksacceptans. Arbetet är samordnat med LANDES/BOLAG och CARTESIA och omfattar bara publika frontendfiler samt denna handoff. Inga produktionsbolag, rum, konton, paket eller mediabytes ändras av lobbyarbetet.

### Molnkopplingar och lokal env kontrollerade 11 oktober 2026

Granskad GitHub main: `ecb68570c616b8bd6f84b408dac7266111ebf2af`, repo-ID `1380630440`. Huvudkopian och arbetskopian 74b4 var rena på samma SHA. Vercel `scoutgaming/scoutgaming` (`team_Scxorb9qtZHjNae1YEQnFCaT`, `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`) hade production READY/PROMOTED på samma SHA, deployment `dpl_AiCNk5a12gvnRwNdeiSoWvqPPZ1H`. Render croupier-v2 hade live `dep-db5o4hrrjlhs73auukj0`; /__cloud/version bekräftade samma SHA. www, /play, /partner/login och /api/operators/sg-test svarade 200; apex gav 308 till www.

Vercel-CLI har verifierad åtkomst till nya teamet. Vercel-pluginen återauktoriserades senare samma dag med Jakobs godkännande. list_teams och get_project bekräftade åtkomst till scoutgaming i nya teamet; 403-felet är löst. Inga Cursor-inställningar behövde ändras. GitHub-connectorn har läs-/push-/adminbehörighet till rätt repo; befintlig användar-CLI och Git/SSH fungerar utanför Windows-sandboxens credentialbegränsning. Render-connectorn når Jakob's workspace och samtliga fyra Croupier-tjänster. QA och Director ligger avsiktligt kvar på ee060804; Gateway på 15bd1541, med Auto-Deploy OFF. Deras identiska repo/branch är inte bevis på samma driftsversion som produktionen.

Neon croupier-production, `wandering-hill-60561912`, ägs nu verifierat av Vercel: scoutgaming (`org-green-butterfly-00780270`), region aws-eu-central-1. Main `br-flat-fog-b161a6r8` och produktionscompute är aktiva; croupier_game, neondb och befintliga separata QA-/restore-databaser består. Ingen schema-/data-/rolländring gjordes.

Production, Preview och Development env hämtades till privata, ignorerade snapshots. Production gav 59 namn, varav 29 värden var icke-tomma och 30 kom tillbaka tomma. Detta intygar inte full hemlighetsparitet. Sammanslagningen bevarar sju tidigare lokala värden när molnsvaret är tomt och lämnar andra otillgängliga värden osatta. Root .env.local och lab/.env.local innehåller nu samma 56 namn i huvudkopian och 74b4. Opt-in-filer för tal och molnlagring bevarades; gamla lokala filer och frontendens gamla Vercel-länk säkerhetskopierades privat före uppdateringen. Root-, Lab- och frontendlänkar pekar nu på scoutgaming i nya teamet. Systemnycklar och oanvända LLM_LOGIN_* kopierades inte till de aktiva filerna.

Huvudkopians `node lab/start.mjs --check --cloud-storage --astrid-camera` passerade; Director health och autentiserat API svarade 200. Barnprocesskonfigurationerna använder isolerat lokalt spel och saknar produktions-game-URL/postgresläge; servrar startades inte. Modellanrop, providerautentisering och visuell mediaacceptans är inte provade av --check. 74b4 saknar installerade Lab-beroenden och är därför inte startverifierad; kör lokal produktutveckling från huvudkopian. Privata env-/backupkvitton finns i lab/data/platform-private/cloud-sync-audit i respektive kopia.

Aktuell GitGuardian-läsning: 17 observerade incidenter, 12 öppna, 5 ignorerade, 0 lösta; platstäckning partiell, 6 öppna utan plats. Repoövervakning aktiv, historisk scan too_large, commit-suiten queued. Inga incidenter eller åtkomsträttigheter ändrades.

### Målbild och ansvar som Jakob har fastställt

- **N1 /control:** vi äger dealers, deras klipp och händelse-/grundloopsregler, bord, bakgrunder, sammansättningar och bolagens tilldelade paket.
- **N2 /partner:** bolagets personal granskar sitt paket och ändrar endast uttryckligen tillåtna mindre val. API och partnerbehörighet ska följa samma bolagsgräns. N2 äger inte dealerns sekvenslogik.
- **N3 /play:** välj bolag, publicerat spelrum och tillåtna dealer-/miljöval, öppna blackjack.
- **Tre lager:** dealer reagerar på spelhändelser med sin egen klipplogik; bordet är en statisk bild; bakgrunden är en bild eller en egen loopande film. Fullbildsfilmer behåller den miljö som redan finns i filmen. Separata lager kräver frilagd/greenscreen dealerfilm.
- **Johannas enda grundloop räcker för första funktionstestet.** Skapa inte 20–40 testklipp. Fler inspelningar, långtidstest och visuell läppsynkacceptans är separata uppgifter.
- Förenkling är styrande: återanvänd befintliga sidor, spelmotor och publicering. Tekniska ID:n ska normalt vara automatiska; namn och sparade val ska väljas i UI.

```text
Dealers & klipp: dealer + grundloop + valfria händelseklipp
                         +
Sammansättning: bord + bakgrund + placering + tillåtna alternativ
                         ↓
                    Spara → Provspela
                         ↓
Publicering: välj bolag → öppna befintligt rum
                         eller
             skapa rum + publicera i samma steg
                         ↓
/play: välj bolag → rum → dealer/miljö → blackjack
```

**Dealer** är identiteten med egna filmer. **Sammansättning/presentation** är scenens standardval, tillåtna alternativ och geometri. **Partnerpaket** är en fryst publicerad version av bolagets tilldelning. **Spelrum** är den spelbara ingången. **Spellane** är en intern spelkonfiguration, inte en extra dealer eller ett fjärde videolager. Dealerbibliotekets fem dealers betyder inte fem publicerade rum.

### Vad vi har genomfört

| Område | Slutligt resultat |
| --- | --- |
| Studioflöde | Dealers & klipp → Sammansättning → Publicering. Sammansättning är enda presentationseditorn. Vald dealer/presentation följer länkarna. Namnbyte behåller identiteten. Bord/bakgrund laddas upp i respektive lagerpanel. |
| Egna dealerhändelser | Paket v3 fryser egna dealers explicit sparade händelsekopplingar, klipp, mediahashar, greenscreeninställningar och valfria idlepolicy. Paket v1/v2 läses fortsatt; äldre egna v2-dealers behöver återpublicering för händelseklippen. En film enbart i biblioteket följer inte med utan koppling. |
| Gemensam uppspelning | Dealer börjar i grundloop och återgår dit efter eget händelseklipp. Saknat positionsklipp stoppar inte kortspelet och lånar aldrig en annan dealers film. Regler/Automatik/OpenClaw använder tillåtna sparade kopplingar; runtime kräver capability v4 för v3-paket. |
| Rätt dealer | Amira/Vera/Mei använder rätt originalmotor; Astrid och egna dealers använder lokal spelare. Val behåller bolag, rum, lane och revision. Tom Amira-scen och återfall till standarddealer rättades. |
| Rum och publicering | Bolagets riktiga publicerade rum visas i lobbyn. Publicering återanvänder rum; nytt rum skapas bara uttryckligen. Fem validerade konfliktkoder gör publicerings-/rumsfel begripliga. Delat paket kan uppdateras med gemensamt snapshot utan att rum/tables/branding tappas. |
| V3 och befintliga rum | Samma kontroll av frysta tillåtna dealers används i publicering, spelstart, media, N2, lobby och replay. Ett befintligt Amira-rum kan därför starta tillåten Johanna. Saknad lane/ogiltig idle/otillåten dealer nekas fortsatt. Rumsrefererad spelkonfiguration kan inte raderas. |
| Provspela | Adminbunden 20-minuterssession från sparad sammansättning; ordinarie blackjackmotor, separat minnesdatabas och 10 000 EUR testsaldo. Inga ordinarie saldon, bolagspaket eller rum ändras. Inspelade klipp, Standard/Regler/Slump fungerar; externa OpenClaw-/chatt-/kamera-/genererat-tal-anrop är avstängda endast i detta isolerade läge. Till Sammansättning stänger sessionen. |
| Bolagsportal | /play samt allmän /play/blackjack leder till befintlig lobby. Enbart operator leder till bolagets lobby. Explicit rum/dealer/lane/launch/rehearsal behåller sin spelväg. /api/operators visar endast namn/slug för aktiva bolag med spelbara publicerade rum; läsfel ger 503, inte demo-/reservlista. |
| Automatiska ID:n | Ny sammansättning behöver namn. Administrationens tekniska spelkonfiguration behöver namn + sparad dealerlista, med giltig aktiv dealer förvald. UUID behålls vid återförsök. Ett gammalt exakt ID kan anges endast efter uttryckligt återställningsval under Avancerat. |
| Konton | Befintlig gemensam inloggning stöder adminuppgifter för en separat spelarsession; en admincookie ensam är ingen spelarsession. Provspela använder separat testsaldo. Angivet partnerkonto fick Partner editor och aktivt medlemskap i Johns spelbolag; inget nytt mejl skickades. Själva kontots aktivering och verkligt N2-sparprov är inte slutverifierade. |
| BO-städning | Två alltid dolda paneler, deras flagga, gammal importlista och oanvänd spelvägsmetadata togs bort. Aktiv legacyuppspelning, neverAgain-spärrar, sparad BO-data och använd granskningsvy behölls. Ytterligare gammal kod får inte tas bort enbart på grund av namnet BO. |
| Policyinventering | idlePolicy, dealerIdlePolicies, mediaPolicy, legacyClipPolicy och probePolicy har faktiska konsumenter. presentationProfile är visningskategorier. Äldre clipAssignments är granskningsdata. Dessa är inte generellt obsoleta. |

### Faktisk produktionsåterställning och aktuella ingångar

Testrummet pekade på en saknad definition: `room-lane-9c162457d38b353be86e2731`, deterministiskt från mobile-phone + amira. Endast den definitionen återställdes via befintlig N1 game-lanes/create: portrait-video, amira, amira-presentation, Testrummet · Amira. CAS-svar 200; då oförändrad aktiv lane, identisk rumslista och SG-test-paket revision 7. Vi skapade inte nya rum eller återpublicerade paket vid reparationen. Revision 7 är ett kvitto från reparationsögonblicket, inte ett antagande om framtida ändringar från Jakob.

| Ingång | Syfte |
| --- | --- |
| https://www.scoutgaming.tech/control/clips | Dealerbibliotek, grundloop och händelseklipp |
| https://www.scoutgaming.tech/control/preview?lane=johns-johanna | Befintlig Johannasammansättning och Provspela |
| https://www.scoutgaming.tech/control/lanes | Publicera bolagets paket och hantera spelrum |
| https://www.scoutgaming.tech/play | Allmänt bolagsval |
| https://www.scoutgaming.tech/play?operator=sg-test | SG test game provider: Testrummet och ny-jhanna vid senaste prov |
| https://www.scoutgaming.tech/play?operator=johns-spelbolag | Johns spelbolags publicerade rum |

Verifierade rum: SG-tests Testrummet `room-e46c60e2-8857-7b37-9363-5a37cff9e49a`, SG-tests ny-jhanna `room-07b92acb-42d4-1941-3777-5e37b39951e9`, Johns Johannas blackjack `room-06f0722d-74bf-49ca-8546-f6328ac69909`. Johns lobby visade även test-john-rum och Johannas blackjack 2 i senaste läsningen; de skapades inte i vårt slutprov. Läs aktuell publicerad katalog före ändringar och anta inte att antalet rum är konstant.

### Leveranskvitton och verifiering

| Version | Vad den levererar | Kvitto |
| --- | --- | --- |
| 06a732c3 → 8dd4a6ab | Rätt dealer/lobby och samlad Studio-editor; korrigerade lagerfixturer | 8dd4a6ab CI 38062846515 SUCCESS, Vercel och Render verifierade då |
| 2cc59e3481c3fb491284661a9f1a059f0f572c87 | Isolerat Provspela och rumsdiagnos | Fullhook 2256/2247 PASS/9 SKIP/0 FAIL; CI 38134822394 SUCCESS; båda hostingytor verifierade då |
| 19190616354a4eb8a26a670b9452c2a3b3ff7008 | Frysta dealerval i befintliga rum, skydd mot borttagning av rumsrefererad lane | Fullhook 2263/2254 PASS/9 SKIP/0 FAIL; CI 38136442361 SUCCESS; båda hostingytor verifierade då |
| c48c6754baeda6f3346cca7d0aa149b69b1e5c27 | Bolagsportal och automatiska tekniska ID:n | Fullhook 2282/2273 PASS/9 SKIP/0 FAIL; CI 38137920176 SUCCESS; senaste produktkod |

För c48c6754: GitHub-wrappern bekräftade identisk fjärr-SHA. Vercel `dpl_A2gs4PAM7WiYvDJFPhXvGLMu79bT`, projekt `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`, production READY/PROMOTED. Separata inspect-kontroller bekräftade www och apex på samma deployment. Render `https://croupier-v2.onrender.com/__cloud/version` gav HTTP 200, provider render och exakt samma SHA. Render aktiverades genom Auto-Deploy; ingen extra manuell deploy gjordes i slutleveransen.

- Frontend- och Lab-produktionsbyggen, TypeScript, riktade API-/auth-/portal-/publiceringstester och oberoende läsgranskning passerade.
- Isolerad byggd lobby vid 1440/390 px: bolagsval, tillbaka till alla bolag, rum/dealer/startlänk, tom-/fel-/försöka-igen-vyer utan sidfel eller overflow. Lokal kontotjänst saknas avsiktligt i fixturen; det är inte ett felbevis från produktion.
- Alla fyra originaldealers klarade två goodluck-uppspelningar i verklig spelklient. audit-dealer-sync --probe matchade befintliga mediabaslinjer. Inga mediabytes/kalibreringar ändrades; ingen ny mänsklig läppsynkacceptans påstås.
- Provspela verifierades live med Johanna, statiskt bord, loopande bakgrund, bakgrundsbyte och återgång; separat 10 000 EUR testsaldo. Sessionen avslutades.
- c48c6754 live: /play/blackjack → /play, Johns och SG test visas i bolagslistan, katalog-/rumsanrop HTTP 200. Visa alla bolag och val av Johns fungerar. Inga browserfel.
- Johns befintliga rum öppnades från lobbyn med vald Johanna. Skärmbild visar dealer + svart/guld-bord + casinobakgrund. Bakgrundsvideo och dealerfilm readyState 4 och spelar. Saldo 860 USD, insats 0, inga insatser eller saldoändringar utfördes.
- N1-formen verifierades live med namn, fem sparade dealers, giltig Johanna förvald och automatisk-ID-text. Återställning ligger under Avancerat och kräver opt-in. Ingen produktionskonfiguration skapades i det formulärprovet.
- Ett extra lokalt Studio-skärmbildsprov blandade /studio-produktionsbygge med offline-root och räknas inte som godkänt; det efterföljande riktiga liveformulärprovet ovan passerade.

### Kvar, avgränsningar och lämplig nästa uppgift

1. **N2:s fullständiga livekedja:** kontrollera aktuellt konto-/medlemskapsläge, låt användaren hantera eventuell aktivering och verifiera tillåtna val → spara → omladdning → rätt rum. Partner editor-medlemskapet var aktivt vid kopplingen; kontots då inaktiva flagga får inte antas vara oförändrad. N2:s spelare, transaktioner, rapporter, full auditjournal/chips och lösenordsåterställning är inte färdig produktomfattning.
2. **Radering:** egen oanvänd dealer kan tas ur utkastet; grunddealers/refererade dealers skyddas. Filmer och publicerade paket behålls. Bord/bakgrund kan avmarkeras. Permanent mediefilsradering och borttagning/avstängning av bolag saknas i UI/API; medlemskapets Stäng av är inte bolagsavstängning. Detta behöver uttrycklig egen implementation, inte en rensning av produktionsdata.
3. **Mediaacceptans:** Johannas idle bevisar flödet. Full klippuppsättning, visuellt godkännande per replik, längre drift och tidigare rapporterad lucka mellan idlecykler är inte slutaccepterade. Orsaken till den äldre femsekundersluckan är inte bevisad. Preload-/överlappsplanen i historiken är inte implementerad och ska inte tas som felorsaksbevis.
4. **Säkerhet:** senaste läsning på c48c6754 visar 17 observerade incidenter, 12 öppna, 5 ignorerade, 0 lösta; 6 öppna utan platsuppgift. Incidentlistan är läst, platstäckning partiell, monitorering aktiv och historisk scan too_large. Grön CI betyder inte rent GitGuardian-kvitto. Inga incidenter ändrades av oss.
5. **Ingen ny funktion startas som del av avslutningen.** Besvara först nästa agents konkreta överlämningsfrågor. Jakob har inte bett om automatisk bevakning, nya sessioner, konton, testklipp eller fler spelrum.

### Filkarta för nästa agent

| Del | Börja i |
| --- | --- |
| Användarflöde och begrepp | lab/docs/README.md, lab/docs/TERMINOLOGI.md |
| Runtime- och miljöregler | docs/LOCAL-PRESENTATION-RUNTIME.md, docs/ENVIRONMENT-RESTORATION.md |
| Frysta paket och egna klipp | web/storage/presentation-package.mjs, web/storage/frozen-presentation-capture.mjs, web/storage/frozen-dealer-presentation.mjs, web/frozen-dealer-playback.mjs |
| Lager och dealeridentitet | web/public/local-presentation.mjs, web/public/dealer-identity.mjs, web/dealer-identity.mjs |
| Provspela | web/studio-preview.mjs, web/public/studio-preview-client.mjs, lab/lib/studio-preview-client.mjs, test/studio-preview.mjs, test/studio-preview-client.mjs |
| Rum, v3-kompatibilitet och N2 | web/presentation-room-contract.mjs, web/public-operator-rooms.mjs, web/partner-presentation.mjs, lab/lib/presentation-room-api.mjs, lab/lib/partner-presentation-choices.mjs |
| Bolagsportal | web/public-operators.mjs, web/server.mjs, apps/croupier-frontend/components/player/player-lobby-operator.tsx, apps/croupier-frontend/lib/player-lobby.mjs, lib/platform-routing.mjs och lib/server-ui.mjs i samma frontend |
| Automatiska spelkonfigurations-ID:n | lab/components/studio-administration.tsx, lab/lib/studio-admin-data.mjs, web/storage/studio-game-policy.mjs |
| Leverans och samordning | AGENTS.md, agent-talk/README.md, tools/push-github-work.mjs, tools/security-status.mjs, tools/precommit-checks.mjs |

### Lokal städning, bevarande och överlämningssätt

- Arbeta i befintlig checkout `C:\Users\jakob\dev\projects\scoutgame`, endast main, GitHub `Jakeminator123/scoutgaming`. Inga nya worktrees/branches, reset, force-push eller stashes. Leverera via `node tools/push-github-work.mjs`.
- Vid denna dokumentsammanställning fanns bara två orelaterade lokala filer utanför leveransen: ändrad `.codex/config.toml` och okänd tom `selection[key]`. Lämna dem orörda tills ägare/syfte är klarlagt. Miljöfiler, råmedia, kalibreringar, privata dokument och browserutkast ska bevaras.
- Våra tre tidigare agent-talk-claims är frigivna. Dokumentationsclaimen frigörs efter sin commit/push. Ingen bakgrundsagent, automatisk bevakning eller ny lokal server startas för avslutningen.
- Lokala QA-servrar avslutades vid produktleveransen; kontrollera aktuell sessionsägare före eventuell ny start. Endast en serverkombination får köras. `node lab/start.mjs --no-open` är rätt ingång; blanda inte offline-root och ett tidigare /studio-bygge med --skip-build.
- Ignorerade provskript/skärmbilder finns i `lab/data/qa-lobby-20261010/`. TEMP-loggar heter scout-final-portal-commit.log, -push.log, -ci.log, -audit.log, -browser.log, -rehearsal.log, -build.log, scout-final-admin-build.log och -security-delivered.json. De är lokala bevis, inte portabla garantier; lägg inte råloggar, tokens eller samtalsexporter i Git.
- Webbläsartillstånd kan ändras av Jakob. Senast lämnades en bolagsportal redo med tomt bolagsval; användarens separata Johanna-spel och tidigare osparade Studio-utkast rördes inte. Läs färskt tillstånd, återanvänd passande flik och undvik omladdning av utkast/pågående spel.
- Dokumentationsstädning: denna aktuella sammanställning har lagts först, hela tidigare handofftexten är bevarad som tydligt märkt historik, och användarguiden har fått ett kort flöde samt explicita raderingsgränser. Ordlistans och guidens äldre påståenden om att Regler saknas har avgränsats till grunddealerns äldre editor; migrationstrackern skiljer nu levererad N1-onboarding/publicering/bolagsportal från kvarvarande N2-acceptans. Inga T2–T4-rutor har bockats av utan full acceptans. Fortsätt uppdatera befintliga filer; skapa inte ytterligare tracker eller Markdownrapport under docs.
- Nästa agent bör först läsa denna sammanställning, AGENTS.md och relevanta guideavsnitt, därefter status, claims och exakt Git-version. Fråga den här chatten om kvarstående oklarheter innan historiska planer återstartas. Vi går därefter mot avslut utan att utöka omfånget.

## Funktionella regler som aldrig får komprimeras bort

Render äger kort/shoe/slump/wallet/rundor/resultat, sessionägarskap och cancellation.
Studio/Vercel sparar revisionsstyrd Neonpolicy, inte osparade utkast eller saldo.
En kandidat vid credentialresolver; collision/pending/fel lösenord ger generiskt
avslag utan fallback/klientroll. Admin får spel+Studio; superadmin är alias,
reader/staff är game-only. Playerlogin rensar gamla BO/Labcookies.
BO-audience/live roll/fingerprint/epoch och Origin/Host/JSON/CAS/audit består.
CRAIG-reset och native playerpasswordbyte behåller rätt identitet/saldo/historik;
Rendercancel kvitteras före OK. Självrollbyte/radering och sista-admin-race skyddas.
Engångstokens förbrukas atomiskt; hemliga partnerresultat är tillfälliga, inte listmetadata.

Alla fyra dealers delar spelaren. Tal är exakt text/audio/video/frame-index/
kalibrering/acceptans; ändrad audio-/videohash ogiltigförklarar visuell approval.
Ingen approximate-duration-match, gammal talvideo till ny text eller munoverlay.
Audit `pipeline/audit-dealer-sync.mjs --probe`, obligatoriska regressioner och
två rehearsalplays per dealer krävs för media/spelarändring, inte bara hashar.
Gamla BO-videopreviews är tysta historikklipp, inte lipsyncmaterial.
Observation följer faktisk spelflik utan andra playback; valt/laddat ≠ spelat.
Originalpolicy `legacyClipPolicy` och Astrid `mediaPolicy/idlePolicy` består;
gammal BO-tilldelning är read-only410 och import kräver explicit exakt match.
Privata chattar, secrets och signerade medielänkar hör inte hemma i publika logs/takes.
Neon/Blob-fel stänger med fel, aldrig diskfallback/fröprojekt/nollbudget.
Aktiva tools/test/fixtures/pipeline/web/media/kalibreringar/OpenClaw-state består.
Svarskatalog/automatiska spelararkiv är inte infört; kostnadsjournaler gallras inte.

GPU-shutdownrättningen börjar cleanup före gatewayväntan och signalerar båda barnen.
15 s naturligt provideravslut +15 s cancel +30 s journalmarginal, sedan högst 5 s HTTP
och 10 s lagring; barnets tvångsgräns 80 s/Render 90 s. Timeout lämnar återhämtningsbar
journal/reservation och felstatus, inte för tidigt släppt shared lease.
Isolerad Linuxkedja 4/4 och close 38/38 PASS, inklusive lease 0 före båda flushar/1 efter.
Zonbilden är registrerad privat PNG 1080×1920/1 628 428 byte,
SHA `eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`;
fel molnkälla ger 503 utan lokal fallback. Export 290×104 var pixelidentisk med befintlig zon.
OpenClawproxy tillåter endast avsedd toppnavigation till exakt /openclaw[/];
API/fetch/iframe/mutation/WS/Origin/Host/auth/pairing behåller separata kontroller.
Dessa prov ändrade ingen zonrevision, pairing, speldata eller betaldispatch.

## Historiska kvitton och felsökningsanteckningar

<details>
<summary>Daterad historik — inte aktuell arbetslista</summary>

Följande text är bevarad för spårbarhet. Aktuellt läge, kvarvarande arbete och nästa steg står i sammanställningen ovan. Tidigare versionsspecifika begränsningar och planer ska inte startas om utan ny bedömning.

## 11 oktober 2026: bolagsportal och automatiska tekniska ID:n

Den befintliga /play-lobbyn har nu ett bolagsval med endast aktiva bolag som har spelbara, publicerade rum. Vercels /play/blackjack utan ett uttryckligt spelmål leder till denna portal; enbart operator leder till bolagets lobby. Rumslänkar, rehearsal och signerade spelstarter behåller sina befintliga vägar. Flödet är bolag → rum och tillåtna dealer-/miljöval → blackjack. Katalogen är endast läsande, visar bara slug och namn och använder samma rumsläsare som spelstarten. Tom lista och driftfel visas separat med möjlighet att försöka igen.

Administrationens tekniska spelkonfiguration kräver nu namn och ett dealerval ur det sparade registret. ID skapas automatiskt och behålls vid ett misslyckat sparförsök. Exakt gammalt ID kan anges enbart efter uttryckligt val under Avancerat för återställning. Normal publicering och skapande av spelrum fortsätter att återanvända eller skapa spelkonfiguration automatiskt. Den gemensamma spelarinloggningen stöder redan administratörens uppgifter; en befintlig admincookie ersätter inte en spelarsession. Provspela från Sammansättning använder fortsatt separat testsaldo.

Verifierat före slutcommit: frontend- och Lab-produktionsbyggen PASS, riktade portal-/katalog-/admin-/authtester och TypeScript PASS. Verklig byggd frontend i isolerad browser vid 1440 och 390 px klarar bolagsval, tillbaka till alla bolag, rum/dealerval/startlänk samt tom-, fel- och försöka-igen-vyer utan sidfel eller overflow. Kontotjänsten saknas avsiktligt i denna lokala fixtur; den är inte produktionsacceptans av inloggning. Alla fyra originaldealers klarar åter två faktiska goodluck-uppspelningar. En extra lokal Studio-bildkontroll blandade produktions-basePath och offline-root och räknas därför inte som godkänd Studio-acceptans; liveformuläret kontrolleras efter driftsättning. Exakt-SHA CI och hosting redovisas efter push.

Föregående leverans 19190616354a4eb8a26a670b9452c2a3b3ff7008 är committad och pushad. Normal fullhook: 2263 tester, 2254 PASS, 9 SKIP, 0 FAIL. GitHub CI 38136442361 SUCCESS. Vercel dpl_999KF9Hxv1q6cfMgvnftd1wVdPqN READY/PROMOTED med www/apex; Render /__cloud/version bekräftar exakt samma SHA. Säkerhetsläsningen visar 17 observerade incidenter, 12 öppna, 5 ignorerade; aktiv monitorering, partiella platsuppgifter och historisk scan too_large. Inga incidenter ändrades.

Kvarvarande produktbegränsning: egen oanvänd dealer kan tas ur utkastet, och bord/bakgrund kan tas ur tillåtna val. Permanent mediefilsradering samt borttagning/avstängning av bolag saknas fortfarande i UI/API. Extern .codex/config.toml och okänd tom selection[key] ingår inte i leveransen.

## 11 oktober 2026: isolerat provspel före publicering

N1-flödet är Dealers & klipp → Sammansättning → Provspela → Publicering till bolag → Spelrum i bolagets lobby. En dealer äger sina klipp och händelser; bord är en statisk bild; bakgrund är bild eller egen videoloop. Ett spelrum är den spelbara ingången, inte ett ytterligare lager eller en dealer.

Provspela startas uttryckligen från en sparad sammansättning. Servern fångar projekt, klippinventering, regler och medier en gång i en adminbunden session med tjugo minuters livslängd. Spelet använder den ordinarie blackjackmotorn, men en egen minnesdatabas med 10 000 EUR testsaldo. Inga bolagspaket, rum eller ordinarie spelarsaldon skapas eller ändras. Förhandsval och ljudval stannar i sessionStorage. Till Sammansättning avslutar just den sessionen.

Alla sparade dealers visas; en egen dealer behöver bara en giltig grundloop. Ofullständiga dealers är tydligt otillgängliga. Alla fångade bord och bakgrunder går att prova för kompatibla klipp utan att ändra det sparade paketets tilldelning. Originalfilmer som innehåller en hel scen behåller sitt fullbildsbeteende. Provspel använder inspelade repliker, regler och automatiska klipp; externa OpenClaw-, chatt-, kamera-, minnes- och taltjänster är avstängda i just detta isolerade provläge. Detta ändrar inte deras ordinarie spelväg.

Sessions-, spel-, presentations- och mediaanrop går via exakt tillåtna ingressvägar. Varje anrop kontrollerar aktuell adminidentitet, ägare, scope och giltighetstid. Media binds till fångade hashvärden. Det gamla profil-API-anropet och kalibreringens preferenser är bortkopplade från preview. Lagerpanelen heter Bord och bakgrund och tar emot riktiga klick utan att de går igenom till spelplatserna. En ny sammansättning kräver namn; det tekniska ID:t skapas automatiskt och behålls vid namnbyte.

Verifierat: hela Lab-testomfattningen 1274 tester, 1272 PASS, 2 SKIP, 0 FAIL; TypeScript, frontendproduktionsbygge och riktade sessions-/auth-/ingresstester PASS. Faktiskt isolerat browserprov passerar Astrid-idle, en riktig spelrunda mot testdatabasen och separat Amira-session med orört testsaldo; noll vanliga API-anrop, sessionscookies eller produktionspreferensändringar. Tre lager har provats med riktiga befintliga medier under en uttrycklig syntetisk QA-dealer: 237 videorutor på canvas, 239 bakgrundsrutor och en naturlig loop, riktiga lagerbyten, omladdning, mobil 390 px och separata sessionsval PASS. Fixturens saknade geometri prövar funktion, inte färdig scenplacering. Alla fyra originaldealers klarar två goodluck-uppspelningar i verklig spelklient. Audit-dealer-sync --probe matchar befintliga baslinjer; ingen ny läppsynkacceptans eller mediaändring påstås.

Levererad föregående version 8dd4a6aba5a4cc32e4dcad9c1d17fa72e4be2f86 har GitHub CI 38062846515 SUCCESS, Vercel dpl_2kQtkEmGuEAdwSdz1rjoiPZGCWCn READY/PROMOTED och Render croupier-v2 live på samma SHA. Produktionslobbyn SG test game provider visade befintligt rum ny-jhanna, room-07b92acb-42d4-1941-3777-5e37b39951e9. Där verifierades Johanna synlig med statiskt svart/guld-bord och loopande casinobakgrund utan webbläsarfel; spelarens 860 USD och noll insats lämnades orörda. Rummet skapades inte av detta prov.

Rumsdiagnosen skiljer nu fem fasta, validerade konfliktkoder: delad dealer, delat lager, äldre paket, befintlig rumsbindning och teknisk spelkonfiguration. De första tre länkar till granskning/publicering av hela befintliga paketurvalet; bindningsfel länkar till Administration. Inga råfel eller innehåll exponeras. 103 riktade backend-/UI-/frysta-klipptester PASS samt TypeScript och React-kontroll PASS. Ett faktiskt helpaketsprov verifierar ett gemensamt snapshot för två Johannapresentationer med ändrad v3-händelse och helt bevarade rum, bindningar, tables och branding. Äldre utdragstester för appfunktioner har fått explicit vanligt spelläge; 194 berörda chatt-/navigerings-/previewtester PASS med tidigare assertioner bevarade.

Leverans 2cc59e3481c3fb491284661a9f1a059f0f572c87 är committad och pushad genom GitHub-wrappern. Normal fullhook: 2256 tester, 2247 PASS, 9 SKIP, 0 FAIL. GitHub CI 38134822394 SUCCESS på exakt SHA. Vercel dpl_D34vMuQzJPjtNsNabTap43yfEhmm READY/PROMOTED med www-alias; Render /__cloud/version bekräftar samma SHA. Inloggat N1-prov via Provspela visar Johanna, bord och loopande bakgrund med separat testsaldo 10 000 EUR. Bakgrundsbyte och återgång Till Sammansättning fungerar; inga browserfel eller insatser. Användarens separata osparade scenutkast bevarades.

Produktionsorsak och återställning: GET-preflight gav presentation_room_binding_conflict. Administration saknade room-lane-9c162457d38b353be86e2731 som Testrummet/room-e46c60e2-8857-7b37-9363-5a37cff9e49a pekade på. Det deterministiska ID:t motsvarar mobile-phone + amira. Via befintlig N1-åtgärd game-lanes/create återställdes enbart denna definition: portrait-video, dealer amira, mediaCollection amira-presentation, label Testrummet · Amira. CAS-svar 200 och ny administrationRevision studio-c878deb4-c8b8-42aa-b573-4e1394fc223a. Jämförelse före/efter bekräftar oförändrad aktiv lane och identisk rumslista. SG-test-paketet är fortfarande version 7; inga paket återpublicerades. Johannas rumspreflight är nu ready:true utan konflikt. Den verkliga lobbyn visar åter båda rummen; Testrummet spelar rätt Amira-grundloop med saldo 860 USD, noll insats och inga browserfel.

Kompletteringen använder v3:s validerade frysta dealerurval i samma kompatibilitetskontroll för publicering, spelstart, fryst media, N2-val, lobby och rumsreplay. En tillåten Johanna-start kan därmed använda ett befintligt Amira-rum utan att ändra rumsidentiteten. Saknade lanes, ogiltiga egna grundloopar, otillåtna dealers och äldre paket behåller sina skydd. game-lanes/remove nekar nu alla rumsrefererade spelkonfigurationer före skrivning, även andra bolag och vilande rum. 175 riktade regressioner, TypeScript och oberoende läsgranskning PASS. Alla fyra originaldealers har åter klarat två faktiska goodluck-uppspelningar; audit-dealer-sync --probe matchar befintliga baslinjer. Isolerade QA-begränsningar: avstängda externa fonter/BO samt befintliga frivilliga hands-404 för Amira/Mei. Ordinarie fullhook körs vid commit; exakt-SHA CI och hosting redovisas separat i leveranskvittot. Borttagning är inte fullt utbyggd: egen oanvänd dealer kan tas ur utkastet, men mediefiler/publicerade paket behålls. Bord/bakgrund kan avmarkeras i urval; permanent filradering och borttagning/avstängning av bolag saknas i UI/API. Lokal .env.local gav ingen användbar databas-URL; inga credentials eller miljöfiler ändrades.

Säkerhetsläsningen på 2cc59e34 visar fortsatt 17 observerade incidenter, 12 öppna, 5 ignorerade; aktiv monitorering, partiella platsuppgifter och historisk scan too_large. Detta är inte ett rent säkerhetsresultat. Ingen incident åtgärdades eller ignorerades. Extern ändring i .codex/config.toml och okänd tom selection[key] ingår inte i leveransen.

## 10 oktober 2026: en redigeringsplats i Studio och rättad lagertestfixtur

Studio börjar nu med Dealers & klipp, sedan Sammansättning och Publicering. Val, namn, skapande och avancerade uppspelningsinställningar finns i Sammansättning; Publicering monterar inte längre en andra presentationseditor. Dealerfliken länkar till den valda dealerns klippredigering. Bord och bakgrunder laddas fortsatt upp i sina lagerflikar. Aktiva policyvärden och behörigheter bevaras.

06a732c301b8e9421d3511726b6875621dc8fb0d är pushad och verifierad READY/PROMOTED på Vercel dpl_6sohKF37RwMmSpHqppr6YwCrXaG5 med www och apex. GitHub-run 38059670963 passerade dealer-regression och lipsync-worker, men Studio fann fem gamla testförväntningar på fristående lager i indexed-video. Fixturen använder nu verklig v3-capture med frilagda egna dealers för positiva lagerprov. Separat negativ regression behåller fullbildsdealerns inbakade scen. De berörda partnerflödena registreras även uttryckligen i fullhook.

Verifierat efter rättningen: hela Lab-sviten 1266 tester, 1264 PASS, 2 SKIP, 0 FAIL; riktade UI- och partnerprov PASS. Normalt offlineproduktionsbygge och verklig Studio vid 1440/390 px PASS, inga sidfel, assetfel eller overflow. Skärmbilderna är visuellt granskade. Render visade fortfarande 3d00d0a2; ny rumskatalog och det exakta produktionsrummet är inte livegodkända. Nästa leverans behöver exakt-SHA CI och verifierad Render-version.

Fortsatt arbete: riktig isolerad Provspela-åtgärd från sparad Sammansättning före bolag/publicering. Den skall återanvända blackjackmotorn med separat minnesdatabas och adminbunden session, utan spelarens saldo eller produktionspreferenser. Detta är ännu inte en levererad funktion. Säkerhetsläsning på 06a732c3: 17 observerade/12 öppna, aktiv monitorering, partiella incidentplatser och historisk scan too_large; inga incidentåtgärder.

## 10 oktober 2026: bolagets lobby och rätt dealer i spelrummet

Efter Jakobs redeploy verifierades Render /__cloud/version på exakt 3d00d0a2655f25d9dd0816fbb2acd15c2603461e och runtime capability v4. Den nya etappen nedan tillkommer efter den versionen; CI och driftsättning ska kontrolleras separat efter push.

**Ansvar:** N1 äger dealerbibliotek, alla klippsekvenser, bakgrunder, statiska bord och bolagens paket. N2 granskar sitt bolag och ändrar mindre uttryckligen tillåtna val via partnerområdet/API. Spelaren går via bolagets lobby, väljer spelrum och tillåtna dealer-/miljöval och öppnar blackjack. Rum är den spelbara ingången; bord som medielager är en statisk bild. En teknisk lane är rummets uppspelningskonfiguration, inte en ytterligare dealer.

- Den tomma Amira-scenen reproducerades med ett publicerat portrait-video-rum: HTML valde local medan Amiras media kräver originalmotorn. Det tomma lokala lagret dolde då den gamla scenen. Uppspelningsmotorn väljs nu efter faktiskt vald dealer: Vera/Amira/Mei använder original, Astrid och egna dealers använder local. Rum, bolag, revision och tillåtna val behålls.
- Ny publik, endast läsande /api/operators/:slug/rooms-katalog använder samma publicerade paket och verkliga behörighetsurval som spelstarten. Den visar bara bolagets egna öppna rum och spelbara dealers. Fullbildsfilmer erbjuder inga fristående lager; egna dealers får sådana val bara när grundloopen och dess viktade basklipp stöder komposition. Mediaadresser eller intern konfiguration exponeras inte.
- /play?operator=sg-test visar riktiga rumskort med paketets dealer-, bords- och bakgrundsval samt explicit tomval. Startlänken behåller operator, table och dealer; lagerval valideras igen vid spelstart. Tom lista och driftfel blir tydliga meddelanden. Spelet har Till lobbyn och Välj dealer.
- Innehåll skiljer biblioteket från spelbara rum. Dealer följer med till Sammansättning som uttryckligt sammanhang, med matchande presentation eller en tydlig åtgärd för startdealer. Ett provval ändrar inte paketets tilldelningar. Publicering länkar till bolagets lobby.
- En separat verklig importlucka rättades: spelservern släpper nu igenom exakt /web/public/dealer-identity.mjs som den lokala idlemodulen importerar. HTTP-regression följer hela verkliga importgrafen och nekar privata/felaktiga adresser.

Verifierat före commit: riktade runtime-, katalog-, lagerbehörighets-, ingress- och UI-tester PASS. Lab- och frontendproduktionsbyggen samt TypeScript PASS. Isolerad verklig lobby vid 1440 och 390 px: rätt rum/dealerval/startadress, tom-/felvy, ingen overflow eller sidfel. Alla fyra originaldealers visar rätt idle och klarar två goodluck-uppspelningar i spelklienten; Astrids film avkodar 87 frames per klipp. Mediebaslinjerna matchar med audit-dealer-sync --probe. Inga mediabytes eller kalibreringar ändrades; detta är inte ny läppsynkacceptans.

Studio-kontexten är verifierad vid 1440 och 390 px med fungerande lagerflikar, rätt Amira-sammanhang, inga sidfel, assetfel eller overflow. Ett första QA-prov blandade /studio-bygge med offline-root; nytt normalt offlinebygge och prov löste den lokala startmismatchen. Johanna med en enda grundloop räcker fortfarande för hennes första prov. Inget nytt konto, mejl, insats, produktionspaket eller produktionsdatabas ändrades i dessa tester. Exakt produktionsrum och partnerns sparprov återstår tills ny kod körs med ordinarie inloggad åtkomst.

Produktionsvyn visade också Mobile Phone Lane + SG test game provider med generiskt rumspreflightfel och tidigare publiceringskonflikt. Bolagsspecifika paketval/kvitton/fel och faktisk publicerad revision/presentationslista rättas. Saknade publicerade presentationer visas för uttrycklig avmarkering; osparade val filtreras aldrig bort tyst. Preflight skiljer konflikt, för stort paket och inkompatibilitet. Befintliga rumslänkar och serverns bindningsskydd består. 85 riktade backend-/UI-prov PASS, oberoende granskning utan kvarstående blockerande fynd. Exakt underorsak till produktionsrummets gamla generiska fel är inte fastställd innan ny runtime kan visa rätt orsak.

Jakobs förtydligade mål fortsätter efter denna stabilisering: sammanhållen N1 med Dealer/klipp → tre lager → provspela före publicering → bolagstilldelning. Något fullständigt administrativt provspelsflöde före publicering är ännu inte levererat i denna etapp.

Säkerhetsläsning före leverans på 3d00d0a2: GitGuardian 17 observerade/12 öppna, aktiv monitorering, partial location coverage och historisk scan too_large. Inga incidentåtgärder. Ordinarie fullhook och exakt-SHA CI körs vid leverans; resultat ska redovisas separat från produktionsacceptans.


## 10 oktober 2026: egna dealerklipp i partnerpaket och gemensam uppspelning

Övertagandet började från ren main/origin på c8c986c0c67e48c3c501305cc7492fbcd39c24fb. Föregående agent bekräftade sparat, committat och pushat arbete. Den här etappen är kod och isolerad verifiering; Johannas befintliga produktionspaket är inte automatiskt återpublicerat.

Kodversion fd576e32a9503ba6b5638ebf2fed38bc433c80bb är committad med ordinarie fullhook PASS: 2138 tester, 2129 PASS, 9 SKIP, 0 FAIL. Arbetskopian var ren efter commit. Slutligt Lab-bygge efter BO-städningen PASS; CI och hosting verifieras separat efter push.

CI för 29676bedad98192bf4169767f4f8e5a531dbf9aa stoppade på Orphan tests: två testfiler hade körts genom importer men saknades uttryckligen i runnerlistan. Listan rättas och de indirekta importerna tas bort; samma tester körs en gång var. Den fulla Lab-sviten hittade även en gammal v2-förväntan i publiceringstestet; den uppdateras till v3 med kontroll av den frysta klippkopplingen och läggs till i fullhook. Ingen produktkod ändras i rättningen.

**Målbild:** N1 publicerar bolagets tillåtna dealers, bord och bakgrunder. Ett **rum** är bolagets spelbara ingång till en publicerad sammansättning och en teknisk spellane. N2 väljer inom paketet; spelaren öppnar rummets blackjack. Dealerklippet styrs separat, bakgrunden loopar eller är en bild, och bordet är statiskt. Gamla fullbildsklipp blir inte frilagda av lagringen.

- Paket v3 fryser egna dealers explicita händelsekopplingar, klipp, mediahashar, kompositinställningar och valfri egen idlepolicy. Val, standardreserv och medieadresser tillhör samma publicerade dealer/rum/revision. Befintliga v1/v2 läses fortsatt.
- Publicering kräver runtime capability v4. Frysta eventfiler passerar signerad Verceltransport och ordinarie spelarautentisering. Paketet läses om efter eventurval och före uppspelning även när filen finns i cache; ändrat paket stoppar uppspelning och visar Ladda om.
- Egen grundloop kan använda samma controller för basklipp, automatik och OpenClaw. Regler kräver explicit sparad idlevariant med eventvillkor på verifierad utdelning/vändning, samt Klippval=Regler. Inga simulerade chattvärden används. Förslag väntar på avslutad action och säker basgräns.
- **Johannas enda grundloop räcker för första acceptansen**, enligt Jakob. Fler klipp eller ett schema behövs inte. Saknas ett eget kortpositionsklipp fortsätter korten i 2D med samma dealers grundloop; ingen annan dealer lånas.
- Spelvalen följer faktiskt tillåtna dealers även utan operatorparameter. Versionsväljaren behåller rum/operator/lane. Detta rättar vägen där Amira kunde tappa lane och återgå till standarddealern.
- Publicera partnerpaket är synligt i Publicering, befintliga rum länkas direkt, och Sammansättning visar tillåtna val per lager. Innehåll har eget grundloopschema och borttagning av oanvänd egen dealer ur utkastet; refererade dealers skyddas. Mediefiler och publicerade paket raderas inte av utkastknappen.

BO-städning: två paneler som alltid var dolda, deras flagga, gamla importlista och oanvänd spelvägsmetadata är borttagna. Aktiv legacyuppspelning, neverAgain-spärrar, sparad BO-data och granskningsvyn med faktiska konsumenter är bevarade.

Verifierat före leverans: Lab-produktionsbygge och TypeScript PASS; nya riktade runtime-, fryst paket-, policy-, behörighets- och UI-tester PASS. Isolerad UI-granskning av Sammansättning/Publicering vid 1440 och 390 px: ingen overflow eller sidfel. Alla fyra originaldealers spelade goodluck två gånger i den faktiska spelaren; Astrid med videoframes, Vera/Amira/Mei med sina frame-engine-sekvenser och avslutade ljud. Amiras granskade bild visar rätt person. Sync --probe matchar alla fyra mediabaslinjer. Detta är inte ny mänsklig läppsynkacceptans.

**Öppet:** ny produktionsacceptans av Johanna/rummet och eventuell återpublicering av v3 kräver ordinarie inloggad åtkomst. CUA-starten är trasig i denna session; exakt Johanna-originaltrio saknas i kontrollerad lokal fixtur. Direkt oinloggad /play/blackjack omdirigerar till spelarlogin. Partnerkontot är fortfarande inte aktiverat; inga konton, e-post, insatser eller produktionsdata ändrades. Långtidsluckan beskriven nedan har inte förklarats eller accepterats. Paketets befintliga storleksgräns gäller även v3.

Policyinventering: idlePolicy (Astrid), dealerIdlePolicies (egna dealers), mediaPolicy (Astrids familjval), legacyClipPolicy (äldre aktiva spelvägar) och probePolicy (genererat tal vid inaktivitet, standard av) har faktiska konsumenter och är inte obsoleta. presentationProfile är fyra visningskategorier, ingen extra policy. Äldre BO clipAssignments används bara som granskningsdata; blanda inte ihop dem med aktiv legacyuppspelning.

Säkerhetsläsning på ingående c8c986c0: GitGuardian 17 observerade/12 öppna, aktiv monitorering, partial location coverage och historisk scan too_large. Inga incidentåtgärder; grön CI får inte beskrivas som rent säkerhetskvitto.

## 10 oktober 2026: partnerkonto kopplat och tydligt trelagersflöde

Det av Jakob angivna befintliga partnerkontot är nu kopplat till **Johns spelbolag** med den uttryckligen godkända rollen **Partner editor** och aktivt medlemskap. Ordinarie POST /studio/api/admin/operator-membership med användarnamn gav 200/ok; en separat omläsning visar bolagets enda medlem, userId 8, revision 1, partner-editor, active och presentations.configure. Ingen inbjudan eller e-post skickades av denna koppling. Kontot självt har fortfarande active: 0 och behöver aktiveras innan partnerinloggningen och det verkliga sparprovet kan slutföras. Full e-postadress och de sanerade produktionskvittona hålls utanför Git.

**Produktionsacceptansen är fortsatt 2 av 3 kontroller.** Det tidigare hindret "saknar medlem" är löst; kontoaktivering och partnerns val → spara → omladdning → rätt rum återstår. N1-geometri och konfliktskydd ska verifieras i det provet. Spelrum, Johanna, publicerat paket, mediabytes och spelarens session har inte ändrats i denna etapp.

Det faktiska användarflödet är:

1. **Innehåll**: välj Johanna, redigera och spara klippen och deras händelsekopplingar. Ett val i förhandsvisningen är bara ett provval.
2. **Sammansättning**: återanvänd johns-johanna, välj **Dealer**, **Bord** och **Bakgrund**, justera **Storlek och placering** för både **Mobil** och **Desktop**. Frilagd/greenscreen dealerfilm behövs för tre synliga lager.
3. Välj **Spara och fortsätt**. Detta sparar utkastet; det ändrar inte redan publicerat paket.
4. **Publicering**: välj Johns spelbolag och den befintliga presentationen. För befintligt **Johannas blackjack**, använd **Avancerat: paket och spellanes → Publicera paket**. Skapa inte ett nytt spelrum.
5. Öppna befintligt /play/blackjack?operator=johns-spelbolag&table=room-06f0722d-74bf-49ca-8546-f6328ac69909.

**Viktig faktisk begränsning:** detta är tre lager som sätts samman i spelklienten, inte en exporterad videofil. För den egna dealern Johanna fryser publiceringen det sparade basklippet/grundloopen med hash och greenscreeninställningar. Alla egna redigerade händelsefilmer följer ännu inte med i paketet. Guiden får därför inte utlova "alla valda klipp" i produktion; det kräver separat stöd i paketet och spelaren. Se lab/docs/README.md och web/storage/frozen-dealer-idle.mjs. Tidigare tvåvarvsbevis och den senare femsekundersluckan är oförändrade.

Dokumentationsbas före denna uppdatering: main 5efc447e50ee0b544081055655fa82a88633fdbd, CI 37992902840 med tre SUCCESS-jobb och www/production på samma READY dpl_B459FeeRrEr3iDnRYK6gUrSK7QsA, verifierat 9 oktober. Säkerhetsläsning 10 oktober på samma SHA: 17 observerade/12 öppna GitGuardianincidenter, partial location coverage och historisk scan too_large; inga incidentåtgärder utförda.

## 9 oktober 2026: fortsatt konsolidering och verklig produktionsgräns

Senaste kodleverans 71176ebbe9a8705740fa5e12ab9d92c6b1b6b364 är pushad från samma checkout till GitHub main; N1-förenklingen levererades i cca9d3527a0451f037616a79571e0d415e13f10c. **2 av 3 angivna produktionskontroller är verifierade: aktiv runtime och två naturliga Johanna-varv. Partnerns sparprov återstår.** Johns spelbolag, Johanna, det befintliga rummet och dess frysta paket återanvänds.

- Sammansättning har Dealer/Bord/Bakgrund som en kompakt lagerinspektör. Filval och geometri ligger tillsammans; Mobil och Desktop har separata värden och återställning. Uploadpaneler förblir monterade, och spar-/konfliktlås bevaras.
- Mobilmenyn är kollapsad från start, med Escape/fokus och fria tabsteg. Aktuell sidlänk laddar inte om utkast. Mobilscenens reproducerade klicköverlapp är rättad.
- Översikt skiljer livebolag, tom live-lista, driftfel och demonstration. Valt livebolag följer nivå 2/3-länkar. Gamla administrationslänkar går till befintliga relevanta flikar; guide och terminologi är rättade.
- Nytt sanerat Renderkvitto /__cloud/version visar efter utrullning hostingens frysta, exakta 40-hex commit-SHA. Saknad metadata ger 503; inga secrets eller klientstyrda versioner exponeras.

| Verifiering | Kvitto | Status |
| --- | --- | --- |
| Fullhook, senaste kodleverans | 2 046 tester: 2 037 PASS, 9 SKIP, 0 FAIL | PASS |
| Kod-SHA CI | 37988543940, exakt 71176ebbe9a8705740fa5e12ab9d92c6b1b6b364; presentation-studio, lipsync-worker och dealer-regression | Alla tre SUCCESS |
| Vercel production och www | dpl_65sg7mawaNAqh6c55vf2KDAdfX8Q; scoutgaming-3i4xsbbsy-scoutgaming.vercel.app; exakt 71176ebb kopplad via GitHubs Vercel-status och två scoped CLI-inspektioner | READY, samma deployment |
| TypeScript och Lab-build | Normal och isolerad build | PASS |
| Verklig isolerad UI-QA | 1440/768/390 px, keyboard, Meny/Escape/fokus, PUT/GET/full omladdning, båda format och annan presentation bevarade; inga sid-/konsolfel | PASS |
| Produktionseditorn, läskontroll | Befintliga Johns/Johanna är Sparad; Bord → Dealer fungerar, scenen visar Johanna/bord/bakgrund. Inga värden ändrade eller sparade; bild visuellt granskad | PASS; ingen spelaracceptans |
| Riktade regressioner | Översikt/nav 42, mobilnav 45, preview 16 i N1-etappen; senaste transport/runtime/UI/WS/version 90/90 och oberoende ingressgranskning | PASS |
| Dealer-sync --probe | Samtliga fyra mediabaslinjer matchar | PASS; mänsklig läppsynkacceptans separat öppen |
| Samma privata bildgalleri | 35 bilder; samtliga tidigare 32 kort och originalbildhashar bevarade. Kort 33–35 är originalbilder av startgräns/varv 1/varv 2. Faktisk Blob-källa och senare DOM-gap anges separat från HTTP-paketkvittot. 35 originalstorleksdialoger, Escape/fokus/pilar och 390 px utan överflöde, HTTP-anrop eller sidfel | PASS |

| Tre produktionskontroller | Faktiskt resultat | Status och kvarvarande gräns |
| --- | --- | --- |
| 1. Aktiv Render-version | /__cloud/version gav 200/schemaVersion 1/provider render och exakt 71176ebbe9a8705740fa5e12ab9d92c6b1b6b364 före provet (20:50:36 UTC). Efter provet 21:12:54 UTC: 16cf8b60bed964f71882bd6c6dad795e55b0924b, en verifierad efterföljare med enbart två MD-ändringar. Exakt-SHA CI 37989618536: alla tre SUCCESS; www och Vercel samma READY dpl_4EWqQbSznGYH8uXQH8twGPprntNc | PASS. Privat deploy-ID/tidigare första felrad okända; ingen timeoutfix gjord |
| 2. Spelarens Johanna-rum | Faktisk ordinarie spelar-HTTP 20:52:52 UTC: rum 200, rätt Johns/rum/paketrevision 1/Johanna och tre frysta lager; bord/bakgrund/idle HEAD 200. Samma inloggade Edgeflik: 100 läsprover och originalbilder, duration 10,041667 s; naturliga gränser 20:56:42.408 → 20:56:52.377 → 20:57:02.987 UTC ger två hela cykler. Inga insatser, val, sparningar eller seek | PASS för specificerat tvåvarvsprov, oberoende granskat. Ingen långtids- eller läppsynkacceptans; senare DOM-gap beskrivs nedan |
| 3. Partnerns sparning | Korrekt same-origin partnerlogin ger 401. Vanlig auktoriserad N1-läsning visar att LLM är aktiv admin och Johns bolag har 0 medlemmar. Partnerlogin kräver kontorollen partner; korrekt partnerkonto och avsett medlemskap saknas | Befintligt partnerkonto med aktivt medlemskap och presentations.configure i Johns spelbolag. Val → spara → omladdning → rätt rum; N1-geometri bevarad och konflikt avvisad |

Aktiv Render-version efter provet är **16cf8b60bed964f71882bd6c6dad795e55b0924b** via det sanerade versionskvittot; körbar kod är samma som den granskade ingressleveransen 71176ebb. Spelarprovet återanvände samma inloggade flik och befintliga Johanna-rum. Partnerlogin har återprovats mot den nya runtime-versionen och ger fortsatt 401 för de angivna uppgifterna. Roll- och medlemskontrollerna bevaras; ingen medlem, kontoroll, inbjudan, insats eller speldata har ändrats.

Ingressrättningen är levererad på main i 71176ebb: endast signerad canonical GET/HEAD på exakt /blackjack, Accept text/html, giltig operator och godkända odubblerade queryvärden får passera utan launch. Host, origin, proto, hemlig signering och vanlig spelarautentisering består. Riktig platformUiDocument → platformBackendHeaders → gateway → Web verifieras med isolerad HTTP-fixtur; 90/90 berörda transport/runtime/UI/WS/versiontester PASS och oberoende granskning utan blockerande fynd. Ny regression ingår i fullhook. CI 37988543940 har tre SUCCESS-jobb; Render kvitterade faktiskt 71176ebb före spelarprovet. Senare dokumentationsversion 16cf8b60 har eget grön CI-kvitto och samma www-deployment. Tidigare utrullningsfråga är därmed löst genom den verifierade externa versionen; inga nya åtkomstgrants har skapats.

Tvåvarvsbeviset gäller observerade cykler mellan samples 25 → 43 → 62. Mediaavläsning och originalbild tas i följd, så tidsgränserna är konservativa intervall mellan bildfilernas tider, inte atomiska medietidsstämplar. Root har visuellt granskat alla tre gränsbilder samt mittbilder och de senare avvikelsebilderna. Videons faktiska currentSrc är en Blob-URL; paketrevision från browserhelpern förblir okänd. Den separata verkliga HTML-/HTTP-läsningen verifierar paket 1 och rum/dealer. Kodkedjan är fryst config.src → SHA-verifierad hämtning → Blob → filmspelare, vilket redovisas som kodbindning och inte en observerad original-URL i DOM.

Senare i samma prov saknas dealer-videoelementet i samples 81–90 (20:57:13.456–18.448 UTC) och återkommer med readyState 1 → 4. Johanna finns kvar i originalbilderna. Filmspelaren håller sista actorFrame efter end/error/abort; kompositorn kan måla rörlig bakgrund bakom den. Ändrade regionhashar bevisar därför inte fortsatta dealerframes under gapet. Varje egen idleomstart väntar på en ny frusen config-GET och preparation; detta kan ge en väntan, men den faktiska femsekundersorsaken är fortfarande obelagd. Långtidsstabilitet är inte accepterad. Oberoende source-/kvittoanalys och 48/48 idle/composition/cachetester PASS.

En avgränsad förbättringsplan har granskats men inte implementerats: överlappa nästa frusna configkontroll och videopreload medan aktuell film spelar, med generation/AbortController och stopp vid konflikt/fel. composition.prepareClip får inte överlappas eftersom den stoppar aktuell animation. Planen flyttar revalideringen upp till ett varv tidigare och behöver fördröjda transport- och raceprov innan leverans; den ska inte användas som bevis för gapets orsak.

Vercel-connectorernas teamläsning nekas (403), men scoped CLI-inspektion fungerar. Lokal ingresskonfiguration saknar användbar nyckel för direkt serverläsning. Ingen token/grant har skapats. Browserverktygets sandboxstart är trasig; den tidigare chattens levande Edgehjälpare förmedlar snäva produktionsläsningar utan profilomstart.

Separat GitGuardianläsning före denna dokumentationsleverans på remote main 16cf8b60bed964f71882bd6c6dad795e55b0924b: 17 observerade, 12 öppna incidenter; source binding verifierad och monitoring aktiv. Location coverage är partial och historisk scan too_large. Queued suite är inte ett rent säkerhetskvitto. Inga incidenter ignorerade eller lösta i denna etapp.

## 9 oktober 2026: sammanhängande sammansättning och partnerns val

Kodleverans 35eb07b29b704c4df9dbf93e46479341bbc68bcd är pushad till GitHub main. Normal fullhook PASS: 2 020 tester, 2 011 PASS, 9 SKIP, 0 FAIL. Exakt-SHA CI 37971486777 är SUCCESS med alla tre jobb godkända utan omkörning. Vercel production READY på dpl_EBfdHp1Y43sjEjToyqfs4gX5u1dZ (scoutgaming-24cxi2fl1-scoutgaming.vercel.app); separat kontroll av www.scoutgaming.tech gav samma deployment. Render-version och produktionsacceptans är separata öppna kontroller.
Nivå 1:s Sammansättning är huvudeditorn för Dealer, Bord och Bakgrund.
Storlek och placering visas öppet, separat för Mobil och Desktop. Valet Dealer
ändrar sparad startdealer; Förhandsvisa klipp är fortfarande enbart ett prov.
Grundloop och idle är samma vänteläge. Basklipp och Variationer beskriver
innehåll i det läget; en egen dealer publiceras med ett fryst basklipp.
Astrids befintliga avancerade urval och originalklipp bevaras.

Den faktiska inbyggda guiden i lab/docs/guide.json hade kvar Nora-specifik
manuell rumsguidning och uppgift om att rumskapande återstod. Den rättas
samtidigt med README, terminologi och studio-contract.json. Tekniska idle-ID:n
ändras inte. Separata lager ersätter inte fullbildsklippets inbakade pixlar.

Verifierat fel i nivå 2: ett tillåtet dealerval kunde sparas men inte stödjas
av rummets spellane, varpå spelaren fortsatte med den tidigare dealern.
Rättningen ger samma tillåtna urval i UI och server, med kompatibilitet
i samtliga berörda publicerade live-rum, samt färsk behörighet/revision under
befintlig transaktion. Nivå 2 får inga egna geometriöverlagringar eller nya
paketformat; storlek och placering hör till den publicerade N1-sammansättningen.

Ytterligare reproducerat N2/runtimefel: val för en presentation kunde läcka
som bord/bakgrund/dealer till ett rum med annan presentation, trots att N2
visade det andra rummets egna standardval. Rättningen avgränsar dessa
presentationsval till matchande branding.lane och bevarar bolagsgemensamt
utseende och det frysta paketet. Denna del ändrar web/game-entry-operator.mjs
och kräver separat Render-utrullning; Vercel READY räcker inte som kvitto.

Lokalt verifierat: N2:s samlade serverfria svit 93/93 PASS; N1:s riktade svit
31/31, guide/Grundloop 12/12 och uppdaterat Händelser-test 6/6 PASS.
Slutlig gemensam TypeScript och Lab-build PASS. Oberoende granskning hittade
två fel som rättades före frysning: transaktionen maskerade 403/409 som 503,
och sparad färg kunde tappas vid återval av första presentationen. Nya native-
och tillståndsbaserade UI-regressioner täcker båda. Sync-probe matchar baslinjen;
mediernas bytes och mänskliga läppsynkacceptans har inte ändrats.

N1:s isolerade UI-slutprov PASS: sju assertiongrupper, 1440/768/390 utan
överflöde och noll React-, console-, media- eller dialogfel. Verklig lokal
GET/PUT/full omladdning använder oförändrad SSR/inventory och egen tempdata;
dealer-default/allowed, lager-ID, båda formatens placering och orörd andra
presentation verifieras. Frilagd/fullbild-preview provas separat med explicit
klientinventory och exakt hashkontrollerade originalmedier. Det senare är
previewbevis, inte serverinventering eller produktionsacceptans. Två tidigare
privata SSR-fixturfel och ett felaktigt Pausa-antagande rättades i provskriptet;
ingen produktkod eller felassertion ändrades för att få provet grönt.
Tre nya tydligt isolerade bilder finns i skrivbordsgalleriet; de tidigare
23 originalbilderna bevaras. Lokalt QA-par stängdes i finally.

Johns spelbolag saknar fortfarande partner-medlem. /partner utan partnersession
visar en uttryckligt märkt demonstration; den är inte bevis på Johns liveåtkomst.
Ingen användare, inbjudan, e-post eller authgenväg skapas för detta prov.
Produktionsspelarens separata manuella inloggning och två grundloopvarv återstår.

Render svarar HTTP 200/capability v3 men exakta deploy-SHA och privata felloggar
saknas. Ett misslyckat nytt bygge kan lämna föregående version i trafik.
Den lokala startkedjans 30-sekundersgränser och bortvalda child-processloggar
är möjliga felsökningspunkter, inte en bevisad felorsak. Ändra inte timeouter
utan deploy-ID, SHA och tidsstämplat första fel. Teknisk vägledning finns i
LOCAL-PRESENTATION-RUNTIME.md. GitHubs ffmpeg-installationstimeout är separat.

Nästa agents avgränsade fortsättning:
1. Kontrollera exakt Render-SHA för 35eb07b2 eller en verifierad efterföljare.
   Hämta det första misslyckade deploykvitto/loggutdraget innan eventuell
   starttidsfix. Anslutningsväg finns i LOCAL-PRESENTATION-RUNTIME.md.
2. Efter Jakobs manuella spelarinloggning: prova befintliga Johannas blackjack,
   tre lager och två hela grundloopar; spara bilder. Inga riktiga insatser.
3. N2-produktion kräver verklig partner-medlem och inloggning. Skapa inte en
   godtycklig medlem eller skicka en inbjudan utan rätt konto/mottagare och
   Jakobs instruktion. Därefter verifieras val→spara→omladdning→rätt spelrum.
   Uppdatera samma handoff och Desktopgalleri; skapa inte demoobjekten igen.

## 9 oktober 2026: generiskt dealerpaket och Skapa spelrum

Tidigare kodleverans 88e590e7327f379d56022eebcb891843058a0732 är pushad till GitHub main, har normal fullhook PASS, grön exakt-SHA CI 37963723334 och Vercel production READY. Separat domänkontroll av www.scoutgaming.tech pekar på samma deployment dpl_DMuc47ugqtd2Wz8rmq8PexbFaZAv. Kanonisk player-login gav HTTP 200 med neutral titel/text efter deploy.
Den innehåller 72891be6 (generiskt dealerpaket/rum) och b12653e4 (sista UI-puts).
Egen dealer får en fryst grundloop. Rumpublicering sparar bolagsägt rum,
kompatibel spellane och paket atomiskt. Översikt börjar i Sammansättning;
Publicering visar ett sammanhängande rumflöde och utfällbara avancerade val.
N2:s provlänkar använder verkliga bolagsägda rum även när presentation och
spellane har olika ID. Gamla JSON-exporten och Nora-specifik manuell
rumguidning är borttagna; namnfält för ny och befintlig presentation skiljs åt.

Verifierat: normal fullhook för 72891be6 och b12653e4 PASS; den senare
sammanlagt 2 010 tester, 2 001 PASS och 9 SKIP. Paket/capture/publisher 104/104,
N2-rum 17/17, UI-puts 37/37, gemensam TypeScript och Lab-build PASS.
Isolerad UI-QA visar verkligt sparande, återläsning, tangentbordsnavigation och
layout i 1440/768/390 utan JavaScript-fel.

CI 37952326479 på 8f0dfff6: presentation-studio och lipsync-worker PASS,
dealer-regression föll på en Windows-specifik gzip-fixture. Payload/SHA var
identiska; endast gzip-headerns OS-byte 9 skiljde Linux (3) från Windows (10).
Testjämförelsen normaliserar nu just denna byte; produktionsencoder och
paketformat förblir oförändrade. 34/34 riktade tester PASS. Leveransen verifierade korrigeringen i Linux-CI på c83a47b6; alla tre jobb passerade.

Isolerad faktisk spelklient: Johanna spelade två kompletta muted grundloopar
med exakt källhash och media-ID. Ändrad paketrevision gav 409 och krävde
omladdning. Box 4 utan video gav position_clip_missing/skipped medan två
serverägda kort visades i 2D. Astrid, Vera, Amira och Mei spelade goodluck två
gånger var med media-/framekvitton och utan JavaScript-fel. Båda lokala
serverparen stoppades sekventiellt och tempdata rensades. Privata transport-
fixturer användes; detta verifierar inte produktions-Neon. Originalmedia är
orörda och sync-probe PASS; ingen ny mänsklig läppsynkacceptans hävdas.

### Produktionsdemo och nästa agents startpunkt

Lagerfix 6a0bedba8499c4b510fdbd5f1086d9e3646a14c3 är pushad på main.
Normal fullhook, 66 riktade tester och oberoende granskning PASS. CI
37960489826 är success efter en enda omkörning av failed-job: första försöket
nådde timeout vid installation av ffmpeg/jq, omkörningen passerade. Vercel är
READY och www pekar på samma deployment dpl_5nQph2fD1HeMnoBYWt3eHeLuWSZo.

Den faktiska produktionsdemon skapade via UI och återläste:
- Johns spelbolag, slug johns-spelbolag, med standardroller och utan medlemmar/inbjudningar.
- Johanna, ID johanna, med egen registrering av dealer-nora.mp4:
  f1e92965-940b-4722-9910-063ff409d110 → johanna.idle.ready.standard,
  Johanna · Grundloop, greenscreen. Noras post och källfil är orörda.
- Presentation johns-johanna, Johns spelbolag · Johanna, med endast Johanna
  som tillåten/startdealer. Tre lager sparade och återlästa efter omladdning;
  faktiskt visade i mobil- och desktopformat, samt uppspelade i Studio.
- Bord · Svart och guld: 4b688411-d186-4229-8f8a-046cd1b0a2c5,
  SHA 2265a92fe3c51df054dbb84416942d8a69bbc8b0f6209645636945d0874f1973.
- Bakgrund · Casino: 6ca45a4e-f696-4849-a3f7-a15dc872862f,
  SHA 1e03fe5e67c8c00ba241ce07f86200a3d3bc502e3b266e6b6d666f0e6cca91ba.
- Johannas blackjack, rum room-06f0722d-74bf-49ca-8546-f6328ac69909,
  skapat/publicerat till Johns spelbolag som paketversion 1.

Spelrummets verkliga länk:
https://www.scoutgaming.tech/play/blackjack?operator=johns-spelbolag&table=room-06f0722d-74bf-49ca-8546-f6328ac69909
Den öppnar separat spelarinloggning med operator och table bevarade.
Studio-inloggning räcker inte. Jakob är tillfrågad om manuell inloggning;
produktionsuppspelning och två idlevarv är ännu inte verifierade. Målet är inte klart.
Den gamla generella inloggningstexten nämnde alltid Astrid; den är nu neutral
utan ändring av autentisering eller konto-/speldata.

Lageruppladdningens tidigare HTTP 503 är nu rättad och provad i produktion.
Nativegrinden får verkligt projekt och verifierad mediapost före SQL;
behörighet och revision kontrolleras igen under lås. GET efter det misslyckade
försöket gav assets: [], varefter nya UI-uppladdningar skapade exakt två
registrerade lager med originalens hash/byteantal. Den första PNG-uppladdningen
kan ha lämnat ett okopplat Blobobjekt; ingen okänd fil har gissats eller raderats.
Biljetten från det misslyckade försöket är utgången/förlorad. Ingen recovery byggdes.

Render svarar capability v3 med rooms: operator-owned-v2,
registeredDealerMode: saved-registry-idle-v1 och frozenDealerIdle:
operator-package-v2. Exakt Render-SHA är fortfarande inte verifierad.
Sync-probe matchar oförändrad baseline; mänsklig läppsynkacceptans är separat.
GitGuardian: 17 lästa incidenter, 12 öppna, locationCoverage partial;
aktiv övervakning och ofullständig historisk skanning. Ingen ren säkerhetsstatus hävdas.

Privat klickbar bildfil: C:/Users/jakob/Desktop/Johns-spelbolag-bilder.html — 26 bilder, 21 produktionssteg och fem tydligt avskilda isolerade QA-bilder. De tre senaste visar de nya N1-kontrollerna i 1440/768/390.
Originalbilder och production-demo-browser-persistent.mjs ligger utanför Git:
C:/Users/jakob/.codex/visualizations/2026/10/09/01a1208f-20d2-7f03-837f-7f7fab0ae5f9/.
Beständig Edge-demoprofil finns där; läs/exportera aldrig authfiler eller
inloggningsfält. Starta hjälparen med tty:true om den behöver återöppnas;
stäng en tidigare instans först och återanvänd samma profil. Ingen lokal
produkt-/Lab-server körs. /control är publik Studio; /studio är teknisk basePath.

Fortsätt efter manuell spelarinloggning: öppna samma rumslänk, bekräfta
Johanna/paket 1 och två hela grundloopar med tre lager; spara nya stegbilder.
Skapa inte bolag, dealer, lager eller rum igen. Gör inga verkliga spelarinsatser
för QA. Box 4 utan videoklipp har redan bevisats hoppa över video och visa
serverägda kort i isolerad faktisk spelklient; det är separat från produktionsprovet.
Uppdatera bildfilen och denna handoff efter sista kontrollen. Alla fortsatta
leveranser på main genom tools/push-github-work.mjs; bevara andra agenters filer.

## 9 oktober 2026: rumsläsare, atomisk publicering och lokal repetition

Kompatibilitetsdelen inför rumsschema 2 med separata presentationLaneId och
gameLaneId. En uttrycklig /play/blackjack?operator=<slug>&table=<rum-id> kräver
ett live-rum som ägs av bolaget, finns i dess paket och binder en befintlig
spellane till en fryst presentation. Okänt/främmande/inaktivt rum ger 404;
otillgänglig lagring ger 503. Ingen reserv-lane väljs för en uttrycklig rumslänk.
Äldre ingång utan table och äldre sparade rum behåller sitt läsbeteende.

Publishern använder nu operatörslås och expectedRevision under samma SQL-
transaktion. Det delade repository-klientgränssnittet behåller scope och
återställer administration, historik, audit och paket även när ett fångat
valideringsfel uppstår. N2:s redan levererade revisionsargument får därmed
atomiskt konfliktskydd. Ingen SQL-migration behövs.

Runtime annonserar capability v2 (rooms: operator-owned-v2). Native Studio
kräver den före nya rumsskrivningar. Denna leverans aktiverar endast läsare
och transaktionsstöd; rum-writer och dess UI levereras separat. Render måste
uppdateras till denna etapp innan den nya rumfunktionen kan användas.

Verifierat: rum/entry/policy/readiness-regressioner 81/81 PASS; oberoende
CAS-granskning 40/40 PASS efter två rättade transaktionsfall. Offline-ingång
27/27 PASS; generation-media 3/3 och local-comparison 2/2 PASS. Tempfixturen
kopierar entry-kontraktets publika modulberoenden och lämnar inga servrar kvar.
Astrid, Vera, Amira och Mei spelades lokalt två gånger var på faktisk player-
väg med rätt dealer och utan JavaScript-fel. Åtta privata bilder och kvitton
finns utanför Git. Oförändrade media och sync-probe PASS; ingen ny läppsynk-
acceptans eller produktionsrepetition hävdas av detta.

Föregående Studio-etapp 3d4faaf3 har grön exakt-SHA CI 37935300051 och Vercel
production READY. N2-etapp 82d01ecf har CI 37942515170 success och Vercel READY
dpl_BV8qAas8ydphvL4zVk1JpLFxibWw. Kompatibilitetsetapp 3f70016a har fullhook
PASS, CI 37943725684 success och Vercel production READY
dpl_Ag2MCARdKiPcs8EY2R25mn5g5odj. Jakob meddelade Render-omdeploy; därefter
verifierades HTTP 200 health och capability v2 med operator-owned-v2.
Renders exakta SHA är ännu inte verifierad. Webbläsarstyrningen
felar i verktygets anslutning; den inloggade produktionsfliken har inte klickats.

Nästa stopptest: Johns spelbolag → separat dealer Johanna → Nora-filens egna
Johanna-mediaregistrering som grundloop + bakgrundsfilm + PNG-bord → redigerbar
sammansättning → publicerat rum → faktisk spelklient, med bild per steg och
två idlevarv. Generiskt registrerat dealerstöd och fryst idle-descriptor byggs
som nästa etapp; ingen Johanna-specialkod eller omdöpning av Noras post.


## 9 oktober 2026: N2-paket och verifierad legacyutrensning

Genomfört efter avstämning med **Förenkla menyer och förhandsvisning**.
Den tekniska roten `/studio` återexporterade `/control/clips`; den ger nu
308 till samma publika klippadress med bevarad query. BasePath/API består.

Inloggad operatör ser fryst paketdata för dealer, bord och bakgrund, med
tillgångarnas verkliga bild/videoformat. Bord, Bakgrund, Presentationslanes,
branding och Provbord använder paketvyn; de gamla lokala SVG-/bildproven
visas bara i den märkta fixturen. Provbord länkar till riktiga spelklienten.
Ändring kräver rätt roll, revision och val inom samma tilldelade lane.
Godkända fullbildsklipp behålls; nya separata bord/bakgrund/färg avvisas där.
Äldre paket utan fryst lagerformat kräver återpublicering före UI-redigering.
Partner-writer skickar nu expectedRevision till publisher; atomiskt CAS-substrat
levereras av den andra agenten i dess separata etapp. Rum-ID:n bevaras.
Marker/kort-design är nästa steg; spelvärden, kort och saldo ägs av spelmotorn.

Raderat lokalt och från produktkällan: tio filer, 259 423 byte:
- `lab/components/background-zones.tsx` och dess CSS; sparad zondata/API består.
- Åtta JS/MJS-kopior i `apps/croupier-frontend/public/kevin-cards/`; den tomma
  katalogen är borttagen. Aktiv `web/public/card-presentation`, kortbilder
  och URL-alias består.

Mailmallarna har en verklig referens i Kevin-originalvyn och behålls.
Fristående editor/viewer har dokumenterad användning och behålls.
Inga runtimebibliotek har bevisats överflödiga. Ingen mediefil eller
produktionsdatabas har ändrats; inget privat arkiv har lästs.

Verifierat: slutligt Lab-build och TypeScript PASS; paket/scope/roll,
bakade lager, MIME-format, snapshot, permanent redirect och stale-read-tester PASS.
Hela delade Lab-arbetskopian gav 1 142 PASS, 2 SKIP, 0 FAIL (1 144 tester);
den innehåller också andra agenters ännu separata rumstester.
Originalfyras `audit-dealer-sync --probe` PASS. Detta är inte nytt
lip-sync-godkännande. Produktions-CI/utrullning har eget kvitto efter push.
Den privata systemkartan är uppdaterad som Canvas.


## 9 oktober 2026: samlad Studio-etapp för löpande leverans

**Publicerad som 3d4faaf3; exakt-SHA CI grön och Vercel production READY.**
Studio har Sammansättning, Innehåll och Publicering. Drift, AI & chatt och
Administration är utfällbara grupper; Bolag & team ligger på
`/control/lanes?tab=companies`. Sammansättning samlar preview och lageruppladdning;
avancerade reglage finns kvar. Egna klippnamn bevaras, standardnamn är svenska.
Grundloop, sju spelarplatser och dealerns öppna/dolda/vända kort hålls åtskilda.

Spara och fortsätt väntar på en ren render och bevarar nyare utkast.
Publicering låser dubbelklick. Native inloggning behåller tillåten tab/lane-query;
äldre remoteUi-handoff tar fortfarande bort query. Direkt upload behåller
tekniskt kvitto, hash, revisions- och avbrottsskydd utan extra previewgodkännande.

Tom exakt utdelningsposition ger `position_clip_missing`/`skipped`, ingen
reservfilm. Spelmotorns kort fortsätter visas i 2D. Detta gäller också Noras
registrerade positionsfilm med `available:false`; annat speechbeteende ändras
inte. Publicering kräver inte kompletta positionsuppsättningar.
Vänster/mitten/höger är fortfarande tekniska eventgrupper: platser 1–2, 3–5,
6–7. De är inte grundloopar och ingen godtycklig positionsersättning införs.

Verifierat före commit:
- Lab produktionsbygge och TypeScript passerade.
- Hela Studio-sviten: 1 099 PASS, 2 SKIP, 0 FAIL (1 101 tester).
- Isolerad webbläsare: meny/tangentbord, 390/768/1440 px utan sidöverflöde,
  verklig PUT → sparning → sidhopp → omladdning, exakt box3 till Händelser och
  separerad bolagsvy; inga JavaScript-fel eller utkastdialoger.
- Runtime/kort/lager och saknade positioner har riktade regressioner; sista
  P2-korrigeringen har 45/45 PASS. Originalfyras sync-probe PASS, media oförändrade.
- Oberoende granskning hittade och ledde till rättade spar-/dubbelklicks- och
  saknad-fil-fall. Lip-sync eller produktionsrepetition är inte godkänd av dessa tester.

**Återstår:** produktionskontroll och riktig skapa-spelrum-kedja med Nora/Johanna.
Originalfyras lokala dubbelrepetition är verifierad i nästa kompatibilitetsdel
ovan. Ingen rumfunktion eller ny SQL-migration ingick i 3d4faaf3. Johns Nivå 2-brief/skiss
finns i teaminbox #9. Ingen kandidatmapp från separat legacygranskning har raderats.

## 9 oktober 2026: arbetsplan för Sammansättning som nav

**Status: genomförande pågår; etapper levereras efter verifiering.** Jakob har valt Sammansättning med tre
videolager som nav. Överflödiga vyer, självklara texter och bekräftelser tas bort;
avancerade funktioner behålls utfällbara. Inspirationsdokumentet kommer senare
och är vägledande, inte en bindande detaljspecifikation. Jakob har aktiverat måluppdraget och begärt löpande main-leveranser för
granskning i produktion. Ingen ny tracker skapas.

### Avsedd struktur och beteende

| Arbetsyta | Samlar | Standardbeteende |
| --- | --- | --- |
| Studio → Sammansättning | Dealer, bord, bakgrund, exakta provklipp | Gemensam stor preview; val och uppladdning vid respektive lager |
| Studio → Innehåll | Dealers & klipp, bibliotek, händelser, tal vid inaktivitet | Vald dealer följer med; Grundloop, Utdelning och Repliker; detaljer i paneler |
| Studio → Publicering | Presentationslanes, bolagspaket, export, spelkoppling | Samma sparade presentation; tydlig separat publicering |
| Drift | Bord/spelrum, uppspelning, spelintegritet, betalningar/journal | Operativa verktyg samlade, med nuvarande åtkomstkontroller |
| AI & chatt | Agentmodeller och operatörschatt | Två undervyer inom samma grupp |
| Administration | Bolag/team, konton/roller, partners | En förvaltningsyta; relevant bolagsval nås även vid publicering |

Översikt och Guide är lågprioriterade fasta länkar. Två layoutalternativ provas:
utfällbara Studio-undervyer i vänstermenyn, eller en Studio-ingång med tre flikar
på sidan. Ordvalet Publicering är ett arbetsnamn; presentationslane, spellane och
spelrum får inte blandas ihop i datamodell eller användarflöde.

- Direkt förhandsvisning utan manuellt godkännande. Uppladdning: välj fil,
  automatisk teknisk kontroll, filen vald i preview. Fel visas vid berört lager.
- Samordnat Spara och fortsätt ersätter onödiga sidhoppsspärrar där det går.
  CAS/revisionskontroll och konfliktåterhämtning måste skydda osparade ändringar.
- Kortnamn beskriver handling eller replik: exempel Lugn blick, Leende,
  Första kortet, Välkommen till bordet. Dealer/kategori visas separat.
  Befintliga egna namn bevaras; originalfilnamn, ID och hash finns under Avancerat.
- Grundloop behåller viktade Basklipp och Variationer. Tal vid inaktivitet är
  en annan funktion. Förhandsvisa klipp är ett provval, ingen runtimekoppling.
- Menytexter, hjälptext och tomma förklaringsblock rensas. Tekniska felmeddelanden,
  behörighetskontroller, upload-biljetter/hashar och capability-skydd bevaras.
- Radera ersatta UI-komponenter först efter referens-/användningskontroll.
  Befintliga alias, sparad zondata, media och kompatibilitetsläsning består
  tills deras beroenden är verifierat avvecklade.

### Genomförande i ordning

| Etapp | Arbete | Klart när |
| --- | --- | --- |
| 1. Meny och nav | Gemensam skalstruktur, valt sammanhang och utfällning | Aktiv undervy, tangentbord, omladdning, bakåtknapp och djup-/querylänkar fungerar |
| 2. Sammansättning och innehåll | Lagerpaneler, direkta provval, enhetlig dealeruppladdning inklusive greenscreen | Upload → preview → spara → omladdning fungerar; avbruten upload och revisionskonflikt förlorar inget utkast |
| 3. Texter, namn och legacy | Renodla paneler, synliga namn och oanvänd UI-kod | Alla befintliga funktioner går att nå, ID/replik/kortplats och egna namn är oförändrade |
| 4. Publicering och spelrum | Koppla presentation till kompatibel spellane och rum | Paket/behörighet valideras; upprepat klick skapar inga dubbletter; komplett isolerat flöde till spelaren verifierat |
| 5. Dokumentation och leverans | Uppdatera guide, ordlista, teknisk referens och denna handoff | Menynamn/route/flöde stämmer; relevanta tester, visuell QA och exakt-SHA driftkontroller redovisade var för sig |

Etapp 4 börjar med att fastställa API-kontraktet: återanvänd kompatibel spellane
eller skapa en ny, och skapa därefter ett faktiskt rum. Detta är inte bara en
knapptext. Nora kräver egen kompatibel spellane; live-AI-chatt för Nora ingår inte.

### Arbetsfördelning och verifiering

Samordnaren äger integration, utkast/sparning, publiceringskontrakt och gemensamma
dokument. Underagent A arbetar med meny/skal; B med klipp- och lagerpaneler;
C gör en separat granskning av städning, terminologi och tillgänglighet.
Högst tre underagenter samtidigt; exakta filclaims innan ändringar, samordnaren
äger .git vid integration. Ingen branch eller worktree skapas.

Relevanta filer: lab/lib/scout-navigation.mjs, lab/components/workspace-navigation.tsx,
control-preview-page.tsx, composition-preview.tsx, layer-library.tsx,
family-video-upload.tsx, video-metadata-fields.tsx, control-lanes-page.tsx och
lane-editor.tsx under lab/components. Navigationstester finns under lab/test.
Dokument ändras i lab/docs/README.md, lab/docs/TERMINOLOGI.md,
docs/LOCAL-PRESENTATION-RUNTIME.md och denna handoff tillsammans med respektive etapp.
CLOUD-MIGRATION uppdateras bara för verifierade ändringar i befintliga poster.

Standard i editorn är tre lager; fullbildsfilmer fortsätter fungera som fullbild
och döljer separata bord/bakgrund. Ny default i spelruntime kräver egen verifiering:
originalfyra dealers, två uppspelningar vardera, Nora och hela paket → partner →
spelare. Visuell lip-sync-acceptans är inte ett hinder för vanlig upload/preview
men kan inte ersättas med hashkontroll vid ändrat spelmaterial.

Planunderlag kontrollerat mot main 40b2931 och kort överlämning från chatt "1".
Skapa spelrum från presentationslane saknas; CUA-visuell slutkontroll och Nora-
produktionsacceptans är fortfarande öppna. Den ursprungliga planeringsvändan ändrade ingen produktkod; den aktuella
implementationens testresultat står i leveransavsnittet ovan. Säkerhetsläsning vid start:
12 öppna GitGuardian-incidenter; platsmetadata delvis och historisk skanning
ofullständig, aktiv övervakning. Ingen incident har ändrats.

Jakobs modellkrav: minst GPT-6.1 Sol med extra hög tankegrad för underagenter.
Samordnaren hanterar integration och svårare avvägningar.
John och hans agent har fått originalskissen och Nivå 2-uppdraget via
[teaminbox #9](https://github.com/Jakeminator123/scoutgaming/issues/9).
Utdelning ska uttryckligen behålla separata spelarplatser och dealerpositioner.
Svenska visningsord dokumenteras i ordlistans kolumn Svenska.

## 9 oktober 2026: samlad Studio-meny och enklare sammansättning

Jakobs meny- och begreppsbeslut är genomfört med underlag från chatten
”Kartlägg terminologi och kontrollmen”. Ett Studio samlar Dealers & klipp,
Klippbibliotek, Sammansättning, Lanes, Händelser och Tal vid inaktivitet.
Zoningångarna går till Sammansättning; gamla zondata och tekniska ID:n bevaras.
Översikt visar fyra steg: dealer/klipp → sammansättning → lane → spelrum/bord.

Grundloop är idle-loop med Basklipp och Variationer. De befintliga basklippen
väljs fortfarande viktat; inget ”reservklipp” har införts. Vikter, tester,
spelvägar och diagnostik öppnas under Avancerat. Utdelning och Repliker
är övriga klippflikar. Probe heter Tal vid inaktivitet och ligger under Studio;
den befintliga Astrid-begränsningen framgår. Inga ändringar av spelruntime,
mediefiler, sparad produktionspolicy, databas eller AI-behörighet.

Sammansättning och Lanes skickar valt lane-id mellan vyerna. Osparade utkast
stoppar nästa länkhopp. Publicering, bolag, JSON-export och avancerade urval finns
kvar. Spelkoppling leder till Administration → Bord. En knapp som automatiskt
skapar ett spelrum från en presentationslane ingår ännu inte.

Verifierat: Studio 1 061 PASS, 0 FAIL, 2 SKIP; Lab-bygge och TypeScript PASS.
Dealer-audit --probe matchar originalfyra utan medieändring. Oberoende kodgranskning
hittade ingen blockerare; gammal guidehänvisning rättad. Slutlig fullregression
körs före commit; exakt-SHA CI/Vercel redovisas vid leverans.
CUA-startfel finns kvar, så ny visuell granskning i inloggad produktion är inte gjord.
Noras produktionsfiler, fyradealerrepetition och hela lane → rum → spelare-flödet
återstår att acceptera.

Föregående Nora-leverans 260e439a hade grön CI 37918069540 och Vercel READY på
exakt SHA. Efter Jakobs andra Render-redeploy svarade /api/presentation/capabilities
200 med Nora/per-clip. Renders exakta commit-SHA har fortfarande inte lästs.


## 9 oktober 2026: kortare aktiv terminologi

`lab/docs/TERMINOLOGI.md` är nu en kort ordlista med matriser och textflöde,
cirka 25 % färre ord. Presentationslane skiljs från spellane; Nora,
fullbild/greenscreen, samlad Studio-meny och acceptansgränser finns med.
Grundloop, Basklipp, Variation, Sammansättning och Tal vid inaktivitet
är samordnade med Studio-ombyggnaden; gamla zoningångar pekar på Sammansättning.
Historiska GitLab-/snapshotreferenser, dubbleringar och tekniska
legacyöversättningar har tagits bort ur ordlistan. Dokumentändringen innehåller
ingen produktkod. Den lämnas till den samlade Studio-integrationen: separat
commit stoppades av ett test mot den samtidigt ändrade zoningången.

De två PDF-underlagen från 6 oktober och en identisk Desktop-kopia har
arkiverats privat med ursprungliga sökvägar, storlekar och SHA-256 i manifest.
Tre av tre arkivhashar matchar; inget underlag har raderats.
Tabeller, kodblock, relativa länkar och kvarvarande guideankare är kontrollerade.
Produktionsstatus och visuell spelacceptans påverkas inte av dokumentändringen.

## 9 oktober 2026: Nora och videoeditorn integreras i Control

Jakobs val är **egen dealer Nora**. Dealerregistrering på `/control/clips`
skapar 16 egna tomma baselines. Native upload/classify kräver sparad registrering
och rätt behörighet; ingen Astridmedia kopieras. Filmens metadata väljer fullbild
eller greenscreen med bounded key-inställningar. Övriga framtida dealer-id kan
beskrivas i modellen, men runtime och utrullningskontroll godkänner nu bara Nora
utöver originalfyra; detta är inte ett generellt live-dealerlöfte.

Förhandsvisning använder samma compositor som det lokala Nora-provet: dealer,
bild/video för bord och bakgrund, mobil/desktopplaceringar, två uppspelningar
och tillfälligt trefilsprov. Placeringar sparas i lanen och fryses i bolagspaketet.
Actual game-player använder det exakta valda klippets frame/clock och metadata.
Fullbild undertrycker separata lager. Publicerade lager läses enbart via
bolagspaketets befintliga tillgångsväg. Nora idle kräver exakt egen sparad
idle-baseline och spelas muted; ingen Astridfallback. Live AI-chatt för Nora
är inte tillagd; originalfyra behåller sin befintliga chattväg.

**Utrullningsgrind:** Render autoDeploy är avstängd och dess SHA är inte verifierad.
Native Studio måste få en betrodd capability från Render före nya Nora-/lager-
skrivningar i gemensam Neon, även inuti repository.transaction. Gamla
projektoperationer behöver inget capability-anrop. Render uppdateras separat;
Vercel READY räcker inte för spelacceptans. Ingen produktionsdata har ändrats.

Lokalt: Studio **1 057 PASS, 0 FAIL, 2 SKIP**. Slutligt Lab-bygge, TypeScript
och Vercelfrontend-bygge med spelarflagga och isolerade buildvärden passerade.
Riktade runtimeprov: 101 PASS; Native utrullnings-/saveprov: 83 PASS;
Blobexport: 6 PASS. Dealer sync `--probe` matchar baslinjen för originalfyra.
Ordinarie fullregression körs av commithook; exakt-SHA CI/deploy-resultat
redovisas vid leveransen. Mänsklig lip-sync-acceptans kvarstår.

**Sandbox:** default-exec och CUA misslyckas före start. Sandboxloggen visar
os error 32 vid ACL-validering av Codex `node_repl.exe`. Flera Codex-processer
och två chattar finns. Read-only Windows Restart Manager bekräftade åtta
node_repl-resursanvändare under samma Codex/ChatGPT-processkedja; det pekar
inte ut ett ensamt blockerande filhandtag eller en specifik chatt. Inga belägg
för att dev-servrar, git push, Parsec eller Tailscale orsakar detta. Båda
fjärrverktygen används enligt Jakob och har lämnats igång. Hypotes/fynd är
sparade i privat Codex-minne. Ingen omstart eller sandboxreparation är verifierad.
Ett isolerat produkt/Lab-par byggdes och stoppades inför fullregression.
Sessionvakten nekade korrekt ett tests andra par medan QA-paret var igång;
QA-portarna 4192/4194 är nu fria. Inga parallella produktpar startades.
CUA är därför blockerande för nya visuella spelrepetitioner, inte för skaltester.


## 9 oktober 2026: smidigt GitGuardian-läsflöde

`node tools/security-status.mjs` läser nu GitHub-status och GitGuardian-incidenter
parallellt i en kompakt rapport. Befintlig DPAPI-koppling återanvänds; inga nya
nycklar eller rättigheter. Projektets Codex-konfiguration registrerar den
befintliga stdio-servern med `read_security_status`, `read_source_binding` och
`read_repo_incidents`. `codex mcp get gitguardian --json` verifierar registreringen;
en redan öppen chatt kan behöva laddas om för att få de nya verktygen.

Live mot remote main `ef5ff919`: komplett incidentlista, 17 incidenter varav 12
öppna och 5 ignorerade. 6 öppna incidenter saknar fil/rad; luckan är synlig.
Repositoryövervakning är active/monitored=true. GitHub-suite är queued utan
check runs på direktpush-committen. Senaste helhistorikskanning 2 oktober är
`too_large`; aktiv övervakning och läst incidentlista bevisar inte full historik
eller en lyckad skanning av exakt senaste SHA. Ingen incident har ändrats.

Verifiering: 34/34 riktade säkerhets-/MCP-tester PASS, riktig stdio/API-läsning
och Codex MCP-registrering verifierad.
Återstående: bedöm de öppna incidenterna separat; utred saknade platser om de
behövs. Ingen ny CI-installation eller bakgrundsövervakning infördes.

## 8 oktober 2026 kväll: övertagande och isolerat Nora-kompositionsprov

Övertagandet återläste lokal och remote main `cad8f6e6` samt GitHub-körning
`37832989977` (success). Vercelprojekt `scoutgaming` i team `scoutgaming` har
production target READY på samma SHA; www-aliaset pekar på
`dpl_4J12tc6ncJg2swjdWKZafFpy7kse`. www svarar 200 och apex 308 till www.
Render `/__cloud/health` svarar 200/ok men lämnar ingen commit-version.
GitGuardian-suite är queued; incidentlistan är fortfarande `not-read`.

Jakob gav tre lokala testfiler: bakgrundsvideo (1920×1080), Noras gröna
dealervideo (1080×1920) och ett transparent PNG-bord (1440×2560).
Videorna är H.264, 24 fps och 10,042 s utan ljudspår. Byte-identiska kopior
ligger i Git-ignorerade `lab/preview-build/nora-test/media/`; originalen och
godkända produktmedier ändrades inte. En lokal testvy använder den befintliga
WebGL-kompositorn med grön nyckling, mobil 9:16, desktop 16:9 och individuella
lagerkontroller. Båda videorna spelar och loopar; bordets alpha visar 75,1 %
helt transparenta pixlar. Lager av/på och schackrutebakgrund har granskats i
webbläsaren. Bilder finns privat i `lab/data/qa-composition-nora-20261008/`.
Testvyn är inget aktiverat dealerpaket: handmask, kortkalibrering, repliker och
acceptans i den faktiska spelaren återstår.

Ett isolerat lokalt produkt-/labbpar behålls för Jakobs interaktiva prov:
`http://127.0.0.1:4192/preview/nora-test/index.html`. Det startades med
`node lab/start.mjs --offline --no-open --skip-build`, tom testdatabas och
externa tjänster avstängda. Ingen ny server får startas parallellt.

Astrids goodluck slutförde två repetitionplays i den gemensamma spelaren.
Vera-/Amira-query i samma offline-fixtur räknas däremot inte som acceptans av
dessa dealers: odekorerad HTML saknar serverns lane-dataset och klienten
faller tillbaka till `mobile-phone`/Astrid/local. Produktionslanens
Astridbegränsning är avsiktlig; fyradealeracceptansen kvarstår.
Produktionsprojektet visar dessutom standardförslaget mobile-phone utan en
uttryckligen sparad lane och med tomt lagerbibliotek. JSON-exportknappen
startar en nedladdning på 934 byte, men IAB avbryter den före mottagna byte.
Själva nedladdningsfilen och export → partner → spelare är därför fortfarande
overifierade. Inga produktionspaket eller konton ändrades i provet.

## 8 oktober 2026 kväll: T10 — tre val och frysta lane-paket

Produktkoden levererades på main som `813c25a6`; full lokal commit-hook passerade
och Vercel-deploymenten blev READY. GitHub-jobbet `presentation-studio` hittade
därefter fyra gamla UI-förväntningar: teknisk offlinecopy, låst lane-checkbox,
iframe-only-preview och den gamla menyn. De har uppdaterats till det avsedda flödet
och lagts i full lokal regression. Studio-suiten: 1 029 pass, 0 fail, 2 skip.
Preview-testet verifierar dessutom att den delade dataläsaren stoppar 401/partner
innan Studio-data läses. Ny meny, sparad lane och tre väljare har även lästs på
`www.scoutgaming.tech/control/preview` efter omladdning. Inga mediefiler ändras.

Jakob gav Codex uppdraget att fortsätta efter masterplanen. Astrids godkända
filmer ska vara kompatibla fullbildslager tills godkända frilagda dealerpaket finns.
Start och plan finns i `random/start-T10-2026-10-08.md` och
`random/masterplan-t10-konsolidering-2026-10-08.md`; alla tre T10-dokument kom med
i remote main `ddc58fcb`. Aktivitetsdokumenten fanns redan på main.

- Studio har tre huvudingångar: Dealers & klipp, Förhandsvisning och Lanes.
  Bibliotek, zoner och händelser är kvar under Studio · verktyg.
- Förhandsvisning redigerar samma sparade lane som Lanes: dealer, bord och
  bakgrund, standardval, tillåtna alternativ och synlighet. Exakta befintliga
  klipp kan provas; Paow/Dragge-provet finns kvar i en utfällbar del.
- Lagerbiblioteket registrerar bild/video i privata Blob-namnrymder
  `croupier/media/backgrounds/` och `croupier/media/tables/`. Prepare/commit kräver
  Studio-session, rätt scope, origin, giltig uppladdningsbiljett, verifierad hash
  och projektets aktuella revision. Ingen ny SQL-migration behövs: biblioteket
  ligger i projektdokumentet. Offline saknar uppladdning och molnpublicering.
- Lanes kan exportera ett validerat JSON-manifest från sparat innehåll.
  Publicering fryser valda lanes och refererade lager i operatörspaketets
  reserverade, komprimerade `_scoutPresentation`. Hashen kontrollerar integritet;
  det är ingen digital signatur. Paketet behåller den befintliga storleksgränsen.
  Exporten innehåller filreferenser, inte videofiler eller leverantörshemligheter.
- Partnerns val begränsas till en publicerad lane och dess rättigheter.
  Spelstart läser frysta presentationsval och delar inte privata biblioteksfiler
  som bolaget saknar i sitt paket. Kort, saldo och spelutfall förblir serverägda.
- Tre lager är redigeringsmodellen. Ordinarie opaque dealerfilm förblir fullbild;
  bakgrund/bord kan inte bytas självständigt bakom dess inbakade pixlar.
  T9-renderern är fortsatt opt-in. Fler dealers och frilagda standardpaket återstår.

Verifierat separat: TypeScript, riktade kontrakt-/behörighetsprov, privat
uppladdning med testlager, paketfrysning, delad spelentré, offline save → reload,
video Range 206 och visuell editor. Full regression körs av leveransens commit-hook.
`audit-dealer-sync --probe` passerade för samtliga fyra dealerbanker; tidigare
saknade repliker och mänsklig läppacceptans kvarstår. Inga godkända medier ändrades.
Webbläsarens klickverktyg fastnade före dispatch: fyra dealers × två spelningar,
JSON-nedladdning via knapp samt riktiga Blob/Neon/partner-klick är inte godkända
som end-to-end. Den isolerade serverparet stoppades och dess tillfälliga data raderades.

Vercel-team och projekt verifierades som `scoutgaming`. GitHub API visar repot
som **public**, trots README:s tidigare private-uppgift. GitGuardian-suite på
setup-commit `ddae3b5d` är queued; incidentlistan är `not-read`.
Produktionsdeploy och Render-version ska kontrolleras mot den levererade SHA:n.

## 8 oktober 2026 kväll: Codex och befintlig checkout

Arbetskatalogen är `C:/Users/jakob/dev/projects/scoutgame`, på `main` i
`Jakeminator123/scoutgaming`. Efter Cursor-agentens leverans hämtades remote main:
`ddc58fcb`, utan divergens. Ingen ny checkout eller flytt av lokala filer gjordes.
De 60 inventerade filerna i `random/` och 16 `.env`-filerna behöll samma SHA-256;
hemliga värden ingår inte i rapporten eller Git.

`.codex/config.toml` ger projektet `workspace-write`, nätåtkomst, automatisk
granskning av utökade behörigheter och Windows-sandbox `elevated`. Modellval och
inloggningar ärvs från användaren. Git använder `.githooks`, fast-forward-only pull
och prune vid fetch. Codex-CLI uppdaterades via Volta från 0.150.0 till 0.161.0;
enbart det föråldrade `mcp_servers.vercel.type` togs bort ur användarkonfigurationen.

Verifierat: TOML, faktisk laddning från rätt cwd, installation, auth, sandbox,
HTTP-åtkomst och WebSocket-handshake via `codex doctor`, samt filbevarande.
Repoets fulla pre-commit-kontroller körs vid commit. Systemkartan har 0 röda fel
men gul baslinjedrift. GitGuardian-suite väntar; incidentlistan är inte läst.
Valfria CLI-varningar kvar: desktopvariabel för `node_repl`, Defender-exkluderingar
ej verifierade och `TERM=dumb` vid icke-interaktiv körning. Produktservrar startades
inte. T10 är fortsatt en plan; detta arbete ändrar ingen spel- eller medialogik.

## 8 oktober 2026 eftermiddag: T9 layer-preview bakom flagga

Spelvägen har ett opt-in-spår för tre lager utan att röra Astrids ordinarie local-väg:
ny server-lane `layer-preview` (`renderer: layered`, default dealer `paow`) och ny
Render-rutt `/layer-packs/*` som bara svarar när entrén har satt cookie-flaggan
`croupier_layer_preview=1`. Rutten serverar runtime-moduler från
`test-videoeditor/program/web` och manifest/media från `lab/preview-build`, med
`Range`-stöd och `Cross-Origin-Resource-Policy: same-origin`.

Klienten har ny modul `web/public/layered-presentation.mjs` som monterar canvas i
`#scene`, laddar `/layer-packs/<dealer>/manifest.json` och matar `bridge.consume`
med serverns `presentation[]` från `/api/table`. `unsupported[]` (exempelvis `speak`)
loggas som kvitto i observationsflödet och kastas inte. Om paket saknas visas
`Lagerpaket saknas · 2D-reserv` och ordinarie DOM/SVG-kort fortsätter.

`gameChoices` för `layer-preview` öppnar dealer-val `paow/dragge` och bakgrundsval
från katalog-ID:t; panelen Ditt bord använder samma lagring som N3.4.
`#dealer-options` listar fortfarande bara dealers i `DEALERS`-objektet, alltså inte
Paow/Dragge där ännu; de syns i Ditt bord-panelen.

## 8 oktober 2026 sen eftermiddag: e-postinbjudan för operatörspersonal

`invite` i partner-API:t och `operator-membership` med e-post skapar ett partnerkonto utan
hash, en engångstoken (samma `tokens`-tabell och `studio-sha256:`-hash som Studio) och
medlemskap `invited` när adressen saknas; ett befintligt partnerkonto kopplas `active` utan
mejl. Mejlet (Resend, rubrik "Inbjudan – operatörspersonal, nivå 2") bär bolagsnamn, roll och
länk till `/partner/set-password?t=`. Svaret är alltid `{ invited: true }`; högst 5 per aktör och
timme, sedan 429. `POST /api/partner/set-password` konsumerar token, sätter scrypt-hash, bumpar
auth-epoch och aktiverar inbjudna medlemskap; Studio:s set-password och login vägrar fortfarande
roll `partner`. Journalen loggar maskad e-post. Översikten `/control` läser riktiga bolag via
`listLaneOperators()` när native admin är på. Inte klickat i webbläsare; inget riktigt mejl skickat.
Kvar: glömt-lösenord för partner, journaltabell.

## Nuläge per funktion

| Funktion | Status | Avsnitt |
| --- | --- | --- |
| Klipplogik och lane | påbörjad — system A är det enda urvalssystemet och `select` gäller alla fyra dealers (Astrid bevisat oförändrad, baslinje 160 anrop); `project.lanes[]` redigeras och publiceras på `/control/lanes`; lanen bär zoner, bordsfärger, probe och idle som valfria fält; Render läser paketet på `/blackjack?operator=` och Vercel `/play/blackjack?operator=` hämtar det dokumentet (L8b); kvar: rehearsal Vera/Amira/Mei (2D-reserv tills nya paket), tre lager i spelet (Jakobs gren), klick i prod. Uppföljning: `random/checklista-2026-10-08.md` | 8 okt eftermiddag |
| Nivå 1 /control | påbörjad — en kodgeneration på sidmallen; Händelser en sida, Probe i menyn, Lanes med lane-redigerare, Översikt med anslutna bolag, Uppspelning är loggen, ljust läge rättat på fyra ytor; kvar: filterchips (11), Probe verifierad i prod (C9) | 8 okt middag |
| Nivå 2 /partner | påbörjad — session finns; team och branding skrivs (revision som CAS, sista-admin-spärr i lagret); Bolag på `/control/lanes` skapar bolag, roller och medlemskap; e-postinbjudan skapar inbjudet partnerkonto + engångslänk till `/partner/set-password`, kontot kan sedan logga in på `/partner/login` (5 inbjudningar per aktör och timme); Översikten listar riktiga bolag ur Neon när lagret är på; kvar: journaltabell, glömt-lösenord för partner, speldata, prod-klick | Skrivande partnerrutter, Partnerportal |
| Nivå 3 /play | påbörjad — lobby med `Spelar hos` och senaste bord/dealer från webbläsaren; redigerbar profil (namn, språk; migration `006` väntar); historikrutt; panelen Ditt bord väljer dealer och bordsfärg inom lanen (N3.4). Bakgrund är avstängd när filmen är inbakad. Valet ligger inte på kontot | Spelaryta |
| Tester och dokumentation | klart 7 okt natt — körare för lösa tester, dokumentation mot kod (D1–D32); 8 okt: CI-steget Orphan tests, ffmpeg från cache, GPU-workflows på `ubuntu-24.04` | Pass M |
| Studio-migrationer | klart — 001–005 applicerade på produktions-Neon 7 okt; CI-spärr före deploy | Partnerportal |
| Systemkarta | klart — tre nivåer, CI-spärr; baslinje `8ebb53e2`, grå med 0 röda | Systemkarta |
| Render croupier-v2 | manuell deploy 8 okt 12:45 med L8/N3 (`/api/profile` svarar 401, `/api/operators/<slug>` läser Neon); `006-player-profile.sql` väntar på körning | Aktuell leverans |

Uppdaterad 8 oktober 2026. Detta är den enda löpande handoffen.
[Äldre komplett handoff, fryst på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/JOHN-HANDOFF.md)
bevarar samtliga tidigare statusnotiser och kvittoplatser. Privata bevis,
journaler och backups ligger kvar; detta är dokumentstädning, inte nya order.

## Skrivande partnerrutter, 8 oktober 2026 eftermiddag: bolag, roller, team (N2.2, N2.3)

Byggt på 005 och `ac936377` utan att vänta på Kevins svar (#3); ingen migration. Väntar på orkestratorns granskning.
Nivå 1: POST `operator-create` (bolag med standardrollerna `partner-admin`, `partner-editor`,
`partner-viewer`), `operator-role` (kända behörigheter; `team.roles.assign` bara på `partner-admin`)
och `operator-membership` (befintligt konto med roll `partner`, revision som CAS, sista-admin-spärr).
Kortet Bolag på `/control/lanes` listar bolag och medlemmar, skapar bolag, lägger till medlem via
användarnamn, byter roll och stänger av. Äldre bolag som `sg-test` får rollerna med Skapa saknade
standardroller; först med ett medlemskap som `partner-admin` eller `partner-editor` slutar
branding-skrivningen ge 403. Nivå 2: `GET/POST /api/partner/team?operator=` (GET kräver `team.read`,
POST dessutom `team.roles.assign`). Bjud in kopplar ett befintligt partnerkonto via e-post; ingen
e-post skickas (N2.6). `partner-admin` är inte delegerbar, så operatören kan inte utse, degradera eller
stänga av administratörer. Kevins `team.jsx` har ett additivt `runtime.team`; utan det renderas vyn
som förut. Bjud in och rollbyte anropar API:t i riktig session; avstängning finns i API:t och i Bolag,
inte i Kevins vy. Journaltabell saknas: varje skrivning ger en serverloggrad `[operator-journal]`
(at, actor, action, operatorId, target, ingen e-post). Testat: lab `npm test` (två webbläsartester
hoppas över som förut), `npm run typecheck`, `npm --prefix lab run build`, hela
`.githooks/pre-commit-full` (Kevins portaltest, `test/operator-store.mjs`,
`test/partner-access-policy.mjs`), systemkartan utan fel. Kvar: e-postinbjudan och accept-steg,
journaltabell; en admin-409 skiljer inte sista-admin från revisionskrock; låstimeout i partner-API:t
blir 503. Kevin godkänner rollnamn, standardbehörigheter, placering och journalformat.

## 8 oktober 2026 middag: paketet når spelet, select för fyra dealers, spelarprofil

Tre promptagenter levererade parallellt, orkestratorn löste korsfelen och mergade.
Spelmotorn läser operatörspaketet på `/blackjack?operator=<slug>` (lane och dealer
begränsas till paketet, 30 s cache, okänd slug 404, utan `?operator=` oförändrad väg).
`POST /api/presentation/select` gäller alla fyra dealers; `legacyClipPolicy` översätts till
standardvarianter vid läsning och Astrids svar är bevisat oförändrade (baslinje 160 anrop,
`tools/astrid-select-baseline.mjs`). Vera, Amira och Mei spelar 2D-reserv där klipp saknas
tills nya paket finns. Spelaren kan redigera visningsnamn och språk (`PATCH /api/profile`,
saldo serverägt) och lobbyn visar `Spelar hos`. Migration `006-player-profile.sql` väntar på
körning mot spel-Neon, Render väntar på manuell deploy, rehearsal av tre dealers väntar på Jakob.
Uppspelning är nedbantad till loggen; ljust läge rättat på `/partner`, guiden, chatten och
inspektorn; demo-bolagen bor i `web/demo-operators.mjs` så servern inte importerar `lab/`.

## 8 oktober 2026 eftermiddag: Vercel bär paketet, spelaren väljer inom lanen

L8b och N3.4. Vercel `/play/blackjack?operator=<slug>` hämtar Renders `/blackjack`-dokument
(paketets lane och dealer, bolagets 404, 503 om motorn inte svarar). Ogiltig slug och en
signerad launch med `claims.partner` skickas inte som operatör. Utan `?operator=` är vägen
densamma som förut. Spelet får `gameChoices` från lanen även utan bolag. Panelen Ditt bord
byter dealer via befintlig adress och lägger bordsfärg på filt-märke, plånbokskant och
marker. Inbakad bakgrund går inte att välja. Valet sparas i `localStorage`, inte på kontot.
Testat: spelentré, spelarval, lobbyns text, fuzz 3000 rundor, dealer-probe PASS. Inte klickat
i webbläsaren eller i produktion. N2.2 (skrivande partnerrutter) har ingen kod i den här leveransen.

## 8 oktober 2026 förmiddag: Lanes, clipLabels, CI-actions

`/control/lanes` publicerar ett operatörspaket (POST `operator-package`) och kan skapa
`SG test game provider` på klick (POST `operator-create-demo`). Skrivningar kräver Neon-pool
med `connect()`; `{ query }` ger 503. Spelet läser inte paketet. Klippbibliotek sätter
`project.clipLabels` via sidans Spara. `dealer-regression` använder `pnpm/action-setup@v6`
och `actions/upload-artifact@v7`. Kartans L3-ruta är live.

Andra passet samma förmiddag (fyra parallella underagenter): `/control/lanes` har en
redigerare för `project.lanes[]` (ny lane, dealers 1–4, lager, OpenClaw-läge,
bolagsjusteringar; Spara projekt är sidans lime, Publicera paket sekundär; id låses vid
skapande). Översikten listar anslutna bolag ur fixturen med länk till `/partner/{slug}`.
Partner-API:t har `GET/POST …/branding?operator=` som läser och skriver bolagets utseende
inom lanens `operatorAdjustable` (revision som CAS, rättighet `presentations.configure`,
pool med `connect()`); panelen visas i Kevins vy Färger, marker och kort för inloggad
operatör. Inga roller seedas förrän N2.2, så skrivningen ger 403 i produktion tills dess.
Död CSS borta, guiden har dagens sidnamn, `returnTo` efter utloggning pekar tillbaka på
`/control/preview` och `/control/lanes`. Jakob 10:32: `/control/lanes` ersätter Kevins
gamla alias som ledde till Administration. Promptfiler för L8, C5b och N3 ligger i `random/`.

## Pass S, 8 oktober 2026 natt: klipplogik steg 3a, Händelser en sida, förhandsvisning

Jakob 02:49: "kör enligt rekommendationerna, bortse från John om det blockar". Beslut 49–59 i
`random/beslutsmatris-2026-10-07.md`; förslag `random/k2-forslag-2026-10-08.md`; fakta
`random/k1-fakta-spelvagen-2026-10-08.md`; uppföljning `random/checklista-2026-10-08.md`.
Fyra underagenter parallellt, orkestratorn granskade och rättade.

Ändrat. Studio-projektet har `lanes[]` (presentation lane: dealers, lager bakgrund/bord/dealer,
OpenClaw-läge per händelsetyp, vad bolaget får ändra) och `clipLabels`; `schemaVersion` kvar på 1,
standardlane `mobile-phone` när nyckeln saknas, ingen läsare ännu. Klipp visas med svenska namn ur
`familyId` + roll utan filbyten. Händelser är en sida: `/control/events` utan `?event=` är
översikten, `/control/tree` omdirigerar 308 med frågesträngen kvar. Menyraden heter Probe, Johns
fyra etiketter är djuplänkar `/control/administration?tab=`, inloggningskortet ligger på
sidmallens tokens. `test-videoeditor/` bär lagerprovets material (ursprungligen grenen
`test-video-jakob`, byte-identiskt speglad och raderad 8 okt 18:35; förhandsvisning Paow/Dragge 720p,
12 MB, webbspelare med WebGL-kompositor); `/control/preview`
visar den bakom adminsessionen via `/preview/[...path]` (ingen publik kopia, media som filer,
inget till blob eller databas). `test/fuzz-blackjack.mjs` fuzzar serverns `web/shoe-game.mjs`
(3 000 rundor i kroken, 100 000 gröna). Systemkartan har sidan och handlern; menynamnen är
uppdaterade i `AGENTS.md`, `CLAUDE.md`, README-filerna, labbguiden, terminologibladet och driftdokumenten.

Testat: labbtester 954 gröna (2 skippade sedan tidigare), typecheck, systemkartan 0 röda,
orphan-kontrollen 263 filer, full pre-commit-krok per commit, lab-bygget med prepare-steget.
Produktion verifieras som `LLM`: `/control/events` med och utan `?event=`, `/control/tree?dealer=astrid&event=idle.ready`
(308), `/control/probe`, `/control/administration?tab=accounts`, `/control/login` ljust/mörkt,
`/control/preview` (Paow/Dragge spelas, inget skrivs), `/studio/preview/index.html` utan session
ska leda till inloggning.

Kvar: K steg 3b (select för alla fyra dealers, `legacyClipPolicy` → standardvarianter) kräver
rehearsal med Jakob dagtid. Lane-export, bolagets yta, demo-operatör (L1–L3, rad 44). Redigering
av `clipLabels`. Systemkartans `planned`-rutor (matris 42). Nivå 2-rutter väntar på Kevin.

## Pass M, 8 oktober 2026 natt

Mekaniskt pass enligt `random/handoff-2026-10-08-orkestrator.md`, två underagenter parallellt,
granskat av orkestratorn. Beslut i `random/beslutsmatris-2026-10-07.md` rader 45–48.

Ändrat: `a91f92ee` tre gränssnittstexter (L20–L22). `820709dd` Uppspelning monterar det
rullande observationsfönstret via en egen `rolling`-prop i `ActivityLog`; *Visa spelfliken här*,
Partner-SSE och övriga verktyg finns kvar (rad 39, L23). `815b0b76` Bakgrundszoner på sidmallen
med kortad text, alla funktioner kvar (rad 43). `f95ed1ef` GPU-workflows på `ubuntu-24.04`.
`683dd4fd` ffmpeg i `presentation-studio` och `lipsync-worker` installeras från cachade `.deb`
(`actions/cache`, nyckel `ubuntu-24.04-ffmpeg-<version>`), nedladdning bara vid miss; jobben får
`actions: write` för att spara cache. `9dbfe09e` CI-steget Orphan tests
(`tools/check-orphan-tests.mjs`): 259 testfiler, 0 föräldralösa, 3 undantag med motivering i
`tools/orphan-tests-exceptions.json`; tre gröna tester in i `pre-commit-full`.

Testat: labbtester 941/943 (2 skippade sedan tidigare), typecheck, systemkartan grå, full
pre-commit-krok för varje commit (ffmpeg och jq lokalt). Produktion verifieras som `LLM`:
`/control/activity`, `/control/guide`, `/control`, `/control/zones` ljust och mörkt.

Kvar: `dealer-regression` installerar ffmpeg och jq utan cache (rad 46). `test/fuzz-blackjack.mjs`
är ett manuellt skript mot klientmodulen och räknar invariantbrott (rad 47). Johns rader 11, 12,
14, 17b. Klipplogiken: steg 2-förslaget väntar på Jakobs svar; lagerspåret (tre lager) finns som
lane `layer-preview` (T9) och provas i rehearsal; se `random/checklista-2026-10-08.md`.

## Sista operatörsadmin, 7 oktober 2026 natt

Ändrat (`186c6bc4`): operatörslagret (`web/storage/operator-store.mjs`) avvisar en ändring av
medlemskap (roll eller status) eller av en befintlig roll som skulle lämna bolaget utan aktiv
admin. Admin är en aktiv medlem vars roll har `team.roles.assign`
(`OPERATOR_ADMIN_PERMISSION` och `isOperatorAdmin` i `web/partner-access-policy.mjs`).
Avvisningen är 409 `studio_last_operator_admin`. Kontroll och skrivning sker i en transaktion
med låst bolagsrad; utan en pool med `connect()` avvisas sådana skrivningar med 503. Ingen
migration, ingen vy och ingen rutt. Sqlite-vägen i `web/server.mjs` är granskad utan ändringar:
produktion kör postgres, sqlite bär offline-labbet (beslutsmatrisens rad 36).

Testat: 82 tester för lagret, policyn och partnerdatan, labbtester, typecheck, systemkartan och
full regression lokalt utom `test/bugshot-report.mjs`. Kvar: ingen rutt eller vy skriver
medlemskap (L5, L11), en skrivande rutt måste skicka poolen (L24), ingen databasspärr och
inget samtidighetsprov mot riktig Postgres.

## Teststädning och dokumentation, 7 oktober 2026 natt

Teststädning: sex gröna testfiler utan körare och tre frontendtester (lobby/profil/historik,
landningssida, introenhet) körs nu av `.githooks/pre-commit-full`. Testberoende DOM är borta
(dold text "Nivå 1 · ScoutGamingGroup", konstanterna i `lab/lib/studio-navigation.mjs`); skyddet
för gamla menyadresser är en fast lista i testet. Pensionerade namn i tester är bytta;
`tools/backup-lissabon-state.mjs` heter `tools/backup-lab-state.mjs` med oförändrat backupformat.
GitLab-inboxens verktyg och test är borta; `identity` och låset ligger i
`tools/croupier-chef.mjs`. Död CSS för gamla Studions sidomeny och chattgenvägar är borttagen.

Dokumentation: `AGENTS.md`, `CLAUDE.md`, `README.md`, `lab/README.md`, labbguiden,
`lab/docs/guide.json`, driftdokumenten och `.cursor/rules` följer koden (avvikelserna D1–D32 i
`random/docs-avvikelser-2026-10-07.md`): partnerinloggning och spelarsidorna finns, dagens
`/control`-namn, start med `node lab/start.mjs`, repot `scoutgaming`. T2 och T4 är öppna.

Testat: labbtester, open-claw-tester, typecheck, build, systemkartan och full regression
lokalt utom `test/bugshot-report.mjs` (kräver `jq`). Kvar: `test/backoffice-lab-browser.mjs`
är opt-in och inte körd; tre gränssnittstexter ligger efter koden (lösa trådar L20–L22), och det
rullande observationsfönstret monteras inte längre på någon sida (L23).

## /control-ombyggnad, 7 oktober 2026 kväll

Underlag: `random/control-inventering-2026-10-07.md` (varje knapp och flik, C1–C265),
`random/losa-tradar-2026-10-07.md` (19 ofärdiga kopplingar, inte åtgärdade) och
beslutsmatrisens rader 21–30.

Ändrat: delat tillstånd för Studio-sidorna ligger i `useStudioSession`
(`lab/components/studio-session.tsx`) med vakt mot osparade ändringar. Händelser →
klipp, Uppspelning och Guide & hjälp är egna sidor på sidmallen; val av dealer och
event följer med i adressen (`?dealer=&event=`), loggen i `sessionStorage` (högst 150 poster).
Dealers & klipp har tre flikar; Probe, Bakgrund och Uppspelning är länkar. Nio döda
Kevin-adresser ger 404. Sökattrappen och dubbla sparpiller är borta. Rotens startfiler
är borttagna; start sker med `node lab/start.mjs`.

Andra omgången: Händelser, Klippbibliotek och Talgranskning är egna sidor.
OpenClaw har flikarna Agentmodeller och Chatt (`?tab=chat`); `/control/operator-chat`
omdirigerar dit. Händelser har dealerchips, eventsök och eventlista i sidan, villkors-
biblioteket även för Astrid, idle som länk till Dealers & klipp och en rad om att
Vera, Amira och Mei inte används av spelet ännu (lös tråd L19). Valet av variant följer
med i adressen till Klippbibliotek. Mottaget steg från Uppspelning öppnas i Händelser
via `sessionStorage`. `lab/components/studio.tsx` och `StudioPage` är borttagna;
data laddas med `lab/app/control-studio-data.tsx`.

Testat: 942 labbtester (940 gröna, 2 skippade webbläsartester), typecheck, build,
systemkartan (gul, 0 röda), full regression lokalt utom `test/bugshot-report.mjs`
som kräver `jq` (finns i CI). Omskrivna tester gäller avsiktligt borttagen UI och listas
i commit-texten. Kvar: situationen från en videomapp följer inte med till Händelser.

## CI, 7 oktober 2026 kväll

`dealer-regression` föll två gånger när Ubuntus paketservrar var långsamma:
nedladdningen av PostgreSQL passerade QA-skriptets gräns, och `apt-get install ffmpeg jq`
hängde i 30 minuter. Tredje försöket blev grönt. De tre jobben i
`.github/workflows/croupier.yml` kör nu på `ubuntu-24.04` i stället för `ubuntu-latest`
(som byts till Ubuntu 26 från 19 oktober). Installationen hoppas över om verktyget finns,
har en egen gräns på 8 minuter och tre försök. Den isolerade SQL-acceptansen använder
runnerns PostgreSQL 16 om den finns och laddar annars ner som förut.
`.github/workflows/astrid-gpu-build.yml` (rad 15) och `astrid-gpu-publish.yml` (rad 21)
kör fortfarande `ubuntu-latest` och ska låsas till `ubuntu-24.04` före 19 oktober.
`croupier.yml` är redan låst.

## Kopplingar som saknas

Ytan kan finnas, men kopplingen saknas. Listan följer `random/losa-tradar-2026-10-07.md`.

- **L1** Lane-villkor för idle och kortutdelning skrivs inte in i operatörspaketet, och en ny porträttlane får ingen egen klippuppsättning. `lab/components/studio-administration.tsx`, `web/public/game-lanes.mjs`.
- **L2** Ingen sida anropar `publishPackage`, och spelmotorn läser inte `operator_packages`. `web/storage/operator-store.mjs`.
- **L3** Bolagets filtfärg, marker och kort stannar i minnet och publiceras inte till spelet. `lab/components/kevin-bo`.
- **L4** Probe i Talgranskning är ett textprov utan ljud eller video. Menyn och administrationens talflik är olika saker. `lab/components/probe-editor.tsx`.
- **L5** Team-vyns inbjudan, rollbyte och suspend skriver inte till servern. `lab/components/kevin-bo/views/team.jsx`.
- **L6** Klienten kastar 501 på POST `speech-qa` innan något anrop. `lab/components/studio-administration.tsx`.
- **L7** `POST /api/history` och `/bo`-ompekningarna i `web/server.mjs` är inte deployade på Render.
- **L10** Spelare, transaktioner och rapporter hämtas inte från spelmotorn. `lab/lib/partner-data.mjs`.
- **L11** Ingen rutt anropar `createOperator`, `upsertRole` eller `upsertMembership`. `web/storage/operator-store.mjs`.
- **L12** Operatörsskrivningar får ingen rad i `audit_events`. `ops/neon-studio/001-studio-metadata.sql`.
- **L13** Lobbyn saknar operatörskontext och profilen kan inte redigeras. `apps/croupier-frontend/app/play`.
- **L14** Rollen `partner` kan inte bjudas in eller återställa lösenord. `web/account-role.mjs`.
- **L15** En intern admin-cookie öppnar inte riktiga bolag, och det finns inget bolagsval. `lab/lib/partner-session.mjs`.
- **L16** Bakgrundszoner styr inte spelets bakgrund. `lab/components/lab-studio.tsx`.
- **L19** Varianter för Vera, Amira och Mei sparas men spelets urval använder dem inte. `web/presentation-api.mjs`.
- **L23** Det rullande observationsfönstret monteras inte; Uppspelning stannar vid 300 meddelanden eller 4 MiB. `lab/components/activity-log.tsx`.
- **L24** En skrivande rutt för operatörer måste skicka poolen med `connect()`; partnerdatan skickar bara `{ query }`. `lab/lib/partner-data.mjs`.

## Design, 7 oktober 2026

Johns designpaket (`Croupier-Studio-design`) är infört på nivå 1: sidomeny i fem
grupper (`lab/lib/scout-navigation.mjs`), nivåväxlare, lime/ink-tokens i
`lab/app/scout-theme.css`, ljust och mörkt läge (`theme-toggle.tsx`, sparas i
`localStorage` som `sg-theme`), och en gemensam sidmall (`page-template.tsx`) på
Dealers & klipp, Agentmodeller och Administration. Inloggningssidorna renderas
utan meny. Bakgrundszoner och Händelser ligger under Studio. Administrationen har
ett menyval tills sidan får flikar. Medlemskap i partnerportalen renderas från
`kevin-bo/views/team.jsx`; verkligt läge är läsbart, utkast finns bara i
förhandsvisningen. Testat: 919 labbtester gröna lokalt (två ffprobe-tester
kräver ffmpeg och körs i CI), typecheck, build. Kvar: filterchips i klipplistan,
dold `<select>` bakom dealerchipsen, sektionsankare i administrationen,
"Spara alla" som riktig batch. Beslutsunderlag: `random/beslutsmatris-2026-10-07.md`.
Jakobs regel 7 okt: repots logik är facit, John styr design, Kevins nivå 2
anpassas till repot och inte tvärtom.

## Konton, 7 oktober 2026

Agentkontot `LLM` (roll `admin`, `croupier_auth.users` id 5) skapades på Jakobs
begäran med samma villkor som hans dg97-konto, så att agenten kan granska `/control`
inloggad. Lösenordet är Jakobs, inte i Git. Nivå 1-inbjudningar till Kevin
(`kevin.negash@scoutgaminggroup.com`) och Emil (`emilmattsson@yahoo.se`) skickades
via `POST /studio/api/admin/users/invite` med `emailSent: true`. GitHub-inbjudningar
med skrivrätt: `EmaCodeHero`, Kevins och Johns e-post; grenarna `kevin`, `emil`,
`john` finns, och `main` kräver PR för alla utom repo-admin. Teamets inbox är
GitHub Issues med etiketten `inbox` (`inbox/README.md`, `tools/inbox.mjs`); de
första beslutsärendena är #2 till John och #3 till Kevin.

## Namn, 7 oktober 2026

Denna dokumentpassning samlar personalens gränssnitt under `/control`:
`/control/clips`, `/control/administration`, `/control/tree`, `/control/videos`,
`/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`,
`/control/events`, `/control/probe` och `/control/operator-chat`.
Kevins importerade backoffice (`lab/components/kevin-bo`) ligger kvar på
`/partner` och `/partner/{operatorSlug}`. Det är inte kontrollpanelen.
`/studio` är labb-servicens basePath, inte en fjärde produkt och inte namnet i gränssnittet.
Spelarytan är `/play`, `/play/profil`, `/play/historik` och `/play/blackjack`.
`174f893` är pushad till `main`. Gamla `/bo`, `/bo/login.html` och `/bo/set-password.html` svarar 308 till `/control/administration`, `/control/login` och `/control/set-password`. `/api/bo` är kvar som inloggningsbrygga.
Inget öppet acceptanskrav nedan markeras klart av den här passningen.
Äldre meningar som kallar `/studio` för produktionsverktyget är 6-oktoberhistorik.

## Spelaryta, 7 oktober 2026

`/play` är Spellobby, `/play/profil` egen profil och `/play/historik` egen historik,
alla i `apps/croupier-frontend` ovanpå befintliga `GET /api/auth/session` och
`POST /api/player` via ingress-headers. Utan session går profil och historik till
`/player-login?returnTo=…`; lobbyn visar inloggningsknapp. Historiksidan anropar
`POST /api/history` för egna aggregerade resultat. `/api/v1/history` är
partner-API. Spelmotor och signerad direktstart är oförändrade.
Testat före resultatrutten: `apps/croupier-frontend/test/player-area.mjs` 6, `platform-ui` 13,
`game-entry` 12, `tsc --noEmit` grön. Tomt resultat betyder inga avslutade rundor, inte en saknad rutt.

## Spelaryta, 8 oktober 2026

`/play/profil` har ett formulär för visningsnamn (2–40 tecken, inga styrtecken) och språk (`sv`/`en`).
`PATCH /api/profile` skriver bara `display_name` och `locale` på den inloggade spelaren.
Saldo och valuta är text. Produktions-Neon saknar kolumnerna tills Jakob kör
`ops/neon-game/006-player-profile.sql` mot speldatabasen (`croupier_game`, inte zones).
Då visar profilsidan "Inte tillgängligt än". Lokal SQLite får kolumnerna vid start.
Lobbyn visar "Spelar hos" från `?operator=` eller `localStorage['croupier.operator']`
via `GET /api/operators/<slug>` (`{slug, name}`, aktiv, cache 60 s). Utan Studio-pool
gäller fixturen, bland annat `sg-test`. Länken Spela Blackjack bär `?operator=` till
`/play/blackjack`; L8:s `approvedGameQuery` behåller den.
Testat här: `player-area`, `player-profile`, `platform-ui`, `game-entry`, `player-profile-api`, `public-operators`, `game-entry-contract`, `tsc --noEmit`, `fuzz-blackjack` 3000 rundor.
Ingen commit i den här passningen.

## Partnerportal, 7 oktober 2026 (historik; N1-åtkomsten ersatt av N2-leveransen 11 oktober)

Nivå 2-skalet kan visa intern fixtur (`preview: true`) och riktig operatörsdata
(`preview: false`). Parallella filer i samma pass:
`ops/neon-studio/005-operators.sql`, `web/storage/operator-store.mjs`,
`lab/lib/partner-session.mjs`, `lab/lib/partner-data.mjs`,
`lab/app/partner/login` och `lab/app/api/partner`.

Gräns: `partner_session` är en egen cookie med eget syfte. En intern admin-cookie
öppnar inte partnerdata, och partner-cookien öppnar inte `/control`. Medlemskap
ger bara den egna operatörens data; annan operatör eller avstängt medlemskap ger
403, okänd slug 404. Spelare, transaktioner och rapporter är tomma med `notConnected`.
`/partner` utan session går till `/partner/login`. Interna admins ser fortfarande
fixturförhandsvisningen med Partnerportal-rubrik och login-länk.

Testat: `npm --prefix lab test` 909 pass (två ffprobe-tester kräver ffmpeg lokalt),
`npm --prefix lab run typecheck`, `test/operator-store.mjs`, `test/partner-access-policy.mjs`,
`test/studio-migrations.mjs`, `test/speech-ledger-import.mjs` 40 pass,
`docs/system-map/verify.mjs --check` 0 fel. Ingen riktig Postgres-körning här;
`tools/studio-isolated-qa.mjs` hashar nu `005-operators.sql` och körs i CI.

Drift: runtime kräver exakt migration 001–005. Kör `005-operators.sql` mot
produktions-Neon före deploy, annars svarar Studio-admin `unavailable`.
Kvar: operatörs-onboarding-UI, åtkomstjournal för operatörsskrivningar
(`audit_events` tar bara dokument/media), spelardata, transaktioner, rapporter.
Inget krav i T2–T4 är markerat klart.

## Systemkarta, 7 oktober 2026

Kartan beskriver nivå 1 `/control`, nivå 2 `/partner` och nivå 3 `/play`.
En Next-rutt som läggs till eller flyttas utan `routes.json` ger route-drift och CI-fel.
Kontraktens filhasher är prefixade. Inget acceptanskrav markeras klart.

## Aktuell leverans och ansvar

- GitHub: Jakeminator123/scoutgaming, main, repo-ID 1380630440. Gamla
  github-work-adressen vidarebefordras. Återskapa inte namnet.
- Ett Vercelprojekt: scoutgaming, prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD.
  Services bygger web från apps/croupier-frontend och studio från lab, båda fra1.
  Node-middleware och rotens request.path-regler för /control och /partner krävs.
- Render äger spelmotor/live/sessionauktoritet. Vercel visar UI och kör native
  Studio/admin-API; Neon håller policy/metadata/journaler, privat Blob medier.
- www.scoutgaming.tech är huvudadress. scoutgaming.tech och det gamla
  croupier-frontend.vercel.app ger 308. croupier-lab-ui.vercel.app behålls som
  kompatibilitetsalias. Det gamla frontendprojektet är en domänlös reserv med
  autobyggen och domäntilldelning av; det är inte markerat paused. QA består.
- Infrastrukturens tidigare verifierade leverans: 4ed55a56, Vercel
  dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP READY, fullhook och CI37451320053 tre success.
  Läsande HTTP/static-prov och befintlig adminsession verifierade. Inga riktiga
  konto-/spel-/DB-skrivningar. Privat scoutgaming-delivery-final-read.json.

## Tre nivåer: denna ändring

Samordnat med chatten **Hämta Croupier från Kevins branch**, som släppt sina
filanspråk. /control är intern Kontrollpanel, /partner/{operatorSlug} är
Partnerportal och /play är Spelaryta med /play/blackjack. Fliken heter Administration.

Efter Jakobs förtydligande är nivå 1 en gemensam ScoutGamingGroup-adminyta:
/control visar verkliga verktygsingångar, inte Kevins parallella exempelpaneler.
Klipp/tal/media/konton-länkar leder till befintlig Studio med samma huvudmeny.
Oanslutna gamla exempelvyer visar en förklaring; de låtsas inte vara färdiga
produktionsverktyg. Kevin-komponenten renderas på /partner, inte /control.
Nivå 2 använder läsbara menyadresser och popstate. Gamla hashbokmärken fungerar.
Nivå 2:s lane-/designnotiser skiljer lokala marker/kort/bordsprov från faktisk
spelpublicering. Lokala designutkast kan fortfarande granskas i provbordet.
Operatörs-/administratörsbyte och authfel tömmer vyn; inga gamla utkast får
visas för en ny identitet. Klipp, masker, urvalsregler och publicering är interna.

/play/blackjack använder befintlig
sessionskontroll, sparad lane och spel-HTML. Äldre molnadresser går vidare;
giltig launch går genom samma signerade serverhantering och game-audience.
Spelmotor, media, sessionsformat och kunddatabas ändras inte.

Guide, ordlista och systembeskrivning förenar PDF-underlaget med aktuell kod.
Namn på ansvar är inte nya tjänster eller nya scheman. Privata random-förslag
ersätts med en pekare till aktiva dokument; originaltexter och PDF-kopior bevaras.
Den redundanta gamla agentbeställningen tas bort efter extern hashverifierad
backup i C:/Users/jakem/CroupierBackups/terminology-docs-20261006.

Lokalt verifierat: 43 riktade tester, båda typkontrollerna, båda produktionsbyggena
och full regression PASS. Isolerad webbläsare verifierar marker-notis, valt tema
i provbordet, bakåtknapp med bevarat utkast, operatörsbyte med bekräftelse,
omladdning med rätt lane, gamla hash-länkar och historik till annan operatör.
Den korta /administration går vidare till /studio/administration efter observerad
404 på den förstnämnda. Privat provkatalog: lab/data/platform-private/terminology-update.
Testservern och provfliken är stängda. Leverans a72c4bf1 är verifierad på
Vercel dpl_CMCcHtRDDDHxByk3VMRZw8ewtx2k, READY på exakt SHA, och
CI37462222613 har tre successjobb. Samordnaren verifierade 14 läsande
HTTP-prov, åtta JS/CSS-resurser och befintlig jakob-session: /control till
verklig Administration och klippverktyg, gamla #gen till förklaring samt
separat partnerförhandsvisning. Utloggade dokument går till login och
admin-/partner-API ger 401. Inga riktiga konto-/spel-/policy-/provider-skrivningar.
Privata kvitton: terminology-update/live-delivery.json och production-read.json.
Kompletteringen för en gemensam nivå 1 har dessutom 29 riktade tester,
ny Lab-typkontroll och nytt Lab-produktionsbygge PASS. Den behåller samma
färska adminauktorisering, lämnar partnerns data och utkast oförändrade och
skickar inga exempeloperatörsdata till den nya interna ingången.

## Nästa arbete och viktiga gränser

**Övertagande och stoppunkt, 6 oktober:** denna chatt tar över efter
**Hämta Croupier från Kevins branch**. Jakob skickar själv de två
personalinbjudningarna. Inga nya utskick/konton görs av agenten. Intern admin
når nivå 1, 2 och 3 med samma konto; nivå 2 var redan adminauktoriserad men
saknades i inbjudningstexten. Formulär, mejl och båda guiderna är nu samstämmiga.
`/partner` är en separat ingång med explicit val av demonstration, inte ett
automatiskt exempelbolag. Adminens val bland riktiga operatörer är
ännu inte aktiverat. Operatörens egen inloggning står i Partnerportal.
Riktiga kunder ska komma från verifierade organisationsanslutningar, inte namn
eller API-nycklar.
Gamla giltiga hashbokmärken och befintliga demo-adresser behålls.

Den avgränsade leveransen avslutar navigation/åtkomstinformation och
dokumentationsstädning. De öppna A–I-punkterna
är acceptans/driftarbete, inte ett påstående om att allt är produktionsklart.
Lokalt verifierat: 90 riktade UI-, serverrutt-, auth- och mejltester, Lab-
typkontroll och produktionsbygge PASS. Kod 4df5e74a och etikettkomplettering
ec060e73 är pushade; fullhook gav 1626 PASS/9 skip/0 fail vid båda kodcommits.
Vercel dpl_7vDDEzyvkN9ZLjqnyEhoKZHtF2Ny är READY på exakt ec060e73 med
produktionsalias, och CI37496945897 har tre successjobb. Sex läsande HTTP-prov
på första leveransen bekräftar login/401 utan inloggning. Befintlig adminsession
verifierade Kontrollpanel → nivå 2-ingång → Demo South → intern Administration.
Efter senaste publiceringen är även behörighetsvalets etikett verifierad live:
Administratör – nivå 1, 2 och 3. Det befintliga UI-provet bevakar denna etikett.
Privata loggar ligger under `lab/data/platform-private/level-two-takeover-*`.
Inga produktservrar har startats och agenten har inte skrivit konton, policy
eller riktig databas. Inga extra grenar, worktrees eller nya rapportfiler behövs.

Resend återlästes separat den 6 oktober: Johns verkliga inbjudan har **Bounced**
med **Recipient not found**, och mottagaradressen har lagts på suppression-listan.
Kontot väntar på aktivering. Rätt mottagaradress behöver bekräftas innan nytt
utskick; spärren har inte tagits bort. Ett mejl till Jakobs dg97-adress visas som
**Delivered** och det kontot som aktiverat. Det bevisar inte leverans till den
tidigare begärda Gmail-adressen, inte heller mottagarens faktiska inkorg eller
resetflöde. Exakta adresser och provider-ID finns endast i det privata kvittot
`level-two-takeover-delivery.json`. Jakob äger fortsatt utskicken och F:s
mottagaracceptans; denna agent har inte skickat något mejl.

**Personalinbjudningar, första leveransen 6 oktober:** samordnad fortsättning
efter a72c4bf1; åtkomsttexten har därefter kompletterats enligt övertagandet ovan.
Resend-adaptern skickar nu ScoutGamingGroup-mejl i text och HTML med
aktiveringsknapp, e-postadress och giltighetstid. Formuläret anger intern
adminpersonal, nivå 1, med åtkomst till hela nivå 1 och nivå 3 via samma konto
och lösenord. Befintlig serverauktorisering, kontokollisionskontroll,
transaktion och engångstoken används; spelarroller får ingen admintext eller
ny behörighet. Ingen lösenordsändring görs för mottagarna. Riktade mail-,
auth- och UI-tester samt Lab-typkontroll PASS. Kodleverans 6f32a58b är pushad;
full regression gav 1623 PASS, 9 skip och 0 fail. Vercel
dpl_B4kWYUVrsVa5aNmKGxiieQzoUu3s är READY på exakt kod-SHA med
www.scoutgaming.tech som produktionsalias. Befintlig adminsession har läst
den publicerade kontofliken/formuläret: tydlig nivå 1+3, endast adminval och
72-timmars aktivering. Inga konton eller tokens har skapats vid detta prov.
CI37462924847 är komplett med success i alla tre jobb.
De begärda verkliga utskicken
och mottagarnas aktivering/inkorg behöver eget leveransbevis enligt punkt F;
lokala testkonton bevisar inte mottagarnas aktivering.

Den enda arbetslistan är [CLOUD-MIGRATION](CLOUD-MIGRATION.md): T2–T4 för
verklig partneranslutning/lobby, A–I för övrig användar- och driftacceptans.
Pågående uppdrag är inte ett generellt mandat till nya migreringar eller betalda prov.

Resend är konfigurerat i produktion med domänbegränsad sändnyckel och
no-reply@scoutgaming.tech. Native invite/reset är Delivered till Resends
sandbox på 184fe66b; riktigt konto/token/aktivering/reset/inkorg återstår (F).
Den tomma extra Marketplace-installationen är borttagen, fungerande konto och
QA bevarade. Privat resend-setup-20261006.json. Äldre uppgift om tom nyckel är ersatt.

Regionprovet på samma 019dba6d flyttade Studio iad1→fra1: första
Studio→Administration 7,879→3,041 s, varm overview 1,595→0,328 s utan Neonuppgradering.
Färsk auth och anropsminskning består; första-/proxyväntan är inte fullförklarad (B).
Ingen generell latensgaranti. Båda Services använder nu fra1.

GG: senast läst workspace795524/source30689542, 12 TRIGGERED/5 IGNORED,
en incidentsida och 17 locationsidor; fil/rad partiell, sex öppna positionsluckor.
GitHub checks läses på fryst leverans-SHA; queued suite/inga runs bevisar
ingen incidentfrihet. Läs bara säker metadata via befintlig read-only-brygga,
inga secrets/annotationsmeddelanden, inga automatiska ignore/resolve.
Triagestatus och nästa krav finns i G; historiska fixtureklassningar är inte
nya bevis för incidenter utan positioner.

### Läsutredda drift- och backuprester — fortfarande öppna

Frame-varningen i `web/public/local-film-player.mjs:17` använder samma text
för saknad playing/presented/ended. Historiska goodluckprov är inte belägg
för ursprungligt idlefel. Behåll rVFC-spärren; nästa diagnos kräver terminal-
flaggor, readyState/currentTime/duration/visibility och exakt media-ID/SHA.
Zoner är editorlagring (lokala utkast+molnkoordinater+privataBlobklipp), inte
spelstyrning. Befintlig CAS/dimension/hash/Range/partialuploadkontroll saknar
full isolerad zonroundtrip/restartacceptans. Tidigare 88medieURLprov inkluderar
inte reference-poster. Startsideskoden byter SSRhero till annan layout och
asynkront intro; möjlig flimmermekanism kräver bildserie/layoutshift/laddnings-
tider inklusive mobile/reduced-motion före riktad fix.

Backupagenten återläste de uttryckligt angivna metadatafilerna utan bred
backup-/personarkivsökning. Extern produktbackupkvitto matchar dokumenterad
SHA256, 206filer/10mappar/125745905bytes och verifierade hash-/arkiv-/inventory-
flaggor. Gamebackupmanifest finns; tidigare32Postgrestabellers återläsning är
dokumentation, ingen ny DBkontroll. Privat OpenClawenhetsfil finns men är inte
fullbackup. Director `/data/catalog` och Gateway `/data/openclaw` saknar angivet
externt fullsnapshot/återläsningskvitto. Exportåtkomst har inte prövats. Kräv
faktiskt frysta/stoppade skrivare, fullsnapshot, externmanifest/hash och
SQLite integrity/FK/WAL enligt `ENVIRONMENT-RESTORATION.md:74`; maintenanceMode
eller quiesced-markör ensam bevisar inte writerdrain. Inga drift-/DB-/provider-
åtgärder, restore eller nya servertester gjordes i dessa läsutredningar.


## Acceptans som består

Isolerad SQL/HTTPS-fixtur är rättad och verkligt provad i CI; gamla FAIL sparas.
Game-persistence/concurrency är separat och saknar sitt isolerade prov.
Full P6, mänsklig läppsynk/kortkontakt, fysisk mic/kamera/mobil/Safari,
zonroundtrip, startsidesflimmer och externa Director/Gatewaybackups återstår.
Upload-problemet med kortflipp_kling_1080p.mp4 är öppet under H; ingen ny
produktmedia har aktiverats här. Se systembeskrivningen för aktuell arkitektur.

## Lanes och faktisk medierensning

Mobile Phone Lane är sparat förval. Versionerade lane-definitioner har ID/namn/
renderer/dealer/mediesamling i `gameLanes`/`gameLane`. Saknat/äldre `original`
migreras vid läsning till Mobile; HTML binds till serverns val och gamla queryparametrar
kan inte återaktivera Kevin. `web/public/card-presentation` ersätter `kevin-cards`;
kortgrund, källproveniens och kalibrering består.

Admin create/remove är revisionsstyrda. Aktiv lane kräver ersättare eller `null`
för sista lane; då stoppas ny Blackjack-start tills lane läggs till. Nya porträttlanes
delar Astrids bank/policy. Ny renderer/mediebank behöver adapter/verifierad media;
fria URL:er nekas. Lane-borttagning raderar inte delade medier.
Separat lane-publicering, nya dealers/spel och granskad svarskatalog är inte därmed byggda.

| Utförd åtgärd | Exakt omfattning / slutbevis |
| --- | --- |
| Lokal source/staging-rensning | 2 410 binära filer, 2 133 120 568 byte; faktiska hashar/säkra paths kontrollerade |
| Motsvarande Blob-rensning | 2 313 objekt, 2 131 771 483 byte efter `8f265831` LIVE/READY; komplett paginerad efterlista |
| Lokal deduplicering | 64 byteidentiska kopior, 14 216 404 byte; kvar 2 450 fysiska filer/764 115 959 byte |
| Blob-deduplicering | 58 objekt, 12 787 392 byte efter produkt `ebbbeb76`/QA `ee060804` och exakt medieläsarekvivalens |
| Slutlista Blob | 1 800 objekt/769 901 848 byte; just målen saknas, alla andra gamla paths/storlekar oförändrade |
| Bevarade publika adresser | 88 GET200/fullhash/storlek PASS: 44 produktion + 44 QA; dessutom 62 huvudobjekt HEAD/full SHA PASS |

Alla 2 514 logiska poster/ID/hashar/URL/åtkomstgränser består. Layout v1:s
`canonicalPath` pekar direkt på registrerad huvudkopia med samma hash/storlek/ändelse.
Mobile-media, zonreferens, kortbild, runtime/kod/kalibrering, uploadfiler, GPU-resultat,
speechreferenser, journaler och övriga objekt består. Produktion/QA delar Blob;
deras Studio-dokument/historik/mediarecords/speechreferenser och produktzoner
lästes före radering. Ingen ny visuell approval och ingen omskriven Git-historik.

Privata underlag i `lab/data/lane-media-audit/`:
`blob-purge-receipt.json`, `blob-after-purge.json`, `kept-readback.json`,
`dedup-cloud-purge-receipt.json`, `dedup-blob-after.json`,
`dedup-http-verification.json`, plan och lokalkvitto.
35 dedup-prov, hela fysiska bankens hashar och fyra dealer-sync `--probe` PASS.
Lane/CRUD/kort/policy/startprov och TypeScript PASS; äldre fullhook 1 418 PASS/9 skip.
Kontrollens privata cachekopior är hashkontrollerat borttagna; receipts består.

## Produktionsimport, avveckling och återställning

P7 är utförd på b0bc efter fryst export, oberoende admission och faktisk ALL0-drain.
Underhåll `dep-db16rv0u01pc73d442p0` var LIVE/childless: inga barn/skrivare/providers.
RunPod var tillfälligt Max 0/Active 0/FlashBoot OFF och alla sex workerfält/båda jobbfält 0.
Efter import återställdes Max 1/Active 0/FlashBoot ON före provideraktivering.
Gemensam Neon-policy är aktiv; produktens tre tal-/streamflaggor ON, kamera ON.
QA är kvar OFF. Aktiveringen är inte en generell kostnads-/mänsklig acceptans.

Studio 001–004, tre dokument, talhistorik, 18 aktiva och sex retained-mediaposter
är importerade. Sex original (8 262 169 byte) återfanns i `365f283b` och
fullhashades privat; liknande filnamn/familj får aldrig automappas till nya bytes.
Production/version1 fullfilspolicy adopterades via ett additivt INSERT;
numeriska tak/historik/reservationer ändrades inte.
Paritet PASS: 32 skyddade konto-/speltabeller, elva kostnadstabeller och exakta
dokument/media. Alla 17 alias återlästes med historiska mål/domäninställningar/SSO bevarade.
Den avslutade importen körs inte om; nya läskvitton får inte skriva om originaltider.

P8:s slutkod `9ba2fd05`/CI `37222438373` tre success verifierade diskfri drift.
Produktdisk DELETE204/GET404/`service.disk` saknas; tolv äldre Blobalias borta,
gamla-lista0/ersättningar12 och noll gamla Neon-dokument-/historikreferenser.
Explicit restart200: faktisk ny process, 160 rätta källhashar, åtta avvecklade
runtimefiler, AI3/Neon ON/health200 och ingen `/var/data`/persistent produktmount.
TLS `verify-full` bevarades; 51 övriga produkt-envvärden kontrollerades oförändrade.
Parent-env var direkt oläsbar efter UID-byte (EACCES); barnprocess/källa och
stabila deploy-/envavläsningar ger bindningen, inte en påstådd direkt parentläsning.

Privat `C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`:
206 filer/10 mappar/125 745 905 källbyte; full inventering, oförändrad källmetadata,
arkivläsbarhet och remote/lokal/arkivhash PASS. Behåll backupen efter avveckling.
Befintliga privata P8-journal/kvitton: diskfri `6cf5030f…`, data/HTTP `4615366b…`,
postdelete `bf582b0b…`; fulla pinnar finns i snapshotens importförlopp.

| Verifierat privat kvitto | SHA256 |
| --- | --- |
| P7 admission | `77eccc3a1ca99bca328f2abec8e11d4d37ec62b3797a2a7b25aea1c616b751c1` |
| Cloudplan | `25fe34d42251b1f57de6ff0ae7505459c0448c6d0ba500646aa7281a9115c59d` |
| BEFORE | `0555b7988d5f686d4b918a966bd82d1865a9a83d22c805a076e6f46df648ccb2` |
| Importplan | `94a458599f0c77ca8aaf468feccf4cc7d5e1e050f2f31662be8740796cde7442` |
| Avslutad import | `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d` |
| Full diskbackup | `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9` |

Återställning är en samordnad återgång, aldrig en andra writer eller automatisk fallback.
Frys alla skrivare, bevara senaste Neon/ledger separat och verifiera rätt scope,
schema/checksummor, aktuell paritet, media och rollbackpunkt före operation.
Gamla SQLite-/diskbytes får inte aktiveras efter nya Neon-skrivningar utan datatillbakaföring.
Gamebackup: `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`
(24 källtabeller/102 rader; 32 Postgrestabeller med rad-/sekvensparitet).
Labbbackup: `C:/Users/jakem/CroupierBackups/lab-consolidation-20261002`;
lokal syskonstädning: `C:/Users/jakem/CroupierBackups/local-project-cleanup-20261004T210828Z`
(214 bevarade filer, två verifierade Gitbundlar, workercommits kvar).
Återställningsprocedurer: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
QA-, Director-/Gatewaydiskar är aktiva/bevarade, inte P8-mål; extern Director/
Gatewaybackup är fortfarande separat kvarvarande ansvar.

## P6: delbevis, numeriska skydd och kvarvarande acceptans

### Verifierade delbevis — inte full P6

Historiskt native90/90 på `190399386d93a02882d9b18a5ce5af53bb91fe23`:
alla fyra dealers, två avkodade/hörbara/avslutade plays, samma sparade Neonrevision,
CAS/utkast/privata medier/native administration utan iframe. Projekt/pit återställda
med identiska hashar; browser/route-drain städade; inga mejl/betalda anrop.
Privat `lab/data/platform-private/native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
SHA `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
Åtta layoutbildrutor godkänner inte läppsynk. Äldre FAIL-kvitton består.

På `e461ef073b63b2d1c937454bbfa31289774fcb8f`: 80/80 authkontroller över
68 HTTPS-anrop, 22/22 verkliga login-/städ-/källkontroller och 27 städgrupper PASS.
Admin når spel/Studio/BO, spelare nekas Studio, reader/staff-reset behåller game-only,
lösenord/epoch återkallar gamla sessioner, saldo/historik/paritet består.
Pending provider-cancellation är inte liveprovat av detta authprov.
Privat `p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/` och
`p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`
under `lab/data/platform-private/`; egna fixtures borttagna.
Greeting-rehearsal på e461 har matching clip/återaktiverade tvåspelskontroller,
men saknar explicit ended-räknare/nya hashbevis/ny mänsklig approval:
`p6-browser-evidence-e461ef07/receipt.json`.

Faktisk isolerad SQL/HTTPS/restart: 41 grupper, fyra retained-guards och 46
oförändrade källhashar PASS. Täcker CAS/rollback/token/epoch/roller, signerad
actor/scope, walletnonce utan dubbelkreditering, journalimport och kostnads-/QA-rollback,
review exakt talpar/revision/roll, privat media, lokal mailpreview och kortsekretess.
Fixturer/processer städade, inga riktiga konton/molndatabaser/mejl/betalda jobb.

Fullfil `generated-bd1123e6caec51e8a232036547b0f8fc` fick Director/SDK-svar,
Cartesia-ljud och färdigt RunPod-paket. Två game-queue/audio-ended härledda plays;
per-play synliga frame-/ownerobservationer hann inte sparas och är okända.
Privat `verify-final-qa/fullfile-two-play-derived-attestation-8712e00b.json`.
cc77-run `75eaf797-9342-4e2c-8995-f3c759fade75`: 6 562 941 streambyte,
synlig bild, hörbart ljud, faktisk spelkö-END/completed SQL-request och browsercleanup.
Efter END avlästes provider HTTP200 CANCELLED, terminal/released/lease0/uncertain0/OFF.
Det är avslutad speluppspelning enligt Jakobs krav, inte ett naturligt provider-
COMPLETED-kvitto. Exakt tid för providertransition saknas; b0bc:s naturliga COMPLETED
är bara lokalt testat. Sammansatt snäv P7-admission återanvänder dessa delbevis och
oförändrade godkända e461-playbackbytes; full P6 och nya take-approvals förblir öppna.

QA:s äldre närvarogap består: `player_probe_sessions` 17→15 på a0 och 19→18
vid 42→37-övergången. Övriga 31 kontotabeller matchar; 24h TTL är möjlig orsak,
men tidigare radmetadata saknas. Original FALSE/compose=false skrivs inte om.
Senare aktuella 10/10-bevarandekvitton gör inte dessa äldre jämförelser full-PASS.

### Budget och framtida prov

Exakta Cartesia-/counting-priser är backlog enligt Jakob. Avgränsade funktionstester
kan använda dokumenterat okänd USD/null och mätt usage inom ursprunglig numerisk
budget/reservation/dispatchauktoritet. Detta är inget nollpris, verifierad faktura,
extra testfönster eller generell produktionskostnadsapproval.
Upprepa ingen prisinventering utan nytt konto-/tariffunderlag; extern Cartesia-
nyckelägare saknar tillgänglig egen kontoinloggning. Privat `p6-cost-evidence-20261004.json`.

Originalkampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`, totaltak 10 USD inklusive
alla försök, budgetankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historiskt reservation 5,251152/oreserverat 4,748848 USD; inget refund/reset.
Jakob höjde testtaket från två till sex genereringar totalt, inte per omstart.
Senaste closed39: usage 4 generationer/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null,
head `8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Två av sex generationer var kvar; detta är inte ny färsk dispatchauktoritet.
Den gamla reservationspolicyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Återläs faktisk journal före nytt prov; förbrukat/pending/uncertain är aldrig ”nytt”.

Fullfilsadmission kräver explicit belopp/policy före TTS/GPU; stream/fullfil delar
UTC-dygnssumma. Originalets 12 min/krav 8 min kvar, klientdeadline 300 s och separat
RunPod-TTL 180 s får inte förlängas tyst. Utgångna fönster återöppnas inte.
Successor är append-only med föregående journalhash; inga automatiska retries,
budgetrefunds eller nytt providerjobb vid reconnect. Gamla FAIL/manifest/tider bevaras.
SDK-import/prepare-only/router404/WS-binary/deterministisk baseline är inte acceptans.

Nytt liveprov kräver aktuell källa/Gitblobs, immutable basimage, färska worker/router/
entry-manifest, faktisk SDK 7.12.1/readback och separata Render/Web-child/SDK-envbindningar.
Exakt serverägd session/runda/sparad Neonpolicy, request/job/mediahashar och ägargates
måste avse samma körning. Tre cookieägda kontroller före connect/play/efter END;
en produktspelare/WS/video genom posegrind/talkö, presenterade frames/hörbart ljud
och två verkliga playback-ACK. `decoded-product-game-queue`, faktisk integration/
laddad källa och cleanup/cancel/terminal/drain krävs; inga ersättningswrappers.
Full P6 omfattar också text/bild/STT, fullfil/stream, SQL/HTTPS/restart, auth/revoke
och verklig invitation/reset där de återstår. `fullP6Passed` får inte sättas true tidigt.


## Historik (daterade lägesbilder)

Flyttade meningar som motsade nuläget 7 oktober 2026. De är inte raderade.
Kvitton, acceptans, P6, medieregler och privata sökvägar står kvar ovan.

### 7 oktober 2026 — Spelaryta-avsnittet, före resultatrutten i arbetskopian

Ersatt samma dag när historiksidan kopplades till `POST /api/history`. T4 är inte klar.

Historiken är ärligt tom: `readPlayerResults` saknar publik spelarrutt och `/api/v1/history` är partner-API. Ingen ändring i `web/`, spelmotor eller signerad direktstart. Kvar: resultatrutt för spelaren.

### 7 oktober 2026 — Namn-avsnittet, före Spelaryta och Partnerportal samma dag

Ersatt 7 oktober av Spelaryta- och Partnerportal-avsnitten.

Lobby, profil, historik, riktig operatörsinloggning och tenantdata är inte klara.

### 6 oktober 2026 — Tre nivåer: denna ändring

Ersatt 7 oktober av Namn-avsnittet (`/studio` är basePath, inte produktionsverktygets namn). Fliken heter fortfarande Administration.

Intern Studio på /studio är kvar som verkligt produktionsverktyg; fliken heter Administration.

Ersatt 7 oktober av Partnerportal-avsnittet (`partner_session` är en egen cookie; intern admin-cookie öppnar inte partnerdata).

Servern kontrollerar fortsatt intern admin på varje dokument/API-läsning.

Ersatt 7 oktober av Spelaryta-avsnittet (`/play` är Spellobby, med profil och historik).

/play är en enkel Blackjack-ingång.

Ersatt 7 oktober av Partnerportal- och Spelaryta-avsnitten.

Full partner-session/medlemskap/organisationslagring, publicerat operatörspaket,
kundavgränsad sparning samt spelarprofil/historik är fortfarande öppna T2–T4.
Den separata policyn web/partner-access-policy.mjs från cb2673c6 är fortsatt
bara policy; ingen runtime/DB använder den som verklig partnerinloggning.

### 6 oktober 2026 — Övertagande och stoppunkt

Ersatt 7 oktober av Partnerportal-avsnittet (medlemslagring och `partner_session` finns; lane-publicering och operatörsbunden lobby är kvar i T2–T4).

T2–T4 kvarstår för verkligt kundregister, kundpersonal, medlemskap, lane-publicering och operatörsbunden lobby.

Ersatt 7 oktober av en snävare mening i Övertagande: adminens val bland riktiga operatörer är kvar; operatörens inloggning står i Partnerportal.

Kundval är ännu inte aktiverat.

</details>
