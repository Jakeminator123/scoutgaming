# Aktuell handoff — Croupier

Uppdaterad 5 oktober 2026. Detta är den enda löpande John-handofffilen.
Nuläge och kvarvarande krav står nedan; äldre checkpoints är inte aktuella instruktioner.
Detaljhistoriken finns oförändrad i Git-snapshot
[`91d0c4d9edcf27bd4fd5c76524185fa92e0551b9`](https://github.com/Jakeminator123/github-work/blob/91d0c4d9edcf27bd4fd5c76524185fa92e0551b9/docs/JOHN-HANDOFF.md).
Ingen ny arkiv-/rapportmapp skapas och privata kvitton flyttas inte.

## Börja här vid övertagande

Arbeta i `C:/Users/jakem/Projects/croupier`, på main i `Jakeminator123/github-work`.
Läs `AGENTS.md`, `agent-talk/README.md` och
[masterplanens aktuella checklista](CLOUD-MIGRATION.md#checklista-och-beroenden).
Läs [återställningsreglerna](ENVIRONMENT-RESTORATION.md) före spel-/mediaändring.
Kontrollera Node/engines/pins; senast använd Node är 22.22.2, Lab kräver >=22.16.0.
Använd den absoluta agent-talk-tavlan i huvudcheckouten; claim före edits.
Endast MERGE integrerar och pushar via `tools/push-github-work.mjs`.
Jakobs särskilda migrationsmandat tillät egna taskbrancher/worktrees;
det är inte en generell instruktion att skapa fler. GitLab/Jira/CAC är pensionerade.

Uppdatera de fem befintliga docs och labbguiden, inte nya sprint-/statusrapporter.
Starta inga lokala servrar om start inte är begärd. Ett koordinerat produkt-/labbpar,
`--no-open` från Codex, samma spel-/Studioflik och bevarade utkast/spel gäller.
Stoppade servrar förblir stoppade. Ordinarie sökningar följer `.ignore`.
Det pensionerade privata personarkivet får inte läsas via sökning, Git eller backup.

## Verifierat nuläge och leverans

MERGE har återläst följande 5 oktober före det avgränsade städ-/UI-slutpaketet.

| Yta | Verifierad version / kvitto |
| --- | --- |
| GitHub main | `6b9dad55ced03ee0573e24b472b4dcbba2b97776`, pushad/remoteverifierad |
| CI | `37252007240`: tre jobb success; senaste fullhook före detta paket 1 491 PASS/9 befintliga skip/0 fel |
| Produkt-Render | LIVE `dep-db1fvkuq1p3s73f9gla0`, finished `2026-10-05T01:40:59.149237Z`, samma SHA |
| Vercel frontend | READY `dpl_7X9A5Gq5Kjs2CVAcbijrUr6bgfGk`, samma SHA |
| Vercel Studio | READY `dpl_GgTwovLAM42B3v8cWVJK1mETPbNt`, samma SHA |
| Director | `ee0608044f7c78b80c4f46023cd67a7b391e17f0`, LIVE `dep-db1ek0navr4c73bi1log`; administrationskod oförändrad |
| Bevarad QA | samma `ee060804`: Render LIVE `dep-db1em4ad0e5s73fcv3f0`, frontend/Studio READY, 37 envvärden oförändrade, AI/GPU OFF |

QA:s Vercelkvitton: `dpl_8dp5dw8b38ubwLVCtJQT6mJvhDd1` och
`dpl_8fEjyiBqhGtx5ohPQKtkcmMvALGS`; alias-CAS/färsk GET och health200 PASS.
Genererat tal, streaming, tal-preview, cloud-tal, kamera, Lissabon-profiler och
native-admin är OFF; inga Cartesia-/RunPodnycklar finns i QA. Disk/SDK/data/journaler består.
QA behålls OFF; inga nycklar, provjobb eller QA-deployer ingår i detta slutpaket.

App/UI/medieläsarbytes till och med `6b9dad55` är oförändrade mot
`ebbbeb764aa9b42613596049887c178e5a9c1818`. De autentiserade UI- och media-
kvittona nedan gäller `ebbbeb76` och oförändrade bytes. Paketet nedan ändrar två UI-flöden.
P0–P5 och P7–P9 är verifierade enligt checklistan; **full P6 är fortfarande öppet**.
Tidigare 80/20 och ”0 % kvar” var grova/kategoriska migrationsbesked, inte helhetsacceptans.

### Avgränsat slutpaket: dokumentstädning och två UI-rättningar

Åtta referenskontrollerade gamla filer tas bort: fem under `docs/animation-events/`,
den daterade `docs/releases/dealer-v2-2026-09-20.manifest.json` och Polarlotto-PDF/text
om andra operatörer. De omfattade 1 143 070 byte och kan återfås ur Git `6b9dad55`.
Inga aktiva videofiler/pipelines tas bort. Två `docs/qa`-kvitton med kvarvarande
takeacceptans, `dealer-sync-baseline.json`, miljöregistret och systemkartan bevaras.
De tre övriga tekniska guiderna kortas till aktuella regler; gamla produktdisk-
återställningskommandon och ersatta QA-checkpoints tas bort. `.env`/providerinställningar
ändras inte. Markdown/JSON är dokumentation och kontrollindata, inte processmiljö.

Backoffice slutar hämta oanvänd data: Drift behöver overview/shoes, Bord behöver config.
Session- och behörighetskontroll behålls vid varje läsning. En gammal Idle-feltext rensas
först när aktuell idlefilm faktiskt visar en bild; sena callbacks och nyare actionfel
skyddas. Detta löser den kvarliggande texten, inte den historiska frame-varningens orsak.
30 administrationsprov och sju riktade spelarprov, TypeScript och dealer-audit med
`--probe` passerar. Obligatorisk fullhook/CI och faktisk slutversion redovisas vid leverans
i befintliga privata `lab/data/platform-private/docs-cleanup-final-20261005.json`.
Färskt isolerat browserprov: Astrid Mobile, `goodluck` två gånger i följd, 2/2 completed,
video readyState4 och löpande media-tid; ingen idle-feltext. Den äldre SQLite-fixturen
injicerar inte den serverägda lane-bindningen och väljer därför Astrid även med annan
dealerquery. Övriga tre har inte fått ett nytt browsergodkännande här. Provfliken och
testservern är stängda, sessionsguard/listeners fria; ingen databas/provider i drift berördes.

## Studio, OpenClaw och systemkarta

### Aktiva Studioflöden

Tre huvuddelar: Dealer & klipp, Backoffice och OpenClaw. Dealerarbetsytorna använder
egna exakta register; Astrids policy kopieras inte till andra dealers.
Backoffice visar elva aktiva sektioner. Overifierade pitboss-/turneringsformulär och
två informationspaneler är borttagna ur menyn, inte ur API/schema/behörigheter/data.
Lane-/konto-/nyckelåtgärder och talgranskning är utfällbara; utkast/revisionsskydd består.

Idle-felet `studio_native_unavailable` kom från den avvecklade diskskanningen.
`archiveSource=emil-default` får inte initiera den. Cloud Studio läser banken med GET;
äldre POST `/videos/rescan` är en autentiserad färsk registerläsning utan import/mutation.
26 riktade UI/API/uploadprov PASS; ingen användarfilm skrevs över i driftprovet.

OpenClaw-fliken läser/sparar huvudmodell för fem befintliga agenter med Studio-
adminsession, signerad serveridentitet och native CAS. Fallbackordning bevaras;
versionskonflikt behåller utkast och save kräver faktiskt kvitto/readback.
Runtime-tokenet administrerar inte Gateway. OpenClaw 2026.9.5/protokoll 4 och
device-pairing gäller; auth/verktygs/providerinställningar exponeras inte i klienten.
Server-only production `OPENCLAWAPI_KEY` ligger i Vercel Studio;
Director använder `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY`. Privat återställningsfil:
`C:/Users/jakem/CroupierBackups/openclaw-studio-admin-device-20261005.json`.

No-op-save-rättningen i `ee060804` godtar hashfritt `noop:true` bara för konsekvent
oförändrad modell och tom changedPaths. Övriga kvitton kräver hash.
19 backend/transportprov PASS. Faktiskt save/readback PASS: `saved=true`,
oförändrad revision/alla fem modeller, `restartScheduled=false`, GET `applied=true`.
Ingen automatisk andra skrivning, omstart eller providerdispatch.
Privat `lab/data/platform-private/openclaw-admin-noop-receipt-20261005.json`.

### Verifierad layout och kontrollgränser

På `ebbbeb76`: autentiserad UI PASS vid 1486/1265 px och 390 px viewport:
Idle, tio deal-/sjutton replikkort med öppna inställningar, Probe/dealerbyte,
Backoffice-lane/kontodisclosures och fem OpenClaw-modeller. Ingen observerad
horisontell överrinning; Idle-listan 1 094→663 px, preview readyState4.
53 riktade prov/TypeScript/Nextbygge PASS före integration.
Privat `ui-final-pass-receipt.json` och bilder:
`C:/Users/jakem/.codex/visualizations/2026/10/04/01a108f1-324a-7c31-b5af-ad71943dada3/`.
Viewport återställd, utkast/flik bevarade; inga save/upload/delete/providerjobb i provet.

Tidigare `7d7814db0da0b5418a3965a8342d8a4c4db9b086` hade 77 riktade prov
och riktig Vercel-layout vid 1285/390 px. Standardpreview blackjack.mp4 gick
till slut, 4,5 s/readyState4/video.error=null. Det är klippgranskning, inte
full spel-/lane-acceptans. Den statiska offline-layoutbilden är återkallad som bevis.
Råfilsradering saknas i UI; avstängning ändrar policy och behåller råfil.
Separat faktisk upload/delete-/lane-acceptans får inte härledas ur layoutproven.

Menyfördröjning är delvis åtgärdad: oanvända GET tas bort i slutpaketet ovan.
Drift går från fyra till tre sessions-GET och tre till två administrations-GET;
Bord från tre till två respektive två till ett. Ingen authcache införs.
Kvarvarande enskilda auth/session-GET200 observerades historiskt
1,3–6,45 s, statiska anrop mest 0–15 ms. En äldre BO-laddning var cirka tio
sekunder med fyra sessions- och tre administrations-GET. Ingen isolerad rotorsak
eller aktuell totalmätning; inget bevis för freeplan-, Render- eller providerorsak.

### Systemkarta

[Fristående HTML](system-map/index.html) har klickbara rutor/pilar, tre grafvyer,
zoom/pan/filter och käll-/testdetaljer. JSON registrerar 23 kontrakt, 57 Nextfiler,
49 tabeller/299 kolumner, 49 PK/22 explicita FK. Faktiskt Gitträd binds med `--ref`.
Passiv fullhookreporter ger maskerade bevis utan omkörning. CI producerar HTML/status/
kvitto för exakt SHA, artifactretention 30 dagar. Konkreta katalogfel stoppar commit/push;
källdrift varnar. Grått/gult blir inte grönt utan relevanta aktuella prov.
Detta ändrar inte branch protection eller verifierar providers/databaser live.

`91d0c4d9`: 19 gröna, 0 röda/gula, 4 grå kontrakt, 0 errors/warnings.
Grått: saknat explicit reporterkvitto för game-events/zonprov respektive skippade
verkliga Postgresprov; inte bevis för produktionsparitet. Privat:
`lab/data/platform-private/ci-91d0c4d9-system-map-{status,evidence}.json`.
HTML: `C:/Users/jakem/Downloads/Croupier-systemkarta-91d0c4d9.html`.
23 riktade prov och oberoende läsgranskning utan konkreta fynd. Node24 cancellation-
fixturen är rättad med explicit abort/5 s yttre gräns; 23/23 PASS på Node22.22.2
och Node24.21.0 med dubbla CI-reportrar. Verkliga fel/timeouts förblir fel.
Syntetiska UI-prov PASS; automatiserat fil-URL-browserprov blockerades av policy,
inte genomfört. Inga alternativa omvägar eller nytt runtimebevis påstås.
Fortsatta faktakrav ligger i [plan 02](../planes/02-systemkarta/PLAN.md).

### Dokumentstädning

`91d0c4d9` tar bort tre ersatta Lab-dokument och redundant `Start-Lissabon.ps1`.
Giltiga take/preview/tillgänglighetsregler och dagens upload/save-knappar finns i
[guiden](../lab/docs/README.md#material-och-granskningsregler); schemaöversiktens länkar är lagade.
26 lokala länkar PASS. `Start-Lab.cmd`, `Start-Lissabon.cmd` och Start-Labb-paret består.
Den här tvåfilsomskrivningen komprimerar endast checkpoint-historik;
kod, media, miljö, register och privata bevis ändras inte.

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
Lissabonbackup: `C:/Users/jakem/CroupierBackups/lab-consolidation-20261002`;
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

### Kända öppna kvalitetsfrågor

- Ny mänsklig läppsynk-/takeacceptans, råfilmernas kortkontakt
  (`calibratedContact` kan vara false), full P6 och naturligt live-provider-COMPLETED.
  Orsaken till idle-observationen `Film ended without a presented frame` är okänd;
  den kvarliggande feltexten efter fungerande idle är rättad separat ovan.
- Fysisk mikrofon/kamera, mobil/Safari och riktig mikrofon→svar. Kameraflaggan är
  ON i produktion; observation/transcription/vision gav200/enabled och ett syntetiskt
  translationsprov gav förväntat svar, kostnad okänd. Det är inte fysisk acceptans.
  Inspelning är OFF vid sidöppning; samtycke/behörighet krävs, bilder kräver Luna/Terra.
- Latens/kallstart: historisk varm stream ready 4,524/start 9,803/första bild 9,809/END 12,703 s;
  tidigare ready 52,3 s är möjlig kallstart, inte fastställd providerorsak.
  BO/sessionfördröjningen ovan är separat, utan rotorsaksbevis.
- Produktionsmail och full användbar invitation/reset. Ett enda godkänt QA-invite
  3 oktober 15:31:35 UTC gav emailSent/delivered men hamnade i Skräppost.
  QA-testkontot/tokens raderades före STOP; invitationen får inte användas.
  Ingen recreate/resend/nyinvite följer automatiskt. Resend Free/domänverifiering
  och QA-only sender/key-konfiguration är inte produktionsacceptans.
  Privata `mail-resend-qa-connect/` och `mail-resend-qa-cleanup-confirmed-result.json`;
  cleanup-SHA `1f3978ba4e58bab9e22e75e32fe8357911ba34c2b17b2e97809c6a9bbcabeb23`.
  Färsk Vercelläsning 5 oktober: produktions-Studio har tom `RESEND_API_KEY` och
  saknar `CROUPIER_STUDIO_MAIL_FROM`. QA:s befintliga nyckel gav HTTP401 vid GET
  `/domains` hos Resend. Det fastställer inte nyckelns rätt att skicka, men verifierar
  heller ingen produktionsavsändare. Ingen nyckel kopieras eller något mejl skickas.
  Nästa steg är en giltig Resend-anslutning för `no-reply@scoutgaming.tech`, därefter
  konfigurering/readback och ett uttryckligt beställt användbart invite-/resetprov.
- Historisk Next.js-byggvarning GHSA-vcvr-r3jv-pc5j noterades; ingen användarstyrd
  next/og-SVG-route hittades då. Aktuell beroende-/advisorystatus är inte omverifierad;
  ingen automatisk audit fix eller beroendeändring ingår här.
- Full zonlagringsacceptans, startsidesflimmer och extern Director/Gatewaybackup
  kvarstår där de inte täcks av avgränsade prov. Datorintro cleanup är verifierad;
  mobil/surfplatta laddar inte introvideor. GitGuardian har sex öppna incidenter och tre locationluckor.

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

## GitGuardian — nuläge och historisk triage

Färsk läsning via befintlig MCP, återgiven av MERGE 5 oktober: avsedd workspace
795524/source 30689542/repo `Jakeminator123/github-work` verifierad.
Komplett incidentlista: en incidentsida/elva locationsidor, fem IGNORED och sex
TRIGGERED. Locationtäckning partial för 37828691/37830671/37862641.
Safe kvitto: `lab/data/platform-private/gitguardian-read-20261005.json`.
GitHub check-runs/suites/status på 6b9dad55 är komplett; GG-suite queued/inga runs.
Grön vanlig CI/queued/neutral/skipped är inte incidentfrihet.

| Öppna incident-ID:n | Lästa metadata, inte verifierat falsklarm |
| --- | --- |
| 37862641 | Filmetadata saknas |
| 37863164, 37863165, 37863166 | `ops/cloud/test/container-entry.test.mjs`, positioner 34/35/46/47/48/55 sammantaget |
| 37867511, 37867512 | `docs/system-map/contracts.json`, positioner 196/499; aktuell kod där är SHA256-indatahashar |

Scanner-match/secretvärden har inte lästs; inga incidenter resolve/ignored eller
skrivrättigheter skapades. Alla sex ska redovisas som öppna, inte automatiska fixtures.
Fil/rad-luckorna består även när hela incidentlistan är komplett. Direkt avläsning av
de tre locationsvaren gav HTTP200 med tom lista och ingen nästa sida, inte parserfel.

Historiskt efter Jakobs uttryckliga triageuppdrag 3–4 oktober: fem testcredentials
IGNORED/0 OPEN med en incidentsida/fem locationsidor. Dagens lista bekräftar dessa fem
IGNORED men också sex nya öppna; äldre 0 OPEN är inte nuläge.

| Historiskt IGNORED-ID | Verifierad fixtureplats |
| --- | --- |
| 37827237 | `lab/test/studio-native-{runtime,request}.test.mjs` |
| 37828386 | `ops/cloud/test/container-entry.test.mjs:30` |
| 37828691 | `ops/cloud/test/storage-export.test.mjs`; API-location saknades |
| 37830671 | `test/studio-cutover-integration.mjs`; två webbplatser, API-location saknades |
| 37840514 | `ops/cloud/test/native-p6-router-hook.test.mjs` |

Triagen märkte testcredentials, inte återkallade produktionsnycklar.
Befintlig läsbrygga `tools/gitguardian-mcp.mjs`/`gitguardian-read.mjs` är GET/metadata/
repo-låst; årsnyckel endast incidents:read/sources:read, Windows-DPAPI utanför Git:
`C:/Users/jakem/.codex/private-connections/gitguardian-795524.dpapi`.
Privat `migration-root-gitguardian-mcp-verified-20261003.json` är historiskt kvitto.
Bind avsedd repo/workspace/source varje gång. Exponera bara app/name/status/conclusion,
numeriska incidentlänkar och repo-relativ fil/rad/tid, aldrig scannertext/secrets/
rå annotationsmeddelanden/tokens. Ingen ny scope/token/scan/write automatiskt.

## Kort tidslinje — historik, inte nya order

| Datum / källa | Bevarat resultat och avgränsning |
| --- | --- |
| 2 oktober, `22dca5c4` | Neon game/auth och privat Blob/transport infört; 14/14 inspelade plays, inte mänsklig syncapproval |
| 3 oktober, `190399` | native90/90 och SQL41/retained4; betald helhetsacceptans saknades |
| 3–4 oktober, `e461ef07` | gemensamma credentials/auth och SDK 7.12.1 installerat; specifika browser/readbackkvitton |
| 4 oktober, `5fca8983`→cc77→b0bc | fullfilsdelprov, misslyckade fönster append-only stängda, faktisk stream-END; kostnad okänd |
| 4 oktober, b0bc→`9ba2fd05` | samordnad import/policy/alias/provideraktivering, backup och fysisk P8 efter ALL0/paritet |
| 4–5 oktober, `3da83bf8`/`5270c8ab` | fysisk mic/kamera ej provad; route/kamera-config, shutdown/zon/OpenClaw-rättningar verifierade avgränsat |
| 5 oktober, `8f265831`→`ee060804`→`ebbbeb76` | Mobile/lane-register, source/staging/dedup, no-op-save, UI/karta; inga nya take-approvals |
| 5 oktober, `91d0c4d9` | sexfilsdokumentstädning/slutkvitton, CI3PASS och faktisk LIVE/READY; appbytes oförändrade |

Alla tidigare intentions-/FAIL-/cleanupkvitton, gamla deployment-ID:n, sourcepins,
budgetposter och privata röstinspelningars hashar kan följas i snapshoten ovan.
De är provenance, inte förnyad budget, runtimeidentitet eller order att läsa personarkivet.
