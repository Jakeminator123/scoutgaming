# Aktuell handoff — Scoutgaming

## Dragan: varför svaret visas som text — läsdiagnos 19 oktober 2026

Jakob såg ”Dragans röstvideo saknas. Svaret visas som text.” i produktion
och tolkade det som en saknad inspelad video. Orsaken är en annan: genererat
tal skickas bara när dealerns `speechProfile.state` är `enabled` i Studio och
Render kör `CROUPIER_MOVING_SPEECH_ENABLED=1` (`services/game/server.mjs`
rad 1141–1171, `generated-speech-chat.mjs`). Läst i Admin 19 oktober ~12:00 UTC:
Dragans profil står i `preparation`, Drift visar önskat Av (revision 12),
`connected:false`/`drift_runtime_unavailable` och senaste observation från
POST-LIPSYNC5:s closeout 10:43 UTC. Det är provprotokollets avsedda slutläge,
inte en regression. Klienttexten är ändrad till ”Genererat tal är inte aktiverat
för Dragan just nu. Svaret visas som text.”; `test/chat-decision-player.mjs`
passerar 14/14. Inga serverkontrakt, grindar eller prov ändrades.

Klippinventering ur registret (56 Dragan-filer, alla tillgängliga): 35 Kevin-
tagningar (plats 1–7, öppet/dolt, vändning med i/iv/v/base), 10 äldre `deal_pos*`,
5 grundloopar, båda skövergångarna (`in_vila_till_redo`, `ut_redo_till_vila`)
och fyra inspelade repliker (goodluck, insurance, double, win). I projektet är
goodluck/insurance/double bundna; `win_1` är uppladdad men obunden och övriga
13 repliker, inklusive välkomsthälsningen, saknar film. Skövergångar och
reaktionsfack spelas inte av spelaren ännu oavsett uppladdning. Rummet
`Dragan · dynamiskt taltest` är öppet på paket 4 (publicerat 18 oktober
14:31:54) utan väntande utkast. Radera inte dealern/klippen: bankens 50 källor
hashbinds i `server.mjs` rad 1420–1427 och ger `moving_speech_bank_source_missing`.
Papperskorgen innehåller `paow-kevin` (11 arkiverade filer), `anna-jonsson` (2)
och `adminprov-2026-10-13`; permanent radering är ett separat beslut.
`origin/kevin-staging` är inte mergad i main (190 commits utanför); Kevins
bidrag i main är de registrerade källklippen från PR124/128.

Molnläsning samma tid, inget ändrat: Vercel production
`dpl_FkpqF9VDGiHu8hSzBUZLfEK8qhmY` och Render `dep-dbb001rrjlhs73d2u1eg` är båda
LIVE/READY på main `1c8dc82f`; inga 5xx eller fel i loggarna. Render har
`CROUPIER_MOVING_SPEECH_ENABLED=0` och alla `CROUPIER_MOVING_SPEECH_*`-namn
satta; RunPod-kontot har 0 pods, 0 körande workers och endpoint `zjsdlni6cn8dvo`
(max 1, idle 60 s, CA-MTL-1). Vercel-pluginens anslutning ger 403 för teamet
`scoutgaming`; CLI fungerar. `CROUPIER_STUDIO_MOVING_DRIFT_API/_PROFILES` saknas
i `docs/environment-variables.json` för både Studio och spelservern.

## Kvällsprov med Jakob: budget, spegelfördröjning, grundloopsgrind — 19 oktober 2026, 16:30–17:30 UTC

Jakobs egna försök 16:41–16:47 UTC föll med
`generated_speech_total_budget_exhausted` i chatten visad som den allmänna
texten ”Rösten eller läppsynken kunde inte skapas. Försök igen.”; journalen var
25 reservationer / 30 USD. Åtgärder: amendment `5fa14c5f` (grant 30 → 45 USD,
journalens tak; provider-tak 75 USD oförändrat) och PR296 (`25e80444`) som
visar ”Provbudgeten för läppsynk är slut …” i stället för att föreslå nytt
försök. Ett `moving_bank_rejected code=stale_round_revision` 16:34:56 var inte
ett fel: svaret avbröts för att rundan ändrades under förberedelsen.

Prov 16:51 UTC (”välkommen till bordet, Jakob”) blev klart på servern efter
27 s (`ready` 27,3 s) men klienten stod i ”Svar klart · väntar på ledigt bord”
i över tre minuter. Orsak på klienten: talgrinden öppnas först när dealerns
grundloop visat en bildruta, och grundloopen låg fast i Chromes
”play() request was interrupted because video-only background media was
paused to save power” från när fliken var dold; felkoden ingår inte i
grundloopens omstartslista, så bara omladdning hjälpte. Öppen klientbrist:
återuppta grundloopen när fliken blir synlig igen. Efter omladdning spelades
prov 17:02 UTC (”Välkommen till bordet, Jakob.”) i publicerad spelvy: `ended`,
`completed:true`, 61/61 bildrutor, ström→första bild 21,1 s, helt förlopp
129 s (text + förberedelse ≈ 105 s). Render-loggen hade inga avslag.

Prov 17:04:56 UTC (”Blanka och Zelda är bäst”) nekades av guarden
(`moving_speech_unavailable`, fas guard) efter 3,5 s. Loggen belägger
**spegelfördröjningen vid nedstängning**: arbetaren stängde 17:03:42, podden
försvann ur REST vid 60 s tomgång, och 17:04:44–17:05:01 rapporterade health
fortfarande `running=1` medan REST-listan var tom (samma mönster 16:53:04–:24
och 16:35:58–16:36:14). Observatören nekade varje tick i fönstret. PR297
(`d9c27979`): en enda olistad frisk arbetare utan pågående jobb rapporteras som
ett upptaget jobb (dränering, aldrig kapacitet, aldrig Off); två olistade,
unhealthy/throttled eller jobb utan pod nekas fortfarande. Praktiskt: en fråga
cirka 60–80 s efter föregående svar träffade fönstret; efter PR297 ska den
i stället vänta på ledig plats. Render blev LIVE på `d9c27979` 17:37:15 UTC.
Tre spelade händer 17:36–17:43 UTC (vinst, förlust, bust) körde filmade
giv/hit-klipp utan presentationsfel; inget nytt talprov har ännu körts på den
rättade observatören, så spegelfönstret är rättat i test men inte belagt live.
Jakobs eget prov 17:33 UTC (”?” → ”What's up, Jakob?”, på kod `25e80444`)
spelades: `ended`, `completed:true`, 48/48 bildrutor, ström→bild 13,5 s,
helt förlopp 123 s. Jakob bekräftade i chatten att det fungerade. Kvar för
människa oförändrat: röst/läppsynk-kvalitet, svarstid (~105 s text +
förberedelse före GPU), OpenClaw svarar på engelska på svenska frågor.

Övrigt samma kväll: Vercel `commandForIgnoringBuildStep` bygger nu bara
`main`, `jakob/*`, `codex/*` och `cursor/*` (tidigare hoppades bara exakt
`kevin` över; `kevin-staging`, `roulette-on-kevin-staging`, `emil`, `john`,
`jakob-export` byggde förhandsvisningar). Render `croupier-v2` har inga
PR-förhandsvisningar (`previews.generation=off`, autodeploy `main` efter CI).
Miljövariabler: alla sju obligatoriska `render-game`-nycklar finns på Render;
saknade villkorliga nycklar gäller lokala kataloger, P6-QA, Bettalotto och
lagringsexport, inte Dragans tal. Kevins grenar refererar 40-talet egna namn
(`DRAGGE_LIPSYNC_ENDPOINT`, `RORLIG_*`, `LIPSYNC_POD_*`, `GEMINI_*`,
`CARTESIA_VOICE`, `TABLE_DB` …) som hör till hans separata server under
`kevin/croupier-scoutgg/` och inte används av `main`; inget saknas för Dragan.
Odokumenterade nycklar satta på Render: `CROUPIER_BACKEND_ORIGIN`,
`CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_STUDIO_NATIVE_ADMIN` (ej åtgärdat).

## Bank-403 belagd och rättad; Dragan svarade med tal — 19 oktober 2026, 14:27–14:35 UTC

Med barndiagnostiken från PR292/293 live (`7d9886ce`) och amendment
`cfb73003` (grant 24 → 30 USD, 20 historiska reservationer bevarade) visade
tredje provet 14:28 UTC hela orsakskedjan i Render-loggen:
`moving_drift_readback_failed drift_observation_unverified` varje tick under
jobbet → `moving_drift_guard_rejected phase=dispatch reason=runtime_unavailable
observationAge=missing` → `moving_bank_rejected 403` → `moving_worker_closed`.
Ett läsande prov mot verklig RunPod-REST/health 14:31:01–14:31:12 UTC visade
varför observatören föll: när jobbet dispatchas till en **cachad idle-slot**
rapporterar REST podden `RUNNING` med `jobs.inProgress=1` i cirka tolv sekunder
medan health fortfarande säger `idle=1, running=0, initializing=0`.
Observatörens villkor `initializingPods <= workers.initializing` (1 ≤ 0) föll,
exekutorn ogiltigförklarade observationen och guarden nekade bankhämtningen.
Kallstart (prov 4 kl 09:54) och sena bankhämtningar (prov 14:30) klarade sig
för att health hann ikapp. Det är den historiska bank-403:ans orsak.

Rättning i `moving-drift-observer.mjs`: en levande pod som health ännu inte
räknar som running får förklaras av `initializing` **eller** den cachade
`idle`-slot den värms från, och rapporteras som `initializing` (aldrig ready
eller dold); oförklarade poddar, unhealthy och dubbla slots nekas fortsatt.
Regression med exakt den observerade providerbilden; 163 moving-prov passerar.

Fjärde provet 14:30:49 UTC (”Säg bara: hej igen Jakob.”) gick igenom i
publicerad spelvy: chatten ”hej igen Jakob.”, `generated-lipsync-stream`
`ended`, `completed:true`, 50/50 bildrutor, ljudstart 17,3 s efter ström,
klientens hela förlopp 122 s (varav ~94 s text + förberedelse). Hörbar röst och
läppsynkens kvalitet är inte granskade av människa (`reviewStatus pending`).
Journalen är nu 24 reservationer (2 nekade 403-försök, 1 budgetnekat utan
reservation, 1 lyckat) inom grant 30 USD; cirka tre 1,20-fönster återstår.

**Verifierat på rättad kod:** PR294 mergad som `3fd3b843`, Render
`dep-dbb2tr942hec73e74ip0` LIVE 14:56:34 UTC. Femte provet 15:02:13 UTC
(”Vad heter du och vilket spel delar du?”) svarade ”I'm Dragan, and we're
playing blackjack.” med `ended`, `completed:true`, 71/71 bildrutor, ljudstart
20,5 s efter ström, hela förloppet 117 s; Render-loggen hade **inga**
observations-, guard- eller bankavslag under jobbet. Flaggorna och Sparläge
är kvar på; journalen har efter detta cirka två 1,20-fönster kvar inom 30 USD.
Kvar för människa: hörbar röst, läppsynkens kvalitet och svarstid (text ≈ 80 s
innan GPU-steget startar; se `reply_ready_ms`), samt att OpenClaw svarade på
engelska på en svensk fråga.

## Flaggor på, första prov och synlig barndiagnostik — 19 oktober 2026, ~12:30–12:45 UTC

På Jakobs uppdrag (”sätt på alla flaggor”): Render `croupier-v2` fick
`CROUPIER_MOVING_SPEECH_ENABLED=1` via API (deploy `dep-dbb0r1ff3r2c73frpa2g`,
LIVE 12:33:09 UTC på samma kod `1c8dc82f`); Drift sattes till Sparläge/Basprofil
(revision 13, `connected:true`, `admission.allowed:true`); Dragans talprofil sattes
till `enabled` genom det ordinarie projektskrivaren (revision
`studio-c4666576-db78-421a-a69d-5885c8bc9075`). Flaggorna lämnas på; Av i Drift är
ordinarie stoppväg. RunPod-endpointen har max 1 worker och 60 s tomgång, så
vilokostnaden är noll. Journalens grant 24,00 USD har 1,20 USD kvar efter
POST-LIPSYNC5:s 19 reservationer; fler jobb än ett kräver en ny append-only
CAS-höjning inom Jakobs tak.

**Provet 12:35:30 UTC** (text ”Svara kort på svenska: säg hej Jakob.”, OpenClaw,
ljud på) misslyckades efter 22,4 s i förberedelsen med klientkoden `chat_failed`
(stages text 630 ms, video-queue 4,6 s och 15,6 s). Enda serverloggen är
gatewayns `moving_bank_rejected stage=authorization code=drift_not_admitting
httpStatus=403`: workerns bankhämtning nekades av driftguarden medan jobbet
pågick — samma symptom som det tredje provets bank-403. Guardens exakta orsak
syns inte, eftersom spelprocessens stdout kastas i produktion
(`process-group.mjs`, `stdio:'ignore'`); H6:s `moving_drift_guard_rejected`-
och `readback_timing`-diagnostik har därför aldrig nått Render-loggen. Observationens
ålder i vila är 1,2–3,5 s mot 15 s gräns; under jobb är den omätt.

Rättning i denna leverans: `ops/cloud/child-diagnostics.mjs` vidarebefordrar
endast allowlistade, ändliga barnhändelser (guardorsak, readback-timing/fel,
förberedelse-/strömkvitton med säkra koder och id:n, recovery) till
plattformsloggen med `source:"game"`, högst 2000 rader per process; startrader,
fri text och allt annat kastas fortsatt. Ingen grind, tidsgräns eller budget ändrades.

**Uppföljning 13:42 UTC på main `b018590d` (PR292 mergad och LIVE 13:33):**
nytt textprov nekades efter 8,3 s med `generated_speech_total_budget_exhausted`
— det nekade jobbet 12:35 behöll sin 1,20 USD-reservation, så granten 24,00 USD
är fullt reserverad (20 reservationer). Ett nytt prov kräver en append-only
amendment via `authorizeMovingBudgetAmendment`; dess 50 USD-providertak
(`MOVING_PROVIDER_BUDGET_MAX_MICRO_USD`) är i praktiken nått eftersom alla
äldre fönster räknas som behållna (kalkyl 49,72 USD). Jakob gav 15:45 UTC
mandatet ”om detta inte går har du tillåtelse” med målet fungerande tal inom
några timmar; providertaket höjs därför till **75 USD** i kod (denna leverans)
och en amendment 24 → 30 USD (fem 1,20-fönster; kalkyl 1,02 + 47,00 + 6,00 =
54,02 USD) appliceras efter deploy via journalens `authorizeMovingBudgetAmendment`
med färsk drained-läsning från providern. Journalkapaciteten 45 USD och alla
20 historiska reservationer består. Första vidarebefordran missade dessutom att spelet
loggar dessa händelser med `console.warn` (stderr); `process-group.mjs` observerar
nu båda strömmarna genom samma allowlist, verifierat med en riktig barnprocess.

## Klippnamn och poskedja — 19 oktober 2026

Ny gemensam namnregel i `packages/presentation/contracts/clip-naming.mjs`
(fack + Kevins i/iv/v/base-suffix som poskedja + språk/tagning för repliker)
driver importassistentens filnamnsförslag och täcker alla 36 fack inklusive
skövergångar, reaktioner och VILA/REDO-bilder. Utdelnings-, vändnings- och
övergångsklipp kan nu bära `startPose`/`endPose` = VILA/REDO i klassificeringen
(schema och `validateClipPoses`); importraden visar och låter ändra kedjan,
klippkartan och mediebiblioteket visar den som läsbricka. Deklarationen är
authoringmetadata; spelarens filmade sekvens använder fortfarande den verifierade
profilen. Verifierat: 163 Studio-prov (importkatalog, intake, klient, komponenter),
36 ops-prov, båda typkontrollerna, env-register och orphan-kontroll. Guide i
[README](../apps/studio/docs/README.md) och teknik i
[runtime-referensen](LOCAL-PRESENTATION-RUNTIME.md#klippnamn-och-deklarerad-poskedja-19-oktober-2026).

## MERGE4: verifierad legacy-städning och main-flöde — 19 oktober 2026

Den avslutade registerflyttens `prepareLegacyStudioSnapshot` hade endast
ett eget test som konsument. Hjälparen, det testet och dess enda fullrunnerpost
är borttagna. Två andra testfall som endast låste gamla Control-wrappers har
rensats; sex aktiva komponentprov för dealer-/policygräns och klippval kvarstår.
Oberoende konsumentinventering och egen sökning omfattade kod, verktyg,
guider och CI. Aktiva legacy-fixturer, middleware, klipppolicy och återanvända
Control-redigerare behålls; de har konkreta Admin-/runtimekonsumenter.

Main-flödet och återställningsproceduren finns i CLOUD-MIGRATION,
ENVIRONMENT-RESTORATION och docs/AI/scoutgaming-agentflode. Förbrukade
separata frontend-/Studio-återgångsinstruktioner har ersatts med kontroll av
den samlade produktens faktiska web-/gameversion, schema och miljökontrakt.
Användarsteg, produkttermer och tekniska format behåller sina kanoniska guider.

Egen verifiering: 67 repository-/policy-/kontrollprov samt det isolerade
cutoverprovet och sex kvarvarande komponentprov passerade. Cutoverprovet
kunde först inte laddas utan `ws`; låsta beroenden installerades i denna
arbetskopia och provet passerade därefter. Delade Studio-beroenden återanvändes
först efter identisk package-/lockhash. Ordinarie hook passerade 39/39; dess
första Windows-timeout i ett FFmpeg-fixturprov passerade både separat och vid
hel omkörning. Samlad main har 525 JS/TS-testkandidater och 0 föräldralösa;
Pythoninventeringen är separat. Inga privata data, medier, molninställningar
eller andra agenters arbetskopior rensades.

[PR281](https://github.com/Jakeminator123/scoutgaming/pull/281) är mergad som
f03c5ccf efter grön CI och oberoende slutgranskning utan blockerare. Även
PR278/280/282/283 är mergade. Samlad main
`a2dc503e2c63ef49107c0a1074880349e1898c61` har grön
[main-CI 39206231216](https://github.com/Jakeminator123/scoutgaming/actions/runs/39206231216),
Vercel `dpl_GtYpcfRMYV32jFxGcgcExZziLFhH` READY/www och Render
`dep-dbar0qu7bikc73euh400` LIVE. MERGE4 återläste publik version och hälsa
05:55:42 UTC den 19 oktober. Egen integrationskontroll bekräftar att de sju
pensionerade filerna saknas och de granskade UI-/beteendefilerna är bytebevarade.
Det är kod-/publiceringsbevis; bankens HTTP403 och talacceptans är separata.

## Driftväljare: Av och Sparläge — 19 oktober 2026

HUVUDAGENT6 äger backendrättningen nedan, UI/UX2 Admin och POST-LIPSYNC5
aktivering/prov. API/kontrollplanet i PR270 är mergat via `cb0c3275`. MERGE4
bekräftade PR275:s granskning, grön CI/readiness och publicering på Vercel/Render
från main `087f4fd5f8b354371521d49c52d8ab210f9ee6b0`. Det är tillskriven
publicering, inte HUVUDAGENT6:s GPU-/talacceptans.

GET/POST återanvänder N1, färsk session, origin/CSRF och miljö/workspace.
Behörighet och POST-state delar SQL-transaktion. Browserkontraktet är oförändrat;
önskat läge är aldrig ett kvitto på genomförd GPU-drift. `connected` kräver nu
en matchande färsk executorlease/observation i samma databas, inte bara en envflagga.
Första runtimekopplingen gäller exakt en verifierad profil/endpoint med min0/max1,
Av och Sparläge. Varm drift och jämförelse/profilbyte är inte anslutna.

Talets första admission-token bevaras genom förberedelse och väntan. SQL-journalen
kontrollerar den atomiskt vid reserve/current/submit och sist före provider-POST,
i låsordningen Studio → drift → speech. Av revokerar äldre försök; en snabb
Av → Sparläge behåller krav på avbrott/drain. Sessionsavbrott, bankhämtning och
tal/utdata använder samma token. Astrid behåller sin tidigare journal utan hook.

Executor gör endast leverantörsläsning och avbryter journalägda jobb. Den skapar
eller ändrar ingen endpoint. Ny/felande/gammal observation blir unknown; Av
kräver färsk tom leverantörskapacitet och tömd journal. Health/deploymentdata
påstår aldrig att modell/bank redan är varm. Befintlig exakt runtimeattestering
och faktisk kostnadsreservation gäller fortfarande vid varje talstart.

Gräns: avbruten eller okänd submission utan känt jobb behåller reservation och
kan hålla status i stopping/blockera nästa körning. Ingen automatisk återhämtning,
återbetalning eller retry hävdas. Ett redan tillåtet/pågående nätanrop kan inte
göras oskickat av Av; det hanteras som pågående/osäkert tills kvittot kan verifieras.

SQL017 är nu required efter POST-PISYNK4:s verifierade apply 19 oktober 02:32:59 UTC
(endast 017; äldre ledger oförändrad). POST verifierade även enbart 016 apply
03:02:56 UTC med oförändrad ledger/budget och tom kontrolltabell. Det är
tillskrivna kvitton, inga egna molnkörningar. 016 är fortsatt deployment-optional
i manifestet; runtime kräver installerad tabell och separat aktivering.
Verifierat på föregående `c5c85bda`: 209 fokuserade tester samt 29 legacy- och 77 integrationskontroller
i verklig isolerad SQL/HTTPS/omstart, plus fyra mediekontraktsprov. Både Windows
och sista Linux/WSL-provet använde Node 24.21.0. 214 namngivna källfiler var
oförändrade genom det breda provet; detta är inte liveprovider- eller GPU-acceptans.
De två importernas dubbla schema-listor ersattes med gemensam required-readiness;
installerad ledger och rollback kontrolleras fortsatt. Egna fixturekluster och
den tillfälliga Linux-Node-installationen rensades efter provet.
Sluträttningen klarade 39 fokuserade och fem browserbindningsprov; integrationen
med PR274/main `b3ff83d4` klarade 125 prov. PR275:s slut-CI/readiness passerade
enligt MERGE4; den separata konfigurationsrättningen nedan har egen CI.
Inga molnvariabler, produktionsdata, mediefiler eller GPU-jobb ändrades här.
[Tekniskt kontrakt](LOCAL-PRESENTATION-RUNTIME.md#driftvaljare-kontrollplan) och
[serverkonfiguration](ENVIRONMENT-VARIABLES.md#driftvaljarens-api).

### Säker driftorsaksdiagnostik — HUVUDAGENT6

Det tredje produktionsprovets bank403 är fortsatt olöst; POST:s exakta
prov-/stopp-/budgetkvitto finns i [egen sektion](#post-lipsync5-produktionsprov).
En kontrollerad offlinekedja visar att 2 s pollintervall +14 s lyckad läsning
kan ge 16 s gammalt föregående bevis och nekat dispatch utan readback-fel.
Det är en reproducerad mekanism, inte prov3:s fastställda historiska orsak.

Diagnostiken fångar nu första fallande guardorsak/fas, ändliga ålders-/
leaseklasser och matchningsbooler från samma nekande SQL-state/DB-klocka.
Allowlistad metadata överlever felkloningen; loggning sker först efter
kvitterad rollback. Läsvarvens ändliga fas/tidsklass skiljer långsam success
från failure. [Kanoniskt loggkontrakt](LOCAL-PRESENTATION-RUNTIME.md#driftvaljare-kontrollplan).

191 fokuserade observer-/executor-/controller-/diagnostik-/SQL-journal-/
session-/runtime-/bankprov passerar med Node24.21.0 och fyra workers.
De täcker orsaksprioritet, samma snapshot utan extraläsning, rollback/ACK,
metadata/getter/proxyfiltrering, loggerfel och långsam lyckad läsning.
CI upptäckte att det nya säkerhetstestet saknade fullsvitsregistrering. Det
är nu inkopplat i befintlig database/moving-drift; orphan-grinden behålls.
SQL-fixturens befintliga källista hashbinder också den importerade hjälparen.
Kontrollen finner 526 JS/TS-testkandidater och 0 orphans; registrerad grupp
passerar 66/66. Verktygsproven ger 17 PASS och fem POSIX-fall är explicit
överhoppade på Windows. Ingen orphan-exception eller grind har ändrats.
Oberoende slutgranskning fann inga blockerande fynd. POST:s överlämnade
stoppcommit7def8fe9 är integrerad med egen sektion bevarad.

Inga freshness-, Av-, fence-, auth- eller budgetgrindar sänks. Publika felkoder,
bankheader, providergränser och scheman är oförändrade. Inga moln-, GPU-,
finansierings- eller migrationsåtgärder gjordes. MERGE4 äger slutlig CI,
granskning och publicering; POST äger eventuellt senare avgränsat prov.

### Gateway-RPC: deterministiskt deadlineprov — HUVUDAGENT6

MERGE4 rapporterade att PR288:s OpenClaw-prov nådde korrekt timeout men fick
noll serveranslutningar i stället för testets förväntade en. En isolerad lokal
WebSocket med 120 ms fördröjd handskakning reproducerar detta: klientens
40 ms-deadline avslutar säkert innan någon serveranslutning registreras.
Det är ett race i testantagandet, inte bevis för ett produktionsfel.

Deadlineprovet använder nu befintlig WebSocketImpl-injektion för tyst
handskakning respektive obesvarad config.get. Verklig klienttimer är kvar;
exakta frames, en konstruktion och en stängning verifieras. config.patch
ligger efter lyckad get och skickas därför aldrig vid timeout. De övriga
riktiga WebSocket-proven för signering, scope/version och osäker mutation
är bevarade. 13/13 prov och oberoende läsgranskning passerar utan blockerare.

Endast testet och denna handoff ändras. Produktkod, tidsgränser, auth,
OpenClawkonfiguration, moln, media, GPU och budget är orörda; PR288 hålls
fryst i den leveransen. PR289 är nu mergad/publicerad med full grön main-CI
39218098988 på2c7f1c0e enligt MERGE4:s publiceringskvitto.

### Cacheinitialisering och pinnad session — HUVUDAGENT6

Ett offlineprov visar att driftobservatören avvisade färsk providerdata med
exakt aktuell EXITED-cache och en extra initializing-räknare. Samma kalla
form godtas redan av kapacitetskontraktet. Avvisningen fick executorn att
ogiltigförklara observationen; controllern nekade då nästa current/dispatch
med `drift_not_admitting` trots oförändrad pinnad session.

Observatören räknar nu bara den extra initialisering som styrks av aktuell
scaled-down-cache med exakt image/version och `isStale:false` som cache.
Verkliga pods, oförklarade räknare, okända workers, färskhet och min0/max1
kontrolleras fortsatt. En cachepost blir aldrig modell-/bankattestering.
Ingen admission-, SQL-, lease-, Av- eller budgetgrind har ändrats.

Tre nya positiva regressioner föll före rättningen. Efteråt passerar 180
observer-/executor-/controller-/kapacitets-/provider-/SQL-journal-/session-/
runtimeprov med Node 24.21.0 och fyra workers; ordinarie hook passerar 28/28.
Provet med verklig observer/controller/executor behåller current/dispatch
för samma pinnade jobb, spärrar ny admission/reserve och nekar efter Av.
Saknad, gammal eller felaktig cache samt oförklarad kapacitet förblir nekade.
Oberoende läsgranskning fann inga blockerande fynd.

Det historiska felet 06:41:32 UTC saknar motsvarande exakt health/pod-snapshot.
Detta är en verifierad kodmekanism, inte bevis för just den körningens orsak
eller fungerande bankhämtning i produktion. POST:s stopp-/budgetkvitto och
återstående talacceptans finns i
[produktionsprovet](#post-lipsync5-produktionsprov). Inga moln-, provider-,
GPU-, finansierings- eller medieändringar gjordes i rättningen. MERGE4 äger
slutgranskning, CI och publicering; ett nytt betalt prov kräver nytt beslut
och ett faktiskt finansierat fönster.

### Avslutat providerjobb före callback — HUVUDAGENT6

POST-LIPSYNC5 belade 19 oktober att ett providerjobb blev `COMPLETED` med
workerresultat `failed/bank_http_rejected` redan vid receipthämtningen. Ingen
callback öppnades, men `ready()` väntade tidigare på den upp till startupgränsen.

Väntan övervakar nu det redan accepterade jobbets status och avvisas med den
befintliga säkra koden `moving_worker_closed` när jobbet är terminalt före callback.
Ordinarie cancellation/journalfinalisering gäller fortsatt; inga nya betalda
försök, återbetalningar eller ändrade timeout-/budget-/workergränser tillkommer.
Okänd providerstatus behåller callbackens ursprungliga tidsgränser och reservation.
Övervakningen upphör vid readiness/fel och bevarar callbackens eget abort-/attestfel.

Terminalregressionerna visade felet före rättningen. 129 session-/runtime-/provider-/
journalprov samt 38 transportprov passerar efteråt, inklusive användarabort under statusläsning och sent
terminalsvar. Gatewayns låsta `ws` installerades i denna arbetskopia för proven.
Oberoende läsgranskning fann inga blockerare. Bankens faktiska HTTP403 har ett
separat diagnosspår hos POST-LIPSYNC5; rättningen bevisar varken fungerande
bankhämtning eller godkänt tal/uppspelning. PR284 är mergad och publicerad;
POST:s andra produktionsprov nedan bekräftar felavslut efter 16,1 sekunder.

### Molnstart: driftprofil till spelprocessen — HUVUDAGENT6

Molnstartens explicita child-env tappade `CROUPIER_STUDIO_MOVING_DRIFT_API` och
`CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`. Vid talflagga 1 blir då driftkonfigurationen
null och executorn avvisar initieringen. Det är ett reproducerat kodfel, inte
bevis att den historiska misslyckade deployen hann fram till just denna grind.

`codex/moving-drift-cloud-env` validerar en enda profil och exakt endpoint/release
i preflight. Endast det validerade JSON-värdet och flagga 1 går vidare till
spelprocessen när tal är aktiverat; Lab och avstängt läge får inga driftfält.
Bankhashen verifieras fortsatt mot verkligt bankarkiv av befintlig runtimegrind.

Två beteenderegressioner visade felet före rättningen; 42 cloud-config/runtime/
launch-prov passerar efteråt, inklusive source-closure-import utan frontend-/
speechberoenden. Isoleringsprovet behövde en tillfällig tom Lab-node_modules-katalog
för sitt realpath-krav; den är borttagen. Inga beroenden installerades.

POST-LIPSYNC5 äger talflagga, stoppväg, budget och aktiveringsprov; MERGE4 äger
granskning/CI/merge. Ingen produktions-/provider-/GPU-ändring gjordes i rättningen.
Bankförladdning före listen och 30-sekunders readiness är ett separat diagnosspår;
inga tidsgränser eller loggningsregler har ändrats.

### Avgränsad teststädning — HUVUDAGENT6

`test/astrid-chat-visibility.mjs` använder nu endast chattfunktionens verkliga
indata; upprepade dealerprov och ett ogrundat viewportpåstående är borttagna.
Kamerans dealer-/local-/previewmatris, ARIA, unread och privatpanelsskydd finns kvar.
`test/studio-preview-client.mjs` släpper det exakta HTML-kravet på disabled-knapparnas
etikett/markup; beteendeproven för Classic, insatser, limiter, ägarskap och isolering
är kvar. De två filernas 20 tester passerar med Node 24.21.0 och fyra workers.
Ändringen är mergad i PR283. Samlad grön main-verifiering och publicering
finns i MERGE4:s avsnitt ovan.

### Rättad produktionsbehörighet — HUVUDAGENT6, 19 oktober 2026

Normal autentiserad N1-GET till `/studio/api/admin/moving-drift` är verifierat
rättad från 503 till 200. Produktionsrollen `croupier_game` saknade SELECT,
INSERT och UPDATE på `croupier_studio.moving_drift_control`, ägd av `neondb_owner`.
Endast de tre rättigheterna tilldelades på Jakobs uppdrag cirka 04:14 UTC;
DELETE och PUBLIC-åtkomst förblir nekade. SQL016/ledger och molnvariabler är orörda.

Samma browseranrop gav 200 04:14:48 UTC och 04:16:00 UTC på publicerad main
`b3ff83d442e58c9f6956142003bc9ccaca64f0d3`, Vercel
`dpl_F8Ppa6Y2B56B5Fyt8ikPzJ7rgEvT`. Standardraden är nu revision 0/önskat Av;
`connected:false` och nekad admission är väntade före executoranslutning.
Ingen GPU-/talaktivering eller ny koddeploy gjordes. Vercels anslutningshemlighet
är fortsatt maskerad; före/efterprovet belägger den riktade rättningens effekt.

PR275:s granskade head `3c1343fbdcdd051738996240057b44140ff407c8` ändrades inte
av denna rättning. MERGE4 bekräftade senare merge till main
`087f4fd5f8b354371521d49c52d8ab210f9ee6b0`; publiceringen följs separat av MERGE4.
POST-LIPSYNC5 äger senare liveaktivering/prov.
Detta kvitto löser 503-hindret men ersätter inte deras executor-/providerkontroller.
[Exakt behörighetsändring och återgång](ENVIRONMENT-VARIABLES.md#runtime-rollens-tabellbehörigheter--verifierat-19-oktober-2026).
Privata SQL-/browserkvitton och skärmbild finns utanför Git i HUVUDAGENT6:s
visualiseringsmapp för chatten `01a15252-32a8-7c22-a0df-56b5e1aae7d3`.
Filer: `drift-permissions-apply.json`, `admin-drift-before-after.json` och
`admin-drift-after.png`.

## UX/UI: Admins arbetsområden och rumseditor — 19 oktober 2026

Klippkartans scenreglage i [PR267](https://github.com/Jakeminator123/scoutgaming/pull/267)
och bredare scenpanel/driftväljare i [PR274](https://github.com/Jakeminator123/scoutgaming/pull/274)
är publicerade. Föregående UI/UX-agents 92 prov och visuella kontroller är
tidigare evidens; gemensam mall och rummets egna val använder skilda writers.

[PR277](https://github.com/Jakeminator123/scoutgaming/pull/277) är mergad som
989e74e2 och publicerad på webb enligt MERGE4:s exakta Vercel-kvitto.
Startsida och desktop-/mobilmeny använder samma Skapande/Verksamhet-länkar.
Egen verifiering: 61 navigations-/åtkomstprov, typer/klientbygge, isolerad
CSS-bredd 1280/960/390 px och 338 Admin-prov i 13 grupper utan skips.

[PR278](https://github.com/Jakeminator123/scoutgaming/pull/278), fryst
82ddf669, integrerar samma navigation med bolagets exakta rumskort och
rumsdetalj. Den är mergad som f2881516 efter grön CI och slutgranskning;
72 rums-/navigationsprov, klientbygge/typer
och hela Admin-gruppen (338 prov) passerar. Syntetisk GET-katalog och blockerade
skrivningar verifierades vid CSS-bredd 1600/1280/390 px. Inget livepaket ändrades.

[PR282](https://github.com/Jakeminator123/scoutgaming/pull/282), mergad som
1985b7dc, rättar stale dealer=astrid i
rumsadresser, även befintliga bokmärken. Exakt bolag/rum, extra queryvärden och
fragment bevaras; normaliseringen respekterar delad navigering och pågående
redigering/operationer. Den publicerade rumspresentationen väljer fortsatt sin
riktiga dealer. Rumseditorn får samlad versions-/arbetsstatus, tydlig scenyta
intill tillåtna val och breddstyrd layout. Tom granskning döljs tills ett
utkast finns. Ett enda rum slipper ett dubblerat rumskort.

Aktivt rum är no-op före history/dirty-reset. Regressionen verifierar aktivt
dirtykort, direkt väljare, gammalt bokmärke och fortsatt bytes-/unloadskydd.

Teststädning inom UI-scope tar bort förbrukade pixel/breakpoint-, exakt-markup-,
textantal- och DOM-ordningskrav i studio-layout/clip-guide/partner-appearance
samt gammal Control-textassertion. Aktivt rumsscope, behörighet, sparning,
historik, exakta media och revisionsbunden granskning/publicering behålls.
Nytt roomLayout-prov verifierar spara → granska → publicera med exakta
revisionsvärden/token och bevarat annat rums val. Egen verifiering: 94 riktade UI-/routing-/appearanceprov efter integration av reviewrättningen utan skips samt slutligt integrerat Admin/lobby-typkontrollerat klientbygge passerar. Hela Admin-gruppens 338 prov i 13 grupper är ett tidigare kvitto före den separata återvalsrättningen. Isolerad scen använder neutrala testbilder och inga videor/GPU-anrop; GET-fixturer och blockerade skrivningar behålls. Faktisk CSS-bredd 1600 och 390 px är kontrollerad utan horisontell sidöverrullning; Desktop/Mobil-val fungerar och dold granskning har display:none. Normaliseringen bevarar bolag/rum/hash i browsern. Uppföljningen är publicerad på webb i main a2dc503e, Vercel
`dpl_GtYpcfRMYV32jFxGcgcExZziLFhH` READY/www enligt MERGE4:s egen läsning.

UI/UX2 gjorde en separat normal N1-läsning 19 oktober 07:50 CEST: ett äldre
`/admin/rooms?dealer=astrid&game=blackjack` rensades till `?game=blackjack`.
Rätt Dragan-rum, paket 4 utan utkast, scen/lager, samlad versionsstatus,
stängd hjälprad och dold granskning visades. CSS-bredd 1427 px gav ingen
horisontell sidöverrullning eller alert. Inga Play-/spara-/publiceraåtgärder
eller lokala serverstarter gjordes. Detta är tillskriven UI-/adresskontroll,
inte tal-, spel- eller samlad main-CI-acceptans.

H6:s 503→200-kvitto och MERGE4:s executor-publicering är tillskriven evidens.
POST-LIPSYNC5 äger verkligt tal, exakta videoidentiteter och GPU-aktivering.
Kvar utanför denna UI-etapp: övriga Admin-arbetsytor, PNG-idle, chattregeleditor,
var åttonde utdelning per box och enhetliga lagerlås. Produktmodellen finns
endast i [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md), användarstegen i
[README](../apps/studio/docs/README.md). Privata demoer i
C:/Users/jakem/Desktop/STUDIO JÄMFÖRELSE/ bevaras.

<a id="post-lipsync5-produktionsprov"></a>

## Dragan: produktionsprov — POST-LIPSYNC5, 19 oktober 2026

**En genererad uppspelning har nu gått igenom i den publicerade spelvyn.**
Det fjärde provet skickade exakt en fråga 09:54:26.916 UTC:
”Svara kort på svenska: säg Hej Jakob.” Spelchatten visade ”Hej Jakob.”
GPU-resultatet och webbläsarens eget mediekvitto avslutades komplett.
Mikrofon → transkription → OpenClaw-text är separat belagt nedan.
Hela kedjan till hörbar röst och upplevd läppsynk, tal under utdelning
och svarstid för vanlig drift är ännu inte godkända.

Provet körde publicerad web/game-kod
`913ad8e679aed2d90865ec1328da414c18d14716` från PR290.
MERGE4 verifierade PR-CI 39228212145 och main-CI 39229477481, inklusive
riktig SQL/schema-readiness och workerbygge. POST återläste samma faktiska
web/game-SHA. POST äger prov och stopp, HUVUDAGENT6 backend, UI/UX2 Admin
och MERGE4 granskning/publicering.

Färsk ansluten executor, faktisk Av och kallt Sparläge med
`admission.allowed=true` verifierades före normal CAS-aktivering av exakt
Draganprofil. Den oberoende stoppvakten band den faktiskt lästa planfilens
hash till PID och högst 12 minuter. Endpoint `zjsdlni6cn8dvo`, template
`5dkkc3wolw`, min0/max1, image, bank, röst och referens bevarades.
OpenClaw var valt; mikrofon och kamera var av. Inga insatser, DEAL eller
walletändringar gjordes.

| Faktisk evidens | Resultat |
| --- | --- |
| GPU-jobb | `a6978302-bd43-4f7d-bfa1-8e4bc279f6b4-e1`: COMPLETED och output complete |
| Session/ström | `69289f94f054eda576f83dd367fbfdb3`, samma ID i journal och klientkvitto |
| Bankhämtning | Receipt 1287,569 ms, arkiv 6592,18 ms; båda cache miss |
| GPU-utmatning | 45 läppsynkbilder fördelade på fyra bildpaket |
| Webbläsare | `generated-lipsync-stream`, ended, completed=true, started=true, firstFrame=true |
| Klientens mottagning | 45/45 bilder mottagna; `released=33` är ett tidsstyrt bildindex för bufferten, ingen visuell täckningsgrad |
| Tid | Kö 1101 ms, GPU-execution 89348 ms, klientens hela förlopp 104634 ms |
| Visuell acceptans | `reviewStatus=pending`; fysisk hörsel- och synkgranskning återstår |

Klientens completed kräver ljudets media-playing-kvitto följt av normalt
media-lifecycle-avslut. Första synliga bild markeras efter lyckad rendering;
detta är starkare än enbart färdig svarstext men bevisar inte läppsynkens kvalitet.
Separata avgränsade loggläsningar 09:54:26–09:56:20 hittade ingen
guard-, readback-timing- eller bank-rejection-rad. Tidigare HTTP403-orsak
är fortfarande obelagd. PR290 tillför diagnostik och tillskrivs ingen
bevisad reparation av det historiska felet.

Normal Av/CAS 9→10 kvitterades 09:57:03.911 UTC. Faktisk Av, blockerad
antagning, 0 workers, 0 öppna sessioner och ingen åtgärd verifierades
09:57:49 UTC. Exakt preparation återställdes via normal PUT200 09:58:05.
Flagga 0-deploy `dep-dbaujdrncjis73ag4h50` blev LIVE 09:59:13.394 UTC
på samma kod. Stoppvakten bekräftade själv Av vid sin deadline 10:00:07
utan fjärrwrite och avslutades med exit 0. Closeout 10:01:04.330 UTC
återläste preparation, flagga 0, globalt 0 GPU och 0 öppna sessioner;
merge-/deployhållet släpptes. Efter flagga 0 påstås ingen ny ansluten executor.

Jakobs delegerade budgetbeslut användes med ändligt 50 USD kumulativt
providerskydd inklusive alla behållna reserver. En granskad normal
append-only CAS 21,60→22,80 USD kvitterades 09:49:43.772 UTC; alla
18 äldre reservationer/21,60 USD och deras historikhash bevarades.
Efter jobbet finns 19 reservationer/22,80 USD och grant 22,80 USD, 0 öppna.
Journalens 45 USD-kapacitet, 1,20 USD per jobb och 20 USD-dagstak består.
Skyddskalkyl 48,018985 USD omfattar rapporterad provider 1,015650 USD,
behållna 44,603335 USD och detta fönster 2,40 USD. Den är ingen slutfaktura;
providerredovisning kan släpa och externa TTS-/lagringskostnader ingår inte.
Inga reserver frigjordes. Ett senare fönster måste även behålla detta
2,40 USD. Nästa faktiskt öppnade fönster redovisas separat nedan.
Ingen automatisk omkörning, återbetalning, migration eller provisionering.

43 privata kontrollprov passerade före körningen. H6:s oberoende
läsgranskning fann inga blockerande fynd i de sju exakta helperhasharna,
journal-CAS, historikbevarande och planbunden stopp-/aktiveringskedja.
Dessa kod- och grindprov hålls skilda från den faktiska uppspelningen ovan.

Senaste säkra slutläge är **10:43:05.830 UTC**, efter femte provfönstret.
Jakob godkände uttryckligen ett mikrofonprov inom 50 USD totalt, åtta
minuters Off-timer och två minuters stoppsvans. H6 läsgranskade sju nya
helperhashar; 44 riktade kontroller passerade. Alla fyra äldre fönster
behölls: 47,003335 USD. Ny reserv 1,70 USD täcker den kortare faktiska
vakten vid högst 10 USD/timme; den gamla tolvminutersvakten nekas.
Normal CAS 22,80→24,00 kvitterades med samtliga 19 bindningar/22,80 USD
oförändrade. Ingen ny reservation eller GPU-körning uppstod i detta fönster.

Flagga 1 blev LIVE 10:35:40.925 på samma kod. Färsk Av och kallt Sparläge
med ansluten executor/admission verifierades före exakt profil-PUT200
10:36:40.239. Mikrofonen skulle därefter startas av Jakob med **Record
one message**. Den synliga röstloggen styrker en inspelning med kamera av,
transkriptionen ”Yeah I got that.”, automatisk sändning till Dragan och
avslutad rösttur; chatten visar ”Got it.” Loggen saknar tidsstämplar.

En senare fråga, ”säg någtot”, stod i ”Svar klart · väntar på ledigt bord”.
Dess klientkvitto 4b8a55a7-a069-45d6-a6e4-b2e65255af18 slutade cancelled,
completed=false, failureCode=muted, elapsedMs=383527. Kvittot sparades
10:41:51.645; frågan hade alltså startat **senast 10:35:28.118 UTC**,
före profilaktiveringen. Chattordningen placerar även mikrofonturen före
den frågan. Detta är inte ett genomfört prov av den nyaktiverade GPU-vägen.
Pågående runda ensam bevisar inte orsaken till väntan: posegrinden kräver
matchande identitet, synlighet, ljud och ett faktiskt presenterat ledigt
läge utan annan ägare. Held-väntan saknar timeout; exakt saknat villkor
är inte belagt. Ingen produktionsgrind har kringgåtts eller ändrats.

Normal Off/CAS 11→12 kvitterades 10:40:29.789. Färsk Av/admissionfalse,
0 workers, 0 öppna och ingen åtgärd verifierades före normal återställning
till preparation 10:41:18.658. Vakten hade faktiskt armerats 10:33:28.536
med deadline 10:41:28.394; den bekräftade själv Av 10:41:29.690 utan write.
Flagga 0-deploy dep-dbav7ktg1s2s73dlpsq0 blev LIVE 10:42:25.713.
Closeout 10:43:05.830 verifierade preparation, flagga 0, globalt 0 GPU,
min0/max1, 0 workers/busy/sessioner, Off revision 12 och nextAction none.
Projekt: studio-70eb9543-b220-44f1-a65e-51f7726bf025. M4-holdet släpptes.

Slutjournalen är 19 reservationer/22,80 USD, grant 24,00 USD. Kalkylen
49,718985 USD är rapporterad provider 1,015650 + behållet 47,003335 +
fönster 1,70. Ingen slutdebitering eller extern TTS/lagring är verifierad;
redovisning kan släpa och inga reserver frigjordes. Fönstret ska behållas
även inför ett eventuellt nytt prov. Gamla planer/intents/kvitton får inte
återanvändas; engångshjälparen vägrar redan ändrad grant.

Det kvarhängande svaret avbröts med ordinarie ljudknapp och spelarens
ljudval återställdes. Mikrofon och kamera är av. Jakob hade själv en
pågående spelrunda; POST rörde inga kort, insatser eller walletdata.
Fysisk hörsel/synk och mikrofon → GPU i samma aktiva fönster återstår.

Privata bevis finns i den befintliga checklistans provmapp:
`trial4-start.json`, `trial4-playback-detail.json`,
`trial4-browser-result.json`, senaste `speech-observation-*.json` och
`closeout-1792404064330.json`. Femte fönstret har
`trial5-visible-voice-log.json`, `trial5-client-closeout.json`,
`trial5-waiting-on-round.png` och `closeout-1792406585830.json`.
Tidigare tre prov-/stoppkvitton bevaras;
deras nekanden tillskrivs inte automatiskt samma historiska orsak.

PR280 pensionerade den inventerade lokala filmvisaren och dess testkopplingar;
13 förbrukade privata hjälpfiler har städats med inventerade beroenden.
Originalmedia, 50 verifierade bankkällor, historik och acceptanskvitton bevaras.
Fyra pending-repliker och publicerat bord med 0/13 godkända inspelade repliker
är en separat innehållsgranskning. Namnbyte eller bred omuppladdning bevisar ingen synk.
Nästa produktprov behöver knyta den fysiska mikrofonen till rätt hörbar
röst/visuell synk i samma aktiva fönster och därefter tal under utdelning,
med färsk drift, finansiering och mänsklig närvaro.
[Användarflöde](../apps/studio/docs/README.md#dragan-prova-publicerad-chatt-och-tal),
[tekniska grindar](LOCAL-PRESENTATION-RUNTIME.md#driftvaljare-kontrollplan).

<a id="dragan-talstatus"></a>

## POST-PISYNK4 — talflöde och isolering, 19 oktober 2026

Genererade OpenClaw-svar normaliseras till en rad innan förhandsvisning,
TTS och hashning; inspelade repliker behåller exakt text och medieidentitet.
PCM-insamling och bildplan delar nu workerens 220/530 ms marginaler och
600-rutorsgräns. För lång replik avbryts före render-dispatch med begripligt fel;
TTS och GPU-förberedelse kan redan ha skett. Ingen image eller kalibrering ändras.
Text-/längdgränserna är mergade i [PR266](https://github.com/Jakeminator123/scoutgaming/pull/266).
Nästa etapp kopplar riktiga appmoduler i två isolerade integrationsprov:
SQLite-blackjack-commit → beständigt spelkvitto → moving-runtime/WebSocket,
och mikrofonkontroll/WAV → transkriptions-API → Director/NDJSON → vald
Dragan-röstadapter → hashbundet PCM. Proven kontrollerar engångsdebitering,
exakta utdelningsrutor, dolt kort, rum/browser/spelare samt avbrott vid nästa
spelkommando eller spelarbyte under transkription. Svenska och engelska
behåller texten genom förhandsvisning och TTS. Klientkvittot får tider för
verifierat media, komplett svar, ljudstart och första renderade talruta.

Enheter/DOM, modell, externa TTS-/GPU-anrop och mediebytes är syntetiska i
integrationsproven. Full utdelning med registrerade originalbytes och faktisk
mikrofon/OpenClaw/GPU i isolerad drift återstår, liksom inspelad synkgranskning.
Klientens `play()` är inte mätt hörbar ljudstart. Ingen GPU-resurs eller
produktionsinställning ändras av kodleveransen.
Fokuserat: 3 utdelningsprov, 3 mikrofonbryggprov och 22 spelarprov passerar;
2 valfria browserprov är överhoppade utan installerad fixturemodul.
En oberoende läsande Codex-granskning hittade inga blockerande fynd.
CI upptäckte att de två nya integrationerna saknades i fullsvitens register;
de är nu registrerade i grupperna `moving-speech-deal` och `astrid-camera`.
UI/UX äger Admin och HUVUDAGENT5 driftstyrningen; gemensamma filer samordnas.
Jakob har satt totaltaket till45USD, inte45USD extra. En separat valfri017
breddar endast teknisk kapacitet; initial13,2, försöksreserv1,2 och dygn20USD
är oförändrade.73 fokuserade tester och verklig isolerad PostgreSQL med
omstart/HTTPS passerar, inklusive45/+1mikro och bevarad historik.
Produktionens017, kompatibel driftsättning och separat finansierat belopp är
ännu inte verifierade här. Dagens planerade fönster är2,4USD och ryms även
inom befintligt40USD-tak. Ingen GPU-/visuell kvittens ingår i denna ändring.
CI upptäckte tre kvarvarande förväntningar på föregående tekniska tak/manifest.
De två sessionfallen och Studio-fixturen är uppdaterade till45USD/optional017;
initialbelopp, dags-/försöks-/tidsgränser och produktkod är oförändrade.


## Lipsync 3 — verifierad slutstatus 18 oktober 2026, UTC

Dragan talar med källbundet ansikte under självutdelning i det isolerade
rörelseprovet. Jakob godkände **enbart filmen med hash nedan**. T6 verifierade
senare två vilorepliker i produktion, kall modell följd av varm återanvändning.
T6 prövade ingen DEAL, insats eller saldoändring och fick inget nytt visuellt
godkännande. Provresurserna är avvecklade och talflaggan är åter av.

[Runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md) beskriver tekniken;
[TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md) är enda produktmodellen.
[Historiskt detaljkvitto före förkortning](https://github.com/Jakeminator123/scoutgaming/blob/0ff9467d3230c30219126ee9b2c87b2724220529/docs/JOHN-HANDOFF.md#dragan-talstatus) och
[privat backup](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/final-documentation/lipsync3-detaljkvitto-0ff9467d-2026-10-18.md) bevarar hela föregående avsnitt:
äldre prov, amendmenthistorik och exakta kvitton. De är historiskt underlag, inga extra aktiva guider.

### Leverans och exakta bindningar

Modellcache och varm antagning är levererade i PR255–257. T6 körde PR262:s
`4cee9bc20254f6eaceb9b34271cae8c98b41a56b`; www och Render verifierades på
revisionen 21:23:13 UTC och återställningen efter provet använde samma kod.
Migration **015 applicerades 21:24:12 UTC**: tre CHECK-gränser 15→40 USD,
oförändrad budget-/reservationshistorik och inget nytt beviljat belopp.
**Denna leverans gör 015 obligatorisk** för readiness, Studio och båda
importörerna. 94 fokuserade prov samt verklig isolerad PostgreSQL passerade;
detaljkvittot skiljer dessa kontroller från den daterade appdriften.

| Underlag | Exakt identitet |
| --- | --- |
| Enda visuellt godkända filmen, ”Ulf Lundell är bra.” under självutdelning | SHA-256 `769c5d901775e05ca88773ee3e47174410367ae9c8d0fdb935b4cbcc6080c8f4`, 711 053 byte, H.264/AAC, 1280×720 |
| 50 oförändrade Dragan-källor | source-set-SHA `e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d` |
| Rörelsekälla, 66 rutor vid 24 fps | `d9c7fefb-141c-4809-aecf-3904392f22f5`, SHA `061e82f2d4be69d3a73a2e6842692eb2d23c7b7e11fcd9d246fbb0c85e9f72c0` |
| Vilokälla, ruta 0 | `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f`, SHA `2b8d6ea7829bde6212f6145038569747a389c5e20166b3ea08fc26efda81c9e3` |
| Fullbank, 2 479 poolrutor / 594 432 000 byte | SHA `5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c` |
| Workerrelease | `5908716a81532d29e8b2e9aece3a8639258a7f56dad2ee3b6d98fcc343d0c08c` |
| Publicerad image | `ghcr.io/jakeminator123/moving-gpu-worker@sha256:eb5a6b4707eaba54839cc562b554ff7a8af37f5897e739a5533f2357f867135a` |

En ändrad ljud-/videohash är en annan tagning; godkännandet ärvs inte.
Lagren är bakgrund → dealer → bord, med serverägda kort och spel-UI ovanpå.

### Senaste produktionsprov och avveckling

T6 `728d0e03-1f46-4ab5-936b-01a99e1dbe1e` gav två naturligt avslutade
svar på Dragan-testbordet. Båda har `mediaCompleted=true` och
`captureComplete=true`, med exakt text-, PCM-, bank-, käll- och releasebindning.

| Replik | Samma A40-worker `nc0qem1vw69ad2` | Mottagna rutor / release-callbacks | Providerkö / execution | Klick→slut, monotont |
| --- | --- | --- | --- | --- |
| ”Ulf Lundell är bra.” | Cachemiss | 57/57 / 44 | 64,805 s / 85,954 s | 164,088 s |
| ”Jakob är kung.” | Cacheträff | 51/51 / 38 | 0,147 s / 25,773 s | 37,176 s |

Motorförberedelsen tog 52,761 respektive 2,180 s. Olika repliker och enstaka
prov ger ingen p95-/hastighetsgaranti. Mottagna rutor, callbacks och glesa
JPEG-bilder bevisar inte att varje ruta visades eller ny visuell acceptans.
Mottagen PCM är inte inspelat systemljud. Det isolerade RTX4090-provet
verifierade även avbrott och ny motor efter avbrott; kvitton finns i paket 2.

Cleanup stängdes **21:59:46.560 UTC**, sju godkända steg utan fel: profil
preparation, fyra egna Render-nycklar återställda med flagga 0, endpoint/mall
borta och inga aktiva workers, öppna reservationer eller levande leases.
Render `dep-dbak20ijnfac73816bsg` var LIVE på PR262. Journalen behåller
**14 avslutade reservationer/16,8 USD**, varav 12 USD för dagen; separat
beviljat totalutrymme är 16,8 USD. Ingen historik nollställdes.
[T6:s resultat](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/two-reply-result.json)
och [cleanup](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/cleanup-receipt.json)
är de lokala kvittona; deras fullständiga hashar finns i detaljkvittot.

### Bevarande och lagring

Fem privata Blob-manifest är fullåterlästa. Länkarna öppnar deras verifierade
lokala kopior; objekten ligger under `croupier/media/dealers/dragan/staging/lipsync-review/`.

| Manifest | Bevarat underlag |
| --- | --- |
| [1. Källor och rörelseprov](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/preservation-manifest.json) | Referens-ZIP, käll-/bankreferenser, ljud och granskningsmedia; derivat skiljs från original. |
| [2. Varm cache och avbrott](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/warm-cache/plans/warm-cache-1526eeb3-a526-48a7-8e43-d3665ca09d59/manifest.json) | Kompletta A/B/D-resultat, uttryckligen partiellt C-resultat och sanerade kvitton. |
| [3. Historiskt T3-svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/historical-single-reply/plans/32c15e27-a1e9-472f-a290-9ee11bc04084/manifest.json) | Kompletta medier men ofullständig capture; inget tvåsvarsbevis. |
| [4. T4-svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/t4-single-reply/plans/3001c02f-ee64-4b7a-9681-aad822af40a3/manifest.json) | Ett komplett fångat svar och 62 passiva JPEG-prov. |
| [5. T6:s två svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/production-trial04/plans/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/manifest.json) | 94 unika objekt / 28 001 366 byte: två PCM, tio H.264, två sanerade kvitton, 79 unika JPEG med 82 tidsreferenser och manifest. Fullåterläst 22:04:20.559 UTC. |

Emils `lappsynk-export-fe1b55e.zip` är bevarad oförändrad, 145 846 625 byte,
SHA `949443c1084ab3f515792fe66c5e2d381e985f9bdc743e792e5fbca36a9240a3`.
Bevarandet importerade inga API-, SQL- eller env-mallar. Kevins 50
registrerade källklipp behåller originalbytes; det verifierar inte hans privata miljö.
Inga källor flyttas automatiskt. För registrerat spelmaterial är Neon registret
och Blob mediekällan. Bevarandet skapade inga Neon-/Admin-klipp; ZIP, bank
eller råa ansiktspaket hör inte hemma i `/admin/clips` som spelbara klipp.
Inspelade repliker följer `recorded-speech`/`preserve-recorded-audio` med
originalnamn och exakt ljud-/videobindning. Moving-resultat sparas ännu inte
automatiskt i svarsbiblioteket. Manifesten är ingen ny visuell acceptans.

### Kostnad, varm drift och kvarvarande ansvar

Avläsningen **22:00:19.322 UTC** visade **0,8236155684862752 USD** rapporterad
RunPod-kostnad för lästa 20 endpoints och kontots pods under 16 oktober
00:00–18 oktober 22:00:18.918 UTC. T3–T6:s slutdebitering är obekräftad;
tomma billing-listor betyder inte nollkostnad. **35,003335 USD** i
providerreserver behölls, inget frigavs automatiskt. TTS/ElevenLabs och
nätverksvolymer ingår inte. [Kostnadskvittot](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/provider-budget-1792360819748.json)
länkar till fakturaunderlaget. Reservationer är inte fakturor. Jakobs tidigare
mänskliga provtak är återkallat; tekniska journal-/kostnadskontroller består.

**24 timmars varm drift är inte aktiverad eller verifierad.** Nuvarande
antagning kräver min 0/max 1 worker och högst 60 s tomgång; min 1 avvisas.
T6 hade en 720 s provguard. Cachen saknar egen TTL/jobbegränsning men försvinner
med processen eller vid identitetsbyte, fel och avbrott. Ett längre varmtest
behöver eget avgränsat drift-/kostnadsfönster med antagnings-, avbrotts- och städskydd.

Kvar: kortare svarstid, tal under produktionsutdelning, automatisk beständig lagring av moving-resultat, riktig mikrofon-/bild-E2E
och slutlig kostnadsavstämning. 56 äldre generiska `submission_uncertain` är
separat olöst observationsskuld; de har inte rensats eller frikänts.

### Arbetskopior och ägarskap

Primärcheckouten var 21:41:47 UTC på `codex/scout-visual-product-model`,
`7a6fc8a70b7c3b810829c2736ad98bd26fcf9bb1`. Dess sex dirty/oregistrerade poster
`.codex/config.toml`, `.cursorignore`, `.agents/skills/source-command-ping/`,
`.cursor/settings.json`, `a.zip` och `web/` är andra ägares och orörda.
`a.zip` är agentmaterial, inte Emils export. Ingen mass-staging eller städning.
Lipsyncs två arbetskopior är `C:/Users/jakem/.codex/worktrees/lipsync3-server-diagnostics/croupier`
och `C:/Users/jakem/.codex/worktrees/lipsync3-bank-http/croupier`. Studio-beroenden
länkar mellan dem; lämna dem kvar tills junctionens konsumenter är avvecklade.
Huvudagentens slutkontroll identifierade inga egna provprocesser i dessa träd
eller provbasen, inga lyssnare på 8765/8766, och Admins talcheckbox var av.
Impactwins avvecklade `game-engine`/`preview-v2` ska inte återställas;
produktionens `croupier-v2`/main består. Vercel Preview delar produktionsbackend
och får inte antas vara isolerat. Övrigt ägarskap samordnas med HUVUDAGENT5.

## Historiskt Lipsync 2-kvitto

Följande daterade diagnos är bevarat underlag; aktuell status och aktuellt
kostnadsmandat står ovan och ersätter dess tidigare start-/stoppvillkor.
## Dragan: avslutat diagnosprov, bank_length_mismatch — 18 oktober 2026 10:10 UTC

Detta var slutläget efter molnprovet, före den lokala HTTP-rättningen ovan.
Ingen GPU eller fortsättningsbevakning lämnades igång. Jakob önskade en bra
överlämningspunkt. Den dåvarande leveransen ändrade bara handoffen.

**Verifierat:** PR240 är mergad och appen körde
`209d62f436786f9dae69c7ee6f1b256253ab6805`. Diagnostikimagen från PR238
är publicerad och använd i provet: image
`sha256:3ede7d24fd7885f2a8ffcd1ad4798d2d1caa8799f926c610b576d196cc92db6c`,
release `3bec5b4be9954d929fcc60d281b89981a7be3d7a9027008466c240b90c1e44ad`.
OpenClaw svarade exakt "Hej Jakob, nu testar vi ljudet.". Budget/admission,
nyckelåtkomst och workerstart passerades. Ingen spelinsats gjordes.

**Bekräftat fel:** RunPod-jobbet
`878f6561-7d54-4203-a091-cf4935386642-e1` väntade 214835 ms och exekverade
1328 ms. Providern rapporterade COMPLETED men output var
`status:failed, code:bank_length_mismatch`. Render loggade kvitto-GET200
10:06:14.906Z; inget efterföljande arkiv-GET. Browsern tog emot noll ljud-/
bildbytes och ingen worker-WebSocket. Detta är inte ett lyckat talprov.
`services/moving-gpu-worker/bank_download.py` använder samma felkod för
otillåten transfer/content encoding, fel Content-Length och för stor kropp.
Exakta svarshuvuden fångades inte. Chunked är en hypotes, inte fastställd orsak.
Det nya utfallet stärker underagenternas statiska kvitto-/framinganalys;
deras procenttal är bedömningar, inte ytterligare runtimeprov.

**Avvecklat:** guarden stängde 10:06:20.952Z. Oberoende återläsning
10:10:08.646Z verifierade endpoint `4aissnsig9exnz` och template `vcd0ebcbmw`
404, tom workerlista samt terminal/frisläppt session
`a409d4882815adb907e93c6b26846091`. Journalens COMPLETED återger providern,
inte lyckad workeroutput. Renderflaggan0 blev LIVE 10:07:37.980Z via
`dep-dba9k9uq1p3s73armh90` på samma209d. Dragan-profilen är sparad avstängd.
Förbrukad endpointvariabel är borttagen med Save only och återläst;
den körande avstängda deploymenten har fortfarande sitt gamla env-snapshot.
Astrids endpointinställningar min0/max1 och originalmedia är oförändrade.

**Budget:** Jakobs uttryckliga totaltak är40USD. Append-only amendment
`4a6363d5-5e26-4da5-874b-20e4b977dd48` är genomförd: samma budget-ID
`dragan-test-20261017`, journaltak6→7,2USD. Sex reservationer om sammanlagt
7,2USD och två amendments är bevarade; inga öppna sessioner på testendpointen.
Detta är reservationer, inte leverantörsfaktura. Även provets försiktiga
providerreserv2,333334USD ska behållas tills färsk kostnad avstämts.
40USD-godkännandet är klart. Runtime och journal har nu båda7,2USD som
fullt reserverat tak. Ett senare prov kräver avstämd kostnad, motsvarande
ändring av runtimegränsen och append-only journaländring inom40USD;
återställ inte historiken och skapa inte ett nytt budget-ID för att kringgå den.

**Nästa agent:** börja med kvittoöverföringen, inte nya nycklar eller samma
GPU-omtag. Läs bara säkra status-/framing-/storleksfält; exponera inte
capability-URL:er, credentials eller råa undantag. Reproducera relevant
HTTP-beteende offline och rätta det med bibehållen TLS/origin, storleksgräns,
SHA-256, tidsgräns och avveckling. Först därefter granskning, förseglad release,
containerprov och pinnad image före ett nytt kontrollerat talprov.
Faktiskt hörbar röst och visuellt synkron mun återstår att verifiera.

Jakob påpekade dessutom olika videoversioner och idle efter handdragning,
samt en möjlig SHA-/bildrutebindning i Kevins staging. Jämför exakt branch,
video/hash, avatarpaket och frame-index före playbackacceptans; byt inte
media på namn eller ungefärlig längd. Metoden på staging är inte verifierad
i denna omgång. Studio visade referensvalet "Kevin V2 · andning", vilket
ensamt inte bevisar att bankpaket och visad film matchar. Det nu bekräftade
hämtfelet inträffar före användning av videopaketet.

Privat operativ källa (ingen ny publik tracker):
`C:/Users/jakem/.codex/visualizations/2026/10/17/01a14afa-f423-7011-bbdf-30a7f44609d1/budget-resume-checkpoint.json`.
Den länkar terminaloutput, browserresultat, budgetamendment och oberoende
stoppkvitto. Privata helperfiler ska läsas innan återanvändning; den avslutade
guarden eller förbrukade endpointen får inte startas igen. Aktuell worktree:
`C:/Users/jakem/.codex/worktrees/dragan-admission-diagnosis/croupier`, branch
`codex/dragan-bank-failure-handoff`. Merge-agenten och HUVUDAGENT3 har fått
stoppkvitto och deployhållet för övrigt arbete är släppt.

Uppdaterad 18 oktober 2026. Den beslutade strukturflytten är levererad och
verifierad, inklusive rättningen av lokal klippmappning. Inga fler rotflyttar
återstår i strukturplanen. Tal/läppsynk och övriga öppna produktfunktioner är
separata arbeten; hela casinoprodukten är inte slutverifierad.

## Navigationstester — 19 oktober 2026

`apps/studio/test/scout-navigation.test.mjs` härleder menygrupp och dold panel
från aktuell navigation i stället för att kräva fyra grupper, deras gamla ID:n
och tre dolda paneler. Detta följer arbetslägena i [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).
Alla registrerade länkar provas mot aktivmarkering med och utan `/studio`;
alias, N1-/partneravskiljning, utkastskydd och tangentbordsbeteende behåller sina prov.

**Verifierat:** 45 riktade Admin-/navigationstester passerar. Ett minnesbaserat
omgrupperingsprov med identiska länkar gav tidigare tre layoutfel och passerar
nu alla elva tester. Ett separat negativt prov där biblioteksrutten tappar sin
aktivmarkering stoppas av den nya länkassertionen. Produktkoden är oförändrad;
två arbetslägen är här ett testprov, ingen levererad UI-ändring.

## HUVUDAGENT4: avgränsad rutinstädning — 18 oktober 2026

[PR243](https://github.com/Jakeminator123/scoutgaming/pull/243) och
[PR246](https://github.com/Jakeminator123/scoutgaming/pull/246) är mergade
efter full grön PR-CI. Strukturplanen förblir avslutad. Agent-talk visar
riktade samtal för berörda agenter, behåller kvittens/köarkiv och kräver
egen done. Delade filer är inte privata och andras claims frigörs inte automatiskt.

Lokal kontroll och CI delar dokumenturval; flyttad klientkod har rätt
migrationsurval. Moving-workerns befintliga CPU/image-workflow ingår i
obligatorisk CI när relevant. Inget generellt tvåuppspelningskrav finns kvar.

Efterfixen flyttar chattens visning, avbrott och beslutade uppspelning till
en importerbar klientmodul. Beteendeprov ersätter regex/VM-utskärning och
källtextassertioner; liveägarskap, dealer/session/revision, exakt media,
textfallback och avbrott behålls. Testnamnet är `test/chat-decision-player.mjs`.
Den extraherade modulen ingår också i serverns och browserns QA-källhashregister;
avvikande bytes eller saknad pin stoppar innan kö eller strömning öppnas.
Studios guide skiljer direkt Next-env från anslutningshjälparens avsiktliga
bakåtkompatibilitet. Inga privata env-/data-/mediefiler flyttas.

**Lokalt verifierat:** 71 passerade beteende-/regressionsprov; två valfria
Playwright-prov överhoppades eftersom browsermodulen saknas i arbetskopian.
Två nya QA-regressionsprov reproducerade hashregisterluckan före rättning;
efteråt passerade 158/158 prov i QA-/chattpaketet, helt utan betalda anrop.
515 JavaScript-/TypeScript-kandidater har inga föräldralösa tester, och
miljövariabelregistret stämmer. Obligatorisk CI följs på efterfixens PR.
Detta är inget nytt produktions- eller läppsynkprov. Lipsync 3:s handoff ovan består.

**Avslutat:** efterfixen levererades i [PR252](https://github.com/Jakeminator123/scoutgaming/pull/252),
merge `2e9b53388636effa42bea27f451845280375b9ef`. MERGE3 verifierade grön
PR-CI och [main-CI 39145319537](https://github.com/Jakeminator123/scoutgaming/actions/runs/39145319537).
Det efterföljande renklonprovet redovisas nedan. Lipsync 3:s arbete och
primärcheckoutens inställningar, råmedia och data lämnades orörda.

## HUVUDAGENT5: renklon och organisationsavslut — 18 oktober 2026

Direktklon av GitHubs main i `C:/Users/jakem/Projects/scoutgaming-clean-20261018`,
fryst på **`2e9b53388636effa42bea27f451845280375b9ef`** efter PR252.
Klonen har egen fysisk `.git`, en revisions historik och inga Git-alternates.
Arbetskatalogen var ren både före provet och efter alla körningar, innan detta
dokumentkvitto lades till. Inga moduler, byggfiler, miljöfiler eller privata
data kopierades från äldre arbetskopior. Lipsync 3 lämnade aktuell
bevarandelista; dess worktrees, moduljunction, råmedia/banker och processer
bevarades. MERGE3 bekräftade att inga blockerande H4-fynd kvarstod.

| Egen körning i klonen | Resultat |
| --- | --- |
| Installation och bygge | Låsta npm-installationer för Studio, designklient, spelmotor, Speech och transport-Gateway; webb med pnpm 10.33.2 och frozen lockfile. Node 24.21.0 respektive Speech 22.23.1 enligt paketen. Studio/design och webb byggdes från början, inklusive Next-typkontroll; designens separata typkontroll och Speechs syntaxbygge passerade. |
| Fokuserade Windows-prov | 52 struktur-/chattprov, 3 Director-paket/startprov, 2 jämförelsefixtureprov, 33 anslutningsprov, 11 sessionsprov och webbbyggets 117 tester passerade. Ett Linux-specifikt sessionsprov hoppades över på Windows. |
| Verklig lokal start | Nybyggt Studio och spelserver via `--offline --skip-build --no-open`: lokal hälsa och Studio-sida 200, opublicerat spel avvisat med 503, syntetiskt projekt i temporär datarot. Stopp tog bort dataroten och frisläppte sessionen. Vanlig publicerad Studio-start räknades inte som prov. |
| SQL, omstart och HTTPS | Befintliga `tools/studio-isolated-qa.mjs` kördes som icke-root i WSL mot samma klon/SHA och ett nytt PostgreSQL 16-kluster: 4 retained-kontraktsprov, 26 SQL-kontroller och 59 integrationskontroller. 196 källhashar var oförändrade; klustret stoppades och togs bort. Den importerade testmodulens fristående SQL-test var överhoppat; verktyget körde den verkliga SQL-kedjan uttryckligen. |
| Isolering | Ny allowlist-miljö redan vid installation/bygge, tomma användar-/npm-profiler och egen paketcache. Inga ärvda apphemligheter, NODE_PATH eller NODE_OPTIONS. 122 interna länkar och 101 byggspår med 19 329 referenser gav noll mål utanför klonen; inga privata envfiler. Båda befintliga guards blockerade läsning av i förväg skapade syntetiska envfiler samt extern fetch/TCP. |

SQL-pakethämtningen gav först `Hash Sum mismatch` från Ubuntu via HTTP,
före databasstart. Samma prov passerade med en uppgiftsspecifik `APT_CONFIG`
för Ubuntus HTTPS-källor, med bibehållen signatur-/hashkontroll. Inga
systempaket, systemkällor eller externa databaser ändrades.
Leveransverktygets push verifierades på GitHub men upstreamsteget behövde
klonens main-begränsade fetchspec utökad med den egna featurebranchen.
`git remote set-branches --add origin <featurebranch>` följt av fetch och
ordinarie leveranskommando räckte; ingen gammal arbetskopia behövdes.

**Kvarvarande särskilda förutsättningar:** inga gamla lokala projektfiler
behövdes för de prövade flödena. Director-adaptrarnas äldre relativa
`open-claw/lab` är en bevarad konfigurations-/datarot; välj uttrycklig
temporär datarot och `envFiles: []` för isolerad körning. Privat native-AI-QA
kräver fyra filer i `lab/data/platform-private` och sitt exakt pinnade
OpenAI-SDK 7.12.1-träd. Minsta åtgärd för just det verktyget är att separat
bevara/verifiera dess egna underlag, inte återföra dem som ordinarie
byggberoenden. Browserprov kräver separat Playwright/Chrome. SQL-provet
kräver Linux/WSL, OpenSSL och verifierade PostgreSQL-binärer. Se
[återställningsguidens avgränsning](ENVIRONMENT-RESTORATION.md#renklonprov-och-separata-qa-förutsättningar).

**Inte provat:** full lokal regression, browser-/visuell produktacceptans,
GPU-/taljobb, produktionsskrivningar eller molnändringar. Processmiljö,
Node-guards och sökvägs-/byggspårskontroller är ingen OS-sandbox eller
bevis för alla historiska privata verktyg. Produktdrift kräver fortsatt
uttrycklig Neon/Blob/auth/provider-konfiguration enligt miljöguiden. För native
Admin omfattar det `CROUPIER_GAME_DATABASE_URL`,
`CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`,
`CROUPIER_STUDIO_NATIVE_ADMIN=1`, `CROUPIER_STUDIO_NEON_POLICY=1`,
`CROUPIER_PUBLIC_ORIGIN` och
`CROUPIER_LAB_UI_ORIGIN`; Blob-läget använder `CROUPIER_MEDIA_STORAGE`
och `BLOB_READ_WRITE_TOKEN`. Inget av dessa skarpa värden behövdes för byggena
eller den syntetiska fixturen.

Privata körloggar, plan och maskinläsbara kvitton finns under
`C:/Users/jakem/.codex/visualizations/2026/10/18/01a14fb1-2374-7ce1-8105-d61ce1796718/`
(`clone-baseline.json`, `results.jsonl`, `offline-smoke-result.json`,
`isolation-audit-result.json`, `sql-result.json` och `sql-run.log`).
Detta stänger det avgränsade organisations-/efterstädningsprovet. Admin-UX,
Lipsync 3:s pågående integration och övrigt produktarbete har egna kvitton.

## Strukturens slutkvitto

Accepterad strukturrevision är **`2ba5bf03437b8f7da8a60d06335831abaf50f162`**,
[PR237](https://github.com/Jakeminator123/scoutgaming/pull/237), ovanpå
[PR236](https://github.com/Jakeminator123/scoutgaming/pull/236). Slutlig
mappkarta och ansvar finns i [README](../README.md#source-and-folder-map).
Neon är produktregister och Blob mediekälla. Källkodens nya rötter ändrar
inte sparade medieidentiteter, publika URL:er eller privata datarötter.

| Kontroll | Verifierat resultat |
| --- | --- |
| CI | [PR-CI 39112069295](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112069295) och [main-CI 39112728886](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112728886) SUCCESS på slutliga revisioner. |
| Lokal klippmappning | Nytt prov av verklig isolerad HTTP-server reproducerade felet före rättning. Efteråt återfinns 17 talposter, 2 native-talposter och 2 filmade tagningar; token saknas ger 401 och autentiserat cloudRuntime ger 404. Ingår i CI. |
| Databas | Isolerad PostgreSQL/omstart/HTTPS i CI; produktionsledger ready med pending=[] kl. 08:53:56 UTC. Required schema 014 är installerat. |
| Frontend | Vercel `dpl_JBah2ng3jCQtKDpk25P4f7MVpqrW` READY på accepterad SHA; 17/17 produktionskontroller. |
| Spelserver | Render `dep-dba8id8ae00c739g70fg` LIVE 08:56:42 UTC på accepterad SHA. Version, health/lobby 200, privata gränser 401, Admin-retur 307 och oautentiserad klippmappning 401 med Bearer/no-store verifierades 08:57:42–43 UTC. |
| Gateway/Director | Gateway på `d55ce412714e9e0c85103358f381098ce3d35077`, normal deploy `dep-dba28hnavr4c73fsf3fg` LIVE 01:45:00 UTC. SIGTERM/ny start utan EPERM eller kvarvarande lease; signerad config.get 200 och connected/applied 01:45:22 UTC. Director på `9f7f415d9896ca05b8c240f210ea64a1c30f2b04`, deploy `dep-dba30r2jnfac73e5err0` LIVE 02:36:29 UTC; health/autentiserat API och signerad Gateway config.get 200/connected/applied verifierade 02:37:34 UTC. PR237/238 ändrar inte Directors byggda kod. Modellval, disk och autoDeploy oförändrade. |

Driftkvittot ovan kommer från mergagentens kontroller, inte en ny körning i
dokumentationspasset. Det autentiserade cloudRuntime-provet gjordes i CI,
inte direkt mot produktion. Gateway/Director behövde ingen ny leverans för
PR237. Grönt CI och dessa driftprov är inte visuell läppsynkacceptans.

Klippfelet berodde på att servern gav clipMapping den nya fysiska roten
medan katalogen behåller `web/public`-alias. PR237 ansluter alla berörda
läsningar till den befintliga filresolvern `publicAssetPath`. Det tidigare
GO:t för PR236 var därför för brett; regressionen är nu rättad och täckt.

## Senaste app- och workerleverans

[PR238](https://github.com/Jakeminator123/scoutgaming/pull/238) levererade säkra
workerfelkoder och den privata diagnostikimagen som användes i provet ovan.
CPU-containerprovet passerade 52/52 tester, inklusive renderaren;
[imagepublicering 39114263475](https://github.com/Jakeminator123/scoutgaming/actions/runs/39114263475)
är SUCCESS. Detta verifierar bygget och publiceringen, inte hörbar röst eller
synlig läppsynk. Den tidigare apprevisionen 4c782b3b var driftsverifierad.

[PR240](https://github.com/Jakeminator123/scoutgaming/pull/240) är mergad som
`209d62f436786f9dae69c7ee6f1b256253ab6805` och skiljer providerredovisningens
godkända totaltak 40 USD från journalens oförändrade schemagräns 15 USD.
Runtime 7,20 USD kan inte ensamt höja den sparade journalgränsen. Samma
budget-ID och historiska reservationer bevaras; aktuell förbrukning och
kraven före nästa prov finns i inledningens stoppkvitto.

[PR-CI 39115861445](https://github.com/Jakeminator123/scoutgaming/actions/runs/39115861445)
och [main-CI 39116605256](https://github.com/Jakeminator123/scoutgaming/actions/runs/39116605256)
är SUCCESS. Main körde verklig isolerad PostgreSQL, omstart och HTTPS på
13,946 sekunder, inklusive blockering utan amendment och exakt en ny
reservation med bevarad historik. Produktionsledger 001–008 och 011–014
var ready med pending=[] och optionalPending=[] 09:53:32 UTC.

Mergagentens egen produktionskontroll 09:56:49 UTC verifierade exakt
209d62f4 på spelservern och Vercel `dpl_8PC4t8tYzTN6WvLZCfrsR7C5fJNu`:
health, startsida och lobby 200, privata Studio-API:er 401 och Admin-retur
307 till inloggning. Studio kontrollerades separat 17/17. Render
`dep-dba9eajm8hqs73b5hj3g` blev LIVE 09:56:12 UTC. Provets senare
avstängningsdeploy på samma kodrevision dokumenteras i stoppkvittot ovan.
Director och Gateway ändrades inte av PR238/240.

Det aktuella diagnos-, budget- och stoppkvittot i inledningen är lipsync2:s
verifiering, bevarad från [PR241](https://github.com/Jakeminator123/scoutgaming/pull/241).
Struktur- och appkvittot är mergagentens tidigare egna kontroller.
Denna samlade dokumentationsleverans kör inga nya GPU- eller spelprov och
ändrar varken HTTP-hämtning, budgetjournal, miljövariabler eller media.

## Avslutsstädning och skyddat lokalt arbete

Förbrukade flyttinstruktioner, aktivitetskort och motsägande väntelägen ska
inte finnas kvar som aktiva uppdrag. Denna handoff ersätter den löpande
flyttloggen; äldre exakta kvitton finns i [Git-historiken](https://github.com/Jakeminator123/scoutgaming/blob/4c782b3be4f49dc5743f27e3af3dfcb52e407939/docs/JOHN-HANDOFF.md).
Ingen ny strukturplan eller parallell migrationslista behövs.

Gamla kodrötter är tömda i accepterad main. En äldre lokal checkout kan
fortfarande visa dem. Synka först efter kontroll av branch, egna ändringar,
ägarskap och eventuella aktiva processer. Radera verifierat förbrukade rester;
bevara osäkra original i det kanoniska gitignorerade `arkiv/<datum>/`.
`lab/data`, `web/data`, OpenClaw-data, env, råmedia, kalibrering och privata
QA-kvitton får inte raderas som en följd av källkodsflytten. Avvecklade egna
worktrees kan arkiveras efter kontroll av opushat och ignorerat arbete;
andra agenters worktrees och claims är inte del av rutinmässig städning.

## Övrigt kvarvarande produktarbete

**HUVUDAGENT4, 18 oktober:** produktionens `croupier_game` på Neon-main
är källan för aktuella bolag, rum och dealers. Den tidigare läsningen visade
Dragan test och Nordic bet. Preview-grenen `preview-v2` raderades senare
enligt det daterade kvittot i [miljöguiden](ENVIRONMENT-VARIABLES.md#aktuellt-miljöval-för-admin--verifierat-18-oktober-2026).
Det andra Blob-lagret hör till Impactwin. Preview är ännu ingen verifierad
skrivtestmiljö; ingen ny molnavläsning eller full Admin-UX-acceptans påstås här.
Lipsync 3 äger tal-/workerarbetet och dess aktuella verifieringsstatus ovan.
Moving-kontrollen är levererad i PR246; renklonprovet är avslutat enligt HUVUDAGENT5-avsnittet.

<a id="2-öppna-kontroller-och-kända-fel"></a>

[CLOUD-MIGRATION](CLOUD-MIGRATION.md#separat-produktarbete-och-öppna-driftansvar)
är den enda listan över öppna produktfunktioner och äldre observationer.
Där finns operatörsledger/rapporter, konto/invite/reset, Admin-/lobbyluckor,
OpenClaw-funktionsprov, medieradering, backup och pausad QA. De innebär
inte att den levererade strukturflytten ska öppnas igen.

Välj prov efter ändrat beteende. Ingen generell manuell spelacceptans eller
ett fast antal spel krävs för vanlig leverans. Auth, rum/bolagsgränser,
revisioner, sparande och serverägda pengar/spelregler behåller täckning.
Hash, waveform och testpass bevisar aldrig synlig läppsynk; exakta
ljud-/videoidentiteter och befintliga godkännanden ska bevaras.

GitGuardian-läsningen inför detta avslut visade 2 öppna och 19 ignorerade
incidenter. Platsmetadata är delvis ofullständig och helhistorikskanningen
har status too_large. Grön produkt-CI betyder inte full säkerhetstäckning;
inga incidenter har ändrats av strukturavslutet.

Begrepp: [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).
Teknisk verklighet: [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md).
Konfiguration: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).
Återställning: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
