# Croupier: aktuell källa, drift och leverans

Arbeta i `C:\Users\jakem\Projects\croupier`, på `main` i det privata
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work).
`main` är enda lokala/GitHub-branch och standardbranch sedan 2 oktober 2026.
Vercels produktionsbranch och fyra befintliga Render-kopplingar är `main`.
Produktens Render-autodeploy är `checksPass`; övriga tre är fortsatt `off`.
GitLab-inbox, wiki och spegelpush är pausade; återskapa inte gammal inbox.
`Jakobs-v1` bevarar commit `600093e4522efc57bd82979cff65492a528ffeb7`.
Ignorerade privata data ingår inte i Git-taggen.

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
Procent i chatten är en grov bedömning av **den nya Studio-sammanslagningen**,
inte filantal eller den tidigare frontendflytten. Startläge efter kontraktsgrunden:
cirka 10 %. Efter kontrakt, isolerade oaktiverade lagringsutkast och den
publicerade UI-förenklingen 3 oktober: cirka 30 %. Efter levererbar Neon-/journalgrund
och native BO-UI/API bakom avstängd aktivering: cirka 40 %.
Gemensam policy, konto-/partner-/authfunktioner, isolerad SQL/HTTPS/restart och
aktuell `190399`-molnacceptans ger grovt **80 % klart / 20 % kvar**.
Riktig produktionsimport, full P6-helhetsacceptans och P7/P8-avveckling återstår.
Övertagandets aktuella startpunkt, faktiska åtkomstgap och stoppad QA-invitation
står överst i `JOHN-HANDOFF.md`. 80 % är ingen acceptansgrind; alla öppna
P6/P7/P8-villkor gäller fortsatt, även efter Resends delivered-kvittens.
Viktning: kontrakt/åtkomst
10, beständig Studio-state 20, enkel native
UI/auth 20, API-/spelintegration 20, säkra jobbjournaler 10, QA 10, avveckling/docs 10.
Ingen 100 %-rapport före verifierad integration och faktisk avveckling.

- [x] **P0 — målbild:** en Studio, en privat Blob, Neon för beständig struktur,
  Render/OpenClaw/RunPod behålls för sina aktiva ansvar; obligatorisk slutstädning.
- [ ] **P1 — kontrakt och inventering:** lås API/datakontrakt, käll-/mål-/ägarmapp
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
  - [ ] Full molndiskinventering och återstående lagrings-/journal-/transportkontrakt
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
    produktionsimport är genomförd; detta är inte visuell approval.
    P1 är därför inte helt klart.
- [ ] **P2 — Neon-state:** projekt/revision/historik/profiler, videoregister/
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
  - [ ] Verifierad aktuell import och aktiv gemensam källa för Studio/Render.
  - Pågående nästa integrationssteg: `studio-game-policy` läser projekt och
    administration i en gemensam repeatable-read-transaktion, returnerar en
    oföränderlig scopebunden spelrevision och bevarar båda källrevisionerna.
    Studio-/Render-adaptrar sparar med CAS/historik/audit. Exakt tier/idle-
    validering nekar fel dealer, närliggande klippnyckel och saknat aktivt media.
    12 riktade policyprov och 17 repositoryprov PASS, inklusive samtidiga
    sparningar, blandad revisionsrace, rollback och scopegränser. `listMedia`
    läser endast avsedd Neon-scope och nekar ofullständig lista. Detta är
    fixturbevis kompletterade av P6:s SQL/restartprov; aktuell produktionsimport
    och produktionsacceptans är fortfarande öppna.
- [ ] **P3 — Blob och jobbstate:** beständiga generationer/talpaket ligger i
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
  - [ ] Fullfilernas monetära reservation före TTS/GPU: det tidigare request-
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
    förbrukad produktionsjournal; separat verifierad adoption krävs.
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
  - [ ] Aktuell komplett drift-export, journalimport och paritetsprov före
    flaggbyte. Render-API, Neon och SSH till produkttjänsten nås. Datorns
    befintliga publika SSH-nyckel är registrerad efter uttryckligt godkännande;
    ingen privat nyckel överfördes. Den privata 129-filers exporten är ännu
    ofryst och är inte ett godkänt importunderlag. PostgreSQL-underhållsläget
    `studio-export` är implementerat men inte aktiverat: policy/tal/streaming
    explicit av, inga Web-/Lab-barn eller DB-anslutningar, endast health och
    övriga routes 503. Privata SSH-bytes och verifierad extern GPU-dränering
    krävs fortfarande. Full fryst export, exakta
    spelmediereferenser och paritet återstår; ingen schema-/journalimport i drift.
- [ ] **P4 — en Studio:** native administration ersätter iframe; navigation,
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
    Befintlig backend/iframe består. Detta är inte P4/P5-klart.
  - [x] Native administrationskomponent skriven: sex lokala grupper, rollstyrda
    formulär, serverannonserade aktiva actions, strängrevision/CAS och bevarade
    formulärutkast. Inga iframe- eller parallella gamla menyer inuti komponenten.
    Konto-/partnerformulären omfattar nu invite/resend och create/rotate/revoke/
    launch/demo-credit. Engångsnycklar visas endast i en separat tillfällig
    resultatvy och tas bort vid omladdning, gruppbyte, behörighetsändring eller
    logout; partnerlistan behåller bara godkänd metadata. Native login och
    lösenordsval finns på `/studio/login` respektive `/studio/set-password`.
    Drift använder ännu den tidigare ytan. Native exakta röstpar/review/CAS,
    fyra lokala mejlpreviewer och sparade skoregler/räknare är nu implementerade.
    Kortordning, hålkort och spelare lämnar inte sko-API:n; korrupt JSON nekas,
    högst 500 tabeller samplas och delresultat markeras. Direkta gamla betalda
    röstpreviewn stoppas före disk/provider i gemensamt/native läge. 52 kombinerade
    fokuserade BO-/röst-/readout-/UI-prov PASS, utan ny visuell approval.
- [ ] **P5 — API på Vercel:** Studio/admin använder P2/P3 utan beständig lokal
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
  - [ ] Verifiera aktuell inkoppling av native konto-/partner-/authfunktioner och
    spelarstatus inklusive Render-runtime cancellation; medie-review,
    gemensam spelprojektion och diskfri Studio-start. Exakt tier/idle-validering
    och konto-/auth-/Render-kommandogräns är implementerade och verifierade
    i det aktuella isolerade SQL-/HTTPS-/restartprovet.
    Spelkonsumenter läser samma sparade projektrevision; Render behåller kort,
    wallet och runtimeauktoritet. Gamla BO-konfigskrivare måste spärras vid
    Neon-källbyte så att bo.json inte blir en andra writer. Produktdriften har
    ännu inte bytt källa. Båda native-/policyflaggorna förblir av tills aktuell
    import, verkliga handlers och isolerad SQL/HTTPS/restartacceptans verifierats.
- [ ] **P6 — helhets-QA:** isolerad backend/databas/hostname, ett koordinerat
  serverpar. Fyra dealers med två faktiska plays, sparade revisioner/native-kvitton,
  auth/revoke, privata media och strömtransport. OpenClaw-roller, bild/transkriberat
  ljud/chatt samt båda GPU-vägar verifieras utan oavsiktlig ändring. Fixtures först;
  betalda liveprov kräver uttryckligt avgränsad budget/auktorisation. Fysisk kamera/
  mikrofon/mobil/Safari och mänsklig läppsynk redovisas separat om de återstår.
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
    nya rehearsalplays och source-loaded-bevis återstår. Nytt kvitto är ärligt
    `decoded-product-game-queue`, men ingen full liveacceptans hävdas.
    Käll-overlay omfattar även transitiva literal imports; externa/dynamiska
    beroenden och basimage/frontendinstallationen hålls öppna. Officiell SDK
    7.12.1 är privat source-stagad, full återläsning och 4 prov PASS, befintliga
    pins oförändrade; detta är ännu inte faktisk Linux-runtimeinstallation.
  - Prisgap får enligt Jakob stå som backlog: faktisk Cartesia-kontotariff
    (extern nyckel, ingen egen kontoinloggning), counting-tariff/uttryckligt
    gratisbevis och RunPods totala startup/execution/idlekostnadsgräns saknas.
    Token-/tecken-/credit-/GPU-tid kan mätas ändå och redovisas separat från USD.
    Budgetprov kontrollerar konto/tariff/maxförbrukning och beständig admission,
    retry/restart/parallellitet; de verifierar inte produktens spelbeteende.
    Ingen påhittad nolltariff eller förnyad budget. Betalda prov väntar på dessa
    underlag; obetald integration och fixtur-QA fortsätter.
  - Läsande GitGuardian-anslutning verifierad efter Jakobs uttryckliga godkännande:
    årsnyckel med endast `incidents:read,sources:read`, lokalt DPAPI-krypterad
    utanför Git. Två MCP-verktyg är låsta till source `30689542` i workspace
    `795524` och returnerar endast metadata. Full API-lista (en incidentsida,
    fem locationsidor) visar fem TRIGGERED-incidenter; två saknar fil/rad.
    Incidenter är inte ändrade eller klassade som rensade. Se aktuell handoff
    för ID:n, metadata-kvitto och anslutningens användning.
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
- [ ] **P7 — samordnad aktivering:** efter verifierad P2–P6 och ett uttryckligt
  genomförandeuppdrag. Frys aktuella skrivare där det behövs, importera endast
  den aktuella beständiga datan, kontrollera paritet, byt källa en gång och
  verifiera riktig HTTPS-adress, sparning, spel, auth och återstart.
  - Privata importspärrar: kritiska käll-/SQL-/manifest-/indexfiler måste
    matcha exakt levererad main-SHA; aktuell mängd är 132 filer.
    87 importguards/36 paritetskontroller samt 19 fasguards/13 runtimeprov PASS.
    Faserna kräver alla fyra aktuella SQL-checksummor och elva kostnadstabeller.
    Separat nonempty-policyadoption är förberedd och har elva obetalda guards;
    verklig adapter och godkänd deltaacceptans återstår, ingen policy är antagen.
    Alla 18 aktiva videobindningar ska
    fullåterläsas från Blob innan skrivning. Skarpa QA-läsaren har nu
    fullverifierat alla 18 inklusive sex original från tom OS-cache,
    med noll SQL-/provider-skrivningar. Efter import krävs slutlig sex-medie-
    paritet och kostnadsreplay med noll nya rader. 86 obetalda guards PASS;
    sex tidsgränsprov täcker även bevis som går ut under väntade driftanrop.
    Oförändrad originalimport kan återvalideras med ett separat läskvitto,
    full byte-/dokument-/register-/kostnads-/kontoparitet och fem minuters
    giltighet, utan återimport eller omskrivna originaltider.
    Faktisk providerhealth har inga köade/pågående jobb men en idle/ready
    worker; färsk dränering återstår. Keys kan enligt Jakob tillhöra Emil;
    inga kontoövergripande providerinställningar ändras. Verklig Resend-sändare
    och integrationsnyckel är verifierade i enbart egen QA Studio; produktens
    mejlkonfiguration och full invitation/reset-acceptans återstår.
    Ingen produktionsimport eller aktivering är gjord.
- [ ] **P8 — faktisk avveckling:** gamla BO/Lab-UI och ersatta Render-API/skrivare
  borttagna, inga permanenta diskfallbacks. Gamla Blob-alias tas bort efter
  verifierad referensmigrering. Onödiga env och produkt/QA-disk tas bort endast
  när samtliga beständiga beroenden är ersatta; aktiv OpenClaw-disk består.
  Bevis: kod-/referenssökning, levande routing/konfiguration och restart efter
  borttagning, utan persistent produktmount. Neon/Blob-fel ska ge felstängning,
  inte fröprojekt/nollbudget/diskfallback. En ren Git-diff bevisar inte att en
  molnresurs är borta. Äldre 12 `croupier/videos`-alias kräver referensprov i
  både aktuellt uppladdningsregister och historik före borttagning.
  Riktad källkontroll 3 oktober ger följande konkreta ersättningsmapp.
  Dessa mål är fortfarande aktiva i flagga-av-läget och raderas först efter P7
  och respektive referens-/restartprov, inte genom en generell katalogrensning.

  | Del | Ta bort när ersättningen är verifierad | Bevara aktivt ansvar |
  | --- | --- | --- |
  | Admin-iframe/UI | `lab/components/backoffice-panel.tsx`/CSS, legacy-grenen i `lab/app/administration/page.tsx`, iframe-/originhelpers i `backoffice-navigation.mjs`; ersatta `web/public/bo/{index,login,set-password}.html` och BO-UI-callers | `BACKOFFICE_GROUPS/SECTIONS` används av native-UI; gemensamma auth-/mejlkontrakt och kvarvarande media-/operatorcallers får inte tas bort med hela `web/public/bo` |
  | Gamla BO-skrivare | `boLoad/boSave`, defaults och ersatta administrations-/konto-/partnerhandlers i `web/server.mjs`, samt `players/bo.json` efter exakt import | `/api/bo/config` är fortfarande spelkonsumentens Neon-projektion; Render äger spelkommandon, wallet, aktörskontroll, launch/handoff och verklig cancellation |
  | Studio på disk | Diskgrenarna i `lab/lib/studio-server.mjs`, äldre projekt/social-/historik-/profil-/videoindexskrivare när motsvarande sparade Neon-revisioner och privata Blob-bytes är verifierade | `StudioPage`/`Studio` används av tree, activity, events, guide, probe och videos; validering/konflikthantering och den avancerade editorn består |
  | Genererade paket/journaler | Äldre beständiga paket-/cachegrenar under `generations/`, `speech/`, `studio/voice-cache/` efter Blob/Neon-paritet, terminal-/dräneringsbevis och kallstart utan diskfallback | Förbrukade request-/kostnads-/GPU-/operatörskvitton, även originalets nya P6-budgetjournal och kvarhållna reservation; aktiva spelklipp/text/audio/video/index/kalibrering består |
  | Legacy env och produkt/QA-mount | Diskkopplingar `LAB_STUDIO_DATA_DIR`, `CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`, `CROUPIER_GENERATED_SPEECH_DIR` när gamla läsare/skrivare och cloud-fabrikens child-config är ersatta; produkt/QA-mount först efter sista beständiga beroendet | `BO_URL` och aktuella origins används ännu för auth/handoff/ingress; Neon/Blob/provider-/streamnycklar och `/data/catalog`/`/data/openclaw` är aktiva, inte generella raderingsmål |

  Källorna visar inget ytterligare fristående kodmål som säkert kan raderas
  före P7. Disk-/envborttagning kräver faktisk molnåterläsning och restart;
  taskens nuvarande dokumentationsstädning aktiverar eller raderar inget.
  - `services/test`/`services/test/fixtures` finns inte. De faktiska GPU-worker-
    testmapparna och rotens importerade JavaScript-fixtures används aktivt;
    kamerans HTML-fixture har ingen verifierad ersättare. Dessa behålls.
    Alla sex filer i rootens `test/fixtures` är spårade; fem JavaScript-fixtures
    har faktiska BO/auth-/HTTP-/Neon-/taltestimporter. `test/tools`,
    `test/ttols`, `test/web` och motsvarande services/test-vägar saknas;
    `tools`/`web` är separata repo-rootmappar, som i Jakobs bild; rotens `test/`
    är en syskonmapp till `services/`. Dessa och `pipeline/`/`open-claw/`/aktiva
    medier/konton/kostnadsjournaler behålls. Inget verifierat obsolete mål raderas.
- [ ] **P9 — slutleverans:** fem docs uppdaterade, en John-handoff, aktuella
  miljönamn/guide, endast taskägda commits på main, CI och avsedd drift-SHA
  kontrollerade. Kvarvarande mänsklig acceptans/blockerare uttryckligen öppna.
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

### Agentprompter att återanvända

Kopiera relevant block till en agent. Dessa är **genomförandemallar**;
kontraktsgrunden är påbörjad, men P2–P8 är inte levererade eller aktiverade. Varje agent
läser först AGENTS.md och hela masterplanen ovan, arbetar i
`C:\Users\jakem\Projects\croupier` på `main`, använder agent-talk och
reserverar faktiska filer innan ändring. Ingen ny branch/worktree, GitLab,
force-push eller självständig produktionsradering. Checklistans acceptansvillkor,
isolerad QA och repo-/mediaregler gäller. Orchestratorn ensam äger docs, integration och push.
Vid överlapp: stanna för ping/ack; återställ aldrig annans ändringar.

#### Orchestrator — kontrakt, integration och städning

```text
Samordna flytten enligt Masterplan: en Croupier Studio i docs/CLOUD-MIGRATION.md.
Läs AGENTS.md och masterplanen helt i C:\Users\jakem\Projects\croupier på main.
Börja med P1: lås identitet/adresser, revisionsstyrd lagring, media/job-state,
API-ägarskap, migreringsgräns och exakt vad varje ersättare avvecklar. Fördela
exklusiva filer till agenter för Neon, media/journaler och Studio-UI. Shared
auth/server/routing/config-filer ägs av en utsedd integratör, inte flera;
Agent A äger nya DB-migrationer och delade lagringskontrakt efter avstämning.
Läs uppdragets förväntade resultat före implementation; använd GitHub och
denna checklista, inte Jira eller GitLab. Bocka inte av efter bara källanalys/fixtures.
Uppdatera denna checklista, befintliga guide/envdocs och JOHN-HANDOFF löpande.
Kör P2/P3/P4 parallellt efter kontraktet; integrera P5 och därefter P6 sekventiellt.
Ingen produktionsaktivering/radering eller betald provkampanj under planfasen.
Inför P7/P8 redovisa exakta targets, verifierade beroenden och restdata; ta sedan
bort faktiskt ersatt kod/resurser, utan permanent gammal fallback. OpenClaw-
systemstate, aktiva kostnadsjournaler och unika konton/media är inte blindstädning.
Leverera endast taskägda commits via push-github-work efter chef/agent-talk-kontroll.
Slutrapport: avbockat, verkliga tester, faktiskt borttaget och ärligt kvarstående.
```

#### Agent A — Neon och gemensam beständig metadata

```text
Genomför P2 enligt hela masterplanen i docs/CLOUD-MIGRATION.md och AGENTS.md,
i C:\Users\jakem\Projects\croupier på main. Stäm av låst P1 och filägarskap
med orchestratorn innan du ändrar. Planera/implementera gemensam asynkron
lagring för projekt/revision/historik/profiler, videoindex/klassificering och
BO-konfiguration (bo.json innehåller mer än konton). Prioritera dokument/CAS/history/
audit; gammal Studio-slaskmedia ska inte få en import-/backupkampanj. Befintliga game/auth och
zonernas separata anslutning ska bestå. Ändra inte checksumlåst product-v1 SQL;
använd separat versionerad Studio-migration. Bevara CAS, transaktioner, audit,
ID:n och sparad-policy-vs-utkast. Agent B äger media/job/budgetjournaler:
samordna scheman/API, rör inte dess filer utan ping/ack. Testa migration/import/
återläsning, samtidighet/konflikter och restart i isolerad DB. Inga livekonton,
produktionsmigrationsanrop, deploys eller raderingar. Returnera till orchestratorn
exakta API-kontrakt, ändrade filer, testbevis, kvarvarande diskläsare/skrivare
och vilka tidigare metadataimplementationer som nu kan tas bort. Ingen egen push/docs.
```

#### Agent B — privata medier, generationer och GPU-journaler

```text
Genomför P3 enligt hela masterplanen och AGENTS.md i
C:\Users\jakem\Projects\croupier på main; invänta låst P1 och filanspråk.
Använd befintliga privata croupier-media-private, inte ett nytt lager. Flytta
nya beständiga generationer/talpaket till Blob med metadata och
request-idempotens/job recovery/GPU-reservationer/budgetledger i Neon enligt
Agent A:s kontrakt. Migrera inte bortvalt Studio-slask; inventera nödvändiga
journaler och aktiva spelreferenser före diskavveckling. Blob-kopiering ensam
gör inte disken överflödig. Bevara aktiva spelmediers ID, bytes, hash,
talpar/kalibrering, privata HEAD/Range och serverbehörighet. Tillfällig scratch
får vara disponibel, men inget beständigt state får kräva diskfallback.
Testa retries, cancellation, konkurrens, restart och förhindrad dubbeldebitering
med obetalda fixtures/isolerad data. Ingen modell-/GPU-image-/budgetändring,
inga produktionsobjekt eller diskar raderas här. Kör obligatorisk mediaaudit
vid media/playerändring. Redovisa exakta borttagningsmål och referensbevis till
orchestratorn; ingen självständig deploy/push eller docsändring.
```

#### Agent C — en Studio, inloggning och speladresser

```text
Genomför P4 enligt hela masterplanen och AGENTS.md i
C:\Users\jakem\Projects\croupier på main efter P1 och filanspråk. Bygg en
Croupier Studio under /studio: klipp/regler/observation/zoner och native
administration, inte iframe till gammalt BO. Förenkla överlappande menyer och
gruppera befintliga användbara adminfunktioner; gamla klipp-/generationsslaskvyer
behöver inte kopieras. Bara kontosidan räcker däremot inte för hela administrationen.
Använd låsta API-kontrakt och
befintliga roller per sektion; testspelare blir aldrig administratörer.
Konton ska kunna skapas/spärras/tas bort med bevarad ledger/livscykel. Ändra
inte nuvarande lösenord eller auth-storage blindt. Samordna målet /blackjack
som spel och /game som redirect med integratörens launch/callback/returnTo-
allowlists, queryparametrar och login. Länka befintliga OpenClaw-dashboarden;
rör inte dess origin/pairing/roller. Visa sparfel/revisionskonflikter och bevara
utkast. Ingen Next-paket/version-sammanslagning bara för att få en användaryta.
Testa anonym/spelarnekning, reader/staff/admin/superadmin, sessionsrevoke och
nya/gamla adresser. Inga livekontoskrivningar, deploys eller cloud deletion.
Redovisa ersatta UI-filer och tester till orchestratorn, ingen egen docs/push.
```

#### Integratör — Vercel-API, OpenClaw/GPU och helhets-QA

```text
Genomför P5/P6 enligt hela masterplanen och AGENTS.md i
C:\Users\jakem\Projects\croupier på main. Läs först open-claw/lab/docs/README.md.
Invänta Agent A/B/C:s kontrakt/resultat och ta exklusivt ägarskap för shared
server/auth/routing/runtimekonfiguration. Flytta lätta Studio/admin-API till
Vercel mot gemensam Neon/Blob; bevara Render-spelmotorns beslutsansvar och säkra
spelkonfigprojektionen som idag nås via /api/bo/config innan äldre BO tas bort.
Verifiera /blackjack-launch/callback, saved revision till verkligt spelar-kvitto,
OpenClaw-roller/image/transkriberat ljud/chatt, länk till befintlig autentiserad
native-dashboard på Render (Gateway förblir privat),
/speech-stream och GPU-workerens WebSocket till /lipsync-worker. Båda GPU-vägar
(streaming och fullfil) samt reservation/retry/cancel/restart måste bestå.
Isolerad QA-backend/databas/hostname, ett koordinerat serverpar, fyra dealers
två plays, exakt mediaaudit och negativa auth/origin/token/Range-tester.
Fixtures är inte bevis för fysisk mic/kamera/Safari eller mänsklig läppsynk.
Betalda liveprov först efter uttrycklig avgränsad budget; gör ingen självständig
produktionsaktivering/radering. Lämna P7/P8-ready-bevis och kvarstående frågor
till orchestratorn. Ingen egen docs/push eller OpenClaw/GPU-uppgradering.
```

## Ytor och datalagring — nuvarande drift

| Yta/data | Ansvar och plats |
| --- | --- |
| Publik frontend | `apps/croupier-frontend`, Vercel `croupier-frontend`; [scoutgaming.tech](https://www.scoutgaming.tech/) |
| Spelgränssnitt | Vercel [scoutgaming.tech/game](https://www.scoutgaming.tech/game); Render äger slump, kort, shoe, regler, wallet och resultat |
| Backoffice/Lab | Vercel [scoutgaming.tech/studio](https://www.scoutgaming.tech/studio), gemensam navigation för Studio, media, event, zoner, OpenClaw och uppspelning; `/studio/tree` är allmänna editorn |
| Administration | `/studio/administration` återanvänder befintlig `/bo`; samma konton och rollkontroller, ingen separat dealerström |
| Lokal beständig data | `lab/data` för projekt, historik och profiler; `lab/data/players` för konto-/speldatabaser; Lissabon är borttagen med privat backup |
| Spelarkonton/rundor | Separat Neon game-databas, schema `croupier_game` |
| CRAIG/BO-konton | Samma game-databas, separat schema `croupier_auth` |
| Studio-projekt/index | `/var/data/studio`, beständig Render-disk |
| Privata media | Vercel Blob `croupier-media-private`, skyddad serverrutt med hash/familj/Range |
| Zonmetadata | Dedikerad Neon, schema `croupier_zones`; browserkopia är separat |
| Director/Gateway | Egna beständiga diskar, se återställningsguiden |

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
adresser behålls för kompatibilitet med Render-uppladdningsindex/historik;
deras nya runtime-kopior är hashverifierade. Radera inte dessa adresser innan
alla diskreferenser inventerats och migrerats. Historiska QA-kvitton skrivs inte om.

### Vad ligger kvar på Render-diskarna?

**Studio-projekt** betyder sparade presentationsinställningar: val av
dealerklipp, event-/idle-bindningar och regler för när de används. Det är
`studio/project.json` och dess versionshistorik, inte en extra app eller en
samling spelarkonton. "Lab-projekt" syftar här på samma sparade inställningar,
inte ytterligare ett projekt. Lab är arbetsmiljön; Studio är editorn i den.
Ett **Vercel-projekt** är däremot en webbpublicering, ett helt annat begrepp.

| Tjänst | Monterad disk | Kvarvarande ansvar |
| --- | --- | --- |
| Produktion `croupier-v2` | `/var/data`, 5 GB | Studio-projekt, historik, profiler och uppladdnings-/familjeindex; BO-konfiguration; generationer/tal och mediacache; historiska SQLite-filer |
| Isolerad QA `croupier-vercel-preview-qa` | `/var/data`, 1 GB | QA:s separata Studio-/arbetsdata och cache; inte produktionskonton |
| Director `croupier-lab-director` | `/data/catalog`, 1 GB | Katalog, historik och Companion-databas |
| Gateway `croupier-lab-openclaw` | `/data/openclaw`, 1 GB | OpenClaw-konfiguration, agentfiler, sessioner och sökdatabas |

Diskarnas montering/storlek och produktens Blob/Postgres-konfiguration är
kontrollerade live. Innehållstyperna ovan följer sparvägarna och backupkontraktet;
det är inte en fullständig live-fillista. Konton, spelar-ID:n, saldo och rundor
har Neon som aktiv källa. Blob innehåller mediefiler, inte dessa konton.
Render-diskarna behövs därför fortfarande och får inte tömmas. De ersätter
inte en extern verifierad backup; full Studio-/Director-/Gateway-backup återstår.

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
