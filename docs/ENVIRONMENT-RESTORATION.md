# Backup och återställning

Hur produktens data skyddas och hur man går tillbaka, för den enda produktvägen Vercel + Render + Neon + Blob. Identiteter står i [START-HERE](../START-HERE.md#identiteter), miljövariabler i [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md), driften i [CLOUD-MIGRATION](CLOUD-MIGRATION.md) och [RENDER-V3](../ops/cloud/RENDER-V3.md).

Allt här som rör produktionen (backup, restore, DDL, stopp av tjänster, radering, flaggor) kräver Jakobs uttryckliga beslut. Agenter läser, provar i preview och förbereder. Stående undantag: orkestratorn deployar `croupier-v3` med låst SHA efter grön main-CI (Jakob 2026-10-28).

## Vad som ska skyddas

| Data | Var | Skydd |
| --- | --- | --- |
| Konton, saldo, ledger, spel | Neon `croupier_game`, scheman `croupier_auth`, `croupier_game` | Backupgren före varje schemaändring och `pg_dump` enligt nedan; aldrig äldre backup över nyare plånbokstransaktioner |
| Admin-data: dealers, bolag, rum, mallar, paket, spelinställningar, mediekatalog, talrepliker | Neon, schema `croupier_studio` | Samma backup; publicerade paket är frysta och ändras aldrig |
| Mediebytes (original, banker, tagningar) | Privat Blob `croupier-media-private` | Original raderas inte; Git är ingen backup av molnmedia |
| Director-katalog och historik | Render-disk `/data/catalog` på `croupier-lab-director` | `tools/backup-render-state.mjs --profile director` |
| Gateway-konfiguration och sessioner | Render-disk `/data/openclaw` på `croupier-lab-openclaw` | `tools/backup-render-state.mjs --profile gateway` |
| Kod | GitHub `Jakeminator123/scoutgaming`, `main` | Ordinarie PR/CI; ingen force-push |
| Hemligheter | Vercel/Render-panelerna, GitHub secrets, gitignorerad `.env.local` | Aldrig i Git, chatt eller dokument |

Spelmotorn `croupier-v3` har ingen disk. Inget lokalt register, ingen SQLite-fil och ingen repo-JSON är en reservkälla för produktionen.

## Återställ den samlade produkten

Kodåtergång, när en deploy är fel:

1. Frys läget: aktuell `main`-SHA, Vercels produktionsdeploy (`dpl_…` och dess commit) och spelmotorns `GET https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. Grön CI bevisar inte att båda kör samma version.
2. Välj en granskad tidigare SHA och kontrollera att den förstår installerat Neon-schema, frysta paket och sparade medieformat. Schema går inte tillbaka med koden.
3. Spelmotorn: deploya SHA:n låst med Render REST, `POST /v1/services/srv-dbd6nfon74is73aiblf0/deploys` med `{"commitId":"<40 hex>"}`. Render MCP `trigger_deploy` tar branchens senaste commit och duger inte för återgång. Vercel: befordra en tidigare READY-deploy (panelens Instant Rollback eller `POST /v10/projects/<prj>/promote/<dpl_…>`); därefter får nya main-deployer inte produktionsdomänerna förrän en deploy befordras igen. Den varaktiga återgången är en revert-PR med full CI. Director och Gateway deployas bara om deras kod ändrats.
4. Läs om `/__cloud/version`, `/__cloud/health` och det berörda flödet (med delat bord på: en spelad hand, eftersom `/__cloud/shared-room-health` inte är publikt nåbar): Admin → publicering → lobby → spel. Render låter den gamla instansen svara i ungefär tre minuter efter bytet; mät först när versionen är stabil.

**Deploy med delat bord på (F11).** Under Render-överlappet får spelare på den gamla instansen inga ögonblicksbilder från bordet och missar dealerns spel tills anslutningen stängs med 1012. Tills rättningen är mergad deployas `croupier-v3` bara när bordet är tomt: `SELECT count(*) FROM croupier_game.shared_table_members WHERE active` och `SELECT count(*) FROM croupier_game.shared_wallet_reservations` ska båda vara 0, annars vänta en runda.

**Delat bord av.** `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen sedan 2026-10-28 13:52Z (deploy `dep-dbgvsc5g1s2s73cdoqkg` på `5f5bc88d`, live 13:53:25Z; bordet var tomt före). Återgång till nativebordet: kontrollera att bordet är tomt enligt ovan, sätt flaggan till `0` med REST (`PUT /v1/services/<srv>/env-vars/<nyckel>` startar ingen deploy) och deploya samma SHA låst. Reservationer som ändå står kvar ligger kvar i Neon tills flaggan slås på igen; de raderas aldrig för hand. Jakob har förgodkänt återgången flagga av och låst deploy av `3415c310` (D7, 2026-10-28).

Återställ inte gamla env-filer, gamla tjänster eller domänkopplingar som del av en kodåtergång. `croupier-v2` och `croupier-vercel-preview-qa` är raderade; det finns ingen äldre motor att gå tillbaka till. En ändrad miljövariabel, databasbehörighet eller talflagga har sin egen återgång och följer inte med koden. Render MCP:s env-skrivning sammanfogar nycklar och startar en deploy direkt.

## Neon: backup och restore

**Backupgren före varje schemaändring i produktionen.** En Neon-gren från `main` är en omedelbar, fullständig kopia av alla databaser. Den skapas med Jakobs go före varje DDL, namnges `backup-<syfte>-<datum>` och raderas av Jakob tidigast en vecka efter ändringen. Hittills: `backup-before-008-010-20261027` (`br-round-wind-b120esv6`, 17:41:31Z), `backup-ren-start-20261028` (`br-morning-scene-b1a0ykzk`), `backup-before-o03-20261028` (`br-winter-sunset-b1dnm0kb`, LSN `0/2F1E6850`, 13:08:33Z) och `backup-api-key-operator-20261029` (`br-soft-river-b1h1g7wn`, 01:45:14Z). Projektets historik räcker sex timmar bakåt; inom det fönstret kan `main` också återställas till en tidpunkt (PITR). En grenåterställning skriver över allt efter tidpunkten, även plånbokstransaktioner, och används bara om ingen har spelat efter felet. PITR är inte provad.

**`pg_dump` mot ett tomt mål** är den portabla vägen. Provad mot produktionens migrerade schema 28 oktober 2026: dump av backupgrenen och restore till databasen `croupier_restore_o03` på grenen `o03-restore-proof`, med identisk ögonblicksbild (S0 = S1), samma ledger och readiness och lika ägare och ACL på 94 objekt (O03-kvittot, blocket `backup`; kvittot är raderat och läses ur Git, se [HISTORIK](HISTORIK.md)). Tidigare prov: preview 25 oktober och O02:s restore-replay 28 oktober.

1. **Stoppa skrivare vid en verklig återställning:** spelmotorn, Vercel-API:erna och bakgrundsjobb, med Jakobs beslut och ett avtalat fönster. Ett restoreprov behöver inget stopp: dumpa då från en ny backupgren, som ingen skriver till.
2. **Frys identiteten:** projekt, gren, endpoint, databas, roll och kodens SHA. `node tools/check-migration-readiness.mjs` (utan `--apply`) visar båda migreringsledgrarna (`studio-NNN` och `game-NNN`, se nedan).
3. **Dumpa** med PostgreSQL-klient 18 (servern kör 18.6) mot Neons direkta endpoint, värdnamnet utan `-pooler`, som `croupier_game`:
   ```sh
   pg_dump --format=custom --file <privat-katalog>/croupier_game.dump "<direkt anslutning, sslmode=verify-full>"
   ```
   På Windows saknar libpq en användbar CA-kedja: sätt `PGSSLROOTCERT` till Gits `C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt`. Dumpen och dess SHA-256 sparas utanför Git och repot.
4. **Skapa ett tomt mål**, aldrig över källan: en ny databas ägd av `croupier_game`, på en gren i samma Neon-projekt (rollerna och deras lösenord följer med grenen). I ett annat projekt skapas rollerna först; `pg_dump` sparar inga roller.
5. **Återställ utan Neons egna standardrättigheter.** Neon skapar `ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin` själv i varje ny databas, och `croupier_game` är inte medlem i `cloud_admin`, så de två posterna skulle avbryta transaktionen:
   ```sh
   pg_restore --list <dump> | grep -v -E 'DEFAULT ACL [^ ]+ DEFAULT PRIVILEGES FOR [A-Z]+ cloud_admin$' > <privat-katalog>/restore.list
   pg_restore --single-transaction --exit-on-error --no-owner --role=croupier_game --use-list <privat-katalog>/restore.list --dbname "<tomt mål>" <dump>
   ```
   Tillägget `pg_stat_statements` i schemat `croupier_game` återskapas av `croupier_game` utan fel.
6. **Efterled som `neondb_owner`.** I produktionen ägs `croupier_studio.moving_drift_control` av `neondb_owner` (migrering 016), med `SELECT, INSERT, UPDATE` för `croupier_game`. `--no-owner` gör `croupier_game` till ägare, så återställ ägaren: `ALTER TABLE croupier_studio.moving_drift_control OWNER TO neondb_owner; GRANT SELECT, INSERT, UPDATE ON croupier_studio.moving_drift_control TO croupier_game;`. Alternativet är restore som `neondb_owner` utan `--no-owner`.
7. **Databasens egna rättigheter följer inte med dumpen.** Produktionens `croupier_game` låter `PUBLIC` och `kevin_migration_readonly` ansluta. Ett mål som ska ersätta produktionen får samma `GRANT CONNECT` uttryckligen; ett provmål hålls snävare (bara `croupier_game`).
8. **Verifiera.** `node tools/o02-snapshot.mjs --url-file <källa> --out s0.json`, samma mot målet till `s1.json`, sedan `node tools/o02-snapshot.mjs --compare s0.json s1.json` (exit 0: radantal, innehållshash per tabell och sekvenser lika). Därtill båda migreringsledgrarna, readiness mot målet och ägare och ACL, med samma fråga mot källa och mål:
   ```sql
   SELECT n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner, c.relacl::text
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('croupier_game','croupier_studio','croupier_auth','public') AND c.relkind IN ('r','p','S','v','m')
   ORDER BY n.nspname::text COLLATE "C", c.relname::text COLLATE "C";
   ```
   Kör aldrig om en restore blint mot ett mål som redan fyllts.

Efter en restore eller PITR återöppnas inga rum och inget tal aktiveras automatiskt. Schemaändringar är framåtriktade: det finns ingen DOWN-migrering. Fel före COMMIT rullar tillbaka hela transaktionen; efter COMMIT behålls objekten och återgång sker med kompatibel kod. Ordningen är tolerant kod → godkänd migrering → kravhöjning ([AGENTS.md](../AGENTS.md#verifiering-och-säkerhet)).

### Två migreringsledgrar

Databasen har två ledgrar med olika format och egna nummer. Spelets 011 och 012 är andra migreringar än Studios 011 och 012, så `node tools/check-migration-readiness.mjs` läser båda och skriver dem i samma rad som `studio-NNN` och `game-NNN` (till exempel `studio-012` och `game-012`). En obligatorisk version som saknas i någon av dem ger exit 1 och blockerar CI; en ändrad checksumma eller en okänd version ger exit 2. `--apply`, `--only` och `--skip` gäller bara Studios versioner och tar Studios nakna nummer (`--only 021`); stderr-raderna (`migration_apply_plan`, vägran) namnger dem `studio-NNN`.

| Ledger | Format | Register och skrivare |
| --- | --- | --- |
| Studio `croupier_studio.storage_migrations` | `version` (`001`–`021`), `checksum`, `structure_checksum`, `applied_at` | `ops/neon-studio/migrations.mjs`; `node tools/check-migration-readiness.mjs --apply` skriver raden |
| Spel `croupier_game.storage_migrations` | `version` (`product-v1`, `sqlite-import-v1`, `game-0NN-<namn>`), `checksum` (sha256 av källfilen med LF), `source_hashes` (evidens som JSON), `applied_at` (TEXT) | `ops/neon-game/migrations.mjs`; varje `ops/neon-game/0NN-*.sql` registreras där i samma PR och mergas till `main` innan den körs. Raden skrivs av den granskade transaktionen själv (`tools/prepare-*.mjs`). Motorn och Studio kontrollerar bara `product-v1`:s checksumma vid start |

Spelversionerna 006–013 är valfria i readiness tills en PR gör dem obligatoriska (012 med PR C i [NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md)). 006–010 blir obligatoriska i en uppföljande PR när 013 är körd i produktionen och readiness där visar `game-006`–`game-010` bland `applied`.

**Efterhandsrader för 006–010 (`013-ledger-backfill.sql`).** 006 och 007 applicerades för hand innan spelversioner fick ledgerrader, och `tools/prepare-shared-schema.mjs` skriver ingen ledgerrad, så de syntes bara i katalogen. 013 skriver `game-006-player-profile`, `game-007-roulette-tables`, `game-008-shared-wallet`, `game-009-shared-blackjack` och `game-010-presentation-receiver` med filernas checksummor och respektive appliceringsdag, plus sin egen rad `game-013-ledger-backfill`. Den är bara DML i ledgern, kontrollerar först med en egen kontroll per version att 006:s kolumner och kontrollvillkor, 007:s tabell med primärnyckel och spelarreferens och 008–010:s 15 tabeller, index, funktioner, triggrar och kolumner finns (annars avbryts den utan skrivning) och är idempotent: en andra körning ändrar inget, och en befintlig rad med annan checksumma nekar hela transaktionen. Datumet för 008–010 i produktionen är 27 oktober 2026 (`git show 29ed6626bf:docs/history/ENVIRONMENT-RESTORATION-2026-10.md`, "Uppdatering 27 oktober 2026", efter backupgrenen `backup-before-008-010-20261027` 17:41:31Z); klockslaget är okänt. För 006 och 007 finns inget antecknat appliceringsdatum; datumen nedan är filernas första commit i Git (006: `d5e3ffd5` 8 oktober 2026, 007: `15aa3192` 27 oktober 2026) och är osäkra. Verktyget ansluter aldrig till databasen; Jakob kör som `croupier_game` mot den direkta endpointen:

```sh
node tools/prepare-ledger-backfill.mjs --database croupier_game --role croupier_game --applied-on-006 2026-10-08 --applied-on-007 2026-10-27 --applied-on 2026-10-27 --readiness-sql > <privat-katalog>/013-readiness.sql
node tools/prepare-ledger-backfill.mjs --database croupier_game --role croupier_game --applied-on-006 2026-10-08 --applied-on-007 2026-10-27 --applied-on 2026-10-27 --sql > <privat-katalog>/013.sql
psql "<direkt anslutning som croupier_game, sslmode=verify-full>" -X -v ON_ERROR_STOP=1 -f <privat-katalog>/013-readiness.sql
psql "<direkt anslutning som croupier_game, sslmode=verify-full>" -X -v ON_ERROR_STOP=1 -f <privat-katalog>/013.sql
node tools/check-migration-readiness.mjs
```

Förkontrollen slutar med ROLLBACK. Efter körningen visar readiness `game-006`–`game-010` och `game-013` bland `applied`. Preview fick 006–010 andra datum och körs inte med produktionens.

### Migrerat schema i produktionen

Läst 28 oktober 2026 före O03 och 14:21Z efter 011, och 29 oktober 2026 efter 012. Projekt `croupier-production` `wandering-hill-60561912`, gren `br-flat-fog-b161a6r8`, endpoint `ep-fragrant-meadow-b1qzb0qv`, databas `croupier_game`, PostgreSQL 18.6.

| Del | Läge | Verktyg |
| --- | --- | --- |
| Studio-ledger `croupier_studio.storage_migrations` | 18 versioner: 001–008 och 011–020 (009 och 010 finns inte); 021 är inte körd. Readiness `ready:true`, inga obligatoriska väntande | `node tools/check-migration-readiness.mjs`; `--apply` med `CROUPIER_MIGRATION_CONFIRM=apply-pending` bara i Jakobs terminal |
| Spel-ledger `croupier_game.storage_migrations` | `product-v1` och `sqlite-import-v1` (checksumman i `ops/neon-game/product-schema.sql`), sedan O03 `game-011-retire-lissabon` (2026-10-28 14:21:48Z) och `game-012-api-key-operator` (2026-10-29 01:46:30Z, efter backupgrenen `backup-api-key-operator-20261029`): `api_keys.operator_id` är `NOT NULL` med index och oföränderlighetstrigger. Samma checksummor som filerna i `ops/neon-game` | Motorn och Studio kontrollerar `product-v1`:s checksumma vid start; readiness läser hela ledgern |
| Delat bord 008–010 | Applicerade 27 oktober utan ledgerrad; 15 tabeller `croupier_game.shared_*`. Efterhandsraderna skrivs med 013 ovan | `tools/prepare-shared-schema.mjs` skriver granskad SQL, applicerar inget |
| Katalog | 74 tabeller efter 011 (`croupier_auth` 7, `croupier_game` 39, `croupier_studio` 28; 76 före), 4 sekvenser, 2 vyer | `tools/o02-snapshot.mjs` |
| Tillägg | `pg_stat_statements` i schemat `croupier_game` (de två vyerna är dess), ägt av `croupier_game`; `plpgsql` | Flyttas eller tas bort efter O03 |
| Roller | `croupier_game` äger databasen, schemana och alla tabeller utom `moving_drift_control` och är runtime-roll för motorn och Vercel. `kevin_migration_readonly` läser. `neondb_owner` är Neons standardroll. `croupier_game_qa` och `croupier_studio_qa_abc92154cb15` är kvarlämnade QA-roller som tas bort efter O03 | Inventeras före restore i ett annat projekt |

Previews schema skiljer sig (Studio 15 versioner utan de valfria 016, 018 och 019, spel-ledgern bara `product-v1` och `game-012-api-key-operator`; 011 är inte körd där). Ett restoreprov där bevisar inte produktionens schema; det görs på en gren i produktionsprojektet.

## Lissabon-kontraktion (J09, `011-retire-lissabon.sql`)

`ops/neon-game/011-retire-lissabon.sql` tar bort de tomma tabellerna `lissabon_profiles` och `lissabon_profile_sessions` och skriver ledgerraden `game-011-retire-lissabon`. Ingen kod läser eller skriver tabellerna. Den ingår inte i startup eller deploykrav. I O03 kördes den 2026-10-28 av orkestratorn med Jakobs uttryckliga ja, utan skrivarstopp (D1), efter backupgrenen och restoreprovet ovan: förkontrollen ca 14:19Z (exit 0, ROLLBACK), sedan transaktionen (exit 0, COMMIT, ledgerraden 14:21:48Z). Efteråt finns lissabon-tabellerna inte, katalogen har 74 tabeller och `/__cloud/health` svarar 200. SQL, manifest och evidens står med hashar i O03-kvittot (raderat, se [HISTORIK](HISTORIK.md)), blocket `ddl`.

`node tools/prepare-lissabon-retirement.mjs --evidence <privat-json>` bygger manifestet offline (`--readiness-sql` för förkontroller med ROLLBACK, `--sql` för hela transaktionen); verktyget ansluter aldrig till databasen. Evidensfilen binder `database`, `role`, `releaseSha`, `rollbackSha`, `consumerInventorySha256`, `backupSha256` och `restoreReceiptSha256`. Rollen måste vara schemaägaren `croupier_game`, och inga händelsetriggers får finnas. Förkontrollerna nekar fel ägare, ändrad produktchecksumma, icke-tomma tabeller och okända beroenden; låsen hålls genom transaktionen med `lock_timeout` 2 s. `DROP` låser `croupier_game.players` kort för de främmande nycklarnas triggrar, så spelarfrågor väntar högst två sekunder eller så avbryts transaktionen utan ändring. CI provar vägen med `node tools/run-shared-table-qa.mjs --lissabon-retirement --postgres-bin /usr/lib/postgresql/16/bin`.

Återgång behövs inte. Skulle en okänd konsument dyka upp återskapas tabellerna framåt ur `product-schema.sql` och ledgerraden tas bort, i en transaktion och med Jakobs beslut.

**BO-tabellerna står kvar** (D2, struket ur O03). `croupier_game.bo_game_handoffs`, `croupier_auth.bo_lab_handoffs` och `croupier_auth.lab_sessions` har konsumenter: Admin raderar handoffrader när en spelare spärras, stängs eller får nytt lösenord och när personal ändras, och `lab_sessions` lagrar partnerportalens sessioner. Avvecklingen kräver först en kodändring utan konsumenterna, sedan en egen spelmigrering i samma form som 011; `lab_sessions` behålls.

## Blob och media

- Neon äger identiteter och bindningar, Blob äger bytes. Lagringsgränsen och sökvägarna står i [BLOB-NEON](storage/BLOB-NEON.md).
- Original raderas inte som bieffekt av import eller papperskorg. Permanent radering går genom Admins beroendekontroll och sker sist, efter att originalbytes är bevarade på annat håll.
- En återställd databas pekar på samma Blob-objekt. Kontrollera att objekten finns (HEAD och SHA-256 mot registret) innan rum öppnas igen. Restoreproven omfattar inte Blob.
- Preview har eget Blob-lager `store_7E06N1P4w9Mu1dZD` där godkänt material (bakgrunder, bord, dealerklipp) får finnas, laddat via produktens egna uppladdnings- och publiceringsvägar. Produktionens Blob-token kopieras aldrig dit och inga riktiga spelardata förs över (Jakobs beslut 2026-10-28).

## Media och regression

`media/` i repot är käll- och granskningsmaterial och importunderlag, inte produktens register. `media/layout.json` binder gamla sökvägar, publika URL:er, storlek och hash till dagens filer; `media/blob-index.json` listar Blob-sökvägarna `croupier/media/<logisk-katalog>/<id>/<sha256>.<ext>`.

Varje talad replik är ett paket: exakt text, ljud, video, frameindex, kalibrering och mänskligt godkännande. Ny ljud- eller videohash ogiltigförklarar tidigare godkännande. Bygg ersättningstagningar i separat staging och kringgå aldrig `tools/media/build-index.mjs`:s skydd genom att radera kalibreringsmetadata. Hash, vågform, testpass eller första munrörelse godkänner inte läppsynk; det gör Jakob. Uppspelningskontrakten står i [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md).

## Director och Gateway

`tools/backup-render-state.mjs` har profilerna `director` och `gateway` och kopierar diskens filer som exakta bytes med hash före och efter. Den vägrar länkar och specialfiler och kontrollerar att `companion.json` respektive `companion-search.json` är kompletta.

1. Stoppa tjänstens skrivare (suspendera tjänsten). `--quiesced yes` är din försäkran, inte en mätning.
2. Ta snapshoten och flytta den till en privat plats utanför Render och Git; `/tmp` i containern är flyktig:
   ```sh
   node tools/backup-render-state.mjs backup --profile director --source /data/catalog --destination <privat-katalog> --quiesced yes
   ```
   Gateway: `--profile gateway --source /data/openclaw`.
3. Restore kräver stoppad tjänst, verifierad snapshot, rätt profil och tom monterad målrot: `node tools/backup-render-state.mjs restore --profile <director|gateway> --snapshot <snapshot> --destination <tom målrot> --quiesced yes`. Director återställs till `/data/catalog`, Gateway till `/data/openclaw`.
4. Verifiera katalogrevision och historik, companion-profilen och att ett sparat sökkvitto återanvänds efter start och ytterligare en omstart.

Konton, saldo och sko återställs alltid från Neon, aldrig från dessa diskar. En extern fullbackup av de två diskarna är ännu inte gjord. Director och Gateway kör `cc415cd8` sedan 27 oktober; O03 deployade dem inte.

## Historiska arkiv

- SQLite-vägen är borttagen ur `main` (steg 1–7). Gamla SQLite-arkiv och product-snapshots läses bara i ett isolerat mål, med verktygen vid Git-SHA `89343a655a6a44dbe2553a83f02294312070dc01` (sista main före borttagningen) eller med `sqlite3`. De återställs aldrig över Neon och blir aldrig en andra skrivare.
- Den avvecklade produktdisken och den första Neon-importen har verifierade externa backuper på Jakobs dator (`CroupierBackups/production-disk-retirement-20261004` och `neon-game-20261002-132437`). De är historiska källor.
- Git-historiken skrevs om en gång 12 oktober 2026 med Jakobs godkännande; originalet finns som verifierad bundle utanför Git. Klona den bara till en separat tom katalog och publicera aldrig gammal historik.

## Byggdelar och Node-versioner

| Källmapp | Ansvar | Node |
| --- | --- | --- |
| `apps/studio/` | Admin, partnerportal, lobby, auth och medie-API (`/studio` är teknisk basePath) | 24.x, Volta 24.21.0 |
| `apps/web/` | Startsida, `/game`, `/play/{game}` och transport till spelmotorn | 24.x, Volta 24.21.0 |
| `apps/speech/` | Talingress (lång WebSocket) | 22.x, Volta 22.23.1 |
| `services/game/` | Spelmotorn: kort, sko, saldo, utbetalningar | ≥22.16; containern kör 24 |
| `services/astrid-gpu-worker/gateway/` | Talrelä och transportkod som spelmotorn importerar | ≥22 |

Volta väljer version efter arbetskatalog: kontrollera `node -p process.version` i paketet innan installation eller test. Installera med låsfilerna: `pnpm install --frozen-lockfile` i `apps/web`, `npm ci` i övriga (`npm ci --ignore-scripts` i `apps/speech`). Lokala pinnar styr inte Vercel eller Docker; de installerar själva från låsfilerna.

Spelarens moduler på www.scoutgaming.tech byggs på Vercel ur `services/game/public` (`apps/web/tools/prepare-platform-ui.mjs`), medan spelets HTML hämtas från motorn. En återgång av bara den ena sidan ger nya moduler mot gammal motor eller tvärtom; kontrollera båda SHA:erna.

## Renklonprov och separata QA-förutsättningar

Ett oberoende prov utgår från en färsk GitHub-klon med egen `.git` och egna låsfilsinstallationer, utan gamla `node_modules`, byggfiler, env-filer eller privata data. Börja med en ren processmiljö (`PATH`, `NODE_OPTIONS`, `NODE_PATH`). Privata data som saknas i Git återställs inte för att få provet grönt.

Kör `node apps/studio/start.mjs --no-open` (skriver lobbyns adress, startar inget), Studio-bygget och testsviterna. Flaggorna `--offline` och `--skip-build` är pensionerade och avvisas; äldre kvitton som nämner dem beskriver historik.

| Behov | Minsta åtgärd |
| --- | --- |
| PostgreSQL-prov | `node tools/studio-isolated-qa.mjs --download-postgres` (Linux/WSL, icke-root) eller `--postgres-bin <bin>`; spelmotorn över HTTP med `node tools/run-engine-qa.mjs --postgres-bin <bin>`. Verktygen skapar och tar bort egna kluster. |
| Modultester utan Postgres | PGlite via `test/fixtures/pglite-pool.mjs`; en session, bevisar inte låsning mellan anslutningar. |
| Webbläsarprov | Playwright och Chrome installeras separat; `CROUPIER_BROWSER_FIXTURE_MODULE` och `CROUPIER_BROWSER_FIXTURE_CHANNEL=chrome`. Överhoppade prov redovisas separat. |
| Riktig acceptans | Preview (syntetiska konton, godkänt material samt Jakobs speglade inloggningar), aldrig produktionen eller Johns Bet. |

En `--single-branch`-klon hämtar bara `main`; lägg till den egna branchen med `git remote set-branches --add origin <branch>` före push.

## Preview

Den tidigare stagingen behålls efter O03 som preview, se [START-HERE](../START-HERE.md#preview). Sedan 2026-10-29 är branchen `preview` källan: Vercel-projektet `scoutgaming-preview` (preview.scoutgaming.tech) deployar den automatiskt och Render-tjänsten `croupier-k06-k07-staging` byggs från den; pre-push-hooken tillåter bara fast-forward av `preview`, så en kodåtergång där görs framåt (revert-commit på `preview`, eller merga in `origin/main` så att `preview` åter följer produktionen), aldrig med force-push. Neon-projektet och Blob-lagret behåller sina staging-namn. Restoremålen `croupier_staging_restore` (25 oktober) och `croupier_staging_restore_o02` (O02) och produktionsgrenarna `backup-before-o03-20261028` och `o03-restore-proof` raderas av Jakob efter O03. Nästa restoreprov görs mot ett nytt tomt mål; produktionsdata kopieras aldrig till preview.

## Daterade kvitton

Rubrikerna finns kvar för länkar från [migrering/](../migrering/STATUS.md). Äldre kvitton raderades ur `main` 28 oktober 2026 och läses med `git show 29ed6626bf:docs/history/ENVIRONMENT-RESTORATION-2026-10.md`. Nya kvitton skrivs som `docs/<datum>-…-ACCEPTANCE.json` och raderas med en rad i [HISTORIK](HISTORIK.md) när aktiviteten är verifierad.

### O03: release och restoreprov mot produktionens schema — 28 oktober

`docs/2026-10-28-O03-RELEASE-ACCEPTANCE.json` (raderat, läses ur Git enligt [HISTORIK](HISTORIK.md)): backupgren, dump och restore (S0 = S1), 011, flaggan, deployer och verifiering i produktionen.

### J05: verifierad runtime och sparat spel — 26 oktober

Omstart i staging och återläst sparat spel.

### Molnsamprov 25 oktober kväll

Admin, publicering, spel, backup och restore i staging.
