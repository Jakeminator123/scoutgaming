# Scoutgaming: aktuell källa, drift och leverans

Uppdaterad 6 oktober 2026. Detta är den enda migrationschecklistan.
Äldre checkpoints och avslutade delstegs detaljer finns i
[fryst historik på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md).
Privata kvitton, FAIL-historik, journaler och backups bevaras på sina platser.
Aktuell terminologi och flödeskarta finns i [systembeskrivningen](LOCAL-PRESENTATION-RUNTIME.md).
Senare kodversion uppgraderar inte ett äldre acceptansprov automatiskt.

## Tre åtkomstnivåer på scoutgaming.tech

### Ett gemensamt Vercelprojekt — 6 oktober 2026

Efter uttrycklig samordning har Kevin-chatten släppt alla anspråk. Services i
rotens `vercel.json` samlar webb (`apps/croupier-frontend`) och Studio (`lab`)
i ett bygge/projekt utan att slå ihop deras Next-versioner. Aktiverad
`CROUPIER_VERCEL_UNIFIED_UI` flyttar den befintliga exakta ingressgränsen till
Studio när Services skickar dit dokument/API direkt. Render behåller spel/live,
och T2–T4:s verkliga partnerinloggning, livedata och full operatörsbunden lobby är fortsatt öppna.
Tio riktade routingtester och Lab-typkontroll/produktionsbygge är lokalt gröna.
Repo och aktivt Vercelprojekt heter nu `scoutgaming`. Repo-ID `1380630440` och
tidigare Studio-ID `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD` är bevarade, inklusive
Neon/Blob/Resend. Kod `cef3af5c` är READY på `dpl_J4uTPNKzhaBH1XnNYETX266UfKfV`;
Senaste avslutade dokumentleverans `4ed55a56` är READY på
`dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP`, CI `37451320053` har tre success och fullhook PASS. www, rot, login, spelgenvägar,
API-spärrar och statiska filer är läsande verifierade. Kevin-chatten har
bekräftat sin befintliga adminsession i partnerförhandsvisning/control/Backoffice.
Båda webbdelarna använder `fra1`; Git-autobyggen från main är på igen.
Den gamla GitHub-adressen och gamla frontend-adressen vidarebefordras.
Det domänlösa frontendprojektet sparas som `scoutgaming-legacy-frontend`, med
autobyggen och domäntilldelning avstängda; isolerade QA-projekt/data bevaras.

Jakob har godkänt överföringen av Kevins backoffice och följande indelning.
Det gäller inloggning och åtkomst på samma sajt, inte separata kodplattformar:

| Nivå | Yta | Behörighet i målbilden |
| --- | --- | --- |
| 1 | `/control` | Intern administratör når samtliga nivåer och administrerar organisationer, rollprofiler och personal. |
| 2 | `/partner/{operatorSlug}` | Operatörens personal når egna bord, godkända presentationer, spelare, rapporter och eget delegerbart team. |
| 3 | `/play` | Enkel spellobby med spelval, egen profil och historik. Enkel spelstart finns; operatörskontext, profil och historik återstår. Blackjack nås på `/play/blackjack`. |

Samma identitetsresolver ska användas; URL eller ett menyval ger aldrig en roll.
Interna medarbetare har tilldelade rättigheter, och ett spelarkonto får inte
personalåtkomst. Befintliga `/studio`, `/bo`, `/blackjack` och giltiga
direktstarter ska fungera under övergången.

- [x] **T1. Överförd och uppdelad intern förhandsvisning.** Redigerbar källa från
  GitLab `codex/john-final-backoffice` på `7dee0901c75b7470c16a178079d5a5ebe4f11b9f`
  anpassas till befintlig React/Studio-runtime. Partnerdelen saknar Dealer archive,
  Rooms legacy, Voice lines, Dealing clips, Game media, Action tree och Generations;
  dessa nås endast genom den interna ytan. Delade vyer skiljer godkända val från
  intern produktion. Samtliga 24 ursprungliga destinationer ska redovisas, med
  fungerande navigation/direktlänkar och tydlig status för oanslutna funktioner.
  Första etappen är enbart för befintligt inloggad intern admin med två isolerade
  exempeloperatörer. Detta inför inte kundinloggning eller en livekundanslutning.
  Verifierat lokalt 6 oktober: alla 24 vyer öppnade i webbläsare, rätt team efter
  operatörsbyte/omladdning, lokala designutkast och stängning vid administratörsbyte
  respektive återkallad session. 24 riktade integrationstester samt frontend- och
  Studio-byggen passerar. Publicerad kod `5524b968` är provad med befintlig intern
  adminsession: båda ytorna, menybyten, operatörsbyte och direktlänkar fungerar.
  Oinloggade besök går till login; API ger 401. Riktig kundinloggning ligger i T2.
- [ ] **T2. Verkliga tre inloggningsklasser och organisationsmedlemskap.** Behåll
  dagens kollisionssäkra credentialresolver, inför uttrycklig `partner`-klass och
  separat partner-session med färsk identitets-, roll-, auth-epoch- och
  medlemskapskontroll. Inga automatiska reader/staff-uppgraderingar. Nivå 1
  administrerar operatörer och personal; nivå 2 delegerar endast tillåtna roller
  inom sin organisation. Isolerade tester ska bevisa aktivering, login, spärr,
  återkallelse och nekade direkta anrop mellan två organisationer.
  Detta behöver en separat granskad migration i Studio-schemat för organisationer,
  rollprofiler, medlemskap, partner-sessioner och åtkomstjournal. Ändra inte den
  checksumfrysta `product-schema.sql` eller tidigare migrationsledger. Nuvarande
  native runtime kräver exakt migration 001–004; ny migrationsberedskap måste
  bevara fungerande intern Studio tills den nya delen har tillämpats.
  Delsteg 6 oktober: fristående `web/partner-access-policy.mjs` har explicita
  operatörsrättigheter, scope-/organisationsbindning och begränsad rolltilldelning.
  Både aktuell och ny målroll måste vara uttryckligt delegerbara av nivå 1;
  egen rolländring och ändring av överordnad personal nekas. 22 riktade tester
  passerar inklusive befintlig credentialresolver/Studio-policy. Oberoende review
  är avklarad. Policyn är inte ansluten till runtime: partner-login, medlemslagring,
  sessioner, SQL/API-isolering och skydd för sista administratören återstår.
  T2 är fortsatt öppen; rena policytester är inte acceptans för riktiga konton.
  Förtydligande 6 oktober: intern adminpersonal ska ha åtkomst till alla tre
  nivåer med samma konto. Befintlig intern adminauktorisering skyddar redan
  nivå 2:s förhandsvisning. `/partner` visar nu en separat ingång med explicit
  demoval; inga exempelbolag presenteras som anslutna kunder. Verkligt kundval
  ska följa aktiva organisationsanslutningar när dessa införs, och kundpersonal
  ska bara nå egna medlemskap. Kundregister/sessioner/sparning är ännu inte
  implementerade; detta är en avgränsad stoppunkt före den större T2-migrationen.
- [ ] **T3. Anslut en operatörsfunktion i taget.** Koppla revisionerade
  presentationer och egna bord, sedan rapporter, team och integrationer. Varje
  funktion behöver organisationens ägarskap genom UI, API, lagring och export.
  Render behåller kort, regler, plånbok och avräkning. Importera inte Kevins
  SQLite-konton, gamla miljöfiler eller loopbackbrygga. En generell proxy till
  globalt admin-API är inte kundisolering.
- [ ] **T4. Spelarens lobby.** `/play` visar tillgängliga spel i verifierad
  operatörskontext och ger endast spelarens egen profil/historik. Börja med
  Blackjack; giltiga partnerstarter får öppna spelet direkt utan extra login.
  Ändra inte spelaridentitet eller signerade launch-kontrakt genom namnbytet.
  Delsteg: enkel `/play`-ingång och `/play/blackjack` återanvänder befintlig
  sessionskontroll, sparad lane och signerad launch. Äldre speladresser leder
  vidare i det gemensamma molnprojektet. Operatörsbunden katalog/profil/historik
  är inte införda; T4 förblir öppen.

Författaren till det frysta GitLab-headet är ImpactPL; identiteten är ännu inte
bekräftad som Kevin. Överföringens källrevision är därför explicit dokumenterad.
Privata originalanteckningar i `random/` är inte del av produkt eller deployment.

### Terminologi och navigation — 6 oktober

Aktiv guide och ordlista skiljer lane, klippuppsättning, adapter, urval,
uppspelningsplan och operatörspaket. PDF:erna används som underlag, aktuell
kod avgör status. Nivå 1 är ScoutGamingGroups gemensamma adminyta med riktiga
verktygsingångar, inte en parallell uppsättning av Kevins exempelpaneler.
Studio ingår i samma yta och huvudmeny. Nivå 2 behåller den importerade
förhandsvisningen. Äldre hashbokmärken fungerar; interna klipp/tal/media/konton
leder till befintliga verktyg och oanslutna vyer får en tydlig förklaring.
Nivå 2:s lane-/designnotiser visar saknad spelkoppling;
lokala utkast fungerar fortsatt i den befintliga bordsförhandsvisningen.
Ingen partner-login, DB-migration, spelregel eller mediefil ändras här.

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
  särskilja orsakerna. Ingen ny kodprovning utfördes. Actions-budgeten är därefter rättad av Jakob; senare 6 oktober-körningar
  har tre successjobb. Det äldre hindret är historik. Funktionsbeviset på e49 och privata failurekvitton bevaras.
- [ ] **F. Produktionsmail och användbar invite/reset.** Samordnad Resend-leverans
  6 oktober har återläst produktionsnyckel och `no-reply@scoutgaming.tech` i
   samma Studio-projekt som nu heter `scoutgaming`. Den befintliga nyckeln har avgränsad sending-access för den
  verifierade domänen. READY-deployment `dpl_G7tZPZ5QAPTdppLhHuGgkpPWwnxh`
  publicerar fryst `184fe66ba22acf63704f2a955f895b359e05027e` i `fra1` utan
  partnerarbetets då lokala ändringar. Den verkliga native mail-adaptern fick
  HTTP 200 och Delivered för både invite och reset till Resends sandbox
  `delivered@resend.dev`. Login och set-password gav 200, utloggad session 401;
  reset-formens action är `/studio/api/auth/reset-request`.
  Den oanvända extra Marketplace-installationen är borttagen efter kontroll av
  noll resurser/projekt/fakturor och noll env-referenser i 71 lästa projekt.
  Fungerande Resend-konto, domän och QA-koppling är bevarade. Tidigare QA-401
  vid domänlistning betydde restricted_api_key för sending-only, inte ogiltig nyckel.
  Produktionskonfiguration och providertransport är därmed verifierade.
  Verklig kontoinvitation, token/aktivering, återställning och mottagarens inkorg
  återstår; inga riktiga konton eller tokens ändrades i sandboxprovet. F förblir
  öppen. Privat kvitto: `lab/data/platform-private/resend-setup-20261006.json`.
  Förtydligande 6 oktober: native Resend-mejl har nu både text och HTML med
  avsändarnamnet ScoutGamingGroup, uttrycklig **intern adminpersonal, nivå 1**
  och åtkomst till hela nivå 1, nivå 2 samt nivå 3 med samma konto/lösenord.
  Mejlet förklarar att nivå 2 tills vidare visar demonstrationer. Formuläret
  i Administration → Konton säger samma sak. Engångslänkarna behåller 72 timmar
  för aktivering och två timmar för återställning. Spelarroller får egna
  mejltexter utan adminbehörighet; okända roller skickar inget mejl.
  Riktade mail/auth/UI-tester och Lab-typkontroll PASS. De två begärda verkliga
  personalinbjudningarna och mottagarnas aktivering/inkorg verifieras separat;
  denna kodleverans markerar inte F komplett och ändrar inga lösenord.
  Jakob tar över de två verkliga utskicken enligt senaste instruktionen.
  Agenten skickar inga mejl eller skapar konton i denna fortsättning; verifierad
  leverans och mottagarnas aktivering behöver fortfarande registreras här.
- [ ] **G. GitGuardian-fynd utredda och hanterade.** Senast återläst
  workspace795524/source30689542 den 6 oktober: 12 öppna och fem ignorerade,
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
Detaljer och kvittoplatser: [den enda löpande handoffen](JOHN-HANDOFF.md#nästa-arbete-och-viktiga-gränser).
Avslutade migrationssteg och deras historiska bevis står kvar nedan.

## Källa och historiska driftkvitton

Aktiv källa är [Jakeminator123/scoutgaming](https://github.com/Jakeminator123/scoutgaming),
enbart main. Gamla github-work-adressen vidarebefordras; skapa inte ett nytt
repo där. GitLab är fryst proveniens och används inte för leverans.
Samlad tidigare drift-/importhistorik finns i den frysta historiklänken ovan.
Nuläge, acceptans och historiska kvitton ska aldrig blandas ihop.

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

En sajt och ett repo, tre åtkomstnivåer enligt systembeskrivningen.
Städa ersatt kod och dokumentation efter verifierad ersättning. Bevara privata
backup-/QA-/kostnadskvitton och andras arbetsdata. Radera inte en tjänst för
att dess UI-namn har ersatts: verifiera dess aktiva läsare och ansvar först.

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

### Migrationsstatus och beroenden

P0–P5 och P7–P9 är levererade med sina dokumenterade avgränsningar.
Fulla acceptansvillkor, importparitet, källhashar och rollbackkvitton finns i
[den frysta migrationschecklistan](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md#checklista-och-beroenden).
P7:s avgränsade aktivering var inte ett godkännande av full P6.

- [ ] **P6 — samlad helhetsacceptans.** Fyra dealers/två faktiska plays,
  auth/revoke, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/
  omstart och naturligt provider-COMPLETED där bevis saknas. Mänsklig läppsynk,
  kortkontakt, fysisk mic/kamera/mobil/Safari är separata krav i H.
- [x] P6:s isolerade SQL/HTTPS-fixtur och faktisk CI-resultatkoppling är rättade;
  se D/E. Äldre misslyckade kvitton bevaras. Separat game-persistenceprov saknas.
- [ ] Produktionsmailens hela användarflöde återstår enligt F trots konfigurerad Resend.
- [ ] GitGuardian-fynd och positionsluckor återstår enligt G.

Framtida migration börjar med källinventering och frysta skrivare, därefter
kontrakt/lagring/UI och integration; acceptans, aktivering och avveckling
samordnas. Historiskt godkännande är ingen ny budget eller driftauktoritet.

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
| Publik webb/spel | Vercel scoutgaming, service web från apps/croupier-frontend, /blackjack; service studio från lab under /studio |
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

### Varför finns flera kort kvar i Vercel? — verifierat 6 oktober

| Projekt | Roll |
| --- | --- |
| scoutgaming | Enda aktiva produktionsprojektet; web + studio från samma repo/main, region fra1 |
| scoutgaming-legacy-frontend | Tidigare croupier-frontend; domänlös reserv med Git-byggen och automatisk domäntilldelning avstängda |
| croupier-native-qa-abc92154cb15 | Befintlig isolerad testfrontend |
| croupier-native-studio-qa-abc92154cb15 | Tillhörande isolerad Studio |
| croupier-player-preview-qa | Äldre testfront med Blob/Neonintegrationer; kandidat efter ägar-/konsumentkontroll |

Ett repo/en produktionssajt finns genom ett projekt med två Services.
Det gamla croupier-lab-ui-ID:t bär nu hela projektet, vilket bevarar dess
Neon/Blob/Resend och nycklar. croupier-lab-ui.vercel.app består som kompatibelt
Studio-alias; croupier-frontend.vercel.app ger 308 till www.scoutgaming.tech.
Reservprojektets pause-API gav invalid_deployment eftersom aktiv produktion
saknas; det är inte markerat paused och får inte beskrivas som raderat.
NativeQA byggs manuellt/API från samma explicita reposSHA; ConnectGitRepository
betyder saknad automatisk Gitkoppling.
Äldre player-preview är READY på 22dca5c4/dpl_6ksHgAKr7NoW5NEAuP4xVcJucAok;
proxyrot apps/croupier-frontend, session-GET 421 och /studio 500 i avläsningen.
Den är inte fungerande alternativfront, men Blob/Neonägarskap får inte blindraderas.
Produktionen kräver inte QA-fronter; deras data/delade media ska ändå skyddas.
QA behålls/AI-GPU OFF. Webbapparnas paket/Next-versioner är fortfarande separata.

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

GitGuardian följer scoutgaming i workspace 795524/source 30689542.
Senast verifierat: 12 TRIGGERED/5 IGNORED, en incidentsida/17 locationsidor,
partiell fil-/radtäckning. Se G för öppna fynd och bevisgränser. Historiska
färre incidenter eller fixtureklassningar ersätter inte aktuell läsning.
GitHub queued/no runs, vanlig grön CI eller neutral/skipped är inte incidentfrihet.
Följ AGENTS metadataredaktion; använd befintlig läsbrygga, inga nya scopes
eller automatiska resolve/ignore-ändringar.

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
Produktion har nu giltig domänbegränsad Resend-sändnyckel och
`CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech`. Sandboxtransporten är
verifierad; full riktig invitation/reset återstår enligt F. Sending-only ger
inte behörighet att lista domäner och en sådan 401 bevisar inte ogiltig sändnyckel.
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
Samordna med eventuell aktiv ägare innan gemensam integration. Gamla
arbetsfördelningar i historiken gäller inte automatiskt ett nytt uppdrag.
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

Systemkartans exporter är frysta till sitt käll-SHA och observationstid.
Aktuell resultatkoppling beskrivs i E. Saknat eller skippat prov är inte grönt.
Den passiva CI-reportern och dess artifacts gör inga provider-/DB-mutationer.

## Historik

Den fullständiga tidslinjen och tidigare deployments ligger i den frysta
historiklänken överst. Privata loggar och backupfiler är inte borttagna.
Den aktiva checklistan ovan är statuskällan.
