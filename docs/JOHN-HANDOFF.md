# Aktuell handoff — Scoutgaming

## PR227: Studio använder sin egen policymedialäsare

Ett Studio-bygge med enbart appens låsta beroenden hittade en andra korskoppling:
Studio importerade web/storage/studio-runtime, vars lazy mediaimport drog in
spelserverns Blob-SDK. Policybootstrapen har nu neutral ägare i
packages/presentation/server/studio-policy-runtime.mjs. Studio och game binder
varsin befintlig medialäsare och samma migrationskontroll. Schema, scope, readSaved,
readonly-stores och felstängning behåller ordning och beteende. Isolerade fixturelistor
och miljöregistret inkluderar den nya kanoniska modulen. Inga nya SDK-beroenden,
provideranrop eller datamigreringar införs. Befintliga policy-/lagringsprov passerar
20/20 utan skips. Fullt Studio-bygge med /studio/native-admin, egna låsta Lab/client-
beroenden, inga privata envfiler och varken root- eller web/node_modules passerar:
kompilering, typer, 28 statiska sidor och 80 deploymenttraces. Ordinarie commit-hook
och exakt-head-CI är leveransgrindar; bygget är ingen ny drift- eller medieacceptans.


## PR227: rättade verifieringskällor

Slutlig CI hittade två kvarvarande gamla källreferenser efter Directorflytten.
Det befintliga isolerade P6-routerprovet importerar nu product-speech från
packages/director. Astrids HEAD-baselinearkiv inkluderar samma paket, så
arkivet täcker den verkliga selektionsgrafen. Inga assertions, snapshots,
produktmoduler eller providerinställningar ändras. De två befintliga provfilerna
passerar 11/11 utan skips; ordinarie commit-hook och ny PR-CI följer.
## Studio väljer sin egen Blob-adapter — 17 oktober 2026

PR224:s Vercel-bygge på main30ae1f35 misslyckades: Studios svarsbibliotek
importerade spelappens Blob-adapter, vars SDK bara fanns i web/node_modules.
Reply-factoryn tar nu en obligatorisk mediaStore och importerar enbart det
rena mediaavtalet. Studio binder cloud-media-store, spelservern blob-media.
Saknad/ofullständig port stängs med befintligt reply_library_unavailable;
metadata, CAS, scoped rättigheter och privata mediebytes ändras inte.

Reproducerat i ny arbetskopia med endast låsta Lab-beroenden: bundlern hittade
inte @vercel/blob i web/blob-media.mjs. Samma reply-bundle passerar efter fixen
utan speladaptern. Befintliga biblioteks-/API-prov passerar17/17, utan skips
eller provideranrop; egna mockklienter behålls. Helt Studio-produktionsbygge passerar
med aktiverad /studio/native-admin: kompilering, TypeScript, 28 statiska sidor
och 80 rena deploymenttraces. web/node_modules och root/node_modules saknades
under hela bygget; inga privata miljöfiler fanns. Ordinarie commit-hook används. Ingen ny testfil,
paketversion, miljöändring eller databas-/medieåtgärd.

## Gemensam lokal integrationsbas — 17 oktober 2026

Senaste normala integration tillför också PR225:s explicita Blob-port från
c69189529c7d0e29c4fa0077f0bab2b392e1529c och main224 på30ae1f35.
Endast den avgränsade appbindningen och dess fixture-/typkontrakt ändras.
Den enda konflikten var två handoffinledningar; båda bevaras.

Föregående normala integration förenade DATA-PR224 på
2554e1af7831ade9eaa6062302331d9e2161e200 med main223/222 på908beb4d.
Koddelens ändring här är den redan levererade modulbyggfixen och inboxfixen;
kompositions-, publicerings- och datakropparna är oförändrade. Den enda
konflikten var två oberoende handoffinledningar; båda har bevarats.

Detta kvitto ersätter äldre väntestatus i delavsnitten nedan. M:s separata
commit `46a1d2bd0b20eeff8ba184e38be820412b08d185` bevaras. L-head
`2ba8aaedf8077f985c39505e702d3ef1b81ce370` integrerades normalt som
`7ba27e13afc3b30902e4e04ab5fb855ec5025054`: ordinarie hook 587/587,
inga skips. Därefter integrerades J-head
`ea26fa42ff4e3d1faebb7b77059c079e9d111bd6` normalt, efter parentreview
av båda konfliktöversikterna. J-integrationshook: 312 pass, 0 fail och ett
befintligt browser-opt-in; frontendtyper gröna. Handoffkvittot tillförs med
vanlig dokumentationshook utan testomkörning.

M:s dokumentbindningar, L:s gemensamma speech/idle-komposition och J:s
kanoniska routing förenas. QA:s 190 källor är unika och har befintliga mål;
branding behåller operators/contracts-ägaren. HTTP-importgrafprovet behåller
både navigationens exakta adress och alla fyra talkontraktsalias. Inga
assertions eller publicerings-/talkärnor ändrades utöver granskade import-
och källisteunioner. N/O ska förgrenas från den rena gemensamma basen.
Ingen extra fullbuild, push, deploy, provider-/GPU-/schemaändring eller
ny medieacceptans ingår. Lipsync2:s prov är avslutat med STOP enligt PR222;
Dragan-tal/läppsynk är fortsatt separat ofärdigt produktarbete.

## C2l-c — gemensam ägare för genererat tal, 17 oktober 2026

Fullfile-service/provider, journalens lease-primitiver och tre rena talkontrakt har
kanonisk ägare i `packages/presentation`. Studio och game binder samma modul-lokala
runtime med explicit ursprunglig repository-root. Getter, config key, journal/artifacts
och exakt providerfunktionsidentitet delas inom samma modulgraph; skilda tjänster har
eget minne. Ingen global/HMR-registry eller ny provider-/journalimplementation införs.
Gamla källwrappers är borttagna; publika browser-URL:er behålls med explicit allowlist.
Privata servermoduler publiceras inte. Befintlig Studio-proveniens behåller originalpathen.

Main/PR213 integrerad normalt i `950da8e9b46d49a905ec654500d5f4d3aaf49967`:
203/203 fokuserade hookprov och frontendtyper gröna. Integrationen rättade förbrukade
ops-/miljökällreferenser med samma policy- och dokumentvaliderare. SessionSignal,
lease/reservation/cancellation och journalens failclosed-beteende är bevarade.
C2l-c: 396/396 riktade befintliga prov, Studio-typer och tio mekaniska kroppsjämförelser gröna. Parentreview och ordinarie commit-hook återstår. Ingen push, fullbuild,
miljö-/schema-/provider-/GPU-ändring eller nytt läppsynksgodkännande.

## Publika moduler oberoende av deployordning — 17 oktober 2026

Frontendens middleware låter GET/HEAD till exakta kanoniskt validerade adresser i
`presentationPublicSource` nå Nexts `public`-katalog. Byggaren använder hela samma
`presentationPublicModules` som startpunkter i sin befintliga import-/aliasclosure,
så samtliga 37 deklarerade publika adresser byggs även utan en aktuell spelarimport.
Backendallowlisten, Studio-routningen, autentiserade API:er och ingressen ändras
inte. Ingen generell paketprefixroute eller andra hårdkodad allowlist införs.
Andra metoder och `next-action` svarar 405 med `Allow: GET, HEAD`.

PR223:s första regression filtrerade felaktigt på redan byggda filer och dolde
13 saknade adresser. Ofiltrerad regression reproducerade exakt dessa 13 före
byggfixen. Efter rättningen: `platform-ui.mjs` och `player-ui-build.mjs` 29/29,
inklusive samtliga registryURL:er, transitiva from-/sidoinporter och litterala dynamiska importer, verklig middleware,
Nexts statiska server och en isolerad äldre backend som svarar 421. GET/HEAD,
källbytes, JavaScript-/JSON-MIME, privata/extra/encoded adresser och metod/action-
nekanden passerar; API-anrop behåller backendvägen. Befintlig fem-MiB-budget,
tvåfilslanding och nekad media/BO-kopiering passerar oförändrade.
Ingen fullbuild, installation, deployment, miljöändring eller produkt-/medie-
acceptans ingår. Byggfixen är parentgranskad; ordinarie hook verifierar slutversionen vid commit. PR/CI och
driftkvitto för denna fix: PR223 mergad på 2e45a661ef844d14a9d2321f30d05f53c5e64927, mainCI39062224771 SUCCESS. Mergagent verifierade automatisk Vercel dpl_6HtrhePVENR7vynXnWQX6v8rKQKS på www och Render dep-db9sp3jm8hqs73ari380 LIVE med exakt version/health200. Alla 37 publika adresser passerade GET/HEAD även under verkligt versionsglapp.

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
`05cbc22de9c6637cb9ea642c6f697a093dae42af` (PR214), med fulla CI- och driftkvitton från mergeagenten. Senare delar inväntar sina separata kvitton.
Teknisk migrationsstatus och kvarvarande produktarbete finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md). Användarsteg finns i
[lab/docs/README](../lab/docs/README.md); ingen ny tracker skapas.

## Etapp 3 C2m: publicering och frysta paket — lokalt 17 oktober 2026

Main214 `05cbc22d` integrerades normalt som `ca552deb`: ordinarie hook
203/203 och frontendtyper gröna. Fyra konflikter löstes med båda källistorna
och dokumentavsnitten bevarade. Main214:s nyare Dragan-kvitto är orört.
Speech-session/runtime är byteidentiska med main214; bankens enda import
fortsätter använda appägd Blob. Kanoniska C2j-policy-/slug-/SQL-importer rättades.

Tolv befintliga runtimefiler och tre deklarationer flyttas till sina neutrala
ägare. Den enda bundna dokumentvalidatorn och repositorykompositionen finns i
`packages/studio-registry/server/document-contract.mjs` respektive
`document-repository.mjs`; projekt/social/lane, required ports och policybindning
är samma. Pool, driver, auth och readiness förblir appägda. Publiceringscodec,
snapshotfångst och frozen-tjänster finns i `packages/presentation/server`.
Rena layer/material/playbackblad finns i `contracts`; inspelad talprojektion
finns i `runtime`. Rumsform läses från befintligt presentation-room-kontrakt,
medan package-rooms endast äger verkliga paket-/rumoperationer.

Lane-/dealerurvalets exakta hjälpare och deklarationer har kanonisk ägare.
Alla 95 dokumentkontraktsimportörer och övriga konsumenter/fixturekällor följer.
Inga gamla wrappers eller dubbla policykroppar lämnas. Befintliga publika URL:er,
medieidentiteter och `owner: "web"` bevaras. Samma captured-snapshot, repeatable-read,
walletägda transaktion, CAS och separata Blob-I/O gäller. Neutral closure har
70 moduler utan app-/SDK-importer eller cykler; 15 flyttkroppar är mekaniskt
oförändrade. Alla 81 berörda befintliga prov-/fixturekroppar är oförändrade
utöver imports och exakta flyttade sökvägar; inga assertions har tagits bort.

Riktad verifiering: 301/301 befintliga prov inklusive sex isolerade serverfixturer,
1/1 verklig GET/HEAD-importgraf och Lab-/frontendtyper gröna. Egen låst
klientinstallation gav ingen lockdiff. Parentreview är godkänd. Leveransen är
committad lokalt med ordinarie fokuserad hook: 1202 pass, 0 fail och 6 befintliga
opt-in. Handoffkvittot tillförs med vanlig dokumentationshook utan testomkörning.
Ingen push, fullsuite/fullbuild, schema-/provider-/molnändring är gjord.
Den efterföljande gemensamma L/J-integrationsbasen kvitteras ovan.

## Etapp 3 C2l-a: appägda medialäsare — lokalt 17 oktober 2026

På baseline `b037b483848b8efbb82f2ec8185ca2decfc52552` äger
`packages/studio-registry/server/` gemensam mediaorkestrering och explicita
lokala projekt-/videoläsare. Studio och game har egna verkliga kompositioner
med sina respektive Blob-adaptrar. Game importerar inte längre Lab för
projektläsning, videoregister eller media-runtime. Rootval, data-/uploadmappar,
preview-URL:er och konfigurationskälla är bevarade. Aktuella scoped läsningar
är fortfarande skilda från fångade snapshots, utan lokal fallback i Neonläget.

Bindningsregler och legacyinventering har en implementation i
`packages/presentation/server/`. Kontaktvalidatorer och lokal filpolicy
injiceras från apparna; inga nya browseradresser öppnas. Review-säkerhet,
`neverAgain`, undantaget för pensionerade index, hash/bytekontroller,
filhandtag, origin, HEAD och Range bevaras. Studio behåller mkdir, skrivning,
lås, CAS, historik och arkivering; de gemensamma lokala läsarna skriver inte.

Parentens projekt-/bindningsförberedelser bevarades. En felaktig scope-import
rättades till befintliga `packages/studio-access/studio-scope.mjs`; den
befintliga bindningsdeklarationen följde med implementationen. Mekanisk kontroll
bekräftar oförändrade projekt-, bindnings-, metadata-, inventerings- och
läsarkroppar, bortsett från namngivna portar och flyttad mappskapning.
Inga package→app-importer har tillkommit. Befintliga fixture-/QA-listor,
miljökällinventarier och guider följer de nya ägarna; inga miljövärden ändras.

Node 24.21.0, fyra workers: 142 befintliga riktade prov passerar utan skips,
inklusive båda appkompositionerna, video-/Range-paritet för tom och /studio
basePath, Neon/current/captured, legacy-säkerhet, projektwriter och samtliga
sex runtime-fixturekonsumenter. Miljöinventeringen är grön; testinventeringen
visar 512 kandidater och noll orphans. Lab-beroenden länkas först efter
byteidentiska manifest/lock; inga installationer genom junction. Inga nya
testfiler, fullbyggen, provider-/GPU-anrop, commits eller push här.

C2l-b (presentation/idle) och C2l-c (genererat tal) är inte genomförda.
C2j/C2k och PR213 behöver integreras före samlad slutgranskning; deras
SQL-/Director-/speechändringar ingår inte i detta lokala kvitto.

C2l-a committades därefter som `c1d800c5da10441cab581c8ca8a6a7a843db33ba`;
ordinarie hook passerade 106/106 utan skips. C2k
`c6d474bcff7b085b6881a7024e6735d203c0d392` integreras med vanlig merge utan
commit. Fem innehållskonflikter är lösta: båda källistorna/kvittona bevaras,
spelservern kombinerar lokal projektreader med appägd Director-settings, och
C2h:s dokumentfactory använder den gemensamma sociala policyn. Mergecommit,
kontroller av den förenade versionen och C2j/PR213-integration återstår.

## Etapp 3: gemensamma register-, identitets- och lagringsägare — 17 oktober 2026

Registerläsare, identitet och SQL-/operatörsgränser levereras tillsammans.
`packages/studio-registry/server` äger registerkärna, aktuella/frysta kataloger,
mediaavtal och tekniska Blob-operationer med explicita beroenden. Apparnas
kompositioner väljer rötter, previewadresser och egna lazy SDK-klienter.
Fångade kataloger läser samma snapshot utan nya databasfrågor; mediahash,
samma öppna filbeskrivare, cache och Range/HEAD-beteende bevaras.

`packages/studio-access` äger gemensamma credential-, Craig-, epoch- och
partnerbehörighetsregler samt visningsnamn. Cookies, HTTP-sessioner,
inloggningsflöden och apparnas bootstrap behåller sina ägare. De fyra
identitetsimplementationerna är mekaniskt oförändrade.

`packages/storage/server/postgres-store.mjs` äger en poolfri SQL-/ALS-kärna.
Game äger sin pg-factory med verifierande TLS; Studio binder sina befintliga
Neon-pooler. `packages/operators` äger store, lifecycle och branding.
Sparad spelpolicy får explicit dokumentkontrakt. Transaktioner, CAS, snapshot,
rum-/tenantisolering, historik, wallet, schema och startkontroller bevaras.
Driftverktygens importörer och miljökällor följer samma kanoniska moduler.

Delarna har granskats separat: C2h:s register-/mediakroppar, C2i:s fyra
identitetsregler och C2j:s 41 mekaniska jämförelser. Ursprungliga relevanta
kontroller passerade, inklusive SQL-/fixture-/typkontroller. Efter slutlig
navigation/main214 fick h och i vardera317 pass/0 fail/1 befintlig browser-
opt-in och gröna frontendtyper. C2j:s ursprungliga ordinarie hook gav452 pass,
0 fail och4 befintliga opt-in. Samlad integrationshook, PR-CI och driftkvitto
återstår. Inga nya testfiler, schema-/miljövärdesändringar eller provideranrop.

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

## Tidigare delkvitton för C2h, C2k och C2i

Egen commit c2bef19ca85ec43468f9ececdf13d65a43378b77 har passerat ordinarie
hook 511/511. Integration med c51eba14e2bd6b4cc7b7bb0a7d98e29958d69e31
är staged och ännu inte committad: konflikterna i detta avsnitt, QA-källistan
och repositorykompositionen är lösta. Inkommande repositorykärna och
PR211:s HEAD-/DirectorDocker-fixar är bevarade. Riktade integrationsprov
128/128 passerar. Paketets README beskriver nu läsar-/providerägarskapet.

Vid huvudagentens slutgranskning: C2e:s 16-raders repositorykomposition ska
behållas; bara dess runtime-catalog/stored-media-types-importer flyttas här.
Bevara PR211:s HEAD-/DirectorDocker-rättningar och C2g:s navigationsändringar
i gemensamma käll-/QA-listor. Auth, appägd publicerings-/bindingsorkestrering,
Director, transaktioner, schema och produktionsgodkännanden ingår inte.

Säkerhetsläsning på remote main 193e80066fce8d5cd8e889dc41d5aac029deb32f:
två tidigare öppna GitGuardian-incidenter 38318914/38318915, partiell
platsmetadata och historisk scan too_large; aktuell GitGuardian-suite queued.
Säkerhetsläsningen före commit saknade skyddad anslutning och gav ingen
ny incidenttäckning; ovanstående är det senast faktiskt lästa kvittot.
Detta är inte ett nytt säkerhetsklartecken eller en driftverifiering.

## Etapp 3 C2k: gemensamt Director-bibliotek — lokalt 17 oktober 2026

På baseline `e60289673933d49a73d0e34c81cc0071739df9ef` har 13 hela moduler
flyttats från `open-claw/lab/src/` till `packages/director/`, inklusive
Companions Node-SQLite-adapter. Importvägar har ändrats; implementationskropparna
är identiska. Rena inställningsregler och Adminvalidering/felklass har delats ut.
Gateway-RPC, signering, Adminmutation/snapshot, HTTP, katalog-I/O och tjänstens
`LAB_ROOT` behåller sina ägare och beteenden. Paketet saknar appimporter;
den enda källimporten utanför paketet är presentationens dealeridentitet.

En kanonisk Node-adapter, `packages/director/node/settings-reader.mjs`,
äger miljöfilparsning och prioritet. Tjänsten, Studio och spelservern komponerar
den med sina oförändrade roots och filval. Ingen env-/dataflytt sker; alias,
tomma värden, nullish-regler, defaults, timeout och Companion-kataloger bevaras.
Exakta Docker COPY/ignore, Directors buildFilter, runtime-fixtures, QA-källista,
konsumenter och befintliga guider är uppdaterade; PR211:s Dockerfix bevaras.

Node 24.21.0, högst fyra workers: 30 inledande enhetsprov passerar. Den bredare
riktade sviten gav 236 pass och två miljöfel: saknat Gateway-ws åtgärdades med
egen låst installation, varefter RPC-proven gav 11/11; det verkliga Next-
startprovet kräver ett verifierat Studio-bygge och lämnas till integrationen.
Efter den slutliga settings-sammanslagningen passerar 51 befintliga prov för
settings, service/Studio, isolerade Docker-källor och samtliga sex runtime-
fixturekonsumenter utan skips. Dessa omprov överlappar tidigare resultat.
Importkontroll: 69 ändrade kodfiler utan olösta relativa imports; 17 biblioteksfiler
med 26 slutna paketlänkar. Testinventering: 512 kandidater, noll orphans.

Lab använder en dependencyjunction först efter identiska manifest/lock; inga
installationer gjordes genom den. Gateway har egen låst installation. Inga nya
testfiler, fullbyggen, live-provideranrop, miljöändringar, commits eller push här.
C2h:s kommande registryflytt behöver förena importändringar i Lab-adaptrar,
`web/storage/studio-contract.mjs` och de gemensamma fixture-/QA-listorna.

## Etapp 3 C2i: gemensam identitet — lokala ändringar 17 oktober 2026

`packages/studio-access/server/` äger nu credential-resolvern, asynkron
CRAIG-identitet, asynkron behörighetsepok och Partner-behörighetspolicy.
Samtliga konsumenter och spelserverns två dynamiska PostgreSQL-importer
använder de nya källorna. De fyra ersatta filerna under `web/` är borttagna;
inga wrappers eller dubbla implementationer lämnas. Paketet importerar
endast Node och egna roll-/scopeblad, utan app- eller providerberoenden.
`validateStudioScope` och `StudioStorageError` är samma kanoniska funktion
respektive klass som kontraktets befintliga reexports.

`packages/studio-access/display-name.mjs` innehåller en enda importfri
`normalizeDisplayName`. Båda Partner-API:erna och Studio använder samma regel.
De två tidigare kropparna var identiska. SQL, hashning, kollisioner, roller,
feltexter och namnnormalisering är mekaniskt oförändrade bortsett från
importvägar. De äldre synkrona CRAIG-/epokimplementationerna och samtliga
befintliga testassertions är bevarade. QA-källistor och den befintliga
serverfixturekopieraren inkluderar de nya beroendena. Ingen publik moduladress
läggs till. Cookies, sessioner, HTTP, pool/drivers, schema och wallet är appägda.

Baslinje `a691f0ac03c738b4d92904bd3e41e39bd792674e`, branch
`codex/stage3-shared-identity`: 170 riktade befintliga prov passerar, ett
befintligt browserprov är opt-in och hoppas över. Alla tio prov från de sex
serverfixturekonsumenterna och Lab:s TypeScriptkontroll passerar med Node
24.21.0 och fyra testworkers. Ändrade källors 268 relativa importmål finns.
Egen låst Lab-installation gjordes direkt i denna arbetskopia utan junction;
package-/lockfiler ändrades inte. Ingen fullbuild/fullhook, commit, push,
produktionstest, migration eller molnändring är körd här.

Integrationsytor: C2g ändrar en separat slugimport i
`lab/lib/partner-session.mjs`; C2h ändrar separata mediaimporter i
`web/server.mjs`. Dessa ändringar ingår inte i C2i. Aktuell säkerhetsläsning
på remote main `193e80066fce8d5cd8e889dc41d5aac029deb32f` visar aktiv
övervakning, två kända öppna incidenter 38318914/38318915, partiell
platstäckning och historisk skanning `too_large`; täckningen markeras inte klar.

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

## Inbox och agentregler — 17 oktober 2026

`tools/inbox.mjs` skapar bara saknade GitHub-etiketter; befintliga namn,
färger och beskrivningar bevaras. `done` kontrollerar etiketten `inbox` och
att inloggat GitHub-konto är ärendets skapare innan det får stängas.
Delade GitHub-konton kan inte särskiljas av kontrollen.
Inboxfixarna är mergade i [PR215](https://github.com/Jakeminator123/scoutgaming/pull/215).
Uppföljningen inkluderar Jakobs borttagning av `.cursor/rules/reference-repos.mdc`. Chef- och
leveransreglerna hänvisar till den kanoniska GitHub-policyn i AGENTS i stället
för att kopiera den. Chef-textens beslutsordning följer också AGENTS.
Inboxinstruktionen använder explicit känd ägare på en featurebranch utan
datorregistrering; branchprefix räknas inte som ägarbevis.
Lokal verifiering: 19 inboxprov passerar. GitHub-anropens läsformat har
verifierats mot API/CLI; inga riktiga etiketter eller ärenden ändrades i provet.
Detta är inte ett CI- eller driftskvitto. Köåterhämtningen levererades separat
i mergade PR216; detta arbete rensar inga pingar eller gamla filanspråk.
Rapportens återstående förslag om färre testprocesser och portabel GitGuardian-
konfiguration kräver egna avgränsade ändringar. Den befintliga lokala
konfigurationsändringen är bevarad. GitGuardian på fjärr-main visar
två öppna incidenter med ofullständiga filpositioner; de är inte åtgärdade här.

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

## Dragan: stopp och samlad överlämning — 17 oktober 2026, 19:17 UTC

**Arbetet är stoppat enligt Jakobs instruktion att lämna handoff om workern
fortsatt inte kommer upp. Tal och läppsynk i spelet fungerar ännu inte.**
Senaste provet fick ett riktigt RunPod-jobb och började hämta imagen, men
stoppades av den privata kostnadsvakten innan ljud eller video levererades.
Inga nya GPU-prov, nyckeländringar eller budgetåterställningar är planerade.

### Senaste provet och den konkreta stopporsaken

Vercel och Render körde main `875dacd7ed9743b92c4449ca0a4719df7e662e38`.
Render-versionen lästes även från `/__cloud/version` före start.
Testendpoint `dgpazl8h3a64uj`, template `s6om9k7sje`, använde imagen
`ghcr.io/jakeminator123/moving-gpu-worker@sha256:56b779142cad6d3c0152f53942f6703a0b6f6e74a6b7110c1ea34f69facc3b34`.
Jakob godkände runtime-nyckelns endpointbehörighet; health svarade 200.
Astrids behörighet och media ändrades inte.

Vakten startade 19:00:28.889 UTC med min0/max1 och deadline 19:15:28.889.
Jakobs eget chattmeddelande 19:03:51 gav OpenClaw-text och jobb
`84cb267e-7e48-48d0-8224-04a49ba2b63f-e2`, session
`c508303e135893a9aa27cc319f71078b`. Ingen extra agentfråga skickades.
En läsande Neon-kontroll verifierade session, lease, budget och reservation
1,20 USD innan min1 tilläts 19:04:04.029. Detta bevisar att den nya ordningen
kom förbi den tidigare reservationsspärren. 81 guardtester och tre läsartester
hade passerat offline; övergången tillbaka till min0 vid aktivt jobb blev
inte verifierad i molnet eftersom jobbet aldrig observerades IN_PROGRESS.

Worker `s8le9mn0gs3n8g`, A40 i CA-MTL-1, skapades 19:04:26.556.
Systemloggen 19:06:47 visar hämtade lager och pågående uppackning av imagen.
19:07:40.850 returnerade RunPod två workerposter: denna med desiredStatus
RUNNING och `t5nobwvi58kdch` med EXITED. Båda saknade runtime-telemetri och
matchade rätt image/version; endpointens max var fortfarande 1.
Vaktens kontroll `workers.length <= workersMax` stoppade därför med
`unexpected_active_workers`. Detta är **inte bevis för två aktiva GPU:er**.
[RunPods officiella CLI-dokumentation](https://github.com/runpod/runpodctl#waiting-until-a-resource-is-usable)
beskriver att FlashBoot-cachade workers kan ha EXITED och att RUNNING kan
rapporteras innan containern finns. Det sparade underlaget räcker inte för
att klassificera just den andra posten som cache eller ersättningsworker.
Guardens räkning behöver därför utredas innan ett nytt prov; gränsen får
inte bara tas bort eller okända workerposter ignoreras.

Spelaren väntade cirka 342 sekunder och visade talfel. Inspelad respons
innehåller text och video-köstatus men inget ljud/video. Det generiska
`chat_failed` är inte en verifierad specifik providerfelkod. Full visuell
läppsynk och faktisk hörbar röst återstår.

### Avvecklat och kvarvarande gränser

Vakten stängde 19:08:12.872. Oberoende kontroll 19:08:51.924 gav
endpoint/template 404 och tom workerlista. Astrid
`zsudl8tmzcmiv1`/`cadh7uwzv6` var oförändrad min0/max1. Dragan sparades OFF
(Neon state `preparation`); sessionen är terminal och släppt. Webbläsarens
mätinstrumentering är återställd och spelchatten lämnas ifred.

Render-cleanup är sparad och återläst: `CROUPIER_MOVING_SPEECH_ENABLED=0`,
`CROUPIER_MOVING_SPEECH_ENDPOINT_ID` borttagen, med **Save only**. Nästa
ordinarie deploy måste applicera detta i den körande processen; det påstås
inte redan vara gjort. Profil OFF och borttagen endpoint stoppar fortsatt
provtrafik under tiden. Lokal Dragan-runtimeprofil är också OFF utan gammal
endpoint. Inga nycklar, banker eller andra profiler kopierades mellan miljöer.
Mergeagenten har fått clean STOP och HOLD RELEASE för #223; #222 får följa
efter detta uppdaterade dokumentkvitto. Nytt prov kräver ett nytt samordnat
fönster efter verifierad versionsparitet, inte återanvändning av stängd journal.

Jakob höjde det sammanlagda taket till **15 USD** med sitt direkta +5-besked.
Kostnadsavläsning 19:17:26.924: rapporterat totalt **0,36202446 USD**;
senaste endpointens debitering saknas ännu och kan släpa. Fulla försiktiga
reserver **11,73666667 USD** behålls; kvar inom taket **2,90130887 USD**.
Detta är tillgängligt efter reserver, inte saldot i RunPods betalningskonto.
Neons taljournal har separat tak 4,80 USD: fyra reservationer om 1,20 USD
är bokförda och noll sessioner är öppna. Den gränsen är alltså nådd;
historik får inte nollställas eller byta budget-ID för att släppa igenom ett
nytt jobb. Eventuellt framtida prov måste först lösa båda budgetgränserna.

### Tidigare prov och återupptagning

Föregående endpoint `8pfjenuipsz355`/template `1a9glcfe5u` är också borttagna.
Där startade SDK efter cirka 85 sekunder, men förvärmning före reservation
stred mot `reserveGpu`-kravet workers/busy/available = 0. Ingen ny session
eller jobb kom igenom. Det exakta förlorade responsfelet är inte återhämtat.
Den ordningen ska inte upprepas. Miljökontrollen har inte visat felriktad
Neon-anslutning; verkliga gamla endpoint-/nyckelfel är redan korrigerade.

Nästa agent ska först skilja cachade/avslutade workerposter från faktisk
kapacitet med providertelemetri och testa guarden offline. Därefter behövs
samordnad deploy, verifierad budget och ett enda avgränsat talprov med
hörbart ljud och full läppsynk innan arbetet kan kallas klart. Inget sådant
nytt prov ingår i denna stoppade leverans.

Privata kvitton och körskript finns under
`C:/Users/jakem/.codex/visualizations/2026/10/17/01a14afa-f423-7011-bbdf-30a7f44609d1/`:
`queued-final-receipt.json`, `queued-independent-stop.json`,
`queued-journal.json`, `queued-chat-final.json`, `queued-worker-system-log.txt`,
`queue-guard-tests.log`, `run-queued-guard.mjs` och `env-audit-local.json`.
Originalkonversationer, media och privata provdata ligger utanför Git.
Dokumentbranch: `codex/dragan-env-admission-handoff`, PR222, i
`C:/Users/jakem/.codex/worktrees/dragan-admission-diagnosis/croupier`.
Föregående lipsync-worktree finns inte längre på sin gamla sökväg.
Miljöläsordning och verifieringsgränser finns i
[ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).
GitGuardian på läst main: queued suite, ingen incident-API-täckning;
ingen ny heltäckande säkerhetsacceptans påstås.

## Dragan: överlämning efter molnprov — 17 oktober 2026, 17:35 UTC

**Läget:** kod, image, bank och separat testrum är levererade. Dynamisk
OpenClaw-text fungerar. Tre molnprov med tal nådde RunPods kö men ingen
worker startade före tidsgränsen, även med den nya callbackfristen 450 s.
Ett separat uppstartsprov har verifierat
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
PR213 är mergad och rättningen fanns i provets frysta main
`5c56890b81317f3aed8b2cf5031d2ef35c79c58f` (även PR216).
Mergagentens driftkvitto: main-CI `39052704936` SUCCESS, Vercel
`dpl_Dj4f2a84MjzDNvCcivYy9WEzu3Te` READY med rätt www-version,
Render `dep-db9qrqe7bikc73e10ib0` LIVE med exakt SHA och health200.

### Senaste idle-prov och nästa agents startpunkt

Ett enda bordschattmeddelande skickades 17:25:50 UTC: ”Säg på svenska:
Jakob är kung och välkommen till bordet.” Bordet visade noll insatser.
Request `f21c9ad0-d433-4bfb-a31c-81eea6ce9f6d` nådde RunPod-jobb
`610e1e07-ef86-4983-8ae9-276fa7c915b8-e2`. Endpointen
`8juxxrre7whpjc`, template `l7pp8ray6x`, hade verifierat min0/max1,
A40/A6000, CUDA12.8 och samma image/release som uppstartsprovet.
Jobbet stannade i kö; provider visade noll workers och ingen exekvering.
Spelaren fick timeout efter 458 682 ms, med noll ljudfiler och videorutor.
RunPods UI bekräftade `Cancelled`, kötid 7 min 30 s, utan worker.

Draganprofilen sparades avstängd igen. Ägarbunden stoppfil avslutade guarden
efter 589,554 s; processen rapporterade stängd endpoint/template och exit0.
Slutkvittot för oberoende återläsning och kumulativ budget finns privat i
`moving-cloud-stop-receipt-v4-idle-chat-20261017.json` under katalogen nedan.
Ingen ny talgeneration eller ändring av Astrid/originalmedia gjordes efteråt.

Jakob bad om överlämning om provet inte snart lyckades. **Starta inte ett
fjärde identiskt min0-prov.** Ingen kod för en ny uppvärmningsövergång har
skrivits. Nästa avgränsade undersökning är varför köjobbet inte tilldelas en
worker. QUEUE_DELAY4 är dokumenterad standard; ett konfigurationsfel eller
kapacitetsbrist är inte fastställt. Den fungerande min1-diagnostiken ger ett
rimligt spår: verifierad uppvärmning på samma endpoint, sedan en kontrollerad
övergång till min0 före chatt. Nuvarande guard låser sitt läge och produktens
adapter nekar min1. En sådan övergång kräver först en liten testad ändring
med oförändrad deadline, kostnadsreservation, image/releasekontroll och
säker avveckling. En ny endpoint får inte antas ärva en annans cache.

Den beställda GPT-granskningen läste samma fullständiga main via GitHub.
Ingen ny blockerande koddefekt påvisades. Bekräftad kodgräns: handlerns 180 s
omfattar bankhämtning, hashning, modell-/motorstart, uppvärmning och själva
talet. Callback sker efter dessa förberedelser. SDK-bannern bevisar därför
inte talberedskap. TTS och spelarbiljetten startar först efter workerberedskap.
För nästa försök behövs säkra tidsstämplar per fas; ingen callback-token,
nyckel eller signerad URL får hamna i loggen. Synkron verifiering kan fördröja
lokal asyncio-cancellation; någon sådan överträdelse är inte observerad här.
Imageoptimering av modellagrets cache/byggsteg är ett senare förslag, inte
en förklaring till att ingen worker alls skapades. Modellkvaliteten ändras inte.

Privat operativ fortsättning: `dragan-resume-checkpoint-20261017.json` i
`C:/Users/jakem/.codex/visualizations/2026/10/16/01a14685-3cb7-7020-8f18-414e8bbbd5fe/`.
Där finns journaler, budget, bankmanifest, lokal fungerande videodemonstration
och `dragan-cloud-idle-20261017-1725/receipt.json`. Läs checkpointens aktuella
slutstatus före nya provideranrop; gamla runtime-bindningar pekar på borttagna
testendpoints. Återanvänd inte dem utan färsk verifiering.

Arbetsytan är sidoworktreet
`C:/Users/jakem/.codex/worktrees/dragan-lipsync-registry-3518/croupier`.
Huvudcheckouten har annat aktivt arbete och ska inte återställas eller dras
fram generellt. PR216:s tre agent-talk-filer installerades där selektivt;
40 gamla pingar och andras claims bevarades, fem fokuserade tester passerade.
Mergagenten äger merge/drift; HUVUDAGENT2 äger övrig reporensning.

Bevara Astrid, nycklar och originalens ID/hash/bytes. Jakob tillät Emils
motsvarande metod under villkor att den faktiskt är vad ZIP-exporten bygger
på. Tillåtelsen omfattar därför endast källverifierad, bildrutebunden dynamisk
ansiktskomposition från denna export i den här integrationen. Bevara
proveniensen; detta är varken en generell ändring av regeln om påklistrade
munöverlägg eller en visuell kvalitetsacceptans.
Dragan använder egen bank från sina exakta källor, inte Paows greenscreenbank.
Talet kommer från OpenClaws nya text; förinspelade repliker behåller eget ljud.
Tal under utdelning till box3 är uttryckligen uppskjutet. Full import/namnstädning,
osäkra legacy-env och Astrids tjänst ska inte rensas före verifierad ersättning.

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

C2l-a/C2k integration: `7dd2579` passerade ordinarie hook 333/333 utan skips
efter eget omonterat Studio-produktionsbygge (80 traces, 72 sanerade poster)
och riktiga BUILD_ID/startprov. Egna låsta klient-/webinstallationer kompletterar
Lab-junctionen; inga manifest eller lås ändrades. C2j `15870a7d57913e715cf4a3ba0490d1f622556f1c`
integreras därefter utan commit: fem konflikter förenar C2l:s appkompositioner,
C2k:s sociala policy och C2j:s neutrala SQL-/operator-/saved-game-ägare.
Kontroller och mergecommit för den senaste föreningen återstår.

## Etapp 3 C2l-b: presentation och idle — lokalt 17 oktober 2026

Efter C2k-merge `7dd2579` (333/333 och eget Studio-bygge) och C2j-merge
`d329bf06` (964 pass, 0 fail, 8 befintliga opt-in, frontendtyper gröna)
kopplar Studio och game sina egna urvalskompositioner till samma neutrala
relay-/idle-kärna. Director/model, settingsläsare, register, clock/fetch är
explicita; per-request frozen-register, cacheScope, fingerprint, TTL, rate-
/concurrencygränser, signaler och post-await-kontroller bevaras.
Studio behåller HTTP, filpolicy och Symbol.for-singleton; game behåller lazy
API-instansen. Den ersatta Lab-modulen för game-only idle-regler är borttagen.

Rena probe-fixtures och deklarationen har en gemensam contracts-ägare eftersom
Studio-editor också använder dem. Samtliga sju konsumenter och befintliga
fixture-/QA-listor följer flytten; inga nya publika URL:er, testfiler eller
generated-speech/provider-/miljöändringar görs. Åtta mekaniska jämförelser
passerar; 162 relativa imports har befintliga mål. Relay, idlevalidering,
katalog, cache/rate/deadline-/avbrottskroppar och Studio-settings/HTTP/singleton
är identiska bortsett från namngivna portar/indrag.

Node 24.21.0, fyra workers: 241 befintliga riktade prov passerar utan skips,
inklusive båda appkompositionerna, frozen/current, relay/idle, social/companion,
probe och samtliga sex serverfixturekonsumenter. Studio-typecheck passerar;
testinventering 512 kandidater, 0 orphans, 9 befintliga klassningar. C2l-b är
lokalt färdig och parentgranskad; levereras via ordinarie commit-hook. Ingen fullbuild behövdes för denna del.
Samlad integration, aktuell transport/PR213 och C2l-c återstår.

## Senare dataintegration — C2h, C2g och C2j

C2h leveransförberedelse: C2g `c53b27b7` integrerades normalt i
`a515539f` som `cd30e022`. Två rutinkonflikter förenade handoffen och
routingens nya importdjup. 21 kärn-/adapter-/routingfiler är identiska med
sina granskade heads; PR213:s nio produktfiler är oförändrade mot C2h-basen,
inklusive C2h:s appägda Blob-import. Ordinarie hook gav 317 pass, 0 fail
och ett befintligt browser-opt-in; frontendtypkontrollen passerade.

Slutg `ec16b705899ec880eb3dd571361f517be4ef10c1` tas därefter in med
normal merge och enbart dokumentdiff. Den inkluderar main
`05cbc22de9c6637cb9ea642c6f697a093dae42af` (PR214/PR213). Inga lås,
beroendeinstallationer, junctionmål eller produktbeteenden ändrades här.
Inget nytt fullbygge, push, PR eller driftkvitto ingår i denna förberedelse.

Samlad data-integration: ordinarie hook 486 pass, 0 fail, 1 befintlig browser-opt-in samt gröna frontendtyper. Den isolerade QA-källistan är unik och dess befintliga prov passerar 6/6. PR218:s slutfix är integrerad; flyttad branding pekar på packages/operators/contracts/branding.mjs. Kod-PR, CI och drift för datadelen återstår. Main223/222 på 908beb4d542b62ccc1d40243bf546783b6f563a0 är nu konfliktfritt integrerad: tre byteidentiska PR223-filer och två dokument från PR222. Data-kropparna är oförändrade mot förgranskade 0668d668. Den befintliga ofiltrerade middleware-/byggkontrollen omfattar även datadelens nya publika game-lanes-modul och dess redan registrerade beroenden.
PR218:s katalog/navigation har integrerat main217 9b79902c20b55d0e8ff21d6ee60def04f978342c normalt efter lipsync2:s CLEAN STOP/HOLD RELEASE. Main215:s inboxfix och samtliga handoffavsnitt bevaras. Produktkoden och QA-dubblettfixen är oförändrade från head4542f5f779c5febacb12128b529411be8e080cb6, som GPT läst i GitHub utan styrkt blockerare och CI39056360556 godkänt. Senaste integrationshead inväntar eget CI-/driftkvitto hos mergagenten.
