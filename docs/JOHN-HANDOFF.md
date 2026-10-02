# Aktuellt arbete och kvarvarande verifiering

Uppdaterad 2 oktober 2026. Kort aktuell handoff; äldre rapporter har rensats
på Jakobs begäran. Media, JSON-kvitton, kalibreringar och baseline bevaras.
Uppdatera denna fil i stället för att skapa fler arbetsrapporter.

## Plattform och gemensam media — pågående verifiering 2 oktober

Ansvar: Render äger fortsatt slump, kort, shoe, regler, saldo och resultat.
Vercel får spel-/BO-gränssnitt och Lab UI; Lab API och sparade projekt finns
fortsatt på Render. Neon har separata game/auth-scheman och en separat databas
från befintliga zonmetadata. Produktionsdatabasen är flyttad till Neon;
Vercel-UI och det nya Blob-indexet inväntar sina molnprov.

Produktionsbyte 2 oktober: aktuellt exportläge med noll Web/Lab-skrivare,
hashverifierade SQLite-backuper utanför Git, 24 källtabeller/102 rader och
full backup/restore-paritet för 32 PostgreSQL-tabeller. Inga aktiva externa
wallet-kopplingar fanns. Senaste driftkontroll: Render `dep-davsisqvcj2c738laod0`,
commit `f52ded5f`, är live med PostgreSQL; verklig befintlig superadmin-login och spelarnas
administrationsvy bekräftar rätt lagring. Två befintliga spelare bevarade;
inga produktionskonton eller spelrundor skapades för test.

Implementerat: asynkron PostgreSQL-väg utan SQLite-fallback; explicit
schema-install/import och backup/restore med tabellantal, radhasher och
sekvenskontroll. Aktiva externa wallet-kopplingar spärrar import tills deras
återställningskontrakt är verifierat. BO kan skapa demospelare, blockera,
återaktivera och avsluta konto med orsak/audit; historik och saldo bevaras.
Stängning vägrar pågående hand; avslutade konton kan inte återaktiveras.

Riktig isolerad Neon QA: import av 31 tabeller, full backup/restore-paritet,
samtidiga identiska native-starts med ett avdrag, transaktionsrollback,
CRAIG-epoch, block/revoke/reactivate, chat-forget-race och probe-kvitton
godkända. Riktig Web-server: BO/player-login, kontoavslut, native table och
alla fyra dealers gamla media-GET/HEAD/304 godkända; inga SQLite-filer skapades.
Vercel/Lab opt-in-byggen, 555 Lab-tester, hela obligatoriska hooken och
riktade ingress-/roll-/streamtester godkända.
Isolerad browserkontroll mot riktig Neon passerade samtliga sju spelvägar
med två verkliga uppspelningar vardera (14 starter och 14 avslut), ljud- och
bildframsteg, Lab save/reload, projektrevision i spelaren och en beständig
spelrunda med saldo/ledger-paritet. Tidiga repetitionsklick spärras tills
serverns verkliga initialisering är klar. Inga JavaScript-fel eller HTTP 500.
Molnets Lab-observation kan nu öppna och återanvända samma BO-spelflik med
exakt HTTPS-origin och spelarens riktiga kvitton, utan Partner-launch/SSE.
23 fokustester och Lab-TypeScript passerar. Två fasta native Node-funktioner
ersätter nu de experimentella SDK-rutterna för `/speech-stream` och
`/lipsync-worker`. Middleware skriver om till två interna API-paths i samma
projekt och avvisar direkta anrop till dessa paths. Node-funktionerna
exporterar HTTP-server utan egen lyssningsport och väntar på Render-auth
före publik 101: exakt Origin/kaka/ägarsession och engångsbiljett, eller
worker-bearer. Inga nya servrar eller spelmotorer införs.
Native 4/4, hela frontend 26/26, faktiskt Next-bygge och installerad
`@vercel/node`-byggare passerar. Båda funktionernas filspårning inkluderar
native-factory och ws. Riktig relay verifierar två sessioner, bytes och
terminal 1000 samt nekad främmande kaka, återspelning och worker-token.
Worker-funktionen har 600 sekunder för befintlig 540-sekunderslease;
klientfunktionen har 300 sekunder. Nativevägens molnprov återstår.
Molnproven på `e78441f0` och `8d678f3e` öppnar klient och worker men ger endast
`ready`, inga mediebytes; 60 sekunders provgräns misslyckas även med `after`.
Vercels säkra faslogg visar mottaget start/4800 PCM-byte/slut från Render
och köade utgående meddelanden; klienten får bara första `ready`.
SDK-kontextens `waitUntil` finns i molnet, så dess frånvaro är inte felets
bevisade orsak. Molnprov `f52ded5f` avgränsar felet vidare: alla sex utgående
skrivningar får callback utan fel, med noll kö/cork och ökande byteantal.
Render bekräftar start, 4 800 PCM-byte och slut till testworkern; workern
svarar med stream, 32 syntetiska mediebyte och done. Inga inkommande
worker-meddelanden når SDK-bridgen. Samma 60-sekunders klientprov misslyckas.
Detta avgränsar ändringen till native Node-ingress/livscykel för de två
strömningsrutterna; manuell uncork eller längre timeout saknar stöd i mätningen.
Render-barnens vanliga stdout kastas bort; endast strikt tillåtna QA-faser
vidarebefordras i den isolerade obetalda testmiljön. Hela den
isolerade strömkedjan med faktisk serverkod, SDK och syntetisk worker passerar.
Säker QA-instrumentering av faser och byteantal avgränsar molnfelet;
inga identiteter, repliker, biljetter eller nycklar loggas. UI/nya Blob-indexet
aktiveras först efter verkligt godkänt prov. Samtliga tre CI-jobb på
`f52ded5f` är gröna. CI:s isolerade HTTP-fixture väntar
nu högst fem sekunder på serverns
korta SQLite-skrivningar; alla nio riktiga HTTP-kontroller passerar lokalt.
Detta ersätter inte visuell läppsynks-QA.

Media har flyttats till `media/dealers/<dealer>/{runtime,source,review,staging}`
samt `media/game` och `media/site`. `runtime` anger användning, inte visuellt
godkännande. 4 924 filer, 2 911 452 931 byte, kopierades och SHA-256-kontrollerades
före gamla filer togs bort. ID, bytes, kalibrering och Emil/Kevin-proveniens
bevaras; `media/layout.json` innehåller explicita gamla URL-/sökvägskopplingar.
Ingen ny godkänd läppsynk påstås. Privat Blob-export är färdig: 4 265 mediafiler,
2 907 216 339 byte och 4 162 unika objekt verifierades efter uppladdning.
`media/blob-index.json` matchar exakt hela exportplanen; Lab-banken och tillåtna
originalförhandsvisningar läser samma index. Felaktig eller saknad aktiv källa
ger 503 utan diskfallback. Moln-QA föregår aktivering; gamla Blob-objekt bevaras.

Produktionsdrift använder Neon med befintliga Render-adresser och mediekonfiguration.
Isolerade QA-projekt har egen Neon-databas, hostname och privata ingressnycklar;
betalda speech-/kameraanrop är av. Backup och verifiering föregår skarp flytt.

## Tidigare verifierad Backoffice/Lab-konsolidering

Före: Lab/Studio och separat BO-navigation; originalmotorernas klippval låg
i BO medan Astrids Studio-val låg i projektet; privata profiler låg i Lissabon.
Efter: gemensam Backoffice/Lab-meny, återanvänd BO-administration (14 sektioner),
versionssparade klippval i Lab och en native-vy för spelarens verkliga kvitton.
Eventeditor, bibliotek, bakgrundszoner och OpenClaw finns i samma navigation.
BO:s egna rollkontroller bevaras; Lab-kontot ger inga nya BO-rättigheter.

Alla aktiva redigerbara klippbindningar sparas i det befintliga projektet.
`legacyClipPolicy` används av originalmotorerna efter sidstart;
`mediaPolicy`/`idlePolicy` av Astrids `presentation=local`. Äldre BO-tilldelningar
är bevarade men inaktiva; skrivendpointen ger 410. Import kräver uttrycklig
exakt match. Inspelat tal och osäkra staged-klipp behåller sina kvalitetsgränser.
Medieregistren återanvänds; inga filmer eller kalibreringar kopieras/ändras.

Observation startar ingen extra spelare. Explicit separat Lab-preview är
märkt och av från början; native och Partner-SSE dubbelmatar inte samma prov.
Nativekedjan visar event, urval/familj/variant, orsak, revision och faktiskt
start-/bild-/slutkvitto. Registrerat/valt/nedladdat innebär aldrig spelat.
Genererat tal visas separat med samma request-ID genom besluten och kvittona.

Hela `lissabon/` är borttagen. 39 privata datafiler (4 568 960 byte) flyttades
utan överskrivning till `lab/data`, inklusive projekt, historik och båda DB.
42 originalfiler finns i hashverifierad extern privat backup, se
[återställningsguiden](ENVIRONMENT-RESTORATION.md). Startare och sessionsvakt
använder Lab och återskapar inte Lissabon; äldre sparade projekt kräver migrering.
`/lissabon`-redirect och Start-Lissabon.cmd är kompatibilitetslänkar till Lab.

Kodkontroll: 549 Lab-tester, full hook (godkänd, en plattformsskip),
TypeScript, produktionsbygge, migrations-/backup-/guardprov och fyrdealerprobe
godkända. Oberoende review hittade ett falskt ärvt playbackkvitto; rättat med
regression där ett nytt valt klipp aldrig ärver föregående klipps uppspelning.
Browser på isolerade DB: sparning/omladdning och runtimeval för alla fyra,
14 verkliga BO-sektioner och nekad äldre klippskrivning efter autentisering.
Native-ronden gav nio bildkvitton och sju slutkvitton; reset/återanslutning
gav ingen extra launch eller gammal uppspelning. Två verkliga `goodluck`-
starter/slut och avancerande audio/video på sju vägar: varje originaldealer,
Astrids Studio-spelare samt Astrid/Amira V2. Sparad revision och spelarens
`CLIP.idle` verifierades för alla fyra originalmotorer; det var uttryckliga
standardbindningar, inga alternativa idlefiler. Inga JS-fel; previewkvitton
var skilda från Web.
Privata lokala testkvitton ligger i `lab/data/qa-backoffice-lab`, utanför Git.
Gamla öppna frågor nedan är fortsatt öppna; denna konsolidering godkänner inte
läppsynk, kallstart, fysisk mobil/Safari eller fulla diskbackuper.

## Städning och leverans

`main` är enda lokal/GitHub-branch i `Jakeminator123/github-work`;
övriga brancher och den gamla rena worktreen är borttagna. GitLab är pausat.
Dokumentationen har minskats från 99 till fem MD-filer under `docs/`.
Uppdatera dem i stället för att skapa nya rapporter. Ignorefiler utesluter
beroenden, byggcache, binär media och privat data från vanliga sökningar.

`random-stuff-jakob/`, gammal GitLab-wikihelper, inaktuell ändringslogg och
tomma äldre kataloger är borttagna. `test/` och `pipeline/` används av
produktionen, byggverktyg och CI och behålls. Värdefullt innehåll från
`content/`, `assets/`, Emil och `docs/reference` finns nu under `media/`,
med bevarade bytes, kalibreringar och provenance. Personarkivets läsgräns gäller.

Dokumentations-/ignoreändringar får snabba hookkontroller; kod, tester,
konfiguration och media kräver full regression. CI kör alltid hela hooken.
Vanlig inloggning och förinspelat spel startar inte GPU; GPU-vila får inte
logga ut spelaren eller avbryta ekonomiska transaktioner.

## Intro och startsida

Datorintrot publicerades i `033b97a9`, livekontroll i `64c903ab`.
Hela walk→drag→natural spelades med ökande videotid; overlay och videonoder
var borta efter avslut. 10 fokustester, TypeScript, produktionsbygge och
fyrdealeraudit passerade. Mobil/surfplatta laddar inte introfilmer; iPad med
desktop-useragent är också exkluderad. Fysisk mobil/Safari återstår.

Startsidesdarr/flimmer är undersökt men inte ändrat. Perspektivgolv,
parallax och kortjolt är möjliga orsaker; inga konsolfel eller kvarvarande
intro-overlay sågs. Orsaken är inte slutbevisad.

## Senaste röstprov

1 oktober 11:48–11:53 UTC: Render `6c24b4a5`, RunPod release 4 med färgfix
`66b07a7c`, två lyckade svar utan 404 eller Voice off. Bild vid 1 och 3 sekunder
i båda inspelningar saknade tidigare magenta/gröna mask. Två skilda
GPU-sessioner fick genuina `CANCELLED`-kvitton. Första totalen var 104,803 s,
första bild 99,917 s; andra totalen 14,187 s, första bild 7,723 s.
Detta verifierar färgfix och sessionsavslut, inte exakt fonemsynk.

Privata inspelningar utanför Git i `C:\Users\jakem\Downloads`:

| Fil | SHA-256 |
| --- | --- |
| `astrid-qa-turn-1 (2).webm` | `2c12ff37bdc4491e1944e000e00de498cab6f3a8e29250ea6b96d2b2d7bd5987` |
| `astrid-qa-turn-2 (1).webm` | `b091dff159deab06e17e89548840077043473f890e77e6dc0de1882e7e7a69f1` |

Provgrinden är borta; noll QA-identiteter, väntande arbete och relay-workers.
Försöks-/budgetjournaler behölls: USD 3,00 reserverat, inte uppmätt faktura;
dygnstak USD 9,94, sessionsreserv USD 0,50, worker min 0/max 1.
Inga automatiska betalda omförsök eller ändringar av gamla journaler.

Kvar: lång kallstart, exakt läppsynk, verklig mikrofon-till-svar, fysisk
mobil/Safari, full diskbackup för Studio/Director/Gateway och full
zonlagringsacceptans. Game/auth-databasens externa backup och återläsning är
verifierade ovan.
Nya GPU-prov kräver uttryckligt avgränsad kampanj och bevarad förbrukad budget.

## Speldata och medieacceptans

Konton/saldo ligger i en separat game-Neon; zonmetadata har sin egen databas. OpenClaw får
begränsad publik spelar-/samtalskontext, ingen direkt saldoåtkomst.
Publik lösenordsåterställning är ännu inte slutverifierad i drift.
Råfilmernas kortkontakt är inte kalibrerad; 2D-landning kan rapportera
`calibratedContact: false`. Saknad exakt film använder uttrycklig reserv.
Gamla godkännanden överförs inte till media med annan hash.
Följ [återställning och medieregler](ENVIRONMENT-RESTORATION.md).

## Uppmätt väntetid

2 oktober: cirka 46 GiB ledigt RAM, CPU 0–14 %, ingen diskkö och inga lokala
produkt-/labbservrar. Git-status tog 84–124 ms. Hookens 32 steg tog 68,55 s
(656 godkända tester, 0 fel, 1 plattformsskip); den körs även för docs.
Ett tidigare browseranrop tog 173,8 s. Agent-talks syntetiska låstest hade
intermittent Windows-EPERM; tre riktade omkörningar och senare full hook passerade.
Den tidigare fulla hooken har nu ett separat snabbspår för docs. Rensningen minskar sök-/kontextbrus; den bevisar inte
att Codex kör en bakgrundsindexerare eller att modell-/serverväntan försvinner.
