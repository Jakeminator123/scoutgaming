# Croupier: aktuell källa, drift och leverans

Arbeta i `C:\Users\jakem\Projects\croupier`, på `main` i det privata
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work).
`main` är enda leveransbranch på GitHub och standardbranch sedan 2 oktober 2026.
Vercels produktionsbranch och fyra befintliga Render-kopplingar är `main`.
Produktens Render-autodeploy är `checksPass`; övriga tre är fortsatt `off`.
GitLab-inbox, wiki och spegelpush är pausade; återskapa inte gammal inbox.
`Jakobs-v1` bevarar commit `600093e4522efc57bd82979cff65492a528ffeb7`.
Ignorerade privata data ingår inte i Git-taggen.

**Aktuellt genomförandeuppdrag, 4 oktober:** Jakob har uttryckligen beställt
slutföring inklusive AI/GPU, produktionsdataflytt/omkoppling och avveckling,
med QA bevarad. Lokala taskbrancher/worktrees är nu tillåtna för de sex
arbetsområdena; originalcheckouten behåller main och endast merge-agenten
integrerar och pushar main via `tools/push-github-work.mjs`. Detta supersederar
äldre branchförbud och villkor om ett ännu saknat genomförandeuppdrag här.

**Avgränsat acceptansundantag:** exakta Cartesia-/counting-priser är backlog.
Funktionstest får använda dokumenterat okänd kostnad och mätt usage inom
befintliga numeriska reservationer och dispatchgränser. Okänd USD är aldrig
noll eller verifierad. Ingen ny budget, återbetalning eller journalreset;
ägar-, idempotens-, lease-, cancel-/terminal- och dubbeljobbsskydd består.
Tidigare tariffstopp nedan gäller därför inte dessa avgränsade funktionstester.

**Verifierad slutkod 18:16 UTC:** P7 och fysisk P8 är genomförda på `9ba2fd05`,
med full pre-commit och tre CI PASS. Frontend/Studio READY och samtliga 17 alias
kontrollerade; projektinställningar och historiska mål är bevarade. Render
`dep-db198qrm8hqs73dpj27g` är LIVE utan CROOT med befintlig TLS verify-full.
Slutparitet PASS: 32 konto-/speltabeller, elva journaler, tre dokument,
18 aktiva plus sex behållna medieposter och gamla Blob-referenser0.
Produktdisk DELETE204/GET404 och service.disk saknas. Tolv ersatta Blob-objekt
är borttagna: faktisk gamla-lista0 och ersättningar12. Explicit restart200 gav
verifierad ny appprocess, 160 källhashar, åtta avvecklade runtimefiler,
AI3/Neon ON, health200 och ingen `/var/data` eller persistent produktmount.
Backupen bevaras. QA:s tre tjänster kör `7c4c1cc`, faktiska
LIVE/READY, SDK/källa och aktuella 10/10 bevarande PASS med OFF37.
Äldre 42→37-övergångs ephemära närvarorader 19→18 är en dokumenterad
bevislucka; originalets compose=false består. Inga nya providerjobb.
Kvitton: diskfri runtime `6cf5030f…`, data/HTTP `4615366b…`, faktisk postdelete-
omstart `bf582b0b…`, i befintliga privata P8-kvitton och operatörsjournal.
Parentens processmiljö är direkt oläsbar (Linux EACCES efter UID-byte);
konfigurationen binds i stället av faktisk barnprocess/källa och stabila
deploy-/envavläsningar. Ingen direkt parent-envavläsning påstås.
Efterföljande guide-/namnregisterleverans ändrar inga runtimebytes eller driftvärden.

**Historisk P8-checkpoint, 4 oktober 17:26 UTC:** `1fb2307` är publicerad med tre CI PASS och
Vercels frontend/Studio READY. Produkt och QA behåller b0bc efter misslyckad
containerstart. Befintliga tal-QA-handlaren bevisar anonym HTTP403; de två
startproven krävde felaktigt 401. Förväntningarna rättas och det befintliga
launch-testet använder den verkliga handlaren, 10/10 PASS. Ingen auth-, data-
eller providerpolicy ändras. Produktdisken och tolv gamla Blob-objekt behålls
tills rättad release faktiskt är LIVE och slutkontrollerna passerat. QA OFF.
Undantaget ger inte allmän kostnadsapproval och ersätter inte aktuell
runtime-/AI-/GPU-/playbackacceptans, paritet eller verklig workerdränering.

**Historisk P8-checkpoint 17:49 UTC:** `7c4c1cc` har tre CI PASS och är faktiskt LIVE
på produktens Render med käll-/AI-/Neon-/healthkontroll PASS. Vercel är READY
och alla 17 granskade/historiska alias PASS. Första start utan gammal diskväg
misslyckades på entrypointens för snäva TLS-villkor: originalanslutningen är
`verify-full`, villkoret accepterade bara `require`. Koden rättas till samma
säkra lägen som Postgres-valideraren; anslutning/nycklar försvagas inte.
51 produkt-envvärden bevaras efter borttagen CROOT. Produktdisk och tolv gamla
Blob-objekt finns kvar; full extern arkivhash PASS. QA Render/source/SDK och
10/10 bevarandekontroller PASS på `7c4c1cc` med OFF37.

Historisk checkpoint 17:14 UTC: main var publicerad på
`b0bc581442641d0fc9c1c161de029a60adb52929`; CI `37210290007` har tre PASS.
Normal GPU-stängning väntar nu högst 15 sekunder på samma jobbs naturliga
slutstatus före eventuell engångscancel. Riktade 30/30 och full regression PASS.
Alla tre QA-tjänster kör nu exakt b0bc: Render LIVE
`dep-db16i5favr4c73agms1g`, frontend/Studio READY och alias återbundna.
10/10 bevarandekontroller, faktisk Linux-källa/SDK och OFF42 verifierade;
three-ready SHA256 `b2ade7330fdf2d026c3cba6be1174c9dd89dc171ed44b9b54e9420624a4704af`.
Inget nytt genereringsfönster öppnas.

P7:s faktiska admission är sparad/granskad som SHA256
`77eccc3a1ca99bca328f2abec8e11d4d37ec62b3797a2a7b25aea1c616b751c1`;
cloudplan `25fe34d42251b1f57de6ff0ae7505459c0448c6d0ba500646aa7281a9115c59d`
och BEFORE är verkliga. Underhållsdeployment `dep-db16rv0u01pc73d442p0` är
LIVE och verifierad childless efter en verifierad Docker-default-CMD-rättning
i privat hjälpare. Endpointen är tillfälligt Max 0/Active 0/FlashBoot OFF och
faktisk avläsning visar alla worker- och jobbfält 0. Ursprungligt Max 1 och
FlashBoot ON återställs före provideraktivering. Fryst export och oberoende
GET-dränering och slutvalidering PASS. Rootgranskad importplan `94a458599f0c77ca8aaf468feccf4cc7d5e1e050f2f31662be8740796cde7442`
är slutförd: importkvitto `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d`,
Studio 001–004, tre dokument, sex behållna medieposter, 18 aktiva medier och
talhistorik. Alla 32 befintliga konto-/speltabeller är exakt oförändrade.
Faktisk fristående runtimeparitet är PASS: 32 skyddade tabeller, 11
kostnadstabeller, tre dokument och 18 aktiva plus sex behållna medieposter.
Gemensam Neon-runtime är LIVE på Render `dep-db17ojvavr4c73alutjg`, exakt b0bc.
Produktionsalias är faktiskt omkopplade och samtliga 17 granskade/historiska
pekare kontrollerade; historiska mål, domäninställningar och SSO bevarade.
GPU är återställd/återavläst till Max 1/Active 0/FlashBoot ON. Färsk
konto-/kostnadsavläsning PASS 17:09 UTC; produktens tre providerflaggor är
återställda ON och deployment dep-db18gfh42hec73eh9a60 skickad. Faktisk
LIVE/providerreadback PASS 17:12 UTC med health200 och gemensam Studio-policy. QA:s AI förblir OFF; fem gamla QA-sökvägar är borttagna
med exakt bevarade övriga 37 värden/disk/SDK/journaler.
Städreleasen `a43c0229` har passerat obligatoriska slutkontroller på lokal
releasebranch; P7:s providerreadback är PASS; nästa är publicering av städreleasen.
Ingen gammal resurs har raderats. Aliasoperatörens avgränsade återgång fortsatte
efter det ursprungliga femminuterskvittots giltighet; tiderna har inte skrivits
om och kontinuerlig TTL-acceptans påstås inte. Befintlig färsk konto-/kostnads-
och adoptionsavläsning före provideraktivering kvarstår.
Alla 206 gamla diskfiler är
säkerhetskopierade externt med full hash-/inventerings-/läsbarhetsverifiering,
kvitto `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
Ingen ny generering är gjord; providerstatus har lästs med GET.

cc77-fönstret `75eaf797-9342-4e2c-8995-f3c759fade75` gav synlig/hörbar
uppspelning till spelkö-END och därefter avläst provider HTTP200 CANCELLED.
Det är inget COMPLETED-providerkvitto. Agenternas tidigare krav på just den
statusen var tillagt utöver Jakobs krav på avslutad speluppspelning. Snäv
funktionell admission återanvänder verklig END, exakt completed SQL-request,
explicit browsercleanup efter END, terminal/released-jobb och OFF med oförändrade playback-/route-
bytes i b0bc samt riktade retirementprov. Naturligt b0bc-COMPLETED är fortfarande
inte liveverifierat och exakt provider-transitiontid saknas; faktisk ALL0-drain/
paritet före import består. Append-only
closed39/head `8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`,
usage4/5/2/4, unresolved0, refund0/USDnull. Två generationer återstår av sex.
Den gamla reservationspolicyn rymmer inte ytterligare1USD inom4.748848USD;
tak, reservationer och journal ändras därför inte. QA OFF verifierad på
`dep-db1687s9v7es73e56rv0`/cc77, exakt42 miljönycklar,
router404/health200 och lease0. Gamla journaler/reservationer/SDK bevaras.
P7:s import/policybyte och aliasbyte är genomförda; provideraktivering och
P8:s publicering/avveckling återstår. Egen Cartesia-nyckel finns i ignorerad rot-.env och autentiserar
HTTP200 med exakt Victoria-röst. Labs ignorerade `.env.local` har nu samma
egna nyckel med privat backup av föregående fil; övriga rader är bevarade.
Driftens nyckel är ännu inte bytt.
GitGuardian b0bc: commitmetadata komplett, suite queued/no run, incidents ej lästa.

**Tidigare verifierat läge, 4 oktober 13:41 UTC:** publicerad main och samtliga
tre QA-tjänster kör `c8747adca8c6fdff57a82946c0211585490e2ab2`. Produktens
Render-backend har autodeployerats till samma källa, men dataimport,
Studio-schema 001–004 och gemensamt policybyte är inte genomförda. Senaste
produktionsläsning visar samma 44 miljönyckelnamn och 132 källposter.

QA-fönster `ae25eaaa-0220-4d64-b9be-3a072f7feade` är säkert stängt som
record29/head `65751b1c4e321ed8a649cc3e7118f57fbae69431b09c363317349c61d933f2a8`.
Kumulativ usage är 3 generationer/4 SDK/1 TTS/3 GPU, refund0 och okänd/null
kostnad. Descriptor skapades, men bordets quiet-tillstånd ändrades under
AI-förberedelsen; GPU-jobbet avslutades CANCELLED före TTS och faktiskt
spel-END. QA är åter OFF, lease0, router404 och health200. Gamla journalposter,
reservationer, manifest och SDK är bevarade.

Lokal main `573b7aee` lägger till ett exakt read-only availability-kvitto och
använder samma predikat vid admission. 42 riktade prov, fyrdealer-audit och
obligatorisk fullhook passerar. Publicering och tre QA-deployer återstår innan
ett manuellt prov utan retry. Den privata closed29→nästa-success-kedjan är HOLD
tills fel installfil, partial-failure-close och exakta jobb-/session-/SQL-/
reservationsguards är rättade och peergranskade.

P7-paketet är offlineinstallerat med 60 PASS; receptets 32 pinnar är
peergranskade men livekörning är BLOCK tills ett nytt COMPLETED jobb med
synlig bild, hörbart ljud, spelkö-END och QA OFF finns. Efter det genomförs
drain/import/policybyte i ett 45–75 minuters skrivfönster. P8 `c158a0be` följt
av `f3f561d3` integreras först efter aktiv ersättning. GitGuardian har komplett
commitmetadata för c874, men suite är queued utan run och incident-API ej läst.

**Tidigare verifierat läge, 4 oktober 10:25 UTC:** publicerad main och QA:s
tre tjänster har faktisk `a0c6460560dd99da7bc33feba7efbef0d6de0fce`.
Klockrättning `f8300c51`, samlad hook 1 310 PASS/6 SKIP/0 FAIL och 29 riktade
PASS; oförändrat godkänt bygge återanvänt. CI `37173118418`: tre success-jobb.
QA-Render `dep-db12cjvavr4c739uglug` LIVE, frontend `dpl_3JyHvKZKvE3YVvFaUsfrZywhDSpZ`
och Studio `dpl_9YK14gYBvvY2PvoEwWoxBKpbwWmL` READY, alias faktiskt ombundna.
Nio publika Linux-källhashar matchar a0, 17 privata filer återställda och
SDK 7.12.1/2 962 filer bevarat. Exakt42 miljönycklar/AI-admin-P6 OFF/health200.
Spel-GET200 och Studio/admin-GET307 till login; inget nytt autentiserat spelprov.

QA-bevarande är **9/10**, inte full PASS: endast ephemära
`croupier_game.player_probe_sessions` ändrades 17→15. Oförändrad 24h-rensning
vid start kan förklara detta; borttagna raders `seen` saknas, så orsaken är
inte radvis verifierad. Övriga31 kontotabeller, cost12, volym/media/journaler
matchar. Ursprungligt FALSE-kvitto är orört; inget restore/SQL-ingrepp.
Treversionskvittot `8b138acb5d912dd28d12a07fdea11f8be1c714f9d6eba968923808747278c850`
registrerar den konkreta bevisluckan och ger ingen P7-acceptans.

Produktionsläsning10:14UTC: a0 LIVE `dep-db0s7u8ae00c73euejs0`,
44env/äldre policy/32tabeller75rader/18sessionskällor oförändrade.
Produktchecksumma+källslutning132PASS; Studio-schema saknas,001–004pending.
Produktionsimport, policybyte och fysisk P8 återstår.

Misslyckade8ba-fönstret gav descriptor men sexnyckligt ownerobjekt avvisades
före transport. Inget nytt bild/ljud/queue-END. Privat femfältsfix offlinegranskad;
publik QA-klockfix ±5s/monotona serverstämplar finns nu i drift.
Original13poster/reservationer bevarade; append-only closed21/head6cd7efa0
och cleanup-kvitto `d28a7f06f50c5ae77e6dcdccf3424c9d719d88e001e0d2b4450e49bccbad0bed`.
Usage2gen/3sdk/1tts/2gpu, refund0/USDnull; CANCELLED/released/lease0,
osäkra utfall0, providerjobb/kö/running0. Varm idle1/ready1 är inte ALL0.

**Ny uttrycklig testkvot:** Jakob höjde från två till SEX genereringar totalt.
Två använda, högst fyra kvar; root kör först ett manuellt omprov utan
automatisk retry. Äldre tvåtak och spärrtext nedan är historiska.
Minimal länkat-fönster-utbyggnad efter closed21 är integrerad lokalt som
`0750077c` från workercommit `8d97406c`, med samma gamla journaler,
reservationer och okända kostnad bevarade. Riktad suite är 44 PASS/0 FAIL;
workerfullhook är 1 300 PASS/5 SKIP/0 FAIL. Driftens a0 har ännu det äldre
kodtaket; `0750077c` måste publiceras och sättas på alla tre QA-tjänster före
ny installation eller något SDK-/TTS-/GPU-anrop.
Detta höjer inte verifierad monetär kostnad eller ger någon journalreset/refund.

**BO-historikens omfattning:** historiska BO-videor är tysta clippreviews,
inte lipsyncmaterial för spelet. Aktiva AI-talpaket har separat validerad
spelväg. Historikklipp ska därför inte ge ett lipsyncacceptanskrav i migrationen;
uttryckliga speech-QA-prov och aktiva talpaket behåller relevanta kontroller.

**Lab-lanes:** Jakob avser provade lanes som framtida produktionsalternativ.
Behåll befintlig editor, utkast, clippreviews, versionsskyddad gemensam policy
och samma speluppspelning; avveckla ersatt separat BO-uppspelning.
c158/f3 har granskats mot denna befintliga väg. f3 avvecklar lokal disksparning
och förutsätter rätt Neon-miljö. Nuvarande blackjack/fyra dealers och direkt
sparning av aktiv policy är verifierat stöd; separat lane-publicering, mobil-
lane, ny dealer och nytt spel är framtida arbete, inte levererad funktion.

Alla sex egna sibling-worktrees/brancher och den gemensamma absoluta tavlan
är verifierade; original main, core.bare=false/core.hooksPath=.githooks.
P8 `c158a0be`/`f3f561d3` är lokala utan integration eller fysisk borttagning.
GitGuardian repo-source verifierad:5IGNORED/0OPEN, en incident-/fem locationsidor,
locationsluckor37828691/37830671. GitHubGG queued/run saknas; globalAPI ejbevisad.
Återstår publicering av nya källspärren/uppspelningsprovet, verifierad admission+gemensamt
P7-drain/import/policybyte och sedan förberedd P8. Äldre avsnitt är historiska.

**Pågående integration:** Studio-/Git-rättningen integrerades som
`438a824b` från workercommit `c40503af` och ingår i levererad `5fca8983`. Studio följer
den konfigurerade speloriginens `/player-login` efter lösenordsreset och den
gemensamma speladresspolicyn vid partneröppning. Git-fixturer isolerar hookens
ärvda repo-/indexvariabler; huvudhooken läser fortfarande sitt riktiga
commit-index. Färskt worktree-Labbygge och obligatorisk fullhook passerade:
1 254 PASS, 5 SKIP, 0 FAIL. Första AI-paketet är lokalt integrerat som
`9ea65dba` från `123d3f1f`, med exakt samma Git-träd och fullhook 1 264 PASS,
5 SKIP, 0 FAIL. Det bevarar ursprunglig budget/journal och avgränsar provider-
dispatch. Följdfixen är nu lokalt integrerad som `1af6d491` från `7cf88ba6`,
med identiskt Git-träd och fullhook 1 268 PASS, 5 SKIP, 0 FAIL. Den binder
fullfilsreservation under streaming till verifierad bounded-QA-transport och
Neon-journal samt återställer fyra checksumförseglade privata SDK-filer före
Web-start. Docker förbereder endast de två privata katalogernas ägare/rättigheter.
Main är publicerad som `849bc9558348c9f42e6ee7c2fa6bc030c8339864`.
CI:s GPU-workerjobb passerade, men båda färska Lab-byggena stoppade på en
serverruntime-import från fullfilstjänsten. Den tidigare lokala Lab-körningen
föregick denna importändring och räcker inte för att godkänna den nya bygggrafen.
Rättningen är lokalt integrerad som `d8bbb8cd`, från workercommit `a00a2d34`.
Den interna transportregistreringen ligger i den delade fullfilstjänsten;
SDK-runtime registrerar sin verifieringscallback. Färskt Next-bygge med fyra
workers, tracekontroll, typkontroll, 47 riktade tester och fullhook passerade:
1 268 PASS, 5 SKIP, 0 FAIL. Alla källfiler utom de två root-trackerfilerna är
identiska med workerleveransen. Levererad main är nu
`5fca8983df75f2d6307473e20543b372c24bcfd9`, med GitHub-run `37165257568`
completed/success för alla tre jobb. Render-QA är LIVE och båda Vercel-QA
READY på samma SHA; befintliga alias är faktiskt bundna och återlästa.
Faktisk Linux-källa, 17 privata SDK-källfiler och SDK 7.12.1 är verifierade.
Alla tio före/efter-kontroller för miljö, disk, QA-volym, medier, journaler,
konton/saldo och kostnadstabeller passerade. Rootkvittot finns i befintlig
`lab/data/platform-private/native-p6-qa-release-e461ef07/`, namn
`migration-5fca8983df75f2d6307473e20543b372c24bcfd9-three-ready-receipt.json`,
SHA256 `0e03cf6bd5ddb8c8ffa7156fda22df99a165b8c2428c843aebef5d285e6abfe3`.
Produktionens tre tjänster kör också 5fca8983 med oförändrad gammal policy;
import/Neon-omkoppling återstår. AI-installern stoppade före budgettimer,
SQL/journaländring och provider-POST på saknade talnycklar i vald källa.
Automatisk approvalreview avvisade produktcredentials till QA utan specifikt
människogodkännande. Jakob har därefter direkt godkänt befintliga Cartesia-/
RunPod-nycklar för det tillfälliga isolerade QA-provet, högst två genereringar,
oförändrad produktenv och exakt QA-miljöåterställning. QA:s env-bärande deploy
`dep-db0qcnhsrm7s738o9ggg` är faktiskt LIVE med rätt 5fca-källa/manifest och
ursprunglig budgetchain. Förkontrollen hade noll generationer/SDK/TTS/GPU;
originaltimern löpte ut 4 oktober 01:28:59 UTC. En exponerad egen QA-session är
återkallad med riktad auth_epoch-CAS och exakt player-sessionborttagning;
övriga nio, kontodata/saldo och budget/journaler är bevarade. Helperns första
obetalt authprov stoppade före WebSocket-nätverk på lokal dependency-resolution,
inte ett verifierat produktfel. Korrigerat authprov passerade faktisk 401 för
ogiltig ticket med fortsatt noll generationer/SDK/TTS/GPU. P7 väntar faktisk
streamacceptans och dränering; faktisk fullfilsgenerering beskrivs nedan.
Lokala `.env` och `lab/.env.local` är också rättade enligt Jakob, med ursprunglig
Cartesia bevarad och rätt RunPod-/modellinställningar; endast privat lokal
konfiguration ändrades, ingen moln-/providerändring eller serverstart.
Produktionsförberedelsen har 80 PASS utan SKIP samt 87 importguards PASS;
förberedda adaptrar gör ingen import utan aktuella faktiska AI-/routekvitton,
fryst export, verklig workerdränering och verifierad kontoparitet.
AI/GPU är funktionellt delprovat i QA. Produktionsomkoppling och avveckling
återstår; borttagningar integreras efter verifierad ersättning.

**Faktiskt betalt delprov 4 oktober 01:21–01:23 UTC:** Director och talmodell
svarade; Cartesia gav ljud och RunPod ett färdigt fullfilspaket
`generated-bd1123e6caec51e8a232036547b0f8fc`. Kumulativ runtime/journal visar
1 generation, 2 SDK-anrop, 1 TTS och 1 GPU-submit, inga osäkra utfall och
ingen automatisk retry. Samma paket spelades klart två gånger enligt den
checksumfrysta helperns passerade game-queue-/audio-ended-kontroller. Exakta
per-play bildruteräknare och observationsrader hann inte sparas; de är okända
och påstås inte verifierade. Härlett bevis finns i befintlig
`verify-final-qa/fullfile-two-play-derived-attestation-8712e00b.json`.
Streamsteget stoppade före sitt andra `/chat`: den egna QA-launcherns privata
`nativeP6GamePlayback`-flagga filtrerades bort av ordinarie speladresspolicy.
Detta bevisar ett fel i QA-launchern, inte att produktens normala streamflöde
är trasigt. Ingen separat stream är ännu verifierad. Okänd faktisk USD är null;
ursprunglig budget/journal och reservationer består. Efter timer-expiry återför
AI-agenten exakt de 42 föregående QA-env-variablerna och gör en env-bärande
OFF-deploy. `dep-db0qr6favr4c738uuf0g` är LIVE på samma 5fca-källa:
UID 1000/Web-process, alla flaggor av, faktisk router 404 och health 200.
Originalmanifest och installerat SDK är bevarade, budget-close är inte skrivet.
Privat OFF-kvitto `ai-gpu-activation/off-read-8712e00b-7c9f-40c5-88f3-55f31d2b8b9a-1791077962974.json`,
SHA256 `bc9f0fe1c498af6e4d5c325f50a8ce83904443bdf5503f34ad6e56c3a26953b1`.
Providerkön/jobben är noll, men idle/ready-worker finns; ALL0-drain påstås inte.
Merge-agenten har granskat en minimal lokal kodrättning för ett enda manuellt
fortsättningsfönster för den återstående streamen inom samma ursprungliga
2 generationer/3 SDK/2 TTS/2 GPU och kvarhållna reservationer. Gamla manifest,
auktoriteter och journalbytes förblir oförändrade; ny auktoritet kräver ett
explicit append-only-event och föregående journalhash. Ingen live-fortsättning
eller ny timer är ännu öppnad. Automatisk förlängning/retry och extra budget
är förbjudna. Det utgångna fönstret återstartas inte.

**Ny lokal sammanhållen leverans:** main `637c6445` innehåller Studio-fix
`e6c32aab` och AI-fortsättning från `1aa0d94e`. Studio: 48 riktade auth-/
browserprov, färskt bygge med fyra workers, typkontroll och fullhook
1 276 PASS/4 SKIP/0 FAIL. AI: 36 riktade guards och fullhook
1 292 PASS/5 SKIP/0 FAIL. Samlad rootkontroll: 1 298 PASS/6 SKIP/0 FAIL;
färskt fyrworkerbygge, 50 sanerade traces och typkontroll PASS. Root-hookens
två browser-SKIP täcks av Studio-workerens separata faktiska browserprov;
övriga isolerade SQL-/Linux-SKIP kvarstår. Push och ny QA-version återstår;
faktisk drift är fortsatt 5fca8983 och QA är av. Äldre P8-baserad Studio
`a8b3d21e` bevaras men dupliceras inte vid städintegration. Den nya koden
öppnar inget provfönster vid boot och gör ingen automatisk aktivering.

**Funktionell beviskedja för den beställda omkopplingen:** merge-agenten har
efter separat käll-/admissiongranskning fastställt ett uttryckligt sammansatt
v2-bevis: de två härledda verkliga fullfilsuppspelningarnas hash/canplay/audio/
queue-ended, återbruk av byteidentisk godkänd e461-spelarkod och ett nytt
faktiskt streamvarv med avkodad synlig/hörbar media, progression, rätt owner/
session/runda/pose, ended och accepterad ACK. Ett andra nytt streamjobb krävs
inte av Jakobs slutmål och får inte överskrida hans totalt två genereringar.
Fullfilens synliga bildrutor/owner-observationsrader och mänsklig läppsynk-
acceptans förblir okända; nya medier är pending approval och full P6 bockas
inte av. Befintliga FAIL-kvitton och originaltider bevaras. V2-valideraren
ska fortsatt neka tills det faktiska streambeviset, cancel/terminal/drain,
exakt QA-återställning och aktuell route-/source-/deploybindning finns.
Produktionsfönstrets egen färska paritet och ALL6-worker-/job-dränering består.

**Lokalt färdig P8/P2-kod, ännu inte avvecklad drift:** städbranchens
`0dfd307a` och `8589fa2c` har riktad runtime-/shutdown-/speech-QA-verifiering.
`d089cda4` återför exakt de tre senare AI-filer som en äldre städbas annars
förlorade; 15/15 och fullhook passerar utan tillfällig källfilslåning.
Studio `a8b3d21e` rättar fristående login/reset till den gemensamma publika
hosten före autentisering, så host-only cookies gäller för spel/Lab-handoff.
29 riktade browser-/kontraktsprov, fyra Next-aliasprov, typkontroll, färskt
bygge och fullhook (1 271 PASS, 6 SKIP, 0 FAIL) passerar. Actual alias och
fysisk avveckling verifieras efter integration/produktionsomkoppling.

## Fem dokument i docs

- [JOHN-HANDOFF.md](JOHN-HANDOFF.md): senaste verifierade arbete och öppna fel.
- [ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md): data, backup och mediaregler.
- [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md): namn, placering och villkor.
- [LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md): ansvar och uppspelning.
- Detta dokument: källa, driftskarta och leverans.

Uppdatera befintliga dokument kort; skapa inte fler daterade rapporter eller
sprintarkiv innan Jakob ber om ny dokumentation. Labbets användarguide och
OpenClaws versionsbundna källindex ligger nära respektive implementation.
JSON-register, media, acceptansbaseline och befintliga QA-kvitton bevaras.

## Masterplan: en Croupier Studio

Beslutad målbild 2 oktober 2026; **implementation påbörjad, inte genomförd migrering**.
Den här checklistan är den enda masterplanen. Uppdatera den och handoffen
löpande; inga nya plandokument eller parallella statuskopior i docs.

### Mål och städprincip

- **UI-precisering 3 oktober:** tre huvuddelar — Dealer & klipp, Backoffice,
  OpenClaw. Dealerarbetsytan har en väljare och Idle, Kort & deal, Fasta repliker,
  Bakgrund och Probe. Uppladdning är en klipphandling; observation/avancerade
  regler är sekundära verktyg. Huvudytan byggs från den fokuserade Astrid-sidan,
  inte genom att flytta hela gamla event-/simulatorlabbet. Andra dealers använder
  sina egna exakta register; Astrids policy får inte kopieras till dem.
  Backoffice behåller 14 funktioner i sex lokala grupper. OpenClaw får en ren
  länkportal till befintlig native dashboard, inte en ny modell-/chatt-/GPU-editor.
  Ingen generell Render-omstartsknapp ingår i detta UI-steg.
- **Senaste avgränsning från Jakob:** förenkla överlappande/felaktiga menyer,
  prioritera en begriplig Studio och fungerande lagring. Gamla Studio-uppladdningar,
  granskningsgenerationer och cache/slask behöver inte migreras eller få nya
  säkerhetskopior; nytt material kan laddas upp manuellt. Ett nytt tomt
  granskningsbibliotek är därför tillåtet som uttryckligt startbeslut, inte som
  tyst fallback vid databasfel. Aktiva spelklipp/baseline, konton/saldo och
  OpenClaw är inte slask. Förbrukade request-/kostnadsjournaler får inte nollställas.
- **Nästa önskemål, ännu inte implementerat:** en granskad svarskatalog för
  fråga/text/valda bild- och ljudbilagor plus svarets exakta audio/video.
  Första steg bör vara explicit Studio-/QA-sparning från färdiga fullfilspaket:
  privata bytes i befintlig Blob och Neon för sökbar text, scope/ägare,
  ursprung/request, paketrevision/hashar, kategori, kontext och approval.
  Hälsning/komplimang/spelregler/tid är etiketter, aldrig ensamma återbruksgates.
  Endast godkänt biblioteksexemplar får återbrukas mot aktuell sparad spelpolicy;
  namn, klockslag, rundor/saldo kräver aktuell kontext och får inte globalreusas.
  Streaming behöver senare exakt AV-capture utan betald fullfilsfallback.
  Inga automatiska spelararkiv införs; gallring får inte nollställa kostnadsjournaler.
- En användaryta: `https://www.scoutgaming.tech/studio`, kallad **Croupier Studio**.
  Klipp, event/regler, observation, zoner och administration finns där.
  Lab/BO försvinner som separata användarytor och menybegrepp. Ingen admin-iframe.
- Måladress för spelet: `/blackjack`; `/game` blir en omdirigering dit med
  bevarade godkända query-parametrar. **Idag är det omvänt:** `/blackjack`
  visar spelarens inloggningsentré och `/game` visar spelet. Adressbytet är nu
  implementerat bakom gemensamma avstängda policyflaggan tillsammans med
  launch/callback/returnTo- och partnerkontrakten; `/player-login` blir entrén.
- Vercel äger Studio, dess administrations-/Studio-API och spelargränssnittet.
  Två tekniska Vercel-byggen får användas under samma adress; en sammanslagning
  av Next-versioner/paket är inte ett separat mål eller skäl att försena flytten.
- Befintlig Neon äger konton, behörigheter, wallet/rundor och beständiga
  Studio-/administrationsmetadata. Föreslagen ny domän är `croupier_studio`
  i avsedd befintlig databas; zonernas explicita databasanslutning bevaras.
- Samma privata Blob `croupier-media-private` äger beständiga medier, även
  nya genererade talpaket. Aktiva spelmediers ID, bytes, hash, exakta talpar och
  kalibrering bevaras. Gamla Studio-slaskpaket behöver inte återimporteras.
- Render behåller auktoritativ spelmotor, live spel-/strömtransport och
  tung bearbetning. OpenClaw Director/Gateway och RunPod GPU-läppsynk består.
  Studio länkar till befintlig native OpenClaw-dashboard; ingen omparning,
  ny dashboard-origin eller rättighetsbegränsning ingår.
- Ersatt kod, dubbla register, gamla tjänster, onödiga env och överflödig disk
  ska faktiskt tas bort, inte lämnas som permanent fallback. Gamla UI-adresser
  kan vara rena omdirigeringar, men får inte fortsätta köra den gamla appen.
  Användarens städmandat gäller ersatta delar, inte blind radering av unika
  konton, aktiva jobb/kostnadsjournaler eller godkända medier. Sådana uppgifter
  flyttas till sin nya enda källa; aktiv OpenClaw-lagring är inte en dubblett.

### Gemensamma kontrakt före parallell kodning

1. **Identitet och adresser:** en administrationsinloggning och befintliga
   `reader/staff/admin/superadmin`-roller med rättigheter per sektion och API.
   Spelarkonton är separata och ger inte Studio-access. Ingen ny OAuth eller
   kontoreset ingår. Serverkontroller, sessionsförnyelse, revoke/block/logout,
   CSRF/origin, återinloggning och QA/produktion-isolering måste bestå.
2. **Sparad policy:** en revisionsstyrd källa som både Render-spelet och
   Vercel-Studio läser. CAS-konflikter, transaktioner, historik och audit;
   osparade utkast blir aldrig spelpolicy. Enbart disk-lock/rename räcker inte
   med flera Vercel-instanser. Ingen oreglerad dubbelskrivning under migrering.
   Gemensamma flaggan `CROUPIER_STUDIO_NEON_POLICY=1` kräver samma explicita
   miljö/workspace och game/auth-Neon på Render och Vercel-Studio. Native BO
   kräver dessutom `CROUPIER_STUDIO_NATIVE_ADMIN=1`; separata flaggor får inte
   skapa två aktiva policykällor. Gemensam spelrevision binder de två sparade
   dokumentrevisionerna; exakta projektrevisionen bevaras för presentationens kvitton.
   "Profiler" i P2/Agent A avser Studios presentationsinställningar, inte
   OpenClaws companion-minne/agentprofiler eller aktiv Director/Gateway-state.
   Spelarprofiler som redan finns i Neon ligger kvar där; lokala privata
   anslutnings-/utvecklarprofiler och deras hemligheter exporteras inte automatiskt.
3. **Media och jobb:** privat objekt-ID/hash + metadata i Neon, tidsbegränsad
   behörig upload/commit, servervalidering av filtyp/storlek/hash och säker
   delete-policy. Klienter får inga Blob-/providerhemligheter. HEAD/Range och
   spärr mot privata käll-/layoutfiler består. Blob ersätter filer, inte
   request-idempotens, jobbägarskap, GPU-sessionreservationer eller budgetledger.
4. **Gräns mot spel/AI:** lätta Studio/admin-anrop på Vercel; live spel,
   långvariga jobb och deras skyddade transport på Render/RunPod. Bevara
   `/speech-stream` och `/lipsync-worker`, inklusive worker-auth och återanslutning.
   En förbrukad engångsbiljett får inte återanvändas; transportåteranslutning
   får aldrig automatiskt starta ett nytt betalt GPU-jobb.
   OpenClaw får samma katalog/revisioner och tillåtna kontext som idag. Kamerabilder
   består; mikrofonljud transkriberas före OpenClaw. Råljud direkt till modellen
   och modell-/GPU-uppgradering är inte del av den här flytten.
5. **Schema och klienter:** ändra inte checksumlåst
   `ops/neon-game/product-schema.sql`/`product-v1` i efterhand. Studio införs
   med separat versionerad migration och isolerat återläsningsprov. Klassificera
   alla äldre BO-endpoints innan de tas bort: spelet läser idag `/api/bo/config`,
   och launch-allowlists accepterar idag `/` eller `/game`, inte `/blackjack`.

### Senaste kontoförenkling — 3 oktober

Jakob beställde två effektiva behörigheter och gemensamma credentials:
admin för spel + hela Studio/Backoffice, spelare för spelet. Den nya koden
ersätter kontotypsväljaren med gemensam resolver; superadmin är adminalias
och reader/staff blir game-only utan live roll-/kontomigrering.
Native Backoffice har spelarpasswordbyte via signerad Render-authority,
serverstyrd formbehörighet, sessionåterkallelse och runtimecancel före OK.
CRAIG-konton hanteras genom befintliga invitations-/resetlänkar.
Riktade collision-, roll-, reset-/saldo-/historik- och samtidiga adminprov
är godkända. Full lokal regression och byggen redovisas i John-handoff.
Installerad QA från samma källa är verifierad 4 oktober på exakt e461ef07
i alla tre tjänster. Riktad auth/revoke-acceptans redovisas överst i
John-handoff; tidigare installerade SHA/kvitton täcker inte denna ändring.
Historiska rollkontrakt nedan beskriver tidigare paket, inte den nya policyn.
### Första kodpaketet: native administrationskontrakt

`lab/lib/studio-access-policy.mjs` och `studio-admin-contract.mjs`, med
TypeScript-deklarationer och två isolerade tester, anger de 14 sektionerna,
31 actionregler, 33 explicita admin method/path-par och fem auth-adresser.
Föreslagna native adresser är `/studio/login`, `/studio/administration/<sektion>`,
`/studio/api/auth/*` och `/studio/api/admin/*`. Reader/staff behåller sina
administrationsrättigheter; Studio-projekt/media får inte därför öppnas för skrivning.
Spelar-/partnerroller, okända actions och icke-exakta paths nekas av helpers.

Det första paketet var en fristående **kontraktsgrund**. Den 3 oktober har
native admin/session-routes tillkommit bakom explicit avstängd driftflagga;
det är ännu inte produktionsaktivering eller fullständigt BO. Rollgolven är inte fullständig
auktorisering: integratören måste kontrollera aktuell session/source_stamp/
auth_epoch, exakt Origin/CSRF, begränsade bodies, CAS och audit. Självrollbyte/
självradering förbjuds, spelarstatusändring måste avbryta aktuell spelarchatt/
speech/probe och operatörens speech-QA-gate består. Avvecklad `clip-assign`
återinförs inte; spelkonfigprojektion och launch/credit måste behålla spelauktoriteten.
De två nya testerna körs av både Lab-testsviten och den ordinarie fulla hooken.

### Förstudie: inventerad källkod, inte live-disk

Tre avgränsade läsanalyser är klara. De har inte läst molnkonton/databasdata,
kört providerprov eller ändrat runtime. Följande tillstånd måste få rätt
motsvarighet; tomma standardvärden är inte en export av verklig driftdata.

| Nuvarande produktstate | Ny källa / villkor |
| --- | --- |
| `studio/project.json`, `history/` | Neon: dokument + atomisk revisionshistorik |
| `studio/social-policy.json`, `social-history/` och profiler | Neon: egna dokumenttyper/revisioner, inte ihopblandat med presentationspolicy |
| `studio/videos/index.json`, `classifications.json` | Neon: samma media-ID, familj, klassning, hash/storlek och privata objektpekare |
| `players/bo.json` | Neon: rum, tier/dealer, pitboss, turneringar och voice/gen-omdömen; spelkonsumenter bevaras |
| `generations/`, BO:s generationsregister, `studio/voice-cache/` | Blob för beständiga medier, Neon för register/omdömen/försök; röstcache är inte synk-approval |
| `speech/` paket och request/done/failed-kvitton | Blob för paket, Neon för text/voice-fingerprint, ägare, idempotens och resultat |
| GPU-jobb/reservation/cancel/terminal, budgetpolicy och operatörens QA-gate | Neon-transaktioner/unik nyckel/lease; reservera före provider-POST, osäkra försök förblir förbrukade |
| Blob-cache, uploadstaging och ffprobe-temp | Disponibel scratch, aldrig enda beständiga källa eller budgetjournal |

Konton/auth/wallet är redan i Neon; zonernas egna Neonanslutning och den
gemensamma Blobben består. Director/Gateway har fortfarande aktiv egen state.
Produktprofilen i `tools/backup-render-state.mjs` kräver två historiska
SQLite-filer: export-/inventeringsvägen måste verifieras för dagens Postgres-
drift och får inte automatiskt räknas som färdig.

GPU har två kontrakt: streaming via Cartesia → Render-relay ↔ RunPod-worker
→ skyddad browserström, och fullfil via Cartesia → RunPod → audio/video-paket.
Streaming ska inte tvingas genom Blob eller få en automatisk betald fullfilsfallback.
Journaltesterna ska täcka parallella försök, restart, osäkert submit, UTC-midnatt,
förbrukad budget, terminalkvitto och ägare. Migration återbetalar inte reservationer.

Utgå från befintliga `lab/test/project-store.test.mjs`, cloud-media/upload/zone-
testerna, `test/generated-speech*.mjs`, `test/operator-speech-qa.mjs`, auth-
och Postgres-testernas isolerade fixtures samt frontendens native-WebSocket-tester.
Nuvarande `test/backoffice-lab-browser.mjs` bevisar en iframe, inte den nya
native administrationen. Ny Neon-Studio/journaladapter, två molnskrivare,
diskfri kallstart och faktisk avveckling behöver nya acceptansprov.

Stora uppladdningar och långvariga arbeten ska inte behandlas som obegränsade
vanliga API-anrop. Verifiera aktuell plattform vid implementation:
[Functions-gränser](https://vercel.com/docs/functions/limitations) och
[Blob-SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).

### Checklista och beroenden

Bocka av endast efter angivet acceptansbevis. Planering är inte implementation;
källinventering är inte en live-fillista eller bevisad borttagning.
P7:s produktionsimport, gemensamma policy, aliasbyte och provideraktivering är
verifierade. P8-koden `9ba2fd05` är faktiskt LIVE och diskfri slutkontroll,
produktdisk-/tolv Blob-borttagningar samt verklig omstart har passerat.
P9 dokumenterar verifierad slutkod och faktisk avveckling i befintliga filer.
Detta ersätter den äldre uppskattningen 80/20. Full P6, naturlig providerstatus
COMPLETED och ny mänsklig take-approval påstås inte. Ingen 100 %-rapport före
verifierad integration och faktisk avveckling.

- [x] **P0 — målbild:** en Studio, en privat Blob, Neon för beständig struktur,
  Render/OpenClaw/RunPod behålls för sina aktiva ansvar; obligatorisk slutstädning.
- [x] **P1 — kontrakt och inventering:** lås API/datakontrakt, käll-/mål-/ägarmapp
  och exklusiva filanspråk. Läs uppdragets förväntade resultat och acceptansvillkor
  före implementation. GitHub hanterar källa/leverans/checks; denna checklista
  hanterar status. Jira och gamla GitLab-flöden används inte. Inventera molnstate
  och alla läsare/skrivare före senare radering. Saknad åtkomst ska redovisas, inte antas.
  - [x] Läsande anslutningskontroll: GitHub admin/push och gröna checks på
    plancommit `cd4d8480`; autentiserad Vercel-CLI når båda produktprojekten;
    Render API/Director-status samt Neon game/auth/zones svarar. Inga livekonton,
    migrationsskrivningar eller betalda providerprov användes för kontrollen.
  - [x] Första kodpaketet: fristående Studio-sektions-/behörighets-/APIkontrakt;
    11 isolerade tester PASS, inklusive negativa fall. Inga aktiva route-, cookie-
    eller lagringsbyten. Detta bockar inte av hela P1/P4 eller live-acceptans.
  - [x] Full molndiskinventering och återstående lagrings-/journal-/transportkontrakt
    låsta före migreringsintegration och radering. Render-SSH är nu verifierad
    efter godkänd registrering av befintlig publik nyckel. Den ofrysta läsexporten
    visar 129 journalfiler: 18 terminala GPU-jobb, 46 streamrequestkvitton,
    tre operatörskampanjer/sju försök och ingen aktiv grind. Rå BO-/socialpolicy
    saknas; effektiva defaults kräver explicit proveniens, aldrig påhittad råfil.
    Sex av 18 sparade mediebindningar saknar exakt UUID i lokalt/inventerat
    Render-register efter byte av bytes/hash/storlek den 29 september i
    `891c432a`. Samma filnamn/familj/roll är inte importparitet; ingen automappning.
    De sex exakta originalvideorna är nu återfunna i `365f283b`, med verifierad
    originalhash/storlek och inget ljud (6/6). Kodgrunden för privat Blob-/Neon-
    bevarande och strikt metadataresolver är verifierad i riktig isolerad
    PostgreSQL/HTTPS/restart. Alla sex original är nu uppladdade som nya
    immutabla privata Blobobjekt, totalt 8 262 169 bytes; full återläsning/SHA
    PASS. Privat `retained-bank-blob-receipt.json` har `blobReadbackVerified:true`.
    Sex exakta retained-mediarader är registrerade enbart i nya isolerade QA
    med sex auditposter och noll nya rader vid exakt återkörning. Ingen sådan
    produktionsimport var genomförd vid detta historiska QA-kvitto. Nu finns
    sex retained-rader även i produktion efter verifierad import och paritet;
    detta är inte visuell approval. Hela produktdisken är senare fryst och
    inventerad: 206 filer/10 mappar, full extern backup och arkivhash PASS,
    backupkvitto `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
- [x] **P2 — Neon-state:** projekt/revision/historik/profiler, videoregister/
  klassificering och beständig BO-konfiguration har en gemensam databasadapter.
  Bevis: schema-migration, importparitet, samtidiga sparningar/rollback och
  restart-prov i isolerad databas. Konton och saldo får inte återställas/resetas.
  Gammal Studio-mediakatalog/historiska generationer är bortvalda; börja med
  dokument/CAS/historik/audit och bara nödvändig metadata för nya uppladdningar.
  - [x] Fristående kodgrund: separat 001/002-schema och checksum-/strukturkontrollerad
    migration; asynkron repository med serverägd scope, CAS, historik/audit,
    transaktionsrollback och explicit snapshotimport. 27 repository/migrations-
    fixturtester PASS. Inget fröprojekt eller diskfallback. Ett tidigare isolerat
    PostgreSQL-/omstartsprov gav 15 PASS; senaste paketets SQL/HTTPS/restartkvitto
    redovisas under P6.
  - [x] Verifierad aktuell import och aktiv gemensam källa för Studio/Render.
    P7:s importkvitto `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d`
    och fristående runtimeparitet verifierar 32 skyddade konto-/speltabeller,
    tre dokument och 18 aktiva plus sex behållna medieposter.
  - Integrerad `studio-game-policy` läser projekt och
    administration i en gemensam repeatable-read-transaktion, returnerar en
    oföränderlig scopebunden spelrevision och bevarar båda källrevisionerna.
    Studio-/Render-adaptrar sparar med CAS/historik/audit. Exakt tier/idle-
    validering nekar fel dealer, närliggande klippnyckel och saknat aktivt media.
    12 riktade policyprov och 17 repositoryprov PASS, inklusive samtidiga
    sparningar, blandad revisionsrace, rollback och scopegränser. `listMedia`
    läser endast avsedd Neon-scope och nekar ofullständig lista. Detta är
    fixturbevis kompletterade av P6:s SQL/restartprov och P7:s faktiska
    produktionsimport och runtimeparitet.
- [x] **P3 — Blob och jobbstate:** beständiga generationer/talpaket ligger i
  samma privata Blob; request-idempotens, sessionägarskap, kostnadsreservationer,
  job recovery och budgetledger är beständiga i Neon. Bevis: hash/HEAD/Range,
  fel-/retry-/avbrottsprov och restart utan dubbeljobb eller budgetnollställning.
  Detta avser nya paket och nödvändiga jobbjournaler, inte en full import av
  gammal slaskmedia. Slopad mediaimport gör inte osäkra betalda jobb nya igen.
  - [x] Fristående Neon-jobbjournal med fenced lease, request-idempotens,
    submit/cancel/terminal och budgetreservationer: 17 fixturtester PASS.
  - [x] Aktiva stream-/session-/fullfilscallers använder Neon-journalen under
    gemensamma policyflaggan. Fullfilsbytes lagras privat i befintlig Blob och
    återläses med exakt paket-/ägarmetadata, hash och storlek. Beständig disk-
    artifact-/budgetfallback saknas i detta läge; endast städad OS-temp används.
    Isolerade byte-/retry-/ägarprov passerar utan betalda provideranrop.
  - [x] Fullfilernas monetära reservation före TTS/GPU: det tidigare request-
    journalprovet täckte inte beloppsreservationen. Additiv 004 och gemensam
    stream-/fullfilsdygnssumma är implementerade med explicit fullfilsbelopp,
    beständig requestägare, lease-/tidsfence och ingen budgetnollställning.
    83 fokuserade prov PASS; separat faktisk localhost-PostgreSQL/restart
    gav 15/15 grupper och tre guards PASS, inklusive samtidighet/dygnsgräns,
    tappad COMMIT-kvittens, fenced ägare och riktiga serviceanrops noll provider
    före nekad policy/budget/authfördröjning. 13 källhashar är oförändrade och
    egen fixtur städad. Slutlig uppdaterad bred SQL-/HTTPS-/restartacceptans
    gav 41/41 grupper och fyra retained-kontraktsprov PASS; alla 46 källhashar
    består och separat städkontroll fann noll egna fixturkataloger.
    Originalets totaltak 10 USD är godkänt; endast det lilla SDK-textprovet nedan
    är kvitterat. Migration/import seedar ingen fullfilspolicy i äldre
    förbrukad produktionsjournal. Separat production/version 1-adoption är nu
    verifierad med ett enda additivt INSERT; historik och numeriska tak är
    bevarade. Faktisk USD är fortsatt okänd enligt acceptansundantaget.
  - [x] Rent förberedelsekontrakt för fryst legacy-policy och kostnadsjournal:
    exakta källhashar, scope, budgetversion, förbrukade requests/reservationer
    och stoppade/dränerade skrivare krävs. Osäkra jobb får inte återbetalas eller
    skickas om. Verktyget läser/importerar inte driftdata automatiskt.
  - [x] Explicit atomisk SQL-import för verifierat fryst underlag: källchecksumma,
    scope, stoppade/dränerade skrivare och installerade 001/002/003 krävs.
    Sparad budget, båda UTC-dygnens kostnader och opaka förbrukade requestnycklar
    bevaras. En receipt binder importen; exakt återkörning duplicerar ingenting,
    ändrade leases/förbrukning stoppar merge/reset och sista receipt-fel ger full
    rollback. Additiv 003 lagrar operatörens ursprungliga kampanj/grind/försök
    med rå källhash; historiska actors fabriceras inte och saknad grind förblir
    avstängd. Färdiga paket blockerar utan exakt privat Blob-/byteverifiering.
    85 fokuserade prov och verkligt SQL-/restartprov PASS; ingen liveimport.
  - [x] Aktuell komplett drift-export, journalimport och paritetsprov före
    flaggbyte. Render-API, Neon och SSH till produkttjänsten nås. Datorns
    befintliga publika SSH-nyckel är registrerad efter uttryckligt godkännande;
    ingen privat nyckel överfördes. Första 129-filers exporten var ofryst;
    senare fryst export, childless underhållsdrift och faktisk extern ALL0-
    GPU-dränering verifierades före importen. Studio 001–004 och skyddad
    journalimport är genomförda; faktisk paritet för 32 konto-/speltabeller,
    elva kostnadstabeller och exakta mediereferenser PASS. Ursprungliga
    kvitton och reservationer är bevarade, ingen omimport eller återbetalning.
- [x] **P4 — en Studio:** native administration ersätter iframe; navigation,
  rollstyrd kontohantering (lägg till/spärra/ta bort enligt nuvarande livscykel)
  och speladresser är integrerade. Bevis: login, callback/launch, alla roller,
  nekad spelaranvändare/anonym, reviderade adresser och bevarade utkast. Alla
  Funktionerna från de 14 adminsektionerna får grupperas under färre menyval.
  Gamla parallella klipp-/generationsvyer behöver inte kopieras som egna ytor;
  deras slaskbibliotek är uttryckligen bortvalt. Konton, roller, spelinställningar,
  drift/journal och nödvändiga partnerfunktioner måste ha en riktig motsvarighet.
  Enbart ny kontosida räknas fortfarande inte som hela administrationen.
  - [x] UI-steg: tre huvuddelar, dealerneutral fokuserad klippyta, lokala
    Backoffice-grupper och autentiserad OpenClaw-portal publicerade i
    `d8b1b928d3feef9f4004ea6ee26697af2613a10f`. 43 riktade tester, TypeScript,
    normal pre-commit och alla tre CI-jobb PASS; frontend och Studio på Vercel
    READY för samma kod-SHA. Anonyma entréer kräver fortsatt inloggning.
    Webview-kontrollen kunde inte starta; visuell livegranskning kvarstår.
    Vid denna historiska UI-leverans bestod äldre backend/iframe. Nu är
    ersättningen aktiv i native Studio; P8 har tagit bort gamla UI-/iframevägar.
  - [x] Native administrationskomponent skriven: sex lokala grupper, rollstyrda
    formulär, serverannonserade aktiva actions, strängrevision/CAS och bevarade
    formulärutkast. Inga iframe- eller parallella gamla menyer inuti komponenten.
    Konto-/partnerformulären omfattar nu invite/resend och create/rotate/revoke/
    launch/demo-credit. Engångsnycklar visas endast i en separat tillfällig
    resultatvy och tas bort vid omladdning, gruppbyte, behörighetsändring eller
    logout; partnerlistan behåller bara godkänd metadata. Native login och
    lösenordsval finns på `/studio/login` respektive `/studio/set-password`.
    Drift använder nu native-ytan. Native exakta röstpar/review/CAS,
    fyra lokala mejlpreviewer och sparade skoregler/räknare är nu implementerade.
    Kortordning, hålkort och spelare lämnar inte sko-API:n; korrupt JSON nekas,
    högst 500 tabeller samplas och delresultat markeras. Direkta gamla betalda
    röstpreviewn stoppas före disk/provider i gemensamt/native läge. 52 kombinerade
    fokuserade BO-/röst-/readout-/UI-prov PASS, utan ny visuell approval.
- [x] **P5 — API på Vercel:** Studio/admin använder P2/P3 utan beständig lokal
  disk. Render-spelet läser samma policy och får erforderlig spelkonfigprojektion.
  Bevis: sparning från Studio följs av spelets kvitterade revision, utan iframe,
  gammal adminbackend, splittrade register eller kontroller på enbart klienten.
  - [x] Avstängd integrationsgrund: `/studio/api/admin/*` och
    `/studio/api/auth/session` använder samma befintliga CRAIG/BO-identitet
    direkt mot Neon, aktuell roll/fingerprint/auth_epoch, exakt Host/Origin,
    begränsad JSON och explicita extra gates. Config/room/pit/tournament använder
    repository-CAS; kontoläsning, atomiskt skapa spelare och BO-roll/remove finns.
    Inga kunddata eller providerhemligheter går via klientprops.
  - [x] Konto-/partner-/authhandlers implementerade utan livekontoskrivning:
    inbjudan/omskick använder befintliga Neon-identiteter och atomiska, hashade
    engångstokens; mail visas som anslutet endast med serverns konfigurerade
    sändare. Login använder befintligt lösenord/signern, delad beständig begränsning
    av försök och aktuell role/fingerprint/auth_epoch. Logout/lösenordsbyte
    återkallar Lab-sessioner och handoffs; utestående äldre lösenordslänkar kan
    fortfarande användas en gång. Spelarstatus och partner rotate/revoke/launch/
    credit kräver en verklig Render-kommandogräns och registreras inte utan den.
    Vercel gör inte saldo- eller runtimeändringar följda av lokal no-op cancellation.
    57 isolerade konto/auth/partner-/UI-prov och Lab-TypeScript PASS, inklusive
    samtidig tokenförbrukning, rollback, origin, roller, kapacitetsgräns och
    engångsresultatens rensning. Aktuellt isolerat PostgreSQL-/HTTPS-/restartprov
    PASS: 40 acceptansgrupper samt runnerns isoleringsguard, däribland dessa
    login/invite/resend/lösenord/logout/roll-revoke-flöden. Ingen verklig
    mailleverans eller produktionsaktivering följer av det provet.
    Senare kommandorättningen nekar också fördröjd signerad body efter
    nonce-städning och signatur som gått ut under auth/låsväntan. Ursprungligt
    obetalt repro ger nu 403/en originalkreditering; sex kommandoprov PASS.
  - [x] Verifiera aktuell inkoppling av native konto-/partner-/authfunktioner och
    spelarstatus inklusive Render-runtime cancellation; medie-review,
    gemensam spelprojektion och diskfri Studio-start. Exakt tier/idle-validering
    och konto-/auth-/Render-kommandogräns är implementerade och verifierade
    i det aktuella isolerade SQL-/HTTPS-/restartprovet.
    Spelkonsumenter läser samma sparade projektrevision; Render behåller kort,
    wallet och runtimeauktoritet. Gamla BO-konfigskrivare är avvecklade;
    `bo.json` är ingen aktiv andra writer. Produktion har bytt till Neon;
    native administration är aktiverad i Vercel-Studio och gemensam policy
    på berörda tjänster. Godkänd auth/roller/sparning/kommandogräns återanvänds
    från oförändrade QA-flöden, kompletterat med riktade städprov och faktisk
    routing/policy-/data-/restartavläsning. Ingen ny autentiserad
    produktionsinloggning eller syntetisk kontomutation påstås. Produktens
    fulla invitation/reset-mailacceptans kvarstår separat.
- [ ] **P6 — helhets-QA:** isolerad backend/databas/hostname, ett koordinerat
  serverpar. Fyra dealers med två faktiska plays, sparade revisioner/native-kvitton,
  auth/revoke, privata media och strömtransport. OpenClaw-roller, bild/transkriberat
  ljud/chatt samt båda GPU-vägar verifieras utan oavsiktlig ändring. Fixtures först;
  betalda liveprov kräver uttryckligt avgränsad budget/auktorisation. Fysisk kamera/
  mikrofon/mobil/Safari och mänsklig läppsynk redovisas separat om de återstår.
  - [x] **QA-uppgradering efter gemensamma credentials, 4 oktober:** exakt
    `e461ef073b63b2d1c937454bbfa31289774fcb8f` i Render
    `dep-db0nq30u01pc73b6ep40`, frontend
    `dpl_2tY7tigYk7ZDXoQGzfGC3ekvSnws` och Studio
    `dpl_CMoZh3VwNx8FVc17gF8iWjnbEN5K`; LIVE/READY, alias faktiskt återlästa
    och health 200. Tio bevarandegrupper PASS, samma env/disk/konton/saldon/
    råmedia/kostnader/originaljournal. SDK 7.12.1 och 17 privata flyktiga
    källfiler återlästa, nio spelmoduler identiska i publik QA, Git och Linux.
    Installerad prepare-only-plan och ursprunglig budget består; detta bockar
    inte av aktiv router/authority, full AI/GPU eller hela P6.
    Privata `native-p6-qa-release-e461ef07/ready.json` och
    `p6-ai-readiness-e461ef07/readiness.json` anger exakt drift och fortsatt gap.
  - [x] **Gemensamma credentials i verklig QA, HTTP/native HTML 4 oktober:**
    80/80 kontroller över 68 HTTPS-anrop på e461ef07. Admin till spel/Studio/
    native BO på båda origins, spelarnekande och cookie-rensning, native
    lösenordsbyte med gammalt lösenord/session återkallat och bevarat saldo/
    historik. Reader/staff-reset behåller game-only, adminreset återkallar
    spel-/Studio-sessioner. Verklig beständig cancellation-epoch återläst;
    pending providerjobb är fortsatt separat livegap. 27 städgrupper PASS,
    noll egna rader kvar och övrig konto-/wallet-/historikstate oförändrad.
    Inga mejl/provider-/produktionsanrop. Privat kvitto:
    `p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/receipt.json`.
  - [x] **Verkliga QA-loginformulär 4 oktober:** 18 UI-, två städ-/paritets-
    och två källkontroller PASS (22/22) på e461. Admin får Studio/native
    Konton med spelcookie; utloggning och spelarnekande verifierade. Egna
    fixtures borttagna, befintliga konton/saldon/historik och användarens
    Chrome bevarade. Separat återattest verifierar fångade loginmoduler mot
    avsiktlig byggomskrivning; provets ursprungliga råkällfel är bevarat.
    `p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`.
  - [x] **Befintliga greeting-klipp i faktisk QA-rehearsal 4 oktober:**
    Astrid/Vera/Amira/Mei har rätt matching clip och Play twice återaktiveras
    efter sekvensen utan synligt fel, på e461. Ingen explicit ended-räknare,
    mediehash-/baseline- eller mänsklig synkapproval; nytt AI/GPU-paket är
    fortfarande öppet. `p6-browser-evidence-e461ef07/receipt.json`.
  - Fortsättningskoden 3 oktober kopplar faktisk Director/SDK till serverägd
    Web-session, aktuell spelstatus och återläst sparad policy. Idle-cache
    avgränsas per ägare/policy, signerade tickets använder samma beständiga
    text-slot som texttal och giltigt avstående består. QA-entry binder råa
    router-/worker-manifest och faktisk Web-child-env; full Render-env och
    SDK-child-env har fortsatt egna bindningar. Ny privat runner går genom
    `/api/presentation/idle-advice` i shadow och kräver färsk Neon-policy,
    modellcandidates och verkligt Director-svar. En Director-Terra och fyra
    högst Terra/Deep-par ryms i nio återstående SDK-dispatches; originalets
    totaltak/journal/reservation ändras inte. Kod/offlineprov är inte faktisk
    installation eller P6-acceptans. Nya sourcepins/context ska regenereras;
    konto-/tariffbevis, faktisk runtime och två avkodade playback-ACK återstår.
  - Fortsatt obetald integration: opt-in cookieautentiserad GET av aktuell
    playback-context använder exakt egen QA-spelare, serverägd session/runda
    och återläst sparat projekt. Standardläget är 404 och ingen gäst skapas.
    Privat collector exekverar hashbundna `playGeneratedSpeech`-wrappern och
    kräver tre färska ägarkontroller. Collector/runner/produktström-fixtures PASS;
    `gameWrapperIntegrated:false` och full P6 kvarstår. Privat source-staging
    bygger en verifierbar Docker-overlay från exakt HEAD, utan SDK-download,
    manifest, secrets, journalbyte eller aktivering. Installation är ännu obevisad.
    Spelkopplingen finns nu även i appens faktiska posegrind/talkö: redan
    genererad descriptor, en ordinarie spelare/WS/video, tre cookieägda GET,
    separata renderer-/serveridentiteter och verkligt köslut. Den är avstängd
    utom på avsedd egen QA-origin med explicit flagga och godkänd auth.
    85 riktade offlineprov och audit PASS; faktisk installerad browserkedja,
    full AI/GPU-rehearsal och source-loaded-bevis återstår. Nytt kvitto är ärligt
    `decoded-product-game-queue`, men ingen full liveacceptans hävdas.
    Käll-overlay omfattar även transitiva literal imports; externa/dynamiska
    beroenden och basimage/frontendinstallationen hålls öppna. Officiell SDK
    7.12.1 är privat source-stagad, full återläsning och 4 prov PASS, befintliga
    pins oförändrade. SDK-paketet är därefter faktiskt installerat och återläst
    på egen Linux-QA som UID/GID 1000: 2 962 filer och exakt worker-treehash.
    Spelkoden är levererad som `5b51af0e`, full hook och 3/3 CI PASS;
    source-overlay 200 filer och 9 stagingprov PASS. SDK:s exklusiva
    Linux-installer har 3 isolerade prov PASS. Egen Render-QA-deploy
    `dep-db0k7j7avr4c7383kheg` är live på 5b51 utan env-/disk-/providerändring;
    separat faktisk återläsning verifierar SDK, fyra privata source-contexts
    och nio spelkällor mot exakt Git/Linux-byteidentitet. Prepare-only run
    `cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2` använder befintlig kampanj/budget;
    inga betalda anrop eller nya journalhändelser. Körande worker återstår.
    Frontendens saknade playback-context-route är därefter levererad som
    `966991ef4e4ad4a4ca9f446216c71d14a5d92841`: 9/9 routing/middleware/
    entry-prov, full hook och 3/3 CI PASS. Render `dep-db0kostg1s2s73eh0uk0`
    är live på samma SHA; 17 privata källfiler återlagda utan plan-/SDKändring.
    Oberoende SSH-provet verifierar nio Git-blobs och laddar faktiskt SDK-
    modulen utan klient/provider/journal/tjänstestart. Första Vercel-QA-
    uppdateringen tappade accepterade deployment-overrides; korrigerade
    966991ef-byggen återanvänder dem exakt. Båda är READY och QA-alias faktiskt
    bundna/återlästa: frontend `dpl_8Bsu9hFD7U7c7wqDTbBcXBC77aZB`, Studio
    `dpl_PLfAczMttfMAUx3HcwgiPN6bDj8w`. Nio publika spelmoduler ger HTTP200
    och exakta Git-SHA256. Normal login/BO→spel med befintlig syntetisk QA-
    operatör fungerar; ingen ny användare/inbjudan/mejl. Astrid greeting i
    delad Studio-spelare har faktisk `2/2 completed`. CDP-källkontrollen gav
    inget fullständigt loader/context-bevis; detta hävdas inte som P6-acceptans.
    Alla fyra greeting-rehearsals begärdes faktiskt med Play twice på rätt
    QA-dealer-URL: Astrid/local visar 2/2; Vera/Amira/Mei återgår utan visat
    uppspelningsfel men har ingen explicit sluträknare. Ingen assetbaseline
    eller mänsklig synkacceptans ändrades. Även den separata QA-labbdomänens
    login är faktiskt verifierad; inget projekt sparades. Privat UI-kvitto
    `native-p6-qa-release-5b51af0e/live-qa-ui-966991ef.json`.
    Cookie-endpointen behöver initierad authority/router med giltig original-
    admission och numerisk journal; prepare-only/router-off ger avsiktligt404.
    Färska full-run-manifest, tariff/counting-underlag och liveacceptans återstår.
  - Prisgap får enligt Jakob stå som backlog: faktisk Cartesia-kontotariff
    (extern nyckel, ingen egen kontoinloggning), counting-tariff/uttryckligt
    gratisbevis och RunPods totala startup/execution/idlekostnadsgräns saknas.
    Token-/tecken-/credit-/GPU-tid kan mätas ändå och redovisas separat från USD.
    Budgetprov kontrollerar konto/tariff/maxförbrukning och beständig admission,
    retry/restart/parallellitet; de verifierar inte produktens spelbeteende.
    Ingen påhittad nolltariff eller förnyad budget. Betalda prov väntar på dessa
    underlag; obetald integration och fixtur-QA fortsätter.
    Jakobs inloggade RunPod-webview bekräftar RTX 4090 ×1, 1,10 USD/h,
    max workers 1, active 0, idle 5 s, execution 600 s och 20 GB containerdisk.
    FlashBoot är Standard/enabled, ingen network volume. UI:s millisekunder
    avviker från officiell docs sekundavrundning; använd konservativ sekundgräns.
    Total kallstartsgräns och exakt lagringstariff återstår; inga inställningar ändrades.
    Avgränsad officiell återläsning 4 oktober bekräftar tre externa underlag som
    fortfarande behövs: Cartesia-nyckelägarens konto-/credit-/overagepris,
    uttryckligt pris eller gratisbevis för OpenAI `responses/input_tokens`,
    samt Runpods debiterade gräns från workerstart till full stopp inklusive
    lagring. [Cartesias publika priser](https://www.cartesia.ai/pricing) anger
    olika overagerater per plan; de identifierar inte nyckelns konto.
    [Tokenräkningsguiden](https://developers.openai.com/api/docs/guides/token-counting)
    och den öppnade prislistan ger inget uttryckligt counting-pris/gratisbevis.
    [Runpods debitering](https://docs.runpod.io/serverless/pricing) omfattar
    start, körning och idle; 600 s execution-timeout är ingen verifierad
    kallstartsgräns och jobbets TTL/404 är ingen worker-stopkvittens.
    Det privata `p6-cost-evidence-20261004.json` samlar den riktade läsningen.
    Upprepa inte samma prisinventering utan nytt kontounderlag; behåll ursprunglig
    kampanj, numerisk budget och förbrukad reservation. Obetald QA fortsätter.
  - Läsande GitGuardian-anslutning verifierad efter Jakobs uttryckliga godkännande:
    årsnyckel med endast `incidents:read,sources:read`, lokalt DPAPI-krypterad
    utanför Git. Två MCP-verktyg är låsta till source `30689542` i workspace
    `795524` och returnerar endast metadata. Full API-lista (en incidentsida,
    fem locationsidor) visade först fem TRIGGERED-incidenter. Efter Jakobs
    uttryckliga triageuppdrag har de granskats som testcredentials och stängts
    med detta skäl i rätt webbworkspace; API bekräftar fem IGNORED-ID:n.
    Webbplatslistorna lokaliserar även export-/cutover-fixtures för de två
    API-locationluckorna. Full paginerad API-återläsning efter räknaruppdatering
    bekräftar hela källans fem IGNORED och noll öppna; fil/rad-täckning i API
    är fortsatt partial för två. Ingen grön main-check hävdas. Se aktuell
    handoff för ID:n, verifiering och anslutningens användning.
  - [x] Aktuellt obetalt SQL-/restart-/HTTPS-prov: 41 acceptansgrupper samt
    runnerguard PASS i tillfällig lokal PostgreSQL och kortlivad HTTPS-fixture.
    Revisionskonflikt/rollback, spelkonfigprojektion, auth/engångstoken/epoch,
    roll-revoke, signerad actor/scope och återspelad walletnonce täcks. Nytt
    anrop med återspelad nonce får 409 och skapar ingen dubbel kreditering.
    Fryst journalimport, samtidiga importer/exakt återkörning efter restart,
    operatörens kvarvarande tredje försök och atomisk kostnads-/QA-rollback
    täcks också. De sex exakta retained-mediernas scope, oföränderlighet,
    återkörning, korrupt tuple och återläsning efter restart PASS, liksom fyra
    rena retained-guards. Röstens exakta identitet/roller/CAS/ändrat par/restart
    samt mejlpreviewer och skostatus med negativ JSON/auth, kortsekretess och
    500-gräns PASS. Render-standardfabriken accepterar installerade 001–004
    och sparad Neon-policy; saknad import nekas utan seed. 46 källhashar är
    oförändrade under körningen; 85 riktade
    tal-/journal-/Blob-/import-/operatörsprov PASS.
    Egna processer, certifikat och temporär databas städas i runnerns finally.
    Inga riktiga konton, molndatabaser, providermejl eller betalda jobb används.
    Full P6 med live ström/GPU och mänsklig acceptans består öppet;
    obetald fyra-dealer-acceptans på aktuell QA-version redovisas nedan.
  - Avgränsad privat P6-körförberedelse: 28 offlineprov och tre isoleringsguards
    PASS. Sju faktiska SQL-/restartgrupper binder 38 oförändrade källhashar och
    verifierar fysisk 001–004, auth-epokens FOR UPDATE, tappad COMMIT-kvittens
    utan återförsök/reset, gammal grind/JWT, verklig memory-HMAC och färdigt
    ägarbundet paket, förbrukad nyckel/cache efter omstart samt elva läsande
    kostnadsfingerprints. `reserved_at_ms` och den faktiska
    `web/generated-speech-chat.mjs` är rättade i P6:s kolumn-/källkontrakt.
    Fake-provider användes en gång; inga provider-/molnanrop eller skrivningar
    till befintliga databaser gjordes. Eget tillfälligt kluster är borttaget.
    STT-fixturen är en privat 2,03 s WAV från exakt befintligt Astrid-goodluck-
    ljud/text/baseline, med oförändrat original och utan ny visuell approval.
    Den observerade Gateway-retryräknaren kan minskas och begränsar inte
    absolut betalda dispatches/input. Jakob har nu godkänt totalt högst **10 USD**
    för en avgränsad livekampanj, inklusive alla försök; privat oföränderligt
    budgetankare `d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
    Beständiga numeriska, SDK- och Render-fasadaptrar har 36/27/44 offlineprov
    PASS utan provideranrop, inklusive verklig SDK 7.12.1 mot simulerad HTTP.
    Root har granskat exakta filhashar och återkört 106 PASS/1 SKIP (borttagen
    SDK-fixtur redan verifierad av underagenten). Separat fasattestering och
    opt-in worker har ytterligare 21/22 offlineprov PASS, återkörda av root;
    faktisk product-speech/adaptive-kod, exakta rollprompts, signerade tickets
    och bundna process-/SDK-fakta. Ursprunglig plan/budget/TTL består.
    Ett faktiskt isolerat SDK-källpaket och originalets numeriska journal är nu
    installerade för **ett** fristående textprov på egen Render-QA `190399`:
    run `6841477f-3370-4684-93b3-69a51fc6b3fb`, HTTP 200, `gpt-5.6-terra`,
    11 input-/5 outputtokens, ett dispatch/ingen retry; pending/uncertain noll
    och provbarn avslutat. Actual-/kostnadskvitton finns privat i
    `native-p6-short-text-execute/`. Usage/pris ger uppskattat **0,000082 USD**,
    inte verifierad faktura. **5,251152 USD** ligger fortsatt reserverade;
    **4,748848 USD** är oreserverade inom originalets totaltak.
    Faktisk SDK-worker/routing för produktkedjan och full input-/dispatch-/retry-/
    prisgräns/färskhetsbindning under fasdeploy återstår.
    Inget totaltak får nollställas/återbetalas vid omstart,
    och förberedelse-/adapterprov är inte full P6 eller produktionsgodkännande.
    Den avstängda QA-kopplingen är nu inkopplad i Webs riktiga chatt-/operatörs-
    flöden och exakt tre privata gatewayroutes. Den kräver serverägd aktuell
    session/status och separata Render/Web/SDK-bindningar; Director ger 503
    utan faktisk adapter. 55 riktade core-prov PASS/ett Windows-symlinkprov
    SKIP, privata routerprov 35/35, SDK/fas/transport 115, budget/brygga 61
    och separat QA-startfil 15 offlineprov PASS. En statisk cloud-import i
    avstängt läge upptäcktes av obligatorisk regression och är rättad; riktiga
    BO/Lab-auth- och åtta route-/ägarprov samt dealer-audit `--probe` PASS.
    Historisk läsande SSH-observation 13:26:40 UTC verifierade QA-runtime
    `4d84bffc`, PID/startidentitet och fyra avstängda providerflaggor, utan
    provider-/SQL-/molnmutation. Den är inte aktuell `190399`-attestering.
    Privata SDK-provkällor/journal är installerade endast för det fristående
    textprovet; regelbunden produkt-SDK/router/authority-readback är inte installerad.
    Senaste fasläsar-/attesteringspaket har 38 guards PASS. Faktisk SSH/SQL/Render-
    läsning på `190399` visar två oförändrade budgetjournalposter och bevarad
    äldre reservation, men tomma QA request-/kostnadstabeller, saknad GPU-/
    fullfilspolicy, ingen ägd kampanj och saknad regelbunden SDK-root/readback.
    Audit/schema består; inga tabeller eller originalbudgeter nollställs.
    Verklig Director-översättning av `catalog,input` till den stagebundna SDK-
    kedjan återstår; deterministisk baseline är inte provideracceptans.
    Läsande actualkvitton och `minimum-proposal.json` i
    `native-p6-readonly-phase/` redovisar de konkreta kostnads-/åtkomstgapen:
    counting-tariff/explicit gratisbevis saknas, Cartesia credits gav 401 och
    RunPod endpoint-admin gav 403. Health/voice 200 ger inte kontots tariff,
    GPU-/idle-/storagegräns eller rätt att ändra ett eventuellt Emil-konto.
    Förslaget är inte godkänt/aktiverat och dess källhashar ska återvalideras.
    Originalets 10 USD består med reservation 5,251152/oreserverat 4,748848 USD;
    ett av tio SDK-dispatches är förbrukat. Högst nio ytterligare återstår,
    så gammal fullkampanj med worst case tio ytterligare ryms inte oförändrat.
    Full P6 kvarstår: text/bild/STT, faktisk Director, fullfil, en streamsession
    med två playback-ACK, cancel/terminal/drain och färsk budget-/runtime-
    attestering. Ingen ny betald kampanj eller extra kontomejl under handoffen.
    Jakobs befintliga **Resend Free**-team används, utan betald mejlplan.
    `scoutgaming.tech` är tillagd i Free, i Irland, och Resend
    visar **Verified** 3 oktober 14:11 svensk tid (dashboardkontroll 14:19).
    Exakta DKIM-TXT-, send-MX- och send-SPF-TXT-poster är skapade, återlästa
    publikt; de fem tidigare zonposternas råhashar är oförändrade.
    Separat SPF-fortsättning bevarar första intent/resultat efter MX-kvittots
    kanoniska slutpunkt; inga tidigare DNS-skrivningar återförsöktes.
    Färsk OAuth/callback och QA-only-installation är klara. Actual readback
    14:57:48 UTC i `mail-resend-qa-connect/sender-result.json` verifierar
    krypterad integrationsägd `RESEND_API_KEY` samt explicit
    `CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech` i enbart QA Studio
    `prj_aPooGMUUKTGbyKlp0yEZUrEZtUmh`, configuration `icfg_33VhY6BuYW1NJHPZFxLYATRl`.
    Aktuell QA-deploy ärver dessa; Vercel-target `production` är QA-projektets
    target, inte produktionsaktivering. **Ett** uttryckligen godkänt native
    QA-invite skickades 3 oktober 15:31:35 UTC: HTTP 200, `emailSent:true`.
    Resend email `01a10264-60cd-7c83-9d28-e3c30bae8644` visar **delivered**.
    Läsande snäv sökning i rätt Gmailkonto hittade exakt avsändare/ämne i
    **Skräppost**, 3 oktober 17:31 svensk tid; body/token är inte öppnade och
    mailboxen är oförändrad. Privata sendintent/resultat finns i
    `mail-resend-qa-connect/`. Den disponibla inaktiva QA-readern
    raderades före senare STOP: ett removePOST HTTP 200, GET 15:47:37 UTC
    kontot borta och kvarvarande identitet hashoförändrad; route-transaktionen
    raderar även dess tokens/sessioner/handoffs. Cleanupkvitto:
    `mail-resend-qa-cleanup-confirmed-result.json`, SHA256
    `1f3978ba4e58bab9e22e75e32fe8357911ba34c2b17b2e97809c6a9bbcabeb23`.
    Den skickade invitationens token ska inte användas. Ingen recreate/resend/
    nyinvite efter STOP; full invitation/reset-acceptans och produktens
    mejlkonfiguration består öppna. Providerstatus delivered bockar inte av P6.
  - Ny separat Neon-QA-databas är initierad med checksumverifierad product-v1,
    Studio 001/002/003/004, en syntetisk administratör och tre dokument.
    004 lades till separat efter verkligt 15-gruppers SQL/restartprov och
    granskad plan: exakt 45 befintliga QA-fingerprints består, liksom 32
    tabeller vardera i produktion och äldre QA. De två nya fullfilstabellerna
    är tomma; ingen policy, budget eller grind seedades.
    Historiska QA-steg nedan gäller sina angivna SHA; aktuell leverans/90-acceptans
    följer därefter. Den tidigare fullfilsleveransen B2:s Render-QA-deploy misslyckades före
    listen eftersom standardfabriken fortfarande krävde bara 001–003.
    Rättningen är pushad i `4d84bffc` efter full hook och alla tre CI-jobb PASS,
    med standardfabriken verifierad i 41 SQL-/HTTPS-/restartgrupper/46 källhashar.
    B2 gav health 502. Återhämtningsguarden har 15 offlineprov och oberoende
    granskning PASS. Korrigerad Render-QA på exakt `4d84bffc` blev då LIVE med
    health 200 och matchande env-fingerprint. Färsk SSH-paritet efter LIVE
    verifierar samma äldre journal-SHA/mtime och bevarar en icke-terminal
    reservation; ingen dränering hävdas. Båda egna Vercel-QA-aliasen är kopplade
    på samma SHA. Alla 14 boot-/readinesskontroller och kall/hydrerad
    formulärkontroll på båda origins PASS. Två nya 90-körningar har vardera
    samtliga 89 insamlade kontroller PASS, inklusive alla fyra dealers två plays
    och sparad revision; båda kvittona är ändå FAIL med
    `no_provider_or_unapproved_network_request`, provideranrop noll. Fyra POST
    till `/api/probe/presence` blockerades per körning. Body/MIME är inte
    observerade; requesttyp är inte bevisad. Probe initieras bara för Astrid,
    även med vanlig identity/activity-heartbeat, inte en close per dealer.
    Projekt/pit är CAS-återställda med identiska före-/efterhashar i båda.
    Första körningens åtta maskade bildrutor visar rätt dealer/layout utan ny
    läppsynk-approval. Separat Astrid-diagnostik observerade ett verkligt
    heartbeat: JSON 241 byte, exakt sex fält och fem booleska flags,
    `present=true`. Begäran avbröts; projekt-/pit-/provideranrop var noll.
    Ägd CDP-spärr kvitterades före stängning och egna processer är avslutade.
    De gamla FAIL-körningarnas body/MIME förblir okända.
    Tidigare FAIL-kvitton består, produktion är inte omkopplad.
    Vid initieringen var spelar-/kostnadsstate i nya Neon-QA tomma. De sex
    exakta originalmedierna har sex
    auditposter och återkörning skrev noll rader. Aktuellt projekt med alla 18
    verifierade bindningar är kopierat via explicit CAS enbart till nya QA;
    neutral BO-/socialpolicy är oförändrad. Privat
    `native-qa-project-replica-imported.json` är QA-kvitto, inte fryst driftimport.
    Äldre QA:s 25 konton och produktion är oförändrade.
    Render-QA återstartades tidigare på `6efb50ee`, separat ny datarot/databas/scope,
    med avstängda tal-/stream-/kameraproviders. Faktisk health/env och samma
    hash/mtime för äldre öppen QA-reservation PASS. Två nya Vercelprojekt är
    READY på samma SHA; deras egna canonicaldomäner ger native boot efter
    exakt Lab-projektdomänregistrering/promotion. Standard-SSO består.
    Login-boot samt session/overview ger 200/401 på båda adresserna.
    Faktiskt fullprov stoppades efter fyra lyckade åtkomstkontroller eftersom
    Nexts SSR-redirect gav dubbel `/studio/studio/login` och 404. Rättningen
    är implementerad med apprelativ login och bevarad publik returnTo;
    24 fokuserade Next-/SSR-prov och TypeScript PASS. Rättningen är levererad
    på `7fe032a8` med obligatorisk full regression och alla tre GitHub-jobb PASS.
    Nya isolerade Vercel-/Render-byggen är READY/LIVE på samma SHA; alla 14
    faktiska bootkontroller PASS. Nästa fullprov stoppades efter fyra godkända
    åtkomstkontroller eftersom det ohydrerade loginformuläret kunde skickas
    som GET. Anonymt skarpt repro på båda origins bekräftar default GET och
    `user`/`pass`-FormData, utan credential-submit eller scriptfel.
    Nu är alla tre authformer initialt spärrade och använder exakt intern POST;
    fallback ger 415 före auth/mejl. Tolv native adminformer använder också
    POST. 38 riktade SSR/API-/verkliga React-browserprov och TypeScript PASS.
    Bara den nya QA:s syntetiska lösenord/epoch har roterats; signer och andra
    konton består. Leverans `b5c0ddc7` har full obligatorisk hook och alla tre
    CI-jobb PASS. Alla nya QA-byggen är LIVE/READY på samma SHA; 14 bootprov
    samt faktiskt kallt/hydrerat formulärprov på båda origins PASS.
    Två fullprov klarade 76 kontroller och stoppades sedan i Vera-rehearsal.
    Första provets nätverksguard är rättad; nästa hade noll blockerade anrop
    men saknade förväntat konfigurationskvitto. Faktisk diagnos bekräftar samma
    Neon-revision men gamla filnamnet i legacy-kvittot. Native-adaptern är
    rättad med 23 fokuserade prov PASS. Dessa tidigare prov föregår den
    verifierade runtimeleveransen `4d84bffc` och dess nya molnkvitto nedan.
    Projekt-/pitinnehållet är verifierat återställt i båda, providers noll;
    båda oföränderliga FAIL-kvittona bevaras. Fullacceptans/aktivering är öppna.
    Produktion/äldre QA består. Native mail kräver explicit konfigurerad
    avsändare och Resend-nyckel; fyra adapterprov PASS. Egen sändardomän och
    faktisk QA-nyckelkoppling är nu verifierade ovan; invitation/reset-acceptans
    är fortfarande öppen.
  - [x] **Aktuell isolerad QA-leverans:** exakt
    `190399386d93a02882d9b18a5ce5af53bb91fe23` på GitHub main efter full
    obligatorisk hook och fyra-dealer-audit `--probe` PASS. Alla tre
    [GitHub-CI-jobb](https://github.com/Jakeminator123/github-work/actions/runs/37129420281)
    PASS för samma SHA. Befintlig egen Render `srv-datj7l893c1s73ar3u50` är
    LIVE i `dep-db0h5vu0tbcc73fr4220`, HTTPS-health 200 och oförändrad envhash.
    Befintliga Vercel QA-alias är återlästa mot READY
    `dpl_7ct3jqmAUdD4bxRvmaXaeDhYB3yr` (frontend) och
    `dpl_HBNwDkdV4W6xHM9wFrpv9cnJn1yP` (Studio), samma SHA och oförändrad
    projekt-env efter rootens godkända mejlsteg. Render-deployens tio före-/
    eftergrupper bevarade konton, råmedia, schema och äldre journaler.
    Senare egna P6-prefix har avsiktligt nya prov-/budgetfiler; hela volymen
    påstås inte vara oförändrad efter dessa. Ingen produktionsomkoppling.
  - [x] **Obetald native-molnacceptans:** 90/90 kontroller PASS på exakt
    `190399386d93a02882d9b18a5ce5af53bb91fe23`, privat immutable receipt
    `native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
    15:14:38–15:17:50 UTC, med SHA256
    `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
    Backoffice utan iframe, CAS/utkast/privata medier och alla fyra dealers
    två verkliga avkodade/hörbara/avslutade plays och samma sparade Neon-revision
    `studio-ed573eba-18f9-42ed-8b16-b07ec2fb62d4` PASS.
    Tre verkliga heartbeat-svar var 200/JSON/off; inga blockerade eller
    betalda endpointanrop. Testetikett och Probe-mode ändrades tillfälligt i
    eget QA-projekt. Ägd CDP-spärr och route-drain kvitterades före exakt
    återställning av projekt/pit och ursprunglig automatic-policy. Browser-
    cleanup och separat actual resultatvalidator PASS. 14 färska bootprov
    och 41 riktade guardprov PASS. Loginlocator är skopad till exakt loginform
    för att skilja den nya resetformen. Åtta nya bildrutor är granskade för
    dealer/layout. Ursprunglig reservjournal har oförändrad hash/mtime och
    dess gamla icke-terminala reservation påstås inte vara dränerad.
    Ingen ny mänsklig läppsynk-/take-approval, full P6 eller aktivering följer
    av detta delprov. Produktens betalda text/bild/transkribering/ström/GPU/
    fullfilskedja och verklig invitation/reset-acceptans återstår; det enda
    fristående SDK-textprovet ovan bockar inte av dem.
    Tidigare 90-PASS `aa23e484`/SHA `0368ac1b…` på `4d84bffc` och dess
    scoped konto-/kostnadsinventering är historiska, oförändrade kvitton.
    Aktuell körning använder endast syntetisk QA-identitet; egen browser är
    stängd, inga mejl/provideranrop eller produktion/äldre-QA-anslutningar.
- [x] **P7 — samordnad aktivering:** efter verifierad aktiv ersättning,
  dokumenterad avgränsad funktionell admission och ett uttryckligt
  genomförandeuppdrag. Frys aktuella skrivare där det behövs, importera endast
  den aktuella beständiga datan, kontrollera paritet, byt källa en gång och
  verifiera riktig HTTPS-adress, sparning, spel, auth och återstart.
  - Privata importspärrar: kritiska käll-/SQL-/manifest-/indexfiler måste
    matcha exakt levererad main-SHA; aktuell mängd är 132 filer.
    87 importguards/36 paritetskontroller samt 19 fasguards/13 runtimeprov PASS.
    Faserna kräver alla fyra aktuella SQL-checksummor och elva kostnadstabeller.
    Separat nonempty-policyadoption är genomförd med ett additivt INSERT för
    production/version 1. Oförändrad konto-/kostnadshistorik, originalimport
    och numeriska reservationer är verifierade; faktiskt USD är fortsatt okänt.
    Alla 18 aktiva videobindningar ska
    fullåterläsas från Blob innan skrivning. Skarpa QA-läsaren har nu
    fullverifierat alla 18 inklusive sex original från tom OS-cache,
    med noll SQL-/provider-skrivningar. Efter import krävs slutlig sex-medie-
    paritet och kostnadsreplay med noll nya rader. 86 obetalda guards PASS;
    sex tidsgränsprov täcker även bevis som går ut under väntade driftanrop.
    Oförändrad originalimport kan återvalideras med ett separat läskvitto,
    full byte-/dokument-/register-/kostnads-/kontoparitet och fem minuters
    giltighet, utan återimport eller omskrivna originaltider.
    Faktisk ALL0-dränering är genomförd före importen. Endpointens ursprungliga
    Max 1/Active 0/FlashBoot ON är därefter återställd. Keys kan enligt Jakob tillhöra Emil;
    inga kontoövergripande providerinställningar ändras. Verklig Resend-sändare
    och integrationsnyckel är verifierade i enbart egen QA Studio; produktens
    mejlkonfiguration och full invitation/reset-acceptans återstår.
    Produktionsimport, fristående runtimeparitet och faktiska aliasbyten är
    genomförda på b0bc. Permanent provideraktivering och faktisk readback PASS på b0bc före P8.
- [x] **P8 — faktisk avveckling:** gamla BO/Lab-UI och ersatta Render-API/skrivare
  borttagna, inga permanenta diskfallbacks. Gamla Blob-alias tas bort efter
  verifierad referensmigrering. Onödiga env och produktdisk tas bort endast
  när samtliga beständiga beroenden är ersatta och befintlig slutkontroll PASS.
  QA, dess disk/SDK/journaler och AI-flaggor OFF bevaras; aktiv OpenClaw-disk består.
  Jakobs förtydligande 4 oktober: fryst omfattning och inga nya kontrollpaket.
  Behåll backup och gamla resurser tills slutkontrollen passerat; integrera
  de redan förberedda borttagningarna i befintlig releaseordning.
  Bevis: kod-/referenssökning, levande routing/konfiguration och restart efter
  borttagning, utan persistent produktmount. Neon/Blob-fel ska ge felstängning,
  inte fröprojekt/nollbudget/diskfallback. En ren Git-diff bevisar inte att en
  molnresurs är borta. Äldre 12 `croupier/videos`-alias kräver referensprov i
  både aktuellt uppladdningsregister och historik före borttagning.
  Slutbevis: disk DELETE204/GET404/service.disk saknas; gammal Blob-lista0,
  ersättningar12; actual postdelete `bf582b0b…` visar ny process, rätt källa,
  health200 och ingen `/var/data`/persistent mount. Backup och QA består.
  Källkontrollen 3 oktober gav följande konkreta ersättningsmapp. Dess ersatta
  mål är nu avvecklade efter P7 och referens-/restartprov; aktiva ansvar behålls.

  | Del | Ta bort när ersättningen är verifierad | Bevara aktivt ansvar |
  | --- | --- | --- |
  | Admin-iframe/UI | `lab/components/backoffice-panel.tsx`/CSS, legacy-grenen i `lab/app/administration/page.tsx`, iframe-/originhelpers i `backoffice-navigation.mjs`; ersatta `web/public/bo/{index,login,set-password}.html` och BO-UI-callers | `BACKOFFICE_GROUPS/SECTIONS` används av native-UI; gemensamma auth-/mejlkontrakt och kvarvarande media-/operatorcallers får inte tas bort med hela `web/public/bo` |
  | Gamla BO-skrivare | `boLoad/boSave`, defaults och ersatta administrations-/konto-/partnerhandlers i `web/server.mjs`, samt `players/bo.json` efter exakt import | `/api/bo/config` är fortfarande spelkonsumentens Neon-projektion; Render äger spelkommandon, wallet, aktörskontroll, launch/handoff och verklig cancellation |
  | Studio på disk | Diskgrenarna i `lab/lib/studio-server.mjs`, äldre projekt/social-/historik-/profil-/videoindexskrivare när motsvarande sparade Neon-revisioner och privata Blob-bytes är verifierade | `StudioPage`/`Studio` används av tree, activity, events, guide, probe och videos; validering/konflikthantering och den avancerade editorn består |
  | Genererade paket/journaler | Äldre beständiga paket-/cachegrenar under `generations/`, `speech/`, `studio/voice-cache/` efter Blob/Neon-paritet, terminal-/dräneringsbevis och kallstart utan diskfallback | Förbrukade request-/kostnads-/GPU-/operatörskvitton, även originalets nya P6-budgetjournal och kvarhållna reservation; aktiva spelklipp/text/audio/video/index/kalibrering består |
  | Legacy env och produktmount | Diskkopplingar `LAB_STUDIO_DATA_DIR`, `CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`, `CROUPIER_GENERATED_SPEECH_DIR` när gamla läsare/skrivare och cloud-fabrikens child-config är ersatta; produktmount först efter sista beständiga beroendet och slutkontroll PASS | QA-disk/SDK/journaler består med AI OFF; `BO_URL` och aktuella origins används för auth/handoff/ingress; Neon/Blob/provider-/streamnycklar och `/data/catalog`/`/data/openclaw` är aktiva, inte generella raderingsmål |

  Avgränsad städning före P7 har tagit bort frontendens oroutade blackjack-demo,
  oanvänd UI-/tema-/hookscaffold och dess exklusiva beroenden, samt pensionerad
  GitLab-GPU-CI och dubblerad miljökarta. Disponibel Next-/TypeScript-cache är rensad
  efter kontroll av sessionsvakt och processägare; labbtesternas runtime behålls. Dessa mål har ingen aktiv
  produktions-/QA-konsument. Tabellen ovan gäller de större P8-beroendena;
  deras disk-/envborttagning kräver fortsatt molnåterläsning och restart.
  - `services/test`/`services/test/fixtures` finns inte. De faktiska GPU-worker-
    testmapparna och rotens importerade JavaScript-fixtures används aktivt;
    kamerans HTML-fixture har ingen verifierad ersättare. Dessa behålls.
    Alla sex filer i rootens `test/fixtures` är spårade; fem JavaScript-fixtures
    har faktiska BO/auth-/HTTP-/Neon-/taltestimporter. `test/tools`,
    `test/ttols`, `test/web` och motsvarande services/test-vägar saknas;
    `tools`/`web` är separata repo-rootmappar, som i Jakobs bild; rotens `test/`
    är en syskonmapp till `services/`. Dessa och `pipeline/`/`open-claw/`/aktiva
    medier/konton/kostnadsjournaler behålls. Inget verifierat obsolete mål raderas.
- [x] **P9 — slutleverans:** fem docs uppdaterade, en John-handoff, aktuella
  miljönamn/guide, endast taskägda commits på main, CI och avsedd drift-SHA
  kontrollerade. Kvarvarande mänsklig acceptans/blockerare uttryckligen öppna.
  - Slutkod `9ba2fd05`: full hook och CI `37222438373`, tre success;
    faktisk Render/Vercel och postdelete-omstart PASS. Befintliga fem docs,
    labbguide och miljönamnsregistret beskriver aktiv Neon/Blob/native Studio.
    Efterföljande dokument-/namnregistercommit ändrar inga runtimebytes;
    leveransens aktuella Git-/CI-/deployidentitet binds i befintlig P8-journal.
    P6:s residualer, okänd USD, produktionsmail, QA:s äldre ephemära närvarogap
    och parent-envs direkta läsgap är uttryckligen kvar. GitGuardian har komplett
    commitmetadata men pending suite; incident-API är not-read, ingen clear-claim.
  - Kod [58536d63](https://github.com/Jakeminator123/github-work/commit/58536d63cc82d2c17936437aa784b2310b599a86)
    på GitHub main har alla tre CI-jobb PASS och Vercel-frontend READY.
    Verifierad QA-runtimeleverans `190399386d93a02882d9b18a5ce5af53bb91fe23`
    är pushad på main efter full hook och alla tre CI-jobb PASS, faktiskt
    LIVE/READY i tre befintliga egna QA-byggen och native90/90 PASS ovan. Aktuellt
    isolerat SQL-/HTTPS-/restartprov: 41 grupper, fyra retained-kontroller och
    46 oförändrade källhashar; processer/fixturkatalog städade.
    Den tidigare leveransen `6efb50ee` har sitt separata 40-gruppers/44-hashars
    kvitto; `ae54a61b` hade båda Vercelbyggen READY. Dessa historiska kvitton
    ersätter inte ny LIVE-/90-acceptans efter QA:s misslyckade B2-start.
    Lokal traceguard/build har 50 sanerade traces
    PASS. Flagga-av-leveransen
    och SQL-fixturerna bockar inte av P1–P9, aktivering eller avveckling.

**Körordning:** P1 först. P2 (metadata), P3 (media/journaler) och P4 (UI)
kan därefter köras parallellt på överenskomna filer/datakontrakt. P5 och
OpenClaw/GPU-integration använder deras resultat. P6 → P7 → P8 → P9 samordnas
sekventiellt. P8 är en obligatorisk del av leveransen, inte ett möjligt senare städjobb.

## Ytor och datalagring — produktion och nya QA

Godkänd källleverans med gemensamma credentials är `e461ef07`.
QA:s tre tjänster kör nu städversionen `7c4c1cc`, faktiskt LIVE/READY,
med verifierade alias, SDK/källa, tio aktuella bevarandekontroller och OFF37.
Den äldre 42→37-jämförelsen har ett bevarat ephemärt närvarogap:
`player_probe_sessions` 19→18. Övriga 31 kontotabeller matchar; 24h TTL är
möjlig förklaring, men äldre radmetadata saknas. Det äldre compose-kvittot
förblir false och ersätts inte med ett fabricerat full-PASS-kvitto.
Senaste fyrdealer-rehearsal och shared-credential-HTTP/DOM gäller `e461ef07`;
det fulla native90-kvittot gäller äldre `190399`.
Källkod, publicerad runtime och acceptansbevis har därför separata revisioner.
Verifierad synlig/hörbar AI→tal→GPU→spel-END från cc77 återanvänds för
oförändrade uppspelningsbytes enligt den dokumenterade funktionella admissionen.
Produktionsbytet är genomfört. Full P6 och dess separata residualer förblir öppna.

| Ansvar | Aktuell produktion | Bevarad isolerad native-QA |
| --- | --- | --- |
| Publik webb och spel-UI | Vercel `apps/croupier-frontend`, `/blackjack` | Samma spelväg på separat QA-hostname |
| Croupier Studio | Native Studio/admin/auth-API i Vercelbygget `lab` under `/studio`; befintliga roller | Samma native Studio på separat QA-hostname och scope |
| Auktoritativt spel | Render: slump, shoe, wallet, rundor, kommandon, cancellation och live-transport | Samma Render-ansvar; Studio får aldrig äga spelresultat |
| Konton och speldata | Neon `croupier_game`/`croupier_auth`; zoner i separat `croupier_zones` | Separat QA-databas och explicit miljö/workspace; inga produktionskonton återställs |
| Studio-policy, historik, BO och medieregister | Revisionsstyrd Neon `croupier_studio`, CAS/historik/audit och gemensam spelpolicy | Separat Neon-scope; installerade SDK-/QA-kvitton bevaras |
| Mediefiler och färdiga paket | Privat Blob `croupier-media-private`; Neon håller exakta metadata och bindningar | Samma privata Blob med isolerade ägar-/miljögränser |
| AI/GPU-jobb och kostnader | Render/RunPod/OpenClaw, beständiga Neon-journaler och reservations-/ägargates | AI OFF; budgetjournal, historik och reservationer bevaras |
| Director/Gateway | Egna aktiva tjänster, `/data/catalog` och `/data/openclaw` | Behålls; Studio länkar till befintlig native dashboard |
| Lokal utveckling | Koordinerat produkt-/labbpar; sparad data i `lab/data` | Samma sessionsvakt; byggcache är disponibel, men Lab-integrationstestet använder färdig runtime |

QA bevisar ersättningen i en separat miljö. P7 har bytt produktionskälla efter
verifierad paritet och dränering; P8-koden har avvecklat ersatta BO-/diskgrenar.
Gamla fysiska produktresurser är avvecklade efter diskfri slutkontroll,
med faktisk resursavläsning och omstart. Backupen bevaras.

### Blob är ett gemensamt filarkiv, inte två tjänster

Lagret `store_AqwvebTbBHarOjvG` heter nu `croupier-media-private`, är privat
och ligger i Stockholm. All media har roten `croupier/`; under
`croupier/media/dealers/` ligger Astrid, Vera, Amira och Mei. `source` bevarar
original, `runtime` är spelmedia, `review` är uppladdningar/granskning och
`staging` är arbetsmaterial. `game` och `site` är gemensamma resurser.
Det är filnamnsgrupper i samma Blob, inte separata Vercel-appar eller Render-diskar.

Den gamla roten `astrid/` konsoliderades den 2 oktober: ett äldre zonklipp
flyttades med identisk SHA-256 till `croupier/media/dealers/astrid/source/background-zones/`.
Det lades inte till i det aktiva spelindexet. Tolv äldre `croupier/videos/`
adresser är avvecklade efter verifierad referensmigrering: aktuella Neon-media,
dokument och historik har noll gamla referenser. Faktisk Blob-lista0 och
tolv hash-/storleksverifierade ersättningar finns kvar. Historiska QA-kvitton
och den fullständiga diskbackupen skrivs inte om.

### Vad ligger kvar på Render-diskarna?

**Studio-projekt** betyder sparade presentationsinställningar: val av
dealerklipp, event-/idle-bindningar och regler för när de används. Det är
revisionsstyrda dokument i Neon och deras versionshistorik, inte en extra app eller en
samling spelarkonton. "Lab-projekt" syftar här på samma sparade inställningar,
inte ytterligare ett projekt. Lab är arbetsmiljön; Studio är editorn i den.
Ett **Vercel-projekt** är däremot en webbpublicering, ett helt annat begrepp.

| Tjänst | Monterad disk | Kvarvarande ansvar |
| --- | --- | --- |
| Produktion `croupier-v2` | Gamla 5 GB-disken avvecklad; ingen `/var/data` mount | Aktiv Studio/journal i Neon och beständig media i privat Blob; full extern historisk backup bevaras |
| Isolerad QA `croupier-vercel-preview-qa` | `/var/data`, 1 GB | QA:s separata Studio-/arbetsdata och cache; inte produktionskonton |
| Director `croupier-lab-director` | `/data/catalog`, 1 GB | Katalog, historik och Companion-databas |
| Gateway `croupier-lab-openclaw` | `/data/openclaw`, 1 GB | OpenClaw-konfiguration, agentfiler, sessioner och sökdatabas |

Diskarnas montering/storlek och produktens Blob/Postgres-konfiguration är
kontrollerade live. Produktens fullständiga inventering och externa backup
är verifierade: 206 filer/10 mappar. Konton, spelar-ID:n, saldo, rundor och
Studio-state har Neon som aktiv källa. Blob innehåller mediefiler.
QA-, Director- och Gateway-diskarna behålls; de är inte P8-raderingsmål.
Full extern Director-/Gateway-backup är ett separat kvarvarande ansvar.

`croupier-player-preview-qa` bär lagringskopplingar och är ingen dubblett.
Testbackenden `croupier-vercel-preview-qa` startas bara på begäran.
Frontend-Preview kan peka mot produktion; syntetiska konton/rundor kräver
isolerad backend och annat hostname. Game-Neon är aktivt sedan 2 oktober
efter verifierad produktionsimport och separat återläsningsprov. Spelklientens
gränssnitt finns på Vercel och det gemensamma privata Blob-indexet är aktivt.
Bevarade SQLite-filer är historisk rollbackkälla; starta dem aldrig blindt
efter nya PostgreSQL-skrivningar.

`presentation=local` betecknar gemensam presentation även i molnet.
Speluppspelning, Studios observation och genererat tal/video är olika flöden.
Aktiva klippval sparas i samma Studio-projekt. Originalmotorernas exakta
bindningar ligger i `legacyClipPolicy`, Astrids gemensamma spelväg i
`mediaPolicy`/`idlePolicy`. Äldre BO-val bevaras för granskning och explicit
exakt import. BO:s gamla tilldelningsskrivning är avvecklad (HTTP 410).
Nativekvitton visar vad spelet faktiskt presenterat; Partner-SSE är diagnostik.
Vercel visar spel, BO och Lab. Två native Node-funktioner för `/speech-stream`
och `/lipsync-worker` vidarebefordrar WebSocket till Render efter dess autentisering;
gränserna är 300 respektive 600 sekunder. API/SSE, spelmotor och sparade projekt
finns kvar på Render. Lab följer en spelfliks verkliga kvitton utan extra uppspelning.
Privat Blob läses genom servern; frontend får inga modell-/lagringsnycklar.
Zoner använder `CROUPIER_ZONES_DATABASE_URL`, inga generella DB-fallbacks.
Vercels projektkoppling kopierar inte hemligheter till Render.

## Lokal start och sökning

```powershell
node lab/start.mjs --offline --no-open
```

Detta är en tillfällig isolerad preview när start faktiskt är begärd.
`Start-Lab.cmd` använder sparad ansluten profil. Följ
[labbguiden](../lab/docs/README.md), sessionvakten och utskrivna adresser.
Kör ett enda produkt-/labbpar; bevara data och browserutkast.

`.ignore` begränsar vanliga ripgrep-sökningar. Cursor-ignorefilerna utesluter
beroenden, byggcache, binärer och privat lokal data från kontext/index.
De ändrar inte Git-spårning, byggen eller filernas existens. Sök riktat i
källtext och JSON-metadata. Kringgå inte personarkivets läsgräns med
`--no-ignore`, Git-historik eller backup.

## Leverans och kontroll

Registrera filanspråk enligt `agent-talk/README.md`; ta `.git` vid commit.
Före integration/push:

```powershell
node tools/croupier-chef.mjs status
node tools/push-github-work.mjs --check
node tools/push-github-work.mjs
```

Pushhelpern verifierar repo, `main`, fast-forward och matchande remote-SHA.
Ingen force-push, branchradering eller annan destination är tillåten.
Hooks i ny checkout: `git config core.hooksPath .githooks`.
Verifiera GitHub checks och avsedd driftcommit; GPU-image är separat release.
Tester/hashar godkänner inte synk, fysisk mobil/Safari eller backup i drift.

Rena dokumentations-/index-ignore-commits kör snabba env-, GitHub-policy-
och hooktester. Kod, konfiguration, tester och media kör hela regressionen;
CI kör alltid full. Manuell full kontroll: sh .githooks/pre-commit --full.
node tools/precommit-checks.mjs --plan visar valet för aktuellt Git-index.

Källmaterial: pipeline/ innehåller mediebygge och obligatoriska audits.
Tidigare content/, assets/ och Emil-bank är flyttade till gemensam media:
`media/dealers/<dealer>/{runtime,source,review,staging}`, `media/game` och
`media/site`. ID, hash, kalibrering och historisk proveniens bevaras;
`media/layout.json` kopplar exakt gamla paths/URL:er. Licenser och underlag
följer källorna. Nya mappar är ansvar/usage, inte påstått godkänd videokvalitet.
Obsoleta random-stuff-jakob/ och rotens daterade
ANDRINGSLOGG-V2.md är rensade; aktuell status finns i JOHN-HANDOFF.md.
