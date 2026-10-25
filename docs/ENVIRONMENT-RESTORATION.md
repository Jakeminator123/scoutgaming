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
www/apex tillhör detta projekt. Aktiv spelmotor är Render `croupier-v3`, tjänst
`srv-dbd6nfon74is73aiblf0` i workspace `tea-d19jsa63jp1c73ch0sc0`. Den bygger `ops/cloud/Dockerfile.game` från main med automatisk deploy avstängd. Verifierat 24 oktober 2026 mot tjänst, requestlogg och versionendpoint. Tidigare `croupier-v2` (`srv-datg3j6gekts73amgli0`) är suspenderad; starta den inte som återställningsgenväg.

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

## Isolerad K06/K07-staging — historiskt beslut 22 oktober

**Läsgräns, förtydligad 25 oktober:** detta avsnitt bevarar ett daterat resursbeslut och dåvarande försök, inte en färsk resursinventering eller körorder. Kontrollera aktuellt projekt/branch/endpoint, mandatets exakta omfattning och kandidatens schema/readiness innan arbetet återupptas. Tidigare godkännanden gäller fortfarande samma mål/åtgärd; de utökas inte till andra resurser, produktionsdata eller roller. [Masterplanens QA-gräns](../migrering/MASTERPLAN.md#qa-sql-och-lagring-utan-återinförd-legacy) styr fortsatt Kevin-acceptans.

Jakobs uttryckliga godkännande 22 oktober gäller endast det tomma projektet
`croupier-k06-k07-staging` i Scoutgamings Vercel-hanterade Neonorganisation
`org-green-butterfly-00780270`: PostgreSQL18, Frankfurt
(`aws-eu-central-1`), fast0,25CU och autosuspend efter300s. Första provet
begränsas till cirka24 aktiva timmar. Användningskvoter är ingen exakt dollargräns;
lagring kan fortsätta kosta efter compute-stopp. Kopiera inga produktionsdata,
lösenord eller roller. Ingen produktions-DDL, deploy, skalning eller ny Render-
tjänst ingår. Detta är en verifieringsmiljö, inte en produktionsåterställning.

### Verifierad provisionering 25 oktober

Det tidigare skapandehindret är löst. Efter att automatisk godkännandegranskning stoppat Create gav Jakob ett nytt uttryckligt godkännande: skapa det tomma namngivna projektet med Vercels startvärden och begränsa det direkt före appanslutning. Projektet skapades 15:51:36 UTC; endpoint-PATCH och separat GET verifierade följande:

| Resurs / kontroll | Verifierat värde |
| --- | --- |
| Neonorganisation / projekt | `org-green-butterfly-00780270` / `red-violet-36066351`, namn `croupier-k06-k07-staging` |
| Branch / endpoint | `br-plain-voice-b9yu49xi` / `ep-billowing-surf-b93x7p3c` |
| Databasversion / region | PostgreSQL 18 / AWS Frankfurt, `aws-eu-central-1` |
| Compute | min = max = 0,25 CU; autosuspend 300 sekunder |
| Tomhet | Endast `neondb`; inspektionen returnerade noll användartabeller. Nytt projekt, ingen produktionsklon |
| Vercelresurs | `store_YHjcgrD2QEbsGopo` i befintlig installation `icfg_6taAB1ZusMeDLwujDmRK07Yi`; Auth och Realtime av |
| Appkoppling / produktdata | Connect Project hoppades över. Ingen schemaapply, roll, seed, export av anslutningsuppgifter eller produktionsskrivning |

**Kostnadsgränsens faktiska omfattning:** Vercel skapade initialt 1 CU med autosuspend 0. Det enskilda endpointets värden är nu begränsade och återlästa även 15:57 UTC. Projektets standardvärden och användningskvot kunde däremot inte ändras: Neon svarade att organisationen hanteras av Vercel. Skapa därför inga extra computes/branches från dess oförändrade standardvärden. 24 aktiva timmar är provets arbetsgräns, inte en tekniskt verkställd dollargräns. Det visade Launch-priset var 0,106 USD/CU-timme: 24 timmar vid 0,25 CU motsvarar cirka 0,636 USD compute, plus lagring, eventuell skatt och den korta inledande perioden. Autosuspend är även observerad: separat GET 16:06:19 UTC visade endpointets `current_state: idle`, uppdaterat hos Neon 15:58:31 UTC, med oförändrade 0,25 CU och 300 s.

**Färsk gränskontroll:** äldre Render `croupier-vercel-preview-qa` (`srv-datj7l893c1s73ar3u50`) är suspenderad, med maintenance på, automatisk deploy av och äldre `ops/cloud/Dockerfile`/container-entry. Den Dockerfilen och kombinerade starten avvecklas nu ur produktkoden; den äldre resursens konfiguration är historisk, inte ett startrecept. Dess 1 GiB-disk `dsk-datj7lg93c1s73ar3us0` är bevarad. De två gamla native-QA-fronterna finns i `jakeminator123s-projects`; deras existens bevisar inte aktuell isolering. Inga äldre QA-resurser har öppnats eller konfigurerats om.

### Konkret fortsättning, ännu inte utförd

Schemakontrollens bas: main `4abbf1985e183c145c5a7772fe02631c6ee9b274`. Stödet för tom katalog i steg 4 är levererat genom PR #391, main `2faa327e69ae6bac2646009063f4b25c237898bf`, med full CI och faktisk Studio-ledger-readiness på head `9da680f7c91ce3f61e2f99495a3103ab3ab0e9ca`. Schemafilerna i det granskade underlaget är oförändrade. Kompatibel deploy och init återstår; äldre läsare saknar stödet. Databasskapandet är klart som eget delsteg. Den tidigare avgränsningen mot ny appdrift/Render och produktionsdata gäller fortfarande; den nya bekräftelsen gällde Create och direkt begränsning. Tabellen gör nästa installationsbeslut granskningsbart, men är inget tillstånd att återöppna tidigare stoppad QA.

| Ordning | Mains befintliga väg | Kontroll före/efter och kvarstående beslut |
| --- | --- | --- |
| 1. Isolerat databasmål | Separat `croupier_staging` och dedikerad migrationsägare i projektet ovan; separat approll med nödvändiga DML-/sekvensrättigheter | Namn, roller och rättigheter beslutas före CREATE/GRANT. Verifiera exakt projekt, branch, endpoint, databas och ägare; kopiera inga produktionsroller |
| 2. Spelschema | Aktuella `ops/neon-game/product-schema.sql` med verklig `product-v1`-checksumma i ledgern, sedan 006/007; befintliga `tools/prepare-shared-schema.mjs` för 008→009→010 | Frys SHA/hashes, granska genererad SQL och kör med rätt mål/ägare. Verktyget kontrollerar ägare, checksumma och tomma shared-objekt i transaktion. Inga blinda omförsök |
| 3. Studioschema | `planStudioMigrations` → målgranskning → `applyStudioMigrations` i `ops/neon-studio/migrations.mjs`; CLI `tools/check-migration-readiness.mjs --apply` | Kräver godkänd schemaändring och `CROUPIER_MIGRATION_CONFIRM=apply-pending` endast i körningen. Återläs samtliga faktiska tillämpade/pending/optional-versioner; ingen förfalskad ledger |
| 4. Tom policy och katalog | `createEmptyProject()` och befintlig repository-initialisering; tom administration. Scoped runtimekatalog krävs också före Admin-start | **Kodluckan rättad, installation återstår:** `prepareEmptyRuntimeMediaImport({scope})` i `ops/neon-studio/runtime-media-import.mjs` skapar ett exakt tomt, versionsbundet underlag. Använd befintlig plan → mål-/hashgranskning → apply med lås, CAS och audit. Saknad eller nästan tom katalog nekas; befintlig fylld katalog får inte ersättas av tom init. Befintliga klipp behåller full validering. Deploya läsarkompatibel kod i både Vercel och Render före init; äldre läsare avvisar formatet |
| 5. Aktuell appkedja | Efter driftsatt stöd för den tomma katalogen: samlad HTTPS-frontend/Admin från samma repo och spelmotor från `ops/cloud/Dockerfile.game`, gemensamt isolerat scope, nya ingress-/sessionnycklar och eget syntetiskt adminkonto via ordinarie bootstrap | Separat host, Neon och Blob måste återläsas före start. Ingen produktionsnyckelkopiering. Beslut om ny eller uttryckligt återöppnad QA-app saknas; gammal kombinerad Studio/Render-start får inte återinföras |
| 6. Syntetiskt testinnehåll | Efter appstart: befintliga Admin-writers för bolag/dealer/rum/media/publicering, separat privat Blob | Använd inte historiska `createSeedProject()`, produktionsutkast eller direkt SQL som publiceringsväg. Syntetiska klipp kan bevisa transport/identitet, inte PAOWs eller Dragans visuella acceptans |
| 7. Faktisk acceptans | Admin → sparning/återläsning → publicering → fryst paket/config → två klienter/spel → processomstart → kompatibel återställning | Belägg rättigheter/CAS, exakt en ekonomisk effekt, rumsisolering och versionsbindning. Behåll loopback-harnessens skydd. `test/postgres-persistence.mjs` tillåter endast `croupier_game_qa`, inte det föreslagna målet; rikta inte om genom att försvaga vakten |

Befintlig offlineförberedelse har körts med `prepare-shared-schema.mjs --database croupier_staging --role croupier_staging_migrator`. Alla fyra låsta källhashar matchar main ovan. Det genererade 008→009→010-underlaget har SHA-256 `fdd27174ac3d9d1cb5316abbc54f6926e3fab48ef71c9e00c87402d50be0d8ed`, innehåller mål-/ägarvakter och ligger privat som `shared-schema-review.sql/json` bredvid resurskvittot. Det är granskningsunderlag, inte installerat schema eller en godkänd rollskapning.

Inget nytt parallellt testregister eller körsystem behövs. Den uttryckliga tomma katalogen och befintliga Admin-/publiceringskontrakt är kodprovade från `createEmptyProject()` med en ny syntetisk dealer, tom administration och syntetisk uppladdning. Provider-/transaktionsfixturer bevisar inte verklig Neon/Blob, browser eller visuell uppspelning. Ingen komplett befintlig molninstallation bevisar ännu denna kedja. Installation, appdrift och faktiskt samprov är därför återstående arbete, inte godkända testresultat. Officiell status är fortsatt 45 % (9/20); se [masterplanen](../migrering/MASTERPLAN.md#prioriterad-väg-till-910). Det privata resurskvittot finns i den här uppgiftens ignorerade `arkiv/2026-10-25/migration-cloud-acceptance/neon-provisioning-receipt.json`; inga anslutningshemligheter ingår.

Historisk plan från 22 oktober: målidentitet, inställningar och tomma syntetiska data skulle verifieras före anslutning till separat `croupier_staging` med dedikerad migrationsägare. Tabellen nedan dokumenterar då planerade Gitblobbar; den är **inte en instruktion att applicera gamla schemafiler på dagens miljö**. Vid återupptaget arbete måste aktuellt schema, rätt ordning och redan tillämpade versioner jämföras med den frysta kandidaten. Ingen anslutningssträng skrivs i Git eller chatten.

| Fil | Fryst källa | SHA256 av exakta Gitbytes |
| --- | --- | --- |
| `ops/neon-game/product-schema.sql` | J08 `9b43e3e7` | `831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a` |
| `ops/neon-game/008-shared-wallet.sql` | J08 `9b43e3e7` | `fdff425ee30557dc6874b021bbaf163c9db7e1ac8ce5fef499f1dec36346fd81` |
| `ops/neon-game/009-shared-blackjack.sql` | J08 `9b43e3e7` | `73853e23080baf9c1257893f6b74a68dab7067862ad9787a9f3f6b1d01a72515` |
| `ops/neon-game/010-presentation-receiver.sql` | K04 `1148fa76` | `214d9259d7d83b9084e12e3807e1ebf8fbbc5dc801392f361f4763a2b64cce43` |

Fulla källheads: J08 `9b43e3e7f7cde871cdba9efe81800bf8b5c4d329`, K04
`1148fa767de734c925bba3ea21938cf995f8bd5f`. Schema010 är nu importerad från K04 till transportbranchen; filen är inte
applicerad i någon molnmiljö. Vissa schemafiler är inte idempotenta; kör inte
blinda omförsök. Läs tillbaka schema och pröva beständighet, två klienter och
atomisk rollback med syntetiska data. Befintlig lokal PG-harness äger ett
loopbackkluster och fysisk omstart; rikta den inte direkt mot Neon. Verifiera
separat PG18/målanslutning innan K06/K07-integrationsacceptans.

## Isolerad K04-start med verklig server

**Avgränsat befintligt testverktyg, inte standardstart för migrationen.** Använd endast när ett identifierat PG-/processfel behöver detta isolerade prov. En lokal mediemapp, serverstart eller syntetisk fixture ger inte K06:s Admin → Neon → privat Blob-acceptans. Skapa inga nya SQLitefixtures eller lokala produktregister och använd inga verkliga användarkonton. Molnacceptans följer samma QA-gräns som ovan.

Den explicita `tools/run-shared-room-k04-qa.mjs` startar ordinarie spelserver med
en verifierad lokal testanslutning. Normal serverstart behåller TLS-/Neon-grindarna.
Inga miljöflaggor eller HTTP-anrop kan registrera QA-capabilityn. Detta är en
tillfällig provväg, inte ett lokalt produktregister eller produktionsläge.

Förbered en ägd PostgreSQL-instans som endast lyssnar på literal `127.0.0.1`.
Databasnamnet ska vara `croupier_qa_<id>`, rollen `studio_qa` eller dedikerad
`croupier_qa_<id>`. Rollen måste kunna läsa klusteridentiteten med
`pg_control_system()`; behörigheten tillhör den isolerade provinstallationen.
Ta förväntat system-ID från det ägda klustrets `pg_controldata`, inte från en
okänd anslutning. Produkt-/Studio-schema och korrekta migrationsmarkörer måste
redan finnas. Launchern installerar eller seedar ingenting.

Sju explicita argument krävs (värdena nedan är platshållare):

```text
node tools/run-shared-room-k04-qa.mjs --postgres-port <PGPORT> --database croupier_qa_<id> --role studio_qa --system-id <SYSTEM_ID> --http-port <HTTPPORT> --fixture <lokal-fixture.mjs> --media-root <lokal-mediakatalog>
```

Kör från en ren lokal miljö utan produktions-/provider-/molncredentials eller
injektionsinställningar för Node/proxy. Launchern skapar ett separat barn med
endast godkända OS-variabler och explicita lokala inställningar. Spelserverns
publicorigin/listener blir `http://127.0.0.1:<HTTPPORT>`; använd fixturepaketets
befintliga sparade rumslänk. Inga värdnamnsalias eller TLS-attrapper behövs.

Den generella rootfixturen är `test/fixtures/k04-shared-room-runtime.mjs`.
Ange dess absoluta sökväg som `--fixture`. Den exporterar
`createQaFixture({pool,scope,origin,mediaRoot})` och
returnerar `{studioPolicyRuntime,studioMediaRuntime,privateMedia}`.
Scope är `{environment:'test',workspaceId:'shared-qa-<id>'}`.
Återanvänd faktisk scoped SQLrepository/saved-policy och befintliga mediekontrakt.
De sju medieportarna är videoRegistry, videoResponse, videoRegistryCaptured,
videoResponseCaptured, publicMediaResponse, hasPublicMedia och readMetadata.
privateMedia returnerar hash-/identitets-/range-kontrollerad Response för exakt
befintligt material. Fixtureporten är skrivskyddad; testdata ska förberedas i den
ägda provdatabasen före start. Bevara dealer-/rum-/paket-/material-ID, språk,
timing och talgodkännande; media och privata manifests hålls utanför Git.

Faktisk DB-identitet kontrolleras före fixtureimport och åter före engångsstart.
Produkt-/Studio-readiness och saved-policy ska passera innan lyssnaren öppnas.
Ctrl+C använder befintlig graceful shutdown genom det ägda barnet. Tvångsstopp
eller ofullständig cleanup får inte rapporteras som lyckad acceptans.

Root äger QA-starten och den generella lokala fixturen; Kevin tillför befintligt
exakt media-/paketunderlag och de tre K04-proven. I mediaRoot krävs ett privat
UTF-8-manifest `k04-qa-media.json` (max 4 MiB). Formatet beskrivs i fixturens
JSDoc: schemaVersion1, exakt scope/origin samt files med relativePath, storage
(provider/pathname/SHA256/size/contentType) och source. Source anger antingen
befintligt SQL-media-ID/revision eller katalogens logicalPath/revision. Manifestet
registrerar inga dealers, paket, kalibreringar, klassificeringar eller talgodkännanden.
Delmängder tillåts; omappade identiteter är otillgängliga.

Varje lokal fil måste vara vanlig, utan länkar och inom verifierad rot. Exakt
storlek och SHA256 kontrolleras vid start och varje svar från samma öppnade fil;
96 MiB per fil motsvarar browserns bytebudget. GET/HEAD/range/ETag, abort och
loopbackorigin kontrolleras. Inget uppladdnings- eller Blobcredential krävs.
Konstruktionsinjektionen i de tre neutrala mediefabrikerna ändrar inte ordinarie
produktionsdefaults och kan inte väljas genom request/options/env. Faktisk
scoped repository och saved-policy används; fixturestart skapar inga SQL-objekt
eller rader. Kontextens18 enhetsprov,5 verkliga PG-identitetsprov och fixturens
11 prov med syntetiska bytes/instrumenterad SQLpool är separata från full
serverstart, verklig PG-/K04-mediaacceptans. Saknat underlag får inte ersättas
med nya dealers eller påhittade godkännanden.

## Förberedd schemaåtgärd 008 → 009 → 010 — inte godkänd för körning

Detta är ett granskningsunderlag för den befintliga speldatabasen. Det ger inget
mandat för produktions-DDL, merge, deploy eller aktivering och skapar ingen betald
resurs eller stagingmiljö. På en redan installerad produktbas ska
`product-schema.sql` inte köras igen; endast tilläggen 008 → 009 → 010 förbereds.

Read-only metadata verifierades 22 oktober 2026 för Neonprojekt
`wandering-hill-60561912`, gren `br-flat-fog-b161a6r8`, compute
`ep-fragrant-meadow-b1qzb0qv`: PostgreSQL 18.6, databas och roll `croupier_game`,
med `croupier_game` som schema- och tabellägare. Där fanns sex spelare,
`invalidbalance=0`, och samtliga objekt för 008/009/010 saknades. Installerad
`product-v1` har checksumma
`831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a`.
Detta är daterad metadata; identitet och förutsättningar måste läsas om inför en
framtida uttryckligen godkänd åtgärd. PITR-retention sex timmar är metadata,
inte bevis på en fungerande återställning eller en återställningsgaranti.

Offlineverktyget `tools/prepare-shared-schema.mjs` är implementerat. Dess API är
`prepareSharedSchema({expectedDatabase,expectedRole,minimumServerMajor=18})`
och returnerar `{sql,manifest}` utan databasanslutning. CLI-kontraktet är
`node tools/prepare-shared-schema.mjs --database croupier_game --role croupier_game --sql`;
det skriver SQL till stdout och applicerar ingenting. Exportens SQL, manifest,
verktygsrevision och LF-normaliserade källhashar ska frysas och granskas ihop.
Hasharna för produktbasen och tilläggen finns i tabellen ovan.

Den förberedda SQL-filen ska ha följande spärrar och ordning:

1. En yttersta transaktion omfattar förkontroller, 008 → 009 → 010 och
   efterkontroller. Kontrollera explicit databas, roll, serverns majorversion
   (minst 18), schema-/tabellägare och installerad `product-v1`-checksumma.
   Verktyget ska neka ändrade källhashar och annan målidentitet.
2. Kräv en helt oinstallerad uppsättning tillägg: alla shared-objekt samt nya
   kolumner `players.wallet_gen`, `transactions.source_key` och
   `transactions.source_fingerprint` ska saknas. Partiellt eller redan
   installerat schema ska nekas, även där käll-DDL använder `IF NOT EXISTS`.
   Detta är ingen reparations- eller omkörningsprocedur.
3. Ta exklusiva lås på `croupier_game.players` och
   `croupier_game.transactions` innan förkontrollerna används för DDL.
   Använd `lock_timeout=2s`, `statement_timeout=30s` och
   `idle_in_transaction_session_timeout=10s`; låsväntan ska avbryta, inte vänta
   obegränsat på en aktiv walletwriter. 30s gäller per statement, inte total
   transaktionstid. Behåll låsen genom commit.
4. Applicera endast den hashbundna käll-DDL:n i ordningen 008 → 009 → 010.
   Lägg inte till journal-/ledgerposter eller andra DML-writes. Kontrollera före
   commit skapad struktur, ägare, triggers, index och att nya tabeller är tomma.

Fel före commit ska återställa hela transaktionen atomiskt, inklusive tidigare
DDL i samma fil. Efter commit finns ingen blind DOWN-väg: bevara tillagda
objekt och data. En kodrollback tar inte bort schema eller återställer walletdata.
En separat plan för stopp/drain, kompatibel kodåtergång och eventuell
schemaåterställning måste vara granskad före aktivering; PITR-metadata ersätter
inte den planen.

Kört isolerat: slutliga `node tools/run-shared-table-qa.mjs --schema-upgrade
--download-postgres` gav **10/10**, Node22.22/PostgreSQL16.15, `clusterStopped:true`.
Proven täcker befolkad produktbas, fel mål/checksumma/saldo/partiellt schema,
verklig låsväntan, rollback mitt i DDL, framgång med oförändrade äldre data,
legacy receipt/replay/ny debit, separat begränsad roll och nekad återapplicering.
Metadataanslutningen använde tabellägaren croupier_game. Det bevisar inte vilken
credential/roll den driftsatta servern faktiskt använder. Den separata provrollen
verifierar endast äldre debit/replay med SELECT-grants på två guardtabeller,
inte fulla shared-runtimebehörigheter.
Privat slutkvitto: denna chatts `recovery-replay/shared-schema-upgrade/final-cli/manifest.json`.
Samma avgränsade CLI är registrerad i ordinarie CI. Offlinehelperns tre prov och
oberoende källgranskning är gröna; detta är förberedelse, inte produktionsacceptans.

Samma frysta63c-kod är därefter körd på faktisk PostgreSQL18.6:10/10, exit0,
clusterStopped:true och port35437 ECONNREFUSED. Befintligt --postgres-bin användes
utan runnerändring;11källkopior/27artifacthashar oberoende verifierade. Privat
recovery-pg18-schema/manifest.json visar signaturer, versions-/binärhashar och
städning. Provets minimum-major16 behölls men faktisk motor var18.6.

### Runtimebehörigheter och operativ återställning

Före DDL ska den faktiska deploymentanslutningen bindas till ovanstående
provider/projekt/branch/databas utan att exponera credentials. Läs current_user,
session_user och current_database via just den anslutningen. Kontrollera effektiva
schema-/tabell-/kolumnprivilegier, rollmedlemskap, RLS och DDL-ägarens globala samt
schemavisa defaultACL. Ägarens godkända anslutning eller SET ROLE ersätter inte
denna proveniens. Privat granskningsunderlag: denna chatts
schema-runtime-preflight/runtime-preflight.sql och operations.md; endast
katalogfrågor, inga produktdata eller skrivningar. Saknade 008–010-objekt före
migrering är förväntade och får inte räknas som godkänd efterkontroll.

Shared-runtime behöver utöver SELECT: INSERT/UPDATE/DELETE för reservationer,
INSERT/DELETE för öppna händer, INSERT/UPDATE för rum/medlemmar/presence/pauser/
skor/outbox/delivery/receiver och INSERT för receipts/ticks/audit. Befintliga
players behöver UPDATE och transactions INSERT. Publiceringsvägens configwrites
bedöms separat. Authens FOR SHARE kräver SELECT och UPDATE-privilegium på minst
en kolumn i varje låst tabell. Triggerfunktionerna kör med anroparens privilegier.
Matrisen ersätter inte övriga serverfunktioners befintliga behörighetskrav.

Återställningsförfarandet ska granskas separat från schemafilen:

1. Identifiera och stoppa/dränera samtliga writers till målgrenen, inklusive
   Render, Vercel/API, bakgrundsjobb och gamla klienter. Ingen driftåtgärd utförs
   som del av detta förberedelsearbete.
2. Frys målidentitet, kodrevision och en verifierad backup efter dränering.
   Välj i förväg ett separat tomt restoremål och explicit roll-/ägarmappning.
   PostgreSQL pg_dump sparar inte globala roller. Befintliga
   tools/postgres-backup-restore.mjs accepterar bara äldre tabelluppsättning och
   sparar inte roller/ACL; det är inte en återställningsväg för 008–010.
3. Prova pg_dump --format=custom och pg_restore --single-transaction
   --exit-on-error mot det isolerade målet. Verifiera samtliga tabeller, ledger,
   balanser, reservationer, receipts, sekvenser, objektägare och ACL samt verkligt
   replay efter ny anslutning. Privata syntetiska prov bevisar verktygsvägen,
   inte produktionsbackupens innehåll, Neon-PITR eller operativ återställningstid.
4. Vid misslyckande före COMMIT ska schemafilens transaktion rulla tillbaka.
   Efter COMMIT behåll tillagda objekt. Återgång till kompatibel kod kräver ett
   eget beslut; skriv aldrig över nya wallettransaktioner med en äldre backup.
5. Produktionens backup/restore, DDL och återöppning kräver sina uttryckliga
   beslut. Kör inga blinda retries mot partiellt schema eller okänd målidentitet.

Faktisk runtimeidentitet kan ännu inte läsas via tillgänglig Render-anslutning
(miljövariabelläsning saknas); lokal browser use är avstängd. Renders Frankfurt-
värdnyckel har verifierats mot [officiell SSH-dokumentation](https://render.com/docs/ssh)
i en separat privat known-hosts-fil med fortsatt StrictHostKeyChecking=yes.
Inloggningen nekades därefter med Permission denied (publickey). Ingen ny nyckel
registrerades och inga anslutningsskydd eller globala inställningar ändrades.

Det syntetiska återställningsprovet är nu genomfört på PostgreSQL18.6/Node22.22:
8/8, exakt paritet för 47 tabeller och fyra sekvenser, inklusive ledger, saldo,
reservationer, receipts, objektägare och ACL. Ny anslutning och replay gav ingen
dubbel effekt; obehörig restore/läsning/skrivning nekades. Preflightens elva
katalogfrågor kördes READ ONLY både före 008 och efter restore. Första försöket
föll på provets NUMERIC-textjämförelse (1247.00/1247); bara den jämförelsen rättades
och granskades före slutprovet. Privat recovery-shared-restore/manifest.json och
probe.log innehåller båda försöken, frysta källhashar och slutbevis. PID608 borta,
port36911 ECONNREFUSED; ägda databaser/roller/pooler/kluster/binärer borttagna.
Roller förskapades i klustret; detta är inte globals-restore, Neon/PITR,
produktionsbackup, full serverstart eller K04-mediaacceptans.

Röda grindar: faktisk runtimeidentitet/ACL, operativ återställningsberedskap och
uttryckligt produktions-DDL-mandat. Game-schemagrinden inför merge/aktivering
förblir blockerad tills kraven är uppfyllda; grön Studio-CI eller offlinegenererad
SQL räcker inte.

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
| Pensionerad native-P6-kampanj | Aktiveringsverktyg, privat SDK-bootstrap, router och klientkoppling är avvecklade. Återställ inte dessa för produktstart eller ny molnacceptans. Eventuella äldre privata manifest, journaler och kostnadskvitton är historiskt återställningsunderlag, inte aktiva appberoenden; denna kodleverans raderar inga sådana data. |
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
Checkouten har inget lokalt produktregister: Neon är registret och Blob
mediebyte. Fixturen skriver bara i sin tillfälliga mapp, och sessionsvakten
ligger i OS-tempkatalogen. `tools/backup-lab-state.mjs` och
`tools/migrate-lab-state.mjs` togs bort 22 oktober 2026; äldre privata kopior
ligger kvar utanför Git.
Anslutningsverktygens standardordning är rotens `.env`, äldre `lab/.env.*`,
nya `apps/studio/.env.*` och sist processmiljön. Cloud storage kräver samma
uttryckliga opt-in; ett explicit `envFiles` ersätter standardlistan.

Den 2 oktober flyttades 39 privata filer (4 568 960 byte) utan överskrivning
från den tidigare katalogen till labbet. Hela gamla katalogen, 42 filer, finns i en separat
hashverifierad privat kopia: `C:\Users\jakem\CroupierBackups\lab-consolidation-20261002`.
`lissabon/` är därefter borttagen. Projektets bytes och historik bevarades;
den gamla sessionsvakten ersattes med `lab/data/.local-session.sqlite`.

Äldre checkouter flyttas inte längre in i repot: Neon-/Blob-flytten är
genomförd och flyttverktyget är borttaget. Återskapa inte `lab/data`.

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

Neon-verktyg: `tools/postgres-backup-restore.mjs` verifierar full
rad-/sekvensparitet och vägrar zon-databas och import med aktiv extern wallet.
SQLite-importverktyget togs bort efter genomförd flytt.
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
