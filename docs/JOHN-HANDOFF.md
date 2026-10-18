# Aktuell handoff — Scoutgaming

<a id="dragan-talstatus"></a>

## Lipsync 3: rörligt tal godkänt i isolerat prov — 18 oktober 2026

**Jakob har godkänt ljud och munrörelser i det exakta nya rörelseprovet:**
”Ljud och munrörelser ser bra ut”. Filmen visar ”Ulf Lundell är bra.” medan
Dragan delar ut till sig själv, med publicerad bakgrund och bord. Godkännandet
gäller granskningsfilen med SHA-256
`769c5d901775e05ca88773ee3e47174410367ae9c8d0fdb935b4cbcc6080c8f4`
(711 053 byte, H.264/AAC, 1280×720). Det gäller inte andra tagningar eller
full produktionsantagning/spelrunda. Det tidigare tysta, nedskalade utdraget
är inte detta prov och ska inte användas för kvalitetsbedömningen.

### Arbetsplats och leverans

Egen arbetskopia: `C:/Users/jakem/.codex/worktrees/lipsync3-server-diagnostics/croupier`,
branch `codex/lipsync3-motion-readiness`, med main `2e9b5338` integrerad.
[PR253](https://github.com/Jakeminator123/scoutgaming/pull/253) ger sanerad workerdiagnostik och uppdaterar kanoniska guider;
den ändrar inte renderrecept, callbackprotokoll eller modellcache.
Ny förseglad diagnostikrelease:
`dba5492ef8c16c5b874a350b44412c131d006d157ad83448a7b0b01484df7777`.
Den är ännu inte en publicerad eller driftsatt image.

Separat cachearbete sker i den rena, återanvända arbetskopian
`C:/Users/jakem/.codex/worktrees/lipsync3-bank-http/croupier`, branch
`codex/lipsync3-warm-engine`. Beroenden och befintliga junctions ändras inte.

Primärcheckouten `C:/Users/jakem/Projects/croupier` låg vid kontrollen på
äldre main `12f5e6a7`, med andras ändrade `.codex/config.toml`,
`.cursorignore`, samt oregistrerade agent-/Cursor-filer, `a.zip` och `web/`.
De har inte städats eller lagts i denna leverans. Grönt i editorn kan betyda
nytillagt/oregistrerat i Git; det betyder inte i sig osparat. `a.zip` innehåller
agentkonfiguration/verktyg och är inte Emils export. HUVUDAGENT5 äger det
separata klon-/synkspåret; merge-agenten hanterar granskad integration.

### Serverantagning för varm worker

Efter PR253 återanvänds `lipsync3-server-diagnostics/croupier` på branch
`codex/lipsync3-warm-admission` för serverändringen. Den är ännu inte mergad
eller driftsatt. Den nya moving-kontrollen tillåter högst en bevisat egen,
ledig worker med färska release-/hälsodata och samma journal-lease; den
ändrar inte generiska jobb, återhämtning, insats, saldo eller spelförlopp.
Endpointens min/max är 0/1, tomgång högst 60 s inom samma 720 s reservation.
Den kräver en exklusiv endpoint eftersom provider-GET och POST inte är atomiska.

65 fokuserade kapacitets-/sessions-/journaltester passerade utan skips.
Isolerad WSL/PostgreSQL-fixtur passerade med 4 retained-kontrakt, 26 SQL-
och 59 integrationskontroller, inklusive ny kall/varm antagning, samtidiga
SQL-skrivare, oförändrade kostnadsrader och recovery-fence. Den fristående
miljöberoende testwrappern rapporterar ett skip; samma SQL-funktion kördes
uttryckligen av fixturen. Ingen produktionsdatabas användes. Underlag:
`motion-readiness/warm-admission-tests.log` och `warm-admission-sql.log`
i den privata provbasen nedan. Oberoende kodgranskning fann inga blockerare;
verkligt serverless-/varmcacheprov återstår.

### Vad som faktiskt verifierades

18 oktober 16:20–16:27 UTC kördes en enda isolerad RunPod med exakt redan
publicerad workerimage:
`ghcr.io/jakeminator123/moving-gpu-worker@sha256:178c3459460980e979f679837d6a0c52cc34202fb64fb3da86fcc6403bffc127`.
Workerrelease var `c8ba8f3c81315d172e292fa5316fca66d289f219ab7c3672b97201a3a5ed653f`.
Oförändrade `verify_release`, `verify_bank`, `ProcessEngine` och
`session.serve` användes inklusive ordinarie 30-fps-grind.

| Underlag / mätning | Verifierat resultat |
| --- | --- |
| Bank | Fullbank 594 432 000 byte, 50 klipp, 2479 poolrutor; SHA `5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c`. |
| Källfilm | `d9c7fefb-141c-4809-aecf-3904392f22f5` (dealer-iv), SHA `061e82f2d4be69d3a73a2e6842692eb2d23c7b7e11fcd9d246fbb0c85e9f72c0`, 66 rutor vid 24 fps. |
| Ljud | Befintligt trial03-PCM, 73 560 byte, 24 kHz mono; SHA `767ad6ff0e0c65786f25d5ae0d60595671f0351858a35f47039d838a98a8aa32`. Inget nytt TTS-/LLM-anrop. |
| Plan | Källrutor 0–53 får 54 talrutor; alla 66 kroppsrutor spelas, ingen källruta loopas. 220 ms ledande ljudutfyllnad. |
| GPU | En NVIDIA RTX 4090, nvidia-smi 24 564 MiB, driver 580.159.04, Torch 2.8.0+cu128. RunPod tilldelade 62 GB RAM/16 vCPU; containerns host-/affinitetsvärden visar större värdmaskin och är inte tilldelningsbevis. |
| Kall container | 175,7 s till provbryggans beredskap; därefter separat uppladdning av banken. Detta är inte serverless-kötid. |
| Bank/modeller | Bankverifiering/extraktion cirka 1,19 s; modellhashkontroll cirka 2,59 s. |
| Motorstart | Import/modell/avatar/uppvärmning cirka 49,52 s; uppvärmning 63,7 fps. |
| Rörlig replik | 54 rutor på 987 ms, 54,7 fps, första paket 342 ms; fem paket, totalt 158 493 byte. |
| Webbläsare | Oförändrad produktionsspelare och kompositor: completed=true, alla 66 unika kroppsrutor 0–65 observerade, 54 ansiktsrutor mottagna. Inspelning från faktisk canvas och samma ljudkälla. |

Detta testar worker, exakt källavkodning, protokoll, ljudklocka och lager.
Det använder en lokal callback/replay utan produktionsbudget, autentiserad
Render-antagning, serverkort, insats eller saldo. Ett vanligt kort chattsvar
i öppningssekvensen kan vara slut före dealerns kort; självutdelningsprovet
valde därför detta exakta klipp uttryckligen.

Pod `chorewqxdanti3` raderades och frånvaro återlästes 16:27:14 samt 16:56 UTC.
Priset var 0,89 USD/timme. Vid avstämningen 16:56 UTC fanns ännu ingen
kostnadsrad för podden; slutkostnaden är okänd. 378,133 sekunders lokal
livstid motsvarar cirka 0,0935 USD compute vid detta pris, utan verifierad
avrundning eller lagringskostnad. Trial03-endpointen `wim5211q6r5el9` hade
en faktisk billing-rad om 0,0382514056 USD och 112 873 debiterade ms;
det är en avläst kostnadsrad, inte slutlig fakturagaranti. Sanerat kvitto:
`motion-readiness/billing-closed-pod-1792342577297.json`. Äldre Astrid-endpoint `zsudl8tmzcmiv1` kör annan
image; dess kvarvarande worker var EXITED på RTX4090 vid 16:19-kontrollen.
Inga andra pods/endpoints ändrades. Jakob har uttryckligen återkallat det
tidigare konservativa provtaket; gamla reservationer är historik, inte
fakturerad kostnad eller ett fortsatt mänskligt stoppmandat. Serverns sparade
journalgränser ändrades inte av det isolerade provet och måste avstämmas före
ny produktionsantagning.

### Källor, filmer och lagring

Privat provbas:
`C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900`.
Under `motion-readiness/` finns `gpu-result/` med PCM/H264/plan/kvitto,
`playback-01/` med WebM-original, MP4-granskningskopior och bildrutetider,
`visual-acceptance.json` med exakt filbindning och `pod-journal.jsonl` med
resurslivscykel. Rå privata request-/logg-/statefiler får inte allmänuppladdas.
Den lokala granskningsvyn använder 127.0.0.1:8767; tidigare reviewserver på
8766 bevaras tills ägaren avvecklar den.

Emils riktiga export finns i
`C:/Users/jakem/Desktop/_croupier/lappsynk-export-fe1b55e.zip`,
145 846 625 byte, SHA `949443c1084ab3f515792fe66c5e2d381e985f9bdc743e792e5fbca36a9240a3`.
Dess referensbanker är inte vår aktiva fullbank. Fullbanken, källmanifestet och
kvittot finns redan privat i Blob; 50 exakta Neon-källor och Blob-storlekar
kontrollerades 16:13 UTC. HEAD är inte ny helhashning. De två använda
källfilmerna samt bord/bakgrund fullhashades för replay.

Kuraterad extern bevaring slutfördes **18 oktober 16:55:28 UTC**: 53 nya
objekt och ett sanerat manifest, totalt **222 641 075 byte**, laddades upp
privat utan overwrite. Alla 54 objekt återlästes i sin helhet och matchade
storlek och SHA-256. Fem befintliga medieobjekt återanvänds som referenser;
denna uppladdning är inte en ny fullhashning av dessa fem.

Återställningsmanifestets privata Blob-sökväg är
`croupier/media/dealers/dragan/staging/lipsync-review/d63657f1-cc18-5707-9551-86d380f39404/ed5b5c1cd9799bf46e83ec513cb09282637bda9d2acedf40f952ea8bbd1b6b10.json`
(68 291 byte; SHA-256 är filnamnet). Det innehåller roller, källbindningar,
hashar och det enda exakta visuella godkännandet. Omkodade jämförelser är
märkta som derivat, inte som bankens originalbytes. Emils ZIP är bevarad
oförändrad; 19 textfiler granskades för hemlighetsmönster utan träffar,
men binära tensorers innehåll är inte fullständigt sekretessgranskat.
Planhash `26ec9bc513455a67c4ca35049c83dc2c17712693e97aef2021e5d79c2b0bf23b`
och fullständigt uppladdningskvitto finns under provbasens
`artifact-preservation/`. Inga Neon-rader eller Admin-klipp skrevs:
registrerade källor ligger redan i Neon, medan granskningspaketet är
bevarat underlag. Lokala original finns tills separat ägarkontrollerad städning.

Moving-runtime sparar ännu inte
sina resultat automatiskt i svarsbiblioteket. Råa 256×512 mun-/maskpaket är
inte kompletta MP4-klipp och ska inte registreras som sådana i /admin/clips.
Se de korrigerade kontrakten i [runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md)
och [återställningsguiden](ENVIRONMENT-RESTORATION.md#beständig-molndata).

### Levererat tidigare och återstående arbete

PR242 rättade verifierad lokal chunked-hämtning; `bank_length_mismatch`
återkom inte i senare prov. PR244/248 gav begränsade klient-/serverfelkvitton.
PR247 återhämtar ett DEAL-val när talet stängts av före spelmutation.
PR250 buffrar hela repliken före ljudstart; trial03 slutförde vilotal med
54/54 rutor efter 225,7 s väntan (providerkö 118,9 s, execution 96,7 s).
Inga insatser gjordes. Dess gamla tysta skärmutdrag hade tidsluckor och gav
inget tillförlitligt visuellt godkännande.

PR251 är mergad som `b623a3fc438ffd1e602d9914fd1de6a7f5091ad9`.
Den bevarar mikrofonens originalspråk och skickar validerade bilder som
multimodala delar. 128 fokuserade tester och PR/main-CI passerade. Vercel
verifierades READY 15:38 UTC, croupier-v2 LIVE 15:47 UTC och Director LIVE
15:48 UTC på samma SHA. Gateway ändrades inte. Riktig mikrofon-/bild-E2E
har inte körts för denna ändring. Senast verifierad moving-talflagga är 0,
Dragan-profilen preparation och trial03-endpoint/mall avvecklade.

Nya diagnostikändringen: 69 worker-CPU-tester passerade, därefter åtta
fokuserade tester för första felorsak/IPC efter sista ändringen; inga fel
eller skips. Oberoende review fann inga kvarvarande blockerare efter att
diagnostics.py lagts i releaseförseglingen. CPU-/kodresultat innebär inte
att den nya diagnostikimagen redan är byggd eller GPU-provade.

Nästa arbete: säker återanvändning av modell mellan fullständigt avslutade
jobb, med avveckling vid fel/avbrott/identitetsbyte; mät kall/varm verklig
prestanda och cancellation. Därefter kontrollerat produktionsprov med
auktoritativ spelkontext, förbättrad permanent resultatbevaring och exakt
drift-/kostnadskvitto. Behåll den uppmätta flaskhalsen åtskild från GPU-val:
RTX4090 klarade denna replik, medan modellstarten dominerade väntan.

Miljöstädning som redan är verifierad: Impactwins Render game-engine och
Neon preview-v2 raderades efter uttryckligt val 18 oktober. Produktionens
croupier-v2/main bevarades. Gamla arkiverade croupier-preview-neon och
codex-zone-storage-qa är kvar. Vercels scoutgaming är ett projekt/team;
croupier-lab-ui.vercel.app är alias till samma produktion. Kevin-staging var
en separat misslyckad Preview med äldre bygglogik. Preview delar fortfarande
produktionsbackend och får inte antas vara isolerat. Namn som astrid/lissabon
i gemensamma moduler bevisar inte att fel dealer eller databas används.

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
