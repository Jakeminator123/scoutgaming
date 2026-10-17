# Aktuell handoff — Scoutgaming

Uppdaterad 17 oktober 2026. Etapp 1 är levererad i PR200 och etapp 2 i
PR202+204. Senaste strukturkvittot gäller main
`502bea812d4e8597f4951c85ae712bd338b02a1d`; etapp 3 levereras i avgränsade delar.
Teknisk migrationsstatus och kvarvarande produktarbete finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md). Användarsteg finns i
[lab/docs/README](../lab/docs/README.md); ingen ny tracker skapas.

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

Den publika katalogadaptern använder fortfarande frontendens `player-lobby`
och `player-operator`; detta är en namngiven ägarskapsrest för nästa kontraktdel.
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

## Dragan: OpenClaw till gemensam spelare — 17 oktober 2026

PR199 är mergad på `8b60984844075b344e6cc33147956b0f31b0d691`.
Mergeagentens kvitto anger grön main-CI, Vercel READY och Render LIVE på
samma SHA; Render-versionen kontrollerades även av talagenten. Migration013
tillämpades och återlästes 12:46 UTC i `croupier_game`, branch
`br-flat-fog-b161a6r8`, scope `production/croupier`. Tidigare versionskrav
och originaldata ändrades inte.

Det separata bolaget `dragan-test` har nu publicerat paketversion 1 och rummet
`room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2` (Dragan · dynamiskt taltest).
Spelvyn visar Dragan, Lounge-varm och Oak. Ett riktigt textmeddelande i
bordschatten gav ett nytt OpenClaw-svar på svenska. Spelet visade samtidigt
att Dragans röstvideo saknas: dynamisk text är verifierad, röst/läppsynk i
molnspelet är ännu inte verifierad. Inga gamla bolag återöppnades, inga
insatser lades av agenten och ingen användarplånbok ändrades för provet.

Testrummets paketversion 2 publicerades därefter via Admin: endast den egna
mallens Desktop/Bord lodrätt ändrades från 35 till 31 procent. Mallen har ett
enda kopplat rum. Vid 1280×720 överlappade tre insatsytor nederpanelen;
efter publicering och omladdning är varningen borta. Bredd, kortankare och
mobilvärden behölls. Det är en layoutkontroll utan spel eller läppsynksprov.

Den publicerade workern är låst till image-digest
`56b779142cad6d3c0152f53942f6703a0b6f6e74a6b7110c1ea34f69facc3b34`.
Fem separata RunPod-skapandeförsök stängdes och verifierades borttagna utan
taljobb. REST-skapande med max0 gav max3; GraphQL-skapande gav däremot rätt
max0. API:ets utelämnade tomma workerlista och förkortade templatesvar
behöver styrkas med separata färska läsningar. Försöken är inte en fungerande
driftkonfiguration. Kostnadsunderlaget behåller reserver för fördröjd
fakturering. Den 17 oktober 13:18 UTC var känd kostnad 0,169812463 USD,
reserver 3,11 USD och återstående bevakat försök högst 480 sekunder plus
120 sekunders stoppmarginal vid konservativa 10 USD/timme. Totalen är
4,94647913 USD; ett nytt försök kräver en ny avstämning av samma journaler.
Ett sjätte försök verifierade 13:20 UTC endpoint `h56jnnyo5aq4om` med max0,
noll workers och exakt image. Jakob godkände den nya begränsade runtime-
nyckeln; den skapades och sparades i en ny gitignorerad lokal fil. Läsprov
13:25 UTC gav 200 för endpoint, full template och health med noll workers.
Nyckeln får endast skicka jobb till denna endpoint. De åtta nya Render-
variablerna är sparade med **Save only** och återlästa med exakt värde;
inga befintliga nycklar redigerades. PR201 har head
`84050e6317004750c20b76cff1deb599f89da1ce`, mergad enligt mergeagentens
kvitto på `67ddb82a40db3c4347dd51734227afc8af531527`. Samma agents efterföljande
kvitto bekräftar grön main-CI, Vercel READY och Render LIVE med exakt denna SHA.
PR202 är sedan mergad på `f16b5eac5838d424c5e9fafe804f5024a809af62` och
konfliktfritt integrerad i rörelsefortsättningen PR203. Dess deploy och PR203:s
egen granskning/deploy ska bli klara före det bevakade GPU-provet.
CI:s kvarvarande bundled-schema-assertion är rättad i en separat commit;
dess 13 fokuserade prov passerade. Efter kontobytet verifierades 13:50 UTC
samma endpoint, template och image, max0 och noll workers. Render visar
`CROUPIER_DEALER_SPEECH_PROFILES=1`; inga befintliga värden ändrades.
Draganprofilen och GPU:n är fortfarande avstängda. Verkligt end-to-end-prov
återstår inom samma 5 USD.

Den första fortsättnings-PR:n gör 013 obligatorisk och verifierar RunPods
fullständiga template separat från dess förkortade embedded-svar. Saknad
workerlista godtas endast efter ett färskt tomt pods-svar för exakt endpoint.
Explicit konflikt eller okänt svar stoppar före jobb. 74 schema-/importprov
och 45 RunPod-/transportprov är gröna enligt underagentens körningar; den
privata provisionerns 45 prov är separata från produktens molnacceptans.
Ordinarie commitkontroll passerade 84 fokuserade prov.

PR191 är mergad på `f5f8414628e39fee4cbf703054c0ee57d2b48157`.
Mergeagentens separata kvitto bekräftar grön main-CI och samma commit på
Vercel och Render. Fortsättningen på `codex/dragan-openclaw-cloud` ersätter
[PR195](https://github.com/Jakeminator123/scoutgaming/pull/195) med en samlad
commit utan de syntetiska testadresserna i dess historik. Ingen force-push,
ändrad skanner eller ändrad incidentstatus används. PR194 är separat levererad på `9f8a3aff`;
Admin-agentens kvitto anger samma SHA i grön main-CI, Vercel och Render.

Den nya, uttryckligen avstängda talvägen binder OpenClaws exakta text till
Dragan-profilen, publicerat media, en verifierad avatarbank och ett enda
RunPod-jobb. Migration013 tillför bestående mediereferenser och ett totalt
testtak. TTS får starta först efter accepterat jobb och verifierad worker.
Privata bankfiler hämtas med kortlivade exakta behörigheter till workerns
tillfälliga cache. Originalfilmer och Astrids endpoint ändras inte.

Spelaradaptern använder vilans uttryckliga källruta mellan kortsekvenser;
ljudklockan och verifierade ansiktsrutor följer samma plan. Kredit och
chunk-kvittens begränsar buffertar hela vägen till workern. Den separata
fortsättningen på `codex/dragan-deal-speech` lägger till **Svara under nästa utdelning**:
en färsk serverbestämd öppning
reserveras en gång, och exakt kroppsruta, ansiktsruta och kortkontakt följer
ljudklockan. Vanlig chatt behåller vilovägen. Kodprov och verklig molnacceptans
redovisas separat; funktionen är ännu inte verifierad med Dragan i spelet.

Underagentens fokuserade verifiering passerade 123 prov utan skips, inklusive
riktig Chrome med fyra syntetiska källfilmer över 183 rutor, kort ljud/tyst
avslut, avbrott, HTTP/WebSocket, filmsekvenser och Astrids befintliga spelare.
Oberoende review hittade och verifierade rättningar för glesa spelarplatser
(bara box 3) och avstängt ljud vid reservation. Provet med originalens
1080p-filmer stannade först vid bildruta 13 före ljudstart: avkodarens
ytor hölls kvar i VideoFrame-bufferten. Rättningen läser exakta AVC/MP4-
samples med WebCodecs och kopierar avkodade ytor till en buffert på högst
24 rutor. Underagentens 27 fokuserade prov inklusive två Chrome-fixturer
passerar. Originalkedjans 183 samplepositioner, storlekar, tidsstämplar och
keyframe-flaggor matchar oberoende ffprobe. Prefetch tog 386 ms; inga
buffertunderskott uppstod. RAF visade 180 distinkta rutor, slutruta 182 och
högst två rutors hopp. Detta verifierar avkodning och källa, inte att varje
ruta visats eller att läppsynken är visuellt/hörbart accepterad.

PR203:s slutreview reproducerade två fel: en ogiltigförklarad reservation
kunde passera under en väntande kontextläsning, och nästa MP4 kunde hämtas
för sent. Sista synkrona kontrollen efter alla läsningar samt aktivt avbrott
vid ny spelversion stoppar även en worker som hänger mellan chunks. Alla
använda komprimerade filmer hämtas och hashverifieras före ljudstart inom
96 MiB; avkodningen behåller högst 24 rutor. Underagentens fördröjda
originalprov (700 ms) gav 849 ms startbuffring, noll underskott och alla
183 källindex avkodade; RAF visade 182 distinkta index. Det är inte ett
tal-/läppsynksgodkännande. Spelarens verkliga startkvitto använder nu det
befintliga diagnoskontraktet efter lyckad `audio.play`; `reviewStatus` är
fortsatt `pending`. PR204:s testfix är integrerad från `502bea81`.

OpenClaws intermittenta CI-fixtur är reproducerad: katalog-I/O kan lagligt
förbruka hela dess 10 ms-budget före första provideranrop. Provets egen
klocka är nu kontrollerad så att det faktiskt testar en långsam provider;
produktionskod och tidsgräns ändras inte. Färdiga lokala prov ersätter inte
PR203:s CI-, merge-, drift- och GPU-kvitton.

Mergeagentens oberoende Chrome-körning hittade därefter ett sporadiskt fel
i vilobildens HTML-videoavläsning. Fördröjd callback (180 ms) kunde både
missa vald ruta och kopiera senare pixlar trots metadata för rätt ruta.
Viloladdaren återanvänder nu den exakta MP4/WebCodecs-avkodaren med en enda
vald bildruta och fristående canvas. Ett särskiljande färgprov för ruta 7
respektive 8 och båda Chrome-fixturerna passerar enligt underagentens 33 prov.
Formatgränserna är desamma som för kroppen; ingen tidsmässig tolerans införs.

Klippbibliotekets namnnormalisering är inte applicerad. Den skrivfria
importplanen och namnförslaget bevarar tidigare UUID/hashar, original och
visningsnamn. `docs/storage/BLOB-NEON.md` beskriver granskning och återstående
applicering. Kevins källnamn är proveniens; runtime väljer verifierad funktion,
pose, språk och exakta referenser. Gamla namn i Admin är därför inte bevis
på att gamla filer ersatts eller att hela Kevin-banken importerats.

Migration013 görs obligatorisk i samma fortsättning, eftersom dess
produktionsinstallation nu är verifierad. Saknad 013 ska blockera readiness,
serverstart och import; framtida uttryckligen valfria versioner stöds fortsatt.

Fokuserade kontroller omfattar riktiga HTTP/WebSocket-förlopp och Chrome/
WebCodecs med syntetiska medier, återkallad ägare/profil/publicering,
engångsbiljetter, kostnadsgräns, avbrott och workerprotokoll. Dessa är inte
visuell acceptans av Dragan. Isolerad PostgreSQL/HTTPS är verifierad lokalt
med riktig temporär databas, omstart, autentisering, CAS och taljournaler.
Runtime-konfiguration och ett verkligt OpenClaw/GPU/spelarprov återstår före
talaktivering. Första tidigare GPU-provet är fakturerat till 0,169812463 USD;
taljournalens egna tak är 4,80 USD, men ger inte ytterligare budget utöver
Jakobs sammanlagda 5 USD inklusive tidigare prov och infrastrukturreserver.
Jakob har valt ett separat Dragan-testrum. Bolaget `dragan-test` har skapats
genom N1 den 17 oktober, utan medlemskonton. Dess egna sammansättning
`dragan-separat-taltest-413cea16-014d-4625-a613-4c6eeb5f693c` är sparat genom
Admin och återläst i Neon: endast Dragan, Lounge-varm-video och Oak-bord,
med referenspaketets mobil-/desktopgeometri och 22 kort-/cirkelpunkter.
Rummet är publicerat enligt kvittot ovan; pausade operatörer ska inte öppnas. Den separata avatarbanken är
uppladdad i privat Blob och dess tre filer fullständigt hashverifierade.
Detta är beredningsunderlag, inte ett godkänt moln- eller läppsynksprov.

PR196 ersätter PR195. CI hittade testväntan, miljöregister och äldre
versionslistor som inte accepterade uttryckligen valfria migrationer.
Render och native-runtime använder nu samma verifierade migrationsplan;
krav på obligatoriska versioner och kontrollsummor kvarstår. 53 fokustester
och hela isolerade SQL/HTTPS-körningen passerade på Node24.21.0 den 17 oktober.
Det intermittenta låstestet återgavs därefter på PostgreSQL16.15 och rättades
att läsa exakt väntande lås i stället för transaktionens frysta aktivitetssnapshot.
Full SQL/HTTPS passerar även med avsiktligt föråldrad aktivitetssnapshot;
låsordning och avvisning efter väntande medieborttagning kontrolleras fortsatt.
PR196:s fulla CI, imagekontroll och GitGuardian passerade på `df532b51`;
PR196 mergades till `9a644e73`. Vercels produktionsbygge stoppade därefter:
ett frontendtest importerade backendworkerns `ws`-beroende, som frontendens
separata installation saknar. Callback-testet har flyttats oförändrat till
rotens registrerade integrationssvit. Fyra frontendtester och hela callback-
testet passerar. En isolerad kopia med enbart frontendens beroenden återger
felet före flytten och passerar efter den; runtime och dependencies ändras inte.
PR199 löste frontendens beroendegräns; drifts- och migrationskvittot står ovan.
Workern väntar nu högst 60 sekunder på start efter verifierad bind, så att
TTS (30 sekunder) och spelarens anslutning (15 sekunder) ryms. Övriga
idle-/kvittensgränser på 15 sekunder och jobbets totalgräns på 180 sekunder
är oförändrade. 49 CPU-tester passerar; den nya förseglade releasen är
`57376d50620f75ad0c546742787f5885117ec3801e2d2ebcc7a19874da1966e8`.
Två GitGuardian-fynd på det tidigare
huvudet avsåg syntetiska PostgreSQL-testadresser. Fixturen skapar nu ett
tillfälligt lösenord; ingen befintlig nyckel eller incidentstatus ändras.
Den nya publiceringsprojektionen utelämnar endast inspelningar med status
`pending` ur nya frysta spelpaket och behåller utkast, register och
revisionskontroller. Originalfilmer och medie-ID:n bevaras även vid omdöpning.

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
