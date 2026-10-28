# Backup och återställning

Hur produktens data skyddas och hur man går tillbaka, för den enda produktvägen Vercel + Render + Neon + Blob. Identiteter står i [START-HERE](../START-HERE.md#identiteter), miljövariabler i [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md), driften i [CLOUD-MIGRATION](CLOUD-MIGRATION.md) och [RENDER-V3](../ops/cloud/RENDER-V3.md).

Allt här som rör produktionen (backup, restore, DDL, stopp av tjänster, radering) kräver Jakobs uttryckliga beslut. Agenter läser, provar i staging och förbereder.

## Vad som ska skyddas

| Data | Var | Skydd |
| --- | --- | --- |
| Konton, saldo, ledger, spel | Neon `croupier_game`, scheman `croupier_auth`, `croupier_game` | `pg_dump` enligt nedan; aldrig äldre backup över nyare plånbokstransaktioner |
| Admin-data: dealers, bolag, rum, mallar, paket, spelinställningar, mediekatalog, talrepliker | Neon, schema `croupier_studio` | Samma dump; publicerade paket är frysta och ändras aldrig |
| Mediebytes (original, banker, tagningar) | Privat Blob `croupier-media-private` | Original raderas inte; Git är ingen backup av molnmedia |
| Director-katalog och historik | Render-disk `/data/catalog` på `croupier-lab-director` | `tools/backup-render-state.mjs --profile director` |
| Gateway-konfiguration och sessioner | Render-disk `/data/openclaw` på `croupier-lab-openclaw` | `tools/backup-render-state.mjs --profile gateway` |
| Kod | GitHub `Jakeminator123/scoutgaming`, `main` | Ordinarie PR/CI; ingen force-push |
| Hemligheter | Vercel/Render-panelerna, GitHub secrets, gitignorerad `.env.local` | Aldrig i Git, chatt eller dokument |

Spelmotorn `croupier-v3` har ingen disk. Inget lokalt register, ingen SQLite-fil och ingen repo-JSON är en reservkälla för produktionen.

## Återställ den samlade produkten

Kodåtergång, när en deploy är fel:

1. Frys läget: aktuell `main`-SHA, Vercel-deploy och spelmotorns `GET https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. Grön CI bevisar inte att båda kör samma version.
2. Välj en granskad tidigare SHA och kontrollera att den förstår installerat Neon-schema, frysta paket och sparade medieformat. Schema går inte tillbaka med koden.
3. Gör återgången som vanlig PR (revert) med full CI. Vercel deployar `main` automatiskt; deploya sedan spelmotorn manuellt på samma SHA (Render MCP `trigger_deploy` eller panelen). Director och Gateway deployas bara om deras kod ändrats.
4. Läs om `/__cloud/version`, `/__cloud/health` och det berörda flödet (Admin → publicering → lobby → spel).

Återställ inte gamla env-filer, gamla tjänster eller domänkopplingar som del av en kodåtergång. `croupier-v2` och `croupier-vercel-preview-qa` är raderade; det finns ingen äldre motor att gå tillbaka till. En ändrad miljövariabel, databasbehörighet eller talflagga har sin egen återgång och följer inte med koden. Render MCP:s env-skrivning sammanfogar nycklar och startar en deploy direkt.

## Neon: backup och restore

Vägen är PostgreSQLs egna verktyg mot ett separat, tomt mål. Den är provad i staging (25 oktober 2026: dump efter spel, restore till `croupier_staging_restore`, identisk data i 1 777 objektnycklar och i appens egna läsare).

1. **Stoppa skrivare.** Alla som skriver till grenen: spelmotorn, Vercel-API:erna, bakgrundsjobb. I staging: suspendera Render-tjänsten och pausa Vercel-projektet. I produktionen bara med Jakobs beslut och ett avtalat fönster.
2. **Frys identiteten.** Projekt, gren, endpoint, databas och roll, plus kodens SHA. Läs `node tools/check-migration-readiness.mjs` (utan `--apply`) så att schemaledgern är känd.
3. **Dumpa.**
   ```sh
   pg_dump --format=custom --file <privat-katalog>/croupier_game.dump "<direkt anslutning, sslmode=verify-full>"
   ```
   Använd Neons direkta (icke-poolade) endpoint och PostgreSQL-klient med samma huvudversion som servern (18). Spara dumpen och dess SHA-256 utanför Git och utanför repot.
4. **Inventera roller.** `pg_dump` sparar inte globala roller. Notera ägare, approll och ACL separat och skapa dem i målet före restore.
5. **Återställ till ett tomt mål**, aldrig över källan:
   ```sh
   pg_restore --single-transaction --exit-on-error --dbname "<tomt mål>" <privat-katalog>/croupier_game.dump
   ```
6. **Verifiera.** Tabeller och sekvenser, migreringsledgern (`croupier_studio` och `croupier_game.storage_migrations`), ägare och ACL, saldon och ledger, och att appens läsare (Admin-läsning, spelmotorns schemakontroll) ger samma data. Kör inte om en restore blint mot ett mål som redan fyllts.

Neons tidpunktsåterställning (PITR, branch restore) är leverantörens snabbväg vid en felaktig skrivning. Den är inte provad här och kräver samma stopp av skrivare och Jakobs beslut. Efter en restore eller PITR återöppnas inga rum och inget tal aktiveras automatiskt.

Schemaändringar är framåtriktade: det finns ingen DOWN-migrering. Fel före COMMIT rullar tillbaka hela transaktionen; efter COMMIT behålls objekten och återgång sker med kompatibel kod. Ordningen är tolerant kod → godkänd migrering → kravhöjning ([AGENTS.md](../AGENTS.md#verifiering-och-säkerhet)).

| Schema | Läge 27 oktober 2026 | Verktyg |
| --- | --- | --- |
| Spel `ops/neon-game/` | `product-schema.sql` (`product-v1`) och tilläggen 008–010 applicerade i produktionen. Ledgern registrerar bara `product-v1` och `sqlite-import-v1`; 008–010 syns i katalogen | `tools/prepare-shared-schema.mjs` skriver granskad SQL, applicerar inget |
| Studio `ops/neon-studio/` | Studio-migrering 020 och de obligatoriska versionerna före den applicerade; readiness-verktyget visar exakt ledger | `node tools/check-migration-readiness.mjs --apply` med `CROUPIER_MIGRATION_CONFIRM=apply-pending` endast i den terminalen (Jakob) |
| `011-retire-lissabon.sql` | Förberedd, inte applicerad | Se nedan |

## Valfri förberedelse för Lissabon-kontraktion (J09)

`ops/neon-game/011-retire-lissabon.sql` tar bort de tomma tabellerna `lissabon_profiles` och `lissabon_profile_sessions`. Den ingår inte i startup eller deploykrav. `node tools/prepare-lissabon-retirement.mjs --evidence <privat-json>` bygger manifestet offline (`--readiness-sql` för förkontroller med ROLLBACK, `--sql` för hela transaktionen); verktyget ansluter aldrig till databasen. Evidensfilen binder `database`, `role`, `releaseSha`, `rollbackSha`, `consumerInventorySha256`, `backupSha256` och `restoreReceiptSha256`.

Före körning krävs Jakobs DDL-beslut, frysta release- och rollback-versioner, stoppade skrivare och en full backup som provats mot ett annat tomt mål enligt stegen ovan. Förkontrollerna nekar fel ägare, ändrad produktchecksumma, icke-tomma tabeller och okända beroenden; låsen hålls genom transaktionen. CI provar vägen med `node tools/run-shared-table-qa.mjs --lissabon-retirement --postgres-bin /usr/lib/postgresql/16/bin` i ett eget kluster.

## Blob och media

- Neon äger identiteter och bindningar, Blob äger bytes. Lagringsgränsen och sökvägarna står i [BLOB-NEON](storage/BLOB-NEON.md).
- Original raderas inte som bieffekt av import, papperskorg eller dedup. Permanent radering går genom Admins beroendekontroll och sker sist, efter att originalbytes är bevarade på annat håll.
- En återställd databas pekar på samma Blob-objekt. Kontrollera att objekten finns (HEAD och SHA-256 mot registret) innan rum öppnas igen.
- Staging har eget Blob-lager `store_7E06N1P4w9Mu1dZD` med bara syntetiskt material. Kopiera aldrig produktionsmedia eller produktionstoken dit.

## Media och regression

`media/` i repot är käll- och granskningsmaterial och importunderlag, inte produktens register. `media/layout.json` binder gamla sökvägar, publika URL:er, storlek och hash till dagens filer; `media/blob-index.json` listar Blob-sökvägarna `croupier/media/<logisk-katalog>/<id>/<sha256>.<ext>`. `tools/migrate-media-layout.mjs --rollback <ledger>` vägrar överskrivning och kräver stoppade skrivare.

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

Konton, saldo och sko återställs alltid från Neon, aldrig från dessa diskar. En extern fullbackup av de två diskarna är ännu inte gjord.

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

## Renklonprov och separata QA-förutsättningar

Ett oberoende prov utgår från en färsk GitHub-klon med egen `.git` och egna låsfilsinstallationer, utan gamla `node_modules`, byggfiler, env-filer eller privata data. Börja med en ren processmiljö (`PATH`, `NODE_OPTIONS`, `NODE_PATH`). Privata data som saknas i Git återställs inte för att få provet grönt.

Kör `node apps/studio/start.mjs --no-open` (skriver lobbyns adress, startar inget), Studio-bygget och testsviterna. Flaggorna `--offline` och `--skip-build` är pensionerade och avvisas; äldre kvitton som nämner dem beskriver historik.

| Behov | Minsta åtgärd |
| --- | --- |
| PostgreSQL-prov | `node tools/studio-isolated-qa.mjs --download-postgres` (Linux/WSL, icke-root) eller `--postgres-bin <bin>`; spelmotorn över HTTP med `node tools/run-engine-qa.mjs --postgres-bin <bin>`. Verktygen skapar och tar bort egna kluster. |
| Modultester utan Postgres | PGlite via `test/fixtures/pglite-pool.mjs`; en session, bevisar inte låsning mellan anslutningar. |
| Webbläsarprov | Playwright och Chrome installeras separat; `CROUPIER_BROWSER_FIXTURE_MODULE` och `CROUPIER_BROWSER_FIXTURE_CHANNEL=chrome`. Överhoppade prov redovisas separat. |
| Riktig acceptans | Staging (syntetiska konton och material), aldrig produktionen eller Johns Bet. |

En `--single-branch`-klon hämtar bara `main`; lägg till den egna branchen med `git remote set-branches --add origin <branch>` före push.

## Staging som provbänk

Staging (`croupier-k06-k07-staging` i Vercel, Render, Neon och Blob, se [START-HERE](../START-HERE.md#staging)) är platsen för restoreprov fram till O03. Neon-projektet har databaserna `croupier_staging` och `croupier_staging_restore`; den senare är redan fylld av provet 25 oktober och är inget tomt mål längre. Skapa ett nytt tomt mål för nästa prov. O03 kräver att återställningen dokumenteras mot faktiskt migrerat schema (020 och J08) innan Jakob raderar stagingen.

## Daterade kvitton

Rubrikerna finns kvar för länkar från [migrering/](../migrering/STATUS.md). Kvittona raderades ur `main` 28 oktober 2026 och läses med `git show 29ed6626bf:docs/history/ENVIRONMENT-RESTORATION-2026-10.md`. Nya kvitton skrivs som `docs/<datum>-…-ACCEPTANCE.json`.

### J05: verifierad runtime och sparat spel — 26 oktober

Omstart i staging och återläst sparat spel.

### Molnsamprov 25 oktober kväll

Admin, publicering, spel, backup och restore i staging.
