# Nästa agent

Aktuell samordning 31 oktober 2026. Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. Läs [START-HERE](../START-HERE.md) och [AGENTS](../AGENTS.md); den äldre checkouten `dev/projects/scoutgame` och andras prototyper är inte integrationsytor. `migrering/status.json` är fortsatt migrationsplanens enda statuskälla.

## Organisationsarbete

[KORPLAN-v2](plans/organisation/KORPLAN-v2.md) är enda aktiva körordning. Den äldre inventeringen och områdesfilerna är ersatta; Git och [HISTORIK](HISTORIK.md) bevarar deras ursprung. Jakob har gett MERGEAGENTEN fullt beslutsmandat för nödvändiga merges och kontrollerade releaser utan fler godkännandefrågor. Ägar-, CI-, SHA- och verifieringsgrindarna gäller fortfarande. Inga brancher/worktrees eller kollegors resurser raderas; RunPod-endpoints rörs inte.

Orkestratorn äger integration, denna överlämning och körplanen. Nya fynd samt verkliga kod-/CI-/deploy-/acceptansbevis står i [beslutsloggen](plans/organisation/BESLUTSLOGG.md). F11:s [verkliga driftkvitto](plans/organisation/F11-DRIFTKVITTO.md) omfattar två Render-instanser, pengar, återanslutning och negativa prov. Den särskilda F11-spärren är hävd för kompatibla releaser; flaggbyte/publicering och övrig acceptans följer egna kriterier. Äldre versionsuppgifter i kvittona nedan är daterade; aktuell leverans och kvarvarande prov finns i körplanen.

**Avslutad första genomförandevåg 31 oktober:** 4/4 + 3/3 + 2/2 leveranser (inklusive talstart och F11). Produktens övriga acceptans/backlog är inte 100 %. Nästa session börjar med denna överlämning och körplanen, inte gamla chattexporter.

**Ny etapp enligt Jakob:** talet väntar. R1 separerar satsningsrutor från spelare/kameravy, R2 avvecklar gamla kodkopior i testfixturer, R3 förenklar docs och föråldrade ändringsspärrar, R4 rättar typversioner och R5 kompletterar den centrala objektkontrollen. De avgränsade agentändringarna är lokalt granskade och samlade i `jakob/codex-rest-integration-1031`; MERGEAGENTEN slutför exakt CI, release och demoprov. Därefter tar en ny huvudchatt över S1–S3: övergångskod, bolagsflöde/systemkarta samt test-/leveransfriktion. Befintliga ARKITEKTEN, REPOAGENTEN och DRIFTAGENTEN får separata uppdrag från den nya huvudagenten. Aktuell status och återstående områden finns bara i körplanens tabeller. Privat kort överlämning: `.cache/restlista-1031/HANDOFF.md`.

## Spelkontroller och filmtempo, 31 oktober

PR #740 samlar #738 (exakt talfri native-v2-filmlängd), #739 (förbrukad satsnings-/insamlingsreplik släpper nästa serverpresentation) och en stabil insats-/beslutspanel med plats, belopp och serverstyrd nedräkning. Mergad och deployverifierad på `3caafd3dccc6c2376d63bd85c438392b925584f0` i båda miljöerna; Render health=ok, Vercel READY. Oberoende granskningar, 630/630 lokala hookprov och CI [41199193439](https://github.com/Jakeminator123/scoutgaming/actions/runs/41199193439) passerade. I verkligt demoprov tog Hit cirka 5,3 sekunder från klick till aktiva beslutsknappar; serverns exakta filmplan var 4 155 ms, tidigare 22 119 ms, med hela 15 sekunders beslutstid för nästa hand. Filmhastighet, bildrutor, regler och serverägda pengar ändras inte. Talberoende öppning och avräkning har fortfarande konservativ reservtid; all presentationslatens är inte löst.

Det isolerade previewrummet `room-3fdcf4e9-bcba-ab49-779a-2293853001ef` har dessutom publicerats via Admin som version 2 med korrigerad bordplacering. Djupjämförelse bekräftade oförändrade mediebytes och filmkontrakt; andra publicerade rum ändrades inte. Slutliga runtimebevis och skärmbilder samlas privat i `.cache/ui-review-1031/REPORT.md`. Detta är en avgränsad spelrättning, inte acceptans av all teknisk skuld eller hela talprodukten.

Uppföljningen #741 integrerar #742: återhämtad idle/ljudgest lämnar inte kvar en gammal generell varning i tillgänglighetsvyn, och kortens extra 220 ms-layoutanimation tas bort. Animationen blandade gamla lokala koordinater med det nya föräldraplanets skala; slutankaret var rätt men övergången hoppade. Verkliga Chrome-bbox-prov reproducerade felet före rättningen och höll spelar-/dealerkortens skärmcentrum inom 0,01 px efteråt, i båda riktningar genom koordinatbytet. Bildrutestyrd filmrörelse och handfläkt bevaras. Den stabila bordkalibreringen flyttas inte igen.

## Leveransen som avslutas

- **L3 steg 5–6:** Studio 023 är installerad i båda miljöerna. Nya paketrevisioner bär produktionens fyra och previews sex befintliga rum (nio respektive fyra bolagspaket). Den gamla dokumentlistan avvecklas med vanlig CAS-sparning efter kodens driftsättning, utan att skriva om material eller låsta spelkonfigurationer. Paketens `rooms` är enda aktiva rumsregistret; Admins `administration.rooms` är en härledd svarsvy. `gameLanes` är kvarvarande uppspelningskonfiguration, inte en andra rumslista; dess avveckling var L3 steg 7, inte någon av de två beställda delarna.
- **Rapportens pengar/valuta:** #708 rättade reserverat saldo i roulette och belopp under en cent. #551 tog bort dubblerade blackjackhandregler. #711 rättar kontovaluta i klienten, bevarar avräkningsvaluta efter valutabyte och beskriver att extern partnerwallet ännu är blockerad. Browsergranskningen rättade även överlappande valutatexter på små skärmar. Intern demoplånbok är fortfarande stödd väg; detta är inte real-money-acceptans.
- **Insatsrutor och perspektiv:** sju rutor är inte sju olika spelare. En spelare får satsa på flera lediga rutor; kamerans/lokalvyns fokus är separat. #714 rättar klient/server-glappet för huvudinsats på en ledig ruta. Annans ruta, sidobet utan huvudinsats och stängt insatsfönster förblir spärrade. Köregeln om högst tre behållna rutor gäller efter rundan när bordet är fullt och någon väntar.
- **Admin:** #713 förbättrar den befintliga sökningen för mobil, aktuella katalogdata och direktnavigation. Materialets användningar länkas till befintliga miljöer. Radering får inte tyst välja en godtycklig dealer eller publicera om olika bolags rum; filmprofil, vald röst, bord och godkänt material måste passa ihop.

Slutliga PR-, CI-, deploy- och städkvitton samlas privat i `.cache/l3-closeout-20261030/REPORT.md`. Äldre `.cache/closeout-20261030/REPORT.md` beskriver det föregående avslutet och har ersatts som lägesbild av denna leverans.

## Jakob-2 och tal: fortsatt pausat

OpenClaw-trimning (AGENT TVÅ, 31 oktober): #717 och JSON-rättningen #720 är
mergade efter buggranskning och grön full CI. Gateway kör `eb41edc03378789a371be8f22965e7ca06f3ddcd`;
Director, spelbackend och Vercel kör `c5cc98d68b219a77d728813f233e27e32a3b54a2`.
Gatewaykoden är oförändrad mellan dessa revisioner; imagen är fortsatt pinnad till 2026.9.5.
Sparade Admin-val är tillämpade: Director/social/tal använder Luna, chatt/operator
Sol 6.1. Native standarder är low för Director/social, medium för chatt, high
för operator och modellbundna low/high för tal. Alla fem agenter har deny-all
för verktyg och avstängda elevated-rättigheter, verifierat i Gatewayens driftkonfiguration.

Director är åter i `adaptive` efter en godkänd tillfällig återställning till `fixed`.
Luna kan eskalera högst en gång till Sol 6.1 inom samma deadline. #720 lägger en
fast applikationsägd JSON-instruktion även bland indata, eftersom Gatewayen flyttar
systemtext till `instructions`. Båda passeringarna täcks av regressionsprovet.
Tio driftkontroller passerade efter deploy: tokenisolering, tillämpade modellval,
syntetiska svenska svar/offentlig handbeskrivning/nekad kort- och saldoändring samt
backendens hälsa och exakta revision. Spelbackend deployades efter en läsande
kontroll med noll aktiva medlemmar, aktuell närvaro och pågående händer.

Chattkontraktet beskriver tillåtna offentliga fakta och egna sparade demoresultat;
en Slack-koppling till samtliga spelares namn och utbetalningar är inte verifierad.
Slack `files:read` och ominstallation är godkända av Jakob men inte utförda;
webbläsarstyrningen blockerades och kunde därefter inte ansluta till sidan.
AGENT TVÅ:s privata kvitton finns i `.cache/agent-tva-openclaw/REPORT.md`.
Ingen tal-/GPU-aktivering ingår.

Ingen ny bank, GPU-körning eller talaktivering ingår. Jakob-2 har en registrerad ElevenLabs-röst och previewmaterial, men saknar en verifierad egen GPU-bank och godkänd nygenererad läppsynk i spelet. Förinspelade godkända repliker är inte samma sak som genererat livetal.

- LIPSNK: `.cache/jakob2-moving-probe-20261030/PAUSED-HANDOFF.md`. Offlinekontrakt, 39 originalrutor, ljud och runner/transport finns; egna tillfälliga GPU-poddar är borttagna. Senaste stoppet var container-/proxy-readiness HTTP 404, skilt från tidigare IMAGE_AUTH_ERROR.
- Importagenten: `.cache/jakob2-realtime-preview-20261030/PROVRUM-HANDOFF.md`. Preview har 48 klipp, filmprofil med 35 tagningar och tio inspelade svar. 96 verifierade tillfälliga videokopior (cirka 225 MB) är borttagna. Inga original eller publicerade rum raderades.
- Röstnyckeln som senast API-verifierades på Render når Jakob/ABYDM, inte Paow/Dragan. Kevins andra konto och endpointägarskap måste verifieras före ett senare byte. Inga hemligheter ska kopieras till Git eller handofftext. `.cache/elevenlabs-kevin-consolidation/` innehåller privat förberedelseunderlag, inte genomförd röstflytt.
- RunPod-mall `5dkkc3wolw` pekar nu på `https://croupier-v3.onrender.com`. Lokal RunPod-nyckel och produktionens movingnyckel når olika konton; deras endpoints är inte utbytbara. Rättningen aktiverade inte Jakob-2.
- Previews tre talhemligheter är separata, 64 tecken och olika från produktionens. Två olästa produktionsvariabler togs bort med privat krypterad återställningskopia. Aktuell miljökarta: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md). En L3-/UI-ändring kräver ingen ny nyckelrotation.

Kvar för senare taluppdrag: delat bords `generated-speech-stream` behöver komplett `assertCurrent`-/distributionsväg; `/studio-preview` har AI/tal av. Taladaptrar delar ännu Render-process med spelet, medan TTS/GPU sker utanför regelkärnan. Se [TALKEDJA](plans/TALKEDJA.md) och [RunPod-underlaget](TALKEDJA-RUNPOD.md). Bank- eller hashkontroller bevisar inte läppsynk.

## Kända återstående frågor

1. **Dragan-test:** det befintliga rummet saknar publicerad spelkonfiguration (`room_config_missing`) både före och efter L3 på den isolerade produktionsklonen. Tre andra produktionsrum ger identiskt materialurval och konfiguration. Rummet ska inte öppnas genom en gissad standardkonfiguration.
2. **Materialersättning och gallring:** dagens materialpapperskorg kan avpublicera och arkivera berörda spelbord. Ett framtida “ersätt och radera” ska visa berörda rum/bolag, välja uttryckligen kompatibelt material, publicera atomiskt och därefter ta bort förbrukade referenser. Ingen ny global reservdealer eller reservbank har införts. Dokument-/pakethistoriken är inte ett parallellt aktivt produktregister; refererade versioner behövs fortfarande av låsta rum. Oanvänd kod och arbetsfiler ska däremot raderas, inte sparas av vana.
3. **Lounge/prototyper:** #707/#709 är återanvändbara bordstillgångar, inte full loungeintegration. Två lokala test-worktrees behålls under `C:/Users/jakob/dev/worktrees/scoutgaming`: `dealer-table-template-1030` på `local-test/bordmall` och `interactive-lounge-1030` på `local-test/lounge`. Loungen har ocommittat arbete, även Admin-ändringar; testmaterialet får inte mergas som en hel gammal produktbranch. De rena hjälparbetskopiorna `lounge-runtime-1030` och `lounge-tsx-1030` avvecklades 31 oktober efter verifierade Git-bundles i privat `arkiv/2026-10-31/dev/worktrees/scoutgaming/`. Testbrancherna saknar upstream och ligger utanför produktens tillåtna pushmönster. Läs testmappens README och privat handoff `C:/Users/jakob/.codex/visualizations/2026/10/30/01a18a56-82c3-7a11-903f-4b0c42deb6c2/next-lounge/HANDOFF-v6.md` före fortsatt arbete; handoffens äldre sökvägar kan vara inaktuella.
4. **Native och drift:** native-/partner-/provspelsadaptrar har levande konsumenter trots gemensam regelkärna. Ersätt deras anrop innan de raderas. `game-013` är separat schemaefterregistrering, inte bevis på saknade pengaposter. F11:s överlapp/återanslutning är driftverifierade på e8d0b935; se kvittots gränser. Tomma bord/noll reservationer gäller fortfarande vid flaggbyte och där publiceringskontraktet kräver det. V2-tjänsten är raderad; `croupier-v3` är nuvarande spelbackend. Den oanvända socketdiagnostiken för de raderade preview-värdarna är borttagen tillsammans med sitt ensamma test; transportens autentisering, tidsgränser och kögränser är kvar.
5. **Säkerhet:** GitGuardian återlästes 31 oktober: noll öppna incidenter, 25 ignorerade. Incidenterna 39166318 och 39166319 är ignorerade som `test_credential`: påhittade Postgres-uppgifter i Studios tester av loggmaskering. Monitoreringen är aktiv. Den historiska skanningen från 2 oktober står däremot kvar som `too_large` med noll skannade commits; noll öppna incidenter bevisar därför inte full historisk täckning.

Miljöinventeringen från 29 oktober är borttagen; aktuella kontrakt och återstående kontroller finns i [miljöguiden](ENVIRONMENT-VARIABLES.md) och [återställningsguiden](ENVIRONMENT-RESTORATION.md#kvar-att-bedöma-för-gallring). Dokumentstädningen ändrar inga molnresurser eller prototypers arbetsfiler.

**AGENT 1 avslutar, 31 oktober:** lokal Git-städning, full Git-backup, två bevarade tester och rapportleverans är klara. [Incidentrapporten](incidents/2026-10-31-repository-history.md) innehåller även den läsande Neon-kontrollen: små appdatabaser, ingen akut radering, befintlig gallring av chatt/probe och kvarstående revisioner/loggar samt återställningskopior. Inga Neon-resurser ändrades. [Övergångsplanen](incidents/2026-10-31-clean-repository-plan.md) beskriver alternativet på cirka 65 MiB; GitHub-historiken och driftvägen är ännu inte utbytta. Ett senare byte måste skydda nya commits/utkast och testernas nuvarande Git-lager. Ingen fortsatt bakgrundsuppgift eller automatisk radering lämnas aktiv av AGENT 1.

## Arbetsgräns och avslut

Regler, slump, sko, kort och spelutfall är spelkärnan. Hela `services/game` är inte orörbar kod: klient, sessioner, rum, presentation och taladaptrar får förenklas och flyttas med bibehållen behörighet, serverauktoritet och atomiska pengatransaktioner. Läs [ansvarsgränsen](../services/game/README.md#vad-som-får-ändras).

De ursprungliga fyra chattarna har avslutat och lämnat över. KOPPLINGSAGENTENs äldre rapport `.cache/kopplingsagent-audit-20261030/HANDOFF.txt` har bedömts mot aktuell kod; importera inte dess gamla reproduktionsskript som smoke tests. #550 stängdes som ersatt; #551, #593, #701, #709 och #710 är mergade. Den nya L3-/valuta-/Adminleveransen har egna slutkvitton ovan. Återuppta inte avslutade underagenter; starta ett avgränsat nytt uppdrag vid behov.
