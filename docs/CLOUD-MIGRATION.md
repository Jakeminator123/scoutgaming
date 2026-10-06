# Croupier: aktuell källa, drift och leverans

Uppdaterad 5 oktober 2026. Detta är den enda migrationschecklistan/masterplanen.
Upprepade historiska checkpoints är komprimerade, inte raderade ur Git:
[full historik på `91d0c4d9edcf27bd4fd5c76524185fa92e0551b9`](https://github.com/Jakeminator123/github-work/blob/91d0c4d9edcf27bd4fd5c76524185fa92e0551b9/docs/CLOUD-MIGRATION.md).
Privata kvitton, FAIL-historik, journaler och backups ligger kvar på befintliga platser.
Källkod/publicerad runtime/acceptans har egna revisioner; senare SHA uppgraderar inte
ett äldre prov automatiskt.

## Öppen arbetschecklista: en sammanhängande Studio

Målet är att `/studio` fungerar som en gemensam arbetsyta för tidigare Lab och
Backoffice: samma inloggning, begriplig navigation och fungerande dealer-, klipp-,
administrations- och OpenClawflöden. Detta är den öppna arbetslistan för fortsatt
arbete, inte en ny migrationsplan. Huvudagenten samordnar och uppdaterar den.
En ruta kryssas först när resultatet nedan har verifierats; äldre PASS räcker
inte för ett ändrat flöde. Senaste gemensamma startversion: `3e613186`.

- [ ] **A. Administratör kan logga in till Studio.** Jakob har bekräftat att han
  skapade `john.g` i Backoffice från det inloggade kontot `Jakob`. `john.g`
  fungerar som blackjackspelare. Synlig kontometadata bekräftar aktivt
  spelarkonto, ingen synlig Studio-användare med samma namn. Spelarkonton har
  enligt nuvarande kontrakt ingen Studioåtkomst; headerns Administratör gäller
  inloggade Jakob. Kontoformulären förtydligas. Ett separat administratörskonto
  behöver invitation/aktivering via e-post; produktionsmail är punkt F.
  Klart när det avsedda administratörskontot når `/studio`, med rätt behörighet,
  och spelarkonton fortfarande nekas. Kontodata ändras först utifrån belagd orsak.
- [ ] **B. Backoffice går rimligt snabbt att navigera i.** Föreprov på
  `3e613186` gav fyra gruppbyten 7,468 / 4,944 / 4,859 / 10,018 s.
  Authrättningen grupperar fyra färska identitetsläsningar i en transaktion
  (12→6 databasfrågor, utan cache). Produktionsomprov på `ba0cb7ee` gav
  7,195 / 3,325 / 5,937 / 2,913 s: varierande väntan kvarstår och 18 GET
  var oförändrat. Nästa riktade rättning tar bort sju extra sessionanrop:
  varje native data-GET lämnar identiteten från sin färska behörighetskontroll,
  och klienten avvisar identitetsbyte, saknade headers och revoke före visning.
  81 riktade tester passerar; legacy- och skrivkontroller kvarstår. Klart när
  faktiskt publicerat flöde är ommätt med rätt data och bevarad behörighet.
  Publicerat `cb8e5254`: 11GET200, fyra fulla mätningar 2,553 / 4,834 /
  6,653 / 2,682s. Anropsminskning bevisad, latenstoppar kvar. Publicerat cd9f5b21
  sammanför färska authprojektioner (utan cache): två SELECT/fyra frågeanrop
  mot tidigare fyra/sex. 118 riktade PASS; signer/sessionförst, collision,
  roll/stamp/epoch och mutationslås bevarade. Numerisk Server-Timing skiljer
  runtimeväntan från API/auth; 18 riktade PASS. SQL8 och CI37305177411 passerar.
  Live cd9f5b21: 11GET200, 9,361 / 2,112 / 2,088 / 1,426s. Första bytet
  innehöll 3,04 respektive 2,76s serverinitiering; senare initiering under1ms.
  Ingen generell latensgaranti. Publicerat 34f64e34 tar bort fyra inledande
  sessionGET och tillåter menybyte under läsning, med gemensam färsk identitet
  kontrollerad före bodyläsning, sena svar avvisade och skriv-/utkastspärrar kvar.
  101 riktade PASS, oberoende review och fullhook 1554PASS/9skip/0fel.
  CI37307380711 har tre successjobb. Live:7dataGET200/0session/0POST,
  1,472 / 5,544 / 4,709 / 1,181s. Byte under pågående läsning fungerade;
  gammalt anrop avbröts och rätt vy visades utan fel. Latenstoppar i initiering
  och dataläsning kvarstår; punkten förblir öppen för dem.
  Regionprov 6 oktober på samma `019dba6d14c0b8b9c9de900af572e916316649b3`:
  Studio-projektets sparade Vercelregion ändrades från `iad1` till `fra1`,
  nära Neon i Frankfurt. Aktiv produktion är
  `dpl_24S1idmMEHgzpPYqrwPPLf2P6YNk`, READY, med oförändrad Studio-adress.
  Första Studio→Backoffice gav 7,879→3,041 s. Overview GET gav
  7,208→2,449 s (runtime 2646,53→319,49 ms; API 1307,22→88,18 ms),
  shoes 3,648→0,934 s (runtime 2683,45→546,38 ms; API 666,36→63,00 ms).
  Varm omläsning gav overview 1,595→0,328 s och shoes 0,866→0,267 s.
  Båda data-GET var 200 och faktiska svar visade `fra1` i `x-vercel-id`.
  Oinloggade overview/shoes gav 401; Studio-login och game-session GET gav 200.
  Neon-plan, DB-data, behörighetskod och produktkod ändrades inte.
  Ett tidigare redeployförsök är CANCELED: det ärvde `iad1` trots regionoverride.
  Det accepterade provet byggdes från samma explicita Git-SHA efter sparad
  regionändring. Första overview har fortfarande cirka 2,04 s utanför
  Server-Timing-faserna. Detta är ett första-/varmprov med befintlig adminsession,
  inte ett nytt lösenordsloginprov eller en garanti för alla grupper/enheter.
  B förblir öppen. Nästa arbete: lokalisera återstående start-/proxyväntan,
  minska sekventiella startläsningar med bibehållen färsk behörighetskontroll,
  och pröva navigation utan full sidomladdning med bevarade utkast.
- [ ] **C. Studio samlar Lab och Backoffice.** OpenClaws modellvy har
  `/studio/openclaw`; operatörschatt har `/studio/operator-chat`. Intern
  navigation, direktlänk, reload och loginens målroute är rättade. Båda vyerna
  samt spelarkonto/adminförtydligandet är verifierade i publicerad `ba0cb7ee`.
  Native/Neon spärrar det äldre fristående röstprovet; UI ska visa detta och
  göra noll röst-GET/POST, med serverns spärrar kvar. Neutrala miljö-/spartexter
  och denna UIrättning har 65 riktade PASS. Publicerat cb8e5254/reload visar
  otillgängliginfo, inga kontroller/alerts och noll röst-GET/POST/API503.
  Klart när menyrutter/direktlänkar/login fungerar ihop, utkast bevaras och
  kvarvarande desktop-/mobil- och användarflöden faktiskt är verifierade.
- [x] **D. P6:s isolerade SQL/HTTPS-prov — verifierat lokalt och i CI 5 oktober.** Huvudagenten har rättat testfixturens
  saknade `gameDb` i både auth- och kontofabriken samt äldre reader/staff-
  antaganden. Osäker talleverantörssubmission ska förbli spärrad vid shutdown,
  inte förväntas vara rent avslutad. Behåll negativa rollprov,
  verkliga SQL-transaktioner, reset/revoke, omstart och cleanup. Klart när samma
  befintliga provmotor passerar på aktuell källa i eget tillfälligt kluster.
  Körning 3: exit0, 17 äldre och 25 aktuella integrationschecks samt fyra
  retained-bank-kontroller. Verklig SQL/HTTPS/omstart och cleanup passerade;
  versionskvitto har stabila inputbytes. Körning 1–2 FAIL är bevarade. Detta
  stänger den isolerade deluppgiften, inte återstående mänsklig/live-P6 i H.
  Samma motor har nu faktiskt PASS i CI37308717362 på exakt e49f6f36.
- [x] **E. Systemkartan visar faktiskt provutfall — verifierat på e49f6f36.** Samma isolerade SQL-motor
  används i CI. `ba0cb7ee`, CI `37300874695`, failed före databasstart när
  runnerns installerade PGDG-libpq saknade nedladdningskälla. Exporten är
  korrekt röd för `studio.sql-restart-https`, med exakt SHA och observationstid.
  Failure-exporten bevaras privat.
  Rättningen använder egen tom paketstatus och installerar/ändrar inget på
  värdsystemet. Klart när ett faktiskt SQL-prov och exporter visar rätt
  resultat/SHA/datum; saknat eller skippat prov får aldrig bli grönt.
  Nästa `cb8e5254`-CI37303118034 stoppade efter databasstart vid delprovets
  resultatavläsning: CI använder Node24.21.0, lokal Node22.22.x. Runnern väljer
  nu uttryckligen TAP, som dess räknare läser, och CI=true lokal SQL7 passerar.
  Även denna exakta failureexport är röd och bevarad. CI37305177411 har tre
  successjobb och faktiskt SQL PASS på exakt cd9f5b21, med observationstid.
  Export: 19green/0red/5grey, inga valideringsfel; okända delar förblir grå.
  routes.studio saknade ett befintligt event-treeprov i CI. CI37307380711 på
  exakt 34f64e34 kör det:14PASS, routekontrakt GREEN. Färsk export har20green/
  0red/4grey och faktiskt SQL PASS. Två ytterligare kvittoluckor är rättade:
  befintligt shoe-prov körs före exporten/genom reportern utan dubbelkörning,
  och befintligt zone-cloud-store-prov ingår fullhook;15lokalaPASS/0skip.
  CI37308717362 på exakt e49f6f36 har tre successjobb och export22green/0red/
  2grey, errors[], observedAt2026-10-05T12:22:56.667Z. Faktisk SQLentry
  passed1/failed0/skipped0; event-tree14PASS, zone14PASS och shoe1filPASS
  med197internaassertions. Spel-/zonkontrakten är GREEN. Fullhook1569PASS/
  9befintligaskip/0fel/cancel. De två persistencekontrakten behåller
  GREY: deras riktiga concurrency/persistenceprov kräver isolerad
  croupier_game_qa och kördes inte. Separat Studio-SQL-PASS ersätter det inte.
  Efterföljande dokumentcommit04baf354, CI37309484604, stoppades före första
  steg i alla tre jobb. GitHub anger betalningsfel eller Actionsgräns utan att
  särskilja orsakerna. Ingen ny kodprovning utfördes. Kontoägaren behöver
  kontrollera Billing and usage; inga budget-/betalningsändringar eller blinda
  omprov görs. Funktionsbeviset på e49 och privata failurekvitton bevaras.
- [ ] **F. Produktionsmail och användbar invite/reset.** Mailutredningen har
  belagt tom produktionsnyckel, saknad avsändare och Resendkoppling endast till
  QA. Nästa steg är giltig avgränsad sändnyckel för `scoutgaming.tech`, rätt
  produktionskoppling och ett uttryckligt avgränsat prov med utsedd mottagare.
  Jakob avsåg Gmailadressen som avsändare, inte mottagare. Resend kräver en
  verifierad ägd domän; använd exempelvis `no-reply@scoutgaming.tech` efter
  verifiering. Befintlig admin bjuder in ny admin; inget extra mejlgodkännande
  av superadmin finns. Ingen ny provmottagare är utsedd.
  Klart när faktisk produktionskonfiguration är återläst och provet fungerar
  hela vägen. Historisk QA-invitation är inget nytt utskicksmandat.
- [ ] **G. GitGuardian-fynd utredda och hanterade.** Senast återläst
  workspace795524/source30689542, 12:20UTC: 12 öppna och fem ignorerade,
  komplett incidentlista (1 incident-/17 locationsidor). Sex positionerade
  öppna fynd täcker sju källhashpositioner i `docs/system-map/contracts.json`,
  verifierade mot exakt e49f6f36. Senaste nya ID är 37880359/60. Äldre matchning
  för 37867512/37879729 är fryst eftersom deras källfiler har ändrats och dagens
  metadata saknar positioner. Även 37862641/37863164/65/66 saknar positioner.
  Totalt nio positionsluckor, varav sex öppna. Historisk fixtureklassning är
  inte ett nytt bevis för saknad metadata.
  Klart när varje fynd har aktuell belagd klassning och konkret hantering.
  Alla tolv är fortsatt öppna; ingen automatisk ignore/resolve eller breda
  filundantag. GitHub queued/missing GitGuardianrun betyder inte incidentfrihet.
- [ ] **H. Återstående spel-, media- och enhetsacceptans.**
  **Nytt bildfynd 5 oktober:** upload `kortflipp_kling_1080p.mp4` (8,29 MB)
  visas sparad/återläst i ready med användning Idle, men Jakob kan inte
  placera den som idle-variant; ”Välj hur klippet ska användas →” upplevs
  inte reagera. Utred ready-listning, filtrering och knappens navigation/fokus.
  Separat klartkrav: isolerad upload går att hitta, tilldela som idle-variant,
  spara och återläsa efter omladdning. Rotorsak ännu inte reproducerad;
  ingen ändring/aktivering av produktionsmedia utförd. Övriga krav: fyra dealers/två
  faktiska plays, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/
  omstart och naturligt provider-COMPLETED där det saknas. Mänsklig läppsynk,
  kortkontakt och fysisk mic/kamera/mobil/Safari redovisas separat. Klart när
  varje krav har aktuellt bevis eller ett exakt kvarstående hinder. QA AI/GPU
  förblir OFF; betalda prov kräver färsk avgränsad auktoritet.
- [ ] **I. Resterande drift och backup.** Läsutredningen skiljer följande krav:
  frame-varningen täcker saknad uppspelningsstart, presenterad bildruta eller
  avslut; ursprungskvittot saknar flaggorna. Nästa steg är snäv diagnostik
  och reproduktion med exakt idlefilm, med bildrutespärren kvar. Zoner har
  separat editorlagring/versionsskydd och styr ännu inte spelet; full isolerad
  spar-/återläsnings-/omstartsacceptans saknas. Startsidan byter asynkront
  hero-layout och introoverlay; möjlig flimmermekanism kräver faktisk bildserie
  och laddningsmätning innan rotorsak/rättning hävdas. Extern produktbackup har
  matchande verifierat kvitto, men Director/Gateway saknar angivna fullbackup-
  och återläsningskvitton. Nästa steg är samordnad faktisk skrivarfrysning,
  export av `/data/catalog` respektive `/data/openclaw`, extern kopia och
  hash-/SQLitekontroller enligt återställningsreglerna. Exportåtkomst är inte
  prövad. Klart när omprov/fix eller exakt kvarstående hinder är belagt per
  driftfel, och båda tjänster har verifierad extern fullbackup.
Detaljer och kvittoplatser: [den enda löpande handoffen](JOHN-HANDOFF.md#återstående-arbete-i-utförandeordning).
Avslutade migrationssteg och deras historiska bevis står kvar nedan.

## Källa och historiska driftkvitton

Arbeta i `C:/Users/jakem/Projects/croupier`, på main i det privata
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work).
Main är leverans-/standardbranch sedan 2 oktober; två produktionsbyggen på Vercel
och fyra Render-kopplingar använder samma repo/main. Produkt-Render autodeploy
`checksPass`; de andra tre `off`. GitLab-inbox/wiki/mirror och Jira/CAC är pensionerade.
`Jakobs-v1` på `600093e4522efc57bd82979cff65492a528ffeb7` bevarar commitad v1,
inte ignorerade privata profiler/data.

Senaste verifierade funktionsversion är `6ced437eb50637c0d8445c6d1d3c60348170c550`:
CI `37254441092` completed/success, tre jobb; fullhook 1 495 PASS/9 skip/0 fel.
Produkt-Render `dep-db1ggutckfvc73dnp5q0` LIVE, finished
`2026-10-05T02:18:51.251466Z`; frontend `dpl_DWszpEvfBcN1V4T7GbCdEF9hkLme` och
Studio `dpl_AstvxoUUAA5HasMhiAYjaDuPqa8b` READY på samma SHA.
Paketet rensade åtta dokument och rättade BO-anrop samt kvarliggande idle-feltext.
Den efterföljande slutöverlämningen ändrar enbart dokumentation och lokala arbetsytor.
Director och QA behåller `ee0608044f7c78b80c4f46023cd67a7b391e17f0`.
QA:s 37 envvärden är oförändrade. Genererat tal/streaming/preview/cloud-tal,
kamera/Lissabonprofiler/native-admin är OFF; inga Cartesia-/RunPodnycklar.

**P0–P5 och P7–P9 är verifierade; P6 är fortsatt öppet.** Dataimport/policybyte och
fysisk avveckling är utförda. Detta är inte full mänsklig medieacceptans,
fysisk mic/kamera/mobil/Safari, full invitation/reset eller incidentfrihet.
För fortsatt arbete: följ [den prioriterade överlämningen](JOHN-HANDOFF.md#återstående-arbete-i-utförandeordning).
Den innehåller konkreta filer, beroenden och slutvillkor för P6-fixturen,
kartans resultatkoppling, produktionsmail, GitGuardian, manuella prov och driftsrestpunkter.
Senast återlästa driftversion är `bc0f3d79` (dokumentation efter funktionspaketet),
CI37256695695 success och Render/Vercel LIVE/READY; inga produktkodändringar sedan6ced.
[JOHN-HANDOFF](JOHN-HANDOFF.md) har aktuella drift-ID:n, kvittoplatser och öppna fynd.
Slutpaketet startade inga nya providerjobb eller prisprov. Slutversion/CI/driftkvitto finns i
`lab/data/platform-private/docs-cleanup-final-20261005.json`.
Samlad agentöverlämning, testernas gränser och Git-städning finns i
[JOHN-HANDOFF](JOHN-HANDOFF.md#samlad-överlämning-från-alla-arbetsagenter).
Inga PR:er finns i repoavläsningen; leveranserna gjordes direkt på main.
Efter verifierad privat Gitbundle-backup finns bara main och huvudcheckouten kvar.
Tre färdiga agentworktrees är återställningsbart arkiverade, två rena initieringsrester
och elva migrationsbrancher borttagna. Tre appskapade tillfälliga handoffbrancher är också borta.

QA är en separat Croupier-testinstallation, inte Kevin Lane eller enbart OpenClaw.
QA:s OFF-flaggor hindrar dess AI-/tal-/GPU-prov; produktions-Mobiles lane är aktiv.
Att ta bort en sparad lane ändrar spelvalet, inte tjänster, databaser eller journaler.
QA avvecklas därför inte som bieffekt av lokal Git-/lane-städning.

## Fem dokument i docs

- [JOHN-HANDOFF.md](JOHN-HANDOFF.md): verifierat nuläge, överlämning och öppna fel.
- [ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md): backup/återställning och data/mediaregler.
- [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md): namn, tjänsteplacering och villkor.
- [LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md): ansvar/kontrakt/uppspelning.
- Detta dokument: källa, målbild, checklista, driftskarta och leverans.

Behåll högst fem Markdownfiler i docs; uppdatera dem i stället för nya rapporter/
sprintarkiv. [Labbguiden](../lab/docs/README.md) och
[OpenClaws versionsbundna källindex](../open-claw/lab/docs/README.md) ligger nära koden.
JSON-register/systemkarta, media/baseline och privata QA-kvitton bevaras.
Tre ersatta Lab-dokument och redundant `Start-Lissabon.ps1` är borttagna i 91;
take/preview/tillgänglighetsregler finns i guiden, aktiva launchers består.
Gallringen i `6ced437e` tog bort fem historiska V3-kartfiler under `docs/animation-events/`,
en ersatt releaseinventering och två Polarlotto-filer om andra operatörer:
åtta filer/1 143 070 byte. De har inga aktiva konsumenter och finns i Git `6b9dad55`.
Två QA-kvitton med öppna takebeslut och alla aktiva miljö-/baseline-/kartregister behålls.
De tekniska guiderna kortas; inaktuella produktdiskkommandon ersätts av aktuella
Neon-/Blobregler. Inga `.env`-filer, providerinställningar eller databasvärden ändras.

## Masterplan: en Croupier Studio

### Mål och städprincip

En publik sajt `www.scoutgaming.tech`, Studio under `/studio`, från ett repo.
Två tekniska Vercelbyggen är tillåtna under samma adress; paket-/Nextsammanslagning
är inte ett separat migrationsmål. Ingen admin-iframe eller andra aktiva policykällor.
`/blackjack` är nu spelet; `/game` redirectar med godkända queryparametrar och
`/player-login` är entré. Partnerlaunch/callback/returnTo följer samma adresspolicy.

Dealer & klipp, Backoffice och OpenClaw är huvuddelarna. Dealerarbetsytan har
Idle, Kort & deal, Fasta repliker, Bakgrund och Probe samt exakta egna register.
Uppladdning är en klipphandling, observation/avancerade regler sekundära verktyg.
Gamla event-/simulatorvyer flyttas inte in som ny huvudapp.
Backoffice visar nu elva aktiva sektioner; pitboss/turneringsformulär och två
informationspaneler är dolda som overifierade, deras API/schema/data/behörigheter bevarade.
OpenClaw har befintlig native dashboard och en avgränsad modellvalsyta för fem agenter,
inte ny fri provider/auth/editor eller generell Render-omstartsknapp.

Neon äger konton/behörighet/wallet/rundor, Studio-dokument/revisioner/historik/
mediemetadata och jobb-/kostnadsjournaler. Zoner har separat explicit databas.
Samma privata Blob äger beständiga medier, inklusive nya färdiga talpaket.
Render äger auktoritativ spelmotor/live transport; Director/Gateway och RunPod består.
Ersatt kod/disk/env/register ska faktiskt bort efter verifierad ersättning,
inte bli permanent fallback. Gamla adresser får vara rena redirects.

Jakob valde bort gammalt Studio-slask, granskningsgenerationer och cache från
migration/ny backupkampanj. Nytt tomt granskningsbibliotek är ett uttryckligt
startbeslut, inte fallback vid DB-fel. Aktiva spelklipp, konton/saldo, OpenClaw,
jobb/journaler och förbrukade reservationer är inte slask.
Radering kräver exakt scope/referens-/paritets-/restartbevis, inte mappnamn eller ålder.

### Gemensamma kontrakt

1. **Identitet:** gemensamt username/e-post/lösenord, ingen kontotypsväljare.
   Admin får spel+hela Studio/BO, superadmin är adminalias; reader/staff är game-only.
   Befintliga råroller/IDs/saldon/historik bevaras, ingen ny OAuth/kontoreset.
   Credentialresolver kräver exakt en kandidat; collision/pending/fel lösenord ger
   generiskt avslag utan fallback/klientroll. Kapabilitet `sharedCredentials`
   läses före dispatch; misslyckad läsning blockerar, inte alternativ namespace.
   Sessions-/Origin/CSRF/Host/JSON/roll/fingerprint/auth_epoch gäller på servern.
2. **Sparad policy:** Render/Studio använder samma explicita Neonmiljö/workspace.
   `CROUPIER_STUDIO_NEON_POLICY=1` och native `CROUPIER_STUDIO_NATIVE_ADMIN=1`
   får inte skapa två writers. Gemensam spelrevision binder projekt/adminrevision,
   exakt projektrevision består i spelarens kvitto. Repeatable-read/CAS/transaktion/
   historik/audit och bevarade utkast krävs; disk-lock/rename räcker inte.
   ”Profiler” avser presentationsinställningar, inte companion-minne/agentstate.
3. **Media/jobb:** privat objekt-ID/hash/metadata, behörig tidsbegränsad upload/commit,
   servervaliderad filtyp/storlek/hash och säker delete. Ingen Blob-/providerhemlighet
   till klienten. HEAD/Range och privat source/layout-spärr består.
   Blob ersätter filer, inte idempotens, ägare, lease/budget eller GPU-reservationer.
   Fullfil får Blobpaket; stream får inte tvingas genom Blob/betald fullfilsfallback.
4. **Spel/AI-gräns:** Vercel gör lätta Studio/admin-anrop; Render/RunPod äger live spel/
   långvariga jobb. `/speech-stream` och `/lipsync-worker` bevarar auth/workerbiljetter.
   Reconnect återspelar inte gammal kö/startar inte nytt betalt GPU-jobb.
   OpenClaw får tillåten publik kontext/katalogrevision, ingen direkt saldoauktoritet.
   Kamera består; mic transkriberas före modellen. Råljud/modell-/GPU-uppgradering ingår inte.
5. **Schema/authkommandon:** checksumlåst product-v1/`ops/neon-game/product-schema.sql`
   ändras inte retroaktivt. Separata additiva001–004 och återläsningsprov krävs.
   `/api/bo/config` är aktiv Neon-spelprojektion, inte generell raderingskandidat.
   Spelarstatus/partner rotate/revoke/launch/credit kräver signerad Renderauthority,
   nonce/tidsfence och verklig runtimecancel före OK; Vercel skriver inte eget saldo.
   Självrollbyte/radering/sista-admin-race skyddas. Engångstokens är atomiska;
   partnerhemligheter visas tillfälligt, aldrig i listmetadata/storage/audit.

### Checklista och beroenden

Bocka av endast verifierat delmål. Kod/fixtures är inte installerad drift;
hash/transport/stillbild är inte mänsklig synkapproval. P7 godkändes uttryckligen
med avgränsad funktionell admission medan full P6 lämnades öppen.
Checklistan är statuskällan; äldre snapshots/procenttal är historik.

- [x] **P0 — målbild:** en Studio, privat Blob och Neonstate. Render/OpenClaw/
  RunPod behåller sina aktiva ansvar. Slutstädning ingår, inte bara nytt UI.
- [x] **P1 — kontrakt och inventering:** käll-/mål-/ägarmapp, exklusiva filclaims
  och alla läsare/skrivare inventerade före mutation/radering. Saknad åtkomst redovisas.
  Första ofrysta exporten (129 journalfiler, 18 terminala GPU-jobb, 46 streamrequests,
  tre kampanjer/sju försök/ingen aktiv grind) var inte importauktoritet.
  Saknade rå BO-/socialfiler gav separat proveniens för effektiva defaults.
  Sex av 18 klippbindningar hade bytta bytes i 891c432a; exakta original återfanns
  i 365f283b: 6/6 hash/storlek/utan ljud. Sex immutabla privata Bloboriginal,
  8 262 169 byte, fullåterlästes; retained-bank-blob-receipt.json visar identitet,
  inte visuell approval. Senare fryst produktdisk 206 filer/10 mappar/backuparchash PASS.
  Acceptans: full inventering/källslutning/rätt åtkomst, inga antagna tomma källor.
- [x] **P2 — Neon-state:** projekt/revision/historik/profil/social/admin/video-
  metadata i gemensam adapter. Additiva 001/002, checksum-/strukturkontroll,
  serverägd scope/CAS/audit/transaktionsrollback/snapshotimport, inget fröprojekt.
  Exakt dealer/tier/idle/clip-validering och komplett scopebunden medialista.
  Render/Studio läser samma policy med båda källrevisionerna bevarade.
  Acceptans: isolerad samtidig sparning/rollback/restart och faktisk P7-paritet
  för 32 konto-/speltabeller, tre dokument och 18 aktiva+sex retainedposter.
- [x] **P3 — Blob/jobbstate:** nya färdiga paket i samma privata Blob;
  request/idempotens/fenced lease/submit/cancel/terminal/kostnadsledger i Neon.
  Aktiva fullfil/stream/sessioncallers använder journal; endast städad OS-temp.
  004:s explicita monetära fullfilsreservation före TTS/GPU delar UTC-dygnssumma
  med stream. Saknad policy/belopp/auth/journal nekas före provider.
  Production/version 1 fullfilspolicy adopterad med ett additivt INSERT, inte seed.
  Atomisk fryst import bevarar opaka requests, budget/dygn/reservationer och
  003:s kampanj/grind/försök; historiska actors fabriceras inte, saknad grind OFF.
  Exakt replay duplicerar inget, ändrad lease/förbrukning blockerar import;
  sista receipt-fel rullar tillbaka alla kostnads-/operatörsrader.
  Acceptans: hash/HEAD/Range, restart/parallellitet/osäker POST/UTC-midnatt/retry/
  avbrott utan dubbeljobb/refund samt verklig journalimport/elva kostnadstabellers paritet.
- [x] **P4 — en Studio:** native administration utan iframe, gemensam navigation,
  roller/livscykel/adresser och annonserade actions. Utkast/CAS bevaras.
  Konto/partnerformulär har verkliga handlers; hemliga engångsresultat är tillfälliga.
  Passwordbyte för faktisk playercredential kräver två lika lösenord/anledning;
  CRAIG följer invitation/reset. Röstreview binder exakt talpar/index/kalibrering/
  revision/roll. Fyra lokala mailpreviewer och SQL-projicerad skostatus finns,
  men inga hålkort/kortordningar/spelaruppgifter. Korrupt JSON nekas;
  högst 500 tabeller visas med explicit delresultat.
  Gamla direkta betalda voicepreviews stoppas före disk/provider i gemensamt läge.
  Acceptans: rätt login/callback/launch/roller, nekad anonym/spelare, bevarade utkast
  och serverkvittad revision — inte bara kontosida eller frontendknappar.
  Elva menysektioner innebär inte att dolda API/data får raderas.
- [x] **P5 — API på Vercel:** Studio/admin/auth mot Neon med live identitet/
  signatur/epoch/Host/Origin/body/gates. Render behåller spelkommandon/wallet/cancel.
  Native login/reset under /studio, hashade atomiska engångstokens och gamla
  länkar högst en gång. Logout/password/roll återkallar session/handoff.
  Fördröjd signerad body kontrolleras efter auth/lås/SQL före mutation;
  nonce ger ingen dubbelkreditering. Mail annonseras bara med faktisk sender/key.
  Produktion native/Neon aktiv; gamla bo.json-writers avvecklade.
  Acceptans: sparning→spelets samma revision, diskfri start, auth/revoke/Render-
  kommandon och faktisk routing/paritet/restart. Oförändrade godkända QA-prov
  återanvänds med riktade städprov, inte påstådda nya produktionskontomutationer.
  Produktens fulla invitation/reset-mailacceptans är separat öppet.
- [ ] **P6 — helhets-QA:** isolerad backend/DB/hostname, ett koordinerat serverpar.
  Fyra dealers/två faktiska plays med revision/kvitton, auth/revoke, privata media,
  Director/SDK/roller/bild/STT/chatt och båda GPU-vägar, cancel/terminal/drain/restart.
  Fysisk mic/kamera/mobil/Safari och mänsklig synk/take redovisas separat.
  Fixtures först; betalda liveprov kräver färsk avgränsad auktoritet.
  - [x] Native90/90 på 190399: fyra dealers/två avkodade/hörbara/endedplays,
    samma Neonrevision, CAS/utkast/privata medier, ingen iframe. Cleanup/paritet PASS.
    SHA/immutable receipt finns i handoffen; layoutframes är inte läppsynk.
  - [x] Shared auth på e461ef07: HTTP 80/80 över 68 anrop, riktiga login 22/22,
    städ 27 grupper; admin/spelarnekande/game-only-reset/revoke/saldohistorik PASS.
    Pending verkligt provider-cancel är inte verifierat i authprovet.
  - [x] Greeting-rehearsal på e461 för alla fyra: matching clip/tvåspelskontroller
    återaktiverade utan synligt fel. Explicit ended/hash/ny visuell approval saknas.
  - [x] Isolerad SQL/HTTPS/restart 41 grupper+retained 4, 46 oförändrade källhashar PASS:
    CAS/rollback/token/epoch/auth/nonce/costimport/QA-rollbacks/review/kortsekretess.
    Eget kluster/process/certifikat städade; inga driftkonto/mejl/betalda anrop.
  - [x] Avgränsad funktionell AI→tal→GPU→spel-END för P7 verifierad:
    fullfilens två härledda game-queue/audio-ended, faktisk cc77-stream-END/
    completed SQL-request/synlig+hört/cleanup och oförändrade godkända e461-bytes.
    Provider avlästes CANCELLED efter END; övergångstid/naturligt COMPLETED saknas.
    Inte full P6, två nya genererade streamplays eller nya takeapprovals.
  - [ ] Färsk full P6-installation/käll-/manifest-/SDK/envbindning och två-ACK-
    helhetsacceptans enligt nästa avsnitt; delbevis har egna SHAs.
  - [ ] Rätta den äldre SQL/HTTPS-fixturen efter aktuell authpolicy och kör om.
    Färskt försök på bc0f gav503 vid login; `gameDb` saknas och readeråtkomst är
    ett pensionerat förväntat beteende. Det tidigare SQL-kvittot är historiskt.
    Privat `p6-check-20261005.json` bevarar FAIL; separat shutdown/mail14PASS.
  - [ ] Koppla det verkligt utförda SQL-resultatet till befintligt CI-/kartbevis.
    Den frysta bc0f-exportens19gröna/4grå läser inte senare privata körningar automatiskt.
  - [ ] Ny mänsklig läppsynk/kortkontakt, fysisk mic/kamera/mobil/Safari,
    full invitation/reset i produktion och övriga medie-/zon-/latensluckor.
  - [ ] Färsk incidenttriage: sex TRIGGERED och tre locationluckor, inte clear.
- [x] **P7 — samordnad aktivering:** uttrycklig beställning och verifierad snäv
  admission, frysta skrivare/aktuell export/ALL0, additiv import, faktisk paritet
  och samordnat policy/alias/providerbyte. Utfört på b0bc:
  32 konto-/speltabeller, elva kostnadstabeller, tre dokument och 18 aktiva+sex
  retainedposter PASS. Samtliga 17 alias verifierade; gamla mål/SSO/domäner kvar.
  Max 0/Active 0/FlashBoot OFF gav ALL0 före import; ursprungliga Max 1/Active 0/
  FlashBoot ON återställdes före produktens tal/stream ON.
  Production/version 1-adoption ett INSERT, historik/reservationer oförändrade.
  Acceptans: färska tidsbundna bevis även efter await, fyra SQL-checksummor,
  fullhash 18 klipp före skrivning, sex retainedparitet/replay 0, runtimeparitet/
  HTTPS/routing/policy/restart. Förbrukad journal/import körs inte om.
  Femminuterskvittot löpte ut under aliasåtergången; originaltider består,
  kontinuerlig TTL-acceptans påstås inte. Färsk konto/kostnad/adoption lästes
  före provideraktivering. QA OFF/full P6/mail/okänd USD är uttryckliga undantag.
- [x] **P8 — faktisk avveckling:** ersatta UI/iframe/BOskrivare/disk/env borta
  efter aktiv ersättning/paritets-/referens-/restartprov, inte permanent fallback.
  Slutkod 9ba2fd05: produktdisk DELETE204/GET404/service.disk saknas;
  gamla Bloblista 0/ersättningar 12, noll gamla Neon-/historikreferenser.
  Explicit restart200: ny process/160 källhashar/åtta avvecklade runtimefiler,
  AI3/Neon ON/health200, ingen /var/data/persistent produktmount, TLS verify-full kvar.
  Full backup 206 filer/10 mappar/125 745 905 källbyte bevarad.
  QA-disk/SDK/journal/reservationer och Director/Gatewaydiskar består, QA AI OFF.
  Acceptans: faktisk resursläsning+diskfri kallstart/omstart och inga kvarvarande
  produktläsare. Ren Gitdiff bevisar inte borttagen molnresurs.
  Inget generellt mandat att radera tools/fixtures/pipeline/media/OpenClaw.
- [x] **P9 — slutleverans:** fem docs/guide/envregister/en handoff uppdaterade;
  taskägda mainleveranser/CI/drift-SHA bundna. P7/P8-kvitton finns privat och
  residualer är öppna. Senast 6ced437e CI 3 PASS/LIVE/READY; tidigare appbytes mot ebbbeb
  oförändrade; inga nya mänskliga approvals/providerjobb.
  Rootdokumentkomprimeringen ändrar läsbarhet, inte acceptansstatus.

Vid motsvarande framtida migration: P1 först, P2/P3/P4 parallellt på överlämnade
kontrakt/filer, P5/integration därefter, P6→P7→P8→P9 samordnat.
Historiskt P7-undantag är inte generell framtida full P6-approval.

### P6: kostnadsundantag och acceptansgränser

Jakob beställde AI/GPU/produktion/avveckling med QA kvar och tillät egna worker-
brancher/worktrees för uppdraget. Bara MERGE integrerar main.
Exakta Cartesia/counting-priser är backlog, inte ny blockerande förstudie:
funktionstester får dokumenterad okänd USD/null och mätt usage inom befintlig
numerisk budget/reservation/dispatchauktoritet. Ingen nolltariff/faktura,
automatisk förlängning/refund/journalreset eller generell kostnadsapproval.

Originalkampanj f2c28b62-9ae7-4cd6-abcd-e2137f2206d6, totaltak 10 USD inklusive
alla försök, ankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historisk reservation 5,251152/oreserverat 4,748848 USD; ingen nollställning.
Jakob höjde tvåtaket till sex genereringar totalt. Closed39:
usage 4 gen/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null; två generationer var kvar,
inte färsk dispatchauktoritet. Head
`8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Den gamla policyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Generationstak är inte monetärt utrymme; förbrukat/pending/uncertain återanvänds inte.
Originalets tio SDK-dispatchexempel är historiska; läs aktuell usage före nytt prov.

Fullfilsbelopp reserveras före TTS/GPU; stream/fullfil delar UTC-dygnstak.
Originalets tolvminutersfönster kräver åtta minuter kvar; klientdeadline 300 s och
RunPod-TTL 180 s förlängs inte tyst. Utgången auktoritet återöppnas aldrig.
Successor append-only binder föregående journalhash; ingen retry/dubbeljobb.
Nytt prov kräver färska Gitblobs/immutable image/worker-router-entrymanifest,
SDK 7.12.1 och faktisk processreadback, separata Render/Web-child/SDK-envbindningar.
Prepare-only/router404/SDKimport/deterministisk baseline/WSbinary är inte acceptans.

Bind Director/SDK/Cartesia/RunPod, sparad Neonpolicy, serverägd session/runda,
request/jobID och mediahashar till samma körning. Tre cookieägda kontroller före
connect/play/efter END. Redan utfärdad descriptor går genom posegrind/talkö/
`playGeneratedSpeech` i samma produktspelare/WS/video.
`decoded-product-game-queue` behöver faktisk integration/laddad källa,
presenterade avkodade frames/hörbart ljud och två verkliga ended/playbackACK.
Wrappermount utan spelkö, extra WS/video, greeting och framehash räcker inte.
Retry/restart/cancel/terminal/drain/journal före-efter och SQL/HTTPS/restart
krävs också. fullP6Passed förblir false tills hela kontraktet uppfylls.

Prisbacklogens befintliga underlag:
`lab/data/platform-private/p6-cost-evidence-20261004.json`.
Cartesia-nyckelägarens credit/overage/plan, counting-tariff/uttryckligt gratisbevis,
RunPods hela startup/execution/idle/stopp/lagringstak saknas.
Jakob saknar externa Cartesia-kontots inloggning; begär inte nya loginförsök.
Historisk RunPod-UI: endpoint zsudl8tmzcmiv1, RTX 4090 ×1, 1,10 USD/h, max 1/active 0,
idle 5 s/execution 600 s/20 GB disk/ingen networkvolume/FlashBoot Standard ON.
UI-ms mot docs sekundavrundning och kallstart/rabatt/lagring är inte fulltariff;
600 s execution eller TTL404 bevisar inte workerstopp. Daterat underlag,
inte aktuell prisgaranti eller skäl till ny providerinventering.
Historiska primärkällor: [Cartesia](https://www.cartesia.ai/pricing),
[OpenAI tokenräkning](https://developers.openai.com/api/docs/guides/token-counting),
[RunPod debitering](https://docs.runpod.io/serverless/pricing).

Fysisk mic/kamera kräver samtycke/browserpermission och startar OFF på sidöppning;
bilder kräver Luna/Terra. Manuell engångsmic finns utan lokal wakeword.
Produktkameran ON/configGET/ett syntetiskt STT-prov är inte fysisk acceptans.
Ändrad text/audio/video/revision invalidaterar mänsklig approval; baseline/test/
waveform/stillbild/mun-onset bevisar inte synk/kortkontakt.
Fyra dealers delar spelare, två rehearsalplays krävs vid media/spelarändring.
Gamla tysta BO-videor är inte aktivt lipsyncmaterial. Granskad svarskatalog
och automatisk global spelararkivering är inte infört. Katalogens framtida återbruk
kräver godkänt exemplar/exakt paketrevision/ägare/aktuell kontext; namn/klockslag/
rundor/saldo får inte globalåterbrukas. Gallring nollställer inte kostnadsjournaler.

### Avvecklad källa och ansvar som består

| Avvecklad ersatt del | Aktivt ansvar som bevaras |
| --- | --- |
| Adminiframe/BackofficePanel/CSS, legacyadministration, gamla BO-HTML | Nativegrupper/behörigheter, auth/mail/media/operatorhandlers och sparad data |
| boLoad/boSave/bo.json och ersatta konto/partner/adminskrivare | /api/bo/config Neonprojektion; Render spelkommando/wallet/handoff/cancellation |
| Produktens diskprojekt/social/historik/profil/videoindexskrivare | NeonCAS/revision/audit; StudioPage/Studio har tree/activity/events/guide/probe/videos |
| Gamla beständiga generations/speech/voicecachegrenar | Privat Blobpaket/Neonrequest/cost/GPU/operatorjournaler, aktiva klipp/index/kalibrering |
| Legacy produktdisk/envgrenar, CROOT/LAB_VIDEO_ARCHIVE | BO_URL/origins/auth/ingress, Neon/Blob/provider/streamnycklar, QA/Director/Gatewaydisk |

Historiska disk-envmål LAB_STUDIO_DATA_DIR/CROUPIER_PRESENTATION_STUDIO_DIR/
CROUPIER_GENERATIONS_DIR/CROUPIER_GENERATED_SPEECH_DIR avvecklades först efter
ersatta child-config/läsare/skrivare. QA:s 37 envvärden/disk/SDK/journal består OFF.
Dolda pitboss/turnerings-API är inte nya raderingsmål.
Aktiva GPUworker-testmappar, rotens sex testfixtures, tools/web/pipeline/open-claw/
medier/konton/kostnadsjournaler består. De föreslagna services/test/test/ttols/
test/web-vägarna fanns inte. Disponibel byggcache är inte Labtestruntime.

### Import, rollback och backups

P7:s frysta underlag/paritet och P8:s faktiska borttagningar finns i handoffen.
Käll/SQL/manifest/index binds till exakt main; gamla 132-filersplaner/source-artifacts
är historik, inte återanvändbara råhashar efter ändring.
Fyra SQL-checksummor/elva kostnadstabeller/18 aktiva+sex retainedposter/
32 konto-/speltabeller bevaras. Avslutad import återkontrolleras läsande,
inte med nyimport/ändrade kvittotider. Receiptfel ger transaktionsrollback;
ändrad lease/förbrukning blockerar merge/reset. Rättat transportformat fick
separata fortsättningskvitton, inte fabricerad kontinuerlig TTL.

Full extern backup:
`C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`.
206 filer/10 mappar/125 745 905 källbyte; inventering/metadata/arkivläsbarhet/
remote-lokal-arkivhash PASS. Receipt
`12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
Importreceipt
`0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d`.
Admission/plan/BEFORE/runtime/postdelete står i JOHN och snapshoten.
Gamebackup `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`:
24 källtabeller/102 rader, 32 Postgrestabellers rad-/sekvensparitet.
Lissabon/syskonstädning/privat OpenClawdevice-backup står i handoffen.

Återgång kräver stoppade/frysta skrivare, separat kopia av senaste Neon/ledger,
rätt scope/schema/media, aktuell paritet och samordnad rollbackpunkt.
Äldre SQLite/disk aktiveras aldrig blindt efter nya Postgresskrivningar.
Produktbackupen är historisk, inte fallback; aldrig två aktiva writers.
tools/backup-render-state.mjs produktprofil är historisk diskbackup, inte den
nya Neon/Blob-metoden. --quiesced är operatörsförsäkran, inte mätt writerdrain.
QA/Director/Gateway har separat backupansvar; aktiv disk/state består.
[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) beskriver procedurerna.

QA:s äldre player_probe_sessions-gap 17→15 och 19→18 består. 24h TTL är möjlig
men inte radvis verifierad utan gamla seen-metadata. Övriga 31 kontotabeller matchar;
original FALSE/compose=false ändras inte. Senare 10/10-bevarandekvitton ersätter
inte äldre luckor. Parent-envs direkta EACCES efter UID-byte är ett redovisat gap,
med barnprocess/källa/stabil deploy/envbindning i stället.

## Ytor och datalagring — produktion och nya QA

| Ansvar | Aktiv källa / gräns |
| --- | --- |
| Publik webb/spel | Vercel apps/croupier-frontend, /blackjack; Studio lab under /studio |
| Konton/wallet/rundor | Neon croupier_game/croupier_auth; Render äger spelauktoritet |
| Zoner | separat croupier_zones/CROUPIER_ZONES_DATABASE_URL, ingen DBfallback |
| Studio/adminpolicy/historik/mediaregister | Neon croupier_studio med scope/CAS/history/audit; Render samma policy |
| Mediefiler/färdiga talpaket | gemensam privat Blob; exakt ägarmetadata/hash i Neon |
| LiveAI/GPU/stream | Render/Director/Gateway/RunPod, Neonjournal/lease/reservation |
| Isolerad nativeQA | separat DB/scope/hostname, befintlig disk/SDK/kvitton, AI/GPU OFF |
| Lokal utveckling | ett koordinerat par, sessionsvakt/lab/data; privata utkast/cache |

### Blob är ett gemensamt filarkiv, inte två tjänster

`store_AqwvebTbBHarOjvG`/`croupier-media-private` är privat Stockholm.
croupier/media/dealers/{astrid,vera,amira,mei}/{runtime,source,review,staging}
samt game/site är filgrupper, inte tjänster. runtime är usage, inte visuell approval.
Layout/blobindex binder ID/path/URL/hash/storlek/proveniens/kalibrering.
Gamla astrid-roten/tolv croupier/videos-adresser är avvecklade efter exakt
migrering; ersättningar består. source/staging kan fortfarande ha aktiva beroenden.

5 oktobers rensning: 2 410 lokalfiler/2 133 120 568 byte,
2 313 Blobobjekt/2 131 771 483 byte. Dedup: 64 lokalkopior/14 216 404 byte,
58 Blobobjekt/12 787 392 byte. Alla 2 514 logiska ID/hash/URL-gränser består
via exakt canonicalPath. Kvar 2 450 fysiska/764 115 959 byte;
Blob 1 800 objekt/769 901 848 byte. 62 huvudobjekt HEAD/fullSHA och 88
prod/QA-GET/fullhash/storlek PASS. Kompletta efterlistor och privata
`lab/data/lane-media-audit/`-receipts/plan/hashar bevaras.
Ingen generell medieradering eller ny mänsklig synkapproval följer av dedup.

### Vad ligger kvar på Render-diskarna?

| Tjänst | ID / disk | Ansvar |
| --- | --- | --- |
| croupier-v2 | srv-datg3j6gekts73amgli0; gamla 5 GB-disk borta | Diskfri Neon/Blob, backup kvar |
| croupier-vercel-preview-qa | srv-datj7l893c1s73ar3u50; /var/data, 1 GB | Separat QA/SDK/data/journal/cache |
| croupier-lab-director | /data/catalog, 1 GB | Katalog/historik/CompanionDB |
| croupier-lab-openclaw | /data/openclaw, 1 GB | Konfiguration/agentfiler/sessioner/sökDB |

Studio-projekt betyder sparade presentationsinställningar/revisioner i Neon,
inte en app eller spelarkontosamling. Vercel-projekt betyder webbpublicering.
Produktens diskfria restart/hash/paritet är verifierade; QA/Director/Gateway behålls.
spelsajt-game-server tillhör Jakeminator123/spelsajt och openclaw-sajtagenten tillhör
Jakeminator123/sajtmaskin; de är inte Croupiers avvecklingsmål.
Karta/envregister anger tjänstebindning/nyckelnamn, aldrig hemliga värden.

### Varför fem Croupier-projekt i Vercel? — avläst 5 oktober

| Projekt | Roll |
| --- | --- |
| croupier-frontend | Gitkopplat samma main; hemsida/spel från apps/croupier-frontend |
| croupier-lab-ui | Gitkopplat samma main; labbygge för /studio på samma publika sajt |
| croupier-native-qa-abc92154cb15 | Befintlig isolerad testfrontend |
| croupier-native-studio-qa-abc92154cb15 | Tillhörande isolerad Studio |
| croupier-player-preview-qa | Äldre testfront med Blob/Neonintegrationer; kandidat efter ägar-/konsumentkontroll |

Ett repo/en sajt finns genom två produktionsbyggen, inte fem produktrepon.
NativeQA byggs manuellt/API från samma explicita reposSHA; ConnectGitRepository
betyder saknad automatisk Gitkoppling.
Äldre player-preview är READY på 22dca5c4/dpl_6ksHgAKr7NoW5NEAuP4xVcJucAok;
proxyrot apps/croupier-frontend, session-GET 421 och /studio 500 i avläsningen.
Den är inte fungerande alternativfront, men Blob/Neonägarskap får inte blindraderas.
Produktionen kräver inte QA-fronter; deras data/delade media ska ändå skyddas.
QA behålls/AI-GPU OFF. Ett enda produktbygge är separat arkitekturarbete.

Frontendpreview kan peka mot produktion; syntetiska konton/rundor kräver isolerad
backend/annan hostname. presentation=local gäller också i molnet.
Speluppspelning/Studioobservation/PartnerSSE/genererat tal är olika kvittoflöden;
Studio startar inte andra uppspelningar. Originalpolicy legacyClipPolicy och
Astrid mediaPolicy/idlePolicy sparas i samma projekt; gamla BO-val read-only 410/
explicit exakt import. Privat Blob går via servern; frontend får inga hemligheter.
Vercelkoppling kopierar inte nycklar till Render.

## Nyckelansvar, säkerhet och kvarvarande luckor

Serverkonfiguration äger hemligheterna: Studio DB/Blob/auth/OpenClawadmin,
Render spel/signering/provider/stream, Director/Gateway egen state/pairing.
QA saknar Cartesia-/RunPodnycklar. Vercelkeys är inte automatiskt Renderkeys.
OPENCLAWAPI_KEY/OPENCLAW_STUDIO_ADMIN_DEVICE_KEY är adminservervägen,
inte runtime-token eller publik credential. Jakobs egna lokala Cartesiakey
ligger ignorerad i `.env`/`lab/.env.local` med förebackup; driftkey är inte därmed bytt.
Bevara privata anslutnings-/utvecklarprofiler och hemligheter utanför Git.

Färsk GitGuardianläsning via befintlig MCP: workspace 795524/source 30689542/
Jakeminator123/github-work bundna. Lista: 1 incidentsida/11 locationsidor,
5 IGNORED/6 TRIGGERED; locationCoverage partial för 37828691/37830671/37862641.
Öppna ID 37862641/37863164/37863165/37863166/37867511/37867512.
6316x har container-entry-fixturepositioner; 67511/67512 contracts.json-hashfält.
Inte verifierade falsklarm: scanner-match/secrets har inte lästs,
37862641 saknar filmetadata. Ingen resolve/ignore/accessändring utförd.
Safe kvitto `lab/data/platform-private/gitguardian-read-20261005.json`.
GitHubGG queued/no runs på 6b9 består; grön CI/neutral/skipped är inte incidentfrihet.
De tre locationsluckorna är HTTP200/tom lista/ingen nästa sida även vid direktläsning.
Historiska 5 IGNORED/0 OPEN är daterad triage, inte dagens status.
Följ AGENTS metadataredaktion/avsedd workspace, inga nya scopes automatiskt.

Öppna restpunkter: full P6/ny take/läppsynk/kortkontakt, fysisk mic/kamera/
mobil/Safari, ursprunget till ”Film ended without a presented frame”, kvarvarande menyfördröjning,
full zonlagringsacceptans/startsidesflimmer/extern Director/Gatewaybackup och
produktionsmail/invitation/reset. Auth/session-GET200 observerades 1,3–6,45 s,
static mest 0–15 ms; ingen totalmätning eller isolerad rotorsak/freeplan-/providerförklaring.
Två begränsade rättningar ingår: oanvända BO-anrop tas bort utan ändrat authskydd,
och gammal idle-feltext rensas först vid aktuell faktiskt visad bild. Rotorsaken till
den historiska frame-varningen och authlatensen är fortfarande okänd.
QA Resend Free/delivered→Skräppost/testkontocleanup är avgränsat historiskt,
inte användbar invitation/reset i produktion; nya mejl/konton följer inte automatiskt.
Färsk läsning visar tom produktions-`RESEND_API_KEY` och saknad
`CROUPIER_STUDIO_MAIL_FROM`; befintlig QA-nyckel gav401 på Resends domänläsning.
Giltig produktionsanslutning/avsändare behöver därför fastställas före konfigurering
och ett uttryckligt beställt invite-/resetprov. Inga hemligheter kopieras på chans.
GPUshutdown/privat zonbild/OpenClawnavigation är rättade och verifierade avgränsat,
inte kvarstående obehandlade funktionsfel; detaljer/shutdownbudget i JOHN.

## Lokal start och sökning

Starta bara när begärt: `node lab/start.mjs --offline --no-open` är isolerad
preview; `Start-Lab.cmd` följer sparad ansluten profil.
Ett serverpar/sessionsvakt, bevarade utkast/spel och återanvända browserflikar.
Efter Neoncutover kan offlineStudio ge 503 studio_read_storage_unavailable,
ingen auth/lagringsfallback till QA. Lokal guestpolicy består enligt AGENTS.
Byggcache rensas bara utan berörda sessioner/processer; behåll Labtestruntime.

.ignore/Cursorignore begränsar sök/context/index, inte Git/build/filernas existens.
Sök riktat källtext/JSON; binärer/cache/dependencies/private state undantas.
Personarkivets gräns kringgås inte med no-ignore/Githistorik/backups.
Tools används delvis i runtime; test/pipeline/media är inte generella raderingsmål.

## Leverans och kontroll

Filclaims via absoluta agent-talk, status mellan steg och .git-claim vid commit.
Före integration/push: `node tools/croupier-chef.mjs status`, ingen autoroll.
MERGE äger slutgranskning/integration/uppdatering. Workers gör inga Gitmutationer/
build/server/media/env/providerändringar i detta tvåfilspaket.
Leverans: `node tools/push-github-work.mjs --check`, sedan helpern utan --check.
Verifiera repo/main/fast-forward/remoteSHA, aldrig forcepush/annan destination.
Hooks ny checkout: core.hooksPath=.githooks. GPUimage är separat release.

Rena docs/indexignorecommits kan ha snabba env/GitHubpolicy/hooktester;
kod/config/test/media fullregression, CI alltid full.
Fullmanuell: `sh .githooks/pre-commit --full`.
Plan: `node tools/precommit-checks.mjs --plan`.
Media/spelarändring kräver audit--probe, fyra dealers/två rehearsalplays och
ny visuell approval för ändrad audio/video/hash. Här ändras inga sådana bytes.
Efter push återläs SHA/CI/Vercel/Render/GG; testpass/hash är inte synk/mobil/backup.

Systemkarta 91: 23 kontrakt/19 gröna/4 grå/0 röda-gula/errors/warnings.
HTML: C:/Users/jakem/Downloads/Croupier-systemkarta-91d0c4d9.html.
Grått är saknat game-event/zonreporterkvitto eller verkliga PostgresSKIP,
inte produktionsparitet. Passiv CIreporter/30 dagars artifacts/källrefbindning
gör inga provider-/DBprov eller branchprotectionändringar.
Privat ci-91d0c4d9-system-map-{status,evidence}.json i lab/data/platform-private.
FilURL-browserprov blockerades av policy; syntetiska prov är separat bevis.

## Kort historisk tidslinje

2 oktober, 22dca5c4: Neon game/auth/Blob/transport. 3 oktober, 190399: native90/90.
e461ef07: shared auth/SDK. 4 oktober, 5fca→cc77→b0bc: fullfilsdelprov,
faktisk stream-END/okänd USD och samordnad P7-admission.
b0bc→9ba2fd05: import/policy/alias/providerbyte/backup/fysisk P8.
3da83bf8/5270c8ab: route/kameraconfig/shutdown/zon/OpenClawrättningar.
5 oktober, 8f265831/ee060804/ebbbeb76: lanes/source-staging/dedup/noopsave/UI/karta.
91d0c4d9: dokumentstädning/slutkvitton, CI 3 PASS/LIVE/READY, appbytes oförändrade.
Gamla deploymentpinnar/FAIL-föregångare/kostnads-/cleanupkvitton finns i snapshoten.
Historik är provenance, inte order eller färsk admission.
