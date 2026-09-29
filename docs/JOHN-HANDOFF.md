## 2026-09-29 — Separat Vercel-startsida i produktion

Det privata GitHub-repot `Jakeminator123/modern-landing-page` heter nu
[`Jakeminator123/croupier-frontend`](https://github.com/Jakeminator123/croupier-frontend).
Dess `main` har squash-commit `2ec2b3f2f7ea11c57f703f58a8fecdb540e5649c`
från [PR #3](https://github.com/Jakeminator123/croupier-frontend/pull/3).
Vercel-projektet behåller sitt nuvarande namn och sin befintliga adress
[`modern-landing-page-kohl-xi.vercel.app`](https://modern-landing-page-kohl-xi.vercel.app/);
Production-deployen `dpl_FEejL6HEG51SwSiNVsdkYntLstKW` var READY och
`/demo` kontrollerades i browser. Sidan länkar till riktiga
`https://croupier-v2.onrender.com/blackjack?dealer=astrid`; den tidigare
klientsidiga låtsasrundan har tagits bort. Obekräftade licens-, KYC- och
walletpåståenden samt döda `#`-länkar har rensats. TypeScript och
produktionsbygget passerade.

Detta är en publicerad startsida med övergång till Render-spelet, inte en
Vercel-hostad spelklient. Croupiers äldre `github-work-vercel-entry` är kvar.
Serverns kort, sko, saldo och utbetalningar ligger fortsatt på Render. Före
spelklientens Vercel-byte krävs en isolerad Render-testbackend och proven i
[`VERCEL-FRONTEND-MIGRATION.md`](VERCEL-FRONTEND-MIGRATION.md). Pågående lokala
medieändringar i `emil/dealklipp-v1` är inte del av frontendleveransen.

## 2026-09-29 — Snävare blinkzon och redigerbar pixelruta

Efter Jakobs prov av `light-2` syntes den generiska glöden över för mycket
vägg. Zonpanelen har nu X, Y, bredd och höjd med validerad Spara pixelruta.
Storleksändring bevarar föregående zonklipp i browserns IndexedDB för
nedladdning, men döljer det tills ett nytt klipp med rätt pixelmått skapas
eller importeras. Blinkgeneratorns radialljus skalas elliptiskt efter zonens
bredd och höjd. För vänstra bakgrundslampan rekommenderas en snäv provruta
kring ungefär x 130–288 och y 304–325 på 1080×1920-bilden; hela effekten
behöver granskas mot faktiska dealfilmer. I Jakobs öppna Labprofil justerades
`light-2` till x 130, y 304, 158×22 px, ett nytt smalt blinkklipp skapades,
och Automatisk valdes. Prov med Astrid box0 standard gav 1080×1920-underlag;
den justerade lampplaceringen behöver fortfarande godkännas visuellt av Jakob.
Ingen spelarkod eller originalmedia ändrades. Den lägre box0-varianten kunde
inte visas under provet eftersom dess lokala fil och manifest ändrades av
parallellt mediaarbete; den användes inte som visuellt godkännande.

## 2026-09-29 — Automatisk zonuppspelning i Labbet

Zonvideons Uppspelning har nu Hela tiden, Automatisk och Av. Automatisk
startar inom 10 sekunder, väntar sedan minst 30 sekunder plus 0–10 sekunders
slump från senaste start och låter klippet sluta innan nästa start. Det ger
högst två starter i varje rullande minut utan att binda timern till underliggande
Astridklipp. Inställningen sparas med zonen i browsern och följer JSON-export;
äldre sparade zoner fortsätter som Hela tiden. Inga importerade klipp eller
zoner migreras bort. Detta är Labförhandsvisning; spelets spelare läser ännu
inte de browserlokala zonerna. Schematest och Labbygge verifierar ändringen.

## 2026-09-29 — Render-diskarnas säkerhetskopia och OAuth-beslut

Produktens `/var/data`, Directors `/data/catalog` och Gateways
`/data/openclaw` är kartlagda. `tools/backup-render-state.mjs` exporterar
SQLite med backup-API, kontrollerar integritet/SHA-256 och återläser bara till
en tom datarot. `test/backup-render-state.mjs` passerar med nio syntetiska
prov, inklusive WAL och nekad överskrivning. Se
`docs/RENDER-BACKUP-RESTORE.md` för kör- och återställningsordning.
Regressionsprovet ingår nu i `.githooks/pre-commit`.

Ingen skarp databas, Render-tjänst eller leverantörsnyckel ändrades. Faktisk
diskmontering, samordnad skrivpaus, extern backup, omstart och skarp
återställning är öppna driftprov. Befintlig CRAIG-baserad spelar-/BO-login
räcker för piloten; OAuth införs inte utan nytt behov och beslut.

## 2026-09-29 — Bakgrundszoner öppnade och sessionsvakt rättad

Det tidigare koordinerade offlineparet på 4192/4194 hade inga öppna lokala
browserflikar och stoppades före omstart. Sessionsvakten blockerade först
korrekt återtagande: en gammal Node-PID hade återanvänts av Chrome, vars
starttid Windows inte lämnade ut. `matchesLocalSessionProcess` behandlar nu
ett verifierat icke-runtime-processnamn som en återanvänd PID även när
starttiden är oläsbar; okända namn och möjliga Node-/launcherprocesser
blockerar fortfarande. Av 11 riktade sessionstester passerade 10 och ett
Linux-test hoppades över på Windows. Nytt offlinepar byggdes via
`node lab/start.mjs --offline --no-open`. `/zones` öppnades i synligt lokalt
Lab och startbild, zonlista och klippval verifierades i browsern. Fliken
lämnades öppen för Jakob; ingen användarzon skapades eller togs bort.

Samtliga 16 aktiva manifestvarianter har H.264/yuv420p/24 fps. Tolv är
1080×1920, fyra är 612×1088 (två boxvarianter samt smile/yawn). En 1 s
kontaktkarta och mätning av en fast väggpatch över alla frames visar att
`idle_resa_sig.mp4` har tydligt ljusare vägg än neutral idle (Y-medel 56,1
mot 50,6); `idle_resa_sig_fargmatchad.mp4` ligger närmare (49,8).
Box-4-varianten har ett stavfel i filnamnet (`varaint`) men normal
videoprofil. Dessa still-/patchkontroller är ingen visuell godkänning av
hela rörelsen, klippskarvar, kortkontakt eller läppsynk. Media är orörd.

## 2026-09-29 — isolerad Vercel-preview och exakt Render-origin

En separat, ännu inte driftsatt Vercel-projektrot finns i
[`ops/vercel-entry/preview/`](../ops/vercel-entry/preview/README.md). Den
incheckade mallen saknar giltig backendadress och har bara en snäv lista över
spelar-API:er och Astrids medier; skyddade BO/Lab-vägar proxyas inte. En
genererad, Git-ignorerad konfiguration kräver en Render-testbackend med egen
databas och annat hostname. Den riktiga `croupier-v2` avvisas uttryckligen.

Render-koden har nu ett avstängt-standardläge för en enda exakt
`CROUPIER_VERCEL_FRONTEND_ORIGIN`. Det ändrar endast spelar-POST och
presentationens video-GET/HEAD; BO-spärren är orörd. Isolerade tester täcker
Host/Origin, cookies, 206/Range, avvisade okända origins och fortsatt lokal
uppspelning. Full pre-commit passerade lokalt. Ingen Preview-deploy eller
produktionsovergång gjordes. Vercels verkliga proxyheaders, inloggning,
spelrunda, media, omstart och backup/restore är fortfarande oprövade.

## 2026-09-29 — Vercel-frontend: förhandsbygge, inte driftsatt spel

Jakobs mål är att spelaren stannar på Vercels befintliga `.vercel.app`-adress
medan Render behåller API, spelmotor, SQLite och skyddat BO/Lab. Nuvarande
Production på Vercel är fortfarande bara en landningssida som länkar till
Render. Ett uttryckligt `--frontend-preview`-bygge kopierar spelarens
HTML/JS/CSS och textbaserade modulberoenden till Vercel-strukturen utan media
eller BO/Lab. Det är ännu inte ett fungerande spel: API-/mediaproxy, exakt
Origin-/cookie-kontrakt, WebSocket/SSE och browseracceptans återstår.
Migrationskontraktet finns i [VERCEL-FRONTEND-MIGRATION.md](VERCEL-FRONTEND-MIGRATION.md).

Render-gatewayens delade loopback-IP kunde låsa ute alla spelare efter felaktiga
inloggningsförsök från en användare. Spelarautentisering begränsar nu i stället
misslyckade försök per konto (CRAIG:s namn/e-post delar nyckel); lyckad
inloggning nollställer kontots räknare. Den separata BO-begränsaren är inte
ändrad och behöver granskas före bred drift. Riktade frontend-/auth-tester
och hela pre-commit passerade lokalt. Ingen Vercel-cutover, ny tjänst, betald
GPU-körning eller publik end-to-end-verifiering gjordes i denna ändring.

## 2026-09-29 — Astrids bakgrundszoner i Lab

`/zones` i Astrid Studio använder den befintliga 1080×1920-startbilden som
referens. Operatören drar rektanglar, namnger dem, ser exakta pixelkoordinater,
exporterar JSON och laddar ned zonens beskurna startbild. Ett tvåsekunders
blinkande WebM-klipp kan skapas i zonens exakta mått, eller ett eget MP4/WebM
med samma mått läggas in. Zonernas rektanglar är masken; skärmljusblandning
respektive normal blandning finns. Provyta kan byta mellan manifestets
Astridfilmer medan zonklippen fortsätter separat. Koordinater sparas i
webbläsarens localStorage och klipp i IndexedDB; de kan exporteras/laddas ned.
Produktspelaren, dess event och originalmedia är inte ändrade. Ingen visuell
acceptans av att en zon ligger bakom dealern eller registrerar på varje take
är gjord. Exakt pixelplacering kan inte antas bara för att bakgrunden verkar
stilla: beskärning, skala, kamera, flimmer och ocklusion måste granskas per take.

Manifestets 45 MP4 har samma H.264/yuv420p/24 fps-profil. 41 är
1080×1920; fyra är 612×1088: `box_1_variant`, `box_2_variant`,
`idle_smile` och `idle_yawn`. Bildrutor vid 1 och 2,5 sekunder bekräftade
att plats-1-varianten visar ett mönstrat kort där standardfilen visar ett
vitt. Ingen fil har skalats upp, stabiliserats eller fått nytt hashvärde.
Längre idle-, kaffe- och flipklipp är formatmässigt 1080×1920 men kräver
separat visuell granskning innan flimmer/skarv får en åtgärd eller godkännande.

`npm run build`, TypeScript, 494 Lab-tester och `audit-dealer-sync --probe`
passerade. Ett redan körande koordinerat spel/Lab-par på 4192 använder sitt
äldre bygge; `/zones` ger 404 där tills paret kan startas om utan att störa
pågående spel eller utkast. Ingen ny server startades och inget browserprov
eller fyra-dealer-rehearsal gjordes. Jira-issue saknades för denna nya
labbyta; inga CAC-statusar ändrades.

## 2026-09-29 — städarkiv, V3 och containerkontext

Emils fristående V3-demo (240 filer, 63,1 MiB, inklusive manifest) är borttagen
ur arbetskopian efter SHA-256-verifierad kopia till
`C:\Users\jakem\Desktop\croupier\BACKUP-LAB-to-HUB`.
`backup-manifest.json` listar varje fil; Git-commit `9e2048a6` bevarar hela
trädet. `emil/dealklipp-v1/` är fortsatt aktiv och orörd.

Fyra avvisade 3D-studier under `content/staging/2026-09-11/` och `2026-09-12/`
togs ur arbetsbranchen efter Jakobs uttryckliga godkännande: 240 filer,
987 631 568 byte. Hela det sammanhängande paketet med original, beroende
studieskript och åtta symboliska länkar finns i det SHA-256-verifierade
Desktop-arkivet och i Git-commit `a055b5c2`. Äldre handoffavsnitts sökvägar
är historisk proveniens; återställ dessa fyra grupper innan studieskripten
körs igen. Produktkod, Lab och molnbygge refererar inte till dem. Ingen
aktiv produktmedia, kalibrering eller avatar ändrades.

Rotens `.dockerignore` utesluter nu också `assets/astrid-3d/` och
`assets/blackjack-3d/` från det planerade produktbygget. Offlinekällorna
finns kvar i Git; webbläsaren använder exporter i `web/public/`. Detta är
statisk beroendegranskning, inte ett byggt eller driftsatt imageprov.
Full inventering, återställning och prov finns i
[städrapporten](REPOSITORY-CLEANUP.md).

## 2026-09-29 — Lab/Lissabon samlat, Kevin hole/flip och förladdning

Astrids fokuserade studio finns nu i gemensamma Lab på `/`, avancerade
verktyg på `/tree`. Start: `node lab/start.mjs --offline --no-open` för ett
isolerat lokalt par med tom testdatabas och blockerade externa tjänster.
Befintliga privata Lissabon-data återanvänds utan flytt i anslutet läge.
Gammal duplicerad start/snapshot tas bort. Oförändrade demotriggers och
exempelvarianter rensas med full före-revision; egna redigeringar bevaras.

Exakta Kevin-filmer för dolt kort/vändning plus uppmätta spår är integrerade.
Kort och reveal förblir serverägda. Nästa standardfilm förbereds med verifierad
hash, begränsad cache och separat avbrottsägarskap. Gemensamt familjeregister:
`presentation-runtime/media-families.mjs`, genererat manifest: 28 familjer/45 MP4.

492 Lab-tester, typecheck, Next-bygge, full pre-commit och dealerprobe godkända.
Lokalt browserprov: två avslutade rundor, dolt kort/flip och varm förladdning.
Förladdade dealfilmer: 27–42 ms till första visade bild från spelarstart,
exklusive selector-HTTP. Inget mått på AI/TTS/GPU eller hörbar svarstid.
Normal browserstorlek återställd efter mobilprovet. Jakob avslutade manuella
prov och avgränsade dagens arbete till Astrid; ingen ny fyra-dealer-rehearsal
kördes. Pågående spelarhand bevarades. Kända läppsynkgap och verklig mobil/iOS
kvarstår.

Full proveniens, verifiering, rensning och återgång:
[Kevin/Lissabon-granskningen](KEVIN-LISSABON-REVIEW.md). Ingen deployment,
betaltjänst eller GPU-körning. 3D-original/staging och andra agenters arbete
(t.ex. `f2dce6fc`) bevaras.
Den parallella molnstartens ändringar och återstående driftsbeslut beskrivs i
[molnstartens handoff](CLOUD-LAUNCH-HANDOFF.md).

## 2026-09-29 — historiska 3D- och videogranskningspaket

Två fristående QA-/visningspaket har tagits ur arbetskopian:
`assets/blackjack-3d/review/` (72 filer, 95 683 800 byte) och
`web/public/review/astrid-a9fa1da6/` (21 filer, 33 820 939 byte).
Kvitton, filmer och skärmbilder finns oförändrade i Git vid `f31b219e`.
Inga runtimeimporter, tester eller byggskript läste paketen. Aktiva modeller,
redigerbara Blenderkällor, dealerfilmer, kalibreringar och releasekopior
är kvar; särskilt `web/public/review/astrid-seam-repair/` behövs i den
daterade V2-releaseförteckningen. Se `docs/REPOSITORY-CLEANUP.md`.
Den avvisade 559 MiB ersättningsstudien i `content/staging/2026-09-11/`
ligger kvar: automatisk godkännandekontroll avvisade radering av dess unika
leverantörsoriginal och återbyggnadsunderlag. Ingen delradering gjordes.
41 relativa dokumentlänkar, `audit-dealer-sync --probe`, tre
handkontaktprov och blackjack-bordets tillgångstest passerade. Ingen
ny visuell läppsynk- eller 3D-acceptans gjordes; tidigare öppna fel kvarstår.

## 2026-09-28 — systemkarta och storleksinventering

Aktiva systemkartan är flyttad till `docs/systemkarta/` med oförändrat
sexdelat ämnesträd. Den tidigare 956-byte vägvisaren under `jakob-docs/`
är borttagen; privata/ignorerade filer och arkiv har lämnats orörda.
Inkommande och interna länkar är uppdaterade. `emil/` ligger kvar eftersom
den aktiva banken har manifest-, kod- och testberoenden; V3 är en komplett,
inaktiv referens som redan utesluts ur Dockerkontexten. Inga mediebytes,
hashar eller kalibreringar ändrades. 390 relativa dokumentlänkar passerade.
Se `docs/REPOSITORY-CLEANUP.md` för storlekar och återställning.

## 2026-09-28 — referensmappar och Emils två mediauppsättningar

En riktad inventering skilde `emil/dealklipp-v1` (aktivt manifest, kod- och
testberoenden; 43 MP4) från `emil/astrid-demo-v3-reference` (fristående,
inaktiv referens; 217 MP4 och flerspråkiga talbanker). SHA-256 över samtliga
260 MP4 gav inga byteidentiska videor. Den enda dubbla filen är startbilden
som V3:s eget manifest använder; den bevaras. `emil/README.md` ger en tydlig
ingång utan att flytta sökvägar eller ändra spel/worker.

`reference/` innehöll sex gamla Sunny-text/JSON-underlag, inte videor. De och
en daterad observation under `random-stuff-jakob/` saknade kod-, test- och
byggberoenden och togs bort (7 spårade filer, 2 056 589 byte). Samtliga finns
i `Jakobs-v1`. `pipeline/build-index.mjs` har sitt schema beskrivet i kommentaren
utan länk till det borttagna exempelindexet. Ignorerade personliga loggutdrag,
aktiv systemkarta, media, manifest och privat arkiv lämnades orörda.
Se `docs/REPOSITORY-CLEANUP.md` för avgränsning och återställning.
Verifiering: V3-manifestets 218 mediereferenser finns, aktivt mediemanifest
43/43, sju riktade manifesttester och hela pre-commit-kedjan passerade.

## 2026-09-28 — avgränsad dokumentstädning efter GitHub-checkpoint

Utgångspunkt `e03b5d0`. 28 spårade historiska/engångsfiler togs bort ur
arbetskopian (151 085 byte); samtliga verifierades i `Jakobs-v1` före
raderingen. V3/V4-planerna, en gammal GitLab-issueprompt och två inaktiva
Cursor-regler ersattes inte av en ny arkivmapp. Den historiska
`astrid_motorklipp.txt` har inga kodberoenden; systemkartans hänvisning pekar
nu till checkpointversionen. Aktiva start- och dokumentationslänkar uppdaterades.
Detaljer, kvarvarande kandidater och verifiering: `docs/REPOSITORY-CLEANUP.md`.
13 ändrade Markdown-filer gav inga brutna relativa länkar; `git diff --check`
och hela pre-commit-kedjan passerade.
Importerad worker, RunPods befintliga GitLab-imageberoende, spel, media,
databaser och ignorerade filer lämnades orörda. Äldre daterade avsnitt nedan
beskriver sina dåvarande lägen och är inte aktuella arbetsinstruktioner.

## 2026-09-28 — Gemensam checkpoint före större ändringar

Jakob begärde uttryckligen commit/push av aktuellt läge. Städchatten och
workerchatten pausade skrivningar. Snapshoten samlar rotnotisen samt pågående
moln-WebSocket, streamingkonfiguration, tidsmätning, worker-/spelartester och
en enbart manuell GHCR-publiceringsworkflow. Ingen deployment eller betald
körning ingår. 40 riktade moln-/streamingtester passerade; det tidigare
HTTP-fixturefelet är inte kvar i detta prov.
Känd kvarstående konfigurationsfråga: föreslaget paket anger `jakemanator123`
men repoägaren är `Jakeminator123`. Bekräfta/korrigera innan publicering.
Privata data/hemligheter och andra worktrees ingår inte i denna Git-checkpoint.

## 2026-09-28 — Rotnotis om GPU-livscykel och användarens städning

`ANDRINGSLOGG-V2.md` är Jakobs begärda korta rotnotis för fortsatta ändringar.
Den föreslår aktivitetsstyrd GPU-reservation (5 minuter), separat från konto-
utloggning, med begränsade jobb, budgetstopp och kontroll av verklig avstängning.
Ingen driftkonfiguration eller spelarkod ändrades. Inga nya spårade raderingar
hittades mot `22976fc`; ignorerade/ospårade raderingar går inte att fastställa
med Git. `astrid_motorklipp.txt` finns kvar oförändrad och är historiskt underlag,
inte ett runtimeberoende. Ingen fil återställdes eller raderades i denna kontroll.
Manifestkontrollen verifierade 43 objekt i 26 familjer. Andra agentens dirty
moln-/streamingfiler bevaras; deras nya funktion verifieras inte av denna notis.
Dokumentcommitten stoppades av pre-commit: HTTP-streamingfixturen ger
`generated_speech_stream_not_configured` i samtidigt ändrad serverkod
(20/21 tester passerade i gruppen). Riktat återprov gav samma fel. Ingen
hook kringgicks och ingen kod som tillhör annan agent ändrades.

## 2026-09-28 — Samlad V2-lägesbild och testplan

På Jakobs begäran sammanställdes `docs/STATUS-OCH-TESTPLAN-V2.md` från
migration/städning, molnleveransen och streamingarbetet, avstämt mot `44feeec`.
GitHub-körning 36474929456 kontrollerades på nytt: alla tre jobb success.
CPU-imagebygge 36471104794 vid `7644c44` kontrollerades också: success.
Dokumentet skiljer detta från riktig GPU-inferens och faktisk molndrift,
beskriver kvarvarande GitLab-registerberoende och start-/WebSocket-spärrar,
samt ger genomförandeordning och 12 acceptansprov. Backup- och browserprov
refereras till tidigare kvitton; de kördes inte om för dokumentet.
Inga driftresurser beställdes, privata data flyttades eller startspärrar ändrades.

## 2026-09-28 — Godkänd rensning av lokal inbox och gamla arkiv

Jakob godkände permanent radering av hela `.croupier-inbox/`: 153 ignorerade
filer, 13,7 MiB, inklusive privata utkast/QA/checkpoints. De finns inte i
Git-taggen och har inte kopierats till ett nytt arkiv. Chef var inaktiv.
Pausad GitLab-inbox förblir pausad; ingen automatisk återinitialisering.
Gamla testbygget `.next-probe`, dess genererade tsconfig, TypeScript-cache
och pensionerad Cursor-läsmarkering togs också bort: totalt cirka 166,6 MiB.
Nuvarande `.next`, node_modules, databaser, profiler, hemligheter och media
behålls för pågående arbete. Inga lokala produktservrar startades.

39 gamla spårade dokument/mallfiler togs bort: GitLab-MR-mallen,
PROJECT-PROMPT och två pensionerade dokumentationsarkiv. Alla finns i
`Jakobs-v1`; aktiva länkar flyttas till checkpointen. Underagentens
referensgranskning hittade inga kod-/test-/byggberoenden till dessa filer.
Se `REPOSITORY-CLEANUP.md` för avgränsning och återställningsinformation.
Inga gameplay- eller mediaändringar och inget nytt visuellt godkännande.
Verifiering: 33 inbox-/chef-/GitHub-policytester passerade. `check` gav
`disabled`, chef `inactive`, och ingen inboxmapp återskapades. Diffens
whitespacekontroll passerade.

## 2026-09-28 — Whisper till engelska och Terra-bilder

Astrids inkommande ljud använder nu OpenAI Whisper `whisper-1` via audio/translations.
Svenska och engelska identifieras automatiskt; uttexten är engelska. Record/wake,
1 150 ms tystnad, dold normalvy och fem sekunders loggöppning behålls. Cartesia
är kvar för utgående röst. Endast produktservern får scoped translation-nyckel.
Startaren föredrar uttrycklig translation-nyckel, sedan befintlig officiell OpenAI-
nyckel. Inget automatiskt byte av credential eller retry efter autentiseringsfel.

Riktigt adapterprov med syntetiskt svenskt/engelskt ljud passerade HTTP 200,
korrekt engelsk text, 3 273/955 ms. Befintlig OPENAI_API_KEY fungerade; äldre
modellnyckeln gav 401. Inga nycklar ändrades eller loggades, ingen mikrofon användes.
Privat kvitto: Windows TEMP/croupier-whisper-qa/receipt.json (utanför Git).
Produkt-HTTP 34/34, Gateway/Director 29/29, kamera/adapter 42/42 och cloud-readiness
4/4 passerade. Startarens avgränsning har egna credential-/processprov.

Bildstöd tillåts för Luna och Terra i produkt, Director och Gateway när
CROUPIER_SPEECH_VISION=1. Terra i driften och fysisk Chrome-wake/mikrofon återstår;
nya Gateway/Director måste driftsättas. Devserverparet lämnas stoppat.
Cloud-readiness redovisar bara credential-närvaro, aldrig värden. CLOUD-MIGRATION.md
beskriver beständig data/media, cloud-auth/origins och långlivad spelserver som
återstående arbete före en fungerande Vercel-front med helt fjärrkörd backend.
Inga mediafiler eller visuella läppsynksgodkännanden ändrades.

## 2026-09-28 — GitHub-only och underlag för molndrift

Uppföljning efter första GitHub-CI: både jobb startade från GitHub, men
studiojobbet hittade fyra föråldrade testantaganden och dealerjobbet saknade
ett Next-bygge före startprovet. Testfixtures är rättade mot befintlig
43-filmscheckpoint, sju uttryckligen aktiverade idlevarianter, 2D-reservens
beroenden och frekvenseditor-importen. Alla 482 studiotester passerar lokalt.
Workflowet bygger nu studion före startregressionen och använder Actions v7.

Linux CI hittade också en riktig sessionsbugg: Node kan kalla huvudtråden
MainThread. Legacy-PID-kontrollen använder nu `/proc/<pid>/exe` för programmets
identitet; processens födelsetid avgör fortfarande PID-återanvändning. Nekad
inspektion spärrar fortsatt en ny start. Ett verkligt Linux-test med namngiven
Node-barnprocess misslyckades före fixen och passerade efter; 11/11 sessions-
tester passerade på Ubuntu/WSL Node 22. Node 24 verifieras i nästa GitHub-CI.
Ingen spelregel, mediafil, asset-baseline eller användardata ändrades av detta.

På Jakobs begäran används nu endast `jakemanator123-github-work` i privata
`Jakeminator123/github-work`. `origin` har bytts till GitHub. `Jakobs-v1`
är verifierad på både GitLab och GitHub vid `600093e`, samma SHA som sista
GitLab-work vid övergången. GitLab lämnas där som återgångspunkt. Senare
Astrid-arbete från NY1 finns i `e3eec8f` på nya branchen och följer med pushen.

GitLab-inboxens check/send stannar före credential- och nätåtkomst. Den gamla
mirror-helpern leder till nya GitHub-helpern; pre-push spärrar annat repo,
annan branch, borttagning och omskrivning av historik. Lokal hooksPath är
`.githooks`. GitHub Actions ersätter GitLab-CI. Timvis GitLab/CI-uppföljning
är pausad. Aktuella arbetsinstruktioner och dokumentingångar är uppdaterade.

Fyra gamla engångsprompter och fyra helt införlivade lokala sidobrancher är
borttagna. Historiken finns i v1-taggen. Inboxens checkpoints/QA-underlag,
sparade data och all media bevaras. Extra inbox-publish-worktree lämnas kvar
eftersom inaktivitet inte är bevisad. Inga devservrar har startats här.

Tre underagenter granskade städning, motorn och Vercel. Lissabon använder
befintlig servermotor och sex presentationstyper; ingen separat BO-events-
motor saknas. `tools/cloud-readiness.mjs` verifierade närvaro av 17 källankare
och metadata/storlek för 43 filmer. Den rapporterar åtta konkreta cloudhinder
och aldrig ready=true. Beständig SQLite/projektlagring, skyddad studio,
profil-/talaktivering och riktig driftsverifiering återstår.

Verifiering för migrationen: 37 riktade policy-/inbox-/chef-/cloudtester
passerade samt diffkontroll. NY1 har separat verifierat sin pre-commit och
fyradealerasset-audit; detta är inget nytt visuellt godkännande. GitHub-CI:s
första fjärrkörning måste kontrolleras efter push. Ingen Jira CAC-anslutning
fanns bland tillgängliga verktyg och ingen issue har markerats klar.

Vercel-deploy avvisades av automatisk godkännandegranskning med hänvisning
till payloadexport/auktorisering och olösta cloud-/authhinder. Inget V2-projekt
eller ny driftsättning har skapats. Befintlig Vercel-dokumentationssajt är
orörd. Konkreta nästa steg, lagring/env och driftacceptans finns i
`docs/CLOUD-MIGRATION.md`; leverans/återgång i `docs/GITHUB-MIGRATION.md` och
städningen i `docs/REPOSITORY-CLEANUP.md`.

## 2026-09-28 — Pågående förenkling av Astrids röstläge efter Jakobs-v1

Jakob har ändrat uppdraget: Record slår på lokal lyssning efter ”Astrid”.
Därefter ska ljud och eventuella kamerabilder skickas automatiskt efter
1 150 ms tystnad (tidigare 650 ms). Normalvyn visar bara Play och Record;
fem sekunders långtryck öppnar loggen. Första aktiveringen kräver ett
sessionssamtycke till automatisk sändning. Det ersätter den tidigare
manuella gransknings-/Skicka-vyn för Astrid. Play styr befintligt spelljud.

Arbetet är ännu inte levererat: lokal wake, begränsad ljudbuffert och UI
utvecklas; engelsk talöversättning från svenska/engelska inväntar Jakobs
val av leverantör. Cartesia har inte verifierat stöd för språkparametern
`auto` eller direkt engelsk översättning; anta inte sådant stöd. Ingen
ny ljudleverantör har anropats. Devservrarna är fortsatt stoppade och
`Jakobs-v1` är oförändrad. Verkligt wake-/mikrofonprov i Chrome återstår.

Verifiering av hittillsvarande kod: alla 27 pre-commit-kommandon passerade,
varav kameragruppen har 67 tester. Den omfattar verkligt samspel mellan
wake-modulen och kontrollen med simulerad Recognition, korta prefixfraser,
sen konfiguration, avbrott och avsaknad av engelsk serverkapacitet.
Fyradealer-audit med `--probe` passerade befintlig asset-baseline; detta
godkänner inte visuell läppsynk eller fysiskt mikrofonprov. Kvitton finns
privat i `C:/WINDOWS/TEMP/croupier-qa-preserved-6CcPDB/astrid-voice-gates/`.

Det nya automatläget kräver uttryckligen `transcription.outputLanguage=en`
och `transcription.acceptsAutoLanguage=true` i serverns konfigurationssvar.
Gamla Cartesia-konfigurationen ger en tydlig spärr innan mikrofon eller
uppladdning startar. Backend och samtyckets providernamn ska färdigställas
efter Jakobs leverantörsval; först därefter kan hela kedjan verifieras.
Den syntetiska browser-fixturen har uppdaterats för Record/wake/autosend
och kontrollerats syntaktiskt. Den använder riktig lokal AudioWorklet men
stubbad wake/STT; den har inte körts i browser i denna leverans.

Bildstöd: både GPT-6 Luna och GPT-5.6 Terra tar emot bilder enligt aktuella
officiella modellsidor. Begränsningen till Luna finns i produktserverns
observation-grind och Gateway-konfigurationens `CROUPIER_SPEECH_VISION`.
Terra har ännu inte verifierats genom vår driftsatta bildkedja. Modellerna
anropas hos OpenAI; Render är värd för Director/Gateway, inte modellvikterna.
Källor: https://developers.openai.com/api/docs/models/gpt-6-luna och
https://developers.openai.com/api/docs/models/gpt-5.6-terra.

GitHub-/branchflytten sköts av en annan agent. Arbetskopian är nu verifierat
på `jakemanator123-github-work` med `origin` till
`git@github.com:Jakeminator123/github-work.git`; röständringarna följde med.
Denna röstuppgift gör inga branchbyten eller pushar medan flytten samordnas.

## 2026-09-28 — Jakobs-v1 checkpoint och stoppade devservrar

På Jakobs uttryckliga begäran sparas alla kvarvarande projektändringar som
checkpointen `Jakobs-v1`: box 4-variant med tillhörande manifest, Windows-
startskript, chef-kommandobrygga, avataruppdrag och tekniska referensfiler.
Referensfilerna innehåller klippmetadata respektive två anslutningsstatusar;
inga konversationsexporter eller privata nycklar läggs till. Befintliga
ignorerade profiler, hemligheter och lokala labbval ingår inte i Git-taggen.

Det enda Lissabon-paret på 4200/4201 stoppades. Portkontrollen bekräftade
inga lyssnare på Croupiers använda utvecklingsportar; inga servrar startades
igen. Senaste verifiering är de 27 kontrollerna och riktade testerna nedan,
körda med samma befintliga box 4-fil och manifest. Checkpointen är inte ett
nytt visuellt godkännande av klippet. Fysisk kamera/mikrofon, bildlagring,
labbuppföljning och senaste GitLab-CI återstår enligt föregående överlämning.

## 2026-09-28 — Bild/ljud aktiverat i Jakobs aktuella Chrome och omstartsspärr reparerad

Jakobs aktuella flik var vanliga Lissabon på 127.0.0.1:4200/4201, inte det
tidigare QA-paret på localhost:4210/4211. Luna var redan sparad, men
`lissabon/start.mjs` kördes utan `--astrid-camera`. Den generiska texten
om att vänta på transkription/bildstöd dolde den konkreta startorsaken.

Backend skiljer nu funktionsflagga, transkription och bildkapacitet åt.
Taltranskription fungerar även med Terra; bilder kräver fortsatt Luna.
Panelen visar konkreta felorsaker och uppdaterar kapaciteten när den öppnas,
utan att störa pågående inspelning/granskning eller utöka kameratillståndet
efter ett mikrofonklick. Bilder skickas fortfarande bara efter granskning.

Omstarten blottlade en verklig PID-återanvändningsbugg i sessionsspärren:
en gammal byggprocess hade blivit en orelaterad conhost. Spärren sparar nu
processens startidentitet och hanterar gamla poster konservativt. Ingen
låspost raderades och inget orelaterat program avslutades. Starten återtog
den gamla sessionen korrekt; enbart 4200/4201 lyssnar. Den startades med
`node lissabon/start.mjs --no-open --skip-build --astrid-camera`, samma
sparade projekt och profiler. QA-återställningspekaren är markerad stoppad.

Den befintliga Chrome-spelfliken återanvändes och laddades om efter kontroll
att inga text- eller bildutkast fanns. Jakob, saldo och val återkom. Kamerapanelen
har en aktiv Starta-knapp och status ”Av · inget tillstånd begärt”. Ingen
fysisk enhet startades. Astrids video spelar med readyState 4 utan mediafel.

Verifiering: samtliga 27 pre-commit-kommandon, 42 kamera-/ljudprov,
32 produkt-HTTP-prov och fyradealerasset-audit med `--probe` passerade.
Efter sessionsändringen passerade även 9/9 sessionsprov och 17/17
anslutningsprov. Ett riktigt syntetiskt JPEG-prov via `openClawChat` →
Director → OpenClaw gav korrekt svar: blå cirkel, sedan röd kvadrat,
1 875 ms. Luna begärdes; inga riktiga spelaruppgifter/DB eller foton användes.
Provbild, kvitto och screenshot finns privat vid den bevarade QA-återstarten.

Kvar: fysisk mikrofon/kamera i användarens Chrome, faktisk bildlagring och
Gateway-modellidentifierare (Render är fortsatt nekat av sparad Codex-
webbplatsbehörighet), samt full visuell fyradealerrehearsal. Tidigare verklig
Cartesia-transkription och genererat tal/video är godkända tekniskt, inte
mänsklig läppsynk. Ingen ny Render-deploy behövdes eller gjordes här.
Jira CAC är fortsatt inte tillgängligt i verktygen. På Jakobs begäran ligger
labbuppföljning och CI-jobbet presentation-studio efter kameraarbetet; en
tyst timvis tråduppföljning påminner en gång om kvarstående arbete. CI-felet
är ännu inte kontrollerat mot senaste pipeline och får inte kallas löst.

## 2026-09-28 — Ny omstart och faktisk browserkontroll av tal/video

På Jakobs begäran stoppades förra serverparet och dess startprocess;
process-/portkontrollen var tom före omstart. Labbet byggdes igen och ett
enda par på localhost:4210/4211 startade med samma sparade projekt och
isolerade testprofil. Kameraflaggan är på. Inga spelkort eller konton ändrades.

Den aktuella Chrome-anslutningen fungerar nu för produktsidan på 4210.
Den tidigare spelfliken fanns inte längre i den färska fliklistan; en ny
öppnades och lämnas kvar. Den visar Astrid med `presentation=local` och
Jakob · TESTMINNEN, inklusive den tidigare pågående handen. Videoelementet
spelar med readyState 4 och utan mediafel.

Ett märkt ljud-/videoprov skickades genom den vanliga chatten. Terra svarade
"Hello! Sound and video test received." Röst och läppsynkvideo skapades,
browsern slutförde talflödet och inga console warnings/errors rapporterades.
DOM-mätningen visar 16 124 ms till talstart, RunPod-kö 132 ms och rendering
10 877 ms. Detta bekräftar uppspelning, inte mänsklig läppsynkacceptans.
Chattradens gamla förbereder-tooltip blev kvar efter spelning; avslutat
talflöde och mätningen användes som kvitto.

Den syntetiska kamerafixturen kördes i samma Chrome: tystnad 0 JPEG, kort tal
1, långt tal 2 och tal med kort paus 2. Riktig AudioWorklet användes, spåren
stängdes före simulerad transkription och explicit granskning kontrollerades.
Befintligt goodluck-testljud gav 71 468 WAV-byte och 18 aktivitetsprov genom
inspelaren. Ingen fysisk kamera/mikrofon eller extern bildmodell användes.
Provfliken och dess tillfälliga public-kopia togs bort; skärmbild är privat
vid QA-återstartsfilen, utanför Git.

Det sparade modellvalet var Terra, vilket stänger av hela bild/ljudpanelen
i den nuvarande Luna-begränsade kopplingen. Labbet på 4211 nekades av en
sparad browserbehörighet. Ingen fil-/API-omväg användes för att byta modellen.
Jakob fick länken och instruktionen Probe → GPT-6 Luna → Spara.
Fysisk inspelning samt bild → OpenClaw → modell och bildlagring återstår.

## 2026-09-28 — Astrids Deal-frekvenser och fungerande servertranskription

Astrids Deal-panel använder samma nya frekvenseditor i Lissabon och stora
labbet. Varje exakt kortdestination har procent per variant, högst fyra
aktiva och högst 100 procent totalt; resten använder standard. 0 procent
behåller filen för manuella prov. Senare importerade klipp kan aktiveras även
när de kommer efter de fyra första i manifestet. Gamla nollrader frigör plats
för ersättningsfiler; en nollmarkör bevarar uttryckligt avstängt urval.
Saknade klipp lämnar sin andel till standard utan att öka andra varianters
andel. Regler, Slump och OpenClaw använder detta lokala val utan modellanrop;
Standard och Skuggläge spelar standard. Serverns kortdata ändras inte.

Gamla social-/språkalternativ och tal-/posedemot visas inte i Astrids
Deal-test. Befintligt äldre urval gäller tills operatören uttryckligen
ändrar och sparar en frekvens; gränssnittet förklarar övergången. Inga sparade
Deal-val eller filmer har ändrats av denna leverans. Råfilradering är fortsatt
inte en del av labbgränssnittet. Repliker och övriga dealers behåller sina val.

Jakobs bild visade nätfel från browserns SpeechRecognition. **Bild och ljud**
använder nu AudioWorklet och kort PCM/WAV-inspelning i RAM, högst 30 sekunder.
Kamera och mikrofon stoppas före transkription via produktbackend till
Cartesia `ink-whisper`, svenska/engelska, med befintlig servernyckel.
Texten är redigerbar; bilder och text går vidare till Astrid först efter
manuell Skicka. Appen sparar inte råljud till disk/DB/chatt. Lokal nivådetektor
styr kandidatbilder och är inte en säker talidentifierare. Profil-/rundbyte,
avbrott och sena svar kasserar materialet. Nycklar finns bara på servern.

Verifierat: 47 riktade Deal-/katalog-/lagrings-/runtimeprov, fyra renderprov
för testpanelen, 32 kamera-/ljud-/transkriptionsprov, TypeScript och samtliga
27 pre-commit-kommandon. Mediaserverns isolerade testkopia behövde inkludera
den nya ljudmodulen; efter den rättningen passerade även dess fem prov.
Kodgranskningen av frekvensernas kapacitets- och nollställningsfall är klar.
Fyradealerasset-audit med `--probe` passerade med tidigare kända luckor;
ingen ny visuell läppsynkacceptans. Labbet byggdes med webpack och TypeScript.
Det tidigare QA-parets processer och portar verifierades stoppade, och endast
4210/4211 startades igen med samma lokala projekt, isolerade spelar-DB,
testminnen och kameraaktivering. Ladda om befintliga flikar; inga nya öppnades.
Efter Jakobs specifika tillstånd transkriberades den befintliga inspelningen
`goodluck.mp3` genom den nya adaptern till Cartesia: HTTP 200, 472 ms,
exakt "Bets are closed. Good luck at my table." Ingen riktig mikrofon användes.

Kvar: verklig AudioWorklet-inspelning i IAB och bild → Render → Luna med
kontroll av bildlagringen. Agentens sparade browserbehörighet blockerar
fortfarande dessa prov; inga alternativa browser/API-vägar används för att
kringgå den. Inget nytt Render-deploy eller visuellt läppsynkgodkännande görs.
Se kameradokumentet för genomförda prov och exakta aktiveringssteg. Jira CAC
är fortsatt inte tillgängligt via anslutna verktyg.

Beständiga diskar är redan deklarerade i Render-blueprinten: 1 GB
`/data/openclaw` för Gateway och 1 GB `/data/catalog` för Director. Ingen ny
disk behövs för transkriptionen och ingen extra lagringsresurs skapades.
Aktuell diskstatus i Render har inte verifierats i denna omgång. Lissabons
lokala projekt och bevarade isolerade spelar-DB ligger fortfarande lokalt.

## 2026-09-28 — Omstart med kamera och utökade privata testminnen

På Jakobs uttryckliga begäran stoppades Lissabon-paret 4200/4201 och dess
startprocess. Den bevarade QA-starten byggde senaste labbet och startade ett
enda par på localhost:4210/4211 med `astridCamera:true`. Portkontrollen visar
bara detta par på de berörda Croupier-portarna. Starta inte ett parallellt par.
Samma `lissabon/data` används för klippval och inställningar; spelar-DB är
fortsatt separat och profilen heter **Jakob · TESTMINNEN**.

Fem begärda testminnen har lagts till genom minnesmodulens käll-/extraktionsväg.
Tidigare fem minnen och spelhistorik bevarades. De tio minnena finns i vanlig
chattkontext. Ett inaktivitetsprov på en separat DB-kopia verifierade att de
nya arbets-/chefsminnena ingår bland Probes fem tillgängliga kandidater.
Inga riktiga spelarkonton eller serverresultat ändrades. Testinnehåll,
DB-backup och kvitto finns privat vid QA-återstartsfilen, utanför Git.

Den gemensamma Probe-policyn sparades med Automatiskt, Luna, 5 s inaktivitet,
15 s paus, 100 procents chans och tak 12/timme; minnen 30 dagar. Övriga
inställningar bevarades och projektets vanliga revisionshistorik skapades.
Browserns egna ljud-/initiativval måste vara på. Ett obesvarat initiativ
väntar fortfarande på ny aktivitet. Faktisk Probe-uppspelning är inte
verifierad här, och kamerans syntetiska drift-/lagringsprov återstår.
Jakob uppger att Render-stegen är klara; aktuell driftsättning har inte
verifierats av agenten. Sparad browserblockering kvarstår senast känt.

## 2026-09-28 — Snabbare Probe och tydlig kameraaktivering

Jakob testar själv i sin browser och vill kunna prova kortare inaktivitet.
Båda labbytorna har nu **Snabbt inaktivitetsprov** i sin gemensamma
Probe-editor: Automatiskt, 5 s inaktivitet, 15 s paus, 100 procents chans
och högst 12 initiativ/timme. Det ändrar ett utkast; Spara krävs. Befintliga
sparade val, modell och minnesinställningar ändrades inte automatiskt.
Väntetid ned till 1 s finns sedan tidigare. Browsern kontrollerar ungefär
var 5:e sekund och generering/posegrind tillkommer. Ett obesvarat initiativ
väntar fortfarande på ny spelaraktivitet.

Ett faktiskt klientfel hittades: fokus i ett tomt chattfält satte `typing`
till true för alltid, även efter Skicka. Enbart fokus blockerar inte längre
Probe. Fokus- och input-events börjar fortfarande en ny inaktivitetsperiod;
ett utkast eller pågående kameragranskning blockerar fortfarande initiativ.
Ladda om spelfliken för klientfixen. Ny snabbknapp kräver nästa labbbygge/start.

Kameraimplementationens dokument har fått exakta aktiveringssteg: aktuell
Gateway/Director på Render, `CROUPIER_SPEECH_VISION=1` på Gateway och lokal
samordnad start med `--astrid-camera --no-open`. Därefter Luna och
Kamera → Starta → granska → Skicka. Stillbilder och transkription används,
inte kontinuerlig kameravideo till OpenClaw. Syntetiskt drift-/lagringsprov
återstår före verklig kamera. Tidigare krav på ett nytt deploymentgodkännande
är uppdaterat; Jakob har redan godkänt detta. Agentens browseråtkomst är
fortfarande blockerad av den sparade webbplatsbehörigheten.

Verifierat: TypeScript, JSON-parsning, JS-syntax, diffkontroll, samtliga
27 pre-commit-kommandon samt fyradealerasset-audit med `--probe` passerade.
Inget nytt browserprov, mediegodkännande eller Render-deploy utfördes.
Jakobs pågående lokala serverpar stoppades eller ersattes inte.
Hans ändrade manifest, nya box4-video och övriga arbetsfiler är utanför
denna leverans. Jira-anslutning saknas fortsatt.

## 2026-09-28 — Generalrepetition: minnesfel rättade, browserprov blockerat

Jakob godkände generalrepetition, bild/ljud och ett faktiskt automatiskt
Probe-initiativ efter inaktivitet. Kameraagentens `635b364` ingår redan i
arbetsgrenen. Ingen ny Render-deploy har utförts i denna omgång.

Granskningen hittade två minnesfel. Samma källcitat kunde sparas under olika
ämnes-ID och därmed kringgå repetitionsskyddet. Citat får nu ett gemensamt
fingeravtryck, äldre dubbletter döljs och enskild Glöm tar bort alla deras
alias. En additiv `evidence`-kolumn på Probe-kvitton bevarar repetitionsskyddet
även om ett minnes-ID senare ersätts. Befintlig QA-databas har inte ändrats
manuellt; migreringen sker vid nästa produktstart.

En vanlig formulering med `not` eller `inte` kunde dessutom radera alla
personminnen. Rättelsehanteringen begränsas nu till tydlig rättelse/negation
med matchande ämnesord. Osäkerhet, frågor och `actually` ensamt lämnar minnena
kvar. Berörda gamla källor pensioneras och sena extraktionsjobb ogiltigförklaras.
Detta är begränsad regelhantering, inte allmän semantisk förståelse av varje
tänkbar rättelse. **42 riktade tester** och samtliga **27 pre-commit-kommandon**
passerade. Asset-audit med `--probe` passerade för fyra dealers; ingen ny
visuell läppsynkacceptans görs.

Avancerade labbet får nu veta när det kör inom Lissabon och beskriver sparandet
korrekt: samma projekt som Lissabon och produkten, nya Deal/Replik/Probe-val
vid nästa beslut och omladdning efter idleändringar när handen är avslutad.
Videovyerna och den gemensamma guiden beskriver import via `variant/`,
inläsning och avstängning. Astrids UI har fortfarande ingen råfilradering
eller flytt mellan familjer. Inga filmer eller sparade policyval ändrades.
Typecheck, JSON-parsning och diffkontroll passerade.

Ett enda bevakat QA-par 4210/4211 byggdes och startades med bevarad separat
testprofil och gemensam Lissabon-konfiguration. Kameraflaggan var uttryckligen
på för detta test, men inga enheter eller bilder användes. Paret stoppades
igen och de kända portarna samt start-/barnprocesserna verifierades avslutade.
Återstartsfilen bygger under sessionsspärren och återställer samma profil.

Browserverktyget nekade Render och sedan localhost. Efter Jakobs förnyade
godkännande rapporterade det uttryckligen en sparad webbplatsblockering.
Ingen alternativ browser/API-väg användes för att kringgå spärren. Jakob har
fått instruktion att hantera blockerade webbplatser i appens Browser-inställning
(Chrome: Computer Use → Manage). Samordningsmeddelandet till kameraagenten
nekades också av verktygets godkännandeinställning; det skickades inte.

Kvar när åtkomsten fungerar: bygg/starta ett par med senaste ändringarna,
reversibelt spara/läsa om i båda labbytorna, verkligt inaktivitetsprov med
tillfälligt 100 procents chans och återställda ursprungsvärden, därefter
Gateway/Director-deploy för kamera. Syntetisk bild (två färgrutor) ska först
nå rätt modell och just den syntetiska sessionens lagring kontrolleras före
riktig kamera/mikrofon. Nuvarande sparade Probe har 30 procents chans och
timtak tre; det bevisar inte att varje inaktivitet ger en replik. De levande
browserproven och generalrepetitionens slutacceptans är **inte utförda**.
Jira CAC är fortfarande inte tillgängligt via anslutna verktyg.

## 2026-09-28 — Labbets felsida: kontrollerad start och bättre återhämtning

Jakob visade `Labbet kunde inte läsas` på 127.0.0.1:4188. Det exakta felet
är ännu inte återproducerat. Ingen korrupt projektfil hittades: vanliga
labbet saknar sparfil och får giltig seed; Lissabons sparade projekt validerar
strikt med 13 idlevarianter. `studioInitialData` lyckades för båda katalogerna,
med 42 tillgängliga filmer. Ingen sparad data ersattes.

En kort kontrollerad start av endast Start-Labb på 4188 gav HTTP 200,
fungerande Chrome-vy, lyckad omladdning och Probe-navigering utan browserfel.
Den tillfälliga kontrollfliken och testservern stängdes igen. Alla kända
Croupier-portar var därefter stängda. Sessionsspärren återtog och släppte
den avslutade testsessionen korrekt utan att starta någon server.

`lab/app/error.tsx` har nu full omladdning i stället för enbart React-reset.
En enda lokal hälsokontroll skiljer svarande, inte redo och onåbar server;
ingen pollning eller rå feltext visas. Sparade inställningar ändras inte,
och osparade ändringar får en kort varning. Typecheck och diffkontroll är
gröna. Detta förbättrar återhämtningen; det är inte bevis för orsaken till
Jakobs ursprungliga fel. Frågan om vilket steg som utlöser felet är ställd.

4188 är det fristående äldre labbet. Lissabons `/lissabon` där saknar
`connectedLane` och tillåter därför inte sparning. För redigerbar Astrid-lane,
starta med `Start-Lissabon.cmd` och använd 4201/lissabon, eller återstarta den
bevarade QA-miljön enligt den privata återstartspekaren. Kör ett par i taget.
Alla devservrar lämnas avstängda enligt Jakobs önskemål.

## 2026-09-28 — Ett lokalt serverpar och återanvända flikar

Jakob bad att alla lokala devservrar stoppas och att nya dubbletter spärras.
4200/4201 och 4210/4211 stoppades genom respektive startprocess. TCP-kontroll
visade även 4173, 4188, 4192/4194, 4196/4197, 4198/4199, 4212 och 4220 stängda.
Servrarna ska lämnas avstängda tills en ny start begärs. Profil, minnen och
projekt är bevarade; den privata QA-återstartspekaren är märkt `stopped`.

Lissabon, ansluten QA, offline-jämförelsen och fristående Start-Labb delar nu
en atomisk sessionspost i ignorerade `lissabon/data/.local-session.sqlite`.
Spärren tas före delat bygge/start och gäller också olika portval. Ägare,
bygg-/serverbarn och ärvda Node-workers registreras. En kraschad ägares post
återtas först när registrerade processer och gamla portar är fria. Ingen
levande process dödas för att ge plats åt en ny start. Gamla sena barn nekas
före sitt program om deras session redan ersatts.

Sex fokuserade sessionsprov kontrollerade samtidiga starter (fyra kandidater,
exakt en vinnare), olika portar, fristående labb, stale-återtagning, kvarvarande
port/barn, gamla barn efter övertagande och release vid förberedelsefel.
Samlad launcherregression gav **29/29 gröna tester**, inklusive ett riktigt
kortlivat Web+Next-par och isolerad jämförelse. Syntax, PowerShell-parser
och diffkontroll passerade. Testtjänsterna är stoppade. Sessions-/launcherproven
ingår nu i pre-commit. Ingen ny Render-deploy gjordes.

AGENTS.md och Cursor-regeln kräver `--no-open` vid Codex-start samt inventering
och återanvändning av befintlig spel-/labbflik. Rätt URL laddas om; en äldre
URL ersätts i samma flik efter att pågående inmatning/spel bevarats. Befintlig
Lissabon eller Start-Labb skriver bara adressen vid upprepad start.

Tidigare arbete är bevarat: Director `e6ea969` är live och vanlig chatt har
verifierat testminnen. `74542df` låter QA och vanliga Lissabon dela sparade
inställningar med separat spelar-DB. De två miljöerna körs framöver en i taget.
Kamerakodens separata commit `d02758a` är fortsatt avstängd i drift; dess
återstående flaggkoppling/deploy sköts av kameraagenten.

## 2026-09-28 — Chattminnet driftsatt och verifierat i Astrids spelare

Director kör nu `e6ea969dcb06926e31a0efac8079fb74e86228ce`, Render-deploy
`dep-dat1pqd9fdbs73fj0nn0`, Live **09:54:52 Stockholm**. Gateway är kvar på
`70ef43f`; minnesfixen behövde ingen Gateway- eller miljöändring.
Codex verktygsanslutning återkom efter appomstarten.

Tre syntetiska Luna-textprov genom driftsatt Director passerade: återkalla
sparat skilsmässominne trots kort historik, acceptera aktuell rättelse och
avstå från påhittat minne när fakta saknas. Textsvar tog 1,5–2,2 sekunder.
Den riktiga spelchatten på **localhost:4210** gav därefter två genererade
svar om skilsmässan respektive hunden Bosse, med röst/video och återgång till
idle utan konsolfel. Hundsvarets paket var klart efter 15,5 s, varav RunPod
rapporterade 0,137 s kö och 11,016 s rendering. Detta är ingen full visuell
läppsynkacceptans eller garanti att alla typer av blinkningar är borta.

Testprofil, chattminnen och pågående hand bevarades vid återstarten.
QA **4210/4211** och vanliga Lissabon **4200/4201** svarar HTTP 200 och har
startats efter minnesfixen. Efter Jakobs fråga om skilda inställningar läser
nu båda miljöerna samma **`lissabon/data/project.json`**. API-kontrollen visar
samma revision, idlepolicy (13 varianter) och klippfamiljer. Ingen kopiering
av policy krävs längre. Sparat modellval är GPT-6 Luna och Probe Automatiskt.

`startIsolatedConnection` har valfria `playerDataDir` och `browserHostname`.
QA använder `localhost` för både labb och spel, med en separat bevarad
spelardatabas; inga fejkade minnen lades i vanliga Lissabon. Labbet finns på
**http://localhost:4211/lissabon** och öppnar rätt 4210-spelare via Anslut.
Idleändringar kräver Spara och omladdning av spelet efter avslutad hand;
Deal/Repliker/Probe läser de senaste sparade valen vid nästa beslut.
Åtta launchertester och tre tester för beständigt projekt/profiler passerade.
Privat återstartspekare finns i
ignorerade `lissabon/data/qa-recovery.json`, med separat spelar-DB och
återstartsfil utanför Git. Den gamla QA-helperns tempstädning används inte där.

Browserregression: Astrids äldre spelare körde greeting två gånger; den lokala
Lissabon-spelaren körde goodluck två gånger och återgick till synlig idle.
Den lokala repetitionspanelens felaktiga text om saknat matchande klipp
finns kvar trots att rätt MP4 visas. Automatisk godkännandegranskning avvisade
byte till andra dealers med hänvisning till Jakobs Astrid-avgränsning;
inga omvägar gjordes. Tidigare 25 pre-commit-kommandon och fyradealerasset-
audit är gröna, men övriga dealers har inte browsergranskats för denna fix.

Kamerafunktionen är separat ocommittad WIP och Av. Inga enhetsbehörigheter
eller kamerabilder användes här. Director är fri för kameraagentens senare,
separat godkända deploy. Jira CAC saknas fortfarande i verktygsanslutningen.

## 2026-09-28 — Kamera och tal: lokal implementation, driftprov återstår

Astrids Lissabon-spelare har valfri kamera/mikrofon med VAD, högst två små
JPEG-bilder, redigerbar transkription och explicit granskning före sändning.
Samma ljudspår driver Web Speech och nivåmätaren. Probe väntar under
upptagning/granskning. Tillstånd, tracks och sena callbacks hanteras vid
stopp, profilbyte, bakgrund, navigation och fel. Modellval/minne och den
gemensamma uppspelningsvägen är bevarade; serverns spelstatus är auktoritativ.

Alla 27 pre-commit-kommandon och fyradealerasset-audit med --probe passerade.
Syntetiskt browserprov gav 0/1/2 JPEG efter rätt talfall, stoppade tracks och
ingen sändning före granskning. Riktig Chrome 154 transkriberade en syntetisk
Astrid-testreplik; Codex-browserns taligenkänning gav nätverksfel. Mobilvyn
390×844 granskades och Av/På-text samt panelens överlapp rättades.

Gatewayns faktiska version är 2026.9.5, med beständig SQLite-samtalslagring.
Luna är ännu text-only i driftmetadata. Kamerakedjan är inte driftsatt och
verklig kamera har inte använts. Featureflaggan är Av. Slutligt deploy-
godkännande, syntetiskt bildprov genom livekedjan, bildlagringskontroll och
full fyradealerrehearsal återstår. Jira CAC saknas i anslutna verktyg.
Detaljer, källor och nästa steg finns i
[implementationsrapporten](animation-events/ASTRID-CAMERA-IMPLEMENTATION.md).

Grundimplementationen `d02758a` är pushad till båda work-mirrorerna. Efter
serverspärren `52bd7c8` kopplades även `astridCamera: true`/`--astrid-camera`
genom den samordnade launchern, enbart till produktprocessen och Av som
standard. 37/37 riktade kamera-/launchertester passerade efter kopplingen.
Ingen start eller deploy gjordes. Mina testflikar och den tillfälliga publika
QA-fixturkopian är stängda/borttagna.

Ingen ny devserver startades i detta fortsättningsarbete. Egen 4212 var redan
stoppad; NY1 stoppade senare även 4200/4201 och 4210/4211. Kameraagenten
respekterar samordningsstoppet och lämnar deras bevarade QA-data orörda.

## 2026-09-28 — Chattminne och blinkning: färdig kod, drift/visuell QA återstår

Jakob bad uttryckligen om parallella underagenter och godkände meddelanden
till kameraagentens chatt `01a0e6ea-9411-7f63-86bd-98f9baaff716`.
Tre underagenter granskade chattminne, videoblinkning och server/strömvägen.

**Bekräftat i faktisk UI:** `localhost:4210/?dealer=astrid&presentation=local`
har `data-stream-lane=lissabon-stream-lane`, renderer `local`, Klippval
`active` (OpenClaw) och profilen Jakob · TESTMINNEN. Detta är samma riktiga
spelare/serverkedja som Lissabon, i separat QA-miljö. Den använder snapshotens
klippolicy, inte vanliga 4200:s senaste sparade val: resa-sig och kaffe är
manuella här, men automatiska cirka 25/90 s på 4200. Servern äger spelet;
browsern sätter ihop MP4-filer. Inget manuellt klippprov eller Render-renderad
kontinuerlig videoström användes. Manifestet saknar dealer-hole-familjen.
Varningen om 2D-reserv kan ligga kvar under fungerande idle, eftersom
`resumeIdle` inte nollställer föregående händelses varning.

**Minnesbugg:** `/chat` fick kort chattlogg men inga `player_probe_facts`.
Servern skickar nu högst 20 scoped, giltiga fakta/8 KB i valfritt
`status.conversationMemory`, separat från chattinläggen. Exakta spelarutsagor
och serververifierade handresultat skiljs åt. Director validerar fältet och
instruktionen använder relevanta minnen naturligt, inklusive spelarinitierat
svårt personligt ämne. Minnesläsning beror inte på Probe Av/Textprov.
Glöm/korrektion/TTL/policyändring stoppar inaktuellt svar; asynkrona kontroller
körs också före kostsam TTS/GPU-generering. Ingen ny källa fabriceras i
chatthistoriken och känsliga faktas vanliga extraktionsregler ändras inte.

**Blinkning:** genererat tal skapade ett ogenomskinligt mörkt lager före
avkodning och startauktorisering. Lagret hålls nu dolt tills första faktiskt
presenterade videobild. Sena callbacks och avbrott kan inte visa gammalt tal.
Ingen videofil, ljudfil, kalibrering eller idleloop byggdes om. Alla upplevda
blinkningar är ännu inte visuellt förklarade; idle använder fortfarande en
ny dekoder per loop och håller föregående slutbild under bytet.

Verifierat: 69 riktade minnes-/kontraktstester, 31 riktade player-/idleprov,
samtliga 25 pre-commit-kommandon och `audit-dealer-sync --probe` godkända.
Två kopierande testfixturer fallerade först på den nya modulsökvägen och
rättades; berörd BO-gate, generation-media-gate och extra table-http 9/9
kördes därefter gröna. Fixturer kopierar endast runtimekällkod till egen
temporär repo-layout, aldrig privata miljöfiler/data. Hela gatekedjan
kördes i avgränsade delar; testresultaten är inte visuell läppsynkacceptans.

**Kvar att göra, i denna ordning:**
1. Driftsätt denna minnesfix i Render **Director** `srv-danhlpjtqb8s73bv530g`.
   Gateway behöver inte bytas för detta fält. Gör ett syntetiskt chattsvar
   med sparat minne genom den driftsatta kedjan. Äldre Director avvisar fältet.
2. Starta om lokal produktserver med **bevarad** QA-data och bevarad hand.
   Nuvarande helperns Ctrl+C raderar dess tempdata: använd inte den för
   omstart utan att först bevara hela testprofilen och chattminnet.
   QA ligger på `C:/WINDOWS/TEMP/croupier-probe-qa-zM5LwO/studio`; vid senaste
   läsning fanns ingen pågående chatt/Probe men en hand i `decisions`.
3. Kör browserkontroll av minnesdialogen och två på varandra följande tal;
   fyradealerrehearsal två gånger/dealer återstår för denna playerändring.

**Blockerare i denna session:** CUA-browserverktyget och Codex-appens
chattverktyg började svara `Transport closed`. Två browserförsök samt reset
misslyckades; ett samordningsmeddelande till kameraagenten kunde inte skickas.
Ingen befintlig Render API-nyckel/deploy-hook fanns i de konfigurerade privata
miljöfilerna. Ingen credential skapades. Jakob ombads återansluta verktyget.
Nuvarande servrar kör därför fortfarande tidigare backend; inget falskt
driftgodkännande ges. Jira CAC saknas fortfarande i verktygsanslutningen.

Kameraagenten äger nya `astrid-camera-*`/`astrid-observation`-filer samt
`web/public/app.mjs`, `lissabon-profile.mjs`, CSS och kameratester; dessa är
inte del av denna leverans. Agenten bekräftade att den väntar med
`web/server.mjs`, `web/openclaw-chat.mjs` och `product-speech.mjs` tills vår
minnesfix är committad. Efter commit är de tre filerna fria för kameraintegration.
Samordna nästa deploy så ingen ofärdig kamerafunktion följer med.

## 2026-09-28 — Luna som standard och automatiskt prov med fem fiktiva minnen

Jakob valde GPT-6 Luna för Astrid. `probe-policy.seed.json` använder nu
`gpt-6-luna`; Av är fortsatt startläge. Liveprojektet i Lissabon sparades via
UI med Luna, med användarens Textprov/10 s/300 s bevarade. Detta gäller nästa
vanliga Astrid-chatt, Probe och minnesutdrag utan Render-omstart. Andra roller
och tidigare uttryckliga modellval i andra sparade projekt ändras inte.

På Jakobs begäran finns fem **fiktiva** provminnen: skilsmässa, påstådd
miljonvinst, hunden Bosse, gitarr och Lissabonresa. Tre nya märkta fixtures
gör totalt 23 textkontexter. `tools/probe-qa.mjs --speech --demo-memories`
skapar egen temporär databas, Lissabon-snapshot och **Jakob · TESTMINNEN**.
Det tar inga externa databas-/spelar-ID:n och ändrar inget verkligt saldo
eller handresultat. Direkt testseeding bevisar inte att minnesextraktionen
skulle acceptera känsliga personuppgifter eller påstådda spelvinster.

Testmiljön på **localhost:4210/4211** kör Automatiskt, Luna, 10 s inaktivitet,
30 s paus, 100 % urval, högst 12 försök/timme. Hostname skiljer sig från
vanliga Lissabons **127.0.0.1:4200/4201**, så cookies/profilbyten separeras.
Egna talinitiativ, ljud, lugnt bord och ett obesvarat initiativ gäller fortsatt.
Välj testprofilen och öppna Minne. Fokusera/lämna tomt chattfält för ny aktivitet.
Vanliga Lissabons profiler och policy har inte fyllts med testminnen.

Verifierat mot befintlig drift: Luna gav hundrepliken
“You mentioned your dog Bosse—hope he’s doing well.” i textprovet. Hon avstod
från att ta upp skilsmässan spontant; storvinstfallet gav `no_memory`.
Automatiskt Probe i riktiga lokala spelaren genererade och **spelade**
“How’s learning guitar going so far?” från testminnet. SQLite-kvittot
`28913c99-f6d6-4f6e-895a-e03be1871e39` gick till `played`, 67,604 ms från
reservation till färdig uppspelning. UI visade samma replik. Detta är ett
funktionellt uppspelningskvitto, inte visuellt läppsynkgodkännande. Ett tidigare
gästförsök avbröts vid profilbyte. Jakob började därefter skriva i testfliken;
lämna hans pågående session och QA-servrar igång. Två kontrollerade tal i följd
har ännu inte slutförts. Vid slutlig nedstängning: notera att helperns Ctrl+C
raderar den temporära miljön; spara användarens eventuella nya material först.

Separat `.next-probe`-bygge inklusive TypeScript och 15 Probe-tester passerade.
Autogenererade ändringar av tsconfig/Next-typimporter återställdes till läget
före bygget, utan att röra befintlig `next-env.d.ts`-arbetskopiestatus.

Arkitekturfrågan utredd: `presentation=local` spelar Emils lokalt serverade
MP4-filer i browsern; Render ger OpenClaw-beslut/text, Cartesia/RunPod nya
talpaket. Ingen kontinuerlig färdigrenderad videoström från Render används.
Originalvägen utan parametern är en annan presentation. Livevyn visade
`Exakt film saknas · 2D-reserv`, medan aktiv idle var 1080×1920
`idle_still_f73_s302.mp4`, Klippval=OpenClaw, utan fångade varningar/fel.
All klipptäckning eller orsaken till upplevt hack är därmed inte godkänd;
videospelaren/mediabytes ändrades inte under detta arbete.

Kamera/bildgranskning är ännu inte implementerad. Ett komplett överlämnings-
uppdrag finns i `docs/animation-events/ASTRID-CAMERA-AGENT-PROMPT.md` och
hänvisar till versionskontroller, kontrakt, samtycke, stoppvillkor och QA i
kameraplanen. Ingen annan agent har startats eller meddelats. Jira CAC saknas
i anslutningen; inga ärendestatusar kunde uppdateras.

## 2026-09-28 09:11 — Ren lokal omstart på Jakobs begäran

Gamla Croupier-flikar och de identifierade servrarna på 4200/4201 samt
QA-servrarna på 4210/4211 stängdes. QA-data lämnades på disk; inga profiler,
minnen eller sparade medieval raderades. `node lissabon/start.mjs --no-open`
byggde senaste `de07f83` med godkänd nätåtkomst och startade bara 4200/4201.
Next/TypeScript passerade, båda sidorna svarade och labbets health visade
`lissabon-stream-lane`. Lissabon → Anslut öppnade en länkad Astrid-flik med
`presentation=local`; två nya flikar lämnades öppna i Codex. Profilväljaren
visar den bevarade Jakob-profilen och väntar på användarens val.

Loggens 5 SEK/timme gäller den privata kompanjonens webbsökhjälp, högst tio
försök à 0,50 SEK reserverad kostnad per rullande timme. Det är ingen total
budget för produktchatt/Probe/röst/GPU. Jakob frågade om 15 SEK vore bättre;
gränsen lämnades på 5 eftersom höjningen bara ger fler sökförsök. Loggens
`shutdown budget` avser avstängningstid i millisekunder, inte pengar.

## 2026-09-28 — Probe i drift och rätt Lissabon-presentation

Gateway/Director är live på `70ef43f`; de gamla driftblockerarna nedan är
ersatta av [driftkvittot](../open-claw/lab/docs/DEPLOYMENT-RECEIPT-2026-09-28.md).
Åtta auth-/schemaprov passerade. Alla tre modellkandidater finns i beständig
Gateway-konfiguration med oförändrad primärmodell och nekade verktyg.
60 syntetiska textfall passerade; varm p50: 5.4-mini 977 ms, Luna 1342 ms,
Terra 1847 ms. Luna är en rimlig testkandidat, inget generellt vinnarbesked.

Browser-QA hittade en viktig presentationsgräns: en normal idlevariation
kunde stoppa väntande Probe-video. För ett redan pågående initiativ tillåts
nu bakgrundsidle under förberedelsen. Kortspel, annan chatt/tal, frånvaro,
avstängt ljud och gamla revisioner stoppar fortfarande. Färdigt paket går
till samma neutrala posegrind som vanlig chatt. Talprovet visar dessutom ett
bestående resultat med avbrottsorsak. Fel i en benchmarkgeneration registreras
utan automatisk retry och utan att dölja resterande modellkandidater.

Verifierat: 23/23 riktade Probe-/presentationstester inklusive bakgrundsidle
mot spelhandling, samt `audit-dealer-sync --probe` (Astrid 17 repliker,
0 saknade takes; inget visuellt godkännande). Ett syntetiskt Luna-paket nådde
faktiskt `played` i Astrids `presentation=local` på localhost:4210. Därefter
började Jakob använda denna QA-session; lämna den och dess processer ifred.
Två nya genererade tal i följd återstår att verifiera i en ledig testsession.
Samtliga 25 kommandon i `.githooks/pre-commit` passerade efter rättningen.

Rätt vanlig ingång: `http://127.0.0.1:4201/lissabon` → Anslut →
`http://127.0.0.1:4200/?dealer=astrid&presentation=local`.
`rehearsal=1` ensamt använder den äldre vägen. Porträttfilmerna från Emil
används även på dator; inga särskilda datorfilmer har antagits finnas.
Andra agentens `4988f96`, mediafiler och lokala klippval bevaras.

Kamera/mikrofon är inte aktiverat. Version 2026.9.5 dokumenterar bilddelar,
men produktkontrakt och modellmetadata är textbaserade. Konkret avgränsning,
samtycke, storleksgränser, VAD och återstående verifiering finns i
[kameraplanen](../open-claw/lab/docs/ASTRID-CAMERA-VOICE-PLAN.md).
Inget råljuds- eller bildstöd har påståtts fungera i drift. Jira-anslutning
saknades fortfarande; inga CAC-statusar ändrades.

## 2026-09-28 — Astrid: 30 idlevarianter och klipp från croupier_kaffe

Jakob bad om högst 30 idlevarianter, import av klipp från
`C:\Users\jakem\Desktop\croupier_kaffe`, 1080p framför 480p samt en ren
omstart av lokala webbläsare och devservrar. Arbetet är avgränsat till Astrid;
parallell agent äger OpenClaw/Render.

- Gränsen är 30 i runtime, schema, editor och tester. Befintliga sparade
  inställningar bevaras. Lissabons versionsmärkta snapshot har nu 13
  idlevarianter: sju äldre och sex importerade 1080p-varianter som manuella
  prov. Vid start läggs saknade rader till utan att skriva över lokala val.
- Två boxvarianter ligger under `deal_pos1/variant` och `deal_pos2/variant`.
  Fem nya idlefiler kopierades; den redan lokalt förekommande
  `idle_resa_sig.mp4` matchade 1080p-källan byte för byte och registrerades.
  Kaffeklippet fanns redan och matchade källan byte för byte. 480p-originalet
  användes inte. Manifestet omfattar 42 klipp i 26 familjer.
- Lissabons lokala projekt har sparats med de fem nytillagda idleklippen som
  manuella prov. Den äldre lokala inställningen för `idle_resa_sig` är fortsatt
  automatisk; snapshoten för nya installationer sätter den manuellt. Lokala
  val skrivs inte över vid uppgradering.
- De identifierade lokala Croupier-servrarna och Chrome-fönstren stängdes.
  `node lissabon/start.mjs --no-open` byggde om och startade 4200/4201 med
  godkänd nätverksåtkomst. Båda startsidorna gav HTTP 200; produktens
  `/api/presentation/config` visade 13 idlevarianter. Lissabons UI visade
  båda boxvarianterna och 13 idlevarianter; boxklippen och en 1080p-idlevariant
  kunde spelas i lokalt prov.
- Rehearsal i den riktiga spelaren körde `greeting` två gånger i följd för
  Astrid, Vera, Amira och Mei. Spelaren återgick till redo läge för varje
  dealer. Detta var en snabb regressionskontroll, inte nytt godkännande av
  läppsynk.
- `node pipeline/build-lab-video-manifest.mjs --check`,
  `node pipeline/audit-dealer-sync.mjs --probe` och 35 riktade tester passerade.
  Audit: Astrid har 17 repliker, 0 saknade talpar; visuellt synkgodkännande
  återstår. Pre-commit-sviten kördes för media-/playerändringen.

Förslaget om valbar kamera/mikrofon och bildprov under tal skickades till den
separata OpenClaw-chatten. Det är en designuppgift, inte en aktiv funktion.
Render-återdeploy och driftskontroll tillhör den agenten. Jira CAC var inte
tillgängligt via denna verktygsanslutning; inga ärendestatusar ändrades.

## 2026-09-28 — Probe rollout: preserve repeated Gateway migration backups

The first Gateway deployment of `d5bcc8d`, `dep-dat0mb17lnhs73b6fjkg`,
failed before replacing configuration: a previous speech migration backup
already occupied the fixed backup filename. Render's previous live source
was `f2f24d305cac2415a533796401ef89f2125fa7ac` (newer than the Sep 25 receipt).
`preserveConfigBackup` now retains that original backup and writes a separate
SHA-256-addressed backup when the source bytes differ. Matching retries reuse
the same backup; a conflicting revision backup still stops replacement.
No persisted backup, session or configuration has been deleted.

Verified: 45/45 Gateway config/startup/runtime-bundle tests, including repeated
model reconciliation, preserving human agent settings, and conflicting backup
protection. Isolated Next `.next-probe` build also passed. Rollout retry and
live model/Probe checks are pending; see the subsequent deployment receipt.

## 2026-09-28 — Astrid Probe, modellval och senaste insamlade runda

Implementation på `jakeminator123/work`, ovanpå `1a3160a`. Jakob avgränsade
fortsatt arbete till Astrid. Detaljer, lagring och rollback:
[ASTRID-PROBE-IMPLEMENTATION.md](animation-events/ASTRID-PROBE-IMPLEMENTATION.md).

- Probe finns i Lissabon och `/probe`, samma sparade policy, Av/Textprov/
  Automatiskt, syntetiska textfall, källminnen/Glöm och separat knappstyrt
  talprov i verkliga spelaren. 409 bevarar utkast och kan slå ihop ändringar.
- Servern reserverar initiativ per autentiserad spelare. Närvaro, aktivitet,
  policyversion, cooldown och minnesgeneration kontrolleras före modell,
  TTS/GPU och faktisk talstart. Efterfrågad chatt kan avbryta en probe och
  inväntar dess resursstädning. Uppspelad probe har ett separat atomiskt kvitto.
- Chattens gräns är 30 meddelanden/8 000 tecken. Ett litet separat SQLite-minne
  håller belagda user-citat och exakta avslutade handsekvenser i högst 30 dagar.
  Korrigering pensionerar konservativt personliga fakta; Glöm stoppar sena svar.
- Vanlig Astrid-chatt får `playResults.lastRound`, serverns senaste insamlade
  rundas insats/retur/netto även efter nästa start. Prompten skiljer denna från
  totalresultat och ber om naturliga svar utan interna spelsystembegrepp.
- Modellen kan väljas för Astrids chatt och Probe. Standard är fortsatt
  Gatewayns nuvarande modell; senast driftverifierad var 5.4-mini den 25/9.
  Luna/Terra är kandidater, inte uppmätta vinnare. Ingen annan roll byts.
  Officiella OpenClaw-integrations- och MCP-länkar finns i källindex och UI.

Verifierat lokalt, isolerade testdatabaser:

- Samtliga kommandon i `.githooks/pre-commit` passerade. Nya Probe-testfilen
  har dessutom lagts till i hooken och passerar 14/14.
- 197/197 riktade Probe/minne/tal/OpenClaw/deploytester passerade. Därefter
  tillagda token-/observerkontroller passerade med berörda filer, 17/17.
  Produktens HTTP-svit passerar 24/24, inklusive senaste runda, scope,
  cross-origin-spärr och Av utan modellcall.
- Next webpack-build i separat `.next-probe` passerade inklusive TypeScript;
  TypeScript kontrollerades igen efter sista UI-ändringarna. Inga befintliga
  `.next`-byggfiler eller gemensamma 4200/4201-processer ersattes.
- Browser på localhost:4211: samma policy i `/probe` och `/lissabon`, sparning
  och verklig HTTP 409. Oberoende ändringar 100 s/310 s slogs ihop och sparades.
  Endast temporära QA-inställningar ändrades. Astrids faktiska spelare på 4210
  öppnades med Minne och separat talprov; inspelad `goodluck` kördes med Play twice.
  Rehearsal-panelens äldre text säger fortfarande "matching clip missing"
  för denna Astrid-väg trots den synliga lokala filmen; inget nytt synkgodkännande.
- `audit-dealer-sync --probe` passerade: Astrid 17 repliker, 0 saknade takes.
  En hash-/assetkontroll är fortsatt inget visuellt läppsynkgodkännande.
- Bred labbsvit före andra agentens pågående idleuppdatering: 467/474 gröna.
  Sju fel gällde befintliga antalsantaganden om idle/manifest och Stage-källtext.
  Dessa filer/medier ägs av annat arbete och har inte reparerats eller stageats
  här. Den egna komponenttest-laddaren uppdaterades för de två nya editorerna.

**Drift återstår:** Director-status är autentiserat nåbar (200), men listan
saknar `product-probe-v1`. Första syntetiska modelljämförelseanropet fick 401
på den nya produktvägen; jämförelsen avbröts utan röst/GPU. Det finns ingen
ny `PROBE_API`-nyckel att skapa: de nya endpointarna använder befintliga
speech- respektive labbtoken. Ingen Render-deploy har gjorts här.

Driftsätt granskad kod på befintlig Gateway/Director före en lokal omstart
med nya kontrakt: äldre Director känner inte `lastRound`, 30 meddelanden
eller modelloverride. Behåll tjänsteplaner, hemligheter och GPU-budget.
Kontrollera den faktiskt laddade modellen och kör därefter textjämförelsen
samt två genererade Astrid-paket i riktiga spelaren. Genererad Probe och dess
visuella synk har alltså ännu inte verifierats mot Render. Jira saknas i
verktygsanslutningen; inga CAC-statusar har ändrats.

## 2026-09-28 — Devchatt återställd efter nätverksnekad serverstart

Den öppna Astrid-fliken visade "Svaret kunde inte slutföras". Båda
lokalservrarna och labbets röstkonfiguration svarade normalt, men ett
syntetiskt gästprov genom produktens `/chat` gav `product_speech_unreachable`
direkt efter textsteget. Utgående HTTPS från den begränsade körmiljön gav
`EACCES`; ett separat OpenClaw-textprov med godkänd nätverksåtkomst svarade
på 3,3 s. Det var startmiljöns nätverksbehörighet som stoppade devchatten.

Den verifierade Lissabon-startprocessen stoppades och samma befintliga
bygge startades med godkänd nätverksåtkomst:
`node lissabon/start.mjs --no-open --skip-build`. Startarens egna begränsning
till konfigurerade tjänster behölls. Profiler, pågående sparad hand,
projektinställningar och andra agenters filer ersattes inte.

Efter omstart verifierades **produktens riktiga `/chat`-kedja** med en
separat syntetisk demogäst: text "Hello" efter 1 389 ms, video-submit efter
1 725 ms, render påbörjad efter 44 591 ms, färdigt talpaket efter 71 428 ms.
RunPod rapporterade 42 400 ms kö och 25 828 ms exekvering. Slutresultatet var
`generatedText` med `speechPackage`. Detta verifierar OpenClaw → Victoria →
RunPod genom devservern, inte visuell läppsynk eller faktisk uppspelning i
Jakobs flik. Ingen ny testfråga lades i Jakobs personliga chatthistorik.

Startguiden `lissabon/README.md` förklarar felet och återstarten. Ingen
produktkod ändrades. Dokumentationsdiffen är kontrollerad; kod-/medietester
har inte körts om för dessa dokumentationsändringar. Probe-uppdraget låg
redan pushat i `c18c3cc`. Nästa agent kan fortsätta därifrån. Kvarvarande
lång väntan i GPU-kön är separat från det återställda anslutningsfelet.

## 2026-09-28 — Uppdrag för Astrid Probe förberett

Jakob vill ha en separat Probe-kategori för sporadiska, personliga
talinitiativ vid inaktivitet, cirka 30 meddelandens närminne och ett litet
anekdotminne med cirka 30 dagars livslängd. Implementationsuppdraget finns
i [ASTRID-PROBE-AGENT-PROMPT.md](animation-events/ASTRID-PROBE-AGENT-PROMPT.md).
Det beskriver gemensam editor i Lissabon och stora labbet, belagda minnen,
serverstyrda tillfällen, skydd mot upprepningar, Victoria, modelljämförelse
och konkret verifiering. Tidsgränserna är föreslagna redigerbara startvärden.

**Probe är inte implementerat av denna dokumentationsleverans.** Ingen
agent har startats och ingen modell, policy, databas eller tjänst har ändrats.
Tidigare Lissabon- och Victoriaarbete var redan sparat till och med
`57a3f00` på båda work-remotes. Aktuell kod har 12 historikmeddelanden;
senast driftverifierad produktmodell är GPT-5.4-mini den 25 september,
inte en ny livekontroll av Gateway i denna tur. Nuvarande manifeständring
och äldre ospårade filer tillhör inte denna leverans och lämnas orörda.

Verifiering: dokumentationsdiff samt 16 källsökvägar och handoff-länken kontrollerade.
Inga runtime- eller medieändringar har gjorts; tidigare kvarvarande
uppspelningsgranskning och GPU-tidsmätning gäller fortsatt.

## 2026-09-28 — Astrid: Idleimport, Deal-vy och Lissabon-omstart

Lissabon har nu en separat, kompakt **Deal**-flik med Astrids sju
spelarpositioner och `deal_posdealer`. Den visar exakt standardfilm, lokalt
videoprov och vägen till samma variantpolicy i Eventstudion. Idle har fått
`croupier_coffie.mp4` som manuell engångsvariant (6 042 ms); Jakobs sparade
`idle_cheek` och övriga befintliga val skrevs inte över. Den lokala
projektmigreringen lägger bara till den nya varianten i äldre sparade projekt.

**Läs in nya filer** skannar Astrids lokala videomappar och publicerar ett nytt
manifest atomiskt. En ny fil i `idle/variant/` blir därefter synlig i
Idleeditorn och behöver läggas till i policyn, väljas som Manuell, Automatisk
eller OpenClaw och sparas innan spelet kan använda den. Spelfliken laddas om
efter avslutad hand; OpenClaw behöver inte startas om. Ingen filuppladdning
till Render behövs. För manifeststyrda Astrid-klipp visar labbet ett tydligt
fel vid saknad video i stället för att ge sken av att en 2D-reserv bevisar
uppspelning. Den fristående sociala provytan behåller sitt separata provläge.

`npm run build` i `lab/` och 11 riktade tester passerade. Tidigare i arbetet
passerade `pipeline/audit-dealer-sync.mjs --probe` och varje övrigt kommando i
`.githooks/pre-commit` kördes manuellt i PowerShell eftersom Bash-körningen
nekades av Windows (`E_ACCESSDENIED`). Det enda lokala undantaget är
`build-lab-video-manifest.mjs --check`: en annan agent lade samtidigt en
ospårad `idle_resa_sig.mp4` i samma mapp, efter att kaffemanifestet byggdes.
Den filen är orörd och ingår inte i denna leverans. Lissabon byggdes om och
startades om; 4200 och 4201 svarar, Deal-vyn visar alla åtta klipp och Idle
visar kaffeklippet som manuellt samt bevarad automatisk `idle_cheek` på 55 s.
Kaffeklippet spelades lokalt till avslut och basloopen återupptogs. Det är ett
uppspelningsprov, inte ett visuellt godkännande av läppsynk. Jira CAC kunde
inte uppdateras: ingen Jira-anslutning finns i denna miljö.

Återstår: tidsmätning av RunPod-kö, GPU, kodning och överföring innan
läppsynkoptimering; verklig spelchatt/idle-val i ansluten spelflik; mänsklig
granskning av exakta filmer och kortkontakt. Inga GPU-worker- eller
OpenClaw-agentinstruktioner ändrades här.

## 2026-09-28 — Lissabon idle: modellval, spar-konflikt och kostnadsbild

Lissabons Web-spelare får `idlePolicy` och videoinventering via
`/api/presentation/config` vid laddning. Nya chattmeddelanden går via
`/api/presentation/idle-advice`; servern läser det sparade projektet och
skickar bara tillgängliga, `openclaw`-markerade variantfiler med deras
beskrivningar som tillfälliga kandidater till Render Director. Filerna behöver
inte laddas upp till Render. Att finnas i mappen ger inte automatiskt ett
modellval: ett svar kan också behålla basloopen och tal/spel går före idle.

Vid undersökningen var alla sex idlevarianter lokalt tillgängliga. Det senast
sparade projektet hade `idle_cheek` som `automatic`, cirka var 6:e sekund;
den öppna Lissabonfliken visade ett osparat 12-sekundersvärde, medan Jakob
nämnde 25 sekunder. Jakob bekräftade att automatläget var avsiktligt.
`idle_cheek` ska därför inte förväntas väljas genom chatt i denna policy.
Den öppna flikens sparförsök fick HTTP 409 eftersom
projektets revision hade ändrats av en annan sparning. Detta följer
`project-store.mjs` och orsakades inte av den föregående handoff-commiten
eller RunPod-inställningen. Ingen serveromstart behövs. Ladda om labbfliken
för ny revision först efter att osparade val noterats; spara önskad policy och
ladda därefter om spelfliken när handen är klar. Ingen projektfil ändrades här.

Render Director svarade på `/healthz` och autentiserat `/api/status` med 200.
Ett syntetiskt, isolerat skuggprov med `idle_cheek` tillfälligt markerad
`openclaw` i minnet gav `provider: responded`, kontextkontrakt v2 och valde
`idle_smile` för ett vänligt skämt. Både smile och cheek beskriver nu vänliga
skämt. Ytterligare syntetiska skuggprov med den faktiskt sparade policyn
valde `idle_yawn` för uttalad trötthet, `idle_insulted` för en tydlig
förolämpning och `idle_glance` för fundering; neutralt lyssnande gav inget
variantval. Render får alltså kandidaterna och deras beskrivningar, men
modellvalet är inte ett löfte om uppspelning. `shadow` beräknar bara
`wouldChooseId` och spelar inte varianten. Skuggproven kördes utanför
webbläsaren, spelade ingen video, sparade inget projekt och ändrade ingen
OpenClaw-konfiguration. Lissabon använder en Web-spelare och labbets Ström
som observationsvy, inte två samtidiga Astrid-renderingar. Labbets
observationslogg var frånkopplad, så verkligt klippval och uppspelningskvitto
för Jakobs tidigare meddelanden kunde inte rekonstrueras.

Läppsynkens separata läsgranskning fann att Croupier kastar arbetarmätningen
`output.t` och använder ett `/run`-jobb per svar. Mät först RunPod-kö,
arbetarens GPU/kodartid, NVENC mot x264, överföring och tid till bild innan
sessionsväg eller videokvalitet ändras. RunPods publika RTX 4090-nivå är
$1,10/h för flex, cirka $0,37 per 20 minuters tomgång; en ständigt aktiv
arbetare anges till $0,77/h, cirka $18,48/dygn, före lagring och övriga
tjänster. Den faktiska endpointen kontrollerades åter: `workersMin: 0`,
`idleTimeout: 1200`, `workersMax: 5`, `QUEUE_DELAY: 4`.
Under denna läsgranskning uppdaterades `work` separat till commit `102fdcf`;
en ny ospårad idle-MP4 dök upp i arbetskopian. Den ingick inte i arbetet
och lämnades orörd.

## 2026-09-28 — RunPod: 20 minuters varm tomgång, därefter noll arbetare

På Jakobs begäran ändrades den befintliga endpointen `astrid-spel-lipsync`
från `workersMin: 1`, `idleTimeout: 60` till `workersMin: 0`,
`idleTimeout: 1200` sekunder. `workersMax: 5` och `QUEUE_DELAY: 4` behölls.
En read-only GraphQL-kontroll efteråt bekräftade dessa fyra värden. Den
tidigare lokala tvåtimmarsvakten (PID 27252 och 34760, terminalsession 4371)
stoppades och processerna finns inte kvar; den ska inte återställa den nya
konfigurationen. Beskrivningen av min 1 och vakten i avsnittet nedan är
historik och ersätts av denna inställning. Ingen kod eller lokalt media ändrades.

En färdig request håller en flex-arbetare varm i upp till 20 minuter medan
GPU-tid faktureras, sedan kan endpointen skala ned till noll. En öppen
webbdemo utan nya requests räknas inte som aktivitet. Nästa request efter
nedskalning kan få kallstart. Offentlig RunPod-listpris för Serverless RTX
4090 är $1,10/h, så en full 20-minuters tomgång kostar ungefär $0,37 per
arbetare, utöver själva körningen och eventuell lagring. Kontrollera faktisk
faktura för kontospecifik taxa.

Emils separata `astrid-gpu-worker` lästes på GitLab: MuseTalk genererar
ansiktsrutor på 256×256 och kompositionen använder en munmask mot en
oförändrad bakgrund. FFmpeg kodar ändå hela 1080×1920-bilden som H.264 för
varje bildruta. Därför kan render, kodning och överföring fortfarande vara
flaskhalsar trots att bara munområdet får nytt bildinnehåll. Detta är en
kodgranskning, inte en uppmätt tidsprofil. Emils V3-repo är bara en inaktiv
kopia under `emil/astrid-demo-v3-reference/`; den aktiva ändringen här gäller
RunPods delade endpoint, inte Emils repo.

## 2026-09-28 — Lissabon: kortare upplevd väntan och mätbar RunPod-tid

Jakob bekräftade att läppsynken fungerar, men att ett kort chattsvar kan dröja.
Ett uppmätt svar tog 58,7 s till talstart: cirka 35,6 s från RunPods
`IN_QUEUE` till `IN_PROGRESS` och 16,9 s därifrån till färdiga medier.
Tre senare svar tog cirka 8,1, 11,7 och 12,5 s med ungefär 0,5 s i kön.
RunPod-endpointen `astrid-spel-lipsync` hade `workersMin: 0`,
`workersMax: 5`, `idleTimeout: 60` s och `QUEUE_DELAY: 4`. En öppen demo
garanterade alltså inte en varm worker.

För ett tidsbegränsat lokalt demoprov ändrades endpointens `workersMin`
till 1, med övriga fält bevarade, och en lokal återställningsvakt startades.
Detta prov avslutades genom den nya fjärrinställningen i avsnittet ovan.

Genererad svarstext strömmas nu som en provisorisk chattrad direkt efter
OpenClaw-beslutet, innan röst och video är färdiga. Texten blir permanent först
vid spelarens godkända visning; fel och avbrott tar bort den. Svaret kontrolleras
mot den slutliga exakta texten. RunPods rapporterade kö- och körningstid samt
videostorlek följer med `media`-steget till lokal observation och statusdata;
kö och körning syns även i statusens tooltip. Detta ändrar inte ljud/video,
spelarkod, befintliga talpaket eller serverägt spel.

Det finns ingen redan godkänd exakt `Hello!`-tagning i Astrids aktiva bank,
så ingen inspelad snabbväg för det svaret aktiverades. En sådan kräver exakt
text, ljud, video, bildruteindex, kalibrering och visuell acceptans per tagning.
Även med varm worker återstår full videorendering och nedladdning före talstart.

Verifiering: 52 riktade tester, hela `.githooks/pre-commit`, Next-bygge/
TypeScript samt `node pipeline/audit-dealer-sync.mjs --probe` passerade.
Lissabon är igång på 4201 och spelet på 4200. Inga aktiva mediefiler eller
spelarmappningar ändrades, så fyrdealers visuell repetitionsgranskning behövs
först när en inspelad tagning integreras. Kända auditluckor kvarstår:
Vera 8, Amira 2 och Mei 3 saknade taltagningar; visuell lipsynkacceptans
återstår. Ingen ny betald end-to-end-latensmätning har gjorts efter
kapacitetsändringen.

## 2026-09-28 — Lissabon GitLab branch retired

At Jakob's request, deleted only `refs/heads/jakeminator123/lissabon` in the canonical `scout-gg/croupier` GitLab project. Immediately before deletion it pointed to `d321e3f`, which is an ancestor of `jakeminator123/work` at `cec5a15`; there were zero open merge requests with the Lissabon branch as source, and the branch was not protected. Verified afterwards that the GitLab Lissabon ref is absent while the work ref remains. Also deleted the one-shot Codex automation that was to repeat this check on 2026-09-29 at 22:00 Stockholm time. The separate `Jakeminator123/lissabon` project, local `lissabon/` directory, GitHub work mirror, `main`, and active media were not touched. No gameplay tests were needed for this branch-only cleanup.

## 2026-09-28 — Cleanup handoff for the next agent

Current shared checkout: `jakeminator123/work`. The last completed cleanup commit is `81ac615`, already mirrored to canonical GitLab and private `Jakeminator123/github-work`. The ignored `.croupier-inbox/` is now 13.7 MiB after removal of a clean historical worktree and duplicate tool downloads; its identities, read cursors, cache, QA evidence, and verification logs remain. It is already excluded by `.gitignore` and must not be used for worktrees, media, or broad searches. No further safe bulk deletion was identified.

Astrid V3 is an **inactive** reference under `emil/astrid-demo-v3-reference/`: 217 real MP4 files plus the manifest, exact multilingual lines, card positions/masks, start plate, and source notes. Keep these for review. Lissabon's active lab manifest still contains 33 files from `emil/dealklipp-v1`; importing V3 did not activate those clips. Existing mobile chat/card overlays and generated-speech latency remain outside this cleanup and were not re-tested here.

During handoff preparation, another agent was actively modifying tracked files under `web/` and `test/`; treat their ownership as unconfirmed and do not stage or delete them. Five older untracked files also remain: `.agents/skills/source-command-chef/SKILL.md`, `Start-Lissabon.ps1`, `docs/animation-events/ASTRID-2D-AVATAR-PACK-PROMPT.md`, `random-stuff-jakob/astrid_motorklipp.txt`, and `random-stuff-jakob/croupier-observation-2026-09-21T00-07-56-650Z.json`. Review ownership before deciding their fate. Local servers were listening on 4200/4201, so `lab/.next` and `lab/node_modules` were left intact. No active media, game, or player file was changed by this cleanup.

For concurrent work, rerun `git status` and inspect HEAD before staging, stage only task-owned paths (never `git add -A`), and run `node tools/croupier-chef.mjs status` before shared integration/push. On this branch use `node tools/push-work-mirrors.mjs` only when its preflight shows the intended ancestry. Do not reset, clean, force-push, or include another agent's work in a cleanup commit. This handoff was checked with `git diff --check`, Git ignore/worktree status, installed FFmpeg/jq execution, and the read-only inbox state command; no gameplay regression tests were needed for documentation-only changes.

## 2026-09-28 — Local inbox directory cleaned and scoped

The local `.croupier-inbox/` was introduced by Jakob's inbox workflow (initial tool commit `51aea06` on 2026-09-20). GitLab work item 1 is the actual shared inbox; the ignored local directory holds only identities, cursors, a shared API cache, chef state, and drafts. The directory had grown to 3,355.9 MiB because a clean, detached `openclaw-publish` Git worktree (2,928.5 MiB) and duplicate Windows test-tool downloads (about 414 MiB) had been placed under it. Git metadata names Jakob Eberg for the old worktree; it does not identify which agent created that location.

Verified that the worktree had no modified, untracked, or ignored files, its commit `df33766` is an ancestor of current `work`, and no active process referenced its path. Removed it with `git worktree remove`, without force or deleting Git history. Verified installed FFmpeg, ffprobe, ffplay, and jq matched the downloaded executables by SHA-256, then removed only the FFmpeg ZIP/unpacked duplicate and downloaded jq executable. Kept checksum/signature evidence, logs, inbox state, and the installed tools. The directory is now about 13.7 MiB; `node tools/croupier-inbox.mjs check` still works. No active gameplay, media, or player files changed. Agent and inbox guides now prohibit worktrees/media/downloads in this directory and exclude it from broad searches.

## 2026-09-28 — Emil's Astrid demo V3 saved as inactive reference

Downloaded [`EmaCodeHero/astrid-demo-v3`](https://gitlab.com/EmaCodeHero/astrid-demo-v3) at commit `91aed7e8b99100a7b09198b3d704bd0ebde62a85` into `emil/astrid-demo-v3-reference/`. This preserves all 217 MP4 clips, the 7 JSON metadata/bank files, 9 PNG plates/masks, the upstream README and integration guide, and four small public demo files. See `SOURCE.md` there for the inventory and integration boundary. All copied files were byte-compared with the upstream checkout; every manifest media URL resolved to a local file. No live media, player mapping, speech route, or four-dealer behavior changed.

Potential value beyond the videos: exact speech/event banks in four languages, deal positions and masks, a common start plate, and a reference for the demo's clip switching and generated speech pipeline. These are reference inputs, not accepted product assets. Visual lip-sync, frame timing, contact, and card geometry still require per-take review before any integration. The upstream warm-GPU timing is a demo claim, not a measured Lissabon result.

Validation: 239 upstream files matched the copied files by SHA-256; all 218 manifest media URLs resolve; `node pipeline/audit-dealer-sync.mjs --probe` and the complete `.githooks/pre-commit` suite passed. Four-dealer visual rehearsal was not repeated because no active playback asset or mapping changed; it remains required when a take is actually integrated. Existing audit gaps remain (Vera 8, Amira 2, Mei 3 missing speech takes; visual lip-sync acceptance pending).

## 2026-09-28 — GitLab inbox credential clarity

The existing Jakob project token works with GitLab's Notes API and expires
2026-10-20. No replacement token or GitLab setting was created. The inbox now
reports `credential_unreadable` for local token-file permission errors; the
agent instructions retry the same read-only check once with approved access.
The inbox guide explains the existing private file and that GitLab already
provides the API. `node --check tools/croupier-inbox.mjs` and `git diff --check`
passed. A read-only `git ls-remote` also confirmed the existing GitLab SSH remote
works with approved access. This sandbox still needs approved access to read
the AppData token file and SSH `known_hosts`; no GitLab post, push or remote
setting change was made.

## 2026-09-26 — Idle-varianter: högst 12

Efterhandsgranskning av Cursor-commit `13c91af`: Lissabon har en enda
Astrid-spelflik med native-observation. Skillnaden mot den kvarvarande
produktintegrationen är preciserad i sprintanteckningen. I det levande
Lissabon-provet valde OpenClaw `idle_yawn` på ett nytt meddelande om trötthet
och `idle_smile` på beröm. Båda fick startkvitto och leendet fick dessutom
presenterad-kvitto i Webs spelare; ett separat lokalt videoprov visade avslut och återgång till
grundloopen. Detta verifierar val och uppspelning, inte visuell kvalitet på
varje bildruta. Ett nytt kort svar tog 35,817 s till uppspelningsstart:
videokö 0,542 s och rendering/hämtning 32,546 s. Det kompletterar tidigare
31,228 s i videokö; båda faserna kan dominera. RunPod-kapaciteten är fortsatt
oförändrad.

Idlepolicyn tar högst 12 engångsvarianter. Samma tak gäller runtime-valideringen,
`idle-policy.schema.json` och studioschemats `idlePolicy.variants`. Beskrivning
på högst 80 tecken är ett tillåtet fält i båda schemana. Tolv unika varianter
godkänns; den trettonde avvisas. Grundloopar är oförändrat högst 4.

`idle_smile.mp4` och `idle_yawn.mp4` ligger i manifestet och i idlepolicyn, med
korta beskrivningar. Sex varianter används. Lab-seed behåller blink som
automatisk; cheek, glance, smile och yawn är manuella där, insulted är OpenClaw.
Lissabons snapshot och den sparade lokala profilen har alla sex som OpenClaw.
Den skillnaden är inte ihopdragen. Ingen RunPod-kapacitet har ändrats.

Lissabon startades lokalt. Labbet på 4201 och spelet på 4200 svarade.
Idle-fliken visade sex OpenClaw-klipp, och `idle_smile` spelade klart och
återgick till grundloopen. Sprintläget 26 september står i
`docs/animation-events/v5-7-days-mvp/s06-plan.md`.

## 2026-09-26 — Lissabon: levande observation, spelresultat och idle-reaktioner

Slutverifierat i befintlig Jakob-profil: Director `7597c2ec`, Live-deploy
`dep-darfaenavr4c73eeh9mg`. Gateway `f2f24d30` är Live, deploy
`dep-darf2h7pn0mc73ca7upg`; runtime 2026-09-26.1/hash
`88b24ba4ea5c1fba2fe0ef844a1dd7c1838ebb2681ecac5c631c24c4cca2318b`
och den verkliga talrollens AGENTS innehåller språkregeln. Historik/status
och aktuell fråga separeras i två JSON-meddelanden. Aktuell fråga kommer
sist med serverägd språkpolicy och en fast applikationsuppgift. Detta behövdes
eftersom enbart systemregeln och omordnad JSON fortfarande kunde kopiera
tidigare svenska svar. Ingen extra modellrunda tillkommer; minnet behålls.

Slutlig sammanhängande native-serie, med gammal svensk historik kvar:
"Vad heter jag? Svara med en kort mening." → "You are Jakob." (6,644 s),
uttrycklig svenska → "Välkommen!" (6,812 s), samma namnfråga igen →
"You are Jakob." (40,396 s). Sista provets 31,228 s var videokö och
6,835 s rendering/hämtning; text tog 1,352 s och röst 0,677 s. Alla tre
fick uppspelningsstart. Varierande videokö är en kvarvarande flaskhals.
Resultatfrågan gav före sista förstärkningen "You have won 10 USD and lost
10 USD. Net is 0." med talstart 9,765 s och neutral idle (`responded`).

Senaste automatiska verifiering: OpenClaw 136/136, produktens språk-/chat-
kontrakt 13/13 och start-/anslutningstester 15/15. `--check` rapporterar nu
relayn som `reachable:null`/`functionalModelProbe:not_run`: ett ej utfört
modellprov är inte ett anslutningsfel. Lab har bekräftat Sparat lokalt med
cheek/glance/insulted som OpenClaw, blink automatisk. Nya oregistrerade
`idle_smile.mp4` och `idle_yawn.mp4` har inte ändrats eller lagts till.
Web/Lab lämnas igång med en Astrid-flik och en Lissabon-flik.

Liveuppföljning: Director `b22731f0`, deploy `dep-darevr60tbcc73basu9g`,
accepterar resultatkontraktet. Jakob-profilens fyra avslutade USD-rundor har
vunnit 10, förlorat 10, netto 0, insatt/återbetalt 20; pågående insats 5.
Frågan "Hur mycket har jag vunnit och förlorat? Svara kort." gav exakt dessa
vinst-/förlust-/nettosiffror och neutral idle (`videoId:null`, responded).
Talstart 29,826 s: text 1,840 s, röst 0,821 s, videokö 15,368 s,
rendering/hämtning 11,398 s. Detta prov bekräftar varierande faktisk videokö.
Direkt förolämpning gav insulted `921ae71d-11fa-01ec-f78a-b9ef7d8d7689`
och talstart 6,392 s. Den löpande loggen observerades fortsätta vid 300 poster
med 193 redovisade äldre bortfall och utan larm. OpenClaw 136/136 passerar
även som hel svit vid omkörning.

Runtimepaketets språkregel är villkorad på Astrid. De 26 runtime-/start-
testerna passerade; inga konton, nycklar eller verktygsbehörigheter ändrades.

På Jakobs begäran har Web/Lab-paret startats om. Osparade idleändringar
upptäcktes i den gamla fliken och sparades först: cheek och glance är nu
OpenClaw-val utöver insulted; blink är fortfarande automatisk. Det visade
`Failed to fetch` sammanföll med stoppad lokal server under omstarten.

Lissabon använder nu bara originalflikens native-observation, inte SSE för
den syntetiska launch-spelaren. Det tar bort det missvisande transportfelet.
150-radersvisningen är en ringbuffert; återkommande samma idle-kvitton
komprimeras bara på skärmen. Det tidigare 300-postersprotokollet frös på
gränsen: Lissabon har nu ett rullande 300/4 MiB-fönster med explicit lucka,
antal bortfall och versionsgolv i exporten. Hela eventlistor behålls, nya
meddelanden fortsätter. Avancerade/importerade observationer behåller sin
befintliga stoppgräns. Reset behåller versionerna och nollställer idlefiltret.

Produktchatten får i Lissabon en separat, allowlistad `playResults` från
den valda profilens serverbokföring. Avslutade/collected rundor summeras
per valuta: positiva och negativa rundnetton, insats, återbetalning och netto.
Insättningar, startkredit, valutaväxling, gamla klient-syncar och andra profiler
ingår inte. Pågående insats särredovisas. Underlaget gäller sparad demoprofil
över besök/dealers, inte bara aktuell flik. Inga privata kort eller råa
transaktioner lämnas till modellen. Ingen databas ändras av sammanställningen.

Director får en Astrid renderer-idle-regel: normal fråga → normalt neutral
baseline; insulted bara vid tydlig, aktuell förolämpning riktad mot Astrid.
Prioritet ensam motiverar ingen reaktion; tidigare förolämpningar följer inte
med. Cheek/glance är valfria sociala reaktioner, inte obligatorisk svarsinledning.

Verifierat hittills: Lab 472 tester och produktionsbygge; nya isolerade
resultat-/HTTP-/relay-/idle-tester 50/50; alla pre-commit-kontroller och
dealer-audit `--probe`. OpenClaw 135/136 i parallellkörning: befintligt
10 ms batchbudgettest hann inte börja sitt enda modellförsök under lasten.
Hela den berörda serverfilens 16 tester passerade vid separat omkörning.
Inga medier ändrade eller visuellt nygodkända. Jira-åtkomst saknas i sessionen.

## 2026-09-25 — Astrids standardspråk: engelska

På Jakobs begäran får Astrids produkt-speech-anrop en serverägd språkregel:
engelska som standard även efter svensk historik eller en svenskskriven
fråga, annat språk när spelaren uttryckligen ber om det i frågan. Regeln
gäller Astrid; operatörschatt, andra dealers och spel-/sekretesskontrakt
behåller sina instruktioner. Spelartext vävs aldrig in i systeminstruktionen.

Produkt-speech- och kontraktstester passerar. Den lokala demomiljön använder
den privata Director-relayn, så enbart lokal omstart ändrar inte dess prompt.
Denna commit förbereder därför driftsättning på befintlig croupier-lab-director;
driftkvitto och riktiga språkprov följer i nästa överlämningspost.

## 2026-09-25 — Lissabon: mätt chattlatens och förklarade avbrott

Jakob bad om egen testning av sena/uteblivna läppsynksvar. Prov på den
verkliga isolerade kedjan OpenClaw → ElevenLabs → RunPod → Astrids spelare:

| Prov | Text | Röst | Video inkl. submit/kö/överföring | Till spelstart totalt |
| --- | ---: | ---: | ---: | ---: |
| Kort välkomstsvar | 1,68 s | 0,74 s | 5,51 s | 8,14 s |
| Kort namnsvar | 1,70 s | 0,73 s | 5,94 s | 8,53 s |
| Längre svar, 11,38 s tal | 1,49 s | 1,31 s | 13,60 s | 16,57 s |

I dessa prov var observerad RunPod-kö cirka 0,54–0,57 s. Renderingssteget
inklusive hämtning av färdigt resultat tog 4,7–12,8 s; lokal lagring och
spelarens start stod för ungefär 0,2 s. Ett senare kortsvar i Jakobs eget
demospel startade efter 8,32 s. Ett första prov före mätinstrumenteringen
var klart inom 37 s, men talstarten fångades inte exakt. Tidigare 81 s och
övriga stora toppar kan inte tillskrivas en specifik leverantör utan data.

Ändringar:
- Lokal chatt begär en bakåtkompatibel NDJSON-respons med allowlistade
  framsteg och millisekunder. Vanliga JSON-klienter fungerar som tidigare.
  Text/media lämnas fortfarande först efter färsk ägar-/rundkontroll.
  Inga nycklar, provider-URL:er eller ljud/video skickas i progressramar.
- UI visar text, röst, videokö, rendering och förberedelse. Tider finns i
  statusens titel/DOM samt labbets validerade native-logg. Streamingfel och
  ofullständiga svar behandlas som fel, inte tomma lyckade svar.
- Lokal pose-gate behåller väntande/ännu ospelade svar vid dold flik och
  kräver synlig flik och ledig, presenterad idle före start. Redan köat/
  påbörjat tal avbryts fortfarande. Rund-/profilbyte, navigation och mute
  behåller sina spärrar. Detta ändrar inte andra renderares standardpolicy.
- Ett redan avbrutet/mutat mottagande startar ingen betald modellförfrågan.
  Avbrott, upptagen tjänst, timeout, genereringsfel och modellvald tystnad
  får begripliga meddelanden i stället för tyst bortfall/generiskt fel.
- Lissabon erbjuder inte Astrids gamla bankrepliker till chattmodellen:
  de kunde väljas men föll tillbaka till text-only i den lokala spelaren.
  Genererade exakta svar använder den befintliga talpaketvägen. Modellens
  rätt att välja tystnad finns kvar och redovisas i UI.

Verifiering: samtliga kontroller i `.githooks/pre-commit` samt dealer-audit
med `--probe` passerar. Medietestens kopierade serverfixture fick den nya
delade modulen efter att först ha stoppats av en saknad import. Nya test
täcker uppdelade UTF-8-strömramar, fel efter påbörjad respons, serverägt
minne vid avbrott och dolt väntande svar följt av exakt en uppspelning.
39 relevanta Lab-observations-/livscykeltester samt Lab typecheck passerar.
Labbets nya loggvisning byggs/laddas vid nästa ordinarie Start-Lissabon;
pågående hand avbröts inte för ett nytt produktionsbygge. Produktchatten
med stegstatus och avbrottsfix är redan omladdad i den körande miljön. Riktiga svar
spelades i den synliga Astridfliken, inklusive två direkt efter varandra
och ett längre svar med observerad videouppspelning. Automatisk audit
täcker alla dealers; inga andra dealerfönster öppnades.

Kvar: GPU/helfilmsgenereringen är fortfarande sekventiell och dominerar
väntetiden i de mätta proven. Ingen GPU-kapacitet, röstmodell, godkänd media
eller kalibrering ändrades. Kallstarter och de gamla mycket långa topparna
är inte separat verifierade. Ingen fonemvis visuell slutacceptans ges.
Jira saknar anslutning här; inga CAC-statusar ändrades.

## 2026-09-25 — Lissabon: synliga kort, lugn mobilchatt och sparade demoprofiler

Granskning av milstolpen `26a5d3a` / `BRA_sammanbindning_av_KJE`.
Gemensam runtime, manifest, exakta talpaket och beständig projektlagring
behålls. Inga medier, hashar, kalibreringar eller godkännanden ändrades.
Den ursprungliga milstolpetaggen flyttas inte.

- Genererat tal använder lokal filmlagerordning: stillbild 1, film 2,
  genererat tal 3, serverstyrda kort/insatser 20. Andra renderare behåller
  sitt befintliga tal-lager. Talytan fångar inga pekhändelser.
- Mobilens chattlogg öppnas manuellt med Chatt, inte på varje svar.
  Nytt svar markeras med en punkt. Knappen/Escape stänger loggen.
  Väntestatus visar förberedelse med tid, väntan på ledigt bord och talstart.
  Dubbelsändning blockeras. Sekundräknaren aviseras inte varje sekund till
  skärmläsare. Reservvarning och talets granskningsetikett flyttas från
  ansikte/logotyp till bordet.
- Jakob bad uttryckligen om enbart Astrid och synlig testning, samt valde
  **lokal demoprofil med sparat minne**. Lissabon visar därför Astrid och
  Byt profil i stället för dealer-/V2-väljaren. Gästläget finns kvar.
- Profiler har servergenererade spelar-ID:n och eget Astrid-minne. Namnet
  är visningsdata för OpenClaw, aldrig en minnesnyckel. Samma namn väljer
  inte tyst någon annans profil. API:t kräver explicit Lissabon-konfiguration,
  lokal utvecklingsserver, loopback-adress och rätt Origin för ändringar.
  Profilerna är avsiktligt lösenordslösa och valbara på denna dator.
- `lissabon/data/players/` sparar isolerade demo-databaser, profiler, bord,
  saldon, sessioner och chatthistorik mellan starter. Allt ligger utanför Git.
  Vanliga starter använder fortfarande tillfälliga databaser. Genererade
  ljud-/videopaket är fortfarande tillfälliga; sparad text är inte sparad
  film eller ett uppspelningskvitto. Den riktiga användardatabasen används inte.
- Profilbyte spärras under en hand. Föregående profils session återkallas,
  pågående modellförfrågan avbryts och andra Lissabon-spelflikar på samma
  origin laddas om. Native-observation följer den faktiska Web-spelarens
  profil; Partner-SSE från starthelperns separata syntetiska spelare är
  endast kompletterande och ska inte läsas som profilens speltrafik.

Verifiering: hela `.githooks/pre-commit` och `audit-dealer-sync.mjs --probe`
passerar. Produktionsbygget av Lab passerar. Nya riktiga HTTP-prov kör
produktchatten både med och utan Lissabon: rätt namn till modellkontraktet,
separat historik för Alfa/Beta, återval av profil och avbrutet försenat svar.
Profilproven täcker stängd/återöppnad SQLite-databas, samma ID/cookie/minne
efter omstart, utgången/återkallad session, fel Origin/host, vanlig spelare
utanför profilregistret, pågående hand samt avstängt API. Startprovet
kontrollerar beständig spelarplats enbart för Lissabon.

Live i 390×844: en isolerad $5-hand och ett riktigt OpenClaw → ElevenLabs →
RunPod-svar om 8♣/6♦ och dealerns K♦. Talstart efter cirka 17 sekunder;
44 observationer under cirka 9 sekunders uppspelning visade stängd logg,
tal-lager 3 och kort-lager 20. Skärmbild visar kvarvarande kort och insats.
Ingen horisontell overflow eller browserfel. Manuell öppning/stängning av
logg och Escape provades. Stand avslutade handen. Ett efterföljande riktigt
välkomstsvar spelades i den synliga Codex-fliken med labbets native-följning.
Profilväljaren är liveöppnad i samma Astridflik efter serveromstart.
Övriga dealers fick automatiska regressionskontroller men inga nya visuella
prov efter Jakobs uttryckliga Astrid-avgränsning.

Kvar: kortens placering/kontakt, saknade exakta filmer och subjektiv
röst-/fonemvis läppsynkacceptans. Genereringens kötid varierar fortfarande.
Minnet är de senaste 12 inläggen/8 000 tecknen, med 30 dagars inaktivitet;
det är inte obegränsat långtidsminne eller lösenordsskyddad inloggning.
Ingen Jira-anslutning/aktuell CAC-issue fanns, så inga statusar ändrades.
Privata ospårade filer bevarades. De extra testbrowser-sessionerna stängdes;
endast det isolerade serverparet 4200/4201 och den synliga Astrid-/labbfliken
behålls för Jakobs pågående prov.

## 2026-09-25 — Lissabon stream lane säkrad för fortsatt Astrid-demo

På Jakobs begäran är `lissabon/` den nya fokuserade demoingången, ovanpå
samma Web-spelare, Emils manifest och gemensamma presentationsruntime.
Basen före paketering är `e46bc8b`; leveransen märks med den annoterade
Git-taggen `BRA_sammanbindning_av_KJE` på `jakeminator123/work`.

- `Start-Lissabon.cmd` startar isolerat spel på 4200 och labb på 4201 med
  genererat tal aktiverat. `/` i denna labbkörning leder till `/lissabon`.
  Anslut öppnar Astrid med `presentation=local` och följer samma spelare.
- Den nya ytan har Ström, Idle och Klipp & varianter. Ingen separat social
  labbchatt eller alternativ spelrenderare ingår. Äldre provytor ligger kvar
  under den vanliga studion för avancerat arbete; inga medier raderades.
- Fryst `project.snapshot.json` hämtades från den fungerande körningens
  projektstore (den körningen använde seed). Första start skapar
  `lissabon/data/project.json`. Både Web och Lab läser samma beständiga mapp;
  efterföljande starter bevarar sparade val. Databas och talcache är fortsatt
  isolerade och tillfälliga. Privata nycklar och lokal data ligger utanför Git.
- OpenClaw-klippval är standard enbart i Lissabon-körningen. Övriga
  startvägar behåller Standard. Utvecklingen gäller endast Astrid.

Verifierat: Next-produktionsbygge och typecheck; 468 labbtester, 15 tester
för isolerad anslutning, särskilt Lissabon-test för delad lagring,
standardläge, bevarade ändringar och att korrupt projekt inte skrivs över;
hela `.githooks/pre-commit` samt `audit-dealer-sync.mjs --probe` passerade.
Browser: rootomdirigering, Astrid-launch med förvalt OpenClaw, exakt
box3 → deal_pos4 i editorn och sparande via UI. Ändrade blinkintervallet
25 → 26 sekunder, startade om båda processerna och läste tillbaka 26;
återställde därefter 25 via UI. Revisionshistorik finns lokalt.
Obligatorisk regression: `goodluck` spelades två gånger i följd för alla fyra
dealers via `?dealer=<name>&rehearsal=1`; kontrollerna återaktiverades utan
playbackfel. Ingen media eller konfiguration för andra dealers ändrades.

Ett riktigt chattsvar efter omstart: ”Välkomna till Lissabon, och ha det
trevligt vid bordet.” Paket `generated-2481e9394cda34beaa73955744e61d7f`.
Labbets native-observation registrerade `generated-lipsync` start 22:46:39
och end 22:46:43, `started: true`. Chatt skickades 22:45:18: **81 sekunder**
till talstart, jämfört med tidigare 15–25. Genereringen fungerar men
väntetiden varierar; externa tjänsters kötid är inte garanterad.
Röst och fonemvis läppsynk är fortfarande `reviewStatus: pending`.

Kända fel från föregående prov kvarstår: mobilchatten kan täcka ansiktet,
talytan kan täcka kortöverlägg och kortkontakt behöver kalibreras.
Ingen CAC-status ändrades: Jira-anslutning/aktuell issue saknas i sessionen.
Se `lissabon/README.md` för start, lagring och källreferenser.

## 2026-09-25 — Eget Astridprov: chatt, reaktion och demohand

På Jakobs begäran provades enbart Astrid i separat browserflik på
`localhost:4200/?dealer=astrid&presentation=local`, med OpenClaw-klippval
och den redan körande isolerade testdatabasen. Hans spelflik på 127.0.0.1
ändrades inte. Ingen spelar- eller mediakod ändrades i detta testpass.

- Vanlig svensk hälsning gav ”Jag mår bra i kväll, tack. Det känns lugnt här
  vid bordet.” Nytt talpaket `generated-57a2b396f7c42e900be39d7b247b8f1d`,
  ljud 3 297 ms; aktiv läppsynkvideo observerades efter cirka 15 sekunder.
  390×844 behöll rätt format, följt av återgång till primär-idle.
- Spydig kommentar gav ”Nej, jag är bara fokuserad. Kort och gott.” med nytt
  genererat talpaket. Vid ett separat omprov efter avslutad hand verifierades
  `idle_insulted_f73_s301.mp4`, `presentationState: presented` och verklig
  video med `paused: false`, innan chattsvaret var färdigt.
- En isolerad $5-demohand på box 4 och chatt under initialutdelningen gav
  korrekt svar: ”Du har 10♥ och 9♠, totalt 19. Dealern visar 3♦.” Det dolda
  kortet avslöjades inte. Paket `generated-4079dcb16b472eb50b72ed268d50425c`,
  ljud 5 294 ms. Talvideo observerades efter utdelningen. Stand avslutade
  handen och återgång till betting verifierades. Inga konsolfel noterades.

**Två reproducerade öppna fel, prioriterade före kortkalibrering:**

1. På 390×844 täcker den automatiskt öppnade chattloggen ansikte/mun medan
   det genererade svaret spelas. Skärmbilden visar chattpanelen över ansiktet;
   `chatLog` öppnar den på varje svar och håller den öppen i 26 sekunder.
2. Genererad talvideo täcker befintliga kort, totalsiffror och insatsmarkörer.
   Under kortsvaret fanns 3♦/hålkort och 10♥/9♠ kvar i DOM men syntes inte;
   samma kort syntes direkt när talytan togs bort. Talytans `z-index:25`
   ligger över `#table2d` på 20. Detta är lagerordning mellan bildytor, inte felaktig
   serverstate eller det tidigare åtgärdade formatfelet.

Talpaketen har fortsatt `reviewStatus: pending`; detta test fastställer
funktionell uppspelning och synliga UI-fel, inte fonemvis läppsynkacceptans
eller ett subjektivt godkännande av röstens naturlighet. Ingen aktuell
CAC-issue/Jira-anslutning fanns för att föra dessa fynd till live-trackern.

## 2026-09-25 — Samma bildformat för genererade chattsvar och idle

Jakobs två bilder visade att den genererade talfilmen zoomade in jämfört med
Emils idlefilm. Felet reproducerades i en separat lokal browserprofil via
`localhost:4200`, utan att avbryta hans spelrunda på `127.0.0.1:4200`.
Båda källfilmerna är 1080×1920. Vid viewport 1282×1366 hade idleelementet
rätt mått, men talvideon blev **1282×2279,109375** i sin 1282×1366-container.
Gridens implicita minsta spårstorlek lät videons naturliga proportioner växa
utanför ytan, som sedan klippte bilden trots `object-fit: contain`.

`web/public/generated-speech-player.mjs` placerar nu videon absolut inom
talytan, med samma inset, bredd, höjd och contain som den lokala filmspelaren.
Det behövs ingen grid för centrering. Talpaket, mediabytes, kalibrering,
hashkontroller och spelordning är oförändrade.

Ett riktigt nytt OpenClaw/ElevenLabs/RunPod-chattsvar verifierade efter ändringen
att talvideo och idlebild har identiska elementmått i **1282×1366** och
**390×844**. Screenshots under uppspelning och efter återgång till idle visar
att förstoring/beskärning är borta. Detta är formatverifiering, inte ett nytt
visuellt läppsynkgodkännande. Kvar: kortöverläggens placering och chattpanelens
täckning av ansiktet på smal skärm är separata frågor.

Hela `.githooks/pre-commit` och `node pipeline/audit-dealer-sync.mjs --probe`
passerade. Befintlig `goodluck` spelades två gånger i följd för alla fyra
dealers via den riktiga rehearsalspelaren, utan playbackfel eller konsolfel.
Detta var bara obligatorisk regression; Jakob förtydligade att utvecklingen
nu gäller **enbart Astrid**. Inga andra dealers ändrades. Hans Astridflik
laddades om efter avslutad runda och Klippval återställdes till OpenClaw;
den separata provfliken stängdes. Jira-anslutning och aktuell CAC-issue saknades;
inga trackerstatusar ändrades. De tre tidigare ospårade filerna bevarades.

## 2026-09-25 — Mobilprov med genererat tal och idlereaktion

Jakob prioriterar naturlig chattröst och läppsynk före kortens landningspositioner.
Inga spelar-, media- eller kalibreringsfiler ändrades i denna kontroll.
De dokumenterade lokala portarna var stoppade; ett enda isolerat serverpar
startades på **4200/4201** med `--generated-speech`. Privat konfigurationskontroll
bekräftade ElevenLabs, scoped RunPod-endpoint och produktens speech-relä;
Director health/API svarade 200. Inga credentials eller molninställningar ändrades.

Lab `/activity` anslöts till Astrids verkliga `?dealer=astrid&presentation=local`.
Spelfliken lämnades i **390×844**, med **Klippval: OpenClaw**, ljud på och
Emils befintliga manifest/idlepolicy. Bara denna spelare och observationslabbet
behölls. Klippväljaren är ett flikval och återgår till Standard vid omladdning;
välj OpenClaw igen för AI-idlereaktioner. Genererat tal styrs separat av serverstarten.

Verkligt chattprov 22:18:12 lokal tid: ”Du ser rätt sur ut, Astrid. Har du
glömt hur man ler? Svara kort på svenska.” Director gav kontextkvitto v2.
Web kvitterade `idle_insulted_f73_s301.mp4` med start/presented 22:18:15 och
slut 22:18:19, därefter primär-idle. Svaret ”Jag ler när det lönar sig.”
genererades via OpenClaw → ElevenLabs → RunPod. Samma spelares kvitton visar
`source: generated-lipsync`, `state: start` 22:18:38 och `state: end`,
`started: true` 22:18:39. Paket-ID: `generated-2969c4f2b3a0c5218439c4af5be4ee23`.
Det gav cirka 25 sekunders väntetid till talstart; webbläsar-TTS användes inte.

Paketets media ligger i den isolerade temporära körningen, inte i Git eller
dealerbanken. `reviewStatus: pending` kvarstår: funktionella playbackkvitton
är inte mänskligt godkännande av röst/läppsynk. Kortplacering och övergångens
visuella passning kvarstår. Ingen Jira-anslutning eller angiven CAC-issue
fanns för detta start-/konfigurationsprov. Befintliga tre ospårade filer bevarades.

## 2026-09-25 — Web äger Astrids lokala presentation

Arbetet ligger i `C:\Users\jakem\Projects\croupier`, fortsatt på
`jakeminator123/work`. Chattens ursprungliga projektetikett JakobScrape var
missvisande; inga filer i det repot ändrades. De tre befintliga privata/
untracked filerna i Croupier är bevarade utanför leveransen. Inga nycklar,
mediabytes, kalibreringar eller visuella godkännanden har ändrats.

`?dealer=astrid&presentation=local` använder nu Emils 9:16-filmer i det riktiga
Web-spelet. Urval, exakta mediefamiljer och idlecontroller har extraherats till
`presentation-runtime/`; Lab återanvänder dem. Web äger filmens hela livscykel
genom PerformancePlayer, medan Lab konfigurerar och observerar samma spelare.
**Anslut** öppnar det lokala läget. Lab monterar ingen andra Astridspelare före
anslutning, efter loggnollställning eller vid byte av dealer i editorn.

Dealval slås upp i serverns publicerade native-instruktioner för rätt spelare,
version, box och shoeDraw. Browsern kan inte ersätta kort/handindex, och dolt
hålkort skickas inte till Director. Sparat projekt delas av Web och Lab.
Standard/regler/slump/OpenClaw/skugga finns i spelets klippväljare.
OpenClaw-idleråd och serverbunden bordschatt är kvar. Generering får förberedas
under deal; uppspelning kräver ny presenterad primärbas. Sena chatt-/idle-
callbacks och avbrutna delade filhämtningar kan inte stoppa nästa deal.
`silence` tar inte över idle. Läs [runtime-referensen](LOCAL-PRESENTATION-RUNTIME.md)
för policyuppdatering, transport och begränsningar.

Verifierat: **468/468 labbtester**, **135/135 OpenClaw-tester**, TypeScript och
produktionsbuild; **8/8 nya produkt-/livscykeltester**, hela pre-commit och
`audit-dealer-sync --probe`. Revisionstester omfattar fel spelare/kort/version,
äkta start/bild/slut, försenade callbacks, chattsvar under deal, avbruten gemensam
hämtning och Lab-ägarskap över loggnollställning.
Rehearsal i den riktiga spelaren körde `goodluck` två gånger i följd för Vera,
Astrid, Amira och Mei, med separata start/slut och inga konsolfel. Det ger
funktionsbevis, inte mänskligt godkänd läppsynk.

Browserprovet körde riktiga isolerade demohänder med goodluck, exakt boxfilm,
dealerfilm, markerad 2D-reserv för saknat hålkort och återgång till idle.
Mobilprov 390×844 visade hela 9:16-filmen och inga horisontella överflöden;
chatt och tre spelplatser ryms. Lab fick Web-spelarens verkliga idle-start/
presented/end-kvitton och visade **En spelare · Web** utan Lab-följningsfilm.
Senaste chattprovet avbröts med `stale:table-version-committed` när en ny
spelrunda började. Inget nytt komplett genererat talpaket liveverifierades i
denna leverans; tidigare funktionsprov och nya regressionsprov är skilda bevis.

Kvar: råfilmerna saknar kalibrerad pickup/release/land-kontakt. Korten är
serverstyrda 2D-överlägg; deras kvitto anger `calibratedContact: false`.
Saknade exakta filmer ger märkt 2D-reserv. Inspelade fria chattsvar utan exakt
verifierat text/video-paket är text-only. Mänsklig läppsynkgranskning kvarstår.
Ingen Jira-issue angavs och ingen Jira-anslutning var tillgänglig för statusändring.

Efter användarens begärda stängning och omstart kör bara det isolerade
serverparet **4200/4201** inom kontrollerat intervall 4188–4301. Slutkörningen
startades med `--generated-speech`; check verifierade befintlig konfiguration
och Director health/API 200 utan ändrad Render/provider/modell. Helpern använder
temporär databas, spelarminne och projektkatalog. Öppna ingen extra serveruppsättning.

## 2026-09-25 — Sparad leverans och en enda aktiv lokal miljö

Implementation och tidigare verifiering är sparade i `d8d3b22` på
`jakeminator123/work`, levererad till kanoniska GitLab och privata
`Jakeminator123/github-work`. Den här uppföljningen ändrar bara dokumentation,
inte spelkod, media, modellinställningar eller driftsättning.

På användarens begäran stängdes sex överflödiga browserflikar och de tre äldre
lokala serverparen: 4192/4194, 4196/4197 och 4198/4199. Kvar finns endast
produktens originalspel på <http://127.0.0.1:4200/> och labbet på
<http://127.0.0.1:4201/activity>, med deras två befintliga browserflikar.
Den aktuella spelsessionen behölls utan omladdning. Båda HTTP-sidorna svarade
200 och endast 4200/4201 lyssnade inom det kontrollerade portintervallet
4192–4201 efter städningen. OpenClaw-tjänsterna på Render lämnades igång.

Använd [startguiden](../open-claw/lab/docs/LOCAL-CONNECTION-SV.md) för en ny
körning; starta inte ett extra serverpar medan dessa portar redan används.
Varje helperstart skapar en isolerad testdatabas, inte beständigt produktminne.
Tidigare uppgifter nedan om kvarlämnade 4192–4199-processer är historiska.
Mänsklig lipsyncgranskning och saknade exakta klipp kvarstår enligt leveransen
nedan. Starthelperns 15/15 tester och `git diff --check` passerade vid denna
uppföljning. Hela spelarsviten kördes inte om för dokumentationsändringen;
inga nya visuella godkännanden gjordes.
De tre tidigare privata/untracked användarfilerna lämnas fortsatt utanför Git.

## 2026-09-25 — Länkad bordschatt, genererad läppsynk och levande idlepolicy

Aktuell lokal labbväg: ett auktoritativt spel, samma publicerade native-
instruktioner till originalet och labbet, men varsin presentation. Labbet spelar
Astrids exakta manifestfamiljer och kvitterar verklig MP4-start/slut. Ingen
ny kortgenerator, inget separat kort per videofil och inga ändrade mediabytes.
Luckor och konflikter stoppar följningen; pose-statusmeddelanden tappas inte
längre som falska transportluckor. MP4-spelaren har epochskydd, riktiga
slutkvitton, start-/stallgränser och ingen falsk duration-baserad completion.

Under Händelseloggens labbbild finns nu **Chatta vid detta bord**. En separat,
loopback-/origin-/fönster-/kanal-/noncebunden brygga skickar bara text och
request-ID till originalets autentiserade `/chat`. Den kan inte skicka kort,
spelaridentitet eller spelkommandon. Produktservern äger synliga kort och
spelarminne. Modellen får inte framtida shoe eller dolt hålkort. Browserhistorik
ignoreras; minnet binds på servern till autentiserad spelare och dealer med
12 meddelanden/8 000 tecken, 30 dagars inaktivitet och dedup/tombstones.
Originalchattens **Minne** visar omfattning och kan glömma historiken samt
avbryta ett pågående svar. Minnet säger genererat svar, inte bevisat spelat.

Explicit `--generated-speech` i starthelpern aktiverar OpenClaw-text →
ElevenLabs Sarah/multilingual-v2, exakt PCM24k-WAV → Emils RunPod-lipsyncprofil
Astrid spel2x. API-kontraktet kontrollerades read-only mot privata repo-
commit `133f2e4392d43de1c30dc5edd1b1f6762934efcb`; ingen privat källkod
kopierades. Den scoped endpointkonfigurationen ligger endast privat/ignorerat.
Standardstart aktiverar inga taljobb. OpenAI-provider och modell är oförändrade.
Jobben begränsas, avbryts när ägarskap/runda ändras och återförsöks inte
automatiskt efter osäkra betalda anrop. Temporära media ligger utanför repot
och kräver rätt session. Ljud/video överförs till labbet utan credentials och
hashverifieras igen. Paket v2 binder exakt text, ljud, video, 24fps/index och
profil; review-status är alltid pending, aldrig ärvt visuellt godkännande.

Modell/TTS/GPU får förbereda under deal. Labbet håller sedan svaret tills en
ny verkligt renderad primärbas finns. Deal går före färdigt/pågående tal;
blinkningar och sekundärbas öppnar aldrig talgrinden. Native-eventrepliker
behåller sin exakta replikfamilj, separat från fri chatt. Modellvalet
`recordedLine` är tills vidare text-only i den länkade labbchatten när exakt
labbtake saknas; originalets och native-eventens inspelade tal påverkas inte.

Händelseloggens idle använder samma sparade policy som Eventstudion: viktad
bas, intervall/jitter, cooldown och rullande max/min, driven av verkligt
klippslut. OpenClaw får högst fyra uttryckligen tillåtna idlevarianter, med
30 sekunders råd-TTL och globalt högst en spelad AI-idlereaktion/minut.
Rådgivaren använder befintligt `/api/studio/advice`, kräver kontextkvitto v2
och gör inte renderer-idle till ett nytt native-event. Paus, läges-/rundbyte,
nyare chatt och avbrott invaliderar gamla råd; browserabort når providern.
Standard och skuggläge kan aldrig spela AI-idleråd. Minutpreviewns max/min-fel
är också rättat. Tom familjs variantmapp betyder fortfarande standard utan AI.

Båda jämförelseytorna har separata Dator/Mobil-ramar. Hela Emils 9:16-film
bevaras; ramen skapar inte widescreeninnehåll eller ändrar originalfönstrets
layout. Eventtestpanelen har tydligt klippläge och hopfälld testkontext/hjälp.
Fristående chattprov är märkt som separat och behåller oskickad text. Verkliga
mappfiler, inte gamla demoalternativ, används även i operatörens katalog.
Den lokala operatörspromptförbättringen är **inte** en ny Render-deploy;
remote kör fortfarande den tidigare uttryckligen godkända `113dfd8`.

Livebevis: ett bord gav 5♦/K♠/15 och dealer 10♠, ett nytt isolerat bord gav
5♦/7♣/12 och dealer 2♥. Båda motsvarade OpenClaws svar och labbets verkliga
tal-/videokvitton. Testnamnet QA-Lina återkallades korrekt i nästa svar från
serverminnet. Den senare rundan återgick till vänteläge och labbet fortsatte
följa. Schemalagd blink gav started/presented/completed. Syntetiskt Director-
prov valde den tillåtna `idle_insulted_f73_s301.mp4` med v2-kvitto. Slutligt
browserprov gav därefter faktiskt started/presented 18:05:37 och completed
18:05:40 för samma klipp/råd-ID. Genererat chattsvar spelade 18:05:56–18:05:59
efter återgång till primärbas. Ett separat regressionsfall säkerställer att
`silence` aldrig tar poseägarskap eller avbryter en pågående idlevariant.

Verifierat: labbsviten 467/467, TypeScript och produktionsbuild; OpenClaw 135/135;
hela `.githooks/pre-commit` inklusive nya tal-/brygg-/minnestester;
`audit-dealer-sync --probe` för fyra dealers. Vera, Astrid, Amira och Mei
spelade goodluck två gånger efter varandra i den riktiga rehearsalspelaren och
återgick till idle. Befintliga saknade takes och mänsklig lipsyncgranskning
återstår. Inga nya visuella approvals eller baselineändringar gjordes.
Ett slumpberoende äldre HTTP-test antog exakt ett öppet dealerkort även vid
dealer-blackjack; det kontrollerar nu faktisk publik state/reveal utan att
släppa igenom hålkort. Regressionen passerade 15 separata omkörningar.

Eventstudion kontrollerades på bred skärm och 390 px; ingen horisontell
överströmning (375/375 px innehåll). Labbet hade inga konsolfel. Originalfliken
visade ett Electron shell-initfel utanför appkällan, men spel/observation och
minnespanel fungerade. Bilddelning av originalfliken är fortsatt ett explicit
webbläsarval. Saknade exakta dealer-hole/turn-filmer ger märkt 2D-reserv,
inte fel plats/replik. Läppsynken behöver fortsatt mänsklig granskning per take.

Senaste separata slutprovet använder 4200/4201; användarens 4198/4199-hand
lämnades kvar. Startinstruktioner i `open-claw/lab/docs/LOCAL-CONNECTION-SV.md`.
Guiden och den kopierbara `lab/docs/PARALLEL-EVENTSTUDIO-UI.md` är uppdaterade.
Jira/CAC var inte tillgängligt. Vercel och wikins publicering ändrades inte.
Tre tidigare privata/untracked användarfiler bevaras utanför leveransen.

## 2026-09-25 — OpenClaw-spelarchatt verifierad; extra alias-spärr borttagen

Ny sparad speech-token aktiverades genom Director-deploy
`dep-dar8aibtqb8s73ftoat0` av samma godkända `113dfd8`. Gateway oförändrad.
Riktiga modellprov gav 200 för generatedText, recordedLine och silence.
Native-chatten på 4196 svarade med exakt rätt kort på två boxar; även Nexts
separata operatörschatt på 4197 gav provider responded. Behörighetsgränsen
verifierades med status/speech: rätt token godtas, fel rolltoken/anonym nekas.

Användaren vill inte ha vår extra startspärr mot tokenalias. Den är borttagen
och pushad i `d570770`; befintlig autentisering och endpointgräns behålls.
129/129 OpenClaw-tester passerade. Produkt-/posesviten hade ett första
engångsfel men gav därefter 25/25 i sex samlade omkörningar; felets orsak är
inte fastställd. Se [driftkvittots uppföljning](../open-claw/lab/docs/DEPLOYMENT-RECEIPT-2026-09-25.md)
för konkret runtimebevis och avgränsningar.

4196/4197 lämnades igång för användarens fortsatta prov med syntetisk
tempdatabas. 4192/4194 är fortfarande offline och orörda. Neutral bild och
webbläsar-TTS används för generatedText; genererad lipsync är inte inkopplad.
Inga media, riktiga spelardatabaser eller befintliga OpenAI-inställningar
ändrades. De tre tidigare privata/untracked filerna lämnades orörda.

## 2026-09-25 — Båda OpenClaw-labbtjänsterna driftsatta; separat speech-nyckel återstod

Efter uttryckligt godkännande driftsattes exakt `113dfd8` på befintliga Render
Gateway och Director. Båda visade Live. Runtimepaket `2026-09-25.1`, installerad
`croupier-speech`, oförändrad operatörsmodell och verktygsförbud verifierades.
Gatewayens schema är giltigt utan varningar med startwrapperns miljö.
Director annonserar `product-speech-v1`; labbtoken och anonyma anrop nekas på
produktens speech-endpoint.

Den nya lokala speech-tokenen är dock identisk med Gateway-nyckeln. Ingen
hemlighet skrevs ut; positivt speech-/modellprov stoppades före anropet och
användaren ombads skapa en unik token i Director och privat lokal `.env`.
Det anslutna provet på 4196/4197 stoppades, med inga kvarvarande lyssnare;
offlinejämförelsen 4192/4194 lämnades orörd. Provet hann verifiera två boxars
verkliga kort/event och originalspelarens start/slutkvitton i Next-loggen,
men inte ett fungerande OpenClaw-produktsvar. Inga media eller riktiga
spelarkonton ändrades. Jira/CAC var inte anslutet och ingen status ändrades.

Read-only granskning av `EmaCodeHero/astrid-lipsync-demo-2` på `1e271e1` visar
en relevant exakt-text → Cartesia → RunPod-väg utan Gemini via `/api/speak`.
Ingen kod kopierades: återanvändningsrätt, separat GPU-worker och kostnadsram
behöver klarläggas. Vår posegrind/talkö och hashbundna talpaket måste behållas.
Se [fullt driftkvitto](../open-claw/lab/docs/DEPLOYMENT-RECEIPT-2026-09-25.md)
för avgränsningar, testbevis och återstartssteg. Tidigare anteckningar nedan om
att ingen remote-driftsättning skett är historiska, inte aktuell status.

## 2026-09-25 — Aktuell systemkarta, direkt wiki-synk och verifierad publicering

GitLab-wikin är nu primär publicerad dokumentationsyta för animation-events.
Croupier-commit `927f99e5a23db6ba9058611b1727d3e4f926af2f` finns på både kanoniska
GitLab och den privata GitHub-referensspegeln. Wiki-commit
`7705d5a5ffb9be91282f53b61b117e05350f45ee` är pushad till `croupier.wiki.git`
`main`. Startsida, sidomeny, aktuell V5, synkkvitto och äldre hänvisningsadress
granskades i den faktiska inloggade GitLab-vyn.

Systemkartan, labbguiden och V5 beskriver nu manifest v2 med 31 poster i 26
familjer, exakt box 0–6 → `deal_pos1`–`deal_pos7`, sjutton speech-familjer,
idlebaser/varianter, viktens begränsning samt skillnaden mellan 9:16-källfil,
layout och produktens rehearsal-panel. OpenClaws operatörsroll, sociala prov och
produktspeech-roll hålls isär. `8b985de` isolerar dessutom ansluten Next-QA och
dokumenterar två verkliga lokala processer; privat transport, token, redeploy
och runtime-QA är fortsatt ogjorda.

`tools/sync-animation-events-wiki.mjs` är en envägssynk utan nätanrop eller
webbbygge. Den speglar tolv källfiler, bevarar äldre V5-adresser som korta
hänvisningar och skriver commit/hashkvitto. Verifiering: 5/5 synktester och 4/4
studiokontraktstester, giltig `guide.json`, syntax/diffkontroll samt lokal kontroll
att alla absoluta wikilänkar löser. Wiki-check efter push visade rätt
Croupier-commit `927f99e` och filhashar.

Den separata Vercel-sajten är medvetet orörd. Den är fortsatt publik men visar
21 septembers åttadagarsversion från GitHub-commit `f43806b`, fingerprint
`7b010e2b2054`. Webbbygget har gammal hårdkodad källväg och kan även skriva
wiki; det används därför inte längre för normal wiki-publicering. Webbens sök,
flikar, hash-länkar, mobil-/utskrifts-CSS, äldre HTML-snapshots och publika
åtkomst försvinner vid full avstängning. Rekommendation: hänvisningssida först,
med `f43806b` som rollback. Inga Vercel-/GitHub-webb-, domän-, deploy- eller
raderingsåtgärder utfördes; inväntar Jakobs uttryckliga beslut.

Jira/CAC ändrades inte eftersom dokumentationsuppdraget saknade tillgängligt
ärende/anslutning. De tre tidigare privata/untracked användarfilerna bevarades.

## 2026-09-25 — Läsbar, kompakt idleeditor och avgränsat wikiuppdrag

Idleeditorns felaktiga ljusa `--surface`-reservtema är ersatt med labbets
befintliga mörka färgtokens. Arbetsytan har maxbredd 1120 px, kompaktare
variantkort och en separat sticky videoförhandsvisning på breda skärmar.
Smalare skärmar får en kolumn. Preview bevarar originalets bildformat och
förklarar att stående källvideo inte är ett separat mobilläge. Inga MP4-filer,
manifest, schemapolicys, playbackbeslut eller OpenClaw-konfiguration ändrades.

Verifierat: 360/360 labbtester (två nya tema-/kontrastregressioner), TypeScript
och produktionsbuild. Browserkontroll av mörkt tema, basloopstart och
blinkvariant med completed → base resumed; ingen konsolvarning/-error i
kontrollfliken. Vid 390 px bredd är dokumentets innehåll 375 px (resten är
scrollbar), utan horisontell sidöverströmning. Normal bredd återställd efter provet. ffprobe bekräftar
1080×1920 / 9:16 för idle_still_f73_s302.mp4 och deal_pos3.mp4; inga omkodningar.
Dealer rehearsal är den befintliga produktpanelen bakom `?rehearsal=1`,
introducerad före denna leverans (historik ce9946d, 8 september).
Dealer-sync --probe och hela Git for Windows-pre-commit passerar. Två fel i
den parallella OpenClaw-ändringens tempimport/agentmålsassertion rapporterades
till bygg3 och korrigerades av den agenten före slutligt full-hook-prov.

`lab/docs/PARALLEL-DOCS-WIKI.md` är ett kopierbart uppdrag för dokumentationsagent:
uppdatera aktiv systemkarta och wiki, verifiera speglarnas faktiska paritet,
förbered wiki-only-publicering och återkom för godkännande före webbavveckling.
Varken wiki, animation-events-v1, Vercel eller Gateway ändrades i denna leverans.
Publiceringskvittot från 21 september är historik, inte dagens driftbevis.

Den egna isolerade 4192/4194-fixturen startades om till det nya labbygget;
endast dess temporära demosession nollställdes. Andra agentens samtidiga
OpenClaw-kod och användarens tre tidigare untracked filer lämnas utanför commit.
Jira/CAC-status har inte ändrats. Tidigare läppsynk-/integrationsluckor kvarstår.

## 2026-09-25 — Separat verktygslös produktroll för OpenClaw-tal

Produktchatten använder nu den nya, avgränsade rollen
`openclaw/croupier-speech`; operatörsrollen `openclaw/croupier-chat` behåller sin
tidigare innebörd. Talrollen har eget workspace/agentDir, inga skills, heartbeat
eller verktyg och samma primära OpenAI-modell som den befintliga installationen.
Gateway-planeringen avvisar drift i modell, verktygspolicy eller delad roll-state
i stället för att skriva över den. Runtimepaketets manifest är
`2026-09-25.1` och innehåller fem roller.

Produktens befintliga serverägda projektion och enda talkö är bevarade. Det
strikta kontraktet är fortfarande `recordedLine`/`generatedText`/`silence` med
request-, dealer-, session- och rundrevisioner. Produktrollen får bara publik,
allowlistad spelstatus; identitet, pengar, framtida shoe och skyddat hålkort
stannar på servern. Opak spelaridentitet och samma spelares flera boxar bevaras.
Visningsnamn och chatt behandlas som otrusted data. Svar och chattrad hålls till
kvitterad verklig standard-idle, och väntande tal kan inte blockera deal.

Direkt laptop→privat Gateway kräver en privat Gateway-URL som inte finns i den
nuvarande miljön. Den rekommenderade vägen är därför den nya smala Director-
adaptern `POST /api/product/speech`, med en separat token som inte får vara
`LAB_API_TOKEN`. Adaptern godtar bara det validerade produktkontraktet, kräver
exakt talroll, deduplicerar request-ID och ger inte åtkomst till status, studio
eller Gatewayens generella `/v1`. Next Eventstudio fortsätter separat över
`LAB_REMOTE_URL` och `/api/studio/*`; endast native-servern under `web/` ska få
produktens speech-URL/token. Full drift- och säkerhetsplan finns i
`open-claw/lab/docs/PRODUCT-SPEECH-DEPLOYMENT-SV.md`.

Verifierat: 127/127 OpenClaw-labbtester och hela Git for Windows-pre-commit
passerar. Regressionerna täcker fel roll, samtliga revisioner, saknad/halv
transport, timeout, dubbelsvar/konflikt, promptinjektion, autentiseringsgräns,
opak identitet, flera boxar och att deal inte deadlockas av väntande tal.
Efter att riktiga relayvärden lades i den privata föräldramiljön isolerades även
`product-chat-http` uttryckligen från ärvda speech-, Gateway- och providerfält.
Ett separat poison-origin får nu noll anrop; de fem offlinekontraktsfilerna
passerar 25/25 utan att testkommandot behöver sanera sin egen processmiljö.
Ingen nyckel, Render-konfiguration, publik proxy, körande Gateway, port 4192/4194,
mediefil eller eventstudiofil ändrades. Ingen Gatewayomstart eller redeploy
gjordes; den nya rollen och adaptern är lokal kod tills den uttryckliga planen
godkänns och körs. Jira/CAC-status ändrades inte.

## 2026-09-25 — Eventstudion använder nu de exakta videomapparna i verklig uppspelning

Uppföljning av `9f55d66`: manifestets exakta resolver fanns men var inte kopplad
till Eventstudions och native-följningens faktiska klippval. De visade fortfarande
gamla seedvarianter och generiska originalförval. Båda vägarna använder nu samma
exakta mediefamilj: box 0–6 → deal_pos1–7 och event.line → motsvarande replik.
Kortets värde och handIndex bevaras som eventdata, inte som separata videofiler.

Sidomeny, översikt, videobank och varianteditor visar den fysiska familjestrukturen
och de verkliga filerna. Tom variantmapp betyder standard, utan modellanrop även
i aktivt/skuggläge. Nya filvarianter börjar manuella tills per-familj-policy
uttryckligen tillåter rules/model/random. Valfria mediaPolicy-fält är validerade i
modell och schema. Befintliga sparade projekt och andra dealers bevaras; gamla
demovarianter används inte för manifestägda Astrid. Ingen MP4 ändrades eller flyttades.

Uppspelningen lämnar kvitto med mediaId, fileName och familyId. En saknad/felande
variant provar standarden i exakt samma familj och därefter 2D, aldrig grannens
position eller en annan mening. Otydlig dealer-faceDown väljer ingen familj.
Fel och sena callbacks är avgränsade till sitt spel-ID.

Idleeditorn har en enda videoförhandsvisning, verkligt minutprov, seed och separata
planerade respektive faktiska loggar. Basloopar hålls igång under plansegmentet,
engångsvarianter får spela klart och återgår till bas. Timeravslut för bas heter
`base segment ended`, inte ett påstått naturligt video-completed. Stop/byte/tal
invaliderar playback synkront; sena start/end kan inte återta ägarskap.
Detta är ett lokalt policyprov, inte produktens driftsatta OpenClaw-idlescheduler
eller bevis på kompatibla poseövergångar/läppsynk.

Verifierat 2026-09-25:

- 358/358 labbtester, TypeScript, produktionsbuild, git diff --check och hela
  Git for Windows-pre-commit passerar. Dealer-sync --probe passerar alla fyra.
- I browsern spelade deal_pos3.mp4 färdigt (3375 ms). En riktig isolerad
  native-runda gav K♣ och 2♦ till box 2/handIndex 0; båda gav samma deal_pos3.mp4
  med slutkvitton. Öppna dealerkortet 3♥ gav deal_posdealer.mp4. Goodluck gav
  goodluck.mp4. Dold dealer/turn/reveal utan egen familj visades som tydlig 2D-reserv.
- Minutprov med seed 25 spelade basloopar, två faktiska blinkningar och
  återgångar; avslutades med `Minutprovet klart`, pausad video och inga konsolfel.
  Slutlig idle-layout verifierad utan dubblerad Stage. Stop/action-race och
  variant→standard→2D är komponenttestade.
- Vera, Astrid, Amira och Mei kördes med rehearsal=1 och goodluck två gånger;
  kontrollerna återaktiverades och inga konsolfel noterades. Detta är teknisk
  regression, inte ny mänsklig lipsync-acceptans. Befintliga acceptansluckor kvarstår.
- Read-only-underagent granskade resolver, server, Stage, GameStream och idle;
  identifierade race/fail-closed-fall rättades och regressionstestades.

Lokal jämförelse lämnas på 127.0.0.1:4192 och localhost:4194, startad med
tools/start-local-comparison.mjs --media-directory emil/dealklipp-v1. Den använder
temporär isolerad DB och blockerar externa provideranrop. Omstarter nollställde
bara denna demosession, inte produktdata eller Gateway. Native-observationen är
publik och identitetsfiltrerad; den är inte OpenClaws autentiserade identitetskälla.

OpenClaw-källindex och konfigurationslänkar finns nu även i labbets Guide och
Chatt & OpenClaw. Ingen dokumentations-MCP/fulltextdatabas installerades. Den
parallella anslutningsguiden från `1219d98` dokumenterar fungerande operatörsrelay
men blockerad produktchat (saknad privat Gateway-URL och fel rollkontrakt).
Se open-claw/lab/docs/LOCAL-CONNECTION-SV.md. OpenAI/provider och hemligheter är
oförändrade. Ingen extern redeploy eller Gatewayomstart gjordes.

Nästa avgränsade agentprompt: lab/docs/PARALLEL-OPENCLAW-SPEECH.md. Första
anslutningsprompten finns kvar som spårbarhet i PARALLEL-OPENCLAW-STARTUP.md.
Jira/CAC saknades i denna verktygsmiljö; ingen issuestatus ändrades. De tre
tidigare privata/untracked användarfilerna lämnades orörda och utanför commit.

## 2026-09-25 — Manifest v2, idlepolicy och OpenClaw-styrd talkö

På `jakeminator123/work` är `emil/dealklipp-v1` nu organiserad som exakta
mediefamiljer. Deal- och replikfamiljer har var sin standardfil och en
versionshanterad `variant/`; MP4-bytes, UUID, storlek och SHA-256 är oförändrade.
Det validerade manifest v2-kontraktet har 31 poster i 26 familjer och genereras
deterministiskt. Generatorn ignorerar `.gitkeep`, avvisar otillåtna/dubbla
sökvägar, ID:n, familjer och symlänkar utanför banken samt verifierar hash och
storlek före uppspelning. Exakt familj löses utan lån mellan replik, box eller
position; fallback är variant → familjens standard → 2D.

En senare uttrycklig idle-instruktion är den gällande modellen: två basloopar
(`idle_still`, `idle_breath`) och fyra engångsvarianter under `idle/variant/`
(`blink`, `cheek`, `glance`, `insulted`). Eventstudions förenklade idleeditor
visar fysisk familjestruktur, separat behörighet för schedule/rules/OpenClaw,
intervall, jitter, cooldown, maxfrekvens, deterministisk preview, beräknad
tidsandel och övergångslogg. Deal och tal avbryter idle; en engångsvariant går
tillbaka till baspoolen. Originalspelarens explicita allowlist innehåller nu
`actor-edge-blend.mjs` och `actor-grade.mjs`, och testet verifierar hela den
tillåtna statiska importkedjan.

Produktens `/chat` är nu en OpenClaw-adapter över serverauktoritativ och explicit
allowlistad publik spelstatus. Modellen får inte rått Partner-`playerId`, cookie,
wallethemligheter, framtida shoe eller dolt hålkort. OpenClaw får bara välja
registrerad replik, genererad text eller tystnad; sökväg, URL, timing och
`playNow` avvisas. OpenAI-kontraktet är oförändrat: bas-URL
`https://api.openai.com/v1`, modell `gpt-5.4-mini`, API `openai-responses` och
nyckelvariabel `OPENCLAW_MODEL_API_KEY`.

Ett svar kan beräknas under en action men hålls som `pendingChatReply` utanför
den enda befintliga talkön. Chattrad, caption, ljud och visuell talpresentation
släpps först efter kvitterad faktisk standard-idle med aktuella dealer-, session-
och rundrevisioner. Grinden hanterar stale state, cancellation och exakt-en-gång
utan att deadlocka dealen. Ett formellt talpaket binder exakt text, ljud, video,
hashar, frame-index, kalibrering och reviewstatus. Fri modelltext använder exakt
TTS mot neutral idle och får aldrig återanvända ett gammalt mun-klipp.

Partner-launch har ett frivilligt signerat och normaliserat `displayName` på
högst 40 kodpunkter. Namnet är endast otrusted presentationsdata; saknat eller
ogiltigt namn blir neutrala `spelaren`. Teknisk identitet är fortsatt stabil och
server-side, och samma autentiserade spelare kan fortfarande spela flera boxar.

Verifiering: manifestcheck 31/31 poster och 26 familjer; 346/346 labbtester;
lab TypeScript och produktionsbuild; 85/85 OpenClaw-/gatewaytester; de nya
produkt-, pose-, talpakets-, Partner- och allowlistkontrakten; hela Git for
Windows `.githooks/pre-commit`; samt `node pipeline/audit-dealer-sync.mjs
--probe` passerade för alla fyra dealers. På isolerad `localhost:4196` och
separat datakatalog spelades `greeting` två gånger i följd för Vera, Astrid,
Amira och Mei genom den riktiga rehearsal-spelaren. Kontrollerna återaktiverades,
varje dealer återgick till renderad idle och webbläsarkonsolen hade noll varningar
eller fel.

Detta är inte ett mänskligt godkännande av läppsynk eller kontaktkvalitet.
Auditens kända saknade tal-/acceptansluckor kvarstår, och ändrad ljud- eller
videohash kräver ny visuell granskning per rad. Jira/CAC var inte anslutet i
denna miljö, så ingen issue eller status kunde läsas eller ändras.

## 2026-09-25 — Labbet läser Emils videomapp och shellradslut är låsta

På `jakeminator123/work` är Videobankens grundkälla nu direkt
`emil/dealklipp-v1/`, inte det raderade externa generationsarkivet. Ett
incheckat metadataregister listar 31 befintliga MP4-filer (8 deal, 6 idle,
17 repliker) med relativ sökväg, storlek och SHA-256. Filerna kopieras inte och
MP4-innehållet semantiskt indexeras inte. Alla poster visas som omappade
Astrid-kandidater i labbets inkorg; ingen eventkoppling, produktkoppling eller
visuell acceptans görs automatiskt. En begärd preview hashkontrolleras alltid
innan bytes serveras, även efter en lika stor snabb filändring på Windows.

Rotens privata `.env` kontrollerades endast för variabelnamn: 14 unika namn och
exakt en `CARTESIA_API_KEY`; inget värde lästes ut eller skrevs till Git.
`_ENVIROMENT-INFO.md` beskriver placering, sekretess och att dagens labbkod ännu
inte anropar Cartesia automatiskt. `LAB_VIDEO_ARCHIVE` är nu bara en valfri
override för en rot med samma Emil-manifeststruktur.

`core.autocrlf=true` hade, utan `.gitattributes`, gett CRLF/mixade radslut i
shellfiler. `.gitattributes` låser nu `*.sh` och `.githooks/*` till LF; samtliga
16 berörda arbetskopiefiler har noll CRLF. Git for Windows egen `sh` körde hela
`.githooks/pre-commit` med exit 0. PowerShells första `bash` är däremot WSL och
saknar `ffmpeg`; det separata WSL-felet ska inte förväxlas med hookens radslut.
`rg`-felet är också separat: PATH väljer först en WinGet-symlink under
`C:/Program Files`, som Codex-sandlådan inte får starta, medan Codex egen
bundlade `rg.exe` fungerar.

Verifiering: standardregistret rapporterar 31/31 filer tillgängliga och riktig
preview av `deal_pos1.mp4` gav HTTP 200 med rätt längd/typ. 323/323 labbtester,
TypeScript, `node pipeline/audit-dealer-sync.mjs --probe` (90 streams) och hela
Git for Windows-hooken passerade. Produktspelaren och dess media ändrades inte;
den fyrdealer-rehearsal som dokumenteras direkt nedan är därför fortfarande
den senaste visuella produktkontrollen. Jakobs befintliga dirty-filer, inklusive
`lab/next-env.d.ts`, lämnades utanför leveransen. Jira-anslutning saknades och
ingen CAC-status ändrades.

## 2026-09-25 — Emils Astrid-klipp mergade till work som omappat labbunderlag

På Jakobs uttryckliga begäran utgår arbetet från `jakeminator123/work`, inte
från main. Före integrationen skapades och verifierades den annoterade
GitLab-taggen `work-before-emil-videos-2026-09-25` över
`64f1669a3484fce3c7a3ad4d8207106b1bf3deea`. Taggen och branchoperationerna
gick via SSH-remoten `git@gitlab.com:scout-gg/croupier.git`.

`origin/emil/dealklipp-v1` mergades som `167d2ddea8c82d30ccae121d1954731fde64d3a4`.
Den isolerade katalogen `emil/dealklipp-v1/` innehåller åtta utdelningsklipp,
sex idle-klipp, sjutton exakta tal-klipp, en startbild och textmetadata. Inga
befintliga produktmediafiler ersattes. Repoets `.cursorindexingignore` utesluter
MP4 och övriga binära bild-/ljudformat från semantisk indexering; README och
JSON-sidecars förblir läsbara för den kommande mappningen.

Labbets lokala uppladdningsbank `lab/data/videos/` fanns inte. Det externa
originalarkivet `C:/Users/jakem/CroupierAssets/bettalotto-generations` innehöll
224 MP4-filer, 1 022 561 047 byte. Dessa flyttades till Windows papperskorg;
noll MP4 återstår där och katalogens enda JSON-metadatafil behölls. Detta är
återställningsbart från papperskorgen. Produktens spårade dealer-/reviewmedia,
databaser, env-filer och Jakobs befintliga dirty-filer lämnades orörda.

Emils filer är ännu inte registrerade mot labbets videoindex, event, situationer
eller projektvarianter och används inte av produktspelaren. Nästa steg är den
uttryckliga mappningen; ingen take, läppsynk eller kortkontakt godkänns av denna
integration.

Verifiering: `node pipeline/audit-dealer-sync.mjs --probe` passerade samtliga
90 befintliga streams. Alla kommandon i `.githooks/pre-commit` passerade när de
kördes direkt med Windows Node/FFmpeg-miljön. Själva Bash-hookfilen hade CRLF i
arbetskopian och kunde därför inte användas som ett tillförlitligt wrapperkvitto.
På isolerad `localhost:4194` med tillfällig databas visades Vera, Astrid, Amira
och Mei i faktisk rehearsal. Varje dealers `greeting` spelades två gånger med
två matchade start/slut-par; knappen blev åter tillgänglig och browserkonsolen
hade inga varningar eller fel. Detta verifierar oförändrad befintlig spelarväg,
inte uppspelning av de ännu omappade Emil-klippen.

## 2026-09-25 — Jakobs dokument samlade i systemkartan

På Jakobs uttryckliga val levereras städningen på `jakeminator123/work`.
Roten `random-stuff-jakob/jakob-docs/` har nu bara en aktiv README-vägvisare;
den ignorerade privata åtkomstfilen ligger orörd. Fyra värdefulla referenser
(kort start, miljö/API, signaler/takes och eventregister) är flyttade till
systemkartans ämnen. Fem äldre rapporter/prompter är borttagna ur arbetskopian
efter att relevant innehåll samlats i aktiva guider och
[Livejämförelse](systemkarta/06-arbetssatt-och-verifiering/LIVEJAMFORELSE.md).

[Kort start](systemkarta/START-HAR.md) är ingång
för Jakob och agenter. [Dokumentordningen](systemkarta/06-arbetssatt-och-verifiering/DOKUMENTORDNING.md)
anger varje flytt/ersättning och återställningsrevision `17afbf1`. Äldre
leveransnotiser nedan behåller sina dåvarande filnamn som proveniens, inte
som aktiva läsanvisningar. Det pensionerade personarkivet har inte lästs,
flyttats eller återställts. Inga env-värden, privata åtkomstanteckningar,
råloggar, media eller sparade labbprojekt har lästs eller ändrats i städningen.

Gamla uppgifter om avsaknad av native→Partner-publicering och enbart manuell
labbkontext är rättade mot den integrerade work-koden. Daterade testresultat
skiljs från dagens drift. Ursprungliga källistor, kontraktsdetaljer och
miljövariabelnamn är bevarade; miljöinventeringen behåller datum 22 september.
Inkommande dokumentlänkar och de flyttade filernas relativa länkar är uppdaterade.

Verifierat: 292 lokala länkar, inklusive 10 rubrikankare, i 24 dokument utan
trasiga mål (handoffkontrollen gäller denna nya notis); alla nio ursprungliga rotfiler finns i
Git vid `17afbf1`. `node --test lab/test/video-registry.test.mjs`: 13/13,
inklusive ändrade bytes med oförändrad filstorlek efter cachelagring. Det gamla
cachefelet återges därför inte som ett bekräftat aktuellt fel. `git diff --check`
passerar. Inget gameplay eller media har ändrats; ingen ny fullständig runtime-,
läppsynk-, deploy- eller Jira-QA påstås.

Kvar: grön bild i labbets spegling observerades den 25 september medan
originalfliken visade Astrid och labbet hade 0 instruktioner/0 kommandosvar.
Orsak och en ny spelhand efter anslutning är inte belagda. Bettalottos
native-version, Director-kontext v2 i drift och produktens gemensamma
talägarskap kräver fortfarande egna behöriga integrationsprov.

## 2026-09-22 — Kevin-integrering i Jakobs work och gemensam livejämförelse

Leveransen är pushad som `dff5712` till både kanoniska GitLab/work och privata
GitHub/work. GitLab bekräftade MR !1 som merged via `7874097`. En efterföljande
driftgranskning preciserar kvarstående gräns: Render Director bygger bara
`open-claw/lab/`, inte lokala Next-labbet eller Bettalottos `web/`-server/klient.
Alla tre måste ha rätt version för hela liveflödet. Director behöver kontext
v2; någon Gateway-uppdatering krävs inte för just det kontraktet. Bettalottos
native-version kunde inte fastställas med offentliga JS-GET (401, inte bevis
för eller emot ny kod). Enbart Director-deploy är därför inte en komplett
live-acceptans. Live-deploy, behörig versionskontroll och separat godkänd
testsessionsrunda återstår; ingen driftsättning eller riktig spelrunda
utfördes i efterkontrollen. Lokal helhet är testad enligt kvittot nedan.

Arbetet utgår från `jakeminator123/work`, inte från main. Backup-taggen
`backup/jakob-work-pre-kevin-20260922` på GitLab och privata GitHub pekar på
`6fe7c82d1522db9c9d4f611ad44006648ec355aa`. Fyra redan lokalt ändrade/nya filer
säkerhetskopierades separat under den ignorerade
`.croupier-inbox/checkpoints/pre-kevin-20260922`; de ingår inte i leveransen.
Integrationen tar in Kevin/MR !1 från `b066a43ba18b7da8a405c99789374680c5ed07db`.
Handoff-historiker, native→Partner-publicering, CRAIG/BO-auth och gäståtkomst
bevaras. Original `/` och Kevin `/v2/` är separata presentationslägen.
V2:s pausade Astrid-utdelningsfilmer aktiveras inte av denna integration.

`/api/table` returnerar nu samma publika `presentation[]` som den redan
efter-commit-publicerade Partner-strömmen. Senaste listan sparas transaktionellt
för idempotenta retries. Ingen extra spelhandling skickas av labbet; kort,
shoe, wallet och utbetalningar ägs fortfarande av samma servermotor.
En uttryckligt aktiverad native-observer skickar offentliga serversvar,
instrumenterade klipp-/tal-/kortkvitton och chatt till den öppnande lokala
labbfliken. Origin, popup och engångskanal kontrolleras. Hemliga fält och
URL-parametrar filtreras; dold hålkortsidentitet lämnar inte gränsen.
Klippval, faktisk mediastart och animationsavslut är olika sorters bevis.

Labbets Händelselogg har **Anslut**, original/labb samtidigt, automatisk
framtidsföljning, separat senaste offentliga bordsvy och hopfälld Diagnostik.
HTTP/native och SSE dedupliceras på kommando/version, inte på ungefärlig tid.
Saknade instruktioner hittas inte på. Bilddelning kräver fortfarande
webbläsarens uttryckliga flikval; speldata fungerar utan bilddelning.
**Ny observation** startar ett nytt avgränsat minnesprotokoll utan en ny
spelhandling. Exportera först om den gamla observationen ska bevaras.

Variantbeslut får det exakta eventet, observerade resultat före det och högst
åtta tidigare chattmeddelanden (600 tecken vardera, 3 200 totalt), med
tidsgräns och proveniens. Okänd historik/språk markeras som okända. Modellen
får bara välja redan tillåtna varianter; chatten är data, inte instruktioner.
En separat context-v2-kvittens förhindrar att äldre Director-kod tyst kastar
bort chattfältet. Ett begränsat riktigt shadow-prov mot befintliga Render
visade `remote_context_not_supported_baseline`: tjänsten behöver uppdateras
innan den observerade chatten kan påverka live-modellval. Labbet behåller
standard och visar orsaken. Ingen Director-/Gateway-/Bettalotto-deploy är
gjord i detta kvitto. Riktig spelar-chat ersätts inte av labbets operatorchatt.

Mapping v2 skiljer materialkatalog från uppspelning, original från 34 V2-
taluppsättningar och aktiva/pausade filmvägar. BO:s Generations-/swipevyer
delar enkel-preview-hanteringen. Ett riktigt Windowsfel är rättat:
normaliserade backslash-sökvägar hindrade `/bo/` från att hitta index.html.
`/bo` leder nu till `/bo/`; autentisering ligger kvar före statisk servering.

V5-källan är flyttad till `docs/animation-events/v5-7-days-mvp`: D0 + sju
arbetsdagar. Aktiva länkar, Guide och Jakobs systemkarta är uppdaterade efter
work-koden. Daterade drift- och granskningsbevis är fortfarande daterade;
lokala docsändringar är inte automatisk wiki-/webbpublicering.

Isolerat prov: bygg `lab`, kör `node tools/start-local-comparison.mjs` från
reporoten. Riktigt lokalt spel: `http://localhost:4194`; labb:
`http://127.0.0.1:4192/activity`. Temporära databaser, slumpade testnycklar och
processlokal konfiguration används. Inga riktiga konton/saldon eller `.env`
ändras, och externa modell-/mailanrop blockeras. Browserprovet i
`test/local-comparison-browser.mjs` använder riktig spelmotor/native/SSE men
ett uttryckligt syntetiskt chattsvar. Det ersätter inte ett live-providerprov.

Valfria `CROUPIER_GENERATIONS_DIR` kopplar BO och dess token-skyddade API till
en skrivskyddat serverad lokal mediemapp. Fixtureverktygets
`--media-directory <katalog>` använder samma mapp även för labbet utan att
kopiera filer eller ändra `.env`. Det befintliga externa mediearkivet
`C:/Users/jakem/CroupierAssets/bettalotto-generations` innehåller 224 MP4-filer
vars ID och storlekar matchar katalogen. Detta är inte en generell hash- eller
kvalitetsacceptans, och inte det pensionerade personliga dokumentarkivet.
BO-auth respektive API-token krävs; enbart katalogkända filnamn serveras,
med skydd mot sökvägsflykt och symboliska länkar samt stöd för byteintervall.
Windows-alias med annan skiftlägesform, avslutande punkter/mellanslag eller
kodade separatorer går också genom BO-auth och katalogkontroll; detta provas
mot en syntetisk standardmapp, inte mot användarens filmer. Inget arkiv raderas
av fixtureverktygets städning.

Verifierat: alla pre-commit-kommandon, dealer-audit med `--probe`, 322 labbtester,
TypeScript och labbets produktionsbyggnad, 112 OpenClaw-tester, två isolerings-
fixturetester och nya medie-/authregressioner. Senaste riktiga browserprov
2026-09-22 02:21 UTC bekräftade 13 sekvenssteg, 13 labbval, 13 uppspelningsavslut,
13 deduplicerade event och 19 native-uppspelningskvitton, samt observerad chatt
i beslutspayload. Antalet event varierar med den riktiga motorns givna kort;
kvittona jämförs per kommando, inte mot en fabricerad fast runda.
Ny observation skapade inget extra spelkommando, SSE-abonnemang eller fönster.
Mobilvyn hade ingen horisontell sidöverströmning. Alla fyra originaldealers
samt Astrid/Amira V2 klarade `goodluck` via verkliga spelarens **Play twice**;
stillbilder granskades, inte en ny fullständig läppsynkacceptans.
BO-inloggning, Generations, swipe och Dealing Clips testades. Efter montering
av det externa arkivet spelades ett Generations-stickprov faktiskt upp;
två lokala Dealing Clips spelades också upp och det andra pausade det första.
Browserproven gav inga JavaScript-fel. Privata körkvitton finns under den
ignorerade `.croupier-inbox/qa-20260922/`, inte som en del av Git-leveransen.
Ingen ny film genererades eller baslinje skrevs om. Befintliga saknade takes
och mänsklig läppsynkacceptans kvarstår; automatiska prov godkänner dem inte.
Ingen Jira-status ändrades utan aktuell issue/QA-verifiering.

## 2026-09-22 — äldre GitHub-adress, lokal env-inventering och kort start

The old private `Jakeminator123/gitlab-work` repository is now a signpost:
its current `jakeminator123/work` branch contains exactly one `README.md`,
linking to private `Jakeminator123/github-work` and canonical GitLab. This was
a normal fast-forward commit (`f7fb7e7`); the old code remains recoverable in
its Git history. GitHub UI confirmed the repository stayed private and showed
only the redirect README on its default branch. Do not mirror new work there.

Updated Jakob's `_env.explanation.md` with **names only** from the actual
local files: 13 assignment names in root `.env`, three in `lab/.env.local`,
plus the checked-in `lab/.env.example` and `open-claw/lab/.env.example`
templates. No values were copied, logged or changed. Root
`_ENVIROMENT-INFO.md` points to that inventory. New
`random-stuff-jakob/jakob-docs/KORT-START-HAR.md` is a short repo map for
Jakob/agents, including the external Bettalotto MP4 scratch/mapping folder
Jakob reported (path unverified and intentionally not recorded), env locations,
mirror rule, and indexing boundary. Jakob docs README and root README link to
it. No media,
credentials, runtime, deployment or Jira status changed.

## 2026-09-22 — work-branch delivery rule and indexing hygiene

Added a branch-scoped agent rule in `.cursor/rules/work-branch-mirror.mdc` and
`AGENTS.md`. For approved deliveries on `jakeminator123/work`, use
`node tools/push-work-mirrors.mjs`: it checks both remote heads are ancestors,
pushes canonical GitLab first and the private `Jakeminator123/github-work`
reference copy second, then verifies identical commit IDs. `--check` is a
read-only preflight. This is a deliberate agent workflow, not unattended
server-side mirroring; a failed second push must be reported and retried.

Metadata-only indexing audit: 4,230 tracked paths, including 41 `.blend`
files (about 1,266 MiB), 28 `.glb` (432 MiB), 277 `.mp4` (366 MiB), plus
tracked images and audio. Local `lab/node_modules` holds about 10,935 files
(342 MiB) and `lab/.next` about 441 files (345 MiB); both were already
Git-ignored. `.cursorindexingignore` now excludes dependency/build folders and
binary media/3D formats from semantic indexing while leaving source, sidecar
JSON, manifests, and all actual files intact. No media bytes or approved
asset hashes changed. Do not delete or rewrite tracked media casually: future
Git-size/LFS work needs a separate plan and visual/calibration safeguards.

Validation: `node --check tools/push-work-mirrors.mjs`, `git diff --check`, and
`node tools/push-work-mirrors.mjs --check` passed. No gameplay, media bytes,
database, deployment, or Jira status changed. Existing unrelated local edits
remain untouched.

## 2026-09-22 — rätt privat GitHub-kopia för browser-GPT

The private GitHub backup is now `Jakeminator123/github-work`, branch
`jakeminator123/work`. Its purpose is read access for Jakob's browser-based GPT
environment, which currently cannot access GitLab; GitLab remains canonical.
The older misnamed `Jakeminator123/gitlab-work` was retained until the new
private repository had the complete branch and matching commit. The portable
V5 handoff and root README now point to the correct URL. A private repository
does not grant any browser agent access by itself; check the intended reader's
authorization separately. Continuous automatic mirroring is not configured;
push the GitHub copy after each approved GitLab update and verify matching
commit IDs.

Documentation-only change. No game, media, database, environment or Jira status
was changed. Existing unrelated dirty and untracked files remain untouched.

## 2026-09-21 — portabel sjudagarshandoff för nya personer och agenter

Added `docs/animation-events/v5-7-days-mvp/HANDOFF-7-DAGAR.md`: a portable
D0 + seven-day context pack for Cursor, Codex, browser-GPT and human handoff.
It maps Jakob/Kevin/Emil ownership, canonical sources, product/lab/OpenClaw
boundaries, repositories, storage, secrets by variable name, runtime and ops
API surfaces, evidence levels, the seven execution days, a daily receipt and
a compact copy/paste prompt. V5 remains canonical; the new handoff is a map,
not a parallel Jira or runtime contract. Root and active sprint navigation now
point to V5 and the handoff.

Documentation-only validation: relative links were checked against the
working tree and `git diff --check` passed. No gameplay, media bytes, frame
index, calibration, API behavior, environment value, database, Render service,
Jira status or visual acceptance changed. Current Jira CAC issues were not
available through a connector, so the handoff requires the next implementer to
read live Expected Result/custom fields before work. The private GitHub backup
is documented as a manual private copy; continuous mirroring is still open.
Pre-existing dirty/untracked user files remain excluded.

## 2026-09-21 — Scout-brandad Croupier Lab-dashboard

Labbet har fått en egen Scout-brandad dashboardyta direkt i den befintliga
Studio-vyn. Det offentliga referensrepot
`Jakeminator123/cyberpunk-dashboard-design` (läst vid `5fc4af3`) användes som
visuellt underlag, medan källan och alla funktioner fortsatt är Croupier
`jakeminator123/work`. Ingen iframe, parallell datamodell eller kopierad Studio
infördes. Eventstudion är fortsatt standard på `/`; Nodträdet, Videobanken,
Händelseloggen, Chatt & OpenClaw och Guide använder samma befintliga rutter.

Paletten följer den aktuella Scout-webben: ink `#0A0B0D`, off-white `#F2F1ED`,
lime `#D6FF3A`, djup lime `#B5DC1F` och steel `#5A6470`/`#1F252E`.
`image.png` fanns inte i workspacen eller referensrepot, så wordmarket är
kodbaserat. Endast snedstrecket är lime och får en begränsad 3D-animation.
Header, sidomeny, arbetsyta och scen har korta orienterande övergångar; aktiva
noder och statusar har tydligare hierarki. Reduced-motion stänger av allt nytt.
Designbeslut och lokal körning finns i `lab/docs/DASHBOARD-DESIGN.md`.

Validering: `npm run typecheck`, hela labbsviten (304 tester) och Next 16.3.5
production build passerade. Det byggda labbet granskades på isolerad
`127.0.0.1:4200`: standardvyn, Guide-navigering, sex huvudvyer, Scout-tokens
och avsaknad av horisontell overflow verifierades; webbläsarkonsolen hade inga
varningar eller fel. Previewprocessen och previewfliken stängdes efter kontrollen. Ingen gameplay,
dealerfilm, ljudfil, frame-index, kalibrering, serverdata eller Jira-status har
ändrats.

## 2026-09-21 — natural name questions and budgeted OpenAI search

Live follow-up: both chats answered Jakob/John and follow-up questions correctly.
Kevin's browser TTS completed in 12.771 seconds under the 25-second limit.
An OpenAI search selected a lookalike OpenClaw documentation site; official
OpenClaw queries now filter to docs.openclaw.ai and reject other citations.
Poem direction requests four rhyming lines without an introductory paragraph;
both chat paths replace malformed model output with a local four-line original.

Follow-up to e07dd86 based on user live QA. Both lab chats now receive the
same temporary fictional cast; Vem är Jakob/John and Berätta om Jakob with a
follow-up sentence work. Shared descriptions persist in request context, not
as verified personal facts. Fixed compact chat form layout and remaining
six-second UI labels; the actual speech limit is 25 seconds.

DuckDuckGo connections timed out on Render. Jakob explicitly selected the
existing OpenAI connection instead. A private authenticated helper on Gateway
port 18790 reuses its existing provider key, without copying keys or enabling
native agent tools. Fixed GPT-4.1 mini snapshot, one web_search call, 512 output
tokens, no retries. Durable pre-call reservation: 0.50 SEK/attempt, ten attempts
per rolling hour, 5 SEK budget. Search pricing review required on 2026-10-21.
Normal chat, hosting and ElevenLabs are separate. See COMPANION.md for pricing,
retention, ports, disable switches, exact rollback and deployment receipts.

Validation: 111 OpenClaw/deployment tests, 302 lab tests and production build
passed. Real OpenAI search returned a cited official documentation link.
Final live verification returned only docs.openclaw.ai/install and four-line
mixed-language poems in both the player and operator chats.
Four-dealer greeting Play-twice checks completed on isolated rehearsal host;
no new visual or lip-sync acceptance. This supersedes the original free-search
and exact-only trigger descriptions below. No Partner/product migration.

Final source revision: `cbb856e75f5499ad882f56dfa093046210e70665`.
Render receipts: Director `dep-daoals0473hc739jad00`; private Gateway
`dep-daoalujtqb8s73ej1520`. Exact rollback order and disable switches are in
`open-claw/lab/docs/COMPANION.md`.

## 2026-09-21 — reversible OpenClaw lab companion, based on V5 94a2688

Added to Astrid's existing lab social chat: chosen names Jakob/Emil/Kevin/Alex/John,
return greeting, separate persistent profile history and explicit forget. The
browser gets an opaque HttpOnly identity; names cannot select another profile.
The authenticated Director stores the last 12 posts / 8000 characters, up to
30 inactive days, separately in companion.sqlite. Forget invalidates in-flight
replies. No real player/game database, Partner production or media is modified.

Explicit "Berätta om <name>" produces one original friendly mixed Swedish/German/
Chinese poem with requested jokes. No Lundell quotations, self-chat, cron or
native tool expansion. Jakob explicitly raised the social speech limit to 25
seconds; poems use the existing exact-text TTS and single-owner idle path.
Metadata preflight/watchdog/cancellation remain enforced. Web search uses
only key-free DuckDuckGo HTML: 0 SEK search fees, at most 20 attempts per rolling
hour across the Director, durable reservations before I/O, no paid fallback.
This cap excludes existing model, hosting and optional ElevenLabs charges.

Rollback and exact boundaries: open-claw/lab/docs/COMPANION.md. Three independent
LAB_COMPANION_* switches. Runtime context package 2026-09-21.1 preserves native
configs/human text and uses the existing snapshot/backup mechanism. Product
speech ownership and verified Partner identity integration remain Kevin's V5
work; lab-observer identifiers are never treated as visitor authentication.

Local validation: 107 OpenClaw/deployment tests, 302 lab tests, TypeScript and
Next production build passed. All pre-commit commands and dealer-sync probe
passed; re-run for final speech-limit change is recorded with delivery. Added persistence/isolation/forget/race/quota,
request-idempotency, authenticated endpoint, single-search-loop and UI tests.
Deployment/live evidence will be recorded in COMPANION.md after verification.
Jira browser is signed out and no Jira connector exists; no CAC transition or
Done claim. Inbox credential read is EPERM; role check was inactive. Preserved
all four pre-existing untracked user files. No new visual/lip-sync acceptance.

## 2026-09-21 — V5 sprint publication and complete base-speech intake

Published and checked: Croupier source fd51d12 (including d382b46/0b30694),
GitHub site f43806b and wiki 6d2996e. Stable Vercel shows V5/7b010e2b2054;
wiki landing and video instructions were checked in the authenticated browser.
Website CI succeeded; 17 local site tests and 44-file source/mirror sync passed.
See docs/animation-events/V5-PUBLICATION.md for links, checks and boundaries.

V5's canonical source is docs/animation-events/v5-7-days-mvp: seven chapters,
decisions, evidence and publication instructions. It replaces active V4 links
without rewriting historical runtime evidence. Sources include today's active
Jakob notes and selectively read local backoffice exports; raw logs, personal
data and credentials remain private. The eight-day plan assigns Kevin product
integration and Emil/Kevin exact media/lip-sync deliveries while Jakob travels.
Jakob's OpenClaw chat is the requested conversation/speech decision owner.
Product triggers and /chat already use a shared client speech queue; extend
that implementation and consolidate decision ownership rather than creating a
second queue. This product integration is not implemented by the docs release.

Lab schemas, policies, 2D assets and product manifests are indexed in
lab/docs/ARTIFACTS.md. The shared speech implementation brief is now
lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md; the old Jakob prompt links to it.
A take delivery/review template and schema README clarify evidence and storage.
The lab guide/central glossary and public video/trigger instructions are updated.

Fixed a real intake gap: speak.other now accepts the existing greeting, peek,
bust, sidebet, chatter1, chatter2 and farewell lines, alongside its prior seven.
Contract/schema changed together; exact line validation is preserved. No event
IDs, project migration, media bytes, calibration or player modules changed.
Regression covers upload/reload/binding and greeting being rejected for win.

Validation: 297 lab tests, Next production build including TypeScript, all
commands in .githooks/pre-commit and audit-dealer-sync --probe passed. This
release does not add new visual/lip-sync approvals. Earlier four-dealer actual
player Play-twice results below remain dated evidence. Wiki/site use the
canonical V5 source and hash manifest; publication receipts are recorded in
docs/animation-events/V5-PUBLICATION.md after remote verification. No product
deployment or CAC status change is implied. Existing unrelated untracked files
are preserved and excluded; the older dirty website checkout is untouched.

## 2026-09-21 — common OpenClaw decision boundary and reachable exact speech

Both Studio event tests and GameStream now call `/api/presentation/decision`.
The legacy `/api/simulate` shares the same process-level service, including
across separate Next route bundles. Identical request IDs/content join/reuse
the decision; changed content returns 409. Cache: 128 jobs, five minutes after
completion, four concurrent decisions. This deduplicates decision attempts,
not playback across tabs or server processes. Source correlations stay separate
from decision IDs and are not sent to the model. Decisions report owner/reuse
and explicitly do not claim playback. Incompatible/unavailable explicitly
bound alternatives are removed before model/rules/random choice. The protected
standard and its marked fallback remain. Product speech ownership is unchanged.

The lab's existing speak.other group now exposes exact local speech examples;
Astrid has 14 choices there plus three dedicated speech nodes (17 speech clips).
Previously unmapped recorded greetings/bust/social lines resolve by exact line.
Received instructions cannot be overwritten by an example. Turn/settle/reveal
explain their role and absent dedicated original video; result speech is a
separate speak instruction, never duplicated onto settle. Coverage includes
original presets; the event result no longer incorrectly says "no video" when
an original preset was selected. No event-ID migration or media-byte changes.

Authenticated live generations/mapping returned 200, revision null. Presence
check found all 89 engine video paths, 78 audio paths and six staged paths
already local. No download was needed; this is not remote-byte equality or
visual approval. The supplied observation JSON has two status records and no
round records. It cannot reconstruct the earlier live game. Do not substitute
the previous isolated QA fixture as live evidence.

The full work summary is in Jakob's active folder:
random-stuff-jakob/jakob-docs/ARBETE-2026-09-21-ORIGINAL-OCH-OPENCLAW.md.
Active system map and lab guide were updated. Earlier native Partner publication
and BO single-preview fixes are included in that summary; lab variant decisions
are still not integrated into native/BO runtime. Live branch/revision is unknown.

Validation: 296 lab tests, TypeScript and final Next production build passed;
all pre-commit checks plus audit-dealer-sync --probe passed. A browser-driven
Astrid blackjack event used the configured OpenClaw connection, reported an
accepted choice and completed exact original playback. An earlier direct HTTP
greeting test also returned responded/accepted. Both API addresses were checked
against the same decision ID: the second reused the first. Astrid greeting
preview completed twice in the lab. All four actual players at isolated
rehearsal.localhost:4194 ran greeting with Play twice and two matched start/end
pairs; no console warnings/errors. This is lifecycle verification, not renewed
full audio/lip-sync or intended Astrid identity acceptance. Final lab tab: 4192.

Private QA data/logs remain in ignored lab/data/qa-director-20260921. No live
bets, real user DB changes, media generation, push or deployment. Two explicit
OpenClaw smoke calls were made; no speech generation. Inbox credential access
remains EPERM and no Jira connector/current issue was available; no CAC status
or Done claim. Four pre-existing untracked user/other-task files are excluded.

## 2026-09-21 — local originals, shared observation sequence, native publication and BO preview ownership

The lab now resolves the existing standard variant's empty video binding to a
registered local original for the selected dealer and exact supported source
event. Explicit project video bindings take precedence; alternative variants
never borrow the default. No project migration or media-byte change was made.
The inventory has 84 available entries across four dealers, including 22 Astrid
entries. Native MP4, indexed H.264 with its exact audio and packed base-staged
takes reuse the product media modules. Rejected Astrid action is excluded.
Canonical staged destinations are limited; contact across later cards, all
seats, split and transitions is not established. This is no new visual approval.
Jakob reported that the browser did not show Astrid; subsequent local screenshots
showed the material registered under Astrid in both lab and actual player.
That confirms the code's selection, not the intended visual identity.

Händelselogg contains a single reference/lab viewing surface. Browser-selected
reference-tab video stays local, with no recording, upload or captured audio;
controls and sound stay in the original tab. Cross-site authenticated embedding
is not bypassed. The tab chooser still needs a manual browser check.
Partner instructions and imported observations become an ordered sequence with
per-step playback and links into the existing editor. Exact public cards,
destination and line survive editing; hidden ranks are redacted. Lab playback
has separate start/end/error receipts. HTTP/SSE duplicates are merged; conflicting
correlations, gaps and capacity limits stop following. Follow-new is opt-in and
uses standard selection initially. No automatic model calls or fabricated live
traffic occur. The trace survives lab navigation but not page reload. The 2D
scene is an event preview, not a persistent reconstruction of every game hand.
Original-client clip/landing telemetry and actual live choreography remain absent.

Native /api/table commits wallet/shoe first and then publishes to the verified
Partner-launch session's exact key/player channel. State reads, retry, stale or
illegal commands and rollback do not republish. Publication failure cannot turn
an accepted command into a failure. The events scope can read SSE without gaining
play/wallet. CROUPIER_DATA_DIR allows the real local server to use isolated QA
databases; existing defaults and temporary guest access are unchanged. The bridge
is local code, not deployed to Bettalotto; live round delivery is still unverified.

The BO catalogue and voice previews now share one preview controller: starting
another pauses/rewinds the previous, and navigation/redraw/pagehide releases media.
BFCache restoration rerenders the current section; the API Keys view exposes
the read-only events scope without creating a key. This repairs an identified
local concurrency gap. Kevin's historical double-stream
incident was not reproduced. Multiple catalogue families and synchronized engine
image/matte decoders must not be mistaken for two competing runtime takes.
See the active system-map ASTRID-KALLKARTA-OCH-DUBBELSTROM-2026-09-21.md and the
separate PROMPT-OPENCLAW-SOM-TALAGARE.md. OpenClaw ownership is specified there;
it has not yet replaced all product speech producers in this change.

Validation: 286 lab tests, TypeScript and the Next production build passed; all commands in .githooks/pre-commit
and audit-dealer-sync.mjs --probe passed. BO adds three focused ownership/cleanup
tests, all passing. Chrome QA used lab port 4192 and a separate data directory;
actual player QA used rehearsal.localhost:4194 and isolated CROUPIER_DATA_DIR.
All four dealers' greeting was exercised with Play twice and matched start/end
pairs; screenshots confirm visible media, not full audio/lip-sync acceptance.
An isolated native transaction fixture produced three real in-memory publications;
imported into the browser, all 12 presentation steps played to completion with
49 log rows (import plus input/decision/start/end per step) and no console warnings
or errors. Opening step 2 in the editor retained 8-spades, box 0, hand 0.
Import initially failed until Chrome file access was enabled, then succeeded.
No live bets, real user database changes, paid model/media calls or deployment.

Inbox check remains blocked by EPERM reading its existing credential. No Jira
connector/current issue was available, so no CAC status or QA completion is claimed.
The user's three supplied untracked inventory/export/text files remain outside
this task's commit. Private QA data and logs are under ignored lab/data.

## 2026-09-21 — Astrid inventory traced; explicit base-staged launch in the lab

Jakob moved the supplied motor inventory into random-stuff-jakob. Its parsed
Astrid JSON exactly matches the saved generations mapping: 19 engine clips
(idle, action and 17 speech), four base staged takes and two continuations.
Authenticated metadata/HEAD checks found the base manifest, all six staged
files, all 19 engine streams and 17 audio files available. The smooth60/rhythm
manifests and native goodluck/win MP4s return 404. The old action remains
intentionally rejected; no rejection or speech binding was changed.

Added an explicit activity-page choice, "Testa Astrids grundfilmer" →
"Öppna staged-grundläge". It obtains a normal Partner launch for the configured
player, validates its destination, and retains only its token plus Astrid and
performance=staged. Normal launch still uses the server's original URL. This
is a diagnostic mode for review footage, not visual acceptance or a repair of
native-to-Partner event publication. No launch token is logged. Mapping log
metadata now names its source/dealers and explicitly marks actualPlayback=false.

Documented native speech triggers, idle behavior, missing gesture clips,
native/Partner double-and-bust ordering differences, and existing 2D duration
support in random-stuff-jakob/jakob-docs/systemkarta/03-dealers-video-takes/
ASTRID-LIVE-2026-09-21.md. Updated the lab guide and the 2D-agent prompt.
Catalog show.* labels are not observed playback events. Next correlate the
actual client choreography with server state before mapping it into 2D.

Validation: 26 focused Partner reference/observer tests, lab typecheck and
production build passed. Live local route returned the new control; the new
launch action returned 200, redirected normally into a session without motion,
and the base manifest returned 200. No round or visual browser playback was
verified in this pass. No gameplay/media files or deployment were changed.
Private HTTP evidence is in the ignored observation bundle's
asset-availability.json. The user's two supplied files are left outside this
task's commit. Embedding and actual clip/landing telemetry remain outstanding.

## 2026-09-21 — supplied export and private hole-card check

Read Jakob's explicitly supplied Downloads observation export (00:07:56 UTC).
It contains only connecting/connected, no round payload, no mapping and no
actual-playback evidence. It cannot establish a premature card reveal or map
Astrid's motions. Its file hash and parsed summary are saved privately in
the current ignored observation bundle's `export-and-hole-card-check.json`.

Ran `node test/shoe-game.mjs`: 197 shoe/service checks plus persisted
split/double/insurance/idempotent payout checks passed. A separate deterministic
in-memory check confirmed the upcard is included, the private hole-card value
is excluded before reveal, and that value appears after stand/reveal. No live
game command or real database was used. This is local-model verification, not
proof of the current browser's visual timing. A face-down card back appearing
before its value is disclosed is expected; premature face/value display would
need a synchronized HTTP response and screen/playback trace to reproduce.

Jakob deferred the broader animation-event investigation until a later pass.
Next correlate server requestId/version with actual client trigger, clip choice,
painted start/end/error and card landing; distinguish idle, speech, filmed
actions and synthetic card motion. Do not substitute configured mappings or
internal engine events for proof of rendered playback. No product code changed.

## 2026-09-21 — live Astrid media failures confirmed from user's console report

Authenticated metadata/header checks confirmed `dealers/astrid/speech/goodluck.mp4`
returns 404 while live speech-media.json still selects it as Astrid's native take.
The live index has indexed goodluck, but playRecorded prioritizes the configured
native take; no automatic retry of that indexed alternative follows its failure.
playSpeech invokes onFinish on error as well as completion, so `[speech] end
goodluck` without start is not a successful-playback receipt.

Live `performance/smooth60/manifest.json` also returns 404. Astrid's live
dealing-cues.json marks the old action `rejected` because its palms move over
existing cards without picking up from the shoe. That prevents the indexed
action from being used even though it exists; never undo that rejection just
to remove the fallback log. Restore a reviewed release/binding, not arbitrary
replacement footage. These media gaps are distinct from missing Partner events.
Saved headers/metadata in the ignored observation bundle's `media-check.json`;
no media downloaded or modified, no game command, no deployment or new QA approval.

## 2026-09-21 — deployed native API path confirmed; direct SSE still lacks rounds

Follow-up while Jakob played: authenticated Partner ping and stream succeeded.
The lab capture received two connection statuses and zero rounds, then failed
after about five minutes with `terminated`; it is not an uninterrupted trace.
A direct same-key/player upstream SSE probe persisted only `hello`, no round.
Its timeout did not complete process teardown; it was interrupted, so there is
no trustworthy final heartbeat count or exact end time for that probe.

Fetched the actual deployed app.mjs through a normal Partner-launch session:
tableCommand still posts to `/api/table` (line 596; SHA-256 starts 463ff2a00d92).
Six native `op: state` reads returned HTTP 200 and identical idle state/version.
No start/act/collect, deposit, database edit or agent-played round occurred.
Browser control was stopped because the tool could not verify the current URL.
Raw evidence, hashes and limitations are Git-ignored in
`lab/data/observations/2026-09-21T00-10-30-027Z/README.md`.

The likely missing link is native-table publication into the authenticated
Partner key/player channel. Local and previously fetched b066a43 server code
publish only from Partner-table. Deployed server revision remains unknown,
and no precisely timed user start/act request was captured, so do not call
this a complete end-to-end reproduction. Implement/verify server publication
before assuming a lab rebuild or different credentials will supply rounds;
actual clip/landing telemetry is a separate remaining client integration.
Corrected stale play-only scope guidance in lab/.env.example and clarified the
separate generations token. No actual env values, product/media code or deployment
changed; validation was live read requests and parsing the private evidence,
not a new product test run.

## 2026-09-21 — three live demo rounds observed; embedding is the next goal

Jakob explicitly confirmed the existing balance was demo-only, with no cash
value or withdrawals. Played three small single-box demo rounds: stand,
hit to 21/push, and stand after a fresh explicit Partner-launch. Every hand
finished and no outstanding wager remained. No deposit, DB edit or media change.

Captured 49 client console records, 15 normalized DOM/AX checkpoints, mapping,
verified scopes and a separate file-backed SSE observer. Private evidence is
Git-ignored at lab/data/observations/2026-09-20T23-50-27-036Z/README.md and its
linked JSON/JSONL files. tools/capture-partner-observation.mjs records only
the existing local lab read APIs; it sends no gameplay or wallet commands.
It has a ten-minute/16-MiB limit and a per-session STOP marker. The test
capture ended normally; both browser and CLI observers are disconnected.

Observed: zero SSE round records despite three completed rounds, including
the explicit launch route. All seven logged dealing starts used direct-shoe
fallback. The launch route reported "No staged capture", despite six takes
in mapping. Goodluck had end-without-start logs (72–87 ms); dealerbust, push
and placebets had paired matched start/end logs. These are client diagnostics,
not verified clip hashes/frames or lip-sync acceptance. Complete native HTTP
bodies, request IDs and later dealer cards in two rounds were not captured.

Latest steering: put the original game embedded/streamed INSIDE the existing
Studio activity surface, with real-time code/data/playback logging alongside
or below it, then map this evidence to lab nodes and control flows. Jakob
asked to finish the last observation first and discuss embedding afterwards;
no embedding, player instrumentation or 2D changes were implemented this turn.
Initial code comparison confirms Stage is an example-event preview with
three visual slots and prop cards, not a server-owned persistent blackjack hand.

Validation: collector syntax check and live start/STOP/exit passed; saved JSON
parsed with 49 console records, 15 checkpoints, two SSE statuses and zero rounds.
Checked the evidence bundle for credential prefixes/launch URLs: none found.
Raw evidence remains Git-ignored. No product build/test rerun was needed for
the observation-only helper and handoff edits; existing player/media unchanged.

## 2026-09-21 — reference-game launch and observation workflow in the lab

Jakob clarified that 2D is a mockup of eventual video presentation. First
observe the full existing game and video flow, then reproduce the presentation
in the lab using authoritative server data. The lab's existing /activity now
verifies Partner access, launches the original client, fetches current video
mapping and exports complete received SSE records separately from the truncated
150-entry display log. Trace capture stops visibly at 300 records or 4 MiB;
it has no replay and lasts only while the view is mounted. The export also
offers copyable JSON. Credentials and launch URLs are excluded.

Live ping confirmed launch + events, correcting the old play-only scope claim.
The separate generations read token fetched /api/v1/generations/mapping for
four dealers; Astrid had 19 engine entries, 6 staged takes, no green takes,
draft manifest status and null server revision. Mapping is registered material
and BO choices, not a playback receipt. Only that adapter reads BETTALOTTO_API
from root .env / lab .env.local / process env; no env file was changed.

The launch button opened the original Astrid table with staged/smooth60 route
and 0.00 EUR balance. Launch can create/load the partner profile and session;
this was not purely read-only. No bets, rounds, balance changes or table commands
were sent by the agent. SSE connected and was explicitly disconnected. No
round records arrived. Kevin describes launch-to-SSE support, but his fetched
branch b066a43 visibly publishes only from Partner-table; the native bridge
remains unverified. A funded, intended demo environment is needed for round QA.
Actual player clip start/end/landing telemetry and full table snapshots are
not captured yet. No 2D renderer, game player, media or deployment was changed.

All 248 lab tests, TypeScript and the production build passed (including 29
focused observer/reference/trace checks). Browser QA verified access, mapping,
launch, connection lifecycle and the copyable JSON export: four dealers,
launch/events scopes, three connection records, zero rounds and no credential
or launch URL. The browser download event was not confirmed by the automation;
the same JSON is directly available in the panel. See the updated
Jakob HANDOFF-2026-09-21-LIVE-OCH-2D.md and linked agent prompt for next steps.
No Jira connector or linked CAC issue was available. The previously failing
same-size video hash-cache test passed this run; no cache fix was made, so the
earlier intermittent failure is not considered resolved by this change.

## 2026-09-21 — node code labels, verified SSE and next-agent handoff

Added subdued `(sourceType · id)` labels from project data to all 16 event
nodes in both the studio sidebar and Nodträdet. Source types (e.g. idle)
are distinguished from lab node IDs (idle.ready); no contract or variant
bindings changed. Updated VIDEO-LIBRARY's outdated default-mode sentence.

Created the linked Jakob handoff at
random-stuff-jakob/jakob-docs/HANDOFF-2026-09-21-LIVE-OCH-2D.md. It records
the implemented boundaries, credentials' configuration locations without
values, known playback/media gaps and the next implementation steps.
Following Jakob's latest steering, first observe actual clips and sequence
in the existing demo client, then reproduce its presentation in 2D while
retaining server authority. Launch, Partner-table and SSE are distinct paths;
ordinary client play does not publish to Partner-SSE in the local code.

Live read-only validation: /api/inputs was configured with no missing/invalid
fields. The observer reached "Partner-ström ansluten" against Bettalotto;
the connection was then explicitly closed. No round events arrived during
the short check. No launch/table/wallet request was made. /api/videos reported
224/224 locally available entries; this was metadata availability, not visual
acceptance or a complete inventory of Kevin's current remote media.

Validation: 20 existing studio/tree component tests and TypeScript passed;
browser checked both label surfaces, sidebar layout and successful SSE
connection/disconnection. No gameplay/media/env/project data changed. The
previously recorded video hash-cache test failure remains outside this task.

## 2026-09-21 — clarify simulated context and selected event

Replaced the “Återbesök · tyska” test preset with “Återkommande spelare”.
It now changes only the returning-player flag relative to neutral; language
stays Swedish and dealer mood stays calm. Existing saved variant conditions
are unchanged. Clarified the preset footer: these buttons set simulated
context for variant selection, fetch no live signals and do not drive chat.
The returning-player checkbox now calls its data simulated player history.

The studio inspector explicitly says “Valt event” and sidebar event buttons
expose their selected state through aria-pressed. Idle / bakgrund is an output
category; Bordet väntar (idle.ready) and Lycka till (speak.goodluck) are distinct
nodes. Initial selection still follows the saved project's first event, while
the sidebar groups idle first. Browser QA confirmed that selecting Bordet
väntar updates both the main heading and the inspector to that same node.

Validation: all 7 studio component tests and TypeScript passed. Browser QA
confirmed the renamed preset selects returning=true with Swedish, calm mood,
no chat signal and zero wins/losses. No model/TTS request, project save, live
event connection, environment edit or media change. The previously recorded
video hash-cache test limitation was outside this UI change and not retested.

## 2026-09-21 — compact chat, speech on by default and independent free replies

Reduced the table chat to a composer, send button, speech toggle and one
closed Settings disclosure. Only active work/blocking/errors add status
messages. Detailed reaction/audio controls remain available inside Settings.
Speech now defaults on as Jakob requested, with a visible ElevenLabs credit
label and an explicit mute control. Nothing generates on page load. When
voice is unavailable the request remains text-only even though the preference
is on; unexpected response audio cannot override mute/unavailability.

Changed the social seed to free responses. Also changed only response.mode
from fixed to free in Jakob's running local policy via GET/PUT /api/social,
using its expected revision and normal history-saving path. Verified the
previous fixed phrase and complete trigger definition were preserved. This
was a specific local setting update, not an automatic migration of other
saved policies. No environment values or loaders were edited.

Free text and optional TTS now survive expression cooldown: the repeated
expression is suppressed, while the contextual reply and identical spoken
text remain. Explicit fixed-phrase mode retains suppression of its repeated
reprimand. Tests cover different free words with the same sad expression,
neutral factual-question responses, exact TTS text, free-reply cooldown and
fixed-phrase validation. The API supports both policies already; no remote
Director/Gateway deployment was needed or performed.

The current social renderer still presents neutral idle during speech. It
has no queue/binding for a sad video at the next idle boundary and no general
selection among all studio videos. No reaction-video or lip-sync completion
is claimed. A future expression take must sequence with idle-only speech,
or use a separately validated lip-sync solution. Updated the social guide,
README, shared Guide and environment explanation accordingly.

Validation: 51 targeted component/social/playback checks passed; TypeScript
and production build passed. Desktop/390px browser checks confirmed one
closed Settings entry, free mode, checked/mutable speech toggle, no overflow
or console errors. No actual chat/model/TTS request was sent. Broader suite
before the last added unavailable-voice case: 236/237 passed; the unchanged
same-size video hash test at lab/test/video-registry.test.mjs:131 failed again
(HTTP 200 vs expected 409), as recorded in the previous delivery.

## 2026-09-21 — place the player chat next to the table

Following Jakob's clarification, kept the existing chat/settings entry points
and moved the player chat directly below the table preview, before event-test
controls. The compact panel shares the table border and groups advanced
social settings/audio in a disclosure. It remains visible on other nodes
with disabled input and an explicit Astrid-idle navigation action. Existing
idle-only, one-owner and six-second speech controls are unchanged. Keeping
the panel mounted across node selections preserves an unsent message;
scene changes still cancel pending replies and audio.

Read only the user-supplied text captures under
random-stuff-jakob/jakob-log-files/backoffice.bettalotto. They show partial
backoffice clips/assignments, generation metadata, verdicts/landing labels
and overview data, not a recorded Partner event stream. Documented their
use and limits in _env.explanation.md. Excluded raw captures from Git; did
not download or inspect linked media, import truncated JSON or make a live
Partner/BO call. No credentials or environment loaders were changed.

Validation: 24 relevant component tests passed, including compact placement,
idle gates and a new mounted-node-change cancellation/draft regression.
TypeScript and production build passed. Desktop and 390px browser checks
confirmed one chat immediately below the stage, no horizontal overflow,
preserved unsent text and disabled input outside idle; no console errors.
No actual message, TTS request, project save or game round was sent.

Broader test limitation: 233 of 234 lab tests passed before the added
regression. The unchanged video-registry test "size and hash mismatches
block playback including same-size edits after caching" returned HTTP 200
instead of 409 at lab/test/video-registry.test.mjs:131. Reproduced with that
file alone (12/13 pass). Neither that test nor lab/lib/video-registry.mjs
was changed here. Cause needs separate investigation; do not report the
whole suite as green or treat this UI delivery as media-integrity approval.

## 2026-09-21 — simplify lab navigation, variant tests and environment guidance

Made OpenClaw the initial event-test mode, with explicit button-triggered
requests and the existing validated standard fallback. Standard, rules,
random and shadow remain available under closed comparison-test disclosures;
alternative eligibility is unchanged. The event test now explains that
simulated context selects a prepared variant, not an additional animation
layer. Video binding targets appear before upload and inventory controls.

Added visible shortcuts to Astrid's idle player chat and the operator chat,
collected under Chatt & OpenClaw. The player shortcut keeps the project draft
and scrolls to the idle chat panel. Operator chat comes before configuration
both visually and in document/keyboard order. No chat is sent on navigation.

Added random-stuff-jakob/jakob-docs/_env.explanation.md with API roles,
configuration locations, file precedence, Partner scopes and unverified
connection boundaries. Linked it from the documentation indexes. Actual
environment values and loaders were not changed. No credentials are in the
new document, and no live Partner, model or TTS request was made during QA.

Checked the motion definitions rather than scanning video artifacts: 64
unique event motion tracks, four per each of 16 groups, shared by four dealers
through 256 seed bindings, plus one separate social track. This does not cover
all game sequences, exact seven-seat choreography, split or lip sync. The
Guide, README and workspace now state that limit. No production player or
media files changed; private archives were not read.

Validation: all 234 lab tests passed, TypeScript passed, production build
passed, and the seven affected component regression tests passed again after
final copy/order adjustments. Checked desktop and 390px layouts, both chat
shortcuts, local standard-mode simulation, closed comparison controls and
video target ordering in the browser; no console errors or page overflow.
Checked 39 local documentation links and git diff whitespace. Live Partner
scope/player matching, deployed Director availability and speech/lip-sync
acceptance remain separate outstanding checks.

## 2026-09-20 — prepare private Partner settings and clarify variant testing

At Jakob's request, created the ignored `lab/.env.local` with blank canonical
Partner key/secret fields and his supplied example `jakob-lab-1` playerId.
The masked credentials were not treated as usable values. Existing root
environment settings remain unchanged. Verified parsing, empty secret fields
and Git exclusion; no server restart, authentication attempt or round was run.
Kevin describes this key as launch + events; actual play-scope authorization
must still be verified when the complete pair is supplied.

Clarified the screenshot's two areas: the green table is a 2D placeholder
when a variant has no bound video; Testa event simulates context before
choosing a variant, rather than adding a social animation layer to its clip.
Jakob's intended normal flow is event/presentation routing, then OpenClaw
selection among allowed prepared variants, then the chosen variant's bound
material. Standard/rules/random/shadow are diagnostic comparison modes;
standard remains the fallback. The existing lab still initially selects
standard mode and only active mode applies a validated OpenClaw choice.
This clarification did not change those defaults or activate model requests.

## 2026-09-20 — clarify environment boundary and reject Partner placeholders

Confirmed that the previous lab change did not edit real environment files or
the existing Director/Gateway settings loader. The optional Partner observer
uses the Next process environment (`lab/.env.local`), not the root `.env`
file reader used by existing Director settings. Documented that boundary;
the user's current root settings remain untouched and no local config file
was created. Existing aliases remain supported when loaded into the process.

Fixed the reported configuration-status defect: keys/secrets must match the
formats actually minted by the current Partner server, so short placeholders,
generations tokens and malformed credentials cannot enable an upstream
connection. Status still does not claim successful authentication or correct
scope/player identity. Missing settings and invalid formats are shown
separately. Verified 36 observer/HTTP-guard tests and TypeScript, including
zero upstream calls for invalid values and canonical/legacy precedence.
No live API call, credential change, model call or media change occurred.

## 2026-09-20 — lab presentation model, social ownership and actual activity

Reworked the lab's node tree and guide around four output groups: idle,
one-shot action, exact speech and turn/result reaction. The six source types
and sixteen existing event IDs are unchanged. Inspectors distinguish actual
example fields, missing fields, seat indexes, partner player identity, manual
context and the variant/timing selected for presentation. Standard is a
protected variant within a dealer/event collection, not a separate utterance.

Added a session-only activity view at `/activity`, also available below the
studio. Actual local requests, decisions and player start/end/fallback/cancel
receipts share a run ID and expose the responsible component, reason and
bounded data. It does not seed simulated rows as received traffic. The optional
server-side Partner observer connects only after explicit user action, signs
GET `/api/v1/events`, keeps credentials off the browser, and distinguishes
published instructions from local playback. Disconnects are marked as gaps;
there is no replay. The native game client's `/api/table` does not publish to
this key/player-scoped channel. No live connection was made: Partner key,
secret and playerId are still missing from this lab configuration.

Canonical observer settings are `BETTALOTTO_PARTNER_*` in `lab/.env.local`;
the earlier `LAB_PARTNER_*` names are fallback aliases. `LAB_API_TOKEN` and
`LAB_REMOTE_TOKEN` authenticate our Director path; `OPENCLAWAPI_KEY` is Gateway
auth. Kevin's separately supplied generations read-token concerns material
metadata, not Partner SSE. Access instructions and his login links were saved
in the requested private, ignored local text file. No credential or reset URL
is part of this commit, and the excluded personal archive was not read.

Social replies reserve Astrid's idle scene from request through completion.
Action tests cannot overlap; a response is not automatically repeated. Voice
metadata is checked before playback, material over six seconds is rejected,
and a six-second playback watchdog handles unknown/incorrect durations.
Stop, navigation and hidden-page cancellation release the owner; incidental
idle rendering does not stop or restart speech. Suggested expression and
actual idle display are logged separately. Dynamic lipsync and product-wide
social scheduling are still not connected. Video callbacks now reject stale
turns/elements, and cancellation actually pauses a playing lab video.

Validation: 233 lab tests, TypeScript and the production Next build pass.
Required regression checks also pass: 113 pre-commit tests, the asset-state
script, sync audit including `--probe`, performance audit and Astrid actor
audit. Browser QA covered the new log, standard and local-rule selection,
two consecutive 2D lab previews for each of the four dealers, and a 390px
mobile viewport without document overflow. Social ownership, stale media
callbacks, overlong/unknown-duration audio and observer signing/stream gaps
are covered by isolated tests. No paid model/TTS request or gameplay/wallet
action was made. Production playback and media were not changed; existing
missing speech takes (Vera 8, Amira 2, Mei 3) and lipsync acceptance gaps remain.
Media checks read audit metadata; no video corpus was indexed as LLM context.
The eight-day V4 website/wiki publication remains the documentation baseline.

## 2026-09-20 — V4 publication verified

Published V4 source and the system-map/archive changes to
`jakeminator123/work` at 8df6a52; Croupier main was not changed.
Published the wiki at 7fe3f05 and the separate GitHub documentation repository's
main at 16e705e. Remote branch SHAs were checked after each push. A fresh
44-file source/site/wiki sync has no drift. The public website returns HTTP 200
and exactly the reviewed HTML bytes (SHA-256
691be95ce61ed9f8f2921c6713e61510ecde6a825ee8d8fb1c7b0aa5fa351b37).
Browser inspection confirms the live V4 title, four-step overview and eight-day
navigation. GitHub Actions run 35536345399 and the Vercel commit status succeeded.

Final active-document validation covered 34 documents and 266 local links;
all targets exist and none link to the personal archive. Wiki validation covered
64 changed/new Markdown pages and 157 wiki links with no missing targets.
The wiki's remote Git publication is verified; an unauthenticated browser was
redirected to GitLab sign-in, so rendered wiki QA is not claimed. The website's
local and live render were inspected. No game deployment or runtime login occurred.

Existing GitHub/Vercel addresses retain their historical v1 suffix. Their V4
display title and documentation explain that it is an address, not a version.
The user's preferred permanent repository name has not been supplied.

## 2026-09-20 — V4 documentation and private archive boundary

Replaced V3 as the active explanation with eleven concise V4 source files at
`docs/animation-events/v4-8-days-mvp/` (source commit a46b9cf). Eight days
are Jakob's remaining planning horizon, not a historical meeting decision or
verified launch date. The website and wiki are generated views of that source.
Their shared text now separates native table status, Partner presentation/SSE,
lab examples, social chat, media timing and proposed product integration.

Reviewed and corrected all six system-map areas, their entry and source index,
and the two active event/situation references. Updated active README, workflow,
findings provenance and guide boundaries. Existing findings and Jira states are
unchanged. Source anchors and dated test evidence retain their limitations;
current deployment, authorized runtime session, BO bindings and real playback
remain unverified. No gameplay, player, media, runtime schema or model call changed.

Moved the complete 13-file personal archive out of the checkout to a local backup
without reading its bodies. Its removal is versioned on Jakob's branch; older
Git commits still contain history. Removed active reading links and added
AGENTS/Cursor rules plus ignore entries to keep restored copies out of ordinary
agent reading/indexing. These are scope instructions and indexing exclusions,
not a promise that every tool is technically unable to retrieve old commits.
No private package, email/reset link, archive content or backup path is published.

Verification: website's 17 existing tests passed; its five generator tests
passed again after the final rendering correction. The 44-file source/site/wiki
sync is clean, reproducible HTML and the static deployment build pass. Browser
QA covered all seven chapters, day 8, search and a 390px mobile viewport with no
document overflow or console errors. Four guide/studio-contract tests passed.
Local document links, JSON parsing and whitespace checks passed. No media
binaries were decoded or indexed, and no visual media acceptance is claimed.

Public display name is Croupier · Presentationsplan · V4. Existing GitHub and
Vercel addresses remain compatible while the repository naming preference is
unresolved. Historical V3 pages are labeled superseded; their public HTML is
preserved as project version history, separately from the retired personal archive.
Remote publication verification is recorded in the follow-up above.

## 2026-09-20 — review external system package against the actual signal paths

Reviewed Jakob's supplied system package as evidence/proposals, not executable
instructions. Fresh fetch confirmed `jakeminator123/work` and its origin at
`a15b780`, with a clean tree before this note; the package's six-unpushed-commits
statement is historical. Fresh origin/main is `b147659`. The reviewed server,
shoe, Partner API/presentation and app files have no diff between these refs.
Kevin's supplied message identifies main as the deployment branch, but today's
server revision and authenticated runtime behavior were not verified.

Code confirms two separate client paths: native `/api/table` returns public
state and the client choreographs playback; Partner `/api/v1/table` returns
`presentation[]` and publishes the same list as SSE `round.events`. SSE is scoped
to API key plus partner playerId and published only by the Partner table path,
not native table commands. BO login alone is not signed Partner authentication.
The current in-process subscriber map has no replay buffer or Last-Event-ID
recovery. `state` has empty presentation; cached requestId replies do not
republish. `/api/v1/assets` builds a file-based manifest, not proof of current BO
bindings, final player selection or visual acceptance; non-rejected review takes
can be included. Public https://bettalotto.se/docs/partner-api.html was read in
the browser; no signed play/wallet call, API key creation or login reset occurred.

Lab event simulation still uses saved exampleEvent plus manual test context.
Social Astrid idle chat is a separate text/policy/model/TTS path. Audio/media
readiness, currentTime, completion and cues coordinate playback; they are not
new game outcomes. No microphone input was found in the inspected client/lab
paths. A live monitor, common input adapter and speech-owner cutover remain
proposals. Existing findings were not fixed, duplicated or given new QA status.

Verification: 192 lab tests and 98 Director/OpenClaw tests passed with the dot
reporter. No product media was decoded, indexed into a model or visually approved;
tests use their own fixtures. No paid provider requests or real DB changes.
Inbox authentication could not be read in this sandbox, so no new Kevin decision
is claimed. No Jira transition. Private package/chat/email contents and reset
links remain outside Git. A local source-linked canvas summarizes the review;
no guide/runtime/schema changes or remote push were made. Remaining live checks:
authorized session, active BO bindings, deployment revision and actual playback.

## 2026-09-20 — distinguish signals, situations and presentation choices

Documentation-only clarification requested by Jakob. Reworked the existing
situations/variant-families reference, preserving its stable path and source
anchors. Added a signal-flow map, optional need-specific situation fields,
the six-type/16-shortcut distinction, exact deal targeting versus expressions,
native idle choreography versus once-only lab preview, and a minimal integration
proposal. Partner and native public-state input are alternative projections,
not two sources to replay simultaneously. RNG is only part of authoritative
game facts. Replacing legacy speech with one voice owner is a requested direction,
not an implemented shutdown; no product/player/Render/media change was made.

Updated the existing Guide JSON and glossary descriptions, not a new guide or
runtime contract. Runtime fields, event/term IDs, schemas and saved projects are
unchanged. Reference:
random-stuff-jakob/jakob-docs/2026-09-20-situationer-variantfamiljer-och-takes.md.
Code basis: local dcab124, Kevin 626554d, main b147659. Independent code review
confirmed the distinctions; not a live deployment or visual media acceptance.

Verification: 192/192 lab tests passed; JSON parsing, unchanged runtime-contract
assertion, reference local links and git diff --check passed. No paid requests.
Remaining: public-state adapter, real-player integration, take coverage/pools,
editable idle sequences and speech-owner cutover; these are proposals, not
completed capabilities. No Jira transition or remote push performed.

## 2026-09-20 — simplify Eventstudio test and social chat panels

Reworked the two screenshot-marked surfaces without changing schemas, media,
runtime selection or model/TTS request behavior. Event testing is now a separate
component: one existing-mode selector, selected scenario presets, folded manual
test values, an adjacent run button, then the actual result. Removed the repeated
four-step decision diagram; exact JSON remains behind a disclosure after a test.
Direct preview and chat are still not presented as successful event tests.

Astrid chat now prioritizes the composer. Reaction settings, standard-phrase
audio and technical/cost explanation are distinct folded sections. Opt-in speech
and its cost warning remain visible; saved-audio replay remains visible when it
exists. Existing handlers, request cancellation, draft cache, policy revision
checks, separate saving and exact-audio checks are unchanged. Guide updated in
its existing source; no parallel documentation or new category vocabulary.

Verification: 192 lab tests, TypeScript and production build pass. Browser QA on
isolated port4193 confirmed idle standard result, rules+returning-player result,
collapsed manual fields/settings/audio, working composer and no console errors.
430px breakpoint checked with no horizontal overflow (425px document / 430px
viewport), then viewport reset. No chat message or paid voice request was sent;
the existing mocked-handler tests cover reply, audio, draft and cancellation.
No actual video/player/gameplay or Render change. Jira connector unavailable.

## 2026-09-20 — render video-category explanation inline

The managed .canvas.tsx link opened source code in Jakob's current desktop
UI, not the rendered canvas. Re-presented the same proposal as an inline
visualization in the thread-scoped visualization directory. Blue/orange plus
text labels preserve existing/proposed distinctions. Browser preview verified
rendered content and switching idle to action/box2. No app or media changes.

## 2026-09-20 — video-category concept canvas, no runtime change

Created a standalone local canvas explaining three separate concerns: the
four existing lab video kinds, proposed common once/loop playback metadata,
and existing per-variant selection policy. Existing behavior is blue and
labelled; new requirements are orange and labelled. Interactive examples
cover idle, exact card destination, exact speech and silent result reaction.
Explicitly distinguishes current once-only lab video preview from product
idle repetition and the legacy repeating-deal path. Transition/return support
is documented as existing player behavior, not a new engine event/category.
Strict TypeScript check against installed canvas SDK passed; rendered host UI
was not independently verified. Durable proposal and canvas link:
docs/animation-events/video-category-proposal.md.
No gameplay, media, lab schema, policy, runtime, Render or Jira changes.

## 2026-09-20 — local categorized video intake and standard coverage

Added raw MP4/WebM intake to the existing lab VideoLibrary, with dealer,
event, idle/action/speech/reaction, intended standard/alternative, exact
speech/situation and notes. Files are bounded streamed uploads into ignored
local data, SHA-256 identified and atomically indexed. Optional binding changes
only the project draft. New alternatives are manual until explicitly allowed
for rules/model/random; older projects retain prior behavior. Standard is the
initial test mode. Added optional local presentation randomization, exact
uploaded-video compatibility guards and a live reference/coverage audit.

Audit: 16 nodes, 64 dealer lines, 256 variant records reference 64 distinct
event-motion track sets, plus one separate social motion. All seed mappings
and durations match. 224 original records have 224 distinct registered hashes
and available local files; no saved default project/video bindings existed.
No visual quality ranking or live BO binding is claimed.

184 lab tests, typecheck and production Next build pass. Browser QA on isolated
4192/data verified actual file selection/upload, saved standard, coverage,
play-to-end/replay, manual alternative defaults, opt-in random selection,
standard-mode preservation and reload persistence. No paid model/TTS call.
All pre-commit commands attempted: integrity audits pass; six legacy tests
are blocked by missing ffmpeg/ffprobe (five) or jq (one). Deep --probe likewise
cannot run without ffprobe. Product player/media, calibration, RNG, DB and
deployed OpenClaw are unchanged. Jira unavailable; no issue status claimed.
Usage, storage, precise verification and remaining boundaries: lab/VIDEO-LIBRARY.md.

## 2026-09-20 — compact restart note for documentation/video findings

Added random-stuff-jakob/jakob-docs/arkiv/2026-09-20/2026-09-20-aterstart-dokumentation-och-videofynd.md
and linked it from the archive index. Captures the model, docs/findings split,
Kevin approval dependency and later OPENCLAW commits at HEAD 11d751a.
Checked local links; documentation only, no runtime/media change or test claim.

## 2026-09-20 — video-first Eventstudio with per-variant 2D fallback

The existing variant inspector now binds/unbinds an exact local generation ID.
Default preview shows that variant's video, otherwise its own synthetic motion;
missing/decode-failed video is labelled and falls back to 2D. A rule-selected
alternative never borrows the editor selection's standard video. Direct replay
is labelled "Spela vald variant"; event tests remain separate. Video completion
uses its own ended event, not the motion duration, and recorded clips never loop.
Rules, decision trace and simulated context are grouped in one closed-by-default
disclosure. Player chat remains at Astrid idle, with a compact navigation action
elsewhere. Registry normalizes dealer labels such as Astrid to astrid.

Verification: 177/177 lab tests and production Next build/typecheck pass.
Codex webview played local a9fa1da6-066c-47f4-8466-7f4924a3bfe2 to its 3.041667s
end and replayed it; direct and rules-selected contextual centre variants showed
deal.player.centre.contextual with no video element. The example binding is an
unsaved lab draft, not a saved migration or product take approval.
224 available local video entries are metadata, not model embeddings; video
search/binding/playback makes no model or ElevenLabs calls. No paid provider calls
were made for this change. Unsupported session-flags features.thread_tools was
not found in user config; its injection source is unconfirmed. Global config
was not changed. No product media/player, event contracts, Render deployment,
keys or saved policies changed. Jira unavailable; no status change claimed.
Usage and current video workflow: lab/README.md.

## 2026-09-20 — live Astrid social lab chat and explicit variant preview

Both Render services now live on 6797b6a: Director dep-danlaejtqb8s73c9v5l0,
Gateway dep-danlb4mgekts739bj320. Gateway log confirms runtime bundle
2026-09-20.2 and croupier-social installed without role warnings.
Real Chrome and Codex-webview chat selected social.ledsen and exact fixed
phrase; saved ElevenLabs audio replay and hands-cover-face pose were observed.
Real free reply + new MP3 succeeded; quoted-insult control selected no trigger.
No persistent user memory or product playback integration is claimed.

Local Next studio adds independent editable social policy/history, bounded
player-style chat, explicit TTS/cache, idle-only synthetic reaction and cancellation.
Separate direct variant preview from rule/model event test (Bara standard).
Four deal-right motions are more distinct without changing cards/destination.
No existing project migration, product media/player, RNG, DB or secret changes.
169/169 lab tests, 98/98 Director tests, typecheck and final Next build pass. Browser checks include
real text selection, exact-audio preview and visible sad pose; no lip-sync approval.
Details: random-stuff-jakob/jakob-docs/arkiv/2026-09-20/2026-09-20-astrid-social-chatt.md.
Guide: lab/SOCIAL-CHAT.md. Jira unavailable in this session; no status change claimed.

## 2026-09-20 — isolated social OpenClaw role prepared for rollout

Added dedicated croupier-social and authenticated /api/studio/social-chat,
separate from operator chat and the IDE inbox. Only Astrid/idle.ready is
accepted; semantic model choice returns bounded text and social.ledsen/null.
Fixed phrase is policy-owned; free text is canonicalized before exact-text TTS.
No native MCP tool or product event integration is claimed. No key changes.
Persistent Gateway config adds only the isolated no-tools social role with
an atomic backup; custom conflicting state fails without being overwritten.
Runtime bundle 2026-09-20.2: 597309781863e78e2b31d855e7dab69aa0e6475cfdd2b1cff12892fe759b2758.

Validation before rollout: 98/98 OpenClaw tests, including auth, scene gates,
canonical text, malformed replies, isolated sessions and additive startup.
Local Next social policy/chat/TTS integration is being verified separately.
Saved real ElevenLabs fixed phrase locally: 27629-byte MP3, 1.671837 seconds,
Sarah, exact text 'Oj, nu var du oförskämd.'; ignored voice-cache contains
metadata and hash. No product media/player/calibration/database changes.
This entry records implementation, NOT successful deployment/live social QA.

## 2026-09-20 — documentation archive and repository findings register

Reorganized Jakob's documentation after an independent classification audit.
Moved eight dated reports and one historical Windows-agent prompt from
jakob-docs/ into jakob-docs/arkiv/2026-09-20/, preserving their content with
archive labels and corrected relative links. Saved the previous README as
an archival snapshot so its inline V3/inbox/chef notes remain discoverable.
The new archive index maps old filenames to their locations and active topics.
Historical path mentions below refer to their original delivery locations;
use random-stuff-jakob/jakob-docs/arkiv/README.md to locate moved reports.

Kept the two active event/situation model documents at their stable paths,
including the reference used by OpenClaw's versioned runtime knowledge.
Refreshed system-map topics from dated 0a1f9cb/7be5844 voice/runtime evidence
and bf4e82e loader findings. No new deployment or product acceptance claimed.
Added docs/findings/README.md and REGISTER.md with seven stable F-001..F-007
observations, separate evidence/triage fields, source links, next steps and
decision dependencies. Jira CAC remains the implementation/QA work tracker.
F-001/F-002 still await Kevin's explicit A/B approval; archiving does not
resolve them. No Jira issue/status, code, media, data or runtime bundle changed
by this task. Parallel lab/runtime changes belong to the OPENCLAW task.

Navigation now reaches system-map, findings and archive from repo/lab/shared
entry points. Validated local links, moved-report content preservation and
documentation diffs; no gameplay/media test rerun is claimed for Markdown.
Local documentation commit only; no push or deployment in this delivery.

## 2026-09-20 — reproduced media-loader race; Kevin approval requested

At Jakob's explicit request, sent one signed ping-croupier question to Kevin:
https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870554825.
Asks approval for A) shared in-flight loads by verified hash and B) separate
measurement/prioritization of staged preloads. Jakob explicitly requires
Kevin approval before local player/video edits. STATUS: approval pending.
OPENCLAW task received the same boundary and confirmed no media work starts.

An isolated in-memory harness used the current PerformancePlayer source()
and dispose() methods verbatim, fake fetch/URL/window and real media bytes.
Two smooth60 edge-v2 centre/dealer files are each 598735 bytes with identical
verified SHA-256. Concurrent calls: 2 fetch, 2 hash, 2 Blob URLs, 1 Map entry;
dispose revokes only 1. Sequential calls: 1 of each, full revocation.
This proves a loader race/resource-bookkeeping defect, not the cause of
Kevin's visual double-image report or measured browser memory/live traffic.

Documented findings, file-origin/Blob distinctions, Redis versus client/HTTP
cache, QA-package versus player-speed benefits, and proposed verification in
jakob-docs/2026-09-20-videoladdning-och-kevin-ping.md; linked from its index.
Relevant product files at 7be5844 are unchanged from the cited 998016a.
No implementation, player/media/calibration/database/deployment changes,
new storage service, product QA or CAC status transition. Existing broken
or unapproved takes remain open. Only docs committed for this delivery.

## 2026-09-20 — Jakob's situation model and documentation system map

Updated Jakob's event registry and added
random-stuff-jakob/jakob-docs/2026-09-20-situationer-variantfamiljer-och-takes.md.
The requested mental tree now separates concrete situation from expression
family and compatible take. Documents seven boxes, hand/card-position/sequence
dimensions, conditional video-count multiplication and possible reviewed reuse.
Keeps 10 internal event types, six Partner presentation types and 16 studio
classification nodes distinct. Proposed coverage contracts, take pools and
physical JSON splitting remain proposals; existing serialization is unchanged.
Even the required standard entry cannot waive take compatibility in the
proposed product contract. A preview generation ID is not visual acceptance.

An independent subagent read today's authored documentation and inspected
local code/data to create jakob-docs/systemkarta/: six topic folders plus
an index and explicit source/coverage register. Original documents remain in
place. The map distinguishes dated historical reports from current source
and earlier deployment evidence; it does not claim a fresh remote audit.
Source baseline: c0a5681, with this task's new model clarifications included.

At Jakob's request, sent the concrete model to the existing OPENCLAW task.
That task confirmed the shared vocabulary and supplied the standard-fallback
clarification. Its separately requested subsequent runtime/deployment work
is outside this documentation delivery and may supersede dated drift notes.

Validation: independent terminology/factual review, local Markdown link
checks, source counts for 10/6/16, and git diff whitespace checks. No new
gameplay/media tests, visual acceptance or runtime verification claimed.
Documentation only; no media, schemas, saved projects, gameplay, credentials,
database, deployment or push changes. Existing missing takes and unverified
product bindings remain open; no CAC issue implemented or closed.

## 2026-09-20 — isolated ElevenLabs voice proof and selection clarification

Verified root .env ELEVENLABS_API_KEY and ELEVENLABS_OC_API are present and
identical, without exposing/changing either. Official API listed premade
Sarah and generated one fixed Swedish preview: HTTP 200, 84,471 bytes,
5.201270 seconds MP3 mono 44.1kHz; total TTS request 2506ms. Generated audio
and text/voice/model/hash metadata stay ignored in lab/data/voice-previews.
No voice cloning, Render env/deploy, player data or real dealer media change.

Added standalone tools/elevenlabs-lab-preview.mjs: explicit --check or
--generate, matching alias guard, one bounded request/no retry, no provider
body/secret output. It is NOT imported by studio, player or OpenClaw and
does not connect TTS to chat/stage. Audio codec/duration verified by ffprobe;
subjective pronunciation/voice approval and lipsync not claimed.
Six new mocked tests pass; complete lab suite 114/114. Existing product
media/playback untouched; no new production visual acceptance claimed.

Documented baseline/variant family -> weighted compatible take as a proposal
only, replacement versus appended reaction, OpenClaw selector versus trigger
source, seven-box/exact-speech/loop constraints. No tree, schema, policy,
saved project or timeout edits. Earlier openclaw_timeout locates the 2500ms
Director-to-Gateway budget, not a measured per-component bottleneck.
Updated environment inventory and Jakob's thin note/index. No remote push.

## 2026-09-20 — Jakob's logical event and media registry

Documented Jakob's requested temporary folder-shaped mental model in
random-stuff-jakob/jakob-docs/2026-09-20-eventregister-och-mental-modell.md,
linked from his index. Covers all 10 internal Round event names, commands,
public gameView fields, six Partner presentation types, 16 studio nodes,
four dealers, implemented blackjack versus placeholder roulette, nine seed
triggers, 256 variant records and 64 shared synthetic motion clips. Connects
existing schemas/project serialization, original inventory, takes, binding
status and OpenClaw selection. Five additional triggers are documented
proposals only. Based on local source and studio.2026-09-20.2/b26ff83;
not a fresh deployed-product or Kevin remote-head verification.

Validation: local document links and node/trigger coverage, JSON fragment
parsing, pure project/catalog validators, all five proposed trigger shapes,
and box3-positive/box2-negative eligibility for the example in memory.
Independent read reviews checked engine and policy boundaries. No new
visual, media or runtime acceptance. Flags the existing split/splitFrom
classification mismatch for later adapter review; no gameplay fix here.

Documentation only: no policy/project/media/player/database changes,
model calls, deployment or push. Preserved the other task's work and private
login note. Actual BO bindings, exact-line/take product integration and
per-take acceptance remain open. No CAC issue was implemented or closed.

## 2026-09-20 — node tree, synthetic motions and live Render relay

Added root lab /tree with four dealers sharing sixteen semantic lab groupings
over the six unchanged Partner presentation types. Click-through editing and
history navigation retain the draft. Trigger UI groups deterministic vs
social/temperament; the underlying predicate contract remains unchanged.
The default seed now has four variants including baseline per line (256
dealer-specific variant records), backed by 64 shared silent synthetic motion
clips. JSON files under lab/animations use finite numeric pose tracks, stable
asset IDs, cancellation, neutral endpoints and reduced-motion handling.
Existing saved projects are never expanded or overwritten automatically.

Kevin compatibility audit added 12 actual presentationEvents regression tests
and lab/COMPATIBILITY.md. Source event order, hidden cards, seven boxes and
exact speak.line stay authoritative. Result grouping is not speech selection;
speak.other is not a valid catch-all production speech take. Corrected overly
broad seed descriptions without changing any source IDs, matches or examples.
Synthetic card actions cannot be crossed with incompatible event types.
Previously valid but incompatible saved bindings can still open for explicit
repair; simulations/saves reject them until corrected, with no auto-rewrite.
No game engine, product playback, raw video, calibration or baseline edits.

With Jakob's explicit approval, manually deployed ONLY Render Director to
origin/work 7f056f7f81cfdc9a05f503cc44f8323fa10cbdd2, deploy
dep-danjucmgekts7397j7t0, confirmed Live. The previously missing studio advice
and chat capabilities are present. Existing credentials retained unchanged.
Real local Next -> Director -> Gateway tests: active accepted an eligible ID,
shadow received valid advice but retained baseline, chat responded in Swedish,
and project contents stayed unchanged. First advice request hit the existing
2500ms deadline and correctly fell back; retry succeeded. This is not a latency
guarantee or a live-game integration. No player memory/chat/moderation connected.

Validation: 108 lab tests + 62 Director tests, TypeScript and production build
passed. All twelve pre-commit commands and dealer --probe (90 streams) passed
using already-installed tools with approved host execution; sandbox attempts
could not launch ffmpeg/ffprobe, not a new code failure. No software installation
or permanent PATH change. Known 13 missing product speech takes and human visual
acceptance remain unresolved; no takes approved by this task.
Browser QA covered /tree, draft rename/back navigation, variant selection,
motion replay/event interruption, compatible action picker and a real operator
chat. Not all 64 gestures were individually visually reviewed. Temporary QA
4194 stopped; updated ordinary studio serves 127.0.0.1:4188 (also /tree).

Thin Jakob note: 2026-09-20-nodtrad-rorelser-anslutning.md. External computer
agent prompt: PROMPT-windows-cursor-bash.md. Native dashboard, lab operator chat,
future player chat and IDE inbox remain distinct. No CAC issue supplied; no Jira
status transition. Local delivery commit only; new tree/motions not pushed or
deployed to Render (Next studio stays local).

## 2026-09-20 — one-click lab start and environment inventory

Added root Start-Labb.cmd / Start-Labb.ps1: starts the local Next studio from
any working directory, reuses a healthy existing studio, refuses an occupied
foreign port, opens the default browser after readiness, and installs locked
lab dependencies only when missing. Node version-manager shims resolve to the
actual Node executable. No secrets/config files are written, no credentials
rotate, and no Render services or system-wide PowerShell settings change.

Root _ENVIROMENT-INFO.md inventories lab/OpenClaw variable names, locations and
aliases without secret values: local LAB_REMOTE_TOKEN equals Director's
LAB_API_TOKEN; Gateway/model credentials retain their existing distinct roles.
Verified Render generateValue initializes only a missing variable; it is not
recurring rotation. Added links from root/lab READMEs and Jakob's thin index.

Validation: Windows PowerShell parser, existing-server reuse from a different
cwd, occupied-port rejection and wrapper checks passed (four new tests). The
full local suites passed 73 studio + 62 Director tests. Actual temporary start
on 4193 served health and the studio page successfully; the QA server was then
stopped and original 4188 preview retained. Ctrl+C injected through the tool's
PTY did not stop the QA child, so its exact verified process chain was stopped;
interactive console stop and automatic default-browser opening are not claimed
as UI-verified. Dependency installation was not needed or exercised. No paid
model requests, Render deploys or environment/credential edits were performed.

## 2026-09-20 — Windows media/player test portability

Reproduced the reported 11 failures (99/110 Node tests passed): five script-path
errors, one missing ffmpeg, four missing ffprobe and one WSL/Bash launch failure.
Replaced seven filesystem URL.pathname arguments in six tests with fileURLToPath,
including five latent media-path arguments hidden behind missing tools. The
bugshot test now selects existing Git for Windows Bash, normalizes its extracted
shell source to LF and passes an MSYS-compatible temporary path. Its real shell/
jq payload assertions remain intact; tools/bugshot.sh is unchanged.

The cue audit now hashes CRLF as LF only for cue text, preserving every other
byte and exact binary-media hashing. Astrid's LF cue hash matches both its Git
blob and existing baseline. Added three regression tests for equivalence and
continued rejection of content/media changes. Original cue/media/calibration
and the actual regression baseline were not rewritten or regenerated.

Installed FFmpeg/ffprobe 9.0.1 and jq 1.8.2 under the user's LocalAppData Programs/
CroupierTestTools; archive/binary SHA-256 and jq's PGP signature verified. Reused
existing Git Bash/GnuPG. Only User PATH changed; no system install/WSL/reboot.

Validation: every one of the 12 pre-commit commands exited 0; their Node groups
passed 113/113 (110 original + three new). Dealer --probe passed all 90 streams;
lab passed 69/69 and open-claw/lab passed 62/62. Zero skips/failures/cancellations.
Exact commands, hashes, setup and remaining boundaries: WINDOWS-MEDIA-TESTS.md.
No test execution blocker remains. The 13 known missing speech takes and human
lip-sync/contact acceptance remain open; no runtime or new visual approval.
No CAC issue ID/Jira connection was available, so no statuses were changed.
Inbox API was unavailable to this process. Preserved other work/private notes.
Local commit only; no push, deployment, secrets or Render configuration changes.

## 2026-09-20 — final work-branch publication preparation

Jakob requested saving and pushing all completed local work to origin.
Reviewed the three pending commits e69190b, 6efd3ba and 6fed982, including
their existing validation and limitations below. The registered chef role
was inactive; origin/work had no additional commits after a fresh fetch.
An untracked private login note contains authentication assignments and
was deliberately left local, unstaged and unchanged. No credential values
were copied into this handoff or the publication.

Validation: pending-commit whitespace check and targeted credential-pattern
scan passed. Existing studio/Director test results are recorded below;
no test rerun or new runtime/media acceptance is claimed. The known broader
product-check failures and real Render/model verification remain open.

## 2026-09-20 — lab structure and test explanations

Documentation-only follow-up: explained policies/schema/data/test, deferred a
redundant manifest, recorded the existing video registry/archive read path and
separated mocked integration checks from the pending real Render/model test.
Added a thin Jakob note and links from its index and lab README. Re-ran both
local suites: 69 studio + 62 Director tests passed. The previous broad product
failures remain unresolved; no media, runtime settings, secrets or deployment
changed. No real model request or broader product-suite rerun in this follow-up.

## 2026-09-20 — separate Next.js presentation studio

Jakob requested stopping the old local lab and rebuilding a clearer, editable
studio alongside open-claw. Stopped the verified old lab process on 4188;
Render was not stopped. New lab/ is a localhost-only Next.js app with three
views: event studio, video registry, and OpenClaw responsibilities/operator
chat. Six engine presentation types remain unchanged. The seed has 16 semantic
nodes, four dealers, 64 lines, one protected baseline plus up to four alternatives.
Editable labels, priority, shared typed triggers and exact generation bindings
live in a validated JSON project. Save uses revision conflict detection, an
atomic file replacement, recoverable stale writer locks and local history.
No existing catalog/data/media was moved or overwritten.

Deterministic, social and temperament predicates use only public/projected
events and explicit simulated context. Rules mode needs no LLM; shadow/active
reuse the existing eligible-ID gate. A hash of the complete draft plus dealer
invalidates stale advice, including binding edits. UI also drops late responses
when the selection/context/draft changes. Real player chat, memory, moderation,
roulette and product integration are not implemented; IDE inbox is separate.

Video inventory reuses the existing sanitized V3 snapshot and local original
archive, read-only. Known ID, realpath, size, SHA-256 and Range/HEAD handling
protect previews. Want/no are intake judgments, never runtime acceptance.
The isolated lab player can show the exact selected generation, not the
product's calibrated shared playback path. No take was approved or changed.

Existing deployment stays at open-claw/lab/render.yaml. Added authenticated
ephemeral /api/studio/advice and /api/studio/chat Director endpoints, plus
bounded temperament projection and bundler-safe settings path resolution.
These endpoints do not save drafts on Render. They are locally tested, not
deployed or verified against a real model. Local configuration still lacks
OPENCLAW_BASE_URL / Render relay settings; the UI reports disconnected.
No secrets or account settings changed. A separate studio CI job was added.

Validation: 69 studio tests, 62 existing/extended Director tests, catalog check,
TypeScript and Next production build passed. Browser QA used a separate ignored
data directory: renamed labels, added/prioritized a mood-gated variant, saved
and reloaded, selected the German-return variant, then bound a known original.
Exact bound preview loaded at 1920x1080, readyState 4, muted playback without
media error. Navigation and explicit disconnected OpenClaw status verified.
QA server on 4190 was stopped; the replacement production preview runs on
127.0.0.1:4188 with the normal seed, not the isolated QA edits.

Broader product checks are NOT all green: all 12 pre-commit commands were
attempted; Node groups passed 99/110. Failures: five existing Windows URL/path
handling errors, one missing ffmpeg, four missing ffprobe, and one WSL/Bash
access error. Dealer audit also reports Astrid cue bytes changed: normalizing
CRLF to LF matches the recorded baseline exactly. Cue files and baseline are
unchanged; no baseline was regenerated. The --probe audit remains blocked by
missing ffprobe. Performance, Astrid actor and blackjack asset checks passed.

Remaining: Jakob's incoming node-tree specification, real Render advice/chat
round-trip after deployment, and separate reviewed take/product integration.
See lab/README.md and Jakobs thin 2026-09-20-openclaw-och-labb.md note.

## 2026-09-20 — Local inbox credential connected

Connected the user's explicitly supplied jakob-inbox entry without displaying
its value or changing the original file. A dedicated credential file outside
Git is restricted to the current Windows user. GITLAB_TOKEN_FILE is persisted
in the user environment; restart the IDE for automatic inheritance. The current
task explicitly loaded the path for verified API reads and a successful post.
The sandbox could not inspect the protected ACL; an approved host-side check
verified both the ACL and persisted path. Do not interpret this as a guarantee
that every sandbox or already-running agent has loaded the new environment.

Sent onboarding to Kevin, CC Emil: issue 1, note 3870229815. Their setup/read
receipt is unverified; no shared credentials or private chat logs were sent.
The earlier greeting remains unsent. No gameplay/code changes or token values
are included. Preserved other agents' dirty OpenClaw, lab and documentation files.

## 2026-09-20 — video register overview and preview shutdown documented

Consolidated the existing registry/manifest findings into one table in the
V3 video map report and linked it from Jakobs work record. The table separates
existing sources, unverified live BO assignments and proposed event/take YAML.
Recorded the user-requested preview shutdown and the subsequent check that
neither 4196 nor 4197 listened and no task-owned preview process remained.
This records the earlier shutdown check; no server was restarted.

Validation: documentation links and git diff checks. No media/player changes
or new visual acceptance. Active bindings and final schema integration remain open.

## 2026-09-20 — Explicit local chef role

Jakob requested a reusable coordinating role and publication to his work branch.
Added the canonical chef skill, thin Cursor adapters and an AGENTS routing rule.
The four steps are inventory, scoped coordination, requested integration/tests,
and verified delivery. Activation is explicit: /chef (Codex skill picker: $chef).
Status only reads; /chef av releases this chat's role. Kevin retains product
decisions. Activation does not authorize merge/push or start background agents.

A cooperative registry in the main worktree's ignored .croupier-inbox directory
is shared by linked worktrees, not separate clones/machines. A short atomic lock
protects updates; a second chat cannot silently take over. This is not an ACL
or a long-running Git lock. No chief was activated during this delivery.

Validation: all 31 inbox/chef tests passed locally, including concurrent claims,
linked worktrees, explicit handover and separate clones. Behavioral review
clarified per-worktree inventory, fresh origin targets and lost-role handling.
Skill metadata was checked manually; the optional Python validator lacks PyYAML.
CI includes the new tests. No gameplay, media, live inbox or deployment changes.
The shared inbox guide and Jakobs thin notes describe the same role boundaries.

## 2026-09-20 — OpenClaw archive cleanup and thin Jakob notes

Jakob requested removal/consolidation of obsolete OpenClaw folders and a short
record of this task's full day's work in random-stuff-jakob/jakob-docs, followed
by publication to origin/jakeminator123/work. The old tracked proposal moved
from open-claw/openclaw_croupier to open-claw/archive/croupier-proposal-v2.
All 24 files were preserved unchanged. Removed the local untracked duplicate
random-stuff-jakob/openclaw_croupier only after all its 23 files matched the
preserved package by SHA-256. No unique material was deleted; its content
remains recoverable from the archive. Provenance and the 22-entry original
manifest stay available. Historical V2 references now name the archive.

Added 2026-09-20-openclaw-och-labb.md to Jakobs notes and linked its existing
index; the short open-claw README now distinguishes active lab from archive.
Corrected the dashboard guide: installation is not required on each visit.
After the earlier deployment entry below, Jakob explicitly authorized pairing;
his pending browser was approved using the existing environment credential,
and the authenticated native dashboard was observed. No secret file was read.
An actual model/chat response, live restart-persistence acceptance, real player
chat, player memory and approved-video integration remain unverified/unbuilt.
The exposed Gateway password has not been rotated. IDE inbox remains separate.

Validation: 54 lab tests and catalog check passed; 24 archived Git blobs are
unchanged and 13 relative links in changed Markdown files resolve. Local
check still reports no configured Gateway (OPENCLAW_BASE_URL missing), not a
live model success. No gameplay, media, database, runtime code, Dockerfile,
blueprint, secrets or Render settings changed. Deployment is not required
for this documentation/folder cleanup. Only this task's files are staged.

## 2026-09-20 — durable work record in Jakobs docs

Added random-stuff-jakob/jakob-docs/2026-09-20-v3-videoregister-och-placering.md
and linked it from that folder's README at Jakob's request. The authored
record covers the V3 video inventory, existing archive, storage/fetch audit,
placement decisions, portable map startup, validation, published commits
and OPENCLAW handoff. It distinguishes verified findings from proposed
bindings and the other task's implementation. It includes remaining work
and links to the full technical report rather than a conversation export.

Documentation-only addition; existing media, gameplay and runtime are unchanged.
Validation: relative file links and git diff whitespace/conflict checks.
No new dealer playback or visual acceptance is claimed.

## 2026-09-20 — publish portable V3 video map to Jakob work

Jakob authorized pushing this task's work to jakeminator123/work. Prepared
an isolated checkout on the current remote work branch so other agents'
unpublished commits and original working files remain separate. Preserved
the remote handoff entries while applying the video inventory report.

Added a portable docs/animation-events/v3-video-map/map.html, sanitized
snapshot.json, HTML template, deterministic build command and read-only
localhost preview server. The server takes --archive PATH, verifies size
and SHA-256, supports byte ranges and only serves allowlisted generation
IDs. No API key, complete raw prompt, original MP4 or conversation export
is included. The report now records the storage/fetch follow-up and startup
instructions. This remains an inventory and proposal, not runtime integration.

Validation: deterministic rebuild, embedded-data equality, secret exclusion
and JavaScript syntax passed. Fifteen HTTP checks passed, including local
hash/range handling and rejection of corrupt test copies. Browser loaded the
portable map and a 1920x1080 local preview with readyState 4 and no media or
console errors. No product player/media acceptance is claimed.

The OPENCLAW task received the user's requested coordination handoff:
original server archive versus identical local copies versus processed
runtime takes; generationId/sourceHash to take/mediaHash to event mapping;
and separate intakeVerdict, reviewStatus and activeBinding. Actual BO
assignments, per-take visual acceptance and final trigger definitions remain
unverified. Existing gameplay, media and OpenClaw runtime are untouched.

## 2026-09-20 — V3 video inventory and placement map

Read the Bettalotto Generations API using the user-authorized local
BETTALOTTO_API variable without exposing it. Snapshot: 224 generations,
17 want, 52 no, 155 unrated. Located the existing full download archive at
`C:/Users/jakem/CroupierAssets/bettalotto-generations`; all 224 MP4 files
match API byte sizes and SHA-256 (1,022,561,047 bytes total). No download,
move, generation, gameplay/media/calibration or database change was made.
The user explicitly chose Kevin's existing performance placement as the
starting point; the proposed tree references it instead of moving media.

Delivered `docs/animation-events/v3-video-map/README.md`, a private local
interactive HTML map with video previews, an SDK canvas and derived JSON.
The report records their absolute locations and preview restart command.
Raw API snapshots and helper scripts stay under ignored
`.croupier-inbox/v3-video-audit/`. The map separates six real Partner
presentation types, the lab's 16 semantic nodes / two variants / 32 simple
animations, and the proposed four-dealer / three-variant-slot tree (192
slots before subevents; 324 in the explicit 27-family example).

Evidence: 59 generation hashes match 60 tracked MP4 files; 67 IDs have
tracked textual references. Public stream indexes total 89 (local 90 due
to Astrid's additional action-return). Public Astrid performance contains
four base takes and two continuations, all review. Flagged want-versus-
rejection conflict and no-marked historical source dependencies. None of
these counts prove active gameplay usage or visual acceptance.

Validation: all archive hashes, data counts/cross-references, report links,
secret exclusion, HTML JavaScript syntax and strict canvas TypeScript
passed. Browser checked dealer/subevent selection, missing Mei push,
register filtering/search and local video playback through its end. No product
rehearsal or lipsync acceptance is claimed. Current BO assignments and
deployed app source remain unverified: both HTTP 401 and signed-out BO
browser. Kevin code reference remains locally cached 626554d; SSH access
prevented remote-head refresh. No Jira CAC issue was implemented or closed.

## 2026-09-20 — native OpenClaw dashboard published and live

Jakob explicitly approved publishing and activating the native dashboard.
Pushed and verified 7ec4e17f86e596c6f1c67fc250859250f1003335 on GitLab
jakeminator123/work from the isolated publication checkout. Only our three
OpenClaw commits were published above 3622515; the separate 11538a9 video
registry and local merge remain unpublished and intact in the main checkout.
Do not push the shared main checkout's HEAD without reviewing that distinction.

Render Director deployment dep-danhsvbtqb8s73bvr6n0 is Live on 7ec4e17.
Set OPENCLAW_DASHBOARD_ORIGIN=https://croupier-lab-director.onrender.com on
the existing private Gateway and used Save, rebuild, and deploy. Gateway
deployment dep-danhtartqb8s73bvs8f0 is Live on the same commit. The real pinned
CLI validation passed, legacy configuration migration retained its backup,
and runtime logs reached gateway ready. No new resources or credentials were
created. Blueprint Auto Sync remains Yes; its setting was not changed.

Verified native UI at https://croupier-lab-director.onrender.com/openclaw/chat:
it displays "This Gateway expects its password" and reports the Gateway
reachable, with wss://croupier-lab-director.onrender.com/openclaw selected.
No secret file was read, no login credential entered and no device approved.
User next enters their existing OPENCLAWAPI_KEY into Gateway secret. Initial
browser pairing may follow. Authenticated chat/model call, settings edits and
restart-persistence acceptance remain unverified live (54 local tests passed).
Logs also note memory-core dreaming reconciliation lacks an agent-less cron
owner; cron/heartbeat are intentionally disabled, so no scheduling feature is
claimed. No gameplay/media/database or IDE-inbox integration was changed.

## 2026-09-20 — lightweight personal documentation

Added only `random-stuff-jakob/jakob-docs/README.md` as Jakob's requested thin,
temporary summary of V3 and inbox work. Clarified that previews are truncated,
not GitLab originals, and local cache retention is not yet age-bounded. No
history deleted, runtime changed or new documentation automation installed.
Verified file scope and `git diff --check`; documentation-only, no runtime test.

## 2026-09-20 — bounded, addressed GitLab inbox

Optimized only inbox tooling/instructions: 30-second per-repo/credential fetch
cache with a process lock; per-conversation unread/ack state remains independent.
At most five 280-character previews, bounded result size, direct questions first;
full notes on demand. No ordinary-turn browser fallback when API auth is absent,
no checks on agent/tool updates, background polling or automatic local broadcasts.

Questions/handoffs have one To recipient; optional CC is informational. Replies
are guarded at draft and send against the parent question, original sender and
live parent version. Owner-wide questions need that owner's explicit assignment;
an Emil agent cannot reply to Kevin's question. These are cooperating-client
rules, not GitLab ACLs or authentication. Other installations must opt in.

Verification: 23 Node tests pass (routing, owner/CC restrictions, bounded output,
shared cache expiry/force/concurrency, independent acknowledgements, failed fetch
preservation, changed-parent rejection and idempotent send). Empty pending result
is 112 characters before freshness metadata, not a measured token/billing figure.
Skill copies match; frontmatter/links reviewed. Bundled Python skill validator
could not run because PyYAML is absent; no dependency was installed for it.
No gameplay/media/database changes. Jira connector/current issue unavailable;
no Jira status was changed or completion claimed there.

Rollout: publish this scoped change on codex/inbox-routing-cache and the matching
guide on the GitLab wiki, without pushing this checkout's unrelated video/merge
history. GITLAB_TOKEN/GITLAB_TOKEN_FILE is still unconfigured locally, so real
API checks/sends remain unverified; mock transport tests are not a live check.
Kevin/Emil must install the files and register their own actual agent IDs.

## 2026-09-20 — native OpenClaw dashboard ingress (local, awaiting rollout)

Jakob clarified that he wants OpenClaw's real Control UI for chat/tools/settings,
not the lab editor or another login frontend. Implemented `/openclaw` HTTP and
WebSocket forwarding through the existing public Director to the private
Gateway. Native password auth uses the existing OPENCLAWAPI_KEY; no server key
is injected into browser traffic. Exact Origin/Host, bounded transport, native
CSP/cookies, no public /v1 forwarding and normal device pairing are retained.

Gateway config is now editable/persistent. First-run seed or exact legacy-only
backup/migration preserves sessions and workspaces; custom configurations are
not broadly replaced. Three separate no-tools agents include croupier-operator
for later deliberate admin configuration. Startup reconciles auth/origin policy
and validates before atomic save. Native hot reload is not a continuous policy
lock; Director ingress checks remain independent. Added DASHBOARD-SV.md and
updated setup/source docs; llms.txt remains on-demand with no runtime fetching.

Verification: 54 Node tests pass, including real HTTP/raw-WebSocket proxy tests,
native credential non-injection, origin/traversal rejection, timeout/teardown,
config migration/persistence and existing engine/server tests. Catalog check:
16 nodes, 32 assets, 33 fixture events. Independent bounded code/source review
found no blocking issue. No product gameplay/media/database changes. Advanced
root-mounted MCP OAuth/Board/plugin routes are intentionally not exposed.

Read-only Render inspection found both existing lab services Live on 3622515;
Director URL is https://croupier-lab-director.onrender.com. That verifies the old
deployment, not this new dashboard/config revision or a live model response.
Blueprint Auto Sync is still Yes. No cloud settings, credentials, pairing or
deployment changed by this task. Publication/activation awaits confirmation
because YAML push can trigger sync. Actual native browser login, container
validation of this revision, model call and restart persistence remain rollout
acceptance steps. Existing separate video-registry work is not authorized for
publication; an isolated ignored worktree prepares only our OpenClaw commits
above remote 3622515. Main checkout and that other work remain intact.

## 2026-09-20 — on-demand documentation and dashboard access boundary

Added the short `open-claw/lab/docs/README.md` requested by Jakob. Codex/Cursor
guidance now begins with this local note and fetches official docs/llms.txt only
when a current question needs them. No periodic indexing, crawling, vector DB
or runtime model-prompt loading was installed; runtime source/deploy/UI searches
found no documentation-fetch references. Existing verified links remain indexed.

Reviewed native dashboard access against official docs and pinned v2026.9.5
sources. A single password/token field is supported, but a new remote browser
normally still needs initial device approval. Current Gateway remains private
with Control UI disabled; no auth weakening, public admin endpoint or cloud
change was made. Jakob was asked whether to add a separate HTTPS dashboard
entry while retaining the private Gateway. That access decision and actual
container/model verification remain pending. This is documentation/rule work,
not gameplay, media or player-chat integration.

## 2026-09-20 — official OpenClaw documentation index for IDE agents

Added `open-claw/lab/docs/OPENCLAW-DOCS.md` with official documentation links,
the live `llms.txt` index/Markdown lookup path, local configuration-file mapping
and a deployed-version policy. The root AGENTS.md points OpenClaw work to this
index; `.cursor/rules/openclaw-docs.mdc` scopes the same guidance to `open-claw/**`.
Both OpenClaw READMEs link to the index. Existing project rules remain intact.

Verified the official install, setup/onboard, MCP, documentation index and config
CLI pages. MCP runtime conversation access is not a documentation search service;
no MCP server, integration or installer was added. No claim is made that a
separate official documentation MCP cannot exist. Container config remains
version-pinned and read-only. IDE inbox, operator chat and player-chat integration
retain their separate boundaries. No secrets, gameplay/media or Render resources
were changed; live container/model verification remains pending.
Local checks passed for 26 index links (official URL authority/local targets),
the Cursor rule's scope/frontmatter/length, pinned-version link and whitespace.

## 2026-09-20 — OpenClaw publication and chat-boundary clarification

Jakob authorized publishing the reviewed OpenClaw work to GitLab's
`jakeminator123/work`, not `main`, and requested guided Render setup.
Added `open-claw/lab/docs/RENDER-START-SV.md` with exact repository, branch,
Blueprint path, two-service resource review, key placement, local connection
and end-to-end acceptance steps. Clarified that Blueprint Auto Sync must be
disabled separately from service `autoDeployTrigger: off` for a manual rollout.

The GitLab IDE-agent inbox is unrelated to OpenClaw. Product/player chat is
intended to supply bounded presentation context, but its actual server adapter,
moderation and player memory are not implemented. The existing OpenClaw chat
is an operator conversation about the catalog, not a delivered player-chat
system. README and deployment docs now make this distinction explicit.

Verification before publication: all 28 lab tests passed again; catalog check
validated 16 nodes, 32 assets and 33 fixture events. Real Gateway connection
remains unconfigured. No runtime/gameplay/media code, secrets or cloud resources
were changed for this clarification. Docker build and Render live acceptance
remain pending; unrelated working-tree files are excluded.

## 2026-09-20 — isolated OpenClaw presentation lab and Render blueprint

Implemented `open-claw/lab/` on Jakob's explicit request as a separate, runnable
experiment. It starts with `npm --prefix open-claw/lab start` at
`http://localhost:4188`. No Croupier gameplay, media/player, calibration or real
database file was changed. No GitHub repo, Render resource or wiki update was
created. Integration into Kevin's product remains a separate decision.

The lab freezes the six actual `presentation[]` source types from
`web/partner-presentation.mjs`: speak, deal, reveal, settle, turn, idle. Its 16
semantic nodes each have a standard lane and contextual variant (32 animation
assets). Swedish labels accompany exact code names. The JSON catalog, schemas,
safe trigger DSL, example scenarios, linked editor, SVG presentation stage,
decision trace, ordered import endpoint and separate operator chat live together
in this self-contained folder. Editable revisions persist under ignored `data/`
with previous snapshots in `data/history/`. Browser editing was exercised by
changing a label, saving, reloading to verify persistence and restoring it.

Modes are off, shadow and active. Only eligible variant IDs may be advised by
OpenClaw; request ID and catalog revision are checked. Missing, late, malformed,
foreign or ineligible advice falls back. In-flight catalog changes invalidate
advice. Inputs project out hidden game data, identities, money and free-form
chat instructions; face-down card ranks/suits never reach the director. Batch
requests have a shared 25-second advice budget. Duplicate request IDs reuse a
bounded in-memory decision, but conflicting input is rejected. The local server
rejects foreign origins and non-loopback Host values. Public listeners require
the separate lab bearer token, including when .env is changed while running.

OpenClaw adapter uses the official HTTP endpoint with separate no-tools
presentation/chat agents. `OPENCLAWAPI_KEY` is the user's chosen variable for
Gateway authentication, read server-side from the root `.env`; it is not an
implicit alias for an inherited `OPENAI_API_KEY`. The Gateway requires a
separate provider credential (`OPENCLAW_MODEL_API_KEY`). Render blueprint
declares public Director + private Gateway and persistent disks; Docker Compose
can expose the Director at loopback:4189 behind the local browser server:4188.
The official Gateway image is pinned to 2026.9.5 and its verified OCI digest.
The local server initiates the Render connection with `LAB_REMOTE_URL` and
`LAB_REMOTE_TOKEN`; no inbound laptop tunnel is required.

Validation: 28 Node tests passed covering the real Croupier event producer,
projection, triggers, schema cross-references, all gate modes, stale revisions,
HTTP auth/origin checks, editor conflicts, idempotency, bounded batches, remote
relay and deployment secret separation. `npm run check` validates 16 nodes,
32 assets and 33 fixture events. JavaScript syntax and `git diff --check`
passed. Codex in-app browser showed the UI and exercised the full 12-event
round through idle, a German-preference trigger (2 eligible choices), active
mode's genuine unconfigured-Gateway fallback, manual alternative preview and
save/reload. A background-tab RAF completion delay found during that pass was
fixed with an independent wall-clock deadline and cancelled stale frames;
editor/context mutation is locked during playback/save. No product-media
approval or lipsync result is implied by these lab checks.

Remaining: actual OpenClaw/provider credential and Gateway URL were not
configured at validation time, so real model chat/advice are not verified.
Docker is unavailable on this machine; image build, pinned CLI config
validation, Render mount permissions and cloud deployment remain to test.
Jira CAC was inaccessible in the signed-out browser and no matching issue or
transition was claimed. Player history/chat classification are simulated; no
production memory or moderation pipeline exists here. The normal game client
does not directly consume Partner `presentation[]`; this lab is a separate
consumer contract, not a claim of existing product integration. Kevin's reported
YAML/event/take and Generations API want/no proposal is recorded as future
intake before a reviewed catalog. The current catalog accepts simple animation
assets; real video-bank activation needs complete take hashes, speech bundles,
calibration and shared-player acceptance. See the lab README, deployment guide
and `media/README.md` for the staged plan and video register fields.

## 2026-09-20 — unified V3 wiki and webcanvas publication

Documentation-only follow-up requested by Jakob. The eleven V3 source
documents under docs/animation-events/v3-9-days-mvp are the editable semantic
source. GitHub animation-events-v1 owns the HTML generator and mirrors those
documents; the wiki mirrors are generated with wiki-specific link paths.
The historical repo name is retained for stable links, not as a V1 label.

Corrected: the regular app uses /api/table, not Partner presentation[];
the Partner asset manifest excludes rejected takes but does not publish
take status/hash, so it is not a proof of approved playback. Kevin's inbox
note 3869829140 confirms rng/show and line/variant/trigger/take vocabulary;
his disk tree, YAML and want/no intake are proposals, not implemented schema.
The named inbox workflow is linked from the documentation and webcanvas.

Publication targets: GitHub main and Vercel's usual animation-events-v1
address for V3, plus the GitLab wiki. V2 is preserved separately from the
original GitHub 871bd7c HTML and the existing wiki archive. Wiki HTML files
are downloadable source copies, not the runnable webcanvas; main navigation
now directs readers to Vercel. GitHub has an offline sync/hash checker and
CI/build checks; these do not claim automatic remote GitLab synchronization.

Verification before source commit: git diff --check; five engine blobs and
the API/player paths rechecked against published Jakob 51aea06 and Kevin
626554d. Seventeen focused generation/sync/archive tests passed; all 44
mirrored files match, all seven pages and search were exercised in the local
browser, and checked wiki links resolve to files. Live publication checks
follow separately. No gameplay, media, calibration or live database changes.
No CAC issue is marked done. OpenClaw was published independently by its
owning agent at 7ea6758 during this work; this commit preserves those files.

## 2026-09-20 — named agents and per-user-turn shared inbox

Jakob explicitly replaced the earlier checkpoint-only ping policy. The
current rule now requests one inbox check at the beginning of each new user
turn, with a stable chat-derived agent name and a separate cursor per chat.
No timer/background polling or comments for empty checks. Relevant replies
and scoped outgoing answers are also reported to the local user.

Implementation: tools/croupier-inbox.mjs, matching Codex/Cursor ping skills,
AGENTS.md/CLAUDE.md and inbox rules, docs/shared/AGENT-INBOX.md. The helper uses
one small conditional GitLab Notes API GET when unchanged, pagination on
changes, pending messages until explicit acknowledgement, versioned edits,
signed drafts and explicit send/reconciliation. It does not filter agents
solely by their shared human account. Credentials/cursors/drafts are ignored
under .croupier-inbox; the old global seen file is no longer used.

Verified: 15 focused Node tests covering per-chat isolation, routing,
pagination of 205 messages, pending delivery, edited notes, failed fetches,
signed send recovery and locks; git diff --check. The two skill copies are
byte-identical; frontmatter was inspected manually because the bundled skill
validator's PyYAML dependency is absent in the system Python. Browser fallback successfully
read work item #1. No GitLab API credential/connector is available in this
environment, so the live cheap API path and live API sending are NOT verified
or enabled here. Follow the browser fallback until an authorized GitLab API
connection is configured. Do not claim missing authentication means no new
messages. The rule guides agents; no IDE event hook was installed.

The shared wiki gets the same inbox workflow, onboarding for Kevin/Emil and
this agent's identity. Kevin/Emil must adopt it in their own working copies;
publishing docs does not change their agent permissions or branches. Jira CAC
continues to track implementation/QA; this delivery does not mark any CAC
issue done. Gameplay/media were not changed. Concurrent OpenClaw work belongs
to its other local agent and is excluded from this commit.

## 2026-09-20 — V3 documentation and canvas correction

Documentation-only correction of the Animation events V3 model; no gameplay,
dealer media, calibration, database or runtime file was changed. The revised
pages now record the meeting decision accurately: Kevin owns the Croupier
engine and integration, Jakob works in bounded backend/logic stages on
`jakeminator123/work`, Emil works closely with Kevin on video, and Jakob–Emil
coordination is a thin artifact handoff. The old nine-day/nine-step wording is
explicitly a proposal, not a meeting decision. The directory name
`v3-9-days-mvp` remains only as a historical path.

The source roles are separated: GitLab Croupier is runtime truth, the GitLab
wiki is the shared decision/handoff surface, and GitHub
`Jakeminator123/animation-events-v1` is the source repo for the interactive
canvas and public presentation, never for RNG, cards, wallet or game rules.
The inbox rule may remain `alwaysApply` so its guardrails are loaded, but it
checks the Jakob–Kevin thread only on explicit `/ping-croupier` requests or a
relevant workflow checkpoint and never polls every turn.

Runtime verification pinned `jakeminator123/work` at `b0435c3`, Kevin's
`codex/restore-casino-environment` and MR !1 at `626554d`, and their common
base at `b147659`. Core blackjack, shoe, Partner API, presentation and dealer
engine blobs are identical on the two branches, so Jakob's branch does not
lack the engine. The former sole anchor `eaffbb8` was invalid for its claims:
`partner-presentation.mjs` arrived in `d188236` and `generations-api.mjs` in
`e718546`. The latter is a read-only media API, not the game engine.

The interactive canvas was published without touching GitHub `main`: branch
`v3-9-days-mvp` at `0d5f737`. The synchronized GitLab wiki was published at
`0ec502b`. Eleven V3 source documents match between Croupier and the wiki;
the GitHub canvas and both wiki HTML copies share SHA-256
`FEE5708DF7CA117F2DB1A2649F694DF811C550AC503DF9306FD80484FB9C1C49`.
The existing Vercel deployment still shows V2 until an explicit promotion is
approved.

Verification for this documentation delivery: remote branch/MR heads checked
with `git ls-remote`; `git diff --check` passed on all three repositories; all
changed local Markdown links resolve; code fences and Markdown tables are
balanced; `node build-static.mjs --check` reproduces the seven-page,
52-section HTML; and the embedded browser script compiles. A local visual
browser pass was blocked by the browser surface's `file://` URL policy and was
not bypassed; perform the visual pass from an HTTPS preview before promoting
V3 to Vercel. No gameplay or dealer-media test was claimed because those files
were not touched. Do not treat this documentation correction as a runtime
merge, visual approval or completion of any Jira CAC issue.

## 2026-09-17 — seven-seat physical reach clips in isolated gameplay review

User asked Astrid to physically deal to the seven existing seat positions. Generated per-seat Kling 3.0 start/end-frame clips from the ready pose to endpoint images rendered from actual isolated game card quads (content/staging/2026-09-17/seven-seat-reach). Boxes 0–4 pass frame review (hand carries card to target, releases there); boxes 5 and 6 failed twice (card teleports / wrong direction). Scout Gaming Group workspace credits 63.42→1.92; no more generation possible without top-up.

New opt-in review route `astridSeven=review` (with `astridContinuous=off`) on isolated 4190 plays the full-scene clip for the first card of boxes 0–4 and reveals the DOM card at the clip's release time; boxes 5/6, later cards and dealer keep legacy delivery. Two headless rounds completed with all ten clips playing and settling. This is rough review, not mask/registration acceptance: idle→clip→idle cuts are abrupt and the clip's baked table sits over the CSS table. Public 4173 unchanged.

## 2026-09-14 — continuous four-card film now drives actual opening

User rejected a render gallery and requested gameplay integration. New persisted `game-runtime/continuous-demo/install.py` installs the existing350-frame joined camera-locked four-delivery/return film into actual4190 opening flow for exactly three active player seats. Two passes show eight server-issued cards, fourth slot of pass2 is hole/back-only. Other counts and later decisions retain previous routes. `astridContinuous=off` restores previous opening. No new generation; abandoned gallery files were removed without installation.

Actual1117x837 browser round at boxes2/3/4 recorded two complete passes,8 one-time landings, insurance→decisions→settlement→bets. Wallet920→905→917.50. See `continuous-demo/{actual-opening.json,settlement.txt,in-motion-2.jpg,README.md,media-receipt.json}`. In-motion screenshot from next round shows new actor with actual game cards. Required probe/precommit passed. This is rough integration: existing source trajectories while held, then explicit12-frame authored slide to true DOM destinations, not physically calibrated all-seat hand contact. No fabricated review status. Existing masks/joins remain imperfect; full originalgoal remains unfinished. Public4173/backend unchanged.

## 2026-09-14 — existing clips enabled together for requested demo

User explicitly requested connecting existing renders, accepting a rough demonstrable game. The existing4190 Astrid URL (`astridBox0=review&astridVariant=v6`) now also enables first centre-card box3 and first dealer-upcard without extra flags, alongside existing box0v6/box1. Explicit off overrides, first-card/hole/split/identity gates and reviewed viewport/geometry constraints remain. Debug banners are hidden unless diagnostics/capture is requested; telemetry stays in DOM. No generation or media alteration.

Actual unchanged demo URL at1091x837 completed a three-seat round (boxes0,1,3): wallet925→910→940, returned30, back to bets. Separate centre-only round confirmed both box3 and dealer-up source receipts complete with exactly one landing each; dealer showed an ace and insurance remained functional. Evidence under `single-seat/integrated-demo/`.18 focused tests, precommit suites and dealer-sync probe pass. Dropped frames and abrupt returns remain; subsequent cards/unsupported seats still use legacy footage. This connects four candidate routes, not all twelve renders or completed seven-seat realism. Public4173 and other dealers unchanged.

## 2026-09-14 — reference-use audit prevents duplicate motion generation

Live Higgsfield MCP confirms one free Genjutsu attempt remains, but this is not an untried solution. The actual YouTube 4–9s reference already drove completed job d8214fb8-fef1-4810-a29e-70230d1baa20. Its independent review found better overlapping two-hand motion and rejected the transferred camera/table/background. Current model schema exposes resolution only, with no new camera-lock control. Do not repeat those same inputs at 720p merely because an attempt is free. No generation submitted, no credits spent, no gameplay/media change. Decision and source receipts: `content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/next-source-investigation/FREE-ATTEMPT-DECISION.md`. Full goal remains incomplete; this audit corrects the reference-use account, not visual acceptance.

## 2026-09-14 — release candidate GPU resources between rounds

Isolated4190 now disposes each candidate renderer, its unique owned textures/materials/geometries and detached video decoder on terminal completion/failure. Late texture callbacks cannot revive rendering; cleanup is idempotent, including adapter-construction failure. No footage/identity/geometry changes in gameplay.

Actual browser: two consecutive two-seat rounds without reload completed and returned to bets. Wallet960→970→980 after two10-unit stakes and20-unit returns. Public DOM receipts recorded10 owned resources disposed and context released for three observed candidate completions, including both routes in round2. First-round box1 disposal was not captured. Evidence: single-seat/gpu-consecutive-rounds.json. Focused lifecycle test, pre-commit and dealer-sync probe pass. This does not prove sustained60fps or acceptable physical dealing.

Local existing-media experiment: pickup-composite restores original shoe pixels while preserving photographed hand and paper across25 selected frames; root inspected all25 dense pairs. Gray generated fascia is removed, but small finger notches and dark wrist edges remain, and final frame still only partially extracts a card. Not integrated or visually accepted. Pace canvas path dropped5–6 frames; direct video dropped0 then1, with fewer callbacks than encoded frames. No60fps presentation claim. No generation/credit requests or spending.

## 2026-09-14 — bounded Astrid preparation and actual seven-seat round

User requires delivery before further credits: no new generation or credit requests. Isolated4190 review link remains the active gameplay boundary; public4173 unchanged.

Candidate metadata/body parsing is now bounded to5seconds and abortable from preparation start. The issued DOM card stays hidden during preparation and is restored exactly once on failure/cancellation. Late metadata cannot restart a cancelled candidate. Synced to4190.

Verified in actual user tab at1091×837: seven $5 demo bets, two cards visibly present at every seat, all seven Stand decisions, dealer settlement, and return to PLEASE PLACE BETS without a stuck round. Wallet990→955 stake→960 settlement; returned5, net−30. Both box1 and box0v6 candidate playback occurred. Evidence lives in single-seat/seven-seat-preparation-trace.json and seven-seat-settlement-proof.json.14 focused tests, pre-commit and dealer-sync probe passed. This proves round continuity, not accepted lifelike movement or stable60fps.

Still broken: new low shoe-extraction primitive is not integrated; existing14-source search found no compatible continuation. Only first cards for box0/box1 use current candidates; other cards retain legacy delivery. Hand/head jumps and source pickup defects remain visually unaccepted. No additional credits spent for this repair.

## Affordable explicit endpoint pickup trial running — 2026-09-14

Seedance start/end request was unfunded at36credits versus live9.67balance. Ordinary Kling3.0 Pro supports a3s endpoint trial at5.25credits; submitted ONE jobbc9d45f0-b2a3-48c3-b850-fc5e0899fdcd with exact original0 start, low-contact anchor end, silent, explicit1080p. Root live jobs_wait confirms in_progress. This is ordinary Kling3.0, not previously failed OmniEdit. motion_review owns polling; verify actual dimensions and every native extraction frame. No further generation authorized for this trial. Exact request/preflight under next-source-investigation/kling-primitive-{submission,preflight}.json. No free allowance consumed, no public gameplay promotion, full goal remains open.

Contact-viewer code and actual raw/clean browser exports are committed in6cd8ca3; syntax, required hook suites and dealer probe passed. The one-frame depth arrangement is plausible, but does not validate movement, all seats, or game3D depth. Existing user tab111 retains knownfirst-card box0v6/box1 rough gameplay.

## Source-owned shoe with low-contact actor pose — 2026-09-14

Raw Vision matte on low-mouth-anchor excludes the invented gray fascia (inspected samples0alpha) and retains the drawing palm/fingertip (255alpha). Root inspected contact-proof.jpg; faint source-card/sidewall fragments and partial resting-hand alpha remain, requiring cleanup. Original shoe depth must be partitioned: tray behind card, original front face/walls in front of card, hand in front at contact. A whole opaque shoe silhouette would hide the extracted card. This is a viable pose-reference/compositor direction, not visual completion.

ONE grounded Seedance2.5 video_edit is submitted, job3dd450da-2ca2-44c4-a2bb-4327c0f1cbb6, quoted36.37credits. Job is terminal COMPLETED and rejected by root and motion_review: native8–19 still lifts above the stack; the edit mainly changes the printed face to red. No more prompt-only video_edit retries. Original video plus corrected low-contact anchor and source40 shoe; requested correction extends through early raised presentation rather than forcing the rejected upright pose back at0.75s. motion_review owns polling. Exact request: next-source-investigation/low-contact-video-submission.json. No other generation while active; no runtime promotion. Browser contact/depth diagnostic now runs at127.0.0.1:4192. Root inspected and exported actual-browser-contact.png and actual-browser-clean.png. Originalshoe +card +hardware +hand is plausible in this one still; paper cleanup preserves three sampled fingertip alphas252/245/239. Card border/trace uncertainty remains; not motion or gameplay acceptance. True start/end pickup submission passed36credit preflight but was rejected before any job for insufficient credits. Live balance9.67credits, not zero. Read-only equivalent-model cost check is underway; no free generation consumed.

## Corrected physical-contact anchor in progress — 2026-09-14

After the ineffective Seedance edit, submitted ONE GPT Image2 high2k low-extraction anchor, job0c70e596-012c-4b0b-b3f7-c51eb3b45e22, quoted6.5credits. Root live jobs_wait confirms COMPLETED. The resulting low-mouth-anchor.png SHA7ba03609b27b20ac3707e183708bad9170b1124cc37fa67d702c6c6e56f395de now shows a low red-backed card under the fingertips, but invents a gray block across the shoe throat. Root independently inspected fullframe and source comparison; it is not accepted as the exact shoe. One localized GPT Image2 correction is submitted, job149cbd41-1c1f-4fda-852a-e7162dac6266, quoted6.5credits. Root live jobs_wait confirms COMPLETED. Root inspected shoe-correction.png: low red card/hand pose remains, but the invented gray fascia is still present. It is not an accepted complete source image. Uses original anchor plus byte-identical unoccluded source40 JPG. No more identical shoe-edit retries. Current investigation checks whether the existing actor matte can exclude generated shoe geometry and retain contact against the original game shoe; no video submitted yet. Exact request is next-source-investigation/shoe-correction-submission.json. No video until shoe/contact inspection succeeds. Background feature registration residual0.462px is analysis evidence only, not proof of unchanged actor or shoe. Uses exact original box1 native0 plus real lip-action crops. Target is a single red-back-up card half extracted low through existing black frontmouth; preserve original shoe, stack, actor and camera. Exact request is next-source-investigation/low-mouth-anchor-submission.json; geometry reasoning is LOW-MOUTH-ANCHOR-PLAN.md. Do not submit further video until the anchor itself is inspected. This is a reference candidate, not new gameplay or completed movement. All-seven-seat/full-round goal remains open.

## Existing Astrid review link includes the new second-left source — 2026-09-14

The user's existing isolated4190 URL with astridBox0=review now enables the new box1 first-card source without requiring an additional astridBox1 flag. Explicit astridBox1=off still disables it. Host, Astrid identity, exact seat, first-card and no-split gates remain. Ten focused bridge tests pass. The installer writes atomically.

Actual user tab111 at1091x837, using the original URL with v6 and no box1 query, played box1 source e202c670, landed once at frame64 and reported1 dropped frame out of93 new video frames. DOM telemetry is persisted in game-runtime/box1/old-link-game-review.json. This proves the newer source is selected and handed off in gameplay; it does not approve shoe extraction or seamless motion. The test hand was finished through Stand. Public4173 and real-user database remain unchanged.

The source still lifts the card above the stack. Two scoped Kling video-edit attempts failed terminally without output or provider reason: b2c6c8c7 (completed-job video reference), then4399b225 (byte-identical confirmed VIDEO upload). Both full-media preflights accepted8credits; no charge/refund claim. Do not retry these jobs or claim visual rejection. Sanitized receipts and failure boundary are in next-source-investigation/KLING-FINAL-BOUNDARY.md. Seedance2.5 video_edit job3f9e0fb1-cc43-4a49-9299-565461877df5 completed (quoted36.37credits,1080p/high/silent) but root and motion_review both rejected it: native9–14 still lifts the card up from the stack, without the requested low front-mouth extraction. Output SHA9277c30ca340e468cb5c873e79d8455e95fb6720ce6788ad51d2dab8bcb5fe8c is staged, never promoted. Exact request is in next-source-investigation/seedance-edit-submission.json. This job is terminal; do not poll or duplicate. Next approach needs an explicit corrected contact anchor rather than another prompt-only video edit. The existing return bridge also fails a matched-pose check; game-runtime/box1/return-bridge-review.md and comparison image document visible head/hand differences. All seven seats and complete-round visual acceptance remain unfinished.

## Newly generated box1 source reaches actual gameplay — 2026-09-14

The new box1 source9dc93653 (SHA ac46fe3283544d40a7d80c6d9f7f1592fe4d9c566887a8abc73f250734419e0b) is now wired to the FIRST card of the second seat from the left in isolated4190, using `astridBox1=review` alongside existing box0 opts. It is a separate filmed reach, not a translated box0 actor. Source-specific97-frame trajectory, person masks, disconnected-background cleanup and hand/paper RG masks live in box1-trial-spec/card-pose-fit. Original RGB is streamed directly into a1.04MB three-tile grayscale-mask atlas; crop462,68,924,750. All97 native samples remain at60fps, giving2.5x the original cadence with no invented interpolation.

Root built game-runtime/box1/{build-media.py,build-ledger.mjs,sync-runtime.py}. The observed release plane needs a0.963-native-pixel-per-corner affine approximation about its unchanged centre for a2D DOM card. Source release63 is rendered independently; DOM handoff64 follows16.7ms later. Current1091x837 card calibration translates only the card by2.737 native pixels; actor/shoe are unchanged. Final corner residual≤0.000022native pixels. Runtime validates separate source and encoded-output hashes. The existing adapter now accepts exact registered box0/box1, rejecting cross-seat binding and stripping hidden rank/suit.

Actual game first successful box1 round dealt server-issued K-spades, completed one handoff and reported1 dropped frame. A second run dealt9-spades (tableVersion34/shoeDraw61), completed one handoff, and captured native0/9/12/18/30/63/64/96. Diagnostic readback plus whole-scene screenshots incurred26drops and missed capture40, so this run is not smoothness evidence. Root saw the new filmed two-hand transfer and empty return beside the unchanged shoe in full-game screenshots. Actor/card-only captures and receipts are under game-runtime/box1/actual-captures; first result is actual-game-review.json. Idle-engine submitted/presented counters stayed unchanged under the lease and resumed once.

Still NOT visual completion: early9–13 corners remain partly inferred, native9 shoe clipping/source fragments remain, native18 has source-paper boundary residue, shoulder/background bleed remains, and speech/idle/legacy handoffs jump. Independent source9/12 review also shows the card being lifted above the white stack rather than demonstrably extracted through the black front mouth. Do not hide exposed paper with a static shoe mask and claim that repairs the missing physical action. Only two first-card paths are new; subsequent fan cards and other five seats still use legacy motion. No seven-seat or full-round realism approval. Public4173/database and other dealers unchanged. An initial box1 attempt failed because runtime files had not been synced; sync-runtime.py corrected it before the two successful rounds.

## Newer left-seat masks in actual gameplay — 2026-09-14

The same user tab111 at1091x837 now runs `astridVariant=v6` on the isolated4190 opt-in route. This uses v6 mask corrections over v5, v5 source-matched card geometry and measured front-card tint. The card's local DOM basis matches the filmed release while retaining the seat/card center; actor and shoe are not dragged. The89-frame derivative has explicit source/mask hashes; lossy encoding remains documented. First actual round (4-hearts, tableVersion20/shoeDraw36) passed the target guard with0.00356 native-pixel residual, completed one handoff and reported1 dropped frame. That result predates engine suspension and must not be attributed to it.

A second v6 gameplay run with direct canvas captures also reported1 drop and one handoff. The isolated idle-engine lease held submitted804/presented778/decoded804 unchanged throughout the candidate and released exactly once. Public engine is unchanged; install-engine-suspension.py atomically creates the isolated copy, retaining one feeder/presenter instead of unsafe stop/start. Focused tests cover pending-fetch completion, nested leases and resume without catch-up. Evidence: single-seat/v6-game-browser-review.json and v6-actual-viewport-captures/receipt.json. Root viewed frames16/40/67: much of the old shoe debris is removed and the moving card has the newer size/tint, but shoulder background strips, residual source-card ink and release-edge artifacts remain. Captures exclude room/table/landed DOM card, so they do not prove seamless whole-scene motion.

Only the first leftmost card uses this new path. Other deliveries remain legacy and box1's newly generated full take is still being fitted, not wired. This is concrete gameplay progress, not completed realistic seven-seat delivery.

## Actual viewport left-seat integration — 2026-09-14

The user's actual Astrid tab111 at1091x837 rejected the new clip because fixed CSS card-hand dimensions did not follow the uniformly scaled table/film. Tests made in a newly created1280x720 tab had missed this. The isolated4190 installer now scales the local card hand about the unchanged seat anchor, leaving actor and shoe registration unchanged. Corner errors fell from3.5–7.2 native pixels to0.0035; a documented0.02-native-pixel rounding allowance replaces the impractical0.001 guard. Larger target mismatch still fails.

Two actual1091x837 gameplay rounds now completed the candidate with exactly one authoritative DOM handoff at frame67. Ownership telemetry confirms the new actor canvas visible and legacy actor hidden during that clip. Evidence: single-seat/responsive-game-browser-review.json and actual-viewport-captures/receipt.json. The second run captured actor/card canvases0/16/40/67/88 directly after GPU paint; these exclude the room/table/landed DOM card and are not full-scene motion acceptance. Root inspected them and found shoulder background strips, shoe debris and remaining contact artifacts. First run dropped19 frames; diagnostic capture run dropped31, so smoothness is not accepted.

Scope remains opt-in Astrid box0 FIRST card, using the existing v2 derivative. Subsequent deliveries still use legacy motion; the second fan card differs by up to66 native pixels at its corners, so reusing the same contact pose would detach the hand. Newer v5 masks and the newly generated box1 source are not yet wired into this gameplay route. The user complaint is only partially repaired; no full delivery or all-seat acceptance. Public4173, real database and other dealers were not changed. Compact Swedish test text replaces raw engineering errors; detailed data remains in receipts.

Required pre-commit suites and four-dealer asset probe pass. Responsive geometry tests cover measured rounding and reject displacement above the bound. Persisted source/install script, not ignored runtime copies, owns this isolated integration.

## Grayscale alpha browser review — 2026-09-14

Box1 job9dc93653-625a-4074-ad0b-f1e8a8fed51e is now COMPLETED. Source download/visual inspection is underway in box1-trial-spec; do not poll or resubmit this terminaljob. Result URL is https://d8j0ntlcm91z4.cloudfront.net/user_3GJD3LKj4ESOwh24CTotdLe3Xp6/hf_20260914_093110_9dc93653-625a-4074-ad0b-f1e8a8fed51e.mp4 .

Opt-in isolated ?crop=gray uses cropped originalRGB and precomputed rear/front grayscale tiles. It avoids RG chroma mixing and division after decoding. Against originalPNG masks, combinedalpha meanabs error .000386 versus .002368 for the earlier lossyRG control; worsterror remains .2667, so no visualapproval. Sourcepipeline differs too, preventing attributing all improvement solely to tilelayout. Browser108 repeats reported6/7/12 drops and one authoritative4-diamonds landing each. Screenshot retains actor/card alignment; grip/shoulder artifacts remain. Evidence: single-seat/crop-gray-repeat-browser-review.json. No default/public promotion.

Required pre-commit suites,28 scoped checks and dealer-sync probe passed. Codec experiments now pause pending actualgame integration review; a neutral-background harness is not fullgameplay acceptance. Allseven physical placements and speech/idle/dealing continuity remain unfinished.

## Box1 native motion trial and codec controls — 2026-09-14

Submitted ONE Seedance2.0 std1080p4s silent high-bitrate box1 trial, job9dc93653-625a-4074-ad0b-f1e8a8fed51e. Start43039066 and new confirmed endpoint0dc1ddf8 preserve original actor/shoe/room; endpoint is original native0 plus one7-hearts at the actual second-seat CSS quad. Root inspected it. Exact request/result saved seven-targets/box1-trial-spec/submission.json; latest jobs_wait says waiting, not failed. Poll the samejob, do not restart. Four-second output must still demonstrate brisk pickup, supported placement, release and empty return; generation is not acceptance.

Lossless actor crop1072x1504 preserves all89 cropped decodedYUV frames exactly and reduces decodedarea61%, but browser repeats still dropped22/26/21 frames. High4:4:4Predictive profile may use a slower path; that is a hypothesis, not verified decoder telemetry. StandardHigh CRF14 crop is a separate lossy control with RG edge errors measured. No default/public promotion. Further experiment separates precomputed rear/front grayscale masks to avoid chroma mixing and postdecode division amplification.

V6 conservative masks restore180 skin pixels and remove99 confirmed sourcepaperG pixels. A source-profile card-only blur proposal improves18–19 while retaining thin core geometry; actorRGB unchanged. These are still unapproved and need independent renderer integration plus moving hand review.

## Independent card lighting and repeat preparation comparison — 2026-09-14

V5 is now available separately at staging4189/full-cycle?candidate=v5. The independent GPU card accepts linear light tint from source-paper measurements; actor RGB is unchanged and card backs remain untinted. The89-frame packed version retains final sequence105. Browser105 reached88 with the expected independent2-spades, but reported53 dropped frames under heavy system load. Shoulder fringe and hand boundary debris remain visible; this is a failed smoothness/visual review, not gameplay delivery.

Foreground original preparation dropped2/7/15 frames across three same-card plays. Optional reload preparation dropped38/4/23 with preparation taking10.0/.97/4.08seconds, so reload is not an accepted fix. Explicit counters explain85 versus89: four frames were decoded before the playback baseline, not missing from the asset. Evidence is under single-seat/{foreground,reload}-repeat-browser-review.json. A pixel-preserving crop experiment is being evaluated to reduce packed decoding workload without lowering actor resolution.

Seven-seat evidence rules out static whole-actor fitting for boxes2–4: exact landing introduces18–37px shoe errors. Existing motion therefore cannot be promoted through actor dragging. Different articulated placement segments are required. Reports live in seven-targets/coverage-inventory/. No generation submitted in this pass. Required pre-commit checks and dealer-sync probe passed; full goal remains incomplete.

## Authoritative single-card playback and source-mask repairs — 2026-09-14

The isolated 4190 harness now binds the real server-issued 4♦ (tableVersion 1, shoeDraw 2) to the immutable reviewed box0 motion slot. Visible and hidden-face browser plays each recorded exactly one landing; playback completion does not mean the server round settled. Repeated Play reuses the same issued card and does not start another round. Source lives in motion-transfer/game-runtime/single-seat/harness with sync-harness.py; ignored runtime copies are not the source of truth. Public4173 and its database remain unchanged.

Independent packed actor playback uses89 explicitly mapped60fps frames, retaining the final ready pose. Correct foreground composition clamps G to R and uses rear=(R-G)/(1-G), avoiding double actor opacity. V4 source-based masks shorten the erroneous edge-on bar, restore observed finger skin and remove much shoe debris. A separate finger14 patch restores45 interior pixels. Grip boundaries, shoulder fringe, card illumination and release geometry still require visual review. None of these candidates is visually approved.

Correction: visible paper area does not establish physical card growth; occlusion and tilt must be considered. Independent continuation14–20 straight-edge fits give a photographed card basis within roughly2–3px practical uncertainty. Preserve seat centers while evaluating that photographed basis; old CSS skew is not an immutable realism requirement. Other-seat perspective and actual reaches remain unverified.

Fresh same-card browser measurements in single-seat/cold-warm-browser-review.json: first run89 reported video frames/0 drops and all89 callback indices; repeat85 reported frames/24 drops and64 callback indices. Both land once. Drops span the motion, so cold startup alone does not explain the failure. Paint timings and callbacks do not prove physical display completion. Repeat-play investigation remains active.

The26 binding/adapter/harness tests, required pre-commit suites and four-dealer asset probe passed. Full game-camera integration, allseven physical reaches, seamless speech/idle handoffs and complete rendered rounds remain unfinished. No new generation spend in this checkpoint.

## Shorter full-cycle timing and seven-seat references — 2026-09-14

Independent review supports testing original66→continuation0 without the30-frame stationary hold67–96. This removes1.25native seconds while preserving the preceding reach. Source-footage cut66 pacing variants are rendered in cadence-comparison/far-left-timing/:2.5x is1.77s total/1.17s pickup-to-release;3x is1.47s/.97s. Both are60fps1280x720 diagnostics, not clean contact or live gameplay approval. Ordinary temporal resampling is permitted; the prior2.5x ceiling only applied to optional retention of every original sample. Current neutral53-frame cut diagnostic avoids reconstructed-background artifacts; early source-paper/finger-edge masks remain unfinished.

The endpoint scene renderer now selects any of the seven real seat quads from isolated-game-targets.json (querybox0–6). Browser98 rendered allseven and recorded0 changed pixels outside each independent card bounding box;6,467–6,510 card pixels changed. Evidence: compositor-viewer/seven-seat-reference-browser.json. This prepares exact game-art endpoint references while retaining original browser-decoded actor/room pixels. It does not prove Astrid physically reaches those positions; source-camera inverse uncertainty is retained in every receipt.

Staging game-runtime/single-seat/adapter.mjs binds an issued authoritative card to an explicitbox0 ledger and renderer, strips hidden-card identity, serializes presentation, delivers landing once after render acknowledgement, and falls back on cancellation/resize/failure without inventing motion. Six lifecycle tests pass. No real ledger was falsely marked reviewed and no public player import was added. Fullclean pickup→release→return candidate and allsevenseat motions still required.

## Fractional source-frame shoe-mask fix — 2026-09-14

Independent rendered phase85/86/87 review found the shoe mask erroneously required integer nativeFrame. The60fps ledger contains fractional source positions, so52 active extraction rows lost the mask and exposed a broad card at the shoe. Changed only the staging shoe-mask contract to accept finite source positions inside the same calibrated windows. Two new tests cover all fractional windows, boundaries, invalid clocks, inactive cards and unsupported IDs. Fresh Chrome rendered QA confirms the broad exposure pop is gone across actor86/card85–87. Required110 tests, two new fractional-mask tests and dealer-sync probe pass; no global actor/card timing offset and no public player change.

Timing review against the cached real dealer finds0.80–0.87s extraction-to-release versus4.17s in original+continuation footage. The long original64–96 contact hold is now being assessed for an earlier compatible cut. A60fps export alone does not create overlapping next-card motion. Full continuation0–39 actor/card draft exists with a single uniform transform and hard cuts; initial rendering has residual paper and a static plate seam, with cleanup underway. Full seven-seat gameplay remains unfinished.

## Far-left release and return join review — 2026-09-14

Continuation native14 is the first independently verified clear release; empty return reaches its own ready pose around37–39. Full100-pair search against original0–9 found39→0 closest pose but37→0 smoother low-speed direction. No seamless cut is established. Motion review is building actor-only composite with a single uniform registration; early paper fragments0–4 still require cleanup without removing skin.

Staging `/return-join?registered=1` compares native24fps return24–37 against original0–8. `end=39` enables the alternative cut. The boundary now holds through its intended native duration instead of cutting immediately in its callback. Saved browser receipt `return-join-held-browser.json` records43.0ms from frame37 expected display to handoff, with every requested callback25–37 and1–8 present. Explicitly drawn start frames24/0 are separate. This is an actor crop diagnostic, not full card or gameplay continuity proof.

The dealer-sync probe and all110 required pre-commit tests passed for this staging change.

The actual gamecard layout uses affine CSS rotate/skew/scaleY without perspective. Constant card quad plus screen translation is valid in that game-art plane;63×88 is a logical rectangle and must not be described as measured physical dimensions. The generated source paper growth remains rejected. All-seven-seat source motion and authoritative live integration remain unfinished; public4173 is unchanged.

## Release continuation completed; review underway — 2026-09-14

Job2825e599-2346-478b-bb7f-12ca5aa518bc completed. Original97native24fps1920x1080silent frames saved intact to far-left-anchor/motion/release-continuation/source.mp4 with native-receipt.json (hash/PTS/sourceURL). Root inspected dense0–31 hand/table frames and fullscene every8thframe: apparentrelease13–15, emptyreturn31–40, thenunwantedarms-crossedchestpose48+. Sourcepaper footprint/printchanges0–6 needrigidcardphysical review. No acceptance; choose a usable earlyreturn only after contact/registration/target measurements. QA and motionagents assigned independent review and source96→new0 / earlyready→ownsource0 joins. No paidjob remains pending.

Endpoint scene/phase-review staging code syntax and110requiredtests plusassetchecks pass. Exactscenereference changed0pixels outsidecardbounds relative browser source decode; separateFFmpegPNG comparison is not byteidentical (QAactorROI MAE1.304), so preserve that boundary. No publicgameplay change.

## Far-left release continuation submitted — 2026-09-14

Source96 still touches the card at center449.22,664.25; actualbox0 is434.77,693.12. Required finishing motion is approximately14.45px left/28.87px down plus supported table-flat rotation, visible release and empty return to this take's OWN native0 pose. Exact source refs/spec are in far-left-anchor/motion/regrip-assessment/full-source-extension/release-plan/.

Two GPT Image endpoint stills failed target placement (v1 measured30.49px center error); retained unapproved in motion/release-continuation/. Root instead rendered original native0 plus independent gamecard at exactbox0 through repo-native far-left-endpoint.html/.mjs. Browser93 exported1920x1080 ready-scene-exact.png;0 changed pixels outside card bounds,6508 inside. This preserves actor pixels in the browser source domain. Upload usesquality92WebP; startingPNG fromremote same sourceframe96 differs from localffmpeg by RGBMAE0.6901,max2. Both actual upload bytes preserved, not claimedlossless matching.

ONE paid Seedance2.0 std1080p4s silent continuation submitted:2825e599-2346-478b-bb7f-12ca5aa518bc. Params/fullprompt/uploadIDs/PUT200/confirmation in release-continuation/submission.json. Latestjobs_wait confirmed in_progress; no output or acceptance yet. Poll this samejob; do not restart from a timeout. It requests finishingplacement0–0.25s, release, emptyreturn~1.1s andgentlebreathing. Generationalone is not delivery.

Staging4189 exec60882 adds endpoint scene and native-phase-review routes. The phase comparison UI is prepared but root has not yet inspected its static85/86/87 comparison; it does not measure moving presentation. Public4173gameplay unchanged. Fullseven-seat motion/integration remainsunfinished. Nativefullsource plane fit still ambiguous17→18 and55→56; agents recommend material/edge continuity and sharedfeltplane depth ratherthan attractive isolated low-RMS poses.

## Guarded card-clock checkpoint — 2026-09-14

The optional staging display clock now holds stale rear anchors and records potentially visible front-layer stalls. Threshold is bounded50–100ms, derived from3 median RAF intervals with a3-source-frame minimum. Independent review confirmed the unlimited extrapolation issue is fixed; front freshness still does not prove media-time alignment.

Guarded browser run painted348 frame indices (missing1), recovered32 rear-callback gaps, and reported1 video drop per layer. Consecutive run painted347 (missing5/86), rear1/front2 drops. These are improvements, not smoothness acceptance. Receipts and reproducible analysis live beside native-layers.mjs; NATIVE-LAYER-REVIEW.md records the exact scope and remaining limits. The opaque control now has max/absolute measurements of zero at sampled pixels; native-alpha residual still persists.

All110 required tests plus asset checks passed after the clock implementation, before the final threshold floor; syntax/arithmetic checks cover that floor and commit hooks run again. No public gameplay/media promotion.

## First independent card-clock browser trial — 2026-09-14

Opt-in staging `native-layers?full=1&codec=709&cardClock=display` painted all 349 sampled frame indices after initial frame0. Rear callbacks covered325 indices;24 missed callback indices received card updates from the independent display sampler. Both native layers reported one dropped frame. Evidence: `native-layers-display-clock-browser.json` and reproducible `analyze-display-clock.py` output beside it.

This is frame-submission coverage, not visual synchronization approval. Same-frame GPU submission often ends near or just after the video expected-display timestamp; actual presentation phase needs rendered evidence. Independent review also found unbounded stale-anchor extrapolation and unguarded front-only stalls; a bounded diagnostic guard is in progress. Public gameplay is unchanged.

## Display-clock investigation — 2026-09-14

The full native-layer warm run reported zero video drops but missed 16 changing-card frames in rear video callbacks. The current card painter depends on those callbacks, so it can lag behind otherwise continuous actor video. An opt-in display-clock experiment is being implemented in the staging viewer; no public player or media promotion.

Correction to the opaque-control interpretation below: the stored measurements are signed means. Zero mean error does not establish pixel-exact equality; absolute/max errors were not recorded for that control. The native-alpha blue residual remains documented and no global colour correction is justified by the aggregate measurements.

Required pre-commit checks (110 tests plus asset-state checks) and the dealer-sync probe passed before the display-clock experiment. These checks do not establish visual acceptance. Far-left source still lacks a demonstrated release and empty-hand return; all-seven-seat gameplay remains unfinished.

## Full native350 and opaque control — 2026-09-14

Browser87 full native350BT709 reached correctempty-handreturn/fourindependentprops (rootvisuallyinspected endpoint). First nativequality2drops each, callback344front343rear; repeat0drops each butcallbacks320front325rear. Do not equatezero reportednativedrops withcardGPUupdates everyframe. Bothreceipts native-layers-full709{,-warm}-browser.json. Agentaskedtoanalyze presentation/cardclock distinction. No publicpromotion.

Browser88 control compares SAME pixelcoordinates: opaqueVP9BT709 decodedRGBmeanDelta exactly[0,0,0] vsoriginalH264 atbothalpha255/251–254sampledomains. NativealphaVP9 stillblue+1.55atopaquehandpixels,+2.01nearopaque. Therefore remainingdifferenceisnativealpha-specificconversionpath, notsourceYUV orpureunpremultiplication alone. native-layers-709-opaque-control-browser.json saved. No colourpatchapplied. Server4189 nowexec92422.

CardagentexpandedG-onlypalmlayeringrepair through25–35 withnative11frameUNAPPROVEDdiagnostic; sourceRGB/Rhandsunchanged. Entry/exitmaxcornersteps6.97/12.19px plusrotation3.43/11.15deg measured, no sourceframeskip. Finalcontactandjoins24/36/fulltake stillunproven. Seven-seatgameplay remainsunfinished.

## Controlled browser colour metadata comparison — 2026-09-14

Browser85 codec709 versus sourceH264 at midpointframes174/204/233 reduces frontmeanRGB delta from~[-5.3,-4,+2] to~[-.09,+.08,+2]; rearred/greenmeans~[-.08,+.03]. Browser86 codec601 reproduces originalunknownvariantshift. Exactreceipts native-layers-{709,601}-colour-browser.json. BT709 is bestcalibrationcandidate, NOTproofsourceoriginaltagswereknown or byteexactbrowserRGB. Blue~+2front persists; contactagentinformed. No RGBsourceorpublicassetmodified. Server4189 nowexec60106.

Cardrigid-proof26-34/alpha-proof/diagnostic-native24-v2.mp4 is9framesnative24,0.375s,labelledUNAPPROVED. UpdatedQA contours, fixed63x88 geometry; actualroundedcardalpha255 at16 nominatedpaper/palmboundarysamples26–33, so those specificpixels don'tneed inventedpalm. Fullcontour/temporalacceptance stillunproven.

## Profile0 timing and browser colour issue — 2026-09-14

Root browser82 native-layers?codec=420 first59callbacks1–59 perlayer,0drops; repeatrear58/front56callbacks,1drop each. Bothmissingframe4; frontcallbacksalso1/9missing. CommonframeexpectedDisplayTime exactlyequal. Receipts native-layers-420{,-warm}-browser.json. Better thanGBR trial, not completeframe-lock acceptance.

Root added Compare source pixels control: canvas originalpackedtopRGB versus nativealpha>=251 at local0/30/59. Midpointseeks remove source/container frameboundary ambiguity. Browser84 matched result persists frontRGBmeanDelta about[-5.3,-4,+2],rear[-1.5,-1.2,+.5]; systematiccolourinterpretation mismatch despite localYUVbyteequality. Preserve native-layers-420-midpoint-colour-browser.json. Contact agent preparing matrix-onlyBT709/BT601 copyvariants with unchangedYUV/A to isolatebrowsercalibration. Sourcecolourtagsunknown, not reconstructedfact. Full350Profile0layersencoded/verified butUNPROMOTEDpendingcolour/syncQA.

Rootserver4189 exec65417. Cardagent rendered9frame0.375s labelledUNAPPROVED native24diagnostic, thenapplied independentQA thumb/papercontours. Refittingcoverage ratherthanerasing actualpalm; no temporalapproval. Seven-seatgameplayremainsunintegrated.

## Native transparent excerpt browser result — 2026-09-14

Root added alpha-probe.html and native-layers.html/.mjs staging viewers; packedGPU supports explicit actor:false to render independent cards only, preserving default actor rendering. Server4189 currentlyexec30568. Browser80 successfully decoded synthetic420 andexperimentalGBR alpha. Browser81 real60frame1280x720 rear/frontGBRlossless excerpt174–233 visibly composites with cards. First run57callbacks perlayer (frames1–59, rear missing45/47, front2/30),1reported drop each; commonframeexpectedDisplayTime identical. Repeat34rear/47frontcallbacks,24/6drops. Hence no smooth/frame-lock acceptance. Receipts native-layers-browser.json and native-layers-warm-browser.json. Both nativeassets verified byteexactRGBA locally; that is not browserperformance proof.

Contact agent now testing source-YUV-preserving VP9profile0 lossless420 rather than RGB→420 conversion: copy originaltopYUV planes, attach quantizedcomputedalpha, preservecolourtags. This may avoid second chromasubsampling error while testing more efficientdecode. No defaultswitch.

Removed only97 verified reproducible colour-adjusted PNGs under luminance-trial/frames (174557353bytes); cleanuphashmanifest saved, originals/bothpacks/scripts/receipts preserved. Later headroom verified12.4GB byagent; no causal attribution. Sourcevideo untouched.

Motion agent refining paper/skinclassification31–34 and constantdepthtrajectory26–34; rejects inferred268mmdepthjump at30→31 as cardgrowth. Seven-position motion andgameplayremain unfinished.

## Video presentation isolation and card proof — 2026-09-14

Root instrumented camera60 expectedDisplayTime/presentationTime/deadlineSlackMs and optional presentation diagnostics, defaults unchanged. Browser76 direct visible video350 callbacks/0drops; browser77 identical GPU+directvideo350/0 (video rect y689.43,height432,viewport720, ~31px visible). Hidden decode-only323callbacks/345reported drops is NOT visualdelivery proof. Tiny1px opacity.001337callbacks/0drops; fullviewportopacity.001257callbacks/1drop. No invisible backing fix accepted. All JSONs named mixed5-{decode,direct-video,gpu-presented,tiny-surface,large-surface}-browser.json. Exactnative resolution/frames retained. Contact agent investigating native transparentvideo-layer feasibility, no default/media changes.

Root inspected rigid-proof31-34/dense-proof.png: actualcard geometry has continuousorientation, but retained sourcepaper currently contaminates foreground masks31/32. Agent tracing true hand outlines and classifying PminusQ as felt/skin/unknown rather than treating any outsidepaper as infeasible. Receiving hand may have a realreleasegap during regrip; don't force simultaneoustwohandcontact everyframe.

Luminance trial endpoint096 visually inspected: skin/suit improve but blouse/forehead can darken excessively. Bounds analysis suggests milder common scalar but no new colourapproved. Seven-seat gameplay/complete motion still pending.

## Residual transition, reference v2 and prewarm experiment — 2026-09-14

Staging4189 exec15270; browser73 bridge-review?edge=2 uses residual-clean R-only pack. Root inspected native0 and recorded full31/97/145 actual frames without recoveredfinal in bridge-residual-browser.json. Small fringes remain; colourtrial separately pending.

Built-in image_gen second primary-only edit saved far-left-anchor/motion/regrip-assessment/image-repair/native33-reference-candidate-v2.png and PROMPT-v2.md. Independent review reports index shift~5.4px versusv1~20.6px, but other fingertips shift7–9px. Surface reference only. Motion agent now checks whether candidate cardplane covers duplicatedpaper while ORIGINAL visible fingers remain foreground, possibly avoiding inferredpalm repair. Temporal coverage/contact unproven.

Optional prewarm=1 camera60 experiment prepares four card meshes/fronttextures beforeplay, without changing frames/quality. Browser74 mixed5 result324observed/26drops vs earlier338/12. No improvement demonstrated; keep experimental, not default. mixed5-prewarm-browser.json preserved. Contact agent analyzing traces; do not attribute stalls to decoder or backgroundprocess without evidence.

## Far-left reference repair and mixed contour browser review — 2026-09-14

Built-in image_gen created `far-left-anchor/motion/regrip-assessment/image-repair/native33-reference-candidate.png` from native33 plus32/34/35/25; exact prompt/receipt saved alongside. It is NOT a drop-in replacement: independent registration found receiving index moved about20.6px. One-card/palm reference only. Previous holding proxy1084,555 was ambiguous paper/palm rather than a reliable thumb contact; agent is separating visible skin landmarks from actual contact points and rerunning hypotheses. Do not claim anatomical impossibility from that proxy's fit residual.

Root restarted staging4189 exec5432 and browser72 loaded camera60?joined=1&variant=720&output=720&contour=mixed5. Thirdgrip193 visually improved source-lettering/shoe-contour contamination. Full350 playback reachedreturn30 with338 observed and12 dropped frames; `compositor-viewer/mixed5-browser.json` preserves evidence. This is not stable60fps acceptance. Contact agent completed all350 decode/ledger audit separately. Seven-seat gameplay remains unintegrated.

## Cleaned bridge browser check — 2026-09-14

Root resumed staging4189 exec46442 and opened bridge-review?edge=1 (browser71). The new R-only edge-clean pack visibly removes the broad shoulder blob and most fingertip shoe remnant atnative0; screenshot compositor-viewer/bridge-clean-start.png. Full return→bridge→moving-idle run observed31/97/145 actual frames, no recovered final, measured handoffs0.7/0.5ms. Maximum inter-frame intervals65.4/68.3/67.5ms, so this is not stable60fps proof. Receipt bridge-clean-browser.json preserves wall-clock observations.

Root added optional edge=1 route without changing original pack or public game. Remaining collar15–29/early fingertip border and matched skin colour continuity assigned to gameplay_qa; motion_review resumed after remote compaction connection failure to finish far-left repair specification; contact_integration resumed confirmed metal-edge mask correction. Goal remains allseven actual positions and authoritative gameplay, not this four-card transition review.

## Astrid original moving idle added to seam review — 2026-09-14

Root packed all145 original24fps idle frames with the actual indexed hand-repair alpha and exact uniform runtime registration, using `idle-registration/bridge-pair/pack-original-idle.py`. Sources and output hashes are in `original-idle-moving-packed.json`; no generated actor pixels or audio changes. The seam viewer now plays return0–30 → bridge0–96 → original idle0–144. Browser69 receipt `compositor-viewer/bridge-moving-idle-browser.json` observed all31/97/145 frames with no recovered final frame; original idle first-frame opaque RGB MAE1.52/255 against the registered reference. This is playback evidence, not proof of seamless visual acceptance or gameplay integration. Staging server4189 currently exec83163.

Root inspected contact mixed-v3 dense74–81: shoe blocks reduced, remaining wrist lettering and feeding fingertip wedge require work. Far-left continuous card geometry alone fits both hands, but covering source paper over unknown palm pushes frame33 thumb residual10.62px beyond8px uncertainty. Agent is checking alternative physically continuous interval; no salvage acceptance.

## Astrid continuous return/idle review — 2026-09-14

Root added `content/staging/2026-09-13/shoe-pickup/low-turn/compositor-viewer/bridge-review.html` and `.mjs`, with full original return registration composed into bridge start and a smooth whole-actor similarity to original idle. Browser evidence `bridge-continuous-browser.json` records all31 return frames and all97 bridge frames, no recovered final frames. The sequence finishes on an explicitly static original-idle reference, not a full idle loop or integrated gameplay.

Root endpoint screenshots confirm close placement but expose a pale viewer-left shoulder blob and shoe remnant beneath viewer-right fingers at bridge0. Gameplay QA is correcting those masks; they are not visually accepted. Contact agent's conservative temporal-background exact-v1 removes14927 confirmed background R pixels while preserving G/RGB, but does not solve remaining mixed hand-adjacent glyphs. No pack promoted. Motion agent is testing a single constant-size card against the already-generated far-left take; temporal orientation and skin occlusion remain unresolved. Public gameplay unchanged. Seven-seat delivery remains incomplete.

# Current: shared 60 fps draft and actual seven-seat calibration; visual acceptance pending

Bridge31828ef9 completed and root independently inspected whole-motion.jpg, face-motion.jpg and endpoint-identity.jpg.97native24frames1920x1080 sourceSHA8fcb7b93bdc5079f67ba13bcfde70d5703307b766422c383f726112256e6a02c. Coherent empty hand withdrawal9–18/crossedsettle21–30, later gentleposture/headmotion to96. Generated room differs (~7.6wholeframeMAE); actor-only candidate, no fullscene promotion. QA proceeding dense face/colour endpoint review and originalRGB actor masks, preserving all97 until valid shorter boundary proven. Root has not approved actual rendered seams or complete speechcontinuity. No duplicate bridge generation.

Latest authoritative jobs: silentbridge31828ef9-9a5b-4fbd-a56c-15a89be13816 in_progress; endpoints JPEGsha/HTTP200 verified, generation.json in bridge-pair. Narrow farleft edit9ebb57c1-43c8-4fff-8845-57b16e223d5a terminal provider nsfw with no URL/specificreason; no usable result and no retry/filter evasion. Motion agent now read-only inventory of existing matching-camera left sources. V5 joined master/720+actual-gamecard-v5-contact74-80.jpg complete, but native79–80 reintroduce glyphs and77.6–78 has paperarc. Contact agent investigating temporal background evidence to avoid endless isolated mask patches; no broad threshold approved. Fullgoal remains incomplete and otherwork can progress, no blocked audit condition claimed.

Current continuation: forward-extension cost preflight accepted but submission rejected end_image with422, NOjob/nocharge. Motion agent using authorized narrower2.542s video_edit guide with contact/rest generic image refs; verify actual job before polling/retry. Rest transport solved using13KB prop overlay onto exact remote source0, JPEGmeanerror~.97/255; reviewed samepose. Speech bridge JPEG95 uploads ongoing, not yet submitted per latest agent. Contact v5 masks remove source-confirmed thumbgap/78glyphs, joined piped render underway with dense73.6–80 proof. Disk3.1GiB free; no source deletion, avoid raw-frame duplication. Root independently verified all7 bridge input hashes in bridge-pair/root-input-verification.json.

Latest: root inspected idle-registration/bridge-pair/endpoint-comparison.jpg, accepted reference pair for one silent transition attempt. Start exact return0031/native30; end exact indexed idle0 RGB/hand-repair alpha at runtime uniform matrix, generated background fill only under outgoing old limbs. No duplicate limbs, old speech/audio untouched. GameplayQA authorized ONE MCP bridge start/end generation, inspect job receipt before any repeat. Root also inspected original0+actualbox0 rest-one-card.png, motion agent continues narrower extension/preflight. Sequence binding checkpoint now committed independently; source visual acceptance still pending.

Current root4189server10464. Contour-v3 joined720 is routed with `?joined=1&variant=720&output=720&contour=3`; root browser66 inspected full fourth release285 with clear separation/four retained props, screenshot contour-v3-release285.png. Viewer now fits whole canvas into viewport; older285 screenshot was cropped and insufficient. Third-grip193 still has left/lower lettering; contact agent working source-traced correction. Exact idle registration delivered idle-registration/: runtime s.4799973266,t[614.40192484,-45.27497709]. QA preparing true background-clean end anchor to avoid double limbs; native return30 is0031.png. Motion agent approved for one narrower forward-extension preflight of exact0–24 plus concrete one-card idle endpoint, fallback retimed61-frame guide edit only if capability supports; check live agent/receipt before submitting. No paid job currently claimed active by root.

Latest continuation: root reopened isolated4190 as tab64, recovered prior seven-seat round at active4, stood remaining five hands through UI, and verified settlement:35 staked/25 returned/balance990/net-10, back to bets. game-runtime/baseline-settlement.json is old-game recovery/settlement evidence ONLY, not joined source gameplay. User4173 unchanged. Root reviewed contour-v3/review-77.jpg: full source-traced removal of gold glyphs improves hand edge; ambiguous fingertip/paper mixed pixels remain. Agent preparing separate joined contour revision. Video-edit job6cfa7ffb-9f6d-4419-bf55-c9529d548ac8 completed, downloaded and under source-preservation review; no usability verdict yet. Source-matched speech calibration agent running. Checkpointb61d438 saved root renderer/performance evidence; sequence adapter and newer agent artifacts still pending scoped commit.

Latest: joined350-frame candidate now browser-tested at `/camera60?joined=1&variant=720&output=720`:349 unique callbacks,1 decoder drop, reaches emptyhands return30 with four persistent props. camera60-joined-browser.json + camera60-joined-receipt.json bind current media/ledger/renderer hashes. Exact return similarity baked, never apply twice. Fourth card rests on felt before finger release; original RGB0–8 proves clear separation atreturn5 (output285), not Ggate6. Contact agent revisiting native75–77 remaining mask artifacts. Root removed redundant first-card texture reset before per-card selection; no proven performance attribution. Rootserver4189session7199.

Isolated sequence-binding.mjs now accepts exact seat/target and immutable server-visible records, strips hidden rank, rejects missing/duplicate deliveries, and tracks independent contact/release/land events. Nine tests + required audits passed byQA; no public imports. Actual seven-seat media still unavailable. Far-left39–60 isolated clip is also NOT joinable: incompatible entry and still-moving exit; motion agent evaluating supported video-edit capability before any evidence-based retry.

Continuation: foreground measured1920canvas24 dropped frames;720video alone45 cold/24 warm; matched1280x720canvas6 cold/12 warm. See compositor-viewer/PLAYBACK-PERFORMANCE.md and four browserJSONs. Improvement, not stable displayed60fps. Root stagingserver now51964. `/camera60?variant=720&output=720` uses repaired knuckle derivative and matchedcanvas. QA confirmed original skin restoration102–109 and separate detachedpaper cleanup48/49/99. Contact agent building a joined60 timeline cut109→return with fifth-draw skip108→110 prohibited. Motion jobf1d08e82-48d9-46a8-9521-7d396cdd9734 completed but fullclip rejected: changed ready pose, duplicatedpaper27–34, slowfarleft reach. Agent inspecting39–60 segment only, no regeneration. Integration map documents single-card/three-direction runtime limitations and wallet-collect wait; staged explicit-seat binding adapter underway, no public promotion.

Root staging server4189 now session8152, with /camera60 using cadence-full/ledger.json directly for actor and rigid cards. Exactly303 encoded frames at60fps, but actual hidden-browser run observed only169 unique callbacks; do not claim displayed60fps. camera60-browser.json records the result. Contact agent is preparing a separate repaired-mask master and1280x1440 delivery derivative. Full121source remains diagnostic: fifth-paper residue after109 means gameplay must use the four-card cutoff and repaired return.

Latest /camera-cycle?working=1 includes combined fourth/fifth paper R/G107–109 from camera-paper-all/manual-rg. G enabled0–39 and107–109. Browser57 reached139/139 without freezing but observed135 unique frames; camera-working-end-repaired-browser.json records this run, not full-frame acceptance. Prior140-frame capture predates this new pack.

QA traced native105 knuckle holes to base cleanup x>750 hand protection, not raw Vision or RGB. Separate genuine-pixel mask repair102–109 underway; original flow-rg remains immutable. Far-left GPT anchor cuff corrected and inspected at camera-review/seven-targets/far-left-anchor/contact-cuff-corrected-registered.png. Contact remains13px right/27px high, candidate before short final slide, not exact-target approval. Motion agent preparing ONE ready-to-contact4s MCP job; inspect its receipt before any further generation. No return can be claimed from that endpoint-constrained job.

Fresh isolated actualgame4190 session27843 uses game-runtime/runtime ownDB; allseven actual rendered targets saved in isolated-seven-rendered.json and seven-targets/isolated-game-targets.json. Shared4173 usergame unchanged. Isolated baseline round still decisions active4 after two stands; this is old gameplay, not new dealer integration. Allseven physical reaches, speech bridges, final masks and full rendered gameplay acceptance remain open. Goal/overnight heartbeat remain active.

# Previous: joined native sequence and first-delivery finger composite verified in browser

Root /camera-cycle?working=1 now plays source0–109 plus return1–30, all140selected frames recorded in camera-working-browser.json, with source/return/trajectory SHAs. Native24fps only; first40 G enabled from manual-v3, later G disabled pending cleanup. Source107–109 fifth-paper alpha removal is included. Return pack SHA33095ed0a21577d56365f4012db2953eac35358acf4ca4eb9c81f54190803a86 repairs actual missing suit alpha and fingertip paper0–3; RGB unchanged and no body warp. Earlier body-drag suspicion was mask loss. No uniform colour correction: measured patches disagree.

Current root4189server session21999. Browser53 /camera?contact=first40&mask=v3 inspected n20 grip/n27 faceup gameart and played all40frames; contact-v3-n20/n27.png and browserJSON saved. Manual-v3 pack SHAb0a698217061a976012c9d9a910d1ec128ae4fbce40f8c4a308a1a2e9f9f2dab. UpperR is byte-identical to edge-clean; root visual suspicion of reverted uppermask was disproved. Remaining body-edge fog/slivers are existing limitations, not restoration regression.

New camera-card-fit shoe-mask is wired to GPU card-alpha only using source native gates1:4–11,2:31–37,3:55–62,4:83–89. No old sourcecoords; no live3D calibration claim. Trajectories now begin4/31/55/83, preserve genuine duplicate source holds, retain constant physical dimensions and allfour landings. Rigid quaternion/translation resampling contract ready for60fps; actor is not yet resampled.

Agents active: gameplay_qa extending source-bound paper/G to cycles2–4 in camera-paper-all (unapproved, not yet packed); contact_integration supplies actualpaper/finger observations for those cycles; motion_review finishes exact speech/idle endpoint comparison then seven real game-target calibration. Existing speech crossed arms differ from new shoe-adjacent rest, direct cut rejected. Allpaidjobs terminal; no newgeneration. Fullseven positions, speechjoins,60fps and authoritative gameplay remain open. Goalactive; this turn is concrete progress, not completion.

# Current continuation: return completed; source hold fixes and shoulder playback verified

Return26f3a6e1-c6bf-4bfa-ae64-5dbb29cf2877 COMPLETED, preserved return-plan/return-source.mp4 (97native24fps). Root inspected release-dense.jpg: contact0–4, release5–6, emptyreturn6–23, settled24, no fifth draw; fourcards stay. Motion agent building native0–30Vision masks and seam registration. Alljobs terminal; do NOT regenerate this return.

Contact agent found source23/24 near-duplicate hold (handROI MAE.584), so earlier n24 proxy drift is fixed by identicaledgepose23/24 andfront25. Allfour trajectories continue refinement. Root added staging card-state.mjs: only caller-supplied deliveries render, faceDown overrides filmedfront, hiddenrank not senttoart. Threefocused tests pass; review still supplies nominatedfixtures, NOT server integration. Regional edgepack browser displayed0–120,zero reported drops; remaining leftnecksliver visible and logged. Currentserver4189session64449, rootownedhiddenQA50 latestmoduleloaded. gameplay_qa preparing sourcepaper/G; automatic21–28contours were wrong and rejected. Publicgame unchanged/fullgoalactive.

# Current: four-card paths, shoulder-fragment repair and one return job

All-four constant63×88 card trajectories now exist in camera-card-fit/trajectories.json, with shared inferred perspective and persistent landings36/60/87/110. Root /camera?fit=four played0–120 with no reported drops; camera-tracked-browser.json records tested trajectorySHA (later refinements differ). Source paper remains and G is forcedoff, so this is not hand-compositing or gameplay approval. Root dense review identified possible n24 grip separation; contact agent refining, and n99 orientation remains under review. Source-sized proxy mismatch13–15px is retained instead of scaling cards.

Shoulder noise traced to actual retained room/lamp pixels. Regional derivative r-edge-clean removes broad streaks, preserves crown and allnativey>300 alpha, protects observed warm ponytail pixels; small uncertain core-edge slivers retained. Packed derivative SHA c94f1e5572272de87cbd99a33396f360637d31409bb148a76002bcf879328fa7,121nativeframes verified. Optional /camera?edges=clean browser review in progress. Current4189 session17075. gameplay_qa now preparing observed paper/G cleanup; do not blindly use unreliable automatic paper contours21–28.

One Seedance return job26f3a6e1-c6bf-4bfa-ae64-5dbb29cf2877 submitted bymotion_review,1080std4s silent, exact cleaned registered start/end JPEGuploads with local/remoteSHAverified. Receipt camera-review/return-plan/video-receipt.json. Check this job before any new submission. No duplicate widget or public promotion. Root staging checkpoint83f7978 and source/reviewcheckpoint9dfd8d4 passed hooks; deepaudit passed. Goal and overnightheartbeat remain active.

# Current: new continuous actor browser playback and independent card meshes

The camera-stable source now has121 native RGB/R packed frames in camera-composite. Root staging /camera at4189 presented all0–120 in order with zero reported dropped frames (camera-browser.json). This is native24fps base actor only; source paper remains and G is unapproved/forcedzero because YUV420 zero-channel chroma bleed is not a finger mask. Four settled constant-size game-art meshes render independently, including actual assets/cardback.png. Shared camera/table fit RMS2.43px supports four landed poses; airborne trajectory and paper/finger cleanup remain under construction. No gameplay promotion or seven-seat acceptance.

Root compositor supports options.cards and explicit handMaskEnabled:false. /camera optionally consumes camera-card-fit/trajectories.json once ready. Browser evidence was captured before that optional trajectory existed, so proves actor playback and static four-card rendering only. Deep sync probe and repository precommit suite pass. Current staging server session2018 (route additions after launch require restart). Public player and server authority unchanged. Clean GPT Image return anchors are uniformly registered; start face/receiving-hand pose matches109 closely, endpoint is a new idle pose and cannot jump to native0. motion_review has one bounded MCP return generation assignment; check agent/receipt before any submission. Goal active.

# Current: camera-stable continuous actor candidate under integration preparation

Seedance582f2a76-162d-4e60-9d92-3f96d4fef822 COMPLETED; camera-locked.mp4 SHA c4e46c9cbde5383dacf87d22910a9a15eefb2c2b7e408785931795ac46d53664. All121native24fpsframes reviewed independently. Camera stays within~1px in sampledstaticbackgroundfits and four deliveries overlap feeding-hand preparation. Baked card identities change and are NOT usable. Crucial review correction: card silhouette narrows23–24 then broadens25+ (later47–48,74–75,97–98), so an authored rigid BACK-through22 / FRONT-after24 replacement can be tested. The earlier wording "no true turnover" conflated incorrect printed faces with the filmed wrist geometry; preserve this correction. Exact hidden corners remain unmeasured.

Source ends with a fifth partial draw; no clean four-card-rest endpoint or loop is approved. motion_review preparing exactfourthrelease/source0endpoint images andreturnplan, withoutgeneration. gameplay_qa running native121Visionmasks in motion-transfer/camera-mattes; contact_integration fits constant-size four-card trajectories in camera-card-fit. No newpaidjobpending; do notregenerate orredisplay finishedjobs. Existing early-source shader assets demonstrate card-only aperture shadow; suspected19skin pixels proved pinkpaper, soGmustnotbeexpanded. Publicgame unchanged, fullgoalactive.

# Current: camera-locked reference-driven source pending

Genjutsu d8214fb8-fef1-4810-a29e-70230d1baa20 completed and is preserved as low-turn/motion-transfer/source.mp4 (SHA83bf4d87a26d809c83ade82b334d5039ff65b8e60a9e0d433c715ce17c74070d),121native24fpsframes. Independent reviews confirm four shoe-origin deliveries and overlapping feeding hand, releases38–39/60–61/90–91/112–113, with a partial fifth draw by120. No clear extra or disappearing completed cards; fine rigidity remains uncertain under blur. It FAILS canonical camera/environment: transferred elevated reference view/backgrounddealer. Do not integrate or loop its populated final table to empty first frame.

One bounded Seedance2.0 test 582f2a76-162d-4e60-9d92-3f96d4fef822 is PENDING, using accepted ready as explicit start_image and same confirmed5s video only for two-hand choreography.1080p/highbitrate/5s/silent. Receipt low-turn/motion-transfer/camera-locked-request.json. Do not duplicate or redisplay either auto-widget. All older jobs terminal. Public game unchanged; source-only staged progress, goalactive.

# Current: direct continuous motion-transfer test pending

One new Genjutsu1080p job d8214fb8-fef1-4810-a29e-70230d1baa20 is PENDING. Do not duplicate or redisplay its single-job widget. It uses accepted Astrid ready image dd01ae2e and a confirmed native60fps5s clip from the user YouTube reference, seconds4–9, media deb07381. Receipt in low-turn/motion-transfer/request.json records full prompt and reference SHA. The upload was recreated in Higgsfield sandbox, HTTP200 confirmed,5s/300frames1280x720 verified and thumbnail inspected. Local lossless reference is a different encoding. No Google key used. This action is a motion-transfer source test, not model training or public integration.

Cadence review established the serial2x cycle is3.0167s, versus reference extraction-to-release0.80–0.87s with overlapping feeding hand. Raising fps alone does not fix that motion structure. The existing source/mask work remains useful staging; no additional speculative endpoint generation. Current continuous181frame60fps stream removes interclip decoder stalls: browser delivered0,2–180 (one startupframe missing). Four-frame decoder preroll retained the first movement frame but missed91/124/159 in its recorded run; not an all181-frame pass. Current root server session40397. Shared-flow v2 rejects duplicate-finger v1, uses jointly resampled RGB/R/G; small thumb-edge artifact remains. Native23–27 paper fragments were cleaned and packedagain. Early rigid-card fit now covers7–66 with source-specific shoe occlusion and19–25rejoin, pending fullcomposite review. Fullgoal active; public game unchanged.

# Current: restored pickup transition and assembled native cycle

The omitted pickup frames55–61 contain the real finger curl and recontact. Extending through66 fixes the previously misdiagnosed missing-motion seam without another generation. Recommended join is pickup66 to slide2; registered hand ROI difference falls from23.45 to7.64/255. Evidence is in low-turn/cycle-registration, including every candidate and the corrected BRIDGE-PLAN.md. Pickup masks/packed file now contain67 frames0–66, independently decoded and checked.

The staging GPU viewer at http://127.0.0.1:4189/cycle now assembles pickup7–66, slide2–54 and return5–36 with one uniform transform per actor clip, authored rigid card geometry and persistent landed game artwork. A real browser run displayed every selected frame in order (compositor-viewer/extended-playback.json); cycle-end-browser.png shows the empty return and retained card. This remains native24fps, nominated Q artwork, checkerboard staging—not authoritative gameplay, shoe alignment approval or seven-seat delivery. Early pickup7–12 geometry is still unresolved in this captured run; contact_integration is fitting the visible emergence instead of inventing hidden measurements. Fine mask fringes remain.

Fixed staging HTTP byte-range responses so seeking into return5 no longer restarts decoded motion from frame0. Initial/suffix/open-ended ranges and416 rejection were exercised. All three textures are warmed before playback; no clip-start shader stalls remained in the captured run. Root-owned staging server current session64614. No public gameplay/player changes. All Higgsfield jobs terminal; no duplicate paid bridge needed. Shared RGB/R/G flow resampling to60fps/2x is being reviewed separately in cycle60-draft. Full goal remains active.

# Latest full-cycle assembly progress

PackedGPU preview nowplays all55slideframes0–54 (frame0decodedpreroll;1–54presentedcallbacks), afterfixing CPUbottleneck andshaderstartupdelay. Evidence compositor-viewer/gpu-playback.json; server4189session49268. Actualgamecardartconstantgeometry remainsdraftcontact, no pubchange. Pickup55RGmasks completed inpickup-draft; rootpackedpickup55frames24fps1920x2160. Sourcecardposegeometry beingfit separately bycontact_integration inpickup-card, explicitobserved/inferredsplit.

Matchingreturn job7e2dae43-1200-4716-862e-d0721390d894 COMPLETED aslow-turn/return.mp4. Independentreview confirmsrelease n8, emptyhandreturn9–22, forwardreadysettle24–36; sourceKstaysvisibletotheend, so persistentgamecardandpaperremovalneeded. Suggested5–36nativeactorcut; endpoints differ~17–20pxhand/~10pxhead beforeuniformregistration. RawVision41returnmasks0–40 complete; gameplay_qa cleaningreturnRGinreturn-draft. motion_review estimatesstaticbackgrounduniformcycle-registration; no localactorwarp. Allgenerationterminal. Goalactive/fullscopeunchanged.

# Latest packed slide staging checkpoint

Cleaned55frame RG draft finished, SHA256.json andREADME in low-turn/composite-draft. Queenprint fragments, shoegost/tableletters/shoulderspeck removed; sleeveopacity restored. Finefingertipfringes and uncertainboundary remain. Root packed identicalnativeRGB/RG into compositor-viewer/slide-packed-draft.mp4:55frames24fps1920x2160, upperRGB/lowerRactorGhands, SHA/perframeinputreceipt adjacentJSON. No interpolation inthispackedasset. Need decodedpacked review and completepickup/release/return masks beforegameintegration. Browser fixed-sizegameart draft isat127.0.0.1:4189, session74313; capturebrowser34n54 saved beforefinalmaskrevision, so doNOTtreatthatscreenshotasfinalRGapproval. Allgenerationterminal, no newjobpending, goalactive.

# Actual fixed-card composite prototype

Root built low-turn/compositor-viewer/{server.mjs,index.html}, local4189 processsession74313. It imports actualgame card-art.mjs, draws constantparallelogram translatedbyunapproved fingertipcandidate, and splits actorR/fingerG aroundcard. No bodywarp orprop growth. Browser34 played0–54 androot inspectedinitial/final; browser-final.png preservesvisiblefinalcontact. This ischeckerboarddraft withnominatedQ, NOTserver-issuedgamehand orgameplayapproval. Rootcaught shoulderlampspeck/elbowghost; motion_review cleaningR/G in low-turn/composite-draft/ (nativezeroindexed slide-rg). RawVision194masks completeandasserted; rawframes/masksignoredbyGit. Agentremoving paperprintremnants atn7/n39 beforefinalreceipt. No newgenerationpending. Nextpack synchronizedRGB/R/G, verifycontacttrajectoryespeciallyfingeridentityswitchafter32, andtestactualgamecamera; fullgoal/allseven/speechjoins stillopen.

# Current source-to-game integration work — 14 September

All generation terminal. Newnearshoe slidefa57fdb7-ef02-4c4c-8ec8-ad33757dbac7 has supportedhandmotion but sourcecardarea grows3.74x; rejectfinishedrigidprop, preserveactor as candidate for measured contact plus authoritative fixed-size card. Newlandingplanar image36ade942-88c9-4f4f-95b0-02e97ddeabe4 is smaller but stillneedsmeasurement; returnend0dfeb1ca-1e1e-4afe-8d83-bfcb93d4541a hasdownwardgaze andoversizedcard, notloopapproved. No dependentreturnvideo submitted. NativeVision masks running via gameplay_qa in low-turn/mattes; contact_integration owns slide-contact observations. Motion-review .85s pickupturncadence completed with fullframeinspection, minorinterpolationedgeecho remains. Continue actualactor/propcomposite and pose/camera proof instead of blindpromptrepeat. Publicgameunchanged; goalactive.

# Current generation continuation

Low-turn source9a9d4020-eb1e-499d-8cdc-bcac7782a4be completed; dense reviewer found actual narrowing/edge/broadening n36–45 and no faceup re-lift. Source action still~2s; n7–54 targeted cadence preview being built by motion_review. New supportedslide fa57fdb7-ef02-4c4c-8ec8-ad33757dbac7 submitted from low post-turn to long-sleeve destination contact; pending, poll this exactjob. Current next integration gates: preserve new adjacent ready pose across empty return (old rest endpoint differs), precise paper/finger masks, currentcamera/shoe calibration and allseven physical reaches. No publicsource promotion.

# Compact turn correction — 14 September 2026

Previous goal turn made progress: committed source cycle/geometry evidence b0ed76b. The cycle failed pace and prolonged presentation, so it remains staged. Refined reference n283–335 shows a brief ~0.15s upright transfer is valid; excessive dwell and centre-body detour are the defects. New low post-turn anchor6aa9c335-7018-4e6e-aefa-b232cbf24099 and adjacent empty ready anchordd01ae2e-cfb1-40c1-9bb6-43e16fda47f1 completed and were visually inspected. New Seedance2.0 job9a9d4020-eb1e-499d-8cdc-bcac7782a4be COMPLETED and downloaded as low-turn/source.mp4; do not duplicate or redisplay its single-job widget. Root reviewed16samples; improved physical sequence but action~2s, dense native review pending. Receipts and local images: shoe-pickup/low-turn/.

Root captured actual game camera in isolated browser32 (astridcaptureqa with staged,smooth60,rehearsal), restored controls with Escape; no bets. Evidence: gameplay-qa/live-camera/. Actual outlet(781.133,349.731) at1280x720. Evaluate source placement using actual uniformRegistration's136px desktop control band, not whole-viewport contain-fit. Mapping report now uses actualruntime fit: approximate source mouth3pxleft/9pxabove modeloutlet; earlier70pxoffset was hypothetical naivecontain, NOT runtime. Source-card persistence diagnostic now keeps a frozen SOURCE Q placeholder through return and next extraction, original skin above; not server artwork or gameplay integration, early fingertip matte remains approximate. Current goal stays active.

# Overnight autonomous goal and agents — 13 September 2026

User explicitly requested continuous overnight work, agents, and GPT Image fallback. Active persistent goal created; existing 30-minute heartbeat updated in place (finish-astrid-gameplay-verification), no duplicate. Root owns generation/public integration. Agents own staging-only contact_integration diagnostics, motion_review frame evidence and gameplay_qa on isolated astridcontactnightqa.localhost. Avoid file/tab collisions.

All submitted shoe-pickup image/video jobs are now terminal. Do not duplicate pending work from older notes. Split extract-turn/slide-return failed frame review. The subsequent held-slide keeps fingertip contact to landing; empty-return separates the empty hand, but the source card drifts 5–7 pixels relative to the background and its artwork changes K to Q. Their direct seam is near identical (0.99/255 RGB difference), requiring no body warp. The edge-controlled pair extract-edge / edge-face provides an observed narrow/broaden rotation with fingers attached (native n50–64 and n43–48), but still contains excessive upright holds and lifts. These are conditional source improvements, not approved gameplay.

Agents completed cycle-preview/cycle-pace60.mp4 (4 seconds, 240 interpolated frames). Root inspected its chronological sheet: physical phases survive but excessive upright lifts and slow cadence remain, so it is NOT promoted. Cycle seams are spatially close under uniform transforms, but final source card disappears on reset. Card-cleanup diagnostic removes the drifting paper with nearby actual felt; n0–22 still retain small mixed fingertip-edge artifacts. Preserve these limits. Next priority is an economical low shoe-turn source, plus calibrated authoritative card/finger compositing; do not attempt to solve the four-second choreography by another blanket speed increase. Existing public gameplay is unchanged. New optional shoe-contact-occlusion.mjs implements model-derived lip clipping for low planar extraction, with 10 passing geometry tests including on-lip boundaries; not yet wired into gameplay. QA measured first-action delay 7.48s (including 1.96s entry) and hit-start delay 2.475s (0.821s loop-boundary wait plus 1.466s entry). See shoe-pickup agent subfolders. Continue toward a genuine shoe-ready cycle and authoritative card replacement; no blanket speeding or false physical acceptance.

# Latest shoe pickup experiments — 13 September 2026

Two new image anchors and four Kling source attempts completed. ALL jobs are terminal; none pending. Saved sources, prompts, per-frame review sheets, probes and limits: `content/staging/2026-09-13/shoe-pickup/README.md`. The revised fast.mp4 genuinely shows an outlet extraction and hand transfer in the sampled source; pace60.mp4 is a separately reviewed 1.8x/interpolated preview, not native 60 fps. Both still deal face down and briefly lift the card. 4K did not fix turnover. The start/end-constrained take reaches face-up output but holds it vertically and drops/slides it awkwardly. None approved or installed in gameplay.

This is concrete source progress, not full delivery. Continue from the best physical outlet extraction (fast.mp4) and require a low economical turn-and-slide plus actual game camera/shoe alignment before integration. Do not run the same prompt batches again or present final card placement as correct physical contact. Deep media audit passed; public game and paired speech assets unchanged. Keep 3D paused and CAC-4/CAC-9 unresolved.

# Latest user rejection: shoe extraction and slow setup — 13 September 2026

User explicitly rejects the current cards because Astrid does not pull them from the shoe and setup motion drags before delivery. Rewatched the supplied YouTube with claude-video and compared installed source frames. See `content/staging/2026-09-13/youtube-reference/SHOE-PICKUP-REVIEW.md`. The performance path receives but never uses the actual shoe outlet; current card tracks are hand proxies and source paper starts already in her hand. Seven-seat UI/lifecycle QA is not physical dealing acceptance. Prioritize a continuous actual outlet extraction/transfer/release source and direct matched setup. Do not claim this repaired by 60 fps, faster playback or a floating card drawn from the shoe. No new generation was submitted in this review; prior jobs remain terminal.

# Current gameplay: Astrid edge cleanup and moving ready state — 13 September 2026

Astrid smooth60 now loads the complete `joins/ready/manifest.json` lifecycle by default (`ready=off` compares the prior path). After decision-phase dealing and hits, a 67-frame/60 fps moving rest loop keeps controls available. Specific source-bound bridges connect later actions; speech stops at the loop boundary and uses a filmed return to the exact preserved idle before its paired take. Initial idle-to-deal, actual card landing clocks, server wallet/shoe and other dealer sources are preserved. See `content/staging/2026-09-13/ready-at-table/INTEGRATION.md` for implementation, source limits and QA corrections.

The user's white shoulder/face flecks were traced to captured background lamps included in the original matte and baked into generation references. `content/staging/2026-09-13/edge-cleanup/` removes upper-body protrusions, preserving lower hand/finger coverage before encode. Four smooth60 takes and six existing joins use immutable -edge-v2 files with recalibrated bindings; original source media remain available. Speech-idle endpoints retain their original matte. This repair does not fix damaged source card pixels or establish seven physically filmed reaches. CAC-9 and CAC-4 remain In Dev because their full visual scope is not approved.

Refill was verified at 377.03 credits. Both MiniMax pilot jobs failed; all five registered Kling jobs completed and their original outputs, prompts and chronological review sheets are saved. NO generation remains pending. Do not duplicate jobs or submit the rejected Seedance batch again. Ready media are now integrated review assets, not just a source clip. The player tests and full pre-commit suite pass; deep media audit preserves all four paired-speech baselines. Final gameplay evidence is recorded in INTEGRATION.md. Keep 3D paused; the 30-minute comparison automation should continue from this state, not regenerate finished work.

# Current: ready-state integration blocked by generation balance — 13 September 2026

Ready motion source exists but is NOT installed in gameplay. Bridge batch accepted pose 3 (`19260b8c-af4f-4985-9922-e7f47fc942a4`) and pose 47 (`8409448f-bf01-4a96-a24c-042dfdec38df`); both completed and are REJECTED: pose 3 adds repeated hand sweeps/damaged paper; pose 47 contains an obvious double-image dissolve around frame 52. Neither is usable. Pose 21, pose 34 and folded speech-idle submissions failed for insufficient credits and have NO job IDs. Selected Team workspace balance verified at 2.03 credits, no unlimited allowance. Do not duplicate successful jobs, purchase credits or switch billing workspaces. Requests and source review are in `content/staging/2026-09-13/ready-at-table/`. Ready motion has now been packed into 241 native-duration interpolated 60 fps frames; neutral-background browser loop inspected, deep audit and full pre-commit suite passed. No public player/media change. All five connections still need valid footage; more credits alone will not fix the rejected generation method. Keep incomplete transitions out of gameplay. CAC-4 remains In Dev and full visual acceptance remains open.

# Latest: clean natural ready-at-table source candidate — 13 September 2026

Immediate work following the shared Evolution viewing produced a clean-hand anchor and a four-second moving ready-pose candidate. All three jobs are terminal; none is pending. First source **cdc7cc10-28da-4f48-8577-8fea94ebb51b** was rejected for damaged cards, an invented table bar and incorrect starting hands. Clean-hand image **364ab5bc-011b-46e3-9c59-eb9f54696a81** removed the paper. Replacement motion **3dc65a6d-e345-4870-b1f9-ece2b70d2dcb**, `clean-source.mp4`, shows separate empty hands, a brief gaze shift and subtle movement in 12 inspected samples. See `content/staging/2026-09-13/ready-at-table/` for sources, exact receipts, reproducible review scripts and diagnostics.

This is a usable source candidate, not gameplay delivery. Source is 97 frames at 24 fps. Do not freeze the ready image or swap it over recorded speech. Next integration needs segmentation and uniform registration, a genuinely moving loop, distinct joins from/to actual action endpoints 3/21/34/47, and a ready-to-folded speech handoff preserving exact paired media. Check source identity, continuous loop seam, hand anatomy and exposure at the game camera before requesting dependent bridges. No public player or media was changed in this iteration, and no current defect is marked resolved by the generation. Keep CAC-4 In Dev.

# Latest: user-selected Evolution reference and 30-minute comparison loop — 13 September 2026

User supplied https://www.youtube.com/watch?v=dfE-7NV4Vh8 and explicitly requested claude-video /watch plus recurring comparison/improvement. The existing Astrid heartbeat `finish-astrid-gameplay-verification` was updated in place to ACTIVE every 30 minutes. No duplicate automation. Read `content/staging/2026-09-13/youtube-reference/README.md` and receipt before each run. The requested tool is installed locally and used successfully with an isolated updated downloader; cached video/frames stay local, outside Git. No API key was needed or saved.

Inspected 16 full-clip samples and 24 focused opening samples. Reference target: direct distinct reaches, real card/finger contact, hand near shoe, continuous empty-hand return, economical natural gestures and stable scene/skin. First-pass placement cadence is approximately 0.7–1.0 seconds from a 2 fps inspection, not exact native-frame calibration. Four missing physical reaches and feeding-hand paper artifacts remain the main Astrid gaps. Preserve Astrid's own identity/table/camera. This turn establishes the comparison baseline and loop; it does not claim the game now matches Evolution or that model weights were trained. No transcript was available; analysis was visual.

# Latest: Astrid before/after dealing transitions — 13 September 2026

The reported smooth60 pose cut is addressed with six filmed actor-only entry/return clips bound to the actual source endpoints and preserved idle RGB/matte. Smooth60 loads them by default; `joins=off` is a comparison fallback. The player waits for the return and a freshly presented matching idle frame before releasing the overlay; recorded speech waits across loading, dealing and return. Camera, table, source card events and server authority remain unchanged. See `content/staging/2026-09-13/scene-joins/README.md`, exact requests, sources and build scripts.

All five Higgsfield jobs are terminal. Four outputs were used; the first pose-3 return invented wide arms and was rejected, then replaced by a forward idle-to-pose-3 entry. No job is pending; do not duplicate. Automatic source aspect padding was uniformly removed to avoid body stretching. The first matte covered the felt with black and failed gameplay review; rebuilt masks remove exterior black while retaining dark clothing. Output is 60 fps interpolated from 24 fps sources, approximately two seconds per join, not native 60 fps capture.

Deep dealer audit and full pre-commit checks passed, including six new join/media/order/cancellation tests. Centre, right and left entry/return sequences completed in the real isolated gameplay player. Seven-seat round: right hit bust, left hit to 17, dealer draw, 35 staked, 60 returned, balance 1,030, zero stake. One clip interrupted during that opening at 18:44:47 UTC; its server card survived, so do not claim an interruption-free opening from that run. Later right, left and dealer transitions completed with no further warning. Corrected inspected frames retain normal proportions, room/table and visible felt. All four dealers completed two consecutive matched greetings in the isolated rehearsal after the shared-player change; this is bounded regression coverage, not new lip-sync approval. Full seven-physical-reach, colour and photorealism approval remain open; source paper remnants persist. CAC-4 remains unresolved.

Final repeat after the decoded-final-frame correction (18:53–18:54 UTC): seven-seat opening ran with exactly one entry-3 and one exit-34, all seven Stand actions and settlement completed, 35 staked, 5 returned, final balance 1,000 and zero stake. No new browser warning/error occurred in this repeat. Earlier failed observations remain recorded above; the correction is not a guarantee against all device interruptions.

# Latest: 60 fps Astrid quality and pacing review — 13 September 2026

17:54 UTC follow-up: surveyed the remaining source at seconds 5–10; later gestures still serve the generated near-body card row and then return to rest. No additional calibrated inner-seat reaches identified in those sparse samples. Existing per-seat generation receipts are terminal/rejected; no duplicate job or public media change. See `reference-rhythm/remaining-source-review/README.md`. Physical reach and colour acceptance remain open.

User accepts the concept but requests more frames, higher quality and less rushed dealing. New `motion=smooth60` loads separate 60 fps interpolated takes rebuilt from native 1664×1248 RGB, avoiding the 832px intermediary. Output is a 1920×1080 logical canvas with packed masks, CRF14, 80% source speed. RGB and mattes share optical-flow warps; body retargeting stays disabled. Old rhythm assets preserved. Source is 24 fps; do not claim native 60 fps or recovered motion-blur detail. See `content/staging/2026-09-13/reference-rhythm/smooth60/README.md` and build/receipt.

Full isolated seven-seat round completed with a hit to 21, two additional dealer draws and settlement (35 stake, 22.50 returned, 987.50 balance, zero stake afterward), no browser warnings/errors. Deep audit and full pre-commit suite passed, including frame uniqueness and slowed contact-event checks. Sampled gameplay retained natural proportions. Existing paper remnants, abrupt final pose join and missing distinct physical reaches remain unapproved. User's original tab had an active hand and was not reloaded. All four dealers completed consecutive matched greeting playback in the isolated rehearsal; no new lip-sync approval. Smooth review URL: http://astridsmooth.localhost:4173/?dealer=astrid&performance=staged&motion=smooth60.

# Earlier: rhythmic Astrid integrated; body stretching removed — 13 September 2026

16:55–16:57 UTC follow-up: a fresh isolated four-inner-seat round completed two hits, a bust, Stand and settlement without browser warnings/errors; see `reference-rhythm/colour-review/gameplay-check.md`. Contact/return screenshots retained natural proportions and showed no large whitening jump in those samples. Distinct physical reaches, feeding-hand paper artifacts and the abrupt final pose join remain unaccepted. No public code/media or grading was changed, and no new generation job was submitted. This round had no additional dealer draw.

Follow-up diagnostic: `reference-rhythm/colour-review/` compares small cheek regions across the new source and preserved idle. The new footage suggests only small channel differences in those patches; do not copy the stronger old-action gain into rhythm takes. No grading or gameplay change was made by this diagnostic. Camera-matched rendered colour acceptance and four inner physical reaches remain open; no generation job was submitted.

User requested gameplay integration of the completed motion-transfer source. The existing staged PerformancePlayer now has opt-in `motion=rhythm`, loading four short packed source excerpts with shoe-directed returns. Game cards remain server-owned and follow presented source-frame pickup/landing events. Source card footprints are explicitly labelled hand proxies, restricted to review, not certified measured contacts. See `content/staging/2026-09-13/reference-rhythm/integration/README.md`, build.py and preserved observations.

The user rejected body elongation during the first gameplay test. Removed all reach deformation from rhythm footage, including when the older `reach=tracked` flag is present. Natural filmed motion is preserved; cards slide from the source hand release to their actual receiving fan. Do not re-enable actor warping to claim seven physical reaches. Current user tab was updated in place from the old reach URL to `http://astridreach.localhost:4173/?dealer=astrid&performance=staged&motion=rhythm` after observing zero stake/no active round. An active hand later observed at the earlier QA hostname was left alone; final verification used a fresh isolated guest.

Corrected full-table inspection confirmed `retarget=false`, natural proportions and seven pairs of player cards. All seven Stand actions responded; settlement returned 70 on a 35 stake, balance 1,035 and zero stake. One dealer-draw playback was interrupted while the server card was preserved; the QA tab was subsequently closed and further testing there stopped. Do not describe that run as interruption-free or full dealer-draw visual acceptance. Deep media audit, full pre-commit checks and focused integrity/immutability/cue tests pass; all four dealers played consecutive greetings. Clip joins, source card-back remnants in the feeding hand, estimated grips and seven physical reaches remain visual limits. This is a playable faster integration, not complete visual approval or production deployment.

# Earlier: user supplied expected professional cadence — 13 September 2026

The Desktop recording `Skärminspelning 2026-09-13 kl. 15.55.29.mov` is the user's expected dealing motion. Inspected the first seven seconds: continuous deliveries roughly every 0.7–1.0 seconds with direct empty-hand returns to the shoe. Current Astrid still takes 3.00–3.21 seconds per card, including 1.44 seconds before each pickup and folded-arm resets. See `content/staging/2026-09-13/reference-rhythm/README.md` and request.json. Genjutsu motion-transfer job `10bfb266-4e8c-4778-b3d2-659ae8373dcb` completed; original output is source.mp4 in that directory. No job remains pending. Contact-sheet review shows much closer continuous cadence without folded-arm resets and no browser UI/background people, but generated cards accumulate in a row near Astrid rather than the actual seat fans. It needs paper removal, person/finger segmentation and per-release contact calibration before gameplay integration. No gameplay change or cadence acceptance is claimed. CAC-4 remains unresolved.

# Earlier: seven-position filmed-arm retarget preview — 13 September 2026

User requested delivery. Implemented opt-in `reach=tracked` for the staged video player: source hand/finger layers and attached card move together toward the actual seat destination. This is video deformation, not seven newly captured or approved takes. See `content/staging/2026-09-13/reach-retarget/README.md` for mechanism, rejection of initial radial bending, tests and material limits. Original source calibration is preserved, and transformed results are not represented as measured footage.

Playable review: `http://astridreach.localhost:4173/?dealer=astrid&performance=staged&reach=tracked`. The revised prototype completed inner-seat and seven-seat rounds and returned to idle without warnings/errors. Numeric reach tests and deep/pre-commit audits pass. Full visual acceptance remains open: some timed screenshots arrived after release, arm anchors are approximate, and source folded-arm resets remain. Do not claim perfect seven-seat professional choreography or close CAC-2/CAC-4. Keep 3D paused.

# Earlier: endpoint-reference experiment rejected before video — 13 September 2026

The scheduled continuation inspected existing receipts, then tested two photographic release-pose images through Higgsfield MCP as an alternative to imprecise video text editing. Both have plausible hand/card contact but miss seat 2 by approximately 70 and 111 source pixels respectively. See `content/staging/2026-09-13/per-seat-video/endpoint-proof/` for original images, exact requests, terminal job IDs, measurements and rejection. Neither image was installed or used for a video generation. No job remains pending. Four missing reaches and colour-transition acceptance are unchanged; no gameplay fix is claimed by these stills. Avoid repeating the same relative-position prompts without a controlled pose/motion reference.

# Earlier: CAC-9 first correction failed; idle matte repaired — 13 September 2026

The user showed continuing fingertip fade in their current tab. Reproduced two visibly different hand-opacity states 2.4 seconds apart; moved CAC-9 back to In Dev. Original idle RGB retains the fingers while its matte loses them during the loop. The first shader-only correction was insufficient.

Repaired all 145 idle mask frames from the inspected hand-region RGB, preserving original mask bytes and all original RGB/audio. New file `actor/streams/idle-1_idle_idle-hand-repair.h264` is paired by updated frame index and provenance. See `content/staging/2026-09-13/cac-9-hands/idle-repair/` for script, original/revised masks and full-loop contact sheets. Reloaded the user's existing zero-stake tab and checked separated samples across the loop: tips remained visible. Actor, deep roster and pre-commit audits passed. This repair is idle-specific, not an all-take acceptance; keep CAC-9 open.

# Earlier: CAC-9 fingertip opacity correction — 13 September 2026

Read CAC-9 and its attached close-up: resting fingertips turn dark/transparent over the sleeve. The original source retains the hand. The shared actor-edge cleanup could borrow opaque black sleeve colour for uncertain fingertip pixels while eroding alpha. Added a colour-similarity guard and matte-supported skin opacity recovery in `actor-compositor.mjs`, used by both speech and dealing. No source bytes or speech calibration changed.

See `content/staging/2026-09-13/cac-9-hands/README.md` for original evidence and gameplay reproduction. Idle, centre dealing, speech/decision transitions and completed Stand/settlement were inspected at `http://astridhands.localhost:4173/?dealer=astrid&performance=staged`; fingertips now remain visible in those checks. Full pre-commit and deep media audit passed. CAC-9 moved through In Dev and Ready for QA to In Testing; not Done pending full visual acceptance. Four missing reaches remain unresolved.

# Earlier: action skin colour corrected; inner reaches still unresolved — 13 September 2026

The user requested active work rather than another scheduled wait. Measured the pale action cheeks against preserved idle-source cheeks and added optional calibrated RGB grading to the performance shader. Warm pixels receive the correction in both actor layers; neutral blouse/suit pixels retain their colour. All four ordinary takes and registered returns share the gain. Source bytes, contact tracking and speech assets are unchanged. See `content/staging/2026-09-13/face-colour/README.md` for reproducible measurements and limitations.

The refined correction completed a real centre-seat round in the isolated guest at `http://astridcolour.localhost:4173/?dealer=astrid&performance=staged`, including speech, physical delivery, decision idle, Stand, settlement and return to betting. Zero browser warnings/errors; freeze did not recur. This is a colour improvement candidate, not acceptance of every pose or seven-seat choreography. Contact tests (16), performance audit, deep dealer audit and full pre-commit checks pass. Four-dealer consecutive greeting playback was reviewed through the real rehearsal player; this does not grant lip-sync approval.

A second Higgsfield video edit completed but printed destination text and failed to move the physical reach correctly. Original output and rejection are saved under `per-seat-video/seat-2-edit*`; it was not installed. No job is pending. Positions 2, 3, 5 and 6 still need actual source motion and calibration. CAC-2/CAC-4 remain In Dev. Keep 3D paused; do not claim this colour patch completes the dealing request.

# Earlier: four inner seats still lack actual filmed reaches — 13 September 2026

The user explicitly rejected the three-direction motion again: positions 2, 3, 5 and 6 are missing. Confirmed against the source manifest and saved coverage audit. New work is staged in `content/staging/2026-09-13/per-seat-video/`, including normalized card targets and a new Higgsfield MCP source proof. The proof improves the empty-hand return but misses the seat-2 destination by about 125 source pixels, so it was rejected without installation. The exact request, original clip, contact sheet and measured rejection are saved. No other generation is pending; no per-seat gameplay fix was delivered. CAC-2 remains In Dev. Four genuinely matching reaches plus calibration are still needed; existing physical-capture guidance remains relevant. Do not present another card-position-only round as resolving this report.

# Latest: release frozen action frame during decisions — 13 September 2026

The user reported centre-only delivery followed by a freeze. `endDealingTake()` now releases the held performance layer at the end of the sequence. Previously it stayed over the running idle engine until another speech line began, visibly freezing Astrid during player decisions. The frame is still held between consecutive cards.

Tested in a separate guest at `http://astridfreeze.localhost:4173/?dealer=astrid&performance=staged`: five-dollar bets on outside boxes 1 and 7 received two cards each; during Hit/Stand the DOM had zero performance layers and the idle wrapper was visible. Hit on each side completed; the left hit explicitly selected `deal-left` (frame 83 inspected). Settlement completed at balance 1,000 after 10 staked and 10 returned. No seat routing code changed. Classic/High Roller/VIP select stakes, not receiving seats. Actual seven-seat hand contact remains unaccepted; do not equate DOM card placement with convincing physical reaches. Previous visual acceptance claims remain bounded.

# Latest: faster Astrid video and consistent hand compositing — 13 September 2026

The user requested quicker, natural dealing and the same blended appearance as speech. Silent takes now play at 2× and stop on the calibrated rest frame, removing the idle tail. Nominal per-card time drops from 4.02 to 3.00–3.21 seconds. Presented-frame contact and audio cues are preserved. The foreground fingers no longer double the base actor alpha; full-actor hands no longer receive the legacy additional band fade. A shallow shared centre rail anchors the forearms during both speech and action. No speech/video bytes or camera/contact positions changed.

See `content/staging/2026-09-13/dealing-consistency/README.md`. Actual in-app review showed the revised centre reach with the card beneath the fingers; a three-position round played the left, centre, right and dealer clips with roughly 3-second actions. The round settled a 15-dollar loss (1,000 → 985), collected the cards and returned to betting with zero stake and no browser warnings/errors. All four dealers completed two consecutive greetings. The deep media audit, performance audit and complete pre-commit checks passed. These scoped checks do not approve full natural choreography: repeated folded-arm returns, source matte defects and individual seven-seat reaches remain open. CAC-4 remains In Dev; 3D remains paused. Updated preview: `http://astridpace.localhost:4173/?dealer=astrid&performance=staged` (separate demo guest).

# Latest: user paused 3D and returned to Astrid video — 13 September 2026

The user explicitly requested that 3D work be put aside for a possible later revisit. Stop the head/eye/rig experiments. Preserve their files without promotion. The active product is again Astrid's video dealer in the playable blackjack game, at `http://astriddealing.localhost:4173/?dealer=astrid&performance=staged`. See `content/staging/2026-09-13/video-return/README.md` and its isolated preview launcher. It serves unchanged public code/media with a separate demo database. The existing 3D comparison is no longer the delivery target.

The video dealer was visually checked in the actual in-app game, and two consecutive recorded greetings completed with sound enabled. A five-dollar isolated demo round dealt cards, accepted Stand, settled, collected the cards and returned to betting without browser warnings/errors. Continue future work on video quality, speech continuity and the playable round. Do not treat the previous experimental 3D head or eye controls as accepted, completed or active work.

The first restoration mistakenly opened basic video, leaving Astrid idle during direct shoe-to-table card movement. The user requested the saved visible dealing version. The corrected active URL above enables `performance=staged`, the existing VIDEO takes (not 3D). A separate guest round completed all player/dealer clips and settled 1,000 → 995 → 1,005; a second round visually confirmed arm movement. Seven-seat reaches, split-fan contact and return continuity remain unfinished. The user's separate active hand was left untouched.

# Earlier: show exact new source and compare bounded cheek repair — 12 September 2026

The user rejected being shown the old rig again. `content/staging/2026-09-12/astrid-closeup/source-viewer/` now serves the exact new provider GLB and its photographic input at `http://127.0.0.1:4207/`, with rotation, Front, a cheek-repair toggle, and native/GLB downloads. Both model hashes were verified in the actual browser. The material images remain byte-identical through the repair export. The viewer preserves the same camera and lighting between versions.

`surface-repair/` contains a packed editable reconstruction, GLB, reproducible script, numerical receipt and native front render. It reduces jagged cheek damage, but broad cheek shading, eyelid artifacts, solid hair and likeness remain unresolved. The smaller `face-cleanup/` trial failed visibly and is retained as diagnostic evidence. Neither source has a facial or body rig. This is not a finished-game delivery. The 4206 game still uses the rejected old full-body model; the new bust has not been integrated. The companion game task is archived and should not be reported as continuing integration.

# Earlier: preserve closer face source and isolate idle-pose defect — 12 September 2026

Read `content/staging/2026-09-12/astrid-closeup/README.md` and its `comparison.html`. The new Higgsfield Tripo job `9b2f127c-956a-42e3-bee0-cb72a41f3710` returned an actual dense GLB bust, now saved untouched with a separately packed editable Blender source. Its likeness is closer, but clay inspection confirms geometric eyelid/cheek artifacts and solid ridged hair. It has no rig, morphs or independent eyes. Do not graft it onto the rejected body or treat it as a finished animated dealer. Two preceding provider jobs failed without a stated reason; do not resubmit them blindly.

The hunched game posture was independently traced to unconditional `.4`-radian spine lean at idle and an inadequate head counter-angle. `content/staging/2026-09-12/upright-controller/` contains a private correction, 707-sample deformed-skin diagnostic, editable poses and limitations. The isolated existing-game preview is at `http://astridnext.localhost:4206/?dealer=astrid&scene=rigged-review&recordproof=1&rehearsal=1`; its actual Chrome capture confirms upright idle with the old rejected mesh. Face, hair, sleeve deformation and full gameplay remain unaccepted. The new bust is not installed there. Public/default assets, shared audio, backend and real user data are unchanged. CAC-2/CAC-4 remain In Dev.

All four dealer media sets passed the deep 90-stream integrity audit. Upright reach/floor/support/return diagnostics passed; those are not photographic, fingertip grip, complete-round or lip-sync acceptance. Previous remote checkpoint `72c7a79` pipeline `2841885403` was freshly verified successful.

Conversation text was found intact in the original local session: 570 visible user/assistant messages across September 8–12, no malformed JSON. A private readable Markdown/HTML/JSON recovery with a source checksum snapshot is saved under `/Users/solvifyab/Documents/Croupier-Conversation-Backups/2026-09-12-recovery/`. No transcript was modified, committed or published. The native app reader still returned only the beginning; the UI history problem itself is unresolved.

# Earlier: replacement appearance rejected in Chrome — 11 September 2026

The user rejected the new Tripo character's appearance. The actual Chrome WebGL frame is preserved with its SHA receipt under `content/staging/2026-09-11/astrid-replacement/rig-candidate/evidence/`; read that folder's `REVIEW.md` and `inspection/APPEARANCE-REJECTION.md`. Face likeness, hair, suit and the hunched game pose fail the photographic reference. **Stop rigging this source until a replacement passes a matched-camera appearance review.** Earlier structural/body checks are not appearance acceptance.

Hand trials V1 and V2 are preserved as rejected editable/GLB evidence in `hand-study/`. Moderate bending creates thumb/web tears; successful numerical contact does not override those images. Connected digit topology is saved for research, but V3 was not implemented after the appearance rejection. No public/default asset, backend, wallet or other dealer changed. CAC-2/CAC-4 remain In Dev; no realistic full-round delivery or facial/lip acceptance exists on this replacement.

# Earlier: corrected body rig preserves original PBR — 11 September 2026

The corrected-orientation rig passed scoped anatomical/rest checks and a rendered forward-elbow study. Original canonical geometry, UVs and all three embedded PBR images are preserved in `content/staging/2026-09-11/astrid-replacement/inspection/rig-corrected-transfer/original-pbr-body-rig.blend` and `.glb` (24 body joints, no actions). Read `inspection/BODY-RIG-REVIEW.md` for exact transfer tolerance, visual evidence and the rejected hip-collision pose. The game task has this source for measured finger fitting and actual-table testing. Facial controls, full motion and realism acceptance remain open. No public/default promotion.

# Earlier: reject first body rig; preserve canonical input — 11 September 2026

The first replacement body rig has misplaced left/right joints and invalid body influences (including foot points weighted to a hand), not just missing PBR maps/finger bones. Both rest and evaluated poses were checked. Do not integrate or transfer its weights. See `content/staging/2026-09-11/astrid-replacement/inspection/RIG-REJECTION.md` and preserved numerical evidence.

The original Tripo mesh is now also saved as `inspection/canonical-source/original-canonical.glb` under that replacement folder: 1.73 m, ground zero, standard glTF +Z front. Vertex detail/topology, UV bytes and all three embedded image byte sequences are retained; original provider files are unchanged. A packed native and actual front/hand renders are in `inspection/canonical-review/`. The exact source-to-canonical transform is available for measured finger fitting. A corrected-orientation rig retry must be independently checked; no valid replacement rig or realistic game performance has yet been delivered.

# Earlier: original Tripo replacement inspected — 11 September 2026

The credit blocker below was resolved. Tripo job `81c28894-4323-44b3-9bda-3a0a32100c5a` delivered a 7.14 MB GLB after the first quad-output attempt failed without a reason. Original bytes, a separate packed Blender source, inventories and actual front/hand/profile renders are preserved in `content/staging/2026-09-11/astrid-replacement/inspection/`. Read `TRIANGLE-CANDIDATE-REVIEW.md`: this is accepted for a body-rigging trial, not final realism. The new coherent head/suit and volumetric fingers improve on the old assembly, but the model has no skeleton, facial shapes or animation. Eye detail/gaze, hair, cuffs and real card action remain open. Do not reinstall the rejected old head or apply hardcoded old mesh corrections. No public model changed.

# Earlier: isolated native pose matching and generation blocker — 11 September 2026

The user's photographic dealer and natural performance goal is still open. Whole-character assessment is in `content/staging/2026-09-11/dealer-source-assessment/`; collar micro-studies are frozen. The replacement-generation task saved exact Higgsfield reference requests and a rejected submission under `content/staging/2026-09-11/astrid-replacement/`: zero jobs started, shared workspace balance 1.4 credits, three references estimated at 9 credits before unpriced 3D/rigging work. Do not submit duplicate jobs or present the existing character as accepted realism.

An isolated native control candidate is in `content/staging/2026-09-11/dealer-controls/`. Its embedded Blender sidebar script matches wrist/foot targets and poles to the evaluated FK pose before enabling manual IK. Read that folder's README for activation and keying instructions. Original twelve actions and public assets remain unchanged; numerical pose continuity does not approve photographic appearance or natural blackjack motion. CAC-2/CAC-4 remain open.

# Latest: calibrated facial candidate and seven-seat collection — 10 September 2026

Read [the preserved integration review](https://github.com/Jakeminator123/github-work/blob/f31b219e4d0f751a81caa2db75c9d824be8e8926/assets/blackjack-3d/review/final-fit/README.md). The opt-in anatomical game uses the corrected oral/collar geometry with 17 separate model-bound calibrations, unchanged raw source measurements/audio, and actual loaded-model hash verification. It also has a continuous photographic room reference and consistent seated camera angle. The combined editable table project was rebuilt from the corrected native source.

All 17 Astrid lines completed twice, all four default dealers completed two greetings, and a fresh seven-seat game passed: 1,000 → 965 stake → 1,035 after settlement; 18 cards gathered into one stack, discard count 19, no live cards. Recording is silent. This remains a technical/visual candidate: hair/skin/clothing, fine hand quality and the too-small 390px phone composition are not accepted. Full phoneme and physical-device QA remain open; CAC-2/CAC-4 stay In Dev. No default promotion or production deployment.

# Latest: continuous collection sweep — 10 September 2026

The actual rigged table now gathers finished cards into one stack, exchanges it between the hands near the centre and places it once in the discard tray. The original cards stay still until touched. `dealer-collection.mjs` builds the path from existing server card transforms; `pipeline/sample-dealer-collection.mjs` exports the same poses and independent card transforms for an additional editable study. Existing twelve source actions are retained. The new gathering sound follows presented contacts and respects existing mute/hidden-tab cancellation.

First actual three-seat sweep gathered eight cards and cleared the table. Evidence, limitations and the numerical checks are in `assets/blackjack-3d/review/collection-sweep/` and [ASTRID-FACE-IN-GAME-REVIEW.md](ASTRID-FACE-IN-GAME-REVIEW.md). Geometry checks pass for all seven seats and outer four-hand splits. The early abrupt secondary-hand arrival was rejected and slowed before this candidate. Photographic appearance is still not approved; facial calibration and surface/identity work continue separately. CAC-2/4 remain In Dev.

# Latest: anatomical face connected to the actual game — 10 September 2026

Read [ASTRID-FACE-IN-GAME-REVIEW.md](ASTRID-FACE-IN-GAME-REVIEW.md). The opt-in `?dealer=astrid&scene=rigged-review&face=anatomical` now combines the corrected neck/head with 17 measured facial performances, exact media-source bindings, cancellation-safe shared playback and silent card-following gaze. The combined editable table is in `assets/blackjack-3d/editable-project/anatomical/`. Its source, images and controls were reopened and checked. Default filmed dealers and guest access remain unchanged.

This remains a likeness candidate. Hair, skin and expression quality still need visual work; a zero-gap capture and passing mechanical tests do not approve photographic Astrid. Original four-dealer repeated playback and the 90-stream baseline were checked. In-game round/recovery evidence and limitations are in the linked report. **CAC-2 and CAC-4 stay In Dev.** Keep experimental speech gaze isolated until it has its own source-clock and visual evidence.

# Latest: corrected anatomical neck and packed source — 10 September 2026

The corrected opt-in model removes the duplicated neck offset caused by reading raw mesh positions after editing shape-key Basis. Actual evaluated neck/body separation fell from 46.11 mm maximum to 2.12 mm. Rest and both outer-seat renders are in `assets/astrid-3d/anatomical/review/`; six face tests pass on the published candidate. Four editable Blender projects, embedded-material GLBs, twelve body actions, manual controls and the measured goodluck take with original packed audio are saved and reopened under `assets/astrid-3d/anatomical/`. Export joint residual remains below 0.65 mm. Read the anatomical face study and package README.

The collaborating game task has verified all 17 source-clock speech bindings and a full actual round; its integration checkpoint follows separately. Studio replay, scrub and on-demand rendering are verified in the browser. Hair, eyes, lower-chest shading and full photographic/device acceptance remain open. Native/body and face controls are an inspectable technical delivery, not completion of the user's realism goal. CAC-2/CAC-4 remain In Dev.

# Latest: anatomical face and source-clock controls — 10 September 2026

See [ASTRID-ANATOMICAL-FACE-STUDY.md](ASTRID-ANATOMICAL-FACE-STUDY.md). The opt-in face-study GLB now has separately weighted gaze eyes and ten real facial shape keys. Studio controls and source-clock measurements are available, with six face regressions passing. Jaw stretching and jagged collar attempts were rejected; the current mechanical candidate preserves the jacket and retained body weights. Neck surface/albedo continuity, hair appearance and final photographic acceptance remain open. The collaborating game task owns the 17-line adapter/manifest and actual-game review. Native source packaging continues separately; do not promote the default dealer or close CAC-2/CAC-4 from this checkpoint.

# Latest: persistent discard presentation — 10 September 2026

The opt-in rigged game retains collected cards between rounds and restores the pile from public server counts after refresh. `rigged-discard-state.mjs` excludes current player/dealer/hidden cards until they land in the tray, ignores repeated landings and clears on a new shoe. Actual far-seat game passed: 45 discards → four cards in play → 49 discards, 367 in shoe, balance990 after a push and after refresh. Evidence is in `assets/blackjack-3d/review/discard/`. Shared regression hook and growing-stack deformed-skin/reach tests pass. No backend/wallet/media changes. New anatomical head and its17line facial measurements remain in progress separately; do not promote them from capture success alone.

# Earlier: rigged split hands and refresh proof — 10 September 2026

The opt-in rigged game now separates up to four hands per seat, highlights the current hand and shows its server-issued ranks/suits beside the actions. Resplits preserve card positions and slide existing cards into the new fans. `rigged-card-layout.mjs` owns these targets. Geometric overlap/felt tests and independent deformed-skin reach checks run in the hook and CI. A real centre-box four-hand fixture, refresh and dealer settlement passed: 970 → 950 after 20 stake → 990 after 40 return. Exact cards, screenshots and a silent recording are saved in `assets/blackjack-3d/review/split-hands/`.

The original filmed Astrid remains the default. The collaborating dealer task owns the anatomical head, facial controls and texture work; that candidate is not installed by this checkpoint. Do not promote a head based only on successful morph tests. Remaining full photographic, shoe/skin, outer split and physical-device acceptance is recorded in the table review. CAC-2 and CAC-4 remain In Dev.

# Earlier: actual-game 3D table review and source verification — 10 September 2026

See [ASTRID-RIGGED-TABLE-REVIEW.md](ASTRID-RIGGED-TABLE-REVIEW.md). The actual game has an opt-in `?dealer=astrid&scene=rigged-review` path with the independent table, shoe, cards and rig. Seven-seat delivery, own cards, server-driven reveal/collection and snapshot-driven shoe presentation are integrated. The editable combined Blender project has twelve marked motion studies and matching card-helper tracks. This is a development candidate; it is not photographic Astrid or full CAC acceptance.

Actual isolated rounds verified seven separate positions, refresh retaining the exact cards/balance, own-card dealing, hit, insurance decline, stand, reveal, settlement and collection. All four dealers completed two consecutive greeting plays through the shared rehearsal path. Existing regression checks and the eight-scenario HTTP harness pass. Silent in-game recordings and reference comparison are saved under `assets/blackjack-3d/review`. Physical mobile browsers, all-line lip sync and complete visual acceptance remain open.

Dealer/skin checkpoint `2251d2e` includes the genuine skin-contact solver, eight motion/skin tests and a separate optional normals cleanup source. The photographic head, eyes, eyelids, oral cavity, hair and facial rig remain asset requirements. CPU-only pose timing is recorded separately and does not approve phone/browser performance.

A native-control parenting bug was found by rendering the combined source and corrected by the dealer task. The old native collision pass was withdrawn. The correctly positioned mesh then exposed real hand/finger penetration. The corrected solver uses actual deformed skin rather than only a control point; all 626 authored frames now pass the native apron-intersection check, with the earlier failure preserved as before evidence. The photographic face projection also remains staged after failed likeness review; do not promote it. Use the current review notes/evidence for final results, not earlier numerical clearance claims. CAC-2 and CAC-4 remain In Dev. Default photographic gameplay and other dealers remain unchanged.

# Latest: editable Astrid 3D candidate — 10 September 2026

CAC-2 and CAC-4 are **In Dev** for the revised 3D approach. See [ASTRID-RIGGED-DEALER-STUDY.md](ASTRID-RIGGED-DEALER-STUDY.md): original generated model, prepared 54-bone rig, eight editable deal actions and embedded-material GLB are saved. Seven player seats and own-card delivery share runtime and baked poses. Manual wrist/foot IK, body, head and finger controls are in the native Blender project. Sync probe, 49 hook tests, three motion tests and numerical export checks pass.

This is not a finished dealer: face/eyes/lip sync, measured skin contact, professional motion cleanup, reveal/collection/chip actions and complete rendered/device QA remain open. The companion task owns opt-in real-game integration and combined table/room project. Existing default gameplay and other dealer media are not promoted by this delivery. Earlier snapshots below are historical.

# Latest: sound recovery and seven-seat rejection — 10 September 2026

**Current Jira state: CAC-8 Ready for QA; CAC-2 and CAC-4 Blocked on usable motion capture.**

Read [ASTRID-AUDIO-AND-SEAT-COVERAGE.md](ASTRID-AUDIO-AND-SEAT-COVERAGE.md). The user correctly rejected the three-direction delivery as incomplete. A real seven-seat deal records the exact target corners and the remaining corrective card travel, up to 175px in the tested 1280px-wide view. Those targets are saved in `docs/reference/astrid-capture-20260910/player-targets.json` for per-position capture. No new hand footage was made or approved; CAC-2 is still unfinished.

CAC-8 tracks the newly reported audio loss. The shared effects controller now resumes suspended/interrupted browser audio on interaction and discards scheduled effects on mute/hidden reset. Card cue timing tolerates small frame drops at 1.75x while rejecting stale cues. Rehearsal unmute uses the real persisted state, and saved silent recordings are labelled. The isolated suspension/recovery check and all 32 cues of a seven-seat initial deal passed. User audio-output QA remains open; existing dealer assets and backend are unchanged. The earlier Blocked snapshot below is historical context for the source-footage dependency.

# Earlier dependency: controlled dealer capture — 10 September 2026

**CAC-2 and CAC-4 are Blocked awaiting usable controlled performance footage. CAC-1/3/5/6/7 remain Done within their recorded QA scope.** The source renders for the rejected right and own-card returns are confirmed completed, not still processing. A fresh GitLab fetch found no new John changes. The capture request remains unanswered. The same dependency persisted across three consecutive goal turns; available independent speech/loading checks are saved, and the Safari attempt is recorded as inconclusive.

The full goal is unfinished. Follow [ASTRID-CONTROLLED-CAPTURE.md](ASTRID-CONTROLLED-CAPTURE.md): first supply continuous right-player and own-card delivery/empty-hand-return proofs with locked camera, rigid card tracking and finger occlusion. The existing right continuation makes an extra sweep; the own-card continuation retrieves a dealt card into the shoe. Neither is installed. Do not spend further hand-generation credits or turn these failures into a purported finished performance. Move the two issues back to In Dev when usable capture or an explicitly revised source-production approach is available, then repeat in-game contact/continuity QA before promotion.

Desktop Safari also needs a reliably visible test session; physical iPhone Safari/Android Chrome and full speech/motion acceptance remain open. No default promotion or production release has occurred. The walkable prototype and all other dealer media remain preserved.

# Earlier: scene QA and real HTTP recovery — 10 September 2026

Safari follow-up: [ASTRID-SAFARI-QA.md](ASTRID-SAFARI-QA.md) records an inconclusive native Safari 26.1 attempt. The initial scene rendered, but the automated page reported hidden and correctly skipped speech. No playback code was changed to bypass this. Safari and physical-device acceptance remain open; CAC-2/4 still need the controlled hand-performance proof.

Speech follow-up: [ASTRID-SPEECH-CANCELLATION.md](ASTRID-SPEECH-CANCELLATION.md) records a reproduced loading/mute race and its shared-player fix. Cancelling a waiting line now releases gameplay and prevents it from speaking after unmute; active and queued lines share cancellation. The normal isolated game passed the delayed-bank check and settlement. Existing media and calibration are unchanged. CAC-2/4 remain In Dev for the outstanding hand/contact work.

Follow-up: the table now handles resize before dealer media finishes loading. An isolated eight-second loading delay reproduced the stale 1280×720 projection in a 1920×1080 viewport. The same test and a phone resize now pass. This is part of CAC-2; it does not close the remaining directional/contact requirement. Before/after evidence and all-four-dealer repetition logs are saved. No media or wallet changes.

Read [ASTRID-SCENE-ACCEPTANCE.md](ASTRID-SCENE-ACCEPTANCE.md). **CAC-1/3/5/6/7 are Done; CAC-2/4 remain In Dev.** The three latest closures cover background continuity and clean cutout edges across 17 Astrid lines, a desktop three-seat round and a normal phone-viewport round. They do not approve the remaining source motion or full lip sync. Earlier status snapshots below are historical.

The new `test/table-http.mjs` checks actual HTTP/SQLite restart recovery, duplicate and concurrent requests, split/double, insurance, payouts and cut transitions in a disposable server. It passes and is included in CI. No game/wallet API, media, voice or guest-access behavior changed.

[ASTRID-CONTROLLED-CAPTURE.md](ASTRID-CONTROLLED-CAPTURE.md) now includes the next-shot brief and current clean game camera reference. Right and own-card generated returns failed visual review. John/performer availability is pending; no capture session has been arranged. Centre/left continuations remain opt-in review media, and the full Astrid goal remains open. Keep the existing Jira workflow live.

# Earlier: CAC layout acceptance and left return — 10 September 2026

Read [ASTRID-LAYOUT-AND-RETURN-QA.md](ASTRID-LAYOUT-AND-RETURN-QA.md). **CAC-3 and CAC-6 are Done** after the reported overlaps passed live seven-seat and left/centre/right split checks. Phone controls also clear the wallet after collapsing rehearsal. CAC-2/4 remain In Dev; CAC-1/5/7 remain Ready for QA. Keep updating Jira live.

The existing opt-in `&continuity=review` now includes a left empty-hand return as well as centre. The original four deliveries, all dealer speech, backend and guest access are preserved. **Watch left return test** shows the recorded game. Two other generated returns were rejected and are not installed. This is not full motion acceptance or default promotion.

# Latest: centre return continuation — 10 September 2026

Read [ASTRID-RETURN-CONTINUATION.md](ASTRID-RETURN-CONTINUATION.md). A centre-only empty-hand return is now playable with `&continuity=review` added to the existing staged Astrid route. It preserves the measured delivery, returns to the outlet and resumes the next card at registered frame 55. The final delivery keeps its original resting tail. Other three directions are unchanged. The rehearsal panel includes **Watch centre return test** with an actual-game recording. This is a partial candidate, not complete CAC-4 acceptance or default promotion.

Initial deal, return-time refresh, split and settlement were exercised on isolated4180. All four dealers repeated goodluck, deep media checks and42 hook tests pass. Source footage/provenance and the integer-frame packing fix are included. Raw evidence is saved privately. **CAC-4 moved In Dev → In Testing → In Dev; CAC-2 remains In Dev. CAC-1/3/5/6/7 remain Ready for QA.** No issue is Done. Continue updating Jira live.

# Earlier: Astrid CAC-1–7 follow-up — 9 September 2026, late evening

**Jira workflow update, 10 September:** user explicitly requested live issue progress. Current read-back: **CAC-2 and CAC-4 = In Dev**; **CAC-1, CAC-3, CAC-5, CAC-6 and CAC-7 = Ready for QA**. None are Done. Keep Jira current while working, use In Testing for active QA, and return failures to In Dev. The rule is also in AGENTS.md. Ready for QA indicates an implemented candidate awaiting acceptance, not production release or completion of the full Astrid milestone.

Read [ASTRID-CAC-FOLLOWUP.md](ASTRID-CAC-FOLLOWUP.md) first. CAC-5/6/7 are now included: one room plus transparent floor shadows; totals below betting spots with neighbour-aware split clearance; consistent GPU edge cleanup without regenerated footage. The 3D/resting card share one bitmap and deliveries route to the nearest measured release for the actual card fan. All source media/audio and the other dealers are preserved.

The desktop scene now reserves space below the table using a shared actor/table/shoe/card camera transform. Deal Now is below the betting area, preventing its interception of centre-seat clicks. Phone gameplay follows the active server hand and keeps outer card fans in view. Actual seven-seat phone hit/bust/double/stand/settlement and split/side-bet checks were exercised on isolated4180 data. The latest real three-seat recording is available through the existing rehearsal button. See the follow-up for measured balances, evidence and limits.

Code checkpoint `85e09a4` is pushed and its GitLab regression pipeline passed. A verified private backup contains source changes and raw QA evidence. Refresh during fingertip contact also recovered the same cards and balance; the reported house-wins speech played twice with the room aligned.

Still staged: source pose discontinuities, motion softness, exact seven-seat capture, filmed reveal/collection/shoe-change, full phoneme approval and physical-device verification remain. Do not mark the full goal achieved from these tests. The implemented fringe/layout fixes used no generation credits. A subsequent single silent return-to-shoe candidate was generated and reviewed at source level; it is saved privately and **not installed**. See the follow-up's final section for the concrete next integration check. No Jira issue was closed.

# Earlier: Astrid CAC-1–4 checkpoint — 9 September 2026, evening

Read [ASTRID-CAC-FIXES.md](ASTRID-CAC-FIXES.md) for the issue-by-issue evidence and remaining limitations. Every CAC report refers to Astrid, even when named Vera. Current path remains `/?dealer=astrid&performance=staged&rehearsal=1`; 4176 serves the new static files after refresh. This is still staged, not the completed realism milestone or a production deployment.

The staged table now uses one clean room, full actor masks for every original Astrid stream, and matched masks with unchanged embedded goodluck/win audio. Native speech hides both idle RGB and idle hands. New left/right deliveries share the same first72 front-outlet frames as centre/own delivery. Silent takes play at1.75 after loading (about4s); speech stays1x. Controls avoid rendered cards/totals/wallet, with phone and split total positioning corrected. Active chip/total values read server hand stakes instead of the original betting draft.

Evidence is in the actual game: **Watch updated three-seat deal** opens the new recording. Initial left/centre/right plus upcard/hole, left hit, split, right double, dealer draws and two completed rounds were exercised on isolated4178 data. Refresh retained the same cards and balance. All four goodluck lines repeated twice; Astrid's other gameplay lines completed sequentially, native mute cleared its layers. Deep roster/performance/actor probes and36 hook tests passed;197 service checks,77 split checks and50,000 randomized rounds passed. See the report for exact observations; logs are not full lip-sync approval.

Outstanding: generated motion softness, some legacy-to-performance pose joins, corrective slides from the three direction releases to seven seat/card-fan destinations, real-device Safari/mobile acceptance, and filmed reveal/collection/shoe change. No CAC ticket was closed automatically. Do not replace source media or calibrations based only on these technical passes. Other dealers' assets are unchanged and local guest access remains enabled.

Screenshot reporting now preserves Steps/Expected Results in local JSON/Markdown before Jira posting and in every project's description. `tools/bugshot.sh` records the current local script, including concurrent expected-image additions; tests do not create Jira tickets. Missing historical Expected Results cannot be reconstructed from the existing CAC reports.

# Latest: front-outlet pickup and native movement resolution — 9 September 2026

Astrid's staged own-card delivery now reuses the first 72 frames of the good player extraction, then continues along the felt to her own cards. The former top-of-stack pickup is no longer selected. Both action videos now retain native 1080p RGB instead of being reduced to 720p. The player choreography and all four dealers' speech assets are preserved. No backend or login behavior changed.

Read [ASTRID-FRONT-OUTLET.md](ASTRID-FRONT-OUTLET.md) for the exact source recipe, events, shared-extraction regression, actual-game recording and remaining limits. The uninterrupted initial-deal proof includes player/upcard/player/hole; all four speech repetitions and all 32 checks pass. Refresh recovery and settlement were verified using the new isolated 4177 database. Preserve Kevin's 4176 data and any active hand.

The speech/idle-to-dealing room and pose transition is still visible: legacy clips have a baked background, while dealing uses an isolated actor. Native encoding improves source detail but cannot eliminate generated blur. Partial-card extraction, release-to-fan correction, mobile layout and the remaining filmed actions are not accepted. This is a staged improvement, not full milestone completion. The earlier checkpoints below are historical; the old high shoe pickup is superseded by this repair.

# Astrid actual-game dealing and transition checkpoint — 9 September 2026

For a clean continuation prompt, use the historical [PROJECT-HANDOVER-PROMPT.md in Jakobs-v1](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/docs/PROJECT-HANDOVER-PROMPT.md). It incorporates the useful parts of the older Claude handover while distinguishing historical instructions from the current implementation and Kevin's latest direction.

The active review path is `/?dealer=astrid&performance=staged&rehearsal=1` in the existing blackjack application. The normal dealer routes and existing speech assets remain preserved. This is a staged playable implementation, not completion of every item in the realistic-table plan.

- Player delivery and a separate dealer delivery use packed actor RGB, actor alpha and foreground fingers from one presented-video clock. Measured server-card corners follow contact, then release to the actual transformed DOM card fan. Pickup/landing cues use that same clock. The backend still owns all draws, balances, legal moves, cut position and settlements.
- The dealer take now handles her initial upcard, face-down hole card and all additional dealer draws. Hole-card reveal is still a CSS flip; there is no filmed reveal/collection/shoe-change take yet.
- A new empty-hand lead-in matches the folded resting pose to the original player take's entry. Its 24 frames are prepended; all original contact frames, speech assets and card tracking stay unchanged in speed. Rejected sweep and wrong-direction generations are not loaded.
- Removed long dissolves and the reset to the legacy idle between every card. The previous presented actor stays visible during loading; a new layer replaces it only when its first frame is rendered. No transparent actor blend is used during delivery. The last resting frame is held between actions, so waiting is currently static until another action or speech starts.
- One uniform camera fit registers dealer, shoe, table and tracked card on desktop and portrait viewports. No new account, registration, game or wallet API was introduced. Local guest access remains enabled.

Actual game checks: $5 initial rounds included player/upcard/player/hole delivery; stand performed two additional dealer draws and settled. Refresh recovered J clubs / 2 diamonds against dealer 4 spades with the same $995 balance and $5 bet. After the transition fix, two more consecutive own-card draws were recorded: the presented actor remained visible through the entire boundary, with no idle reset. The final initial-deal recording captured the new player-entry joins and all four deliveries; the recording tool stopped during the final return, while the game completed normally. Confirmed 6 hearts / 8 diamonds against 9 hearts and a face-down hole card, then refreshed to exactly those cards and the same $995 balance / $5 bet. Recordings are in `web/public/dealers/astrid/performance/initial-deal-review.mp4` and `dealer-turn-review.mp4`; they are silent visual evidence, not proof of audio output.

Regression: all four dealers' goodluck line played twice consecutively through the actual rehearsal interface. Astrid used embedded audio/video; Vera, Amira and Mei used matched original streams. Deep 90-stream asset audit passes with the pre-existing missing-take warnings. Hook suite and performance contract tests pass. Earlier in this checkpoint the service checks (197), split checks (77) and 50,000-round sweep passed. No real user database was modified for fixtures. Preview 4176 uses its own temporary data directory; do not delete it while Kevin is playing.

Known limits: extraction still fits partially occluded marker geometry; some release positions require a corrective slide. The own-card source reaches high on the shoe and briefly lifts the prop. Side-direction captures, filmed reveal/collection/shoe change, complete Astrid phoneme review, realistic continuous idle, native Safari and real iPhone/Android checks remain outstanding. The 390 × 844 check also exposed overlapping player/dealer card fans and duplicated mobile header elements; mobile layout is not accepted. Browser viewport checks do not substitute for physical-device acceptance. Do not enable this as default until the full plan's acceptance checks pass. The walkable prototype remains saved outside this milestone.

Source takes, exact packed assets, camera/events/frame records, generation receipts and repeatable preparation scripts are saved with this checkpoint. See `docs/ASTRID-CONTROLLED-CAPTURE.md`. Historical notes below are retained for recovery; current notes above take precedence.

# Walkable casino checkpoint — 9 September 2026

User clarified that the target includes moving a player around the casino, not just a filmed table. `/casino.html` is now a real navigable Three.js room connected to the existing four dealer routes. WASD/arrows, drag look, touch movement and click-to-walk table buttons work. First/third person can be switched. The table proximity prompt enters the existing blackjack game. The bottom “Walk casino” link returns to the saved approach position. Demo wallet and round remain server-owned; no new wallet or independent card simulation was added to the room.

The generated guest GLB (`assets/player.glb`, Tripo job `f048bb88-ceff-473f-92a5-020ba114a45a`) is a real textured full-body mesh. Higgsfield rigging job `ffe67af4-f21a-45c8-a76b-b0ae29fc3470` failed without a reason. `player-rig.mjs` binds a basic local locomotion skeleton to this specific A-pose mesh; it is not a facial or dealer-hand rig. Footstep sounds follow rendered gait phase, opt-in. Source/job metadata is preserved privately under `content/staging/2026-09-09/walkable/`.

Astrid background registration was scaled 32% too large: her 3168x1344 source needs scene width/height multipliers 2.63602/1.11831. Corrected the dealer configuration and removed the extra centre-plate vignette. Checked the actual seated scene at desktop width. No dealer speech media/calibration changed in this checkpoint.

Verified: generated avatar and gait rendered; click-to-walk reached Astrid and exposed seat action; entering table loaded the actual game. Started an isolated $5 hand (5 hearts + ace spades against dealer 6 spades), left to the floor, returned to the same position, sat again and recovered the same cards with $1,000 balance and $5 bet, without a second deduction. Stand completed and balance settled at $1,010. Phone controls and first-person view checked; no browser warnings/errors observed. Three navigation tests cover table/wall collision and table selection. Deep all-four-dealer audit still passes with existing known missing speech takes.

**Scope limits:** the walkable floor has real geometry and an animated guest, but no rigged dealer NPCs or multiplayer. Sitting transitions into the existing fixed-camera game. The earlier hand-contact rehearsal is still rejected for floating contact; Astrid's live action remains disabled rather than reusing the shuffling take. A reference clip can guide pickup/grip/release choreography; it is not model training. This is a playable development build, not photorealistic final delivery.

# Latest saved follow-up — 9 September 2026

The core checkpoint `a91f22c` is pushed and GitLab pipeline 2833139374 passed. No new John commits or recorded GitLab deployments were found during this session.

New hand-contact inspection: `/review/2026-09-09/contact.html`. The cleaned actor take now contains no generated card props. Its real 3D review card follows measured fingertips on the video frame clock, with pickup/landing sounds. This remains a review fixture: hand occlusion and actual table/shoe alignment are not accepted, so it does not replace live dealing. See `ASTRID-DEALING-RETAKE.md` for exact boundaries and next acceptance steps.

Astrid native goodluck was played twice consecutively and logged two complete embedded audio/video cycles. Earlier win twice and all-four-dealer repetitions also completed. These playback checks are not blanket approval of every phoneme or voice likeness.

# Croupier — gameplay handoff for John

Updated 9 September 2026. Read this alongside `ENVIRONMENT-RESTORATION.md` and Git history. This is a working demo with outstanding audiovisual defects, not final delivery.


## 9 September checkpoint — current work

Remote check found no newer commits from John, no open MRs and no GitLab deployment records. Branch head at start was `9721e82`; its pipeline 2829487983 passed. The Higgsfield top-up is now visible (1,002.12 credits at start), superseding the old credit blocker below.

Card foley now comes from presented 3D movement: a light extraction at the first visible movement and a separate soft felt contact at landing. Muted/hidden and skipped frames cannot replay stale pickup cues. The unfilmed hit-button knock was removed. Reduced-motion/DOM fallback emits landing only. All dealers share this path.

Astrid `win` and `goodluck` have new finished MP4s with embedded audio. `speech-media.json` selects these through the shared playback/abort queue; a native video overlays the existing dealer canvas in the same crop. No second MP3 or independent mouth clock runs for these takes. Original streams/calibrations remain intact. Exact transcripts and frame contact sheets were reviewed; voice likeness and full human phoneme acceptance remain open. Native media, text and review notes are now fingerprinted by the roster audit.

The procedural shoe now has beveled acrylic, rounded base/outlet/follower and steel fixings. The reached cut card lies beside the shoe. Counts and game rules still come from the server. A generated GLB failed shape/transparency review and is not used in gameplay.

`/review/2026-09-09/` shows the live shoe with rotation/full/half/cut controls and generated candidates. These inspection controls do not change any player's game. Two card-bearing Astrid action takes failed integration review: first changed framing; second retained framing/rest but produced duplicate cards, including one retained by person segmentation. An empty-hand actor plate is being generated for a server-owned 3D card to follow; no replacement action has been promoted yet. Mei's generated push is awaiting wording review because ASR reports “state” for “stake”; her existing audio is untouched.

Verification so far: 20 focused tests and deep 90-stream audit; all four dealers' goodluck rehearsed twice, Astrid native win twice; isolated Mei round dealt/stand/dealer draws/settlement returned to betting with $1,005 from $1,000 after a $5 winning hand, no browser errors. Gameplay rule suite: 197 service checks, persisted split/double/insurance/idempotency, 77 split assertions and 50,000-round sweep. No real player DB was modified for fixtures.

Local review server: localhost:4174, separate temp database. User preview: 127.0.0.1:4173. The preview server had stopped and was restarted. Low disk space prevented downloading a larger transcription model; the task's temporary Python environment was removed, freeing roughly 1 GB. Existing user files and previous private backups were preserved.

## Where the actual work is

- Working repository on Kevin's Mac: `/Users/solvifyab/Desktop/croupier`.
- Branch: `codex/restore-casino-environment`.
- The older `/Users/solvifyab/Desktop/Scout-Gaming/croupier` clone is not the current implementation.
- Local preview: run `sh web/preview.sh`, then open `http://127.0.0.1:4173/`.
- Four dealers: `?dealer=vera`, `?dealer=astrid`, `?dealer=amira`, `?dealer=mei`.
- Private recovered conversation: `/Users/solvifyab/Desktop/Scout-Gaming/.codex-audit/casino-conversation-recovered-2026-09-08.md`.
- Private checkpoints: `/Users/solvifyab/Desktop/Croupier-Backups/`. The Git bundle contains committed history. A separate working-media-and-code archive preserves nonignored modified/untracked product assets and scripts; the user database and ignored files remain only in the original workspace.
- Sharing an account does not by itself copy this Mac's workspace to another computer. Use the private GitLab branch below. No account invitation has been sent by this task.

## Open this project on John's computer

John needs access to the private `scout-gg/croupier` GitLab project and a Git client authenticated to GitLab. A GitLab account alone does not grant project access. In a terminal:

```sh
git clone --branch codex/restore-casino-environment git@gitlab.com:scout-gg/croupier.git
cd croupier
git config --local core.hooksPath .githooks
sh web/preview.sh
```

Use a Node version with `node:sqlite` support. The media audit also needs `ffprobe` from FFmpeg. No npm install is needed for the local server. Open the cloned `croupier` folder as a local project in the Codex desktop app, then open `http://127.0.0.1:4173/` and ask Codex to read `AGENTS.md` and this handoff before editing.

The clone contains the deployed dealer media and code. It creates a new local demo database; Kevin's accounts, wallet data and provider credentials are not transferred. Unfinished source media and the full recovered conversation are in Kevin's private checkpoint, not the GitLab branch. The committed handoff preserves the working context needed to start gameplay improvements.

## Product direction and completed foundation

Gameplay synchronization comes first, then conversation. Preserve the photographic dealer identities. The table, shoe and flying cards have Three.js geometry; the people remain video, not rigged 3D humans. The bottom table selector exposes all four dealers. Forced login is temporarily bypassed locally, at Kevin's request; the branded action-triggered modal and CRAIG integration remain in code.

The backend owns an eight-deck shoe, one burn, a 75% cut-card threshold, end-of-round reshuffles, idempotent actions and payouts. Frontend choreography waits for actual card landing. Split, double, insurance, settlement and cut-card transitions were tested on an isolated database. Automatic small talk is disabled.

## Sync status — do not assume approved

| Dealer | Indexed speech takes | Missing bank takes | Remaining work |
| --- | ---: | --- | --- |
| Vera | 32 | greet_back, limits_vip, house_edge, thanks, small_talk, side_when, ask_me, farewell_bank | Review every spoken line; filmed hands do not grip arbitrary 3D cards. |
| Astrid | 17 | None | goodluck/win word-to-mouth mismatch needs replacement takes. Other lines still need full visual review. Fingertips are clipped in the dealing source. |
| Amira | 15 | chatter1, chatter2 | Full visual review and new dealing-action footage. |
| Mei | 14 | push, chatter1, chatter2 | Full visual review; push is a gameplay gap. New dealing-action footage needed. |

All existing speech takes have calibration and enough total video duration for audio plus delay. All 90 main streams are checked for index integrity and B-frame compatibility. These checks cannot prove correct phonemes. The initial hash baseline records the current imperfect state; it is NOT an approved-quality baseline.

**Latest user review: Astrid’s existing action looks like shuffling and is rejected as realistic dealing.** See `ASTRID-DEALING-RETAKE.md` for the verified source defect and replacement contract. No replacement take has been generated. Kevin approved the saved four-panel storyboard in `docs/reference/astrid-dealing-approved-concept.png`. The rejected action is disabled in gameplay; direct shoe delivery is temporary until the approved motion exists.

Astrid has four measured fingertip release cues. Cards wait for painted video frames, and the dealer returns to rest after the last delivery. This improves timing, but does not create missing fingers or a genuine filmed shoe pickup. Amira/Mei do not have dealing footage. Do not describe the entire roster as hand-synced.

Generation remains blocked: the connected Higgsfield Team workspace reported 3.02 credits after Kevin said he topped up. The available Chrome profile was signed out. Identify the credited workspace/account. Unlimited website passes do not cover MCP/CLI. Do not purchase another pass automatically. The earlier 180-credit estimate covered two Astrid speech takes with one retry each, not all dealer hands.

## Safe change and review workflow

1. Enable the versioned local checks after cloning: `git config --local core.hooksPath .githooks`.
2. Run `node pipeline/audit-dealer-sync.mjs --probe` (Node and ffprobe required). It fails for unexpected media/text/calibration changes, invalid indexes, B frames or audio longer than its take. Known missing takes remain explicitly listed.
3. Prepare one replacement in a separate staging folder. Preserve the exact identity, voice and words. Keep both hands inside frame for dealing; stage a full action including rest, pickup/contact, release and return.
4. Rebuild the staging index, calibrate the new asset pair, then review it with sound. An identical index rebuild preserves timing/other clips; replacing a calibrated live take with different bytes is rejected.
5. Use the in-game rehearsal at `/?dealer=mei&rehearsal=1` (change dealer via its selector). Review every changed line twice, then greeting, goodluck, double, bust, insurance, win, lose and push across all four dealers. Watch word shape, pauses, final mouth closure, transitions and hands. Compare the original approved take if one exists. Do not use the old `/lab/` pilot videos as evidence for the shipped player.
6. Record dealer, line, reason, before/after hashes, measured delay, reviewer/date, visual result and remaining defects in the change description. No take currently has blanket visual approval.
7. After the intentional media diff has been reviewed, record it with `node pipeline/audit-dealer-sync.mjs --record-baseline --probe`. Inspect the JSON diff. Never use this command simply to silence a failing check.
8. Run `.githooks/pre-commit`, `node test/shoe-game.mjs`, and `node test/split-rules.mjs`. Check initial deal, hit, stand, split, double, insurance and next round in an isolated database. CI repeats the tests when pushed to GitLab; it has not yet run remotely.
9. Commit a bounded change and update this handoff. Run `python3 pipeline/save-checkpoint.py --transcript /path/to/this-session.jsonl` to save a verified Git bundle, handoff, readable conversation, unfinished media/code archive and checksum manifest outside the repo. Without `--transcript`, it still backs up committed history and the handoff. Do not reset the existing dirty raw-media work.

## Code map

- `web/public/app.mjs`: shared choreography, speech queue and rehearsal UI.
- `web/public/dealer-engine.mjs`: WebCodecs frame presentation and hand mattes.
- `web/public/speech-playback.mjs`: speech cancellation/timer ownership.
- `web/public/speech-lines.mjs`: fallback captions; each dealer's audio bank overrides them.
- `web/public/dealing-card.mjs`, `table-scene.mjs`: 3D card/table rendering.
- `pipeline/build-index.mjs`: safe, metadata-preserving partial index rebuilds.
- `pipeline/audit-dealer-sync.mjs`, `docs/dealer-sync-baseline.json`: roster regression gate.
- `.githooks/pre-commit`, `.gitlab-ci.yml`: local and remote test entry points.

## Conversation continuity

The Codex conversation reader returned only the beginning, while the local session contained later messages and the repo retained later commits. A readable transcript was recovered. The app display itself was not repaired. Future work must update this handoff and Git independently of the chat UI. No process can guarantee that the app will never hide history again; these files make the project recoverable without it.

## 2026-09-14 — isolated centre whole-action review

Existing145-frame contact-proof source is now a separately opt-in box3 first-card candidate in isolated4190; no generation spend or public4173 promotion.85-frame60fps ledger preserves explicit packedNative/sourceNative mapping and binds only issued server card identity. Uses existingsource low shoe pickup, supported centre slide and emptyreturn; no physical turnover yet. Schema, source hashes, mask limitations and reproduction scripts live under content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/box3.

Explicit astridBox3=contact AND astridBox0=review with dealer=astrid, exact1091×837 layout only. Whole .cards basis/translation aligns source-supported landing, betting spot shifts10screenpx before bets; actor is not warped. Realcornercheck remains.02nativepx; bottomgap≥3screenpx and neighborcell bounds enforced. Other viewports/splits/latercardindices remain excluded. Shoemask asset/path/hash and native38–48 range validated; playback waits for texture under bounded cancelable preparation. Existing GPU cleanup, nativeclock, hidden-card stripping and exactly-once landing remain.

Root actualfirst-round evidence gameplay-first-round.json records completedcandidate, one land64,84callbacks1–84, zero dropped frames,11GPUresources disposed; maxcornererror~.000126native and shiftedspotgap~5.73screenpx. gameplay-settlement.json records returnedbettingstate and isolatedstake5 wallet980→975→985, returned10. These prove one scoped gameplay path, not seven-seat/fullmotion visualapproval. Actor seams, remaining maskfringes, no turnover, secondcardlegacy and broaderfan/responsiveclearance remain unaccepted.

Validation:27focused integration/layout/loader/GPU/adaptertests, required audit-dealer-sync --probe and fullpre-commit passed; shoe/service197checks and split77checks passed. Shared other-dealer audit is regression baseline only; no unrelated dealer visualacceptance claimed. No publicmedia, walletauthority or realuserdatabase changed. Dirty unrelated audio/source/pipeline work preserved.

Second actual round is saved in box3/gameplay-second-round.json: insurance declined, dealer blackjack, stake5/returned0, wallet985→980 and readybets. Root third-round inlinebrowser view saw supportedslide/hand contact afterframe40; pickupfirst30 not captured. No screenshotfiles persisted, and no visual60fpsapproval inferred. Subsequentcards/otherseats still legacy; seams remain unaccepted.

Third same-view isolated round finished: box3/gameplay-third-settlement.json records stake5, stand, returned0, wallet980→975, readybets. Three finished same-view rounds now have persisted state evidence. Third motion observation was four inline CUA screenshots, not saved image artifacts; it does not establish pickup completeness, smooth60 visualapproval or all-seat/second-card delivery. Current isolated wallet975, gameplay ready for bets.

### Centre shoe-contact diagnostic follow-up

Box3 diagnostic sample frames now target actual shoe extraction22/30/34/40. Root fullscene CUA observation saw hand at source shoe outlet, one face-upcard emerging beneath lip, then supportedslide. Saved box3/gameplay-shoe-contact.json contains receipts and honest inline-only scope; no continuousvideo/physicalturn/60fpsapproval inferred. Probe and fullpre-commit passed after this diagnostic-only change.

Read-only second-card findings are saved in box3/SECOND-CARD-FINDING.md andsecond-card-geometry.json: actualtransformedindex1fan target differs27.524nativepx fromfilmedlanding; hitindex2 differs55.047px and hasonly.518screenpx betting-spotgap. Refittingwholehand wouldmoveexistingcards; postreleaseautofan lacksfilmedcontact. Keepfirstcard-only gate; futureextension needs actualplacement or arrangingmotion, preservingissuedcards/oldcardpositions. No generation spend or movement workaround implemented.

### Persisted centre full-scene and source-coverage evidence

box3/full-scene-proof now contains8full-scene JPGs at output22,30,34,40,63,64,75,84 plus index.html and receipt. Root verified currentrough-box3 ownership during capture; stale earlier84 attempt discarded. These show shoehand/singleface-upcard emergence, supportedslide, and stationarylandedcard while emptyhandreturns. Stillimages do not prove smooth60video or physicalturnover. No further source approval inferred.

seven-seat-source-audit/MAP.md, provenance/endpointJSON and3smallsourcecontact sheets inventory existing actions. There are real left/centre/right directional sources and nearby box2/4 candidates; no seven calibrated/reviewed release/return actions. Box5 currently hastransit ratherthanitsownrelease; side-source seam/camera fitting remains required. This evidence does not justify new spending or relaxing exacttarget gates. No tests repeated for this documentation/evidence-only update.

## 2026-09-14 — dealer upcard actually integrated in isolated gameplay

No new generation spend. Added explicit astridDealerUp=review with astridBox0=review on isolated4190, Astrid only, first face-up dealer card. Existing prepared entry/contact plus registered right continuation now encoded85frames60fps and bound to actual issued card. Three actual rounds played and settled; each candidate landed exactly once. Actual target error below0.00004nativepx; renderer disposed11resources. Eight actual fullscene screenshots and gameplay-review.html saved under game-runtime/dealer-up. Screenshots are near checkpoints, not exact-frame or continuous-motion acceptance.

NOT DELIVERED as finished quality:17 dropped frames in third no-capture run (19 first,12 capture run); source seam, residual mask fragments and no physical turnover remain. Later cards/allsevenpositions not replaced. Whole dealer hand moved to source-supported endpoint; fan readability/clearance still unapproved. No public4173 promotion. Next: trim transparent atlas extent with reviewed mask bounds to reduce decoding load while preserving native actor/card placement, then rerun no-capture fullround and inspect seams.

Required full pre-commit and audit-dealer-sync --probe passed. Source/mask provenance stays recorded in media receipt and source registrations. Actual test URL adds astridBox3=contact and astridDealerUp=review to existing review flags; exact1091x837 scope.

## 2026-09-14 — native crop and rejected predecode experiment

Exact native actor crop674,54,694,720 reduces atlas decodearea75.90%, all85source/alpha pairs inspected. CroppedB2 still19drops; croppedB0 twoactualrounds11drops each and fullybufferedready4. No smooth60claim. Added source-hashed Annex-Bpredecoder and separate wallclockRAF path behind astridNativeFrames=review; actual1470x837 round skipped41frames, so rejected as replacement and removedflagfromuserURL aftertest. It decoded85 in86.5ms, closesall85plus11GPUresources; source/cardgeometry preserved. Native-source seven andclocktwo focusedtests plusrole two passed; requiredprobe/precommit rerun with scopedcommit.

See dealer-up/PERFORMANCE-REVIEW.md and gameplay-native-first-round.json. Existing source return/entry armstack mismatch confirmed in transition-review; novalidexisting bridge found. Donot repeat exhausted crop/codec guesses. Neither whole7seatdelivery nor seamlessreturn achieved, no generationcredits used. Current userview changedto1470x837; dealerupwholehandlayout has explicitreviewgate for1091x837or1470x837, same.02nativecornertolerance. Box3firstcardstillonly1091x837. Nativepathnotdefault.

## 2026-09-14 — background lamp remnants removed in dealer-up gameplay

Clean85mask candidate committed separately: sourceRGB untouched, original masks preserved,143173 deletedbackgroundalphapositions in40prefixframes;45rightframes byte-identical. All40source/beforeafterpairs inspected. Longhairlampstreak andlargeshoulderplates removed; ambiguoushair/ear/jaw/suitmixededges retained. Native cropandcardgeometry unchanged. NewmediaSHA6eaeb50367a690bc991df3803b42cd4287d6c72f12377ce9d630163c4cf87e7b isactive underexistingisolateddealerupflag. Root capturedactualgameframes0/30; twoactualrounds landedoneauthoritativecardeach andsettled, latestwallet935. clean-review.html containsbeforeafterandgameview. This islimitedbackgroundcleanup, notfullvisualacceptance.

Nativeclockv2 also failed41skips at1091x837; ownclock/testeditsrestored, patchandroundevidence saved. Do not repeat callback-order/crop/B-frame guesses without new evidence. Nativealternativeflag remains off. Requiredprobe/fullprecommit passedaftermediachange. No credits spent. Naturalreturn,allsevenmotions,turnover,fullqualityandframepacing remainunfinished.

## 2026-09-14 — continuous footage across one through seven gameplay seats

The user requested the best playable experience with existing material and no further spending. The isolated astridsingleseat.localhost:4190 opening now uses the existing camera-locked four-card film plus filmed return across all active-seat counts. Authoritative opening order is preserved across groups of four; an optional remainder of two uses the prior individual route. Hole-card values are stripped. Later hit/double/split/dealer draws remain individual. No public4173 or backend/database code changes.

Source-held cards follow their measured ledger, then a12-frame authored slide reaches the actual DOM target. Actor is not stretched. This is functional integration, not exact physical contact approval. Existing mask/seam and destination mismatch limitations remain. Frame333 now ends playback after empty return, omitting16 tail frames without moving release cues. Reference comparison and provenance remain in continuous-demo/README.md and media-receipt.json.

Actual isolated rounds: seven seats received all16 opening cards and settled; opposite two seats completed continuous-to-individual handoff and settlement; one left seat completed opening, Hit (8→14), Stand, dealer reveal and settlement. Evidence: game-runtime/continuous-demo/all-seats-qa. One/two-seat receipts verify the new333 endpoint. Preparation/video/texture deadlines, hide/resize cancellation, idempotent cleanup/landing and premature-end rejection protect the round from a stalled visual. These are not a claim that all possible rounds or source transitions are visually accepted. Existing dealer sync/precommit checks passed; focused tests cover lifecycle and all1–7 queue counts. The full user goal remains open.

## 2026-09-14 — remove base-idle flashes between continuous groups

The continuous opening now retains one video, GPU and engine suspension through all full four-card groups. Previously each group disposed everything and exposed the base idle while loading the next group. Current code holds the actual rendered endpoint during bounded seek to0, resets card state for the next issued group, and releases ownership only before an individual remainder or at completion. This removes the avoidable base-idle/crossed-arm flash; it does not disguise the remaining333→0 source pose cut. Source and camera geometry are unchanged, no new media/spending.

Two actual seven-seat rounds settled after the refactor. continuity-qa contains16-card receipts,204 DOM samples across the second round (116 active, exactly one actor and no missing owner), two actual boundary screenshots, Double11→21 evidence and settlements. Second round wallet842.50→807.50→802.50→827.50, returned25 on40 staked. Eighteen focused tests and required probe/precommit passed. Late cancelled ledger preparation is prevented from creating/loading a video after disposal. Remaining source seams and physical hand-to-seat mismatch are not marked accepted; full user goal remains open.

Additional actual two-seat QA after resource reuse: continuous→individual remainder completed; pair-of-sevens Split produced two17 hands, both Stand, dealer settlement and return to bets. continuity-qa/split-* stores screenshot/results; wallet827.50→817.50→812.50→845.00 (15 staked,32.50 returned). No continuous layer remained while split controls were active.

## 2026-09-14 — decelerating post-release card glides

Continuous-demo now gives long post-release movements more time and slows them to rest instead of a fixed12-frame linear snap. Source RGB, hand motion, release frames and333 endpoint unchanged. Source-plane duration12–28frames, quadratic ease-out, exact target corners; near-zero movement lands immediately. The6000px/s² coefficient is authored, not measured. Cached YouTube4–9second/native306–335 qualitative review supports softer stopping, not proof of filmed momentum.

Actual seven-seat round recorded16 complete one-time landings (durations13–26frames), then all hands settled and returned to bets:845→810→882.50,35 staked,72.50 returned. Evidence under continuous-demo/glide-qa; five trajectory tests added. Remaining physical limitation: generated actor places the card away from some real targets; glides can cross existing cards. This change improves styling, not seven distinct physical reaches or source-seam acceptance. No generation spend. Full user goal stays open.

## 2026-09-14 — existing silent bridge finally connected to gameplay

Fresh Higgsfield history review found completed31828ef9, already stored under idle-registration/bridge-pair. The older speech-continuation PLAN and previous no-bridge conclusions were stale for this asset. Reused the edge-clean97@24 R-only pack and recorded required endpoint matrices directly, not compounded twice. No generation, source RGB edits, speech substitutions or public4173 changes. Media hashes now in continuous-demo/media-receipt.json.

Final full opening group ends348 (exact raw return30), then plays existingbridge0..96 and waits behind its visible final actor until actual engine idle0 is presented. Intermediate groups still end333. Session resources dispose afterward; failures are bounded. Applies when opening ends with fullgroup (1/3/5/7 seats); even-seat individual remainders retain their existingreturn.

Actual one-seat and three-seat rounds both played the bridge and settled:882.50→877.50→887.50 and887.50→872.50→902.50. First trace includes all97nativeframes; return-qa contains actual motion/idle screenshots, receipts andsettlements. All26 focusedtests and requiredprobe/precommit passed. Residual source edge fringes/colour differences remain; initial crossed-idle→dealing entry remains unsolved. A silent empty-hand reverse of this same bridge is a reasonable future entry candidate, but its initial hold must be shortened and actual handoff reviewed; no entry derivative has been made. Full goal remains active.
## 2026-09-20 — verified rollout and voice follow-up

Director dep-dankqvrtqb8s73c8igt0 and Gateway dep-dankro3m8hqs73blijsg are live
on 0a1f9cb. Blueprint sync exe-dankqsp7lnhs73e9ujq0 changed advice timeout;
authenticated Director status reports 8000ms. Upstream remains pinned 2026.9.5.
Native validation completed before runtime startup. All three role contexts
installed package 2026-09-20.1, sha256
d4008a2d889f447ecf79a907de1511d46ce97ff40cd6acd9c61f5e77ade0459f,
with injection always and no warnings. No owner errors in the new startup log;
cron scheduler and heartbeat remain disabled. The memory plugin created its
managed job record, not an enabled scheduler.

Fresh local API -> Render -> Gateway chat correctly reported package version,
official sources, 16-group distinction and no Windows file access (4815ms).
Live active advice accepted contextual candidate (1995ms); shadow kept baseline
despite real advice (1896ms). One earlier probe during startup returned 503;
not counted as success. These are small dated samples, not a latency guarantee.

Three short demo phrases now have actual ignored ElevenLabs cache MP3s. Browser
cache replay passed. Chrome played the welcome audio to ended=true at 2.229116s
with no media error; IAB crashed on native play, so use Chrome for now.
Separate page-only GET navigation guard fixes external-link initial load while
retaining API, iframe, fetch and mutation guards. Sidebar now says presentation
types, not motor types. Lab 138/138, runtime suite 79/79 and typecheck pass;
production rebuild and Chrome direct-navigation verification passed. No new product-media regression claimed or needed
for these local lab/deployment changes; prior known product take gaps remain.

## 2026-09-20 — later OpenClaw context, situation UI and local voice panel

Bounded lab/deployment iteration, not gameplay or production media changes.
Pinned OpenClaw stays 2026.9.5. Versioned runtime-bundle installs compact role
instructions (director/chat/operator) into managed AGENTS blocks, with official
source index and shared situation/family/take model for chat/operator. Runs even
when native config is reused; preserves human text, SOUL/IDENTITY, backups and
permissions. Independent review caught/fixed interrupted immutable-file writes.
Missing systemAgent/Talk ownership defaults use the existing operator only;
human ownership choices survive. No cron, tools or voice permissions enabled.

Blueprint and local test config use 8000ms advice timeout; local relay adds
1500ms transport margin, operator chat remains 30s. No credential changes.
HTTP role prompts distinguish 6 public types, 16 lab groups, concrete situation,
eligibility, exact speech and proposals. Native config is validated before use.

Node tree shows factual concrete example fields before expression choice,
including zero/false/null, and separates two trigger groups from OpenClaw.
No schema, catalog, saved project, seed or product media modification.
Local OpenClaw page adds explicit ElevenLabs Sarah voice preview: 3 demo phrases,
custom text or copied operator reply, 500 chars, 30s, bounded MP3, hash-indexed
local cache and deduplication. No autoplay or automatic player speech/lipsync.
One actual welcome generation succeeded; cached UI replay reused it; ffprobe
reports valid MP3, mono 44.1kHz, 2.229116s. Codex IAB tab crashed on pressing
the native audio play button; browser playback verification still pending.

Tests so far: lab 133/133, typecheck and production build pass. Runtime suite
and actual Render deployment/probes are being verified separately; this
pre-deployment note is not proof of successful rollout. Current user asked
for redeployment and small real probes. Branch is jakeminator123/work only.
No CAC issue supplied/closed. Product missing takes and compatibility gaps remain.
Thin note: jakob-docs/2026-09-20-openclaw-instruktioner-och-rostpanel.md.
## 2026-09-20 — one lab Guide, canonical vocabulary and bounded video bank

Jakob shortened this goal from 40 to 25 minutes. Consolidated the daily work
documentation into `/guide` inside the existing Studio shell, sourced from
`lab/docs/guide.json`; glossary comes from `lab/policies/studio-contract.json`.
Existing jakob-docs and proposal links remain intact as reference/history,
with a redirecting start note. Private login notes were not read or staged.

Shared manifest owns dealer IDs, six source types, sixteen event groups,
video kinds, exact situations, selection defaults and limits. The new video
schema and consistency tests lock these together with seed/runtime validation.
`once` is the only supported playback value; loop remains explicitly proposed.
No engine event, game playback, original media, Render or Gateway was changed.

Dashboard: Guide/OpenClaw no longer display the unrelated event sidebar.
Upload, extra filters and detailed coverage stay folded. Video bank starts at
the selected dealer/event group, with separate Inbox and all-originals views.
One shared form replaces duplicate metadata fields; video kind follows the event.
Archive originals can be classified via localhost-only `/api/videos/classify`:
hash-scoped metadata overlay, optimistic conflict checks, atomic rename and lock.
Original bytes remain in place. Unclassified/legacy-imprecise films are no longer
eligible everywhere. Existing project references are preserved, visibly flagged
and must be classified or detached before save/test. No automatic bulk labels.

Verification: 188 lab tests pass, including all dealers/groups/situations,
schema drift, fail-closed binding, immutable archive bytes, reload, concurrent
stale-write rejection and corrupt-overlay preservation. Browser QA on isolated
data directory/port4192 confirmed Guide layout, 224 originals in Inbox, metadata
save, wrong-group binding disabled, correct-group binding, draft survival across
Guide navigation and project save. This is metadata/workflow verification, not
visual content approval of those 224 videos. No paid model requests or real DB.
Production build and TypeScript check passed at delivery. Jira connector unavailable; no Jira transitions.
Remaining: operator classification/content review of originals; loop/interrupt
policy and runtime promotion remain separate work, not silently enabled here.

## 2026-09-19 — user-selected a9fa1da6 cutout, no new generation

The user changed direction, prohibited new generation until explicit authorization, and took over clip selection. The previous overnight automation is paused. They selected existing Kling clip a9fa1da6-066c-47f4-8466-7f4924a3bfe2 (box2-reach.mp4, 73 native frames, 24 fps, 1280x720) and explicitly chose to keep Astrid **and the original card** while masking the background.

Standalone masked result: web/public/review/astrid-a9fa1da6. Includes real-alpha WebM, RGB-over-gray-mask MP4, all 73 editable masks in ZIP, checkerboard preview and browser viewer. Source frame RGB is unchanged before ordinary video encoding; no retiming, interpolation, face repair or new generation. Removed room, table, shoe and stray table lettering; retained the original card through extraction, hand transfer, passage in front of the shoe, placement and empty return. Local reproducible processing and SHA/probe receipt: content/staging/2026-09-19/a9fa1da6-mask.

Reviewed all 73 frames in contact sheets and actual browser alpha playback against checkerboard, light and dark backgrounds. Verified 73 output frames at 24 fps, actual decoded alpha (not just a metadata flag), and unchanged RGBA RGB channels before encoding. Pre-commit suite and audit-dealer-sync --probe passed. Saved light/dark browser evidence with the deliverable. Small segmentation edge imperfections and source-generated motion remain; this is not a new gameplay acceptance claim. The original loop endpoint is not identical to its start. No BO assignment, gameplay route, wallet or speech change.

The normal 4173 server gates media behind authentication, so the viewer is currently served on localhost-only http://127.0.0.1:4198/ from the result directory, with no database or auth changes. Start again with python3 -m http.server 4198 --bind 127.0.0.1 --directory web/public/review/astrid-a9fa1da6 from the repo. User-visible tab was left open playing the cutout.


## 2026-09-19 — green-screen first exhibit and recovered winning references

User changed direction to hands-on green-screen generation, with a green tracking card; broad autonomous generation remains paused. Read live backoffice through the supplied existing deploy key, without writing remote files/data: 17 want and 52 no verdicts; a9fa1da6 is want/box2. Sanitized choices and receipts are in content/staging/2026-09-19/astrid-green-exhibit-01.

Generated two GPT Image 2.5 green studio references and one Kling 3.0 test ac7852f7. Root inspected 16 sampled frames and rejected the motion: card moves independently while hands mostly remain resting. New references also redraw Astrid and change framing. The test is shown at local4198/green-exhibit-01 with a visible rejection warning, never installed in gameplay. Required pre-commit suites and dealer-sync probe passed; this does not approve the generated take.

User explicitly demanded Seedance with their winning prompt. Copied the exact saved parameters from accepted9dc93653 (Seedance2.0,4s,1080p,std,high bitrate,silent) and changed only green environment/card wording; original and precise substitutions are in astrid-green-exhibit-02-seedance. Submitted ONE job175d2d0f-d5b2-4e3b-a0ec-23002a828eae using the already-generated green images. It has completed: source, probe, SHA, 20 sampled frames and observations are saved. It carries the card with the feeding hand directly across the body, with no receiving-hand transfer, and releases around3.2s instead of0.9s. The rejected green-reference likeness remains. Not installed; do not resubmit.

User then challenged the likeness. Root recovered and byte-verified the actual winning inputs: start43039066 = far-left-anchor/motion/ready.jpg; end0dc1ddf8 = box1-trial-spec/endpoint-upload.jpg. Local copies and hashes are saved in the second exhibit directory. The actual winner's end image shows a turned head/body with a hand reaching the shoe, unlike the newly generated forward-facing green resting endpoint. Historical TRIAL.md prose claiming the endpoint leaves the actor unchanged conflicts with these verified pixels. The winning job had only these two image references, no portrait reference. Both originals were shown to the user. No additional images or jobs submitted after this discovery. Do not claim this Seedance output fixes the reference likeness. Preserve this audit and follow the user's reference direction. No production deployment, live database, wallet, game card, speech asset or 3D change.


## 2026-09-19 — user corrects authoritative Astrid identity

User explicitly rejected the recovered full-scene refs for likeness and directed use of `ref-identity.png`. Exact file found at /Users/solvifyab/Desktop/ref-identity.png,1440square,SHA d31c47ded053bfcaf8c8d54a5c806793e5818cede8453c7bfa0323d36a6b347b. This instruction supersedes the earlier recommendation to preserve the two old scene faces. The original was inspected, copied without alteration to content/staging/2026-09-19/astrid-identity-green, and uploaded through MCP as b2c16866-56c4-4406-bbb1-7fed713ca485.

New green start75d580c2 uses only that user image; end2d808f07 uses the new start plus that original user image. Both were inspected. Seedance2.0 job6975244a-5b47-43e1-8176-5356066f3e72 is now submitted with green start/end AND the original identity image directly as an additional image reference. Preserves winner9dc93653's4s1080p,std,high bitrate,silent settings and mechanical-action/timing prompt; only green environment/card substitutions and an explicit identity-reference sentence differ. All requests, outputs and identity manifest saved in the new staging directory. Job6975244a completed and is saved with SHA/probe and20 sampled frames. The original identity photo is directly attached, but motion still raises the card to about chest height around1.17s, lacks a two-hand transfer and releases only around2.7s. No likeness or motion approval; exact source-frame composition also differs. Review at local4198/identity-green displays original identity plus source video with explicit limitations. No automatic wider generation or gameplay installation; do not resubmit.
# 2026-09-19 — first dealer-upcard scope and elevated-camera correction

Latest user correction supersedes the earlier acceptance of green6975244a: it is only Astrid's FIRST FACE-UP CARD TO HERSELF, and after seeing the table trial the user rejects its low/frontal camera. They require the elevated player-side broadcast angle of the supplied YouTube reference, including table/shoe references in generation. Retain original `/Users/solvifyab/Desktop/ref-identity.png` as sole identity source. Green studio, green shoe and green tracking card remain the direction. No 3D or broader overnight loop.

Prior turn prepared97native24fps actor mattes and card-plane tracks under `content/staging/2026-09-19/astrid-green-table`, then a narrowly gated first-upcard integration. Its take is now explicitly `enabled:false`; app excludes it, and the build script also reproduces disabled state. Original source RGB was preserved before encoding, card track uses explicit inference flags, body fit is rigid. Shared player supports review-only chroma tracking and exact filmed landing. Experimental code and local artifacts are retained, not approved or deployed. Existing server cards/wallet and exact speech unchanged. Independent mask/track/integration agents did not edit overlapping game files.

Seedance returnfc238e02 completed from exact old source96→0 endpoints plus original identity. Its empty hands move near shoe, but user camera rejection makes it obsolete; never installed. Required dealer-sync probe, pre-commit suites and three first-upcard scope tests passed before the new camera integration; full rendered acceptance did not pass.

New GPT Image2.5 reference269f8943 completed using THREE actual references: original identityb2c16866, cached nativeYouTubeframe0 uploadffe36559, saved actual game-table cameraupload0fe2ef3d. User explicitly approved it: “Use this angle”. Matching end reference5b334c87 places a single green card in her own upcard location. Seedance2.0 jobde1f90a9-b8db-4a64-a46d-7c8f9d0665ef is COMPLETED (97 native frames at24fps,1920×1080, source SHA dfaeea2b4dae3cad918a2a3af9114d261131939ea636cf2e3427172b3b33402b). Do not poll or duplicate. Inputs, requests, results and approval are in `content/staging/2026-09-19/astrid-elevated-camera`. Initial source review shows one extraction, transfer/turn, dealer-center landing and empty return; frame0 already reaches the shoe, so entry is not matched to old idle. Masking/card tracking and actual table fit are in progress, not accepted. Local viewer: `http://127.0.0.1:4198/elevated-camera/`; serves from `web/public/review/astrid-a9fa1da6` with no database.

Update: elevated take now masked, tracked and installed for **first dealer upcard only** at `http://astridelevated.localhost:4190/?dealer=astrid&performance=staged&astridGreen=review`. All97native mattes/tracks inspected. Source RGB preserved; actor fit rigid; actual shoe front lip and authoritative dealer-card DOM registered to new source. One actual isolated round completed with new J-clubs upcard, player hit, refresh preservation and settlement1000→995→1005. Nine replay screenshots cover pickup/turn/landing/return; browser warnings/errors empty. Four scoped tests, repository checks and sync probe pass. See `astrid-elevated-camera/REVIEW.md` and `gameplay-qa`. This is a visible first-card integration, not full visual acceptance: old/new clip cuts remain, green shoe is a geometric proxy, and blurred turn27–29 uses declared inferred correspondence. No further generation or production deployment. The table is left at betting with one5-unit centre stake ready for Deal Now.

## 2026-09-19 — remove retired Astrid playback; keep green baseline

User explicitly requested removal of every other Astrid clip, retaining elevated green take `de1f90a9` as the first successful baseline. They are correcting the table in Blender: do not edit that work or change the accepted source framing. A new green-screen waiting movement is future work; this turn did not submit any generation. The earlier broad overnight task remains paused.

All ordinary 2D Astrid routes now disable the previous engine initialization, idle/gesture clips, recorded speech and audio, BO clip assignments, performance manifests, joins and ready loops. Old sources remain archived on disk. Only `review/astrid-elevated-table/take.json` can supply her first face-up dealer card; player deliveries, hole card and later dealer cards cannot consume this take. Other dealer playback, server-owned cards, wallets and databases are unchanged. Explicit 3D review remains outside this reset and paused.

Waiting now displays a temporary still from masked source frame96: `review/astrid-elevated-table/rest.png`, cropped with the same `[560,0,960,760]` crop and registered by the same camera transform as the action. It hides during the retained action and returns afterward without revealing the old crossed-arm idle. The existing static room plate is preserved. No new camera scale, zoom, source retiming or table geometry change was made.

Browser verification in isolated guest `astridreset.localhost:4190`: complete round, first dealer6-hearts, player3-clubs/A-diamonds, hitK-hearts, stand and settlement. Wallet1000→995→995, stake5/return0. A replay also used only `astrid-elevated-first-upcard-de1f90a9`; action and still had identical519.109×410.961px bounds at1280×720, old dealer wrapper stayed hidden, resting still hid during action and returned after it. No browser warnings/errors. User's existing elevated-table tab was refreshed and the new still verified at their portrait viewport; their hand was not played by the agent. Evidence: `astrid-elevated-camera/gameplay-reset-qa`.

Four first-upcard scope tests, `audit-dealer-sync.mjs --probe` and `.githooks/pre-commit` passed. This verifies removal of old playback, not a finished dealer: waiting is intentionally still, speech is silent, and no green player-seat or later-card motion exists yet. Native source96→0 pose cut remains; do not describe it as a seamless idle or full motion acceptance.

## 2026-09-19 — user's Blender table, elevated camera and smaller framing

User provided `/Users/solvifyab/Desktop/table-v2.blend`, explicitly requested rebuilding the mask for that table, and then requested Astrid smaller/farther away like the generated preview. Original Blender file is untouched (SHA25606e425527ab43a22a0b503f2c2792f8dd0bacccf1cd6ff56c60c78c7a00fb0dc). Exact meshes/materials and PlateCam exported to `review/astrid-table-v2/table.glb`; fixed PRP_Card excluded so only server-issued cards appear. Game lighting is supplied separately. No generation jobs, credentials, database changes or deployment.

Astrid now uses the imported perspective camera and table by default. Her existing approved de1f90a9 source was re-keyed across all97frames, reproducing the prior verified alpha exactly; masking does not change the recorded angle. Removed the old20px gameplay-only source Y offset. Latest requested framing is a shared0.85 composition scale: table, shoe, actor, tracked card and rest all pull back together, with no body stretch or isolated actor zoom. The unchanged source frame96 remains the temporary still while new idle movement is pending. All other Astrid clips remain disconnected.

Evidence/rebuild scripts: `content/staging/2026-09-19/astrid-table-v2`. Actual isolated browser rounds on `astridblenderv2.localhost:4190`: first round playerK-spades/8-diamonds, dealer7-diamonds, hit and loss1000→995; final pulled-back round player8-spades/8-clubs, dealerQ-clubs, stand and loss995→990. Both returned to betting. First-upcard replay captured pickup/turn22/landed61/return91; final framing captured turn and landing in a new round. No console warning/error. Existing room retained; other dealers unchanged. Five scope/framing tests and required probe/precommit passed. Perspective card animation supports explicit viewport/world scale while preserving existing defaults.

Current review tab: `http://astridblenderv2.localhost:4190/?dealer=astrid&table=blender`. User closed the previous elevated tab during this work. This is an integrated review, not full approval: native edge spill/blur and96→0 pose cut remain; new idle/speech/player-seat actions do not exist. The supplied hollow shoe has no card-stack mesh, so visual depletion is absent although authoritative counts remain in the server/HUD. User's new framing is a15% reduction chosen for immediate review; do not claim the user has accepted it yet.

## 2026-09-19 — restore the complete Blender table support

User reported the wooden base cut off before reaching the floor. The exported PRP_WalnutBase was complete, but rendering into the fitted video viewport clipped all geometry beyond the native16:9 frame. The base extends below that frame. `blender-table-scene.mjs` now renders into the full canvas and transforms the camera projection to preserve the exact source-frame registration. Astrid, tabletop, shoe and card pixel coordinates stay unchanged; geometry outside the film frame can now appear. The inverse projection and game-card raycast viewport are updated together. No Blender geometry, source footage, actor scale or mask changes.

Verified full base visible at the user's1117×837 view and during the first-card replay. Isolated `astridbaseqa.localhost:4190` round: player5-spades/9-spades, dealer10-diamonds; hit3-hearts to17, then stand/settlement. Browser evidence and result are under `astrid-table-v2/base-qa`. No browser warning/error. Six focused tests pass, including source-pixel preservation, unprojection, base visibility outside the original frustum and repeat-resize stability at desktop/portrait sizes. Dealer-sync probe and repository precommit pass. This fixes the support clipping only; earlier motion/idle limitations remain.

## 2026-09-19 — lower table viewpoint and ground the pedestal

User then rejected the high, foreshortened camera and supplied a Blender viewport screenshot showing the full pedestal and foot. This request supersedes using the saved PlateCam transform unchanged. The runtime now derives a lower 34-degree table view from a 2.6 m distance to the rear edge, with a longer lens. It preserves that rear edge's screen position and scale, and reprojects the shoe outlet onto its original tabletop height at the filmed pickup pixel. Astrid's source image, native proportions, frame scale and tracked first-upcard landing remain unchanged. The 3D table perspective changes; this is not a regenerated lower-angle film. The source .blend and exported GLB are unchanged.

Added a transparent shadow-receiving floor at the mesh's actual bottom, over the existing room carpet, and enabled mesh shadows. The full supplied wooden pedestal and bottom foot now show. Betting markers scale with the fitted table frame to avoid overlap at the shallower angle; desktop controls have less bottom padding to expose the foot. No original clips re-enabled, no new generation and no production deployment.

Verified the lower view in the browser and an isolated seven-seat round at `astridlowerqa.localhost:4190`: 35 stake, one hit (rightmost15 +J-hearts bust25), six stands, dealer resolution and settlement returning10, final balance975. All seven card groups stayed on the felt, first-upcard replay rendered with the registered shoe, and no browser warnings/errors were logged. Evidence: `content/staging/2026-09-19/astrid-table-v2/lower-camera-qa`. Seven focused tests, dealer-sync probe and repository precommit pass. This remains a review of camera/base integration; source edge artifacts, the96→0 pose cut, and missing new idle/speech/player-seat actions remain as recorded above.

## 2026-09-19 — restore branding, shoe pack, living idle and felt betting areas

User requested the missing old branding and cards, then explicitly asked to bring back Astrid moving/looking while waiting. This supersedes the earlier ban on her original idle only. The original paired145-frame idle is restored through DealerEngine, with its full-actor mask and one uniform scale/translation matching the green take's head size. It hides while the approved first-upcard plays and resumes afterward. Old speech, player-dealing and other action fallbacks remain disabled. No generation jobs or credits used. The arm poses still cut between folded idle and the green dealing take; do not call this a seamless join.

New `blender-table-details.mjs` places original Scout ink/payout lettering on the supplied felt, using `ScoutBrand.dc.html`, existing table-scene art and unchanged assets/cardback.png. A card pack and follower now sit inside PRP_Shoe, with length driven by server remaining/total counts, including empty/cut states. Acrylic renders its contents without an opaque shadow. Supplied Blender/GLB meshes and materials are unchanged on disk.

User also requested boxes/chips to lie within the table. Seven actual3D ink planes now use the same camera/material lighting as branding. Their projected quads position the corresponding clickable DOM controls and chips through one homography. Main44-unit round chips fit60-unit circles; side12-unit chips fit the14-unit crescent. Previous chip ellipses were being squashed twice. The betting banner moved below the targets, avoiding the centre click obstruction.

Actual `astridfeltqa.localhost:4190` guest round: seven5-unit main bets, box0PP5 and box6_21plus3_5 (total45); 16-card opening; hit rightmost17+10-spades to27; five stands with centre natural automatically resolved; settlement returned62.50, balance1000→955→1017.50. Shoe count/rendered pack agree415→399→398→397. All seven main targets and both side targets clicked successfully. Refresh preserved the hand/balance. Repeated idle cycles and hiding during green replay visually checked; no new QA warnings/errors. User subsequently started another two-seat round; left untouched. Final open review is `http://astridfeltqa.localhost:4190/?dealer=astrid&table=blender`.

Eight focused checks, required dealer-sync probe and full precommit suites pass. Evidence: `content/staging/2026-09-19/astrid-table-v2/branding-qa`. The stopped4190 preview was restarted from existing `astrid-green-table/runtime`, keeping its saved isolated data and public symlink. No production data/deployment, media regeneration or other dealer playback changes. Source edge artifacts, differing idle/action appearance/pose, missing green player-seat/later-card motion and speech remain. Tiny side-chip numbers use the existing stake text for readability.

## 2026-09-19 — replace frontal idle with elevated green take; ground all cards

User rejected the restored frontal idle camera and explicitly authorized one replacement green-screen waiting clip using the approved elevated reference and original ref-identity.png. Seedance2.0 job87fc5852-f3a5-4046-a93f-f1ac21e35b0d completed:145native24fpsframes,6seconds1080p. Both endpoints use approved de1f90a9 native96; extra refs269f8943 camera and b2c16866 identity. No duplicate generation. Requests/results/references and complete matte review sheets are saved in `content/staging/2026-09-19/astrid-elevated-idle`. Source SHA93e4f6ee4b3bdbddbada796526f81505a2abe10ac7fde0629d41b5dd1503028f; packed SHA f7ef00558bb312157ca9d5a46f4fdde282f4d3e973b8a843a406e04af0494b1b.

This supersedes the prior temporary frontal idle. Only the new actor-only idle now plays, registered with the exact retained action camera/crop; no old engine initialization or footage fallback. Same face, proportions, skin RGB and table-ready hands; living loop blinks and glances. The source green card pops in, but every prop/background pixel is masked out. All145 masks inspected. Loops observed repeatedly; action hides/resets idle, idle resumes after action. Actual rendered bounds were identical441.2421875x349.3125 at1280x720. User visual approval remains pending; native idle-to-action start still cuts into an already-reaching first frame. The smaller.85 framing, lowered34degree table-camera fit, Blender mesh/base/foot and source .blend remain unchanged.

User additionally requested cards to blend into Blender felt like chips. New `blender-card-layout.mjs` projects actual world-plane corners for all7 player fans and split hands; thin contact shadows replace floating drop shadows. Dealer cards retain their filmed first-card contact quad. Animated cards use exact world landing orientation/size and the same face/back art. Outer split fans moved clear of shoe; long and repeated splits compress within their seat. Server/card/wallet ownership is unchanged.

Real isolated `astridplaneqa.localhost:4190` round:35 openingstake across7boxes; box6 split2-hearts/2-clubs for5extra, draws5-diamonds andJ-hearts, onehit8-spades brought second split hand to20; then normal stands/settlement. Wallet1000→965→960→977.50, returned17.50. Shoe415→399→396. Reloads preserved state; all seven card groups plus split/extra-hit positions visually inspected. Green first-upcard replay and idle hiding/resumption checked. Console warning/errors empty. Evidence in elevated-idle/gameplay-qa.

Ten focused tests, required syncprobe and fullprecommit pass. Shared animation defaults unchanged for other dealers; visual work scoped to Astrid per user. No production deployment, no other generation, old speech/player-action bank stays disconnected. This completes the requested idle-camera/card-plane review, not the full dealer-motion program.

Concurrent filesystem work added `takes.json`/`take-box6.json` and multi-take routing to app.mjs/astrid-green-dealer.mjs during finalization. Those unrelated hunks/assets were preserved in the working tree and excluded from this commit using index-only staging. They are not covered by the above visual QA, which ran before that route was loaded. Do not attribute box6 footage to this idle/card-plane task.

## 2026-09-19 — recover Astrid's stopped idle rendering

User clarified that interactive means continuous motion and gameplay reactions, not spoken replies. Observed the actual astridplaneqa page frozen at idle cycle28/frame144 across two visible observations about one minute apart with no action playing. The old requestVideoFrameCallback returned on readyState<2 before rearming, permanently losing its paint loop at a transient loop-boundary seek.

New isolated idle-video-loop helper always rearms native callbacks, falls back to the display clock if native callbacks disappear, and recovers unexpected paused/ended/stalled media while visible. Intentional dealing suspension remains excluded from recovery, then resumes normally. Added four regression tests to pre-commit. No body warp, playback speed change or source alteration. Rendered isolated astridaliveqa round completed opening, hit and settlement; loop advanced through60 cycles, and the original user table through64, exceeding the observed failure point. No console errors/warnings. Evidence in content/staging/2026-09-19/astrid-idle-loop-repair. Required pre-commit and dealer-sync probe passed.

During verification the user rejected the broad head turns in the source87fc5852 and requested mainly eye contact, relaxed breathing and a subtly flirtatious feminine presence. This is separate from the fixed freeze. One replacement Seedance2.0 eight-second job2a721f7d is submitted with the exact same endpoints, approved elevated camera reference and original ref-identity.png. Receipt under astrid-eye-contact-idle. Do not duplicate. No claim of style acceptance until completed source and gameplay review. Concurrent player-box routing in app.mjs/astrid-green-dealer.mjs belongs to other work and is deliberately excluded from this freeze repair commit.

## 2026-09-19 — green take 6a378270 installed as the first card of box 5

Kevin approved Seedance take `6a378270-fc2a-4f14-972b-44820678ffa4` (97 native frames, 24 fps, 1920x1080, SHA 6047a7be…cabe8; source and receipts in `content/staging/2026-09-19/astrid-green-box-right`). The target moved twice during the work: first the far-right box 6, then "no new take, install it for box 5", then "the replaced card must not change size". Final state: the take is installed for **box 5 only** (second seat from the viewer's right); the clip's filmed landing spot is box 5's first-card position. Zero generation, no credits.

Mask: the vetted elevated key (`astrid-elevated-camera/mask-prep/key.py` + settings) with the Apple Vision person matte, all 97 frames reviewed in `mask/qa`. The actor union is `[662,30,1348,772]`; the crop is measured, not assumed: `[560,0,920,850]` (same origin as the dealer take, lower and narrower) so the slide and rest at viewer-right fit. Packed media 920x1700, SHA 6650a315…ee5e2. Source RGB untouched before encoding. Card track: `card-track/build_track.py` treats the card as a rigid rectangle fixed to the rest size (70.9x116.8 source px) and solves only rotation and translation per frame from the magenta marker dots; frames 9-22 and 31-35 use the bright body rectangle, 23-30 (card lifted between the hands) and 36/38 are interpolated poses. `apparent-width.png` plots measured versus rigid width; during the carry the drawn card is about 1.2-1.5x wider than the filmed one. Authored events: pickup 9, release 58, land 59, rest 96. The scripts take `--take-dir` and a `take-config.json` so another source runs in one go.

Runtime: `review/astrid-table-v2/takes.json` lists `take.json` (dealer upcard, unchanged) and `take-box5.json`; `loadGreenTakes` and `selectGreenTake` in `astrid-green-dealer.mjs` pick a take by action and box (first card, not split, face up). The box fan is registered to the filmed landing quad through the same `layoutGreenDealerCards` path as the dealer card, re-applied after the Blender felt layout. The dealer take plays unchanged; in one opening the box-5 clip runs first, other boxes use the 3D shoe path, then the dealer clip; no overlap. A second replay button replays box 5. `performance-contact.mjs` is unchanged.

Verified in the isolated guest `astridboxright.localhost:4190` (evidence `astrid-green-box-right/gameplay-qa`, `result.json`): box 5 and box 2 staked, 7-spades dealt by the clip and handed to the DOM at the filmed quad, K-clubs fanned beside it, box 2 and dealer 8-diamonds normal, refresh mid-round kept identical rects, hit to 27, settlement 960 -> 965, back to betting, shoe 391 -> 384, no console warnings or errors. Nine focused tests (`pipeline/test-astrid-green-box-right.mjs`, `test-astrid-green-first-card.mjs`), the dealer-sync probe and the full pre-commit pass.

Still broken, be honest: the box-5 fan sits right of and below the box-5 marker, over its chip, because that is where the hand left the card; the cut from the green idle into frame 0 and from the box take's rest frame into the dealer take's frame 0 (hand already at the shoe) is hard; the replacement is drawn at a fixed size while the filmed card foreshortens during the carry, and 23-30 is an interpolated pose; frames 9-11 draw over the shoe mouth; native spill on the gripping fingers and one green speck at the left shoulder in native 33; a split of box 5 falls back to the ordinary felt layout. Another session was editing app.mjs, the green idle and the felt layout in this worktree at the same time; only the box-take hunks are committed here. This is a working integration for Kevin's review, not visual acceptance.

## 2026-09-19 — calmer eye-contact Astrid waiting performance

Job2a721f7d completed and replaced rejected head-scanning87fc5852 in the elevated idle manifest. Same exact de1f90a9 native96 endpoints, camera269f8943 and original ref-identity.png b2c16866; Seedance2.0,8seconds1080p,193native24fps frames. No new reference generation, scale/camera change, face retouch, body warping or retiming. Forward gaze, one natural blink, a restrained soft smile and subtle shoulder/blouse breathing. All193 source-aligned actor mattes inspected. Raw model still moves a green prop card around5s; it is completely excluded from the actor output. Server-owned cards/shoe/wallet untouched.

Public packed video: review/astrid-eye-contact-idle/actor-packed.mp4; selected by existing elevated-idle/idle.json. Source and original masks remain under content/staging/2026-09-19/astrid-eye-contact-idle with saved provider receipt, native source hash, request and all-frame QA. Current user preview is http://astridaliveqa.localhost:4190/?dealer=astrid&table=blender.

Actual browser:19 observed loops, first-upcard hides/suspends idle and returns to the new moving take; centre5-unit round from995 completed7D/AD -> hit8D to16 -> stand -> loss990. No browser warning/error. Nine focused tests, repository pre-commit and sync probe pass. User subjective approval pending. Existing action-entry pose cut remains and there are no newly generated outcome-specific reactions or spoken replies. One replacement generated, no automatic wider batch.

## 2026-09-19 — green waiting clip as Astrid's idle with a randomized scheduler

Kevin's green-screen waiting clip `15777d5f-4085-484e-a170-eb5c9a13d7b0` (121 native frames, 24 fps, SHA 849b241e…65bf, `content/staging/2026-09-19/astrid-green-waiting`) now plays while Astrid waits on the Blender table, replacing the frame-96 still and the plain elevated loop (which stays as a fallback when `review/astrid-green-waiting/idle.json` is absent). Zero generation.

Mask: same vetted key and person matte through the parameterized `astrid-green-box-right/mask/build.py --take-dir`; actor union `[658,26,1305,670]`, crop `[560,0,754,678]`, packed 754x1356, SHA 217de02e…c858; all frames reviewed in `mask/qa`. Segments were measured, not taken from the README: phase correlation of the head crop against frame 0 (`motion/head-motion.json`, `.png`, `head-sheet.jpg`) shows a glance toward viewer-LEFT over 6-40 (dx to -31 px) returning by 41, a glance toward viewer-RIGHT over 42-89 (dx to +30 px, blink) returning by 90, and calm breathing 90-120. Segments: base 90-120, glanceLeft 0-41, glanceRight 41-90, full 0-120; ready frames 0/41/90/120 differ by about 1 px full-frame (head crop 3.4-5 grey levels). `build-idle.mjs --install` writes `review/astrid-green-waiting/{idle.json,actor-packed.mp4}` with the dealer take's placement.

Runtime: `astrid-idle-scheduler.mjs` (pure, seeded mulberry32) draws base loops with a 1-3 loop hold, then a glance with p=0.4, never two glances in a row and never more than 3 base loops without one; `astrid-green-waiting.mjs` plays the segments on one packed video through the actor compositor, logs `[idle] <segment>` and exposes the sequence on the canvas dataset. A green dealing take or replay asks for `holdAtBoundary()` and starts only at the running segment's end frame (a ready pose); the idle resumes with base when the scene releases. Dealer upcard and box-5 takes unchanged.

Verified in `astridboxright.localhost:4190` (`astrid-green-waiting/gameplay-qa`): 62 s watch logged base,base,base,glanceRight,base,base,base,glanceLeft,base,base,base,full,base,base,full,… with screenshots of base and each glance; one round held the idle at frame 120 0.76 s after Deal Now, played the box-5 and dealer takes, resumed with base, hit/stand and settled 967.50 -> 977.50; no console warnings or errors. Four scheduler tests, the earlier nine, the dealer-sync probe and the full pre-commit pass.

Still broken: a small head pop at each splice (ready frames are close, not identical) and a one-frame seek hitch at segment starts; the hold can delay a deal by up to 5 s during `full`; the waiting ready pose is not the dealing takes' frame 0, so those cuts stay hard; a take started outside the green path pauses the idle mid-segment. The Playwright browser is shared with another session on this machine. Not visual acceptance.

## 2026-09-19 — Box 4 blue-card reference pair, built-in images after rejection

Kevin asked root to take over Claude's Box4 plan: blue card/white border,
magenta-yellow-cyan-white face corners, one white back-centre dot, physical
size fixed on the table plane. Plates must be shown before a Seedance take.
Box4 means zero-based, one seat viewer-right of centre. Current runtime
PlateCam-lower-review and ordinary 72x103mm card layout yield native target
corners1091.76/690.47,1154.09/683.44,1178.22/740.01,1113.72/747.56;
centre59.09%/66.24%, above its chip. Generator source camera/framing remains
approved269f8943; no camera, actor transform or game layout changed.

Three Higgsfield GPTImage2.5 low-quality2k image jobs were submitted:
start2ad17459, rejected-end9e7df4f0 (wrong rotation, duplicate magenta), and
correction9b95f4a1 using a deterministic placement-guide reference. All
completed, archived and UNAPPROVED. One-credit preflight each. User rejected
photographic quality and explicitly directed GPT images to be generated here
instead of spending Higgsfield credits. Do not reuse those images as inputs.

Built-in image_gen then made a fresh pair directly from original approved
plate269f8943 and exact /Users/solvifyab/Desktop/ref-identity.png for start;
end uses that fresh start plus the projected card guide. Current candidate:
content/staging/2026-09-19/astrid-blue-box4/builtin/start.png and end.png,
1668x943 each. Full prompts and original output paths in builtin/prompts.json.
StartSHA493c5f9b00516a219fde328dd8caf1147d86410fda47880c4f8a06d619bf42f0;
endSHAba88f6be46e9ac9af0bd7ede6f6e7be492ff29ea628f26b7e5c5559fb66c09de.
Both shown inline. One blue card per image; four distinct end marker colours
observed. End blue-inner-boundary error against requested OUTER white border
averages2.71native-equivalentpx,max3.24px. This is a geometry check, not
acceptance. Outputs are generated edits, not pixel-identical preservation of
Astrid or a higher-resolution master. User appearance/plate review pending.

No Seedance job submitted, no gameplay/media-manifest installation, no wallet,
database, existing source or other dealer change. Future tracking uses raw
RGB before keying, fixed physical size; on-felt X/Z/yaw, lifted card rigid3D
pose. Two dots alone do not uniquely solve unrestricted3D orientation;
ambiguous frames require outline/temporal evidence or explicit inference.
Repository pre-commit checks and audit-dealer-sync --probe passed. Browser
round QA is not claimed for uninstalled reference stills.

Earlier Box5 fixed-physical-size trial stays isolated/uninstalled under
astrid-box5-rigid-track. It retained visible source/hand mismatch and cannot
be described as accepted; no Box5 runtime replacement was made this turn.

## 2026-09-19 — edge blend for the keyed Astrid, render side

Kevin: the keyed edges look too sharp against the 3D environment. `web/public/actor-edge-blend.mjs` adds a `blendEdge` GLSL stage to both compositors (waiting idle in `actor-compositor.mjs`, takes in `performance-player.mjs`): erode the matte 1 px, feather the alpha 2 px (gaussian on alpha only, bounded by the cleaned matte), and wrap the outer band up to 15 % toward the colour behind her. RGB is never blurred. Defaults `edge=1,2,0.15`, URL-tunable, `?edgeHud=1` sliders, `window.astridEdge.set()` live. The wrap colour comes from a 4 Hz capture of the table canvas when available; since the Blender renderer keeps no drawing buffer and the room is CSS, it currently falls back to a wall tone above the rear rail and a felt tone below. Applied identically to the dealer upcard, the box-5 take and the idle. Zero generation, no re-masking.

Evidence in `content/staging/2026-09-19/astrid-edge-blend`: before/after idle frames at base 104, 2x crops of hair, shoulder line, fingers on felt and the hand at the shoe, and the box-5 slide/landing and dealer landing with the blend on; no console warnings or errors; three focused tests (param parsing, clamps, shader contract), the dealer-sync probe and the full pre-commit pass.

Still open: at the defaults the softening is subtle, and the wrap is a two-tone approximation rather than the true scene pixels; capturing the table canvas needs `preserveDrawingBuffer` or a render hook in `blender-table-scene.mjs`, which belongs to the other session's work. Not visual acceptance; Kevin tunes with the HUD.

## 2026-09-19 — waiting idle corrected: combine the eye-contact loop with the glances

Kevin: combine, not swap. The idle that was already playing, the eye-contact loop `2a721f7d-c2da-4e7a-9812-9d9b4a087232` (`review/astrid-eye-contact-idle/actor-packed.mp4`, 193 frames, packed SHA a847935b…ea8d, source SHA 67d9ee98…fa42, installed by 7dee851), stays the base; the green waiting clip `15777d5f` only contributes glanceLeft 0-41, glanceRight 41-90 and full 0-120. No frames 90-120 of the waiting clip are used as base. `build-idle.mjs` verifies the base media on disk by hash against `review/astrid-elevated-idle/idle.json` before composing `review/astrid-green-waiting/idle.json` (version 2: base + glances + segments + spliceOffset).

Splice offset measured in the shared crop origin (560,0), base frame 0 against waiting frames 0/41/90/120: head phase-correlation dy -15.4/-15.1/-15.1/-14.7 px, torso -15.8/-15.3/-15.8/-15.5 px, dx within 0.5 px, silhouette top row 44 versus 26. The waiting clip sits about 15 px higher, so the glance layer is translated down 15.3 source px (scaled with the fit), no warping. Residual masked RGB difference about 14 grey levels: a pop remains at each splice.

Runtime (`astrid-green-waiting.mjs`): the base video loops on its own canvas; at each loop boundary the scheduler (unchanged: 1-3 loop holds, p=0.4, never two glances in a row, forced after 3 loops) may switch to the glance canvas for one segment and back to base frame 0. A dealing take holds a glance at its end frame; base is held at once since every base frame is a ready pose. Verified in `astridboxright.localhost:4190` (`astrid-green-waiting/gameplay-qa`): 90 s log base,glanceRight,base,base,full,base,base,base,base,glanceLeft,base,base,base with glances at loops 1, 3 and 6 (a base loop is 8 s), screenshots of base and each glance with the offset applied (glance layer top 51.7 px versus base 44.6 px at the QA fit), and a round: held at base frame 121 within 40 ms of Deal Now, box-5 and dealer takes played, base resumed at frame 0, settled. No console warnings or errors; 16 focused tests, probe and pre-commit pass. Still: the splice pop, glance holds of up to 5 s before a deal, hard cuts into the dealing takes, shared Playwright browser. Not visual acceptance.

## 2026-09-19 — approved built-in Box 4 pair tested once; motion not accepted

Kevin approved the built-in pair with “Awesome” then “great”. Submitted one
Seedance2.0 4s/1080p/std/high-bitrate/silent16:9 job via MCP: c01866d1-7c93-43a4-9493-73f7c66d3725,
36-credit preflight. Start upload2d404615, endac6a5ea5, extra identityb2c16866.
Exact request, receipt and source are in astrid-blue-box4. No Higgsfield image
jobs this turn. No extra video submitted after reviewing the outcome.

Source completed1920x1080,24fps,97frames, SHA38dad95f8ad60819bbb2604f85b4ce424d4db425324bdbd0aceca91eb759215a.
Inspected native frame contact sheets, full-frame overview and browser replay.
Blue card visibly extracts from the shoe, turns through edge-on frame28,
shows front corner dots, lands at the intended Box4 target, and stays after
empty return. But the same hand does all actions, no hand-to-hand transfer;
a long presentation gesture replaces the quick turn/direct slide, release
aroundframe55/2.29s, empty returnaroundframe68. Unwanted white Box4 text is
also generated. Source fails the choreography gate: not masked or installed.

Built inspect-source.py and check-rigid-fit.py solely in that staging folder.
Blue-body evidence96/97frames missesframe28. False colour candidates include
finger-edge ringing and cyan bleaching; not all detections are real dots.
Bounded fixed72x103mm fit over FACE-UP frames31–96 gives stable landing
(0.26px marker residual) without scaling, using runtime target camera.
This residual uses marker offsets calibrated from the same finalframe;
it is not independent accuracy. Partial-marker lifted poses remain inferred;
frame43 edge mismatch persists. No pickup/turnover replacement track or
complete-gameplay acceptance claimed. See source-review/review.json,
rigid-fit.jpg and raw contact sheets. Retain approved plates, not failed
choreography, for future work. No game, manifests, server cards/wallet/database,
idle scheduler, or otherdealer changes made. Pre-commit and sync --probe pass.

## 2026-09-19 — user requested live Box4 experiment despite source limitations

Kevin said “try it lets see live”. Implemented an opt-in runtime route:
http://astridbluebox4.localhost:4190/?dealer=astrid&table=blender&astridBlue=box4.
Only that query appends review/astrid-blue-box4/take.json; ordinary take lists
and Box5/dealer-upcard files remain unchanged. This is explicit user review
of the previously rejected motion, not visual approval or another generation.

Staging astrid-blue-box4 has build-preview-mask.py, build-preview-track.py,
install-preview.mjs. Person matte plus approved green key removes background;
blue card hull/border/dots removed except skin, preserving fingers above the
replacement. Box4 text is removed with background. RGB unchanged. Crop560,0,
960,800 shares approved .85 framing. Fixed72x103mm rigid model throughout:
0–27 partial-body approximations,28–30 inferred rigid turn,31–96 prior marker
fit. Back/front changes at29 between visible back/front evidence. Pickup0,
release55,land56,rest96. Original24fps speed. Actor-packed SHA0a7beface3055fbe01523b9c6f3a88aedcae8eaf55279abe6e06b7a8eb3a9fab,
calibrationdc45b2c93709c32f5c95b8fb5fb7dcef6a74926fba80d09c586ba29c529dd0f3.

Verified actual guest gameplay in the visible IAB: $5 on zero-basedBox4,
server cards K-diamonds/2-clubs (12), hit2-hearts (14), stand, loss settled
1000->995 with totalbet0 and lastwin0. Replayed twice, captured presented
frames6–79 including pickup25,front32,contact45,land56. New take ID observed
on performance-layer, retarget=false; blue/text absent, game card under
filmed fingers and target fan aligned. No console errors/warnings. Evidence
under gameplay-qa. A second $5 Box4 round started and left open for replay.

Remaining visual issues: source's slow upright presentation, missing hand
transfer, approximate early pickup/turn, frame43 edge mismatch, and existing
hard idle/action joins. No claim of smooth60 or complete source acceptance.
Focused green-box routing tests4/4, pre-commit and sync --probe passed. Scope
is Astrid only. Other dealers were covered by shared regression checks, not
opened or changed. Unrelated app.mjs blank-line edit preserved unstaged.

## 2026-09-19 — Box 4 opening pair and larger settled cards

User accepted the live blue-card take and requested larger laid cards plus the
same action for both opening cards. The opt-in `astridBlue=box4` now routes
only the first two unsplit, face-up Box 4 cards through c01866d1. Other takes
retain their previous routing; hits and split cards retain the ordinary path.
No generation, media re-encode, actor scale, camera or wallet changes.

Box 4 resting cards are 25% larger in the photographed table plane. The
original tracked pickup/turn/release is preserved through source landing56;
a separate 8-frame presentation adjustment settles the released card into
its larger fan. DOM takes over at64 with the same final corners. The second
card uses its own offset, with no movement or hiding of the first card.
Replay now plays both authoritative cards sequentially. Source/media hashes
are unchanged; calibration SHA is now
86666241db588fce78a85b6bdf9fd2b22ddcd3416ef1238545d13c7759f9faca.

Verified in rendered gameplay on isolated4190 guests. QA host
astridbluepairqa: opening8-clubs/8-hearts, replayed both, hit and settled loss,
balance1000->995, totalbet0. User preview astridbluebox4: actual opening
5-spades/2-clubs, both c01866d1 deliveries observed; second frames2–96,
first card visible throughout with exactly one unchanged quad. Larger pair
remains on felt and clear of its chip. No warnings/errors on either guest.
Left that live round open with `Replay box 4 both cards` available.
Evidence: content/staging/2026-09-19/astrid-blue-box4/gameplay-pair-qa/.

Focused routing/presentation tests7/7, pre-commit checks and dealer-sync
--probe passed. Existing source pickup/turn limitations and hard idle/action
joins remain; this is the user's accepted live experiment, not all-seat
visual acceptance. Unrelated work, including app.mjs blank line, preserved.

## 2026-09-19 — Separate moving and resting Box 4 card sizes

User clarified the enlargement applies only to cards lying on the felt, and
asked to reduce the moving Box 4 card. Removed the eight-frame growth
animation. The source landing again hands over at56, with settled layout
still1.25 and both opening deliveries enabled. The moving replacement now
uses one constant0.80 display scale, anchored one quarter along its left
grip edge so it does not pull away from the fingers. Actor pixels, hands,
camera, stored source corners and the resting-card quads are unchanged.
This is explicit presentation sizing, not a new measured physical track.
Calibration SHA4e050362bed9039d51e09fe322a7e904c9a929b5d2b803879322d0cf854c98c5.

Replayed both authoritative5-spades/2-clubs cards in current live tab22.
Inspected the wrist turn, contact and release for both. Runtime showed0.8
throughout, landing56, first card visible with one unchanged quad during
second delivery; final quads exactly match the prior larger resting layout.
No console warnings/errors. Existing guest balance985 and bet5 preserved.
Evidence: astrid-blue-box4/gameplay-size-qa. Focused tests8/8, required
pre-commit and sync --probe passed. Scope remains the opt-in Box4 preview;
existing choreography/idle joins and imperfect tracking are not newly solved.

## 2026-09-19 — Extend accepted Box 4 v1 to hits, splits and dealer draws

User accepted v1 and asked for hits/splits at Box 4 and Astrid's own cards.
The same opt-in `astridBlue=box4` now routes every face-up card added at
zero-based Box 4 through c01866d1, including hits, doubles and split hands.
It also loads an explicit repeatable dealer manifest that reuses the original
de1f90a9 media for the upcard, face-down hole card and subsequent dealer draws.
Ordinary manifests keep their prior first-card/opening-pair boundaries.
No generation, new media bytes, camera change or server logic change.

V1 moving Box 4 scale remains 0.80; unsplit resting scale remains 1.25.
Split hands are separate compact fans on the calibrated felt plane, with
bounded horizontal spread for later hits. Existing cards remain visible while
the incoming card is supplied by the performance layer. The hole card uses
the back artwork and carries no rank label before reveal.

Rendered QA used an isolated guest runtime on4199, with a reordered test
shoe preserving its undealt card multiset. Captured both split deliveries
(8S/3D and8H/2C), the added4D on a split hand, and a filmed5H double on the
other. Test round settled a15 loss to985. Some longer captures were interrupted
by disappearing tabs; no visual acceptance was inferred from those gaps.
The final continuous capture verified normal hit5S/2H +3D, stand, hole reveal,
then filmed dealer draws4S and6H (5D/6C/4S/6H=21), settlement985->980,
totalbet0. Own-card takes were observed across both complete draw animations,
including contact and return. Opening hole-card contact was captured separately.
No browser warnings/errors. Evidence: astrid-blue-box4/gameplay-actions-qa/.

Focused tests15/15; pre-commit and dealer-sync --probe passed. New Box4
calibration SHA0155d1c4f4696ab59d4222b04dde7b1bd70b371374b36c898c9aaf1b602831c4.
This reuses the accepted source and photographed landing point; it does not
create new hand choreography for each split fan. Existing idle/action joins,
source pickup limitations and the v1 size change at landing remain. Other
seats are not newly supported. Unrelated dirty work is preserved.

## 2026-09-19 — Box 3 reference retry, not approved

The user requested a new center Box 3 before/after pair for MiniMax H3, then
rejected the generated face and image quality. Retried with two independent
built-in GPT image edits of the original elevated 2688x1520 start plate;
no chained edits of the rejected face drafts. The requested change was the
blue tracking card, preserving Astrid, the camera and table.

Evidence and exact prompts are in
`content/staging/2026-09-19/astrid-h3-box3-v1/original-master-retry/`.
Both outputs are only 1668x943 despite requesting the source dimensions.
The face looks closer to the original but remains unapproved. The after
image also retains a green card remnant at the shoe and misses the measured
center-seat target; reject it for video. Do not use these outputs as approved
H3 references or claim the resolution problem is fixed.

Validation was visual image inspection and dimension/hash measurements.
No H3 video was submitted, no reference was installed, and no gameplay/player
files were changed. Accepted Box 4 v1 remains unchanged. The commit hook's
checks and dealer-sync --probe passed; neither establishes image acceptance.
Rendered gameplay QA was not rerun for this uninstalled image experiment.

## 2026-09-19 — Astrid softer identity draft

The user said the latest face still looked stern and older than the original
Astrid, supplying an older video screenshot. Made two independent built-in
GPT image edits of the current before plate, using Desktop/ref-identity.png
as the face reference and the screenshot as additional reference in attempt 1.
Saved both and the exact prompts under astrid-h3-box3-v1/soft-identity-review.
The latest before-soft-identity.png has a softer mouth and slight smile;
the angular face and stronger facial shadows still differ from the original.
User likeness acceptance is pending. Dimensions are 1667x943, so no claim
of restoring the native 2688x1520 master or exact pixel registration.

Visual review covered face, framing, hands, shoe and card. The preceding
after plate is still rejected. No H3 submission, gameplay installation,
or changes to accepted Box 4. Commit-hook checks and dealer-sync --probe
run for the saved media experiment; no rendered gameplay QA is implied.

## 2026-09-19 — approved ElevenLabs SPEAK take mounted as Astrid's greeting

Kevin approved the creatify-aurora greeting take `Mn2vLqTOAmDaJKBYJeKy` ("mount it, it was perfect"; 1280x704, 25 fps, 118 frames, embedded AAC; `content/staging/2026-09-19/astrid-green-speak-elevenlabs`). Zero generation, no credits.

Registration measured, not assumed: the take is the 2688x1520 plate at 1280 wide, cropped to 704 rows. Gradient phase correlation with the actor masked out against frame 0 of the dealer take render (the placement basis) gives one rigid transform, scale 1.5 and offset (0,+15) px (left rail, right rail and shoe agree; the front rail alone reads +9, generative drift, left alone). `source.mp4` (SHA 9fea307b…d848) is that resample to 1920x1080, 25 -> 24 fps by frame drop so lip timing is untouched, padding in the take's own green, audio copied. The embedded audio cross-correlates with `greeting.mp3` at lag 0 (peak 1.00), so frame 0 is t=0 and the manifest offset is 0.

Mask: vetted key through `astrid-green-box-right/mask/build.py --take-dir`; union [658,20,1305,673], crop [560,0,754,682] (dealer-take origin), packed 754x1364 SHA 0ff04351…3c6c; all 116 frames reviewed, clean. Against the base eye-contact idle her head/torso sit ~20 px and hands 6-10 px higher, a pose difference, so no splice offset is applied (`spliceOffset` in `speak.json` is runtime-tunable without re-encoding).

Runtime: `web/public/astrid-green-speak.mjs` (`loadGreenSpeak`, `speakManifestErrors`, `installGreenSpeak`) plays the packed take through the actor compositor at the dealer take's placement over the held idle: `holdAtBoundary()` first, `performance-playing` on the scene while it plays so the idle hides and resumes base afterwards, cut in at frame 0 and out at 115 (both ready poses), the mp3 started on the first presented frame plus the measured offset; the start delta is measured on the next presented frame, logged as `[speak] <line> audio/video start delta`, exposed as `data-speak-start-delta-ms` and, when it exceeds a frame, the audio clock is moved once inside the leading silence (settled delta logged too). A dealing take appended while she speaks aborts the speak. `app.mjs`: `voice.say` routes a line with a green take on Astrid (`astridSpeak.has(t)`, Blender table only, other dealers untouched); since the guest table has no entry gate, Astrid greets once `tableReady` resolves, or on the first pointer/key gesture when the browser refuses autoplay. Manifest `review/astrid-green-speak/speak.json` + `actor-packed.mp4`, composed by `build-speak.mjs --install`. `.astrid-green-speak` layer z 25.

Verified: headless Chrome (SwiftShader) load of `astridboxright.localhost:4190/?dealer=astrid&table=blender`: greeting plays 0-115 over the held idle, caption shown, base idle resumes, no app warnings or errors (only SwiftShader ReadPixels driver notices). Start delta run 1 -91 ms; run 2 -250 ms nudged to -106 ms settled; software rendering inflates it. Five new tests `pipeline/test-astrid-green-speak.mjs`, 24 focused, the dealer-sync probe and the full pre-commit pass. Per Kevin, no gameplay evidence run; he QAs on hardware.

Still open: the cut pop (~20 px head) in and out of the speak; the true audio/video delta on real hardware is unmeasured; only the greeting has a take, every other Astrid line stays silent; a deal started mid-greeting cuts her off. Not visual acceptance.

## 2026-09-19 — every Astrid line mounted as a keyed Creatify Aurora speak take

Kevin approved the greeting install and asked for all other lines the same way. 16 downloaded takes (`content/staging/2026-09-19/astrid-green-speak-elevenlabs/take-<line>-creatify-aurora.mp4`, ids in `jobs.json`): blackjack, bust, chatter1, chatter2, dealerblackjack, dealerbust, double, farewell, goodluck, insurance, lose, peek, placebets, push, sidebet, win. Zero generation.

Same recipe, scripted once (`build-lines.py`): the greeting registration (scale 1.5, offset 0,+15) was verified on blackjack, win and bust frame 0 (`registration/verify-take.py`, identical rail/shoe shifts) and reused, not re-solved; each take resampled to a 1920x1080 24 fps `lines/<line>/source.mp4` with its audio; vetted matte per line (crops [560,0,754,682], four lines at 752 wide; 36-93 frames); embedded audio cross-correlates with each mp3 at lag 0 (peak >= 0.9996), so every offset is 0. No take failed. All frames reviewed through `review-sheets/lines-1..4.jpg`.

Runtime generalized rather than repeated: `speak.json` is version 2 with one media entry per line (`review/astrid-green-speak/<line>.mp4`, 17 files incl. greeting); `astrid-green-speak.mjs` keeps one decoded video and one recording per line, builds the actor compositor per utterance at that line's crop, and applies the same rules as the greeting (hold at a ready frame, `performance-playing` while it plays, base idle resumes, a dealing take aborts the speak). `voice.say('<line>')` on Astrid + Blender now plays whichever line has a take; chatter1/2, farewell and peek are in the manifest and reachable through the review hook `window.astridSay('<line>')`. The audio clock nudge is limited to a trailing audio clock (a leading one means late frames). Other dealers untouched.

Found and fixed during the check: Chrome can deliver the video's `ended` before the last frame's callback, which left the greeting held at frame 114 for the 20 s timeout in one run; the runtime now presents the decoded last image as the cut-out frame on `ended` (the same guard `PerformancePlayer` has). Verified afterwards in two headless SwiftShader passes of `astridboxright.localhost:4190/?dealer=astrid&table=blender`: greeting on load, then win and bust through the hook, idle held and base resumed each time, no app warnings or errors. Five focused speak tests (now over all lines), 24 focused, dealer-sync probe and full pre-commit pass. No gameplay QA per Kevin.

Still open: the cut pop into and out of each take (~20 px head vs the base idle) on every line; audio/video delta on real hardware unmeasured (console `[speak] <line> audio/video start delta`); a line said while a deal starts is cut off; SwiftShader timings in `runtime-check/result.json` are not representative.

## 2026-09-19 — greeting eye holes repaired after user rejection

The user reported disappearing eyes in the first masked lipsync. The original
green-excess key partially removed the blue-green irises. Earlier claims
that this greeting mask was clean are superseded by that rejection.
`astrid-green-speak-elevenlabs/mask-face-repair/` reconstructs the original
key and protects the enclosed high-confidence head interior; source RGB,
outer silhouette, camera, crop, timing and paired greeting audio stay unchanged.
Across 116 frames, 2,300 alpha pixels were repaired; restored pixels are255
lossless and at least253 after H264 decoding. New packed SHA
5b1f348737efd4374f498b23e21be935d8cdd450172af79e944a36845ca9dd75.
Canonical greeting mask updated so future multi-line builds inherit it.
Current greeting media uses a content-addressed filename to avoid stale cache.

IAB rendered QA on isolated guest port4211 verified two greeting plays,
mask visibility, waiting held during speech and resumed afterward. First
repaired play reached frame115; measured start delta-25ms, settled-49ms.
Evidence: hardware-review/face-repair-*. The pose jump at the speech/idle
join remains; this is not a claim of perfect perceptual lip sync. User's
existing port4190 round was left alone. Other concurrently installed speech
lines have not received this specific eye repair/review. Five speak tests
and dealer-sync --probe passed; full checks run on commit. No generation.
The concurrent all-lines commit picked up the repair code and canonical
mask while work was underway; this delivery adds its remaining media file,
review notes and second-play evidence without reverting that work.

## 2026-09-19 — approved Box3 H3 test ended in provider failure

The user approved the softer Astrid face, requested Scout/card references,
then authorized one test. `astrid-h3-box3-v1/test-01/` saves the full-scene
start/end pair, distinct-marker card close-up, separate Scout cardback,
exact requests, hashes and receipt. H3 rejects extra reference media when
start/end keyframes are present (preflight had allowed it); the rejected
request created no job. One corrected 4s 2K 16:9 keyframe-only job was
submitted: d2295b53-09dc-4eb4-bffa-6ce4847a8897, estimated8credits.
It returned terminal FAILED with no output URL or reason. Actual charge or
refund is unknown. No duplicate submission, source video or gameplay install.
Box4 v1 remains unchanged. Tell the user this failed; do not call it a render
waiting for review and do not resubmit automatically.

## 2026-09-20 — Astrid remaining eye masks and original-take speech joins

Source clarification: use the post-reset elevated Creatify Aurora takes, specifically
`take-goodluck-creatify-aurora.mp4`, not the pre-reset frontal Higgsfield bank.
The user confirmed the camera angle. No generation, camera change or old-bank restore.

All 16 remaining speech masks now use the greeting's opaque enclosed head interior
repair. 944 frames, 13,760 repaired alpha pixels. Source RGB, registration, audio,
crop and frame count retained. Encoded repaired alpha is >=250 in every affected
pixel; dealerbust/farewell/placebets/sidebet need CRF0 to avoid alpha codec ringing.
`all-lines-report.json` and the four all-lines QA sheets record the checks.

Each of the 17 original recordings now has an entrance and exit motion map.
Bidirectional DIS flow, bounded to 60 source pixels, bridges the ~20px head and
6–10px hand pose difference over 220ms using premultiplied RGB/alpha interpolation.
The entry captures the currently held ready idle; exit seeks and paints idle frame0
before revealing it. Recorded speaking frames and paired mp3 are unchanged.
Flow maps are measured against idle frame0; small breathing/blink differences in
other held frames remain possible. This is an interpolated join, not newly filmed
motion or a blanket visual acceptance of every source's face/quality.

Runtime review used isolated guest port4211, with the actual rehearsal voice.say
path. All17 lines played twice and returned to idle. Contact sheets inspected
source/matte eyes and all entry/exit face intermediates. Runtime screenshots and
logs are under hardware-review/joins. Goodluck frame series includes entrance,
speech, exit and resumed idle. A CUA clipped capture returned one black thumbnail;
subsequent full-viewport screenshots were used for per-line review.

A repeated resume/play race found during QA was fixed. Greeting/goodluck/bust were
rerun twice afterward without new warnings/errors. The first gesture's automatic
greeting no longer silently drops a selected review, and the rehearsal caption
now uses the exact green take's text instead of the old bank description.

A real server-owned demo round: $5 on zero-based Box4; J-heart + 6-spade, hit
4-club =20; dealer20; push, $5 returned, balance1000, idle moving afterward.
Goodluck and push ran through the same new joins. Existing Box4 motion, dealer
cards, chips/table, wallet and server logic were not edited. One idle watchdog
recovery was observed during the multi-tab session; later idle motion was verified.
Shared rehearsal UI regression: Vera/Amira/Mei goodluck twice, no bank changes.

Six focused speak checks, full pre-commit suite and dealer-sync --probe passed.
These checks do not establish perceptual lip-sync approval. Measured settled
clock deltas in the runs ranged roughly -35 to -127ms; this task does not claim
sample-perfect playback sync or native source quality beyond the supplied takes.
User's existing localhost4190/Amira session and live database were left alone.

## 2026-09-20 — Folded resting pose, physical bridge and speech height

User chose folded hands like the original f599e503 idle and explicitly requested
a transition from its end into the current ready pose. Implemented in
`content/staging/2026-09-20/astrid-calm-rest/`; exact requests and receipts retained.
One built-in GPT Image plate, Seedance2.5 folded idle744a9e34, rejected Seedance2.5
bridge d51c19ba, corrected Seedance2.0 bridge92521ca6. No other generation jobs.

New folded loop uses native frames72–144, omitting prolonged closed eyes at source
start. Bridge retains native empty-hand unfolding frames40–96 at1.5x; six-frame
silent optical-flow endpoint joins close small residual pose differences. Reverse
playback gives the folded return. Rigid actor translations align the heads;
camera, actor scale and table stay unchanged. No masks consume the eyes (encoded
head alpha255; no repair pixels needed). The first bridge was rejected before
installation for changed starting arm geometry.

`astrid-folded-rest.mjs` wraps the existing ready/glance player. Folded breathing
loops, unfolds into an existing glance every third loop, folds back, and waits
for the physical bridge before speech/card actions. Consecutive speech keeps the
ready pose. Assets bind to the current ready source hash. Optional manifest makes
fallback to the existing waiting player possible if rest media cannot load.

Also fixed speech rising: actor offset[0,20] applied uniformly to all17 recorded
takes and their rebuilt entry/exit maps. No source speech RGB/audio changes.

Actual isolated guest4211 rendered checks: repeated rest/bridge/glance/return,
greeting and consecutive goodluck, request during folding, complete zero-based
Box4 round (4H+8H, hit7S =19; dealer bust; $5 stake/$10 return/balance1005),
dealerbust speech and resumed folded idle. Final log has no new warning/error.
Vera/Amira/Mei two-play goodluck regression retained. 11 focused checks,
full pre-commit and dealer-sync --probe passed. See the staging README and
height-qa/gameplay-qa contact sheets/logs for evidence and source decisions.

Small skin-tone/texture differences remain between independently generated sources.
The reverse bridge is not a separately filmed return. No new broad visual acceptance
of speech, lipsync or all seven seats is implied. User4190 session/database untouched;
no production deployment or push. Review remains Astrid on port4211.

## 2026-09-20 — Astrid color/scale and loop seam correction

User rejected visible skin-tone/size shifts and broken loops in the folded-rest
revision. Repaired from existing sources only; no new generation jobs.
Staging: `content/staging/2026-09-20/astrid-seam-repair/`.

All17 speech display copies now use a fixed first-plate uniform scale/translation
and fixed measured RGB balance against the existing ready source. Exact text,
original recordings, mp3 hashes, frame counts/fps and audio offsets stay unchanged.
New enter/exit maps bind to the display hashes. They are review assets; previous
visual acceptance is not inherited. Source build scripts follow hash-bound display
revision/rest manifests so normal rebuilds cannot quietly restore old copies.

Folded idle has a 12-frame motion-aligned moving overlap and adjacent-frame wrap.
Out/back share that loop entry. Player waits for the boundary before unfolding,
coalesces callers, and avoids an idle flash when readiness is requested during
folding. Old full-head-turn glances are omitted from this folded cycle; native
breathing/eyes remain. Pending holds/seeks settle on disposal.

Rendered isolated guest4211: all17 lines, greeting/goodluck twice, multiple complete
idle wraps, full Box4 round 5H+6H hit6D=17, insurance declined, stand, dealer bust,
stake5/return10/balance1010 and resumed folded rest. No new warnings/errors. Shared
Vera/Amira/Mei goodluck twice in a separate hidden rehearsal, unchanged media.
Focused lifecycle/speech checks, full pre-commit and dealer-sync --probe passed.
Independent audit:1060 speech frames, eye alpha>=250, no new opaque crop loss;
loop wrap head difference25.32->1.91. Visual sheets and captured transition video
retained. These measurements are not blanket source/lipsync/all-seat acceptance.

Limits: waiting for a safe exit can add up to2.54s before unfolding. Return still
reverses the silent bridge. Generated facial texture/expression differences remain;
this correction addresses tone, scale and cuts, not a new identity generation.
User4190 database/session untouched. No production deployment or push. CAC-9 remains
In Dev: this seam work does not close its broader hand/fingertip masking expectation.


## 2026-09-20 — Amira branded table, clear room, supplied speech and waiting loop

User moved work to Amira and supplied17 raw talk clips plus waiting job5f2929a3.
All are now mounted through the shared keyed player. Speech retains1,123 native
25fps frames, exact captions/MP3 hashes and measured0ms embedded-audio lag.
Face/eyes/namebadge alpha survives the exported matte (minimum253 face). Waiting
retains121 native24fps frames from the named5s take, with a rigid(+11,+1)px
translation to align the head. No additional video generation or source repaint.

Amira uses table-v2.blend with Scout branding and restored warm felt#665139;
Astrid felt returns to#263336. A built-in GPT Image room edit based on Amira's
original removes the extra foreground table, raises lighting and shows more floor.
Saved scene-clear-v2.png (1672x941), original preserved, prompt/receipt in
content/staging/2026-09-20/amira-room-clean/.

Fixed absent/tiny card artwork in Blender mode when PerformancePlayer is absent.
Moving and settled cards share the face artwork, Amira with larger indices and
stronger contrast. Physical card geometry unchanged. Dealer fan19cm ahead of
rear edge and total positioned to its left. Astrid filmed dealing is temporarily
paused per user request; shoe-to-seat delivery plus existing idle/speech remain.

Rendered isolated guest4211: all17 Amira lines; greeting/goodluck twice; eight
waiting wraps and speech return; seven-seat round through settlement (stake35,
return40), hits; later center9S+7S hit/bust/settlement with jumbo artwork and new
room (stake5/return0). Vera two-play regression complete. Fresh Mei/Astrid final
rechecks were interrupted by closed tabs; final dealer-fan22->19cm capture also
interrupted. Do not report those checks as completed.18 focused tests, full
pre-commit and dealer-sync --probe pass. Evidence and limits in
content/staging/2026-09-20/dealer-table-review/README.md.

Limits: supplied1K speech differs in detail/tone/left-hand pose from newer2K idle.
The boundary is still visible; no seamless-transition or all-line lip-sync approval.
Speech waits up to5.04s for the front-facing idle endpoint. No raw/source assets,
user4190/live DB, production or remote deployment changed. CAC-9 stays In Dev;
Amira work does not close that broader Astrid report.

## 2026-09-20 — Amira composite and idle/speech boundary repair

Amira now uses opt-in `actor-composite-scene.mjs` / `actor-grade.mjs` with editable
`review/amira-composite/profile.json`: fixed luminance-first speech/waiting grades,
warm measured room/felt edge wrap, source-frame hand/forearm contact shadows,
softened lower silhouette cast shadow, frontal soft table key and shared finish.
No camera/actor scale/source matte/MP3 changes. Skin ROI median-luma gap .0693 to
.0123; native1K speech softness remains. The common finish is browser GPU
backdrop/grain/vignette, actor and shadows are WebGL. Local waiting measured
rAF median16.7ms/p9518.0ms, not a universal60fps/source-resolution claim.

User then specifically rejected Amira idle/speech transitions. Added34 fitted
silent320ms joins, source-hash-bound, with both endpoints captured from the actual
graded compositor. Native speech frames/clock/audio remain intact; no regeneration
or re-key. Contact anchors and cast alpha follow the join. Waiting frame0 is
prepared before reveal. Fixed existing registration converts into common crop
space; actor perspective/size does not change. Other dealers retain their prior
ungraded/packed-join branch.

Evidence: `content/staging/2026-09-20/amira-composite/` (JSON, measured samples,
same-frame hair/shoulder/hand before/after crops, actual guest hit/bust/settlement)
and `amira-transitions/` (build, endpoint samples, real GPU entry/return sequences,
all17 playback results, all-four two-play regression). No shader/playback errors.
Seven focused tests, full pre-commit and dealer-sync --probe pass; legacy probe
missing-take gaps unchanged. User visual acceptance still required; source pose
and sharpness differences can remain perceptible. Speech can wait up to5s for
the waiting endpoint. No credits, source regeneration, live DB, production or
remote deployment. No broader Astrid/CAC-9 completion claim.

Follow-up: user requested softer hair edges. Added opt-in Amira dark-hair-region
alpha feather3.4px/75% and wrap19%, adjusted for native crop width. Face/eyes and
all source RGB stay sharp; no new matte. Composited transition endpoints inherit
the same treatment. Hair before/after evidence is in the composite directory.

## 2026-09-20 — production original/V2 demo switcher

User requested deployment with Astrid V2 and Amira V2 beneath the existing dealer switcher for a before/after demo. Published current keyed/Blender presentation under `/v2/` and added the comparison row to the captured original production frontend. Root original media/player stays available; both routes use the same authoritative API/session/wallet. Filmed Astrid dealing remains paused. No generation, backend restart or live database copy.

See `docs/releases/dealer-v2-2026-09-20.md` and its SHA-256 manifest for exact routes, source capture, rollback and verification. Isolated production-backend preview passed both V2 complete rounds, wallet continuity, mid-round switch guard, original seven-seat hit targets and repeated speech regression. Repository checks passed. Public static files/range serving verified on server; final public browser view remains gated by existing HTTP login. Mobile viewport override did not apply, so mobile appearance is not marked verified. Only task-owned switcher/build/docs files are committed.

## 2026-09-20 — BO session access to the game

Fixed and deployed the separate HTTP Basic gate and missing BO-to-player session connection. An existing BO login in the same browser now authorizes the original/V2 game via a browser-bound single-use code; logged-out users sign in to BO and return to their selected dealer. The BO cookie stays on its own host. The ordinary CRAIG player link preserves wallet/table state and grants no backoffice privileges. Partner launch handling now also covers `/v2/`. Game APIs remain authenticated; no production guest mode or media/player presentation changes.

See `docs/releases/bo-game-auth-2026-09-20.md` for protocol, release/rollback paths and verification limits. New actual-server authentication tests, existing password/CRAIG tests, eight table HTTP scenarios, full pre-commit and Caddy validation pass. Isolated browser completed BO login → Astrid V2 → $5 round/push/collection → original Amira → Amira V2 with the same session and $1,000 balance. Public browser now reaches BO sign-in instead of HTTP Basic/blocked-site errors. No production BO cookie existed in the test browser, so no real user's wallet was used to test live authenticated gameplay. Five scoped app files plus Caddy game routing deployed at 11:21 UTC; live databases were not copied or replaced.
## 2026-09-28 — Victoria som Astrids röst för genererat tal

Astrids genererade chatsvar och labbets fristående röstprov använder nu Cartesia
Victoria (`sonic-3.5`, röst-ID `dc30854e-e398-4579-9dc8-16f6cb2c19b9`).
Den icke-hemliga profilen finns i `web/public/astrid-voice-profile.mjs`;
`CARTESIA_API_KEY` läses fortsatt enbart på serversidan. Produktens talväg
begär rå 24 kHz PCM, paketerar samma ljud som WAV till RunPod och binder ljud,
video, exakt text och profilrevision i talpaketet. Äldre redan skapade
ElevenLabs-paket är fortfarande läsbara; inspelade repliker regenereras inte.
Labbets separata MP3-röstprov använder samma Victoria-ID och modell. Cartesias
röstmetadata anger engelska med brittisk accent; kvalitet på svenska svar behöver
lyssnas igenom av Jakob.

Ett autentiserat, kort Cartesia-prov gav HTTP 200 med 24 kHz PCM för
produktvägen och HTTP 200 med MP3 för labbprovet. Riktade tester, hela
`.githooks/pre-commit` och `pipeline/audit-dealer-sync.mjs --probe` passerade.
Lissabon byggdes om och servrarna på 4200/4201 startades om; `/api/voice`
rapporterar Victoria och `/api/social` rapporterar genererat tal konfigurerat.
Ett separat funktionstest av Cartesia→RunPod gav 720 ms Victoria-ljud och
35 videorutor på 52,9 s totalt (videokö till renderstart cirka 31,7 s).
Detta prov passerade paketets tekniska kontroller, men spelades inte i den
anslutna Astrid-vyn och är inte ett visuellt godkännande. OpenClaws hela
chattbeslutskedja är inte omtestad i denna ändring.
En annan agents ändring i `emil/dealklipp-v1/lab-video-manifest.json` och äldre
ospårade filer lämnades orörda.

## 2026-09-28 — förberedelse för fjärrdrivet Astrid-spel och Lissabon

Arbetskopian är nu `jakemanator123-github-work` på privata GitHub-spegeln.
Whisper-översättning till engelska och Terra som tillåten bildmodell levererades
i föregående commit `7127830`; lokalt syntetiskt prov passerade. Fysisk
mikrofon/kamera, Terra genom den driftsatta kedjan och faktisk bildlagring är
fortfarande inte slutverifierade.

Aktiv spel- och minnesdatabas är `lissabon/data/players/croupier.db`; `craig.db`
är kontodatabasen. Projekt och revisionshistorik finns under `lissabon/data/`.
Inget av detta ska raderas vid omstart. En privat, hashverifierad kopia av
38 tillåtna filer (4 564 123 byte) togs medan det samordnade serverparet var
stoppat, med `tools/backup-lissabon-state.mjs`, utanför checkouten i Jakobs
Documents. Originalen och sparade val är orörda. En isolerad filåterläsning
och SQLite-integritetskontroll beskrivs längre ned; en spelrunda efter
återställning återstår.

Behåll ett källrepo för Web, Lab, OpenClaw och delade medier. De nya
konfigurationsvägarna ger Web och Lab samma absoluta `LAB_VIDEO_ARCHIVE`,
Partner-observatören en exakt serverkonfigurerad HTTPS-spelorigin och genererat
tal ett uttryckligt molnläge med privat lagring och autentiserad drift. En
root-`.dockerignore` utesluter lokala databaser, hemligheter och stora
arbets-/stagingfiler från en framtida byggkontext. Ingen root-container har
byggts; Docker finns inte installerat här. `docs/CLOUD-MIGRATION.md` och den
redigerade läsande `tools/cloud-readiness.mjs` visar kvarstående hinder.

Verifierat: 60 riktade tester, alla fyra dealers i `audit-dealer-sync --probe`
och det fulla pre-commit-flödet vid leverans. Mediemanifestets 43 poster har
kontrollerats mot metadata och filstorlek; det är inte visuell acceptans.
Produkt- och labbservrarna är fortsatt stoppade enligt Jakobs begäran. Fyra
dealers fysiska tvåspelsrepetition, fjärr-HTTPS, beständighet efter omstart,
kamerans verkliga flöde, synkroniserad mediaåtkomst och driftsatt OpenClaw-
beslutskedja återstår. Inga privata databaser har laddats upp eller ändrats.

## 2026-09-28 — säker BO-session och spärrad molnstart

BO-sessionen kräver nu ett giltigt `backoffice`-audience, aktuell CRAIG-identitet,
oförändrat lösenordsavtryck och samma BO-roll som när sessionen skapades.
Partnerns lanseringstoken kan inte längre läsas som BO-cookie. Gamla BO-cookies
utan audience kräver ny inloggning. Isolerade tester täcker BO-data,
e-postinloggning, roll- och lösenordsbyte, raderat konto och fortsatt
BO-till-spel-överlämning. Lokal kod är verifierad; driftsatt BO är inte omtestad.
BO:s skrivande API kräver dessutom ett exakt BO-Origin; syskonorigin och
saknat Origin nekas. Isolerat test bekräftar att nekade anrop inte ändrar
BO-konfigurationen.

`ops/cloud/` innehåller ett första bygge för Web och Lissabon på en långlivad
värd med en port, exakta värdnamn och gemensam beständig disk. Start är
avsiktligt spärrad i kod tills publik autentisering, Lab-åtkomst, routing
och kakornas värdgränser är lösta och provade. Ingen container är byggd eller
publicerad. Ingen lokal databas har skickats till molnet. För en ren Vercel-
drift krävs dessutom transaktionssäker extern SQL-lagring, objektlagring för
uppladdningar/klipp och en beständig jobbväg för lång renderering. Lokal
produkt och Lab är fortsatt stoppade.

Den privata backupen provåterlästes 2026-09-28 i en tillfällig katalog utanför
checkouten. Alla 38 manifestposter matchade sina SHA-256-värden och både
`croupier.db` och `craig.db` gav `PRAGMA integrity_check = ok`. Provkopian
togs bort efter kontrollen; originalen och backupen är orörda. Detta verifierar
filerna, inte en fullständig molnstart eller en spelrunda efter återställning.

## 2026-09-28 — opt-in strömmad läppsynk

Emils fristående worker har kopierats med källproveniens till
`services/astrid-gpu-worker`. Den nya vägen skickar Cartesia-PCM löpande till
MuseTalk och returnerar H264/AAC i samma fragmenterade MP4. Spelservern lämnar
en signerad, sessionsbunden biljett före TTS. Delad spelare kontrollerar
dealerposition före anslutning och uppspelning och använder en hörbar video.
Beständig deduplicering delas med filläget; logout, glömt minne, ändrad runda,
profilbyte och avbruten uppspelning stoppar arbetet. Funktionen är avstängd som
standard. Labbets filbrygga annonserar inte streamingstöd.

Isolerad integration: hela pre-commit-flödet, labbets produktionsbygge och
`audit-dealer-sync --probe` passerade. Två browserprov med riktig produktservice,
Python och FFmpeg gav första bild efter 897 respektive 1 031 ms, före ljudslut.
Källljud och modellrutor var syntetiska: detta är inte uppmätt GPU-latens eller
visuell läppsynkacceptans. Inga befintliga dealerassets, kalibreringar eller
baslinjer ändrades. Produkt- och labbservrarna förblir stoppade.

Den aktuella privata RunPod-talkonfigurationen gav HTTP 200 vid läsande
hälsokontroll. CPU-provbygget från `7644c44` passerade i GitHub-körning
`36471104794`: hela imagen, båda avatarerna och streamingimport verifierades.
Byggsteget tog 5 min 36 s. Ingen image publicerades och inga betalda GPU-jobb
startades. Separat test-endpoint, kostnadsram, verklig kvalitet/latens och alla
fyra dealers tvåspelsrepetition återstår. Molnscaffoldens startspärr är kvar;
dess proxy saknar ännu WebSocket-stöd. Integrationens pilot kräver samma origin
för spel och streaming. Se `docs/STREAMING-INTEGRATION.md` för driftkrav.

Sammanförandet med `c3168ed` behåller BO:s nya ursprungs- och sessionskontroller.
Molnscaffoldens sex tester och medieproben passerade även i den gemensamma
arbetskopian. HTTP-provets miljöisolering har rättats för checkoutar med privat
talkonfiguration; dess nätspärr blockerade externa anrop även före rättningen.
Leveranscommiten kör hela pre-commit-flödet igen.

GitHub-prov på Linux hittade därefter en testkapplöpning: klientens WebSocket
kan stängas före serverns `close`-händelse. Reläproven inväntar nu serverns
verkliga frigöring med tidsgräns och kontrollerar avvisningens kod 1008.
Produktionskoden är oförändrad av denna rättning.

GitHubs tre kontroller passerade för `f4e2b8e` (körning `36470135995`). Ett
separat manuellt jobb, `astrid-gpu-build.yml`, förbereder CPU-provbygge av hela
GPU-imagen med båda avatarerna. Det publicerar ingen image och startar ingen
GPU-handler. Byggresultat måste kontrolleras separat från kodtesterna.

## 2026-09-28 — förberedd BO- och Lab-åtkomst för en molnvärd

`ops/cloud/` skiljer nu på spel-, BO- och Lab-värd. Spelet får bara läsa
BO-konfigurationens publika GET; andra BO-rutter stannar på BO-värden. Lab
kräver administratörsinloggning på BO, engångskod bunden till den startande
Lab-webbläsaren och en värdbunden HttpOnly-cookie. Ingången kontrollerar den
aktuella CRAIG-identiteten för varje Lab-anrop och ger därefter Next Lab en
intern behörighet som webbläsaren inte kan sätta. Okända värdar och
förfalskade forwarding-headers avvisas.

BO- och Lab-sessioner har nu en växande behörighetsversion i CRAIG. Roll- eller
lösenordsändring återkallar äldre sessioner permanent, även om det tidigare
värdet återställs. Lab-inloggningens publika start begränsas till 120 per minut
och 500 väntande poster. Efter en lyckad inloggning öppnas önskad Lab-sida,
men frågeparametrar sparas inte i överlämningen.

Riktade tester för BO/spel, BO/Lab, molningång, Lab-guard och
molnberedskapsrapport passerade. Den läsande molnkontrollen accepterade en
isolerad datakatalog men returnerade fortsatt kod 2, eftersom startspärren är
kvar. Ingen container, betald tjänst eller devserver startades. Verklig HTTPS,
cookiebeteende, beständighet efter processomstart, medier och hela Astrids
tal-/bildkedja måste fortfarande verifieras på den avsedda värden innan
startspärren kan tas bort. Detta paket inaktiverar ännu genererat tal och
kamera i molnläget; se `docs/CLOUD-MIGRATION.md`.

## 2026-09-28 — säkrare första molnstart och valbar Astrid-media

Molnkonfigurationen kräver nu den separata produktens OpenClaw-talrelä och
vidarebefordrar en begränsad svarstidsgräns. En ny tom CRAIG-databas kräver
en engångsuppsättning av administratörsnamn och starkt lösenord via privata
värdvariabler. Molnservern skriver inte ut lösenordet, återskapar inte
kontot vid omstart och upphöjer inte längre det äldre lokala `kevin`-kontot.
Den läsande startkontrollen avvisar en tom eller saknad CRAIG-databas om
uppstartsuppgifterna saknas. Operatören tar bort dem från värdplattformen
efter första inloggningen.
Den lokala startens befintliga beteende är bevarat. `POST /calibration` är
uttryckligen stängd i molnläget.

Kamera/Whisper och genererat tal/video kan nu konfigureras separat för
molnservern. De är avstängda som standard, och respektive leverantörsnyckel
går endast till produktprocessen, inte Lab. Talet översätts till engelska.
Produktprocessen kan ligga på loopback bakom den kontrollerade HTTPS-ingången.
Strömmad WebSocket-läppsynk är fortsatt avstängd i denna väg.

Isolerade tester för molnkonfiguration, första inloggning, BO/Lab-behörighet,
kamerakontrakt, transkription och genererat tal passerade (43 delprov).
`audit-dealer-sync --probe` matchade alla fyra dealers baslinjer, men mänsklig
läppsynkacceptans återstår. Hela repots pre-commit-kontroll passerade.
Inga leverantörsanrop, permanenta devservrar eller betalningar
gjordes. Molnstartens kodspärr är kvar tills verkliga HTTPS-, disk-, tal-,
bild- och browserprov har godkänts. De stoppade lokala servrarna förblir
stoppade.

## 2026-09-29 — isolerat Vercel-, Render- och OpenClaw-prov

Testbackenden `croupier-vercel-preview-qa` skapades på egen Render-hostname,
egen tom SQLite-databas och 1 GB disk under `/var/data`. Den befintliga
`croupier-v2` och dess databas rördes inte. Render-planen var 1c-2g
($25/månad) plus disk ($0,25/GB/månad), båda tidsproportionerade. Tjänsten
var aktiv omkring 40 minuter, under gränsen två timmar/$1, och är nu
**Suspended**; Render visar att suspenderade tjänster inte faktureras.
Slutlig fakturerad summa är ännu inte tillgänglig. Testhost:
`https://croupier-vercel-preview-qa.onrender.com` (otillgänglig medan pausad).

Den separata Vercel Preview-deploymenten
`https://croupier-player-preview-aupuistes-jakeminator123s-projects.vercel.app`
serverade den riktiga spelklienten. Efter proxy-origin- och Three.js-byggfixen
i `01e9aea9` loggade ett syntetiskt konto in: HTTP 200 med hostbunden
`HttpOnly; Secure; SameSite=Strict`-cookie, `Cache-Control: private, no-store`
och ingen extern `Location`. En omladdning mitt i runda behöll korten,
aktiv hand och saldo $995. Första $5-rundan återbetalade $10 (saldo $1005);
andra $5-rundan återbetalade $0 (saldo $1000). Två efterföljande rundor
hämtade Astrid-filmer via Vercel med HTTP 200. Ett autentiserat
`Range: bytes=0-1023` direkt mot **testbackenden** gav HTTP 206,
`Content-Range: bytes 0-1023/1072958` och 1024 byte. 206 genom Vercels
rewrite är ännu inte verifierat; direkt navigation till API-filen blockerades
av webbläsaren. Ingen mänsklig visuell läppsynkacceptans gjordes.

En Neon Free-resurs, `croupier-preview-neon`, skapades och kopplades
**endast** till `croupier-player-preview-qa` för Vercel Preview. Resursen
är tillgänglig; hemligheter hämtades inte lokalt. Spelet använder fortfarande
den isolerade SQLite-databasen. Postgres-schema, migrering, Render-anslutning
och backup/restore krävs innan Neon kan ersätta spelets databas.

OpenClaws smala produkt-talrelä provades med en helt syntetisk Astrid-begäran
och ett enda `gpt-5.4-mini`-anrop (budget högst $0,10 och 30 sekunder):
Director svarade HTTP 200 efter 4,36 sekunder med ett kontraktsgiltigt
`recordedLine`-beslut för `goodluck` och
`speak.goodluck.standard`. Kostnad uppskattas under $0,01; faktisk
leverantörsfakturering är inte avläst. Det redan upptagna lokala
serversessionslåset hindrade ett separat browserprov som binder just detta
modellsvar till uppspelning; de två Preview-rundorna ovan är ett fristående
uppspelningsprov. Inga produktionsinställningar ändrades.

Medie-QA var läsande: manifestet anger 28 familjer/51 poster, men ägare för
de ocommittade Astrid-filerna och avsikten med dubbla box-5-varianter är inte
verifierade i agent-talk. Manifesttest och `audit-dealer-sync --probe`
passerade, vilket bara visar struktur och baslinjehash. För varje ändrad take
återstår exakt händelse/text och ljudstatus, video och frame index,
kalibrering/kortkontakt samt två uppspelningar i den verkliga spelaren.
Ingen mediefil, policy, kalibrering eller baslinje stageades eller godkändes.

### Astrids zonlagring på Vercel, 2026-09-29

Jakob beslöt att zonvideor ska få Vercel Blob och zonmetadata en **ny, egen**
Neon Postgres-databas. Det först skapade, tomma publika lagret raderades när
Jakob begärde projektlåst media. Blob `croupier-astrid-zone-media-private`
(`store_AqwvebTbBHarOjvG`) skapades privat i `arn1` och kopplades till
`croupier-player-preview-qa`.
Neon Free `croupier-astrid-background-zones-db` skapades i `fra1` med
Neon Auth av och `CROUPIER_ZONES_*` endast i Preview och Development.
CLI-listning verifierade båda resurserna och variabelnamnen utan att visa
hemligheter. Den tidigare `croupier-preview-neon` och dess oprefixade
`DATABASE_URL` är **en annan databas** och får inte användas för zoner.

Efter uttryckligt godkännande laddades
`background-man-aligned-206x284.mp4` till det privata lagret. CLI visade ett
objekt på 65,76 KB; en oinloggad HEAD mot dess direktlänk gav HTTP 403.
Det tidigare försöket till publik uppladdning hade stoppats av automatisk
godkännandegranskning och överförde ingen fil. Neon har inte fått zondata.
Lab `/zones` sparar ännu zoner i `localStorage` och klipp i IndexedDB;
`light-2`-blinkklippet finns bara i den webbläsarprofilen. Ett skyddat
Lab-API och en behörig medieväg med HTTP Range behövs innan privat Blob
kan användas i speluppspelningen. Se `docs/ZONE-CLOUD-STORAGE.md`.

### Importerad landningssida och sista isolerade Preview-prov, 2026-09-29

Jakob beslutade att `Jakeminator123/croupier-frontend` ska in i detta repo och
ersätta den enklare länksidan till blackjack. `main` vid `2ec2b3f2` är nu
importerad under `apps/croupier-frontend/` som en egen Next.js-app. Både
spelknapparna på `/demo` använder byggvariabeln `CROUPIER_GAME_URL`;
standardvärdet behåller den tidigare Render-pilotlänken. Källa och v0-projekt
synkas inte automatiskt. `pnpm build` och `pnpm exec tsc --noEmit` passerade.
Den senaste isolerade landnings-Previewn är
`https://croupier-landing-preview-eokix0slk-jakeminator123s-projects.vercel.app`.
Browsern visade startsida/introscenen och `/demo`, och båda spelknapparna
pekade på den senaste isolerade spel-Previewn.

Spel-Previewn är
`https://croupier-player-preview-3esw2v3fl-jakeminator123s-projects.vercel.app`.
En exakt rewrite för `/kevin-cards/back-scout.png` lades till; både den och
`/assets/cardback.png` visades som bilder via Vercel. Test-Render svarade 200
på `/__cloud/health`. Samma syntetiska konto loggade in genom nya Previewn.
Astrid syntes och native video spelade med `readyState=4`, 1080×1920; en
inspelad utdelning syntes vid bordet. Med Standard-klippval, utan nytt
modellanrop, gav en serverägd $5-runda saldo $1000→$995 och efter dealerbust
$1005 med $10 återbetalt. Omladdning mitt i rundan behöll 8♥ mot 3♠/7♠
och $995. Detta är browserkvitto för spelvägen, inte visuell acceptans av
de ocommittade Astrid-takens läppsynk. Vercels HTTP 206 för Range och
Partner-SSE är fortfarande oprövade. `streams/kf.json` finns inte i källan;
den frivilliga keyframe-debuggen ger 404 men användes inte i spelprovet.

Render-testtjänsten återupptogs enbart för detta prov och är åter
**Suspended**; Render bekräftar att pausad tjänst inte faktureras. Slutlig
debitering är inte avläst. `croupier-v2`, dess databas och befintlig
produktionsingång är orörda. Innan produktionsbyte återstår bland annat
Range/206 genom Vercel, backup/restore, mobilprov och separat SSE/WebSocket.
