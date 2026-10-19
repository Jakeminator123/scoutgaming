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

## Återställ den samlade produkten

Vercelproduktion är `scoutgaming`, projekt
`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD` i team
`team_Scxorb9qtZHjNae1YEQnFCaT`. Reporoten bygger webb, Studio och taltransport;
www/apex tillhör detta projekt. Spelmotorn kör på Render `croupier-v2`, tjänst
`srv-datg3j6gekts73amgli0` i workspace `tea-d19jsa63jp1c73ch0sc0`.

1. Frys aktuell main-SHA, faktisk Vercel-/Render-version och avsedd återgångs-SHA.
   Läs både deploymentstatus och Renders `/__cloud/version` samt `/__cloud/health`.
   Grön byggstatus bevisar inte att båda tjänsterna kör samma version.
2. Kontrollera att återgångskoden fungerar med installerat Neon-schema,
   lagrade paket/media och nuvarande miljökontrakt. Följ
   [miljöguiden](ENVIRONMENT-VARIABLES.md) och aktuell handoff för talflagga,
   stoppväg, behörigheter och pågående driftprov.
3. Gör en avgränsad kodåtergång genom ordinarie featurebranch/PR och erforderlig
   CI/readiness. Samordna pågående aktivering innan nästa automatiska deploy.
   Kontrollera därefter faktisk version och den berörda funktionen igen.

Återställ inte gamla env-filer, produktregister eller domänkopplingar som en del
av vanlig kodrollback. En ändrad databasbehörighet eller talflagga har en egen
återgång och följer inte automatiskt med koden. Guiden utför ingen sådan åtgärd.
Neon/Blob/Resend, konton, historik och QA-data får inte skrivas över.

Tidigare separata frontend-/Studio-projekt är inga verifierade reservvägar.
Det historiska `scoutgaming-legacy-frontend` gav 404 vid kontroll 15 oktober;
det bevisar varken radering eller tillgänglig historik. Äldre deployment-ID:n
och inställningar är historiskt underlag, inte aktuella startinstruktioner.
Två äldre native-QA-projekt i `jakeminator123s-projects` saknar produktionsdomäner
och behåller sin datagräns enligt [miljöregistret](ENVIRONMENT-VARIABLES.md).
En gammal READY-deployment är inget färskt funktions- eller isoleringsprov.

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

## Renklonprov och separata QA-förutsättningar

Ett oberoende prov kräver direkt GitHub-klon med egen `.git` och egna
låsfilinstallationer; återanvänd då inga äldre moduler, byggfiler, envfiler,
privata data eller junctions till andra checkouter. Börja med en ren
processmiljö även för installation och bygge, inklusive PATH, NODE_OPTIONS,
NODE_PATH och paketverktygens konfigurationsfiler. Privata data som saknas
i Git ska inte återställas för att få detta prov grönt.

[Renklonkvittot 18 oktober](JOHN-HANDOFF.md#huvudagent5-renklon-och-organisationsavslut--18-oktober-2026)
verifierar de aktuella bygg- och offline-startflödena utan gamla projektfiler.
Bygg Studio först; `--offline --skip-build --no-open` får sedan använda
just det nybyggda resultatet. Sessionslås och temporära processer/data ska
kontrolleras efter stopp. Guards och byggspår ersätter inte en OS-sandbox.

En `--single-branch`-klon hämtar normalt endast main. Lägg till den egna
branchen med `git remote set-branches --add origin <featurebranch>` före
ordinarie leveranskommando, så pushen kan skapa dess remote-tracking-ref.
Om pushen redan lyckats men upstreamsteget stannat: kör därefter
`git fetch origin <featurebranch>` och leveranskommandot igen. Fetch kräver
att branchen redan finns på GitHub; ingen force-push behövs.

| Separat behov | Orsak och minsta åtgärd |
| --- | --- |
| Director-konfiguration/historik | Appadaptrarna bevarar relativ `open-claw/lab` för privata inställningar och data. Isolerade prov väljer egen datarot och `envFiles: []`; verklig historik bevaras separat. Director-paketets startprov behöver inte äldre filer. |
| PostgreSQL-prov | `node tools/studio-isolated-qa.mjs --download-postgres` kräver icke-root Linux/WSL, APT/dpkg och OpenSSL; alternativt `--postgres-bin /absolut/bin`. Verktyget skapar och tar bort sitt eget kluster. Vid HTTP-spegelns checksummefel: använd betrodd HTTPS-källa via separat `APT_CONFIG`, behåll signatur-/hashkontrollerna. |
| Valfria browserprov | Installera Playwright/Chrome separat och ange den dokumenterade fixturemodulen ovan. Dessa behövs inte för ordinarie bygge eller HTTP-fixtur. |
| Privat native-AI-QA | `tools/activate-native-ai-qa.mjs` kräver `native-cloud-browser-qa.mjs`, `native-p6-sdk-worker.mjs`, `native-p6-sdk-admission.mjs` och `native-p6-upstream-bounds-final.json` i `lab/data/platform-private`, plus sitt hashbundna OpenAI-SDK 7.12.1-träd. Bevara/verifiera dessa för just den uttryckliga QA-kampanjen; de är inga normala bygg-/startberoenden. |
| Publicerad produkt och tal/mediaarbete | Neon, Blob, auth/provider-inställningar samt relevanta råmedia/banker behövs för sina respektive funktioner enligt miljö-/runtimeguiderna. Offline-fixturen ersätter dem med syntetisk konfiguration och verifierar inte skarp tjänst eller medieacceptans. |

## Lokal miljö

`node apps/studio/start.mjs --no-open` visar den publicerade lobbyns adress.
Det startar inga lokala produktservrar och läser inget lokalt produktregister.
För isolerad provkörning används uttryckligen `--offline --no-open` enligt
[Studioguiden](../apps/studio/docs/README.md). Bara fixturen använder ett lokalt
serverpar och sessionsvakten i `services/openclaw/lab/deploy/local-session.mjs`.
Kör ett sådant par åt gången; dess stoppväg rensar egna processer och testdata.
Återanvänd relevanta browserflikar, bevara utkast/spel och lämna stoppade servrar
stoppade tills Jakob ber om start.
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

För läppsynk är den fulla Dragan-banken, bankkvittot och källmanifestet
beständiga privata Blob-objekt under `dealers/dragan/runtime/moving-bank`.
De 50 originalklippens ID/hashar hör till Neon-registret. Ett provresultat
eller en mindre lokalt extraherad bank får inte ersätta fullbanken.
Emils `lappsynk-export-fe1b55e.zip` är ett separat källunderlag (SHA-256
`949443c1084ab3f515792fe66c5e2d381e985f9bdc743e792e5fbca36a9240a3`), inte
den aktiva banken och inte huvudcheckoutens `a.zip` med agentinställningar.
Ingen av dessa ZIP-filer ska läggas i Git eller registreras som videoklipp.

Egna renderingar och granskningar ska bevaras med hash, roll, ursprungligt
klipp/bank, exakt ljud/text och granskningsstatus. Bevara källor tills en extern
kopia är återläst och hashverifierad; en lyckad upload eller HEAD är inte samma
sak. Molnmanifest och aktuell bevaringsstatus anges i
[talhandoffen](JOHN-HANDOFF.md#dragan-talstatus). Råa requestfiler, tokens,
konversationer och miljöfiler ingår inte i generella medieuppladdningar.
Repoverktygets retention omfattar inte automatiskt Codex privata
visualizations-mappar. Flytta inte eller radera dessa som disponibel cache
innan den uttryckliga bevaringen är verifierad.

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
ljud. Källor: `services/game/public/local-presentation.mjs`,
`services/game/public/layered-presentation.mjs`, `services/game/public/performance-player.mjs`,
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
