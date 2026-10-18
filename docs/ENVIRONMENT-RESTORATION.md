# Återställning och skydd av data

Produktens leveranskälla är `Jakeminator123/scoutgaming` på `main`.
Den lokala arbetskopian kan ligga på en arbetsbranch; kontrollera root,
branch/HEAD och egna ändringar före synkning eller återställning.
Aktuell överlämning finns i [JOHN-HANDOFF.md](JOHN-HANDOFF.md), och senaste
verifierade driftsättning/acceptans överst i [CLOUD-MIGRATION.md](CLOUD-MIGRATION.md).
De daterade versionsreferenserna nedan är historiska återgångsunderlag,
inte uppgift om vilken SHA produktionen kör just nu.
GitHub-källan heter nu `Jakeminator123/scoutgaming`, samma repo-ID `1380630440`.
Namnbytet är godkänt av Jakob och gammal `github-work` vidarebefordras till den.
Lokal origin och push-/säkerhetspolicy använder den nya adressen.
Den äldre kopian under Scout-Gaming är inte produktens källa.
Start och drift: [CLOUD-MIGRATION.md](CLOUD-MIGRATION.md).

Vercelproduktion är `scoutgaming`, ID `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`,
i team `scoutgaming` (`team_Scxorb9qtZHjNae1YEQnFCaT`): reporot, framework
services, två Next-appar och en taltransport, region fra1, Git-autobyggen aktiva.
www och apex samt de gamla frontend-/Studio-aliasen tillhör samma projekt;
apex och gammal frontend omdirigerar till www. Vid kontroll 14 oktober
22:25 UTC var main `a0df4e26` READY på `dpl_7FAC4NFoEdSQCA521AQcWe1XqJme`.
Render `croupier-v2` gav hälsa 200 och samma SHA via `/__cloud/version`.
Det är ett daterat kvitto; kontrollera senaste version före återställning.

Det historiskt dokumenterade reservprojektet `scoutgaming-legacy-frontend`,
`prj_I6KkhVlk4qMSPlAwSPZdnz4aVQ2s`, gav 404 i båda tillgängliga teamen vid
kontroll 15 oktober. Namnsökning hittade inte projektet. Det är därför ingen
verifierad återställningskälla; tillgänglig env/historik eller radering är
inte bevisad.

**Historisk återgång före den samlade produkten:** den äldre proceduren
byggde på separat frontend-/Studio-projekt, flytt av www/apex och återställda
Unified/UI-flaggor. Den är inte en aktuell körinstruktion eller en verifierad
reservväg. Ursprungliga projektinställningar/deployment-ID finns privat i
`lab/data/platform-private/scoutgaming-project-before-services.json`.
Deras existens bevisar inte åtkomst till de tidigare molnresurserna.

**Verifierad versionsreferens inför Dragan-rättningen, 16 oktober 2026:**
Vercel `dpl_BvYsArnsKqDHpWymic2P89LiBmj3` är läsbar och READY i produktion
i projektet/teamet ovan, med www/apex tilldelade. Render
`dep-db902o1srm7s73a3noc0` är live på `croupier-v2`
(`srv-datg3j6gekts73amgli0`) i Jakob's workspace
(`tea-d19jsa63jp1c73ch0sc0`). Båda kör
`10d3255e03b704e27bfe05b30855e7e26b7f8aba`; Renders publika
`/__cloud/version` bekräftar samma SHA och `/__cloud/health` svarar 200/ok.
PR178 ändrar klientens återhämtning, tester och dokumentation; databas,
frysta paket, mediebyte och miljökontrakt ändras inte i den leveransen.
Versionsparet är därför en konkret referens vid en avgränsad kodåtergång
från PR178. Ingen rollback eller databasåterställning har utförts.

Återläs resursåtkomst, SHA och kompatibilitet inför en faktisk återgång;
andra senare ändringar kan kräva andra åtgärder. Behåll samma samlade
projekt och domäner. Miljöprofiler och bygg-/runtimeflaggor ska följa
[den aktuella loaderkartan](ENVIRONMENT-VARIABLES.md#aktuell-avgränsning-15-oktober-2026-kväll);
återställ inte äldre env-filer eller flytta domäner som en rutinmässig del av
kodrollback. Denna dokumenträttning utför ingen omkoppling eller molnändring.

De två äldre native-QA-projekten finns fortfarande i
`jakeminator123s-projects`, utan Scoutgamings produktionsdomäner. De är
separata testmiljöer, inte alternativa produktionssajter. Deras namn och
datagräns finns i [miljöregistret](ENVIRONMENT-VARIABLES.md). En gammal
READY-deployment är inte ett färskt funktions- eller isoleringsprov.

## Byggdelar och Node-versioner

| Källmapp | Ansvar | Node |
| --- | --- | --- |
| `apps/studio/` | Studio-tjänsten: Admin, Partner, Lobby, auth/API och medieåtkomst; `/studio` är teknisk basePath | 24.x, Volta 24.21.0 |
| `apps/studio/client/` | Admin/lobby-paket som byggs och serveras av Lab | 24.x, Volta 24.21.0 |
| `apps/web/` | Publik Next-app, spelstart och transport till spelmotorn | 24.x, Volta 24.21.0 |
| `apps/speech/` | Separat Vercel-tjänst för lång talström | 22.x, Volta 22.23.1 |
| `services/game/` | Spelmotor, serverkort, plånbok och gemensam spelarlogik | ≥22.16; produktions-Docker använder 24 |
| `services/astrid-gpu-worker/gateway/` | Delad transportkod och dess tester; ingen extra publik sajt | ≥22 |

Volta väljer version efter arbetskatalog. Kontrollera `node -p process.version`
inne i paketet innan installation eller test. Ange arbetskatalog separat från
exekverbar fil; en hårdkodad annan Node-binary går förbi Volta. Lokala pinnar
styr inte automatiskt Vercel eller Docker: kontrollera respektive byggmiljö.

Inför bygge/fullhook i en ny isolerad arbetskopia behövs låsta beroenden i
`apps/web/` (`pnpm-lock.yaml`), `apps/speech/`, `apps/studio/`,
`apps/studio/client/`, `services/game/` och `services/astrid-gpu-worker/gateway/`
(`package-lock.json` i de fem senare). Kör `pnpm install --frozen-lockfile`
respektive `npm ci` från rätt paket med dess deklarerade Node-version.
Befintliga lokala installationer får återanvändas via en egen junction först
efter verifierat identiska `package.json` och låsfiler. Installera aldrig genom
en delad junction. Kontrollera tillgängliga `tsc`/`ws` i respektive konsument
före tunga körningar, så saknade beroenden inte ger upprepade fel. Speech använder
Node 22.23.1 och egen `npm ci --ignore-scripts`; frontend använder Node 24.21.0.
Båda installerar `packages/server-transport` som låst lokal paketdependency.
Speechs `.npmrc` har `install-links=true`, så paketet och dess `ws` installeras
i tjänstens egen `node_modules` utan att frontend behöver vara installerad.
Paketets konfiguration och sökvägskontrakt kan importeras utan `ws`.
Kör Studio-bygget före fullhook. När Playwright och Chrome redan finns kan
`CROUPIER_BROWSER_FIXTURE_MODULE` peka på modulens absoluta fil och
`CROUPIER_BROWSER_FIXTURE_CHANNEL=chrome` aktivera isolerade browserprov.
Inställningen är valfri; redovisa överhoppade prov separat från godkända.

Next/React-versionerna hör till olika byggpaket. Lab använder Next 16.3.8 /
React 19.3.0, frontend Next 15.5.26 / React 19.1.0 och designpaketet React
19.2.3. Designbyggets uttryckliga React-alias samlar importer i samma bundle.
Versionsskillnaderna motiverar inte att aktiva `node_modules` tas bort eller
att allt uppgraderas samtidigt. Frontendens typkontroll är nu obligatorisk
i fullhook/CI och Next-bygget; dess tidigare undertryckta alpha-kontraktsfel
är rättat utan dependencybyte. React 18-typerna där är separat underhållsskuld.
Återverifiera då dokument, API-spärrar och klientfiler på kanoniska domänen.
Återställning får inte skriva över Neon/Blob/Resend, konton eller QA-data.

Produktionens gemensamma Neon-policy, dataimport och diskfria drift är verifierade.
Den tidigare produktdisken och tolv ersatta Blobobjekt är avvecklade. Aktuella
versioner, paritetskvitton och kvarvarande acceptans finns i [JOHN-HANDOFF](JOHN-HANDOFF.md).
QA:s separata data, SDK och journaler bevaras med AI/GPU OFF.

Full extern produktdiskbackup finns i
`C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`:
206 filer, 10 mappar, 125 745 905 källbyte; inventering, arkivläsbarhet och
remote/lokal/arkivhash verifierade. Kvittots SHA256:
`12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
Den är en historisk återställningskälla, aldrig en andra aktiv writer.

Det här dokumentet är en procedurguide. Det laddas inte som processmiljö.
Ignorerade `.env`-filer och leverantörernas hemlighetslager har en annan roll;
ändra dem inte som del av dokumentstädning. Namn och ansvar beskrivs i
[ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).
Äldre checkpoints finns i [Git före städningen](https://github.com/Jakeminator123/github-work/blob/6b9dad55ced03ee0573e24b472b4dcbba2b97776/docs/ENVIRONMENT-RESTORATION.md).

## Lokal miljö

Starta med `node apps/studio/start.mjs` enligt [Studioguiden](../apps/studio/docs/README.md). Sessionsvakten i `services/openclaw/lab/deploy/local-session.mjs` finns kvar. Cmd-filerna i roten är borttagna.
Kör endast ett produkt-/labbpar; stoppa det före miljöbyte. Från Codex används
`--no-open`. Återanvänd spel- och labbflik, bevara utkast och spel.
Stoppade servrar förblir stoppade tills Jakob ber om start.
Sparade lokala projekt, historik och profiler finns i `lab/data`;
spel-/CRAIG-databaserna ligger i `lab/data/players`. Isolerade testprofiler
får inte ersätta dem. Lokal backup: `tools/backup-lab-state.mjs` läser fortsatt
`lab/data`, även när `apps/studio/data` finns. Inga privata filer flyttas av verktyget.
Anslutningsverktygens standardordning är rotens `.env`, äldre `lab/.env.*`,
nya `apps/studio/.env.*` och sist processmiljön. Cloud storage kräver samma
uttryckliga opt-in; ett explicit `envFiles` ersätter standardlistan.

Den 2 oktober flyttades 39 privata filer (4 568 960 byte) utan överskrivning
från den tidigare katalogen till labbet. Hela gamla katalogen, 42 filer, finns i en separat
hashverifierad privat kopia: `C:\Users\jakem\CroupierBackups\lab-consolidation-20261002`.
`lissabon/` är därefter borttagen. Projektets bytes och historik bevarades;
den gamla sessionsvakten ersattes med `lab/data/.local-session.sqlite`.

Andra äldre checkouter flyttas offline med
`node tools/migrate-lab-state.mjs --destination <ny-absolut-backup-utanför-Git> --apply`.
Verktyget stoppar vid aktiv session, SQLite-sidecars, länkar eller målkonflikt.
Utan `--apply` inventerar det endast; ett giltigt gammalt projekt får inte
ignoreras av startaren. Backupen verifieras med `verifyLabMigrationBackup()`
i samma modul. Återställ endast med stoppade servrar, bevara nuvarande Lab-data
separat och kopiera den verifierade backupens `lissabon/data` till en tom
`lab/data`, utan den gamla `.local-session.sqlite`. Återskapa inte den gamla katalogen.

## Git-historik efter rensningen 12 oktober 2026

Jakob godkände en engångsomskrivning av Git-historiken. Aktuella branchers
filer bevarades; äldre oanvänd media togs bort även ur historiska taggar.
Ordinarie leverans sker fortsatt på main med push-github-work.mjs utan force.
Alla sju befintliga arbetskopior på Jakobs dator fick motsvarande nya HEADs.
Andra kloner måste utgå från nyklonad historik och återföra eventuella egna
ändringar som avgränsade patchar. Merga eller pusha inte tillbaka gammal historik.

Privat återställningsmaterial finns utanför Git i
`C:/Users/jakem/.codex/visualizations/2026/10/12/01a12ebb-0f5c-7e72-b93b-8e3c6f297053/history-cleanup/approved/`:
`original.bundle` (4 504 287 614 byte, verifierad), `reflog-only.pack` med
separat checksumma, `original-git-metadata.zip`, `source.json`,
`local-ref-plan.json` och `filtered.git/filter-repo/commit-map`.
Bundlens SHA-256 är
`630fac7c2afe4e2e1ea63146781ecc05eebaa52eb7819b617e85c328344f70dc`.
Reflog-arkivet behövs bara för lokala tillstånd utanför bundlens refs.

Återställ originalhistorik genom att klona bundlen till en separat tom katalog.
Kontrollera checksumman först. Vid behov kan reflog-paketet importeras i denna
separata kopia med Git index-pack; metadataarkivet beskriver gamla lokala refs.
Skriv inte originalets Git-metadata över en aktiv arbetskopia och publicera
inte återställd gammal historik. Bundlen innehåller versionshanterade filer;
lokalt 3lager-material, miljöfiler, Neon-/Blob-data och lokala databaser ingår
inte i Git-backupen och lämnades orörda vid denna rensning.

## Beständig molndata

Produktionen använder nu Neon för Studio-policy, metadata och kostnads-/
jobbjournaler samt privat Blob för beständiga paket. Konton och spel är bevarade
i sina befintliga Neon-databaser. Isolerad native-QA har separat scope;
dess disk, installerade SDK, sourcepins, budgetjournal och kvitton bevaras.
Tabellens produktdisk beskriver den historiska källan som nu är avvecklad
efter diskfri P8-slutkontroll; backupen får aldrig startas som en andra aktiv datakälla.

| Tjänst | Datarot | Bevara tillsammans |
| --- | --- | --- |
| Historisk produktdisk/extern backup | Tidigare `/var/data` | Hela frysta diskarkivet, inklusive äldre SQLite/BO/Studio och journaler; ingen blind restore över den aktiva Neon-källan |
| Director | `/data/catalog` | `catalog.json`, `history/`, använt `companion.sqlite` |
| Gateway | `/data/openclaw` | `openclaw.json`, agentfiler/sessioner, `companion-search.sqlite` |

Game/auth-Neon är konto-/speldatabasen sedan 2 oktober; zonmetadata har sin
egen databas. SQLite-filerna på disken är bevarade historiska källor.
Git och Blob-upload säkerhetskopierar inte Studio-index, konton eller saldo.
Produktens fullständiga externa backup är verifierad och behålls efter P8:
`C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`.

`tools/backup-render-state.mjs` har profilerna `product`, `director`, `gateway`.
Product-profilen gäller den pensionerade diskvägen; den säkerhetskopierar inte
aktuell Neon/Blob. Använd inte gamla produktdiskkommandon mot den nya driften.
För de aktiva Director-/Gatewaydiskarna krävs stoppade/frysta skrivare och en
separat privat destination utanför Git och dataroten. `--quiesced yes` är en
operatörsförsäkran, inte mätt writerdränering. Maintenance Mode räcker inte.

Verktyget vägrar länkar/specialfiler, exporterar SQLite inklusive committad WAL,
kontrollerar integritet/främmande nycklar och verifierar filhashar. Exportera
hela snapshoten privat utanför Render och verifiera kopian där; `/tmp` är flyktig.
Samordna snapshots eftersom separata DB-kontroller inte bevisar gemensam konsistens.
Restore kräver stoppade skrivare, verifierat snapshot, rätt profil och tom monterad
målrot. Bevara senaste Neon/ledger separat och verifiera schema, scope, media och
aktuell paritet. Äldre SQLite får inte aktiveras efter nya Neon-skrivningar utan
samordnad datatillbakaföring; inga parallella writers eller automatiska fallbacks.

Director återställs till `/data/catalog`, Gateway till `/data/openclaw`.
Verifiera inloggning, saldo/shoe, BO-roller, Studio-projekt och historik efter
start och ytterligare omstart. Blanda inte äldre CRAIG med nyare speldata.
Efter avbruten restore: håll tjänsten stoppad och granska dataroten.
Produktens externa fullbackup är verifierad enligt ovan. Externa fullbackuper
av de aktiva Director-/Gatewaydiskarna är ett separat kvarvarande ansvar.

Produktionsdatabaserna har separat verifierad extern backup i
`C:\Users\jakem\CroupierBackups\neon-game-20261002-132437`: två orörda
SQLite-filer, snapshotmanifest, PostgreSQL-backup och migrationskvitto.
24 källtabeller/102 rader importerades; full återläsning av 32 PostgreSQL-
tabeller inklusive sekvenser gav identisk hash. Exportprocessen ersatte
både Web och Lab och bevisade noll skrivare; samma aktuella snapshot krävdes
omedelbart före aktivering. Studio-index och Director/Gateway behöver sina
separata fulla diskbackuper. Efter nya Neon-skrivningar är äldre SQLite
ingen automatisk återgång.

## Disponibel lokal byggcache

`apps/studio/.next/cache`, `apps/web/.next` och deras
`tsconfig.tsbuildinfo` är återbyggbara. Rensa endast när sessionsvakten saknar
aktiv session och inga berörda Next-/byggprocesser kör. `apps/studio/tsconfig.json`
utesluter privat `data/` från appens typkontroll. Labbets övriga `.next`
innehåller en runtime som det befintliga integrationstestet faktiskt använder;
behåll den eller kör `npm --prefix apps/studio run build` före full regression.
Använd exakta sökvägar; rensa inte `lab/data`, privata QA-kvitton, medier
eller journaler. Interaktiv start är `node apps/studio/start.mjs`.

## Media och regression

Media lagras nu i `media/dealers/<dealer>/{runtime,source,review,staging}`,
`media/game` och `media/site`. `media/layout.json` binder exakt gamla paths,
publika URL:er, storlek och hash till nya filer. Originalnamn och historisk
Emil-/Kevin-proveniens bevaras i metadata; `v1` är ingen gemensam rotversion.
Historiska migrationskontroller och senare rensningskvitton finns i handoffen.
Privata rollback-ledgers ligger
i ignorerade `media/.migration`; `migrate-media-layout.mjs --rollback <ledger>`
vägrar överskrivning och behåller den kanoniska kopian. Kör med stoppade skrivare.

`docs/reference` har flyttats till `media/dealers/astrid/source/reference`.
Kalibreringsverktyg använder samma resolver. Privat Blob-export använder
`croupier/media/<samma-logiska-katalog>/<id>/<sha256>.<ext>`; indexet publiceras
efter återläsningshash. `media/blob-index.json` är aktivt i molnet. Tolv ersatta `croupier/videos`-alias
är avvecklade; aktuella zon-/mediereferenser består. Efter den verifierade
source/staging-rensningen och dedupliceringen finns 2 514 logiska poster och
2 450 fysiska filer. `canonicalPath` bevarar ID/URL/hash och åtkomstgränser.
Tidigare kopior återinförs inte från gamla manifest; använd aktuell layout och
de bevarade privata kvittona i `lab/data/lane-media-audit/`.

Neon-verktyg: `tools/migrate-sqlite-postgres.mjs` installerar/importerar till
tom, separat game-databas; `tools/postgres-backup-restore.mjs` verifierar full
rad-/sekvensparitet. De vägrar zon-databas och import med aktiv extern wallet.
Bevara orörda SQLite-backuper utanför Git. Efter första nya Neon-skrivning
kräver återgång senaste data/ledger; starta aldrig blindt en äldre SQLite-kopia.

Bevara råmedia och kalibreringar för det som finns kvar. `dealer-sync-baseline.json`
följde med den indexerade banken ut ur trädet. Varje taländring
är ett paket: exakt text, audio, video, frame-index, kalibrering och mänskligt
acceptanskvitto. Ny audio-/videohash ogiltigförklarar tidigare godkännande.
Bygg ersättningstagningar i separat staging. Kringgå aldrig indexets spärr
mot överskrivning av kalibrerade bytes genom att ta bort metadata.

Alla fyra dealers använder gemensam uppspelningsväg. Matcha exakt replik;
välj aldrig talvideo efter ungefärlig längd eller loopa gammal mun över nytt
ljud. Källor: `web/public/local-presentation.mjs`,
`web/public/layered-presentation.mjs`, `web/public/performance-player.mjs`,
`tools/media/build-index.mjs`.
Äldre automatiska warp-/offsetrecept är ingen generell instruktion för nya takes.

För spelar-/mediaändring: kör hooken och relevanta beteendeprov.
`audit-dealer-sync.mjs` följde med den indexerade banken ut ur trädet.
Använd `?dealer=<name>&rehearsal=1` vid konkret uppspelningsfel eller begärd
visuell granskning. Upprepade spelningar krävs bara för beteenden som beror
på upprepning; det finns inget generellt krav på två spelningar.
Hash, waveform, första munrörelse och tester godkänner inte synk/kortkontakt.
Uppdatera endast avsiktligt granskade baselineposter med per-line-resultat.
Kända kvarvarande fel: [JOHN-HANDOFF.md](JOHN-HANDOFF.md).
