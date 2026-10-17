# Aktuell handoff — Scoutgaming

## Lokal agent-talk-kö — separat fix 17 oktober 2026

Full kö blockerar inte nästa ping: äldsta meddelandet sparas före det
atomiska köbytet under `arkiv/<datum>/agent-talk/pings/`. Kapacitet och
arkivantal syns i status; äldre obesvarade meddelanden läses och kvitteras
av mottagaren. Claims, andra checkouter, molntjänster och media ändras inte.
Se [Agent-talk](../agent-talk/README.md) för kommandon och avbrottsåterhämtning.
Riktad verifiering täcker samtidighet, kapacitet, mottagarkvittens,
arkivfel och avbrutna filbyten. Originalrepots befintliga kö töms inte av
kodleveransen; rotation sker först när det uppdaterade verktyget tar emot
en ny ping i just den checkouten.

Uppdaterad 17 oktober 2026. Etapp 1 är levererad i PR200 och etapp 2 i
PR202+204. Senaste strukturkvittot gäller main
`1d2fe0521ee033b8a9349eb47ef6765695e59bb9` (PR212); senare delar inväntar sina separata driftkvitton.
Teknisk migrationsstatus och kvarvarande produktarbete finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md). Användarsteg finns i
[lab/docs/README](../lab/docs/README.md); ingen ny tracker skapas.

## Etapp 3 C2g: gemensam publik katalog och navigation — 17 oktober 2026

`packages/player-catalog` äger katalogläsning och resultattyper. Frontend och
Studios lobby binder samma slug-/rumvalidatorer genom egna kompositioner;
lobbyn importerar inte längre frontendens privata kod. Alla tre flyttade
katalogfunktioner har oförändrade kroppar. Sessioner, login-/spelstarter,
rumval och sparade preferenser stannar i apparna.

`packages/navigation` äger rena Admin-/Control-/Partner-adresser, operatorval
samt den gemensamma slugregeln som ersätter fyra identiska implementationer.
SQL-lagrets annorlunda lagringsvalidator bevaras. Studios HTTP-adapter är
`lab/lib/legacy-studio-document.mjs`; förbrukade routefiler och wrappers tas
bort. Operator-slug och den rena speladressmodulens exakta URL:er finns i befintlig allowlist.
Alla konsumenter, isolerade kopieringslistor och QA-källor följer ändringen.

C3-förkontrollen hittade två återstående privata routingkanter. Samma verkliga
serverrouting ligger nu i `packages/navigation/server/platform-routing.mjs`;
Studio, frontend och Render-ingress importerar neutral källkod direkt.
Sex rena adress-/queryfunktioner ligger i `packages/navigation/game-entry.mjs`
med kanoniska dealer-/lane-/slugregler. HTML/presentation och previewvalidering
stannar i `web/public/game-entry-contract.mjs`. Gamla routingfilen tas bort;
inga wrappers eller nya npm-/SDK-beroenden. Endast speladressmodulens exakta
kanoniska URL är publik; serverrouting och felaktiga alias nekas för GET/HEAD.

Routing-, query- och dekorationskropparna samt 16 appkonsumenters övriga
runtimekroppar är mekaniskt oförändrade mot `48a75523`. Neutral closure har
11 moduler utan app-/SDK-importer eller cykler. Berörda befintliga prov ger
166 pass och en befintlig browser-opt-in, plus ett verkligt GET/HEAD-importgrafprov.
En förbrukad råbyte-kopieringsassertion ersattes av befintlig importgraf-/login-
täckning och explicit publik/privat paketering; endast dess provfil kördes om
(2/2). Frontendens och Studios typer passerar. Utökningen är parentgranskad och
ordinarie hook gav312 pass/0 fail/1 befintlig browser-opt-in samt gröna frontendtyper. Ingen fullsuite eller fullbuild upprepades.

Katalog-/navigationsprov, publik importgraf, klientbundling och frontendens,
Studios och lobbyklientens typkontroller har passerat. Katalogkroppar och
navigationsregler är mekaniskt jämförda; testinventeringen har noll
oklassificerade kandidater. C2f-integrationen a2380b32 passerade41 riktade
prov och ordinarie hook215/215 plus frontendtyper med egna låsta frontend-
och speechinstallationer. Renderfixen och PR213 är integrerade med samma navigation och direkta
transportimporter; senaste integrationshook passerade138/138 och frontendtyper.
Main inklusive PR214/216 är integrerad normalt, utan ändrad kod i slutintegrationen. CI och driftkvitto för C2g återstår.
PR218-CI upptäckte två dubbla källposter i QA:s hashlista. Dubbletterna är borttagna; det befintliga provet för en hash per källa passerar6/6. Hashbindning och migrationstäckning bevaras.
Inga nya tester eller provider-/SQL-/medieändringar ingår i katalogsteget.
## C2f Render-paketering — rättning före PR214-merge

Render installerar gateway, web och Lab, medan frontend/speech har egna beroenden.
Routingens rena paths/configuration importeras därför direkt från paketkällan.
En isolerad kopia av verkliga cloud-config-grafen reproducerade tidigare
ERR_MODULE_NOT_FOUND och laddas nu med enbart Renders befintliga Lab-beroenden.
Befintliga konfigurations-/ingressprov18/18 och fixhook7/7 samt frontendtyper
passerar; ingen extra frontendinstallation eller ändrad auktorisering krävs.
Lipsyncs PR213-merge e02629f1ffa69f85e1e0667dbb6ebd7b730de7bb integreras
normalt utan konflikter. Dess kallstarts-/callback-/chattändringar bevaras.

## C2f: servertransportens ägarskap — lokal verifiering 17 oktober 2026

`packages/server-transport` äger nu exakta socketvägar, origin-/ingress-
konfiguration, reläkärna och native Node-server. Speech och frontendens tre
API-skal importerar paketet; inga gamla sökvägswrappers finns kvar.
Konfigurationen importerar inte `ws`. Speech behåller Node 22.23.1 och har
egen npm-lock samt `.npmrc` med `install-links=true`; Vercels speechinstall
är `npm ci --ignore-scripts`. Frontend behåller Node 24.21.0 och pnpm-lås.
`ws` ägs av transportpaketet; frontend har det endast för tester.

Flytten är mekanisk för aktiv transport: origins, tickets, workerbindning,
moving-speech, timeouts, bytegränser, kö och backpressure är oförändrade.
Den konsumentlösa SDK-adaptern `handlePlatformWebSocket` och dess
`@vercel/functions`-beroende är borttagna. SDK-specifika livstidsassertions
har pensionerats; relevanta skriv-/felprov använder den aktiva native-vägen,
och befintliga integrationer bevarar owner-/replay-/mediabyte-kontroller.

De två befintliga cross-service-proven är flyttade från frontend till
`test/platform-native-websocket.mjs` och `test/platform-moving-speech.mjs`.
Fullhook och CI behåller dem; CI installerar båda tjänsterna och kör även
transporten på Node 22. Frontendens core-/routingprov ligger kvar appnära.

Lokalt: egen speechinstallation och start utan frontendinstallation,
beroendefri configimport och speechsyntaxbygge godkända. Frontendens
typkontroll, 127 prov och Next-produktionsbygge var gröna före testflytten.
Efter flytten klarade frontendens 116 appprov sig med speechs `node_modules`
tillfälligt otillgänglig; den återställdes direkt. Node 22 körde 18 transport-
och integrationsprov, samtliga gröna. Miljöregistret samt 22 metadata-/
workflow-/inventeringsprov är gröna; 512 JS/TS-kandidater, nio helper/opt-in,
noll oklassificerade. Bygget använde inga privata miljökopior.

Detta är lokal C2f-verifiering från baseline `9e533e7b`; ingen commit, push,
CI eller deployment har utförts här. C2c:s explicita publika kontraktsallowlist
måste bevaras vid integration; denna ändring rör bara routingmodulens
import-/exportrader. Publik lobbykatalog och media/GPU ingår inte.

Integrationskontroll mot `e60289673933d49a73d0e34c81cc0071739df9ef`:
normal merge utan commit, endast dokumentkonflikt. Båda handoffavsnitten,
C2e-repository och PR211:s HEAD-/Docker-rättningar bevaras. 35 befintliga
routing-/filkopieringsprov, 11 transportprov på Node 22.23.1 samt det faktiska
HTTP GET/HEAD-importgrafprovet passerar utan skips. Inget fullbygge eller
ny deployment. Förnyad säkerhetsläsning på main `6279960f` verifierar två
öppna incidenter, 38318914/38318915; platstäckningen är partiell, övervakningen
aktiv och historikskanningen `too_large`. Ingen incident markeras löst.

## Etapp 3 C2e: runtimegränser och repository — lokala ändringar 17 oktober 2026

`packages/presentation/server/registered-dealer-idle.mjs` äger den befintliga
registeradaptern. Studio importerar den direkt utan att dra in spelserverns
SQL-/startmodul. Spelstartens defaultkomposition, schemakontroll och läsning
av sparad policy före lyssning är oförändrade; bred lagringsflytt återstår.

`packages/studio-registry/server/repository.mjs` äger nu hela den befintliga
SQL-/AsyncLocalStorage-kärnan för läsning, skrivning, CAS, historik och
`readPresentationSnapshot`. De 451 implementationsraderna och modulens
ALS/state/helpers är mekaniskt identiska med baslinjen. Kärnan importerar
endast Node och den gemensamma StudioStorageError-klassen; inga appar,
drivers, Blob- eller låsbibliotek importeras. Fyra namngivna adaptrar
(contract, policy, runtimeCatalog och dealerSets) krävs före databas-I/O.
`web/storage/studio-repository.mjs` kopplar de befintliga appreglerna till
kärnan och behåller alla aktiva konsumenters API. Den innehåller ingen andra
SQL-implementation. QA-källistan tar uttryckligen med den nya kärnan;
selektionsarkivet använder inte repositoryt och behöver ingen extra fil.

Rumsform, rums-ID-regel och lifecycle-nyckel ligger i tre rena blad under
`packages/presentation/contracts/`. Paketcodec och lifecycle använder bladen
utan den tidigare rum–paket–lifecycle-cykeln. Befintliga blandade moduler
behåller sina levande exports med samma funktionsidentitet. Sparade ID:n,
felkoder, komprimering, historiska grants och runtimekonfiguration ändras inte.
Endast ID-bladet får en uttrycklig publik moduladress; rum-/nyckel-/serverkod
och extra sökvägssegment förblir blockerade. Statisk frontend och isolerade
QA-/baslinjekällistor följer den nya importgrafen.

På baslinje `ff03a46a`: 171 fokuserade befintliga prov plus 10 prov från
samtliga sex serverfixturekonsumenter passerar, utan skips, med Node 24.21.0
och fyra workers. Orphan-audit: 512 JS/TS-kandidater, noll orphans. Egen låst
Lab-/frontendinstallation gjordes direkt i arbetskopian; package-/lockfiler ändrades
inte. Importkontroll bekräftar att idleadaptern saknar SQL-/startberoende och
att rumbladen endast importerar den egna kontraktskatalogen.

Efter repositoryflytten passerar ytterligare 169 riktade befintliga prov
för repository/scope/CAS/snapshot, lifecycle, policy, register, native runtime,
Render-persistens och QA-källista utan skips, med fyra workers. Ingen verklig
SQL-server startades. Separat kontroll bekräftar obligatoriska adaptrar före
I/O, samma felklassidentitet och oförändrat fel för ogiltig pool. Inga nya
testfiler eller produktassertions har lagts till.

C2e är lokalt committad som `be6f2ee0a96c20a618c6bdc3f60939ad513f0b47`.
Ordinarie hook passerade frontend-typecheck och 152 prov utan skips. Därefter
integrerades `5a1f4332d6cf68af4e94c98729dda068cf55c3f3` med vanlig
`--no-commit --no-ff`; tio innehållskonflikter är lösta och staged.
Mergecommiten lämnas uttryckligen åt huvudagenten. Idle-adaptern och
repositorykompositionen använder nu C2c:s kanoniska dealer-/dealer-set-kontrakt.
En enda `public-modules.mjs` äger browserlistan, inklusive det exakta ID-bladet;
server/API, statisk frontend och fixturekopierare har inga egna extralistor.

Efter integration passerar 274 riktade befintliga prov plus 10 prov från alla
sex serverfixturekonsumenter utan skips, med fyra workers. Frontend-typecheck
passerar och orphan-audit visar noll orphans av 512 kandidater. Repositorykärnan
är byteidentisk med C2e-commiten. Inkommande GPU-, lipsync- och mediekod är
oförändrad mot C2c-head. Full build, CI, push och drift är inte körda här;
Blob-/registry-reader-kapseln är fortfarande appägd. Inga schema-/moln-/
medieändringar eller nya läppsynksgodkännanden görs av C2e.

Lokal säkerhetsläsning saknar GitHub-/skyddad GitGuardian-åtkomst. Huvudagenten
uppger färskt kvitto på main `a0876f71`: incidenterna 38318914/38318915 är
fortfarande öppna, platstäckningen partiell och historisk skanning too_large.
Detta är ett tillskrivet kvitto; säkerhetstäckningen markeras inte som klar.

## Etapp 3 C2c: gemensamma presentationskontrakt — lokal ändring 17 oktober 2026

`packages/presentation/contracts/` äger projektmodell, video-/rouletteregler,
rena browserpolicyer, seeddata och videoschema med tillhörande deklarationer.
Ingen regel, medieidentitet, katalogproveniens, schema-ID eller intern schema-
referens ändras. Äldre modell-, video-, identitets- och policykällor ersätts av
kanoniska importer; inga permanenta källwrappers behålls. UI:s inventarietyper
samt legacy-inventariets rena datatyper har samma gemensamma ägare. IO stannar
hos sina appägare.

`server/registered-idle-rules.mjs` får befintlig `prepareDecision` injicerad
från `lab/lib/registered-idle-rules.mjs`; beslut och mediebindningar är samma.
Den tillfälliga urvals-/bindningskompositionen läser nu modell, video och
speech-slot-kontrakt från paketet. Directortransporten förblir appkomponerad.

`public-modules.mjs` innehåller en explicit browser-allowlist. Äldre publika
modul-URL:er och kanoniska paket-URL:er fungerar från samma källa, inklusive
relativa importer. Projektseed, privata schemafiler och server/Director-filer
exponeras inte. Vercels exakta routing, statiska frontendkopior, isolerade
serverfixturer, QA-källista och HEAD-jämförelse följer flytten.
PR-granskningen hittade och rättade en HEAD-regression: exakt samma publika
allowlist hanterar nu GET och HEAD med identisk innehållsmetadata och tom
HEAD-kropp. Det befintliga HTTP/importgrafprovet reproducerade felet före
rättningen; därefter100 riktade prov gröna utan skips. Privat kod är fortsatt
otillgänglig även med HEAD.
Directorbildens exakta COPY/ignore/buildFilter använder den kanoniska
dealer-identity-källan. Befintligt isolerat Dockerpaketprov passerar3/3
med health/catalog/UI och utan provideranrop. Ingen extra JSON-dependency
behövdes i den faktiska importgrafen; default-deny-kontexten är bevarad.

Riktad kontrakt-/media-/byggsvit: 248 passerade i första körningen. En missad
konsumentimport och saknad frontenddependencykoppling stoppade återstående
prov; efter rättning passerar hela den berörda runtime-/routing-/fixturesviten
116/116. Schema-/policyproven passerar 39/39 och laddar verkliga relativa
JSON-referenser från kontraktets och projektschemats nya plats. Inga skips.
Lab- och Admin-typecheck passerar. Läsande HEAD-jämförelse: 160 fall, noll
nätanrop, HEAD-/fixturdifferenser eller omskrivna baslinjer. Diffkontroll ren.
Av 47 flyttade filer är 37 byteidentiska i Git-innehåll, sju ändrar bara
importrader, en endast inline-typimportvägar och två samlar typdeklarationer.
Alla åtta JSON-dokument är innehållsidentiska; schema-ID och relativa refs
behålls. Idle-regelns funktionskropp är oförändrad. Det avgränsade runtime-
klustret har inga package→app-importer eller cykler. Första ordinarie hook:
2460 godkända, noll fel och 14 befintliga opt-in/fixture-skips. Efter
integration med Studio-klientflytten rättades 89 relativa importer i 42
klientfiler. Gemensamt Studio-produktionsbygge med /studio passerar:
båda klienttypkontrollerna, tre bundles, Next och 80 byggspår utan borttagna
poster. Separat importgranskning hittar inga saknade relativa mål och
bekräftar att lipsyncs nya rörelsefiler är oförändrade. CI, push och drift återstår.
Detta är lokalt strukturarbete, inte en ny molnmigration, deploy eller
läppsynksacceptans. Lagring och webbens separata kortpolicy återstår hos sina
nuvarande ägare.

## Etapp 3 C3a: Studio äger Admin/Lobby-klienten — 17 oktober 2026

De 184 källfilerna från `packages/design-preview` ligger nu i `lab/client`.
Klientens manifest, låsfil och historiska proveniens är oförändrade. Den har
fortsatt separata React-/TypeScript-beroenden och typkontroller, och undantas
från Studios övergripande tsconfig. En lobbykälla ger både intern och publik
lobby; outputen `lab/design-preview-build`, resursadresser, autentisering och
Vercels befintliga Studio-routes behålls. Inga gamla källvägswrappers skapas.
Byggverktyg, importörer, fullhook, CI-klassning och testinventering följer flytten.

Lokalt på Node 24.21.0: 360 befintliga klient-/Admin-/Lobby-/policy-/runnerprov
passerar, noll fel och sju uttryckliga browser-opt-in-prov ej körda. Inventeringen
visar 510 JS/TS-kandidater, nio helper/opt-in och noll oklassificerade tester;
Python redovisas separat. Klientens två typkontroller och tre bundlebyggen är
gröna. Studios produktionbyggsteg kördes därefter med `/studio`, befintlig
klientoutput och oförändrade låsta beroenden: Next/TypeScript och routebygge
gröna, 80 byggspår kontrollerade och noll privata poster borttagna. Befintliga
CSS-composes-varningar och Nexts middleware-deprecation kvarstår.

Den kvarvarande privata frontendkopplingen i den publika katalogadaptern
är nu avgränsad och åtgärdad i C2g ovan.
CI, integration och driftkvitto redovisas vid leverans. Ingen ny visuell
medie- eller läppsynksacceptans ingår.

## Etapp 3 C2d: urval och Director — lokal ändring 17 oktober 2026

Urvalet ligger i `packages/presentation/server/selection.mjs` som en fabrik
med uttryckliga projektmodell-, Director-, video- och talregler. Varje
urval får sitt eget register; kärnan läser inte Studiofiler eller register.
`video-bindings.mjs` validerar samma bindningar utan lagring eller Director,
med bibehållet Promise-kontrakt. `packages/shared/studio-error.mjs` äger den
befintliga felklassen; project-store återexporterar samma klassidentitet.
Den gamla `runtime/selection.mjs` är borttagen utan ersättningswrapper.

`lab/lib/presentation-selection.mjs` kopplar ihop de aktiva appreglerna.
`presentation-video-bindings.mjs` ger persistensen en separat, liten ingång.
`studio-director.mjs` samlar befintlig beslutskärna, modellråd och relay;
Studiochat, companion, probe, social och idle-advice behåller sina transport-
kontrakt. Spel-API:t har endast bytt urvalsimport; anrop, kontext, medie-ID:n,
kataloghashar, fallback och serverägda spelregler ändras inte.
Baslinjearkivets ingång och källista följer den nya appkompositionen.

Riktad befintlig svit: **256/256**, noll skips, Node 24.21.0 och fyra workers.
Det inkluderar urval, Director, bindningar, talfack, frysta händelser,
registrerad playback, Admin-koppling och Astrids befintliga baslinje/importgraf.
Saknat explicit register och bevarad StudioError-identitet provas i det
befintliga bindningsprovet. Den läsande HEAD-jämförelsen passerar dessutom
160 fall utan nätanrop, HEAD-/fixturavvikelser eller omskrivna baslinjefiler.
QA-kvittots källhashlista tar med de sex nya runtimefilerna; dess riktade
test passerar 6/6 utan skips efter liständringen.
Runnern väljer den äldre ingången endast när det frysta HEAD-arkivet ännu
saknar den nya appkompositionen. Ordinarie commit-hook passerar 180/180 utan
skips. Full build, CI och drift återstår; inget nytt läppsynksgodkännande ingår.

Kvarvarande gränser: appkompositionen importerar alltjämt Studio-modellen,
video-intake, publika talregler och OpenClaws implementation. Andra moduler
under `packages/presentation/runtime/` har fortfarande äldre appberoenden;
denna ändring gör bara urvals- och bindningskärnans beroenden uttryckliga.
Gemensam lagring, övriga runtime-/typkontrakt och appägarskap återstår.

## Etapp 3 C2b: gemensamma kontoroller — 17 oktober 2026

`web/account-role.mjs` har flyttats byteidentiskt till
`packages/studio-access/account-role.mjs`. Studio, spelserverns inloggning,
operatörslagring och isolerade QA-källistor använder den nya sökvägen.
Inga roller, behörigheter, scopekrav eller testassertions har ändrats.
Tillfälliga serverkopior får nu också med kontorollsmodulen explicit.

Lokalt på Node 24.21.0: 61 befintliga roll-/policy-, kontoinloggnings-,
mejl-, operatörslagrings- och QA-listtester samt 11 kontoadministrationsprov
passerade. Ordinarie commit-kontroll: 86/86 utan skips. Efter integration
av PR205:s fixture-rättning passerar samtliga sex serverfixturekonsumenter,
10/10 utan skips. Inga testassertions ändrades. CI, merge och drift återstår.

## Etapp 3: första gemensamma kontrakten — 17 oktober 2026

`media-file-types.mjs` ligger nu i `packages/shared/` och
`capability-contract.mjs` i `packages/presentation/`. Båda implementationerna
är oförändrade och importfria. Studio, spelserver, bundlad klient och tester
läser samma kanoniska filer direkt; gamla källfiler och wrappers finns inte
kvar. Den isolerade QA-källistan och aktiva formatguider följer flytten.
Publik capability-endpoint, versionsförhandling och mediaregler är oförändrade;
ingen ny statisk modul-URL eller dependency behövs.

Första riktade MIME/header-, medieklassnings-, capability- och readinessproven
passerar 81/81 utan skips. Ordinarie hook, CI och driftkvittot redovisas vid
leverans. Detta är första delen av etapp 3: auth, presentationsorkestrering,
lagring, appägarskap och gamla källrötter återstår. Ingen ny medie- eller
läppsynksacceptans ingår.

Full CI hittade ytterligare två isolerade källträd som kopierade de gamla
appkatalogerna men inte de nya paketfilerna. Den gemensamma serverfixturen
kopierar nu capability-kontraktet, och baslinjearkivet tar med MIME-modulen.
Ett befintligt bootstrap-prov saknade dessutom klientens kalibreringsmodul i
sin källkopia; den tas nu med. Fixturerna behåller sina isolerade data och
utvidgas inte till hela paketträd.

## Etapp 2: kataloger och dokumentingångar — 17 oktober 2026

PR202 är mergad på `f16b5eac5838d424c5e9fafe804f5024a809af62` med grön
main-CI. Vercels bygge hittade därefter en gammal authtransportfixture:
`/studio/activity` är nu en avsiktlig redirect och lämnar inte passthrough-
headers. Felet reproduceras med produktionens `CROUPIER_LAB_BASE_PATH=/studio`.
Fixturen sätter nu denna basväg explicit, provar transport på en aktiv Admin-
sida och följer den gamla länken genom båda omdirigeringarna till den aktiva
sidan med bibehållen cookie och filtrerad förtroendeheader. Produktkod och
behörighetsskydd ändras inte. Rättningen levererades i PR204. Mergeagentens
slutkvitto på main502bea81: main-CI39040340480 SUCCESS, Vercel READY och
Render LIVE, publik version200 med samma fullständiga SHA och health200/ok.
Detta är tillskrivet driftkvitto, ingen ny produktionskörning i C2b.

De 22 spårade filerna i `pipeline/` har flyttats till `tools/media/`, med
uppdaterade importer, standardrötter, kommandon och testupptäckt. Manuella
macOS-/Pythonrecept, binär, ljudreferens och mätvärden bevaras; inga mediefiler
genereras och inga registrydata ändras. Gamla shellkommandon behöver den nya
verktygssökvägen. Mediernas egna lagringsvägar ändras inte.

Elva OpenClaw-dokumentstubbar är borttagna efter flytt av alla aktiva
hänvisningar till `docs/AI/openclaw/`. Presentationens enfilsmellanlager är
borta; Node läser paketmodulen direkt. Två exakta publika paket-URL:er tillåts,
och gamla `/presentation-runtime/*` samt frontendbyggarens output bevaras.
Lipsync har godkänt de tre små import-/serveröverlapparna i separat branch.

Sjutton rena redirectskal är samlade i befintlig routning. Sparade URL:er,
307, basePath och varje ingångs tidigare querypolicy bevaras. Aktiva
Control-sidor och Admins delade komponenter står kvar; även de redirect-sidor
som först kontrollerar behörighet bevaras. API, auth, root, preview och
server actions omfattas inte av nya generella regler.

Riktade kontroller täcker flyttade byggare/kalibreringsspärrar, manifest och
uppladdning, testupptäckt, befintlig navigation och faktisk middleware i båda
basvägar/lägen samt publik importgraf och frontendbygge. JS/TS-inventeringen
är fortsatt 510 kandidater, nio helper/opt-in och noll oklassificerade.
CI/merge/drift redovisas separat i PR-kvittot. Detta är ingen ny visuell
medieacceptans. Etapp 3 om kodägarskap är inte startad.

## Etapp 1: testkörning och förbrukade verktyg — 17 oktober 2026

Utgår från main `8b60984844075b344e6cc33147956b0f31b0d691` (PR199).
Den gamla molnberedskapsrapporten, dess test, tre recept för borttagna
mediebanker och fyra bankbundna prov är raderade efter konsumentkontroll.
Lipsync bekräftade att dessa verktyg inte används i det pågående Dragan-arbetet.
Originalmedia, handmattor, publicerings-/talavtal och aktiva byggare bevaras.

Fullhooken kör OpenClaws 20 och ops/clouds 16 prov en gång; 16 dubbla
CI-körningar är borta. PR199:s callback-prov finns kvar. Två tidigare
missade aktiva prov är registrerade: bakgrundszonernas schema och frontendens
moving-speech-ingång. Detaljassertions för CSS, propinventering och gamla
filnamnslistor är förenklade; åtkomst, privata fält och reducerad rörelse skyddas.

JS/TS-inventeringen omfattar 510 kandidater, med nio namngivna helper/opt-in-
klassningar och inga oklassificerade kandidater. Tio Pythonprov redovisas
separat, utan påstående om verifierad Python-täckning. Fyra små fixturprov
skyddar inventeringens riktiga körvägar och negativa fall. Körgränser och
testprinciper beskrivs i [lab/README](../lab/README.md#regressionssviter-och-tidskvitton).

Riktade lokala UI-/runner-/inventeringsprov och 45 medie-/workflowkontraktsprov
är kontrollerade; Windows-specifika skips redovisas i PR-kvittot. Full CI och
merge är nu slutförda för PR200; mergeagentens kvitto omfattar grön main-CI,
Vercel READY och Render LIVE på ovanstående SHA. Ingen ny visuell
läppsynksacceptans ingår. Etapp 2 beskrivs ovan.

## Dragan: verkligt molnprov och fortsättning — 17 oktober 2026, 16:31 UTC

**Läget:** kod, image, bank och separat testrum är levererade. Dynamisk
OpenClaw-text fungerar. Två molnprov med tal nådde RunPods kö men ingen
worker startade före tidsgränsen. Ett separat uppstartsprov har nu verifierat
imagehämtning och Python/RunPod SDK-start efter cirka 296 sekunder.
Tal och läppsynk i spelet är fortfarande inte verifierade. Draganprofilen
är avstängd och sparad. Testresurserna är avvecklade enligt kvittot nedan.
Astrid och originalfilmerna är orörda.

PR203 är mergad på `9e533e7b525b6fa894f638d3d8ba6a382e230c47`.
Mergeagentens separata kvitto före provet: main-CI `39042108316` SUCCESS,
Vercel `dpl_4YFX4cQsArTum6is99Q7jjc8TZNo` READY med rätt produktions-ID och
Render `dep-db9omlp42hec73cthoh0` LIVE med exakt version och hälsa 200.
Det kvittot gäller provets version, inte senare driftsättningar.
Migration013 är installerad och återläst i `croupier_game`, Neon-branch
`br-flat-fog-b161a6r8`, scope `production/croupier`; PR201 gör den obligatorisk.
PR199 rättade frontendens beroendegräns och PR204 den gamla auth-fixturen.
PR195/196 är historiska leveranssteg, inte kvarvarande aktiveringsuppgifter.

### Vad som finns och vad som faktiskt provades

Bolaget `dragan-test` saknar medlemskonton. Dess rum
`room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2` (Dragan · dynamiskt taltest)
har publicerat paketversion 2 med Dragan, Lounge-varm och Oak. Endast den
egna sammansättningen `dragan-separat-taltest-413cea16-014d-4625-a613-4c6eeb5f693c`
ändrades: Desktop/Bord lodrätt 35 → 31 procent. Vid 1280×720 försvann varningen
om insatsytor under nederpanelen; kortankare och mobilvärden bevarades.
Inga gamla operatörer öppnades och agenten lade inga insatser.

Ett tidigare riktigt bordschattmeddelande gav ett nytt svenskt OpenClaw-svar.
Talprovet den 17 oktober använde ny dynamisk text: ”Hej Dragan! Ge Jakob en
mycket kort hälsning på svenska och kalla honom kung.” Request
`3877f372-4582-47e5-8e1d-14f4bde5cd14` gick vidare till taladmission och
RunPod-jobb `97d77da3-d726-4358-b838-35c2e17ac9fd-e2`. Provider visade ett
köat jobb och noll workers. Spelaren avslutade med timeout efter 159 166 ms;
inga ljud-/läppsynksrutor spelades upp. Neon bekräftar providerstatus
`CANCELLED` och frisläppt GPU-session 14:58:23 UTC. En journalpost märkt
`completed` för förberedelsen är inte ett kvitto på slutförd uppspelning.

Guarden körde 14:54:42–15:02:42 UTC och stängde sina resurser. Separat
läsning 15:05:14 UTC gav endpoint `h56jnnyo5aq4om` 404, template `uv042mlkik`
404 och tom workerlista. Astrids endpoint `zsudl8tmzcmiv1` gav 200,
min0/max1 och samma template `cadh7uwzv6`. Senaste testendpointens redovisade
avgift var då 0 USD; fördröjd fakturering är möjlig och reserver behålls.
Andra provet kördes på PR208, main `a0876f7152434ec281228a69fe1ce6f1fcfb3a84`.
Mergeagenten verifierade main-CI `39045298173` SUCCESS, Vercel
`dpl_3kwzqkUQFfuJP39wX8sSHk1KiMss` READY och Render
`dep-db9pb9u1egvs73d10ctg` LIVE med exakt version och hälsa 200 före start.
PR208:s fallback-rättning hade 49 oberoende passerade prov. Den separata
endpointen tillät både A40 och A6000 med samma image, modell och bank.
Request `3aef6682-1a52-4d01-bd04-61d632c82783` fick timeout efter 158 771 ms,
utan ljud-/videorutor. Jobb `ce27a960-4826-43f6-8655-41687e5b8117-e1`
bekräftades `CANCELLED` och frisläppt 15:42:45 UTC i Neon. Provider och UI
visade noll workers; ingen containerlogg fanns. Katalogen visade samtidigt
A40 HIGH och A6000 LOW, vilket inte räcker för att förklara utebliven start.

Guarden stängde vid sin fasta deadline: 15:39:07–15:45:12 UTC. Färsk
oberoende läsning 15:46:25 gav endpoint `d7hv6j0ztof5ao` och template
`zzn6zc9d0p` 404 samt exakt tom workerlista. Astrids samma endpoint/template
var kvar med min0/max1. Draganprofilen sparades avstängd. Ctrl+C i Windows-
TTY gav ingen observerad förtida stängning; den bestående deadlinen fungerade.
Mergagenten fick STOP-kvittot innan nästa deploy släpptes.

De sparade Dragan-inställningarna pekar nu på den senast borttagna testendpointen.
Återaktivera inte bara profilen: nästa försök behöver en ny verifierad
endpoint/template och motsvarande begränsade runtime-bindning.

### Verifierad kallstart och avveckling

Ett separat uppstartsprov kördes 16:13:23–16:28:27 UTC, med talprofilen av,
min1/max1, inga inskickade jobb och oförändrade Render-inställningar.
Worker `n8jhmcbdsbycye`, A40 i EU-SE-1, skapades 16:13:26.
Systemloggen visar hämtning/extrahering av exakt
`ghcr.io/jakeminator123/moving-gpu-worker@sha256:56b779142cad6d3c0152f53942f6703a0b6f6e74a6b7110c1ea34f69facc3b34`
färdig 16:17:59. Containerloggen visar RunPod SDK 1.12.0:s startbanner
16:18:19. Registry-behörigheten och containerstarten fungerar alltså för
denna image. Modell-/bankladdning, workerintyg, TTS och uppspelning ingick
inte. Detta är ett separat startupkvitto, inte ett lyckat talprov.

Guarden stängde automatiskt. Oberoende GET 16:30:58 UTC gav endpoint
`e9isjywhagh41l` och template `kkrc6vr46g` 404 samt tom workerlista.
Windows Ctrl+C används inte som enda stoppmekanism; guarden har beständig
deadline och en ägarbunden stoppfil med endpoint-ID och planhash.

### Avgränsad rättning efter uppstartsprovet

Moving-vägen har nu serverstyrd callbackfrist 450 s, absolut sessionstid
480 s och RunPod-jobb-TTL 540 s. Själva workerexekveringen och dess input-TTL
är fortsatt 180 s. Bankens tillfälliga läsbehörighet följer återstående
sessionstid och återkallas direkt vid avbrott. En sen submit nekas före POST
så att även osäkert utfall ryms i journalens befintliga 720 s-budgetfönster.
Tom workerpool, exakt image/release, reservationer och inga automatiska
omförsök gäller fortsatt. Ingen ny image eller schemaändring behövs.

Chattens väntande lås gäller 600 s i båda lagringsimplementationerna, så att
ett lyckat sent svar kan sparas. Avbrott frigör låset direkt; efter en
processkrasch kan ett gammalt lås däremot ligga kvar fyra minuter längre.
Astrids GPU-/callbackstandarder ändras inte. Underagentens 222 fokuserade
prov passerade, inklusive simulerad 296 s kallstart, callback, sen bankhämtning,
avbrott, bibehållen kostnad vid osäkerhet och chattcommit efter 420 s.
Detta är lokal kodverifiering; merge, driftversion och nytt riktigt talprov
måste kvitteras separat före funktionsacceptans.

### Gemensam talväg och verifieringens gräns

OpenClaws exakta svar → registrerad röst → verifierad worker → bildrutebunden
ansiktskomposition i den gemensamma spelaren. TTS startar först efter antaget
GPU-jobb och workerintyg. Neon fryser källreferenser och reserverar budget;
privat Blob levererar hashbunden avatarbank via kortlivade behörigheter.
Originalen skrivs inte om. Förinspelade repliker behåller eget ljud/video.

PR203 levererar **Svara under nästa utdelning**. En ny serverbestämd öppning
reserveras en gång; kropp, ansikte och kortkontakt följer ljudklockan.
Ändrad revision avbryter även en tyst worker. Vilobilden avkodas som exakt
MP4-källruta. Använda komprimerade filmer förladdas inom 96 MiB och högst
24 kroppsrutor avkodas samtidigt. Teknisk beskrivning och formatgränser finns
i [runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md).

Slutleveransens egna commitkontroller passerade 93 respektive 15 fokuserade
prov. Mergeagentens oberoende slutkörning passerade 67 utan skips, inklusive
riktig Chrome. Underagentens fördröjda originalprov avkodade alla 183 källindex
utan buffertunderskott. Dessa resultat verifierar kod och avkodning, inte
hörbar/synlig läppsynk. Tal under utdelning återstår att se i det riktiga rummet.

### Återstående arbete och skydd vid fortsättning

1. Leverera och driftverifiera den begränsade kallstartsrättningen ovan. Tidigare
   callbackfrist 150 s, session/job-TTL 180 s och banktoken 180 s räcker inte
   för den observerade starten på 296 s. En längre kö-/startfrist får inte
   automatiskt förlänga själva workerexekveringen eller kringgå tom workerpool,
   releasekontroll, kostnadsreservation och avbrott.
2. Behåll samma verifierade image och modell vid nästa prov. Det äldre
   credentialnamnet `ghcr-astrid-read` är inte ett fel i sig: RunPod hämtade
   imagen med den befintliga kopplingen. Bildstorleken är cirka 8,1 GB
   komprimerad; [paketversionen](https://github.com/Jakeminator123/scoutgaming/pkgs/container/moving-gpu-worker/1401501221?tag=sha-9a644e730966c248518c76a115c9bd922b0c5ef3)
   är verifierad. Uppstartsprovet förklarar varför den tidigare tidsgränsen
   inte räcker vid denna kallstart, men fastställer inte all historisk kötid.
3. Läsning 16:30–16:31 UTC av alla åtta stängda endpoints och tidigare GPU-pod
   gav 0,169812463 USD bokfört och 4,03 USD behållna reserver: totalt
   4,199812463 USD av Jakobs godkända **10 USD**, med 5,800187537 USD kvar.
   Åttonde reserven 0,44 USD täcker hela guardperioden, 120 s stoppmarginal
   och disk. Fördröjd fakturering kan tillkomma; inga gamla reserver har
   tagits bort. Budget-/guardverktygens 82 prov passerade enligt underagentens
   kvitto. Uppdatera hela underlaget inom fem minuter före nästa aktivering.
   Neon-reservationer är inte fakturor eller extra budget.
4. Verifiera ny OpenClaw-replik i vila, sedan tal under serverbestämd utdelning.
   Agenten får inte placera insatser på användarkontot; Jakob startar själv
   eventuell riktig runda. Jakob valde efter det första molnprovet att köra
   endast vila nu och ta utdelningsprovet senare. Mergagenten samordnar
   merge/deploy och GPU-fönster.
5. Applicera granskad namngivning/import separat. Gamla medienamn finns kvar
   eftersom namnplanen fortfarande är skrivfri. Kevins källnamn bevaras som
   proveniens; funktion, start-/slutpose, språk, variant och exakta UUID/hashar
   styr kopplingen. Namnbyte kräver inte nya filmbytes eller nya identiteter.
   Följ [Blob/Neon-guiden](storage/BLOB-NEON.md); radera inga skyddade original.

Läsande jämförelse av lokala profiler, Vercel och Render-tjänsteidentiteter
är klar; [miljöguiden](ENVIRONMENT-VARIABLES.md#läsande-jämförelse-17-oktober-2026)
beskriver ansvar, styrkta skillnader och städningsförslag. Ingen env-rensning
är genomförd och full jämförelse av Renders hemlighetsvärden är inte gjord.

Jakobs röda `presentation/config`-rader följdes upp i befintligt testrum
15:56 UTC utan GPU-start eller insats. Ett anrop fick HTTP200 och därefter
`net::ERR_ABORTED` med `canceled:true`; efterföljande config-anrop fick 200.
Det reproducerar ett klientavbrott, inte ett styrkt serverfel eller saknad
grundbild. Det fastställer inte orsaken till varje rad i hans tidigare bild.

Privata körkvitton och återstartscheckpoint ligger i den befintliga
visualiseringsmappen för denna chatt, utanför Git. De innehåller resurs-ID,
tider och resultat, aldrig nyckelvärden. Arbetskopian är
`C:/Users/jakem/.codex/worktrees/dragan-lipsync-registry-3518/croupier`;
bevara det ursprungliga repots smutsiga filer. Kontrollera branch/HEAD och
aktuell drift före fortsättning. Återanvänd inte en stängd provisioneringsjournal.

## Browserprovets täckning — dokumentationsrättning 17 oktober 2026

README skiljer nu CI:s bundle-/API-prov från de två interaktiva browserfallen.
Browserfallen kräver CROUPIER_BROWSER_FIXTURE_MODULE och hoppas över i dagens
CI, där variabeln saknas. Inga tester, körvillkor eller produktkontrakt ändras.
PR197:s fulla CI på efa69d9b var grön; det bevisar inte dessa browserflöden.

## Verktygsrensning, etapp 1 — 17 oktober 2026

HUVUDAGENT2 arbetar på `codex/retire-obsolete-tools` från main
`9f8a3afffba3e3c39268bf5665585b48a4f67361`, i separat arbetskopia
`repo-cleanup-tools/croupier`. Huvudcheckoutens lokala ändringar bevaras.

Den pensionerade genererade systemkartan, dess egna verktyg/tester och den
oanropade branchspecifika previewbyggaren är borttagna. Gamla BO-browserprovet
krävde ersatta uppladdnings-/iframevyer och är också avvecklat. Dess undantag
och dokumentlänkar är rensade. Aktivt previewmaterial och Studios hashverifierade
förberedare behålls. Endpointtestet kontrollerar fortfarande fullständig
actiontäckning, unika adresser och behörigheter utan ett fast antalskrav.

`cloud-admin-bootstrap` behålls: servern har fortfarande beteendena som testet
skyddar. SQL-/omstarts-/HTTPS-provet, raderingsgrinden och produktregressionerna
är kvar. Ingen rutt, databas, mediafil eller produktionsresurs ändras här.
Lipsyncs aktuella `codex/dragan-openclaw-cloud` och dess SQL-/tal-/workerarbete
är avstämt; enda gemensamma kodfilen är testlistan, där bara previewtestets
token tas bort. Nedanstående daterade receipts lämnas kvar som historik.

Verifiering: riktade befintliga hook-/CI-, preview-, raderings- och Adminprov:
63 pass, 5 POSIX-skip på Windows. Två initiala previewfel berodde på att den
nya arbetskopian saknade Next; de passerade efter verifierat identiska
package-/låsfiler och återbruk av befintliga beroenden. Orphan-kontrollen
läser 429 testfiler: 0 orphans, 1 kvarvarande undantag. Strikt raderingsgrind
mot indexet: 16 borttagna filer, 0 importer och 0 registerberoenden. Dess enda
textträff var kartans gamla hashundantag; det är därefter borttaget medan
GitGuardian v2-konfigurationen behålls med tom undantagslista.

En sista konsumentkontroll fann en oanvänd lokal testprofil med en enda läsare
i manifesttestet. Profilen och dess profilassertioner är borttagna; manifestets
exakta identiteter, determinism och aktiva idlepolicy behålls. Manifestproven
passerade 8/8. Etappen tar därmed bort 17 filer; sammanlagt 71 riktade prov
passerade med 5 POSIX-skip. Inga runtimeprofiler eller medie-ID:n ändras.

Ordinarie commit-hook passerade 37/37 tester. Slutlig raderingsgrind på
f11177e0 gav även 0 kvarvarande textreferenser. GPT-auto läste main 9f8a3aff
via GitHub och tillstyrkte avgränsningen; det var en riktningskontroll, inte
en granskning av lokal diff. Dess följdfynd är hanterade: CI-sammanfattningens
gamla karttext är borta och svit-/timeoutguiden finns i lab/README.
Det pensionerade browserprovets hela bildrute-/återanslutningsmatris påstås
inte ersatt; endast det aktiva Admin-utkastprovets egen omfattning anges.

Ingen full lokal byggning eller ny spel-/läppsynksacceptans har körts här;
full produkt-CI följer PR:n. Säkerhetsläsningen på main 9f8a3aff visar aktiv
övervakning men incident 38318914 och 38318915 fortfarande öppna, partiell
platsmetadata och historikskanning too_large. Incidenterna ändras inte här.

## Systemytor och bolagsjournal — 17 oktober 2026

Leverans på `codex/admin-system`, baserad på `f5f8414628e39fee4cbf703054c0ee57d2b48157`.
Systemmenyn grupperar arbetsverktyg, assistenter samt åtkomst och historik.
Verktyg, Kopplingar, Användning & beroenden och Adminroboten har gemensam typografi,
knappar och detaljreglage. Arkiverade beroenden finns kvar och register-ID:n kan öppnas.
Betalningsjournalen visar händelsenamn, postens valuta och UTC-tid; fullständiga
serverreferenser finns under detaljer. Inga saldo-, roll- eller skrivkontrakt ändras.

Den tidigare tomma Ändringslogg-ingången heter **Bolagsjournal** och listar aktiva
registrerade bolag med deras befintliga `/partner/<slug>/team?scope=company`.
Den läser endast den skyddade bolagskatalogen, utan projekt-/videoberoende.
Global Admin-historik är fortsatt en separat produktlucka i CLOUD-MIGRATION.
Native formulärsidor använder dokumentnavigation och befintliga lämningsskydd;
dubbla gruppflikar i Admin är borttagna. Engångsresultat rensas synkront vid
`pagehide`; sena svar kan inte återvisa dem efter Back. Agentmodeller sparas
radvis; den missvisande Spara alla-knappen är borta. Döda registrervyer och
RoomCard är borttagna; gamla players-adresser normaliseras till accounts.

Verifiering: full Lab/Next-byggning inklusive 97 byggspår, slutlig Admin/Lobby-bundle
med `/studio` och typecheck, 12 Admin-regressionsgrupper (291 pass, ett valfritt
codecprov överhoppat), samt riktade komponent-, navigation- och journaltester.
Slutlig journalrättning: 18/18 tester. Isolerad WebView-fixtur verifierade System,
modellval/Ångra alla, stoppat sidbyte med utkast, Back, journalreferenser,
bolagslänk och 390/960/1440 CSS-pixelbredder. Tabellrullning håller sig inom mobilvyn.
Nio fixturkontroller skyddar bland annat autentisering, origin och skrivspärrar.
BFCache-rensningen är automatiskt testad, inte bevisad med verklig browsercache.

Föregående produktion: mergeagentens kvitto för `f5f84146` visar main-CI
[39022829970](https://github.com/Jakeminator123/scoutgaming/actions/runs/39022829970) grön,
Vercel `dpl_6QGaab5f8MV6GrJ57MXK2VbiZZHC` READY och Render
`dep-db9ke7vlk1mc73c19270` LIVE med exakt full SHA i health/version.
Egen läsande WebView-kontroll bekräftade nya klippkartan, Dragan-importens
förval och den befintliga N1-vägen till Nordic bets bolagsjournal.
Detta är inget nytt läppsynksgodkännande. Systemändringarna ovan är en separat PR.

Lipsync äger `codex/dragan-openclaw-live` och fortsatt media-/server-/workerarbete.
Ingen importblockering finns i Admin. Jakob har därefter godkänt ett separat
Dragan-testrum, som lipsync förbereder. Inga rum återöppnades, filer importerades,
modeller sparades eller produktionsdata ändrades i System-uppdraget.
GPT-auto granskade GitHub-main och gav riktningsråd; lokal System-diff ingick inte.
GitGuardian lästes: 0 öppna/18 ignorerade incidenter, aktiv övervakning;
platsmetadata är partiell och historikskanningen `too_large`. Det är ingen total säkerhetsklarering.
## Dealerklipp: levererad förberedelse i PR191

På `codex/dragan-lipsync-registry` / PR191 finns nu en körbar skrivfri importplan
för fryst Kevin-underlag och utökat raderingsskydd. Planen bevarar exakta ID:n,
poseversioner, språk och inspelat tal. Den gör ingen upload/apply och visar
saknade klassningar/byte-/talbevis i stället för att gissa.

Forge tar referenser atomiskt mot samma pending/deleted-spärr som radering.
Inspektionen omfattar även Forge-profiler/-jobb, sparade talsvar och paket.
Äldre taljobb utan exakta indata skyddas konservativt vid öppna GPU-sessioner,
giltiga leases och oavslutade fullfilsjobb. Detta är inte en komplett gemensam
mediaadmission för den framtida rörliga talvägen. Befintliga schemaversioner
002/008/012 och deras nödvändiga tabeller/checksummor verifierades läsande i Neon;
ingen migration eller dataändring gjordes.

Separat workerpaket återanvänder den lokalt verifierade motorn. Transporten
kräver låst image-digest och exakt bank-/profil-/session-/jobbintyg innan PCM.
OpenClaw förblir standardkälla till dynamisk text; färdiga repliker behåller sitt ljud.
Admin-huvudagenten äger klippkartan och befintliga UI-/import-API-kontrakt består.
Den gemensamma visuella guiden skiljer slotmall, obligatorisk poseversion,
frivillig rörelsevariation och talutlösare. Admin-agenten har verifierat
utfällningen i sin isolerade browserfixture; det är ett separat UI-kvitto.

PR193 integrerades från `main` på `f55417e671162edad7ed394f5802ff853ae56573`.
De tre gemensamma guidefilerna är byteidentiska. Admin- och workeravsnitten
bevaras; den gemensamma guidens regression körs en gång i fullhooken.
Tidigare kod-/byggkvitton nedan gäller sina angivna head; integrerad sluthead
och dess nya kontroller framgår av PR191.

Importplanen kördes mot färsk produktions-export: 38 återanvändningar,
8 kopplingar att granska, 129 granskningsrader och ingen direkt import.
52 av 247 frysta källvägar är byteverifierade. Tolv talstickprov på sv/en/pt
transkriberades lokalt och bildgranskades. Osäker ASR räknas inte som felaktig
inspelning eller acceptans; portugisiska stagingfiler hålls utanför basimporten.

Verifierat lokalt: 31 transportprov med riktiga sockets; 95 ytterligare import-,
bildrute-, PCM-, OpenClaw-chatt- och talregisterprov passerade, ett valfritt
webbläsarcodecprov hoppades över. Referensagentens separata körning gav
121 pass/0 fel/1 överhoppat PostgreSQL-fixtureprov; SQL-frågorna lästes även mot
produktion. Workeragentens 31 tester passerade på WSL/Python 3.12, inklusive
verkliga CPU-hjälpare från motorn och MuseTalk; Windows gav 27 pass och en
överhoppad rendererklass eftersom dess beroenden inte finns där.
Hela Dragan-bankens 2 479 rutor/50 tagningar och sju modellhashar verifierades.
Sviterna överlappar och summeras inte. Detta är kontraktsbevis, inte
hörbar/visuell liveacceptans.

ChatGPT Pro granskade faktiskt GitHub-head `26d390b8cf94fe9fd6c7f30db1e325efd51cf269`
och reproducerade tre fel. Rättningarna räknar bildrutor med hela samplingar,
behåller vilans källruta 0 och blockerar importbeslut vid oläsbart/ofullständigt
registerunderlag. De begränsade motorpatcharna redovisas i `source.json`;
Emils originalkvitton bevaras. CPU-proven ersätter inte ett nytt GPU-/spelprov.
Omgranskningen av `19103fcf6301b4f8e2ae2ef78690943919cdc97f` stängde alla tre
fynd utan nya konkreta kodfynd. På samma head passerade både
[full produkt-CI med isolerad PostgreSQL](https://github.com/Jakeminator123/scoutgaming/actions/runs/38994132656)
och [det verkliga serverless-containerbygget](https://github.com/Jakeminator123/scoutgaming/actions/runs/38994132683).
Den färdiga containern klarade 31 CPU-tester och importer utan nät som icke-root.
Detta kvitto gäller förberedelseleveransen, inte publicerad GPU-drift eller
visuell läppsynk. Senare leveranshead och dess kontrollstatus visas i PR191.

Kvar före aktivering: publicerad och verifierad molnimage och GPU-prov, verklig import genom befintliga
skrivare, taljournal/dispatcher och spelarens ljudklocka/omplanering. Docker
saknas lokalt. Läsande RunPod-kontroll 01:42 UTC visade inga pods och bara
Astrids befintliga endpoint. Inga filmer, nycklar eller Astrid-tjänster ändrades;
ingen ny GPU-kostnad uppstod. Den frysta lokala taggen och originalen består.
Detaljer/kommandon: [kanonisk storage-guide](storage/BLOB-NEON.md).

## Dragan: registerbundet bankunderlag — 17 oktober 2026

Jakob valde befintliga Dragan-filmer i Blob för en egen avatarbank.
Ny kod finns på `codex/dragan-lipsync-registry`; detta är förberedelse och
en testad adapter, **inte aktiverat rörligt tal i spelet**.

- Neon `production/croupier` innehöll 56 Dragan-poster. Alla 56 Blob-filer
  lästes och verifierades mot registrerad SHA-256 och storlek. Separat
  återläsning visade oförändrade ID:n, revisioner och hashvärden.
- 50 rörelseklipp exporterades med sina exakta medie-ID:n. Fyra inspelade
  repliker ligger kvar på sitt befintliga talflöde. Två äldre `idle`-poster
  har samma 30-fps-fil och ingår inte i 24-fps-banken. Produktionsfilmerna
  har inte ersatts, raderats eller fått ändrad acceptans. Härledda testfiler
  överfördes endast till den separata tillfälliga GPU:n.
- Lokalt byggt CPU-underlag: 2 479 unika fullständiga YUV-bildrutor,
  `pool.mp4` 471 469 184 byte och explicit vila i ruta 0 av profilens
  `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f` (Kevin V2 · andning).
  Källmanifestets SHA-256 är
  `e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d`.
  Privat authoring-underlag finns utanför Git; det är inget nytt runtime-register.
- `createRegisteredMovingSpeech` kopplar ett verifierat källmanifest till
  befintlig PCM-/bildruteplan och transport. Den kräver både aktuellt register,
  exakt media i spelarens frysta publiceringskontext och verifierad bank.
  Ett bildkvitto från GPU-leverantören räcker inte som bankverifikation.
- Verifierat: riktade tester för export, bankbygge, metadataförändring,
  nekad åtkomst, bildruteplan, PCM, sockettransport och dealerlagrets mask.
  Python/ffmpeg-provet byggde en syntetisk bank med exakt deduplicering.
  PR191 på `c1fffdf4` passerade full GitHub-CI. Det opt-in webbläsarprovet
  kördes inte; det senare betalda modellprovet redovisas separat nedan.
- Kvar: bank-/workerattestering i en autentiserad session,
  inkoppling mot befintlig autentiserad talsession och budgetjournal samt
  serverns tidsplanering/replanering och spelarens ljudklocka.
  Inga produktionsprofiler eller befintliga molntjänster ändrades. Kontroll av
  GitGuardian via ordinarie CLI gav 0 öppna och 18 ignorerade incidenter,
  aktiv övervakning, partiell platsmetadata och historisk scan `too_large`.
  Detta är inte bevis för fullständig historisk täckning.

Fortsättning 17 oktober: CPU-underlaget kan nu överföras separat till GPU-steget
med ett på källdatorn låst kvitto och filhashar. Riktat Python/ffmpeg-test
verifierar separat beredning, bevarade poolbyte och avvisning av ändrad karta
eller ändrat kvitto; modellberedningen ersätts av en uttrycklig teststub i detta
test och är ingen GPU-/bildacceptans.

RunPods inloggade konsol visar `croupier-astrid-gpu-test` (`zsudl8tmzcmiv1`),
imagen `ghcr.io/jakeminator123/astrid-gpu-worker:sha-a041e48b9085a3cc4e324fa960551dde2822229b`,
en GPU i klassen 24 GB Pro och högst en worker. Koden i repot stöder fler dealers
via referensbild, men det är inte verifierat att denna driftsatta image innehåller
samma senare stöd. Den separata rörliga motorn använder en bildrutebank per dealer.
Avsikten är en gemensam talväg och delade workers, inte en permanent GPU per avatar.
Den befintliga RunPod-nyckeln lämnades orörd. Efter Jakobs uttryckliga
godkännande skapades `croupier-dragan-prep-20261017` med GraphQL Read/Write
och AI API None, sparad endast i huvudcheckoutens gitignorerade
`.env.dragan-gpu.local`. Jakob godkände högst 5 USD för det separata provet.

**Genomfört GPU-prov 17 oktober:** en separat RTX A6000, 48 GB GPU/50 GB RAM,
med Emils granskade `rorlig.py`/`motor.py`, MuseTalk-commit
`0a89dec45a0192b824e3cf4daf96c239440c5ed8` och samma beredningsrecept
(`sigma=1`, `cheek=90`). Alla 2 479 bildrutor hade hittat ansikte; beredningen
tog 744,6 sekunder. TAR-filen är 594 432 000 byte med SHA-256
`5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c`.
Efter nedladdning verifierades arkivet, alla sju filer och ansiktsmetadata lokalt.

Ett verkligt modellprov använde 89 exakta bildrutor ur `Kevin V2 · andning`
och befintligt inspelat ljud från `0f285c18-69da-43e4-8b28-f9fc8cce2d5f`.
Ingen annan persons TTS-konto användes. Uppvärmd motor gav 45,9 bildrutor/s,
första bit efter 496 ms; initial modell-/bankladdning och uppvärmning tog
57,3 sekunder. Provet är en 3,709-sekunders MP4, **inte verifierat live i spelet
och inte visuellt godkänd läppsynk**. Hashkontroll och ett granskat stillbildsprov
ersätter inte kontroll av hela videon med ljud.

Testpodden `dmo7wwtvcurqw6` avvecklades efter att banken, filmen och kvittona
hämtats hem. API-återläsning visade inga kvarvarande Pods; Astrids endpoint
har kvar samma ID/namn och workergränser 0–1. Beräknad GPU-/diskkostnad:
0,17 USD (tids- och prisberäkning, inte fakturakvitto). Nyckelfilen bevaras lokalt.
Privata resultat finns i denna chatts `visualizations`-katalog under
`dragan-gpu-result/`; de är authoring-/testunderlag och ligger inte i Git.

**Lokalt rörelseprov 17 oktober:** Jakob bad om utdelning till box 3 och
”Jakob är kung”. Neon-profilens befintliga ElevenLabs-klon `Dragge`
(`7f95xPL4S3ySZ4OS1pw8`, `eleven_multilingual_v2`) verifierades och användes
för ett enda TTS-anrop med profilens sparade inställningar. Klippet
`d207c889-cede-41be-98a9-4355ffc1f1c2` är registrerat som `box3`,
`Kevin pos4-iv`; dess aktuella Neon-hash matchade den bevarade Blob-kopian.
Emils motor och samma verifierade modellvikter kördes i en isolerad WSL-miljö
på Jakobs RTX 3060, 12 GB. Hela utdelningen behölls: 66 rutor/2,75 sekunder,
utan loop eller fryst slutruta; repliken använde exakt ruta 8–57. Bildrutorna
i testbanken matchade originalets avkodade YUV-byte före läppsynk.
FFmpeg verifierade H.264/AAC och full avkodning av resultatet. Tre utvalda
ansiktsbilder granskades; full audiovisuell acceptans är fortfarande öppen.
Renderingen av 50 talrutor tog 4,245 sekunder (11,8 fps), alltså ett
**offlineprov, inte verifierat direkttal**. Ingen ny RunPod-resurs startades.
Privat video: `dragan-jakob-ar-bast/dragan-box3-jakob-ar-kung.mp4` i samma
visualizations-katalog, med kvitto `preview-receipt.json`; video-SHA-256
`56ab4888c9677ba17fcd1495c04a5a170483f2e92f7a126ffbc4163641cc2c89`.
Original, röstprofil, produktionsregister och Astrids tjänst ändrades inte.
Jakobs lokala checkpoint beskrivs i `docs/AI/lipsync-lokalt-2026-10-17.txt`
och märks på GitHub med `lipsync-local-dragan-2026-10-17`. Taggen avser
det verifierade offlineprovet, inte aktiverat direkttal i spelet.

Jakob påpekade att äldre Blob-filmer och Neon-/UX-registreringar kan vara fel
eller inaktuella. Den verifierade banken är därför en **teknisk testbaseline**:
exakta byte/ID:n bevisar inte rätt spelhändelse eller senaste tagning. Original,
ostagade filmer och tidigare acceptans ska bevaras medan dessa val reds ut.


## Levererat och verifierat

- [PR188](https://github.com/Jakeminator123/scoutgaming/pull/188) är mergad
  som `620ab98198914d83c51e51d9eb28b192e18d9cf3`. Regressionerna körs i
  tidsatta grupper. POSIX-processstädning och bevarade exitkoder är rättade;
  frivillig kartrapportering ersätter inte produktprovets resultat.
- [PR190](https://github.com/Jakeminator123/scoutgaming/pull/190) är mergad
  som `d7dd04dcbc1c3eab6358ac64b63ad7b5d97a9166` efter integration av PR188.
  [PR189](https://github.com/Jakeminator123/scoutgaming/pull/189) är stängd
  som innehållsmässigt ersatt. Förbrukad lokal registeruppgradering,
  kosmetiska tester och dubblerad dokumentation är avvecklade.
- Integrationshead `c7d23eca0211870cce39ab9de56a1e2a3d2fe41a` hade
  [grön full CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/38982387926).
  Lokal hook: 39 pass, 5 POSIX-skip på Windows. ChatGPT Pro läste detta
  publicerade head via GitHub och fann ingen nytillkommen blockerare.
- [Main-CI på d7dd04dc](https://github.com/Jakeminator123/scoutgaming/actions/runs/38982989384)
  passerade alla regressionsgrupper, Studio/typkontroll, SQL/omstart/HTTPS
  och schemaberedskap. Detta är inte visuell spel- eller läppsynkacceptans.
- Produktionskvitto 17 oktober cirka 01:53 svensk tid: Vercel
  `dpl_74WdAmdxWGjtn6xJMuUNMVx1rYut` READY och Render
  `dep-db9bggrm8hqs73ac2n70` live på samma fullständiga d7dd04dc-SHA ovan.
  Publik startsida, engine health och version gav HTTP 200; versionen matchade.
  Detta daterade kvitto ska inte beskrivas som kontroll av senare kod.

## Admin: sammanhängande klippyta

Jakob valde att förbättra den befintliga zoombara klippkartan. Leveransen på
`codex/admin-klippkarta` samlar Dealers & klipp med större detaljförhandsvisning,
exakta varianter, klippguide och provning av en uttryckligt vald sparad
Blackjack-scen. Biblioteket fungerar utan bolag eller rum. Navigeringen har
förenklats; Kopplingar och Användning & beroenden finns under System.

Materialbibliotekets gamla wrapper, CSS och utkastadapter är ersatta; gamla
`/admin/material-library`- och Control-länkar behåller autentisering och kontext
via motsvarande Admin-vy. Gemensamma tjänster och aktiva editorer är kvar.

Verifierat lokalt: full Studio/Next-build och Admin/Lobby-typkontroll, riktade
kontraktstester samt verkligt Admin-bygge mot minnesfixtur. Browserproven omfattar
variantbyte, sparning/omladdning, bevarat utkast vid revisionskonflikt,
zoomkontroller, klippguide och stoppad klippuppspelning vid navigation.
Desktop 1366×768 och mobil390×844 har kontrollerats; mobilpanelen behåller
full höjd och 279px videoförhandsvisning utan horisontellt sidöverflöde.
Scenstartens session/auth/CSP har komponent- och servertester; ingen ny visuell
acceptans av verklig spelvideo eller läppsynk påstås. PR/CI redovisas i
leveranskvittot. Ingen merge, deployment eller produktionsskrivning ingår.

Neutralguidens tre filer kommer från lipsyncs frysta `2b01ece7`; import, Forge,
GPU och spelarens ljudklocka levereras separat i PR191. Slutgranskning av dess
head och CI tillhör respektive PR. Huvudagenten äger integrationen av Admin.

GitGuardian vid leverans: main `8f2d301b`, källbindning verifierad, aktiv
övervakning och komplett incidentlista med 0 öppna/18 ignorerade. Platsdata
är delvis lästa och historisk scan är ofullständig (`too_large`). Den köade
GitGuardian-suiten på main är separat från dessa API-resultat.

## Nästa produktarbete

Den tekniska Neon-/Blob-/runtimeflytten är avslutad. Nästa huvuduppgift bör
vara lobbyns tillåtna dealer-/bordval och överföring till spelstart efter
genomförd Admin-leverans.
Det är en rekommendation; nästa agent ska utgå från Jakobs val.

<a id="2-öppna-kontroller-och-kända-fel"></a>

Unika öppna frågor finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md#verkliga-migrationsfel-och-kvarvarande-utredningsspår):
N2:s motordata/rapporter, global ändringsloggs API, lobbyns bordval,
konto-/integrationsfunktioner, nytt tal/läppsynk, B18/B19, plattformsbeslut
#52 och backup/QA. Äldre auth-, publicerings-, idle-/frame-/zonobservationer
behöver reproduceras innan de klassas som aktuella fel.

Behåll riktade prov för behörighet, bolag/rum, revision, sparande, pengar och
spelregler. Det finns inget generellt krav på två spel, upprepade manuella
prov eller visuell acceptans för varje commit/merge. Godkända tester och
mediahashar bevisar inte läppsynk. Aktiva Control-komponenter och `lab/lib`
kan fortfarande vara delade beroenden; radera efter konsumentkontroll.

## Samordning och skyddat arbete

Två andra chattar fortsätter parallellt:

- **lipsync**, chatt `01a14685-3cb7-7020-8f18-414e8bbbd5fe`.
  Aktivt spår: `codex/dragan-openclaw-cloud`,
  `C:\Users\jakem\.codex\worktrees\dragan-lipsync-registry-3518\croupier`,
  ersätter [PR195](https://github.com/Jakeminator123/scoutgaming/pull/195).
  PR191 är en mergad versionsreferens, inte ett öppet leveransspår.
  Kontrollera aktuell status med chatten innan medie-/runtimeändringar.
- **STÄD-CL**, chatt `01a14631-14e2-7d53-ba3f-50a5f7a4c8f4`.
  Bevarad arbetsyta `C:\Users\jakem\.codex\worktrees\b07d\croupier`,
  branch `codex/dealer-regression-timing`. Agenten har bekräftat att inga
  andra worktrees eller temporära PR188-loggar behövs för dess arbete.

Jakob har tillåtit samordning med dessa chattar. Codex kan skicka meddelanden
mellan dem; `agent-talk` når bara agenter i samma checkout. Kontrollera
aktuella filanspråk och utse en ägare för Git/integration. En agents svar
är information, inte ett nytt användarmandat.

Huvudcheckouten `C:\Users\jakem\Projects\croupier` har skyddade lokala
ändringar i `.codex/config.toml`, `apps/croupier-speech/package.json`,
`.agents/skills/source-command-ping/`, `.cursor/settings.json` och
`web/public/review/`. 143 filer var hashbevarade vid PR190-leveransen.
Privata filmer, källoriginal, exportpaket, kalibrering och återställningsdata
ska samordnas med lipsync; de ingår inte i strukturfasens radering.
`ai-system-map` har ocommittade ändringar och `8e3c` privata arbetsdata;
båda lämnas för separat ägaravstämning.

## Leverans och återställning

Vercel-projekt/team `scoutgaming`: nya Preview-deployments stängdes av
17 oktober (`previewDeploymentsDisabled=true`), medan `main` fortsatt är
produktionsbranch. Befintliga preview-länkar har inte raderats.
GitHub-CI gäller fortsatt för PR:er. Render `croupier-v2` följer `main`
med `autoDeploy=yes`, `autoDeployTrigger=checksPass`.
Merge kan alltså publicera webb/Studio och därefter spelmotor automatiskt.
CI, deployment och faktisk live-version ska redovisas separat.

GitGuardian-läsningen på d7dd04dc gav aktiv övervakning och 0 öppna/18
ignorerade incidenter, med ofullständig plats-/historiktäckning.
QA/Preview-utbyggnad är pausad; ursprunglig ingresshemlighet är inte återställd.
[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) och
[ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) äger återställning och miljöansvar.

Äldre detaljkvitton finns i
[handoffen på d7dd04dc](https://github.com/Jakeminator123/scoutgaming/blob/d7dd04dcbc1c3eab6358ac64b63ad7b5d97a9166/docs/JOHN-HANDOFF.md)
och PR188/190. Fasens egna körskript, utkast och temporära CI-loggar är rensade.
17 historiska fjärrbrancher och två lokala brancher togs bort efter kontroll
av exakta PR-huvuden och main-innehåll. PR189:s avslutade worktree
`simplify-test-policy` togs bort med återställningsbar Codex-snapshot.
STÄD-CL:s och lipsyncs arbetsytor bevarades.
