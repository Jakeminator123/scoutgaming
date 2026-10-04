# Återställning och skydd av data

Arbetskopian är `C:\Users\jakem\Projects\croupier` på `main`.
Den äldre kopian under Scout-Gaming är inte produktens källa.
Start och drift: [CLOUD-MIGRATION.md](CLOUD-MIGRATION.md).

Aktuell migrationscheckpoint 4 oktober 13:41 UTC: QA är återställd till
AI-/admin-/P6-flaggor OFF efter closed29, med router404, health200 och lease0.
Manifest, SDK, append-only-journaler och reservationer ska bevaras. Ett nytt
fönster får inte återanvända eller skriva om tidigare poster; partial failure
ska stängas explicit innan någon produktionsimport. Produktionens data och
Studio-policy är ännu inte omkopplade. Kör därför ingen gammal diskrestore eller
fysisk P8-radering före verifierat P7-källbyte, aktuell backup/paritet och det
gemensamma skrivfönstrets återgångspunkt. Faktisk providerkostnad är okänd/null.

## Lokal miljö

Använd koordinerad startare enligt [labbguiden](../lab/docs/README.md).
Kör endast ett produkt-/labbpar; stoppa det före miljöbyte. Från Codex används
`--no-open`. Återanvänd spel- och labbflik, bevara utkast och spel.
Stoppade servrar förblir stoppade tills Jakob ber om start.
Sparade lokala projekt, historik och profiler finns i `lab/data`;
spel-/CRAIG-databaserna ligger i `lab/data/players`. Isolerade testprofiler
får inte ersätta dem. Lokal backup: `tools/backup-lab-state.mjs`.

Den 2 oktober flyttades 39 privata filer (4 568 960 byte) utan överskrivning
från Lissabon till Lab. Hela gamla katalogen, 42 filer, finns i en separat
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
`lab/data`, utan den gamla `.local-session.sqlite`. Återskapa inte Lissabon.

## Beständig molndata

Tabellen beskriver nuvarande produktionslagring. Nya isolerade native-QA
använder Neon för Studio-policy, metadata och kostnads-/jobbjournaler samt privat
Blob för beständiga paket. QA:s installerade SDK, sourcepins, budgetjournal och
kvitton behövs fortfarande för P6 och är inte disponibel cache. Produktionsdisk
och gamla läsare/skrivare avvecklas först efter verifierat P7-källbyte och P8-prov.

| Tjänst | Datarot | Bevara tillsammans |
| --- | --- | --- |
| Produkt/BO/Studio | `/var/data` | `players/croupier.db`, `players/craig.db`, `players/bo.json`, hela `studio/`, använda `generations/` och `speech/` |
| Director | `/data/catalog` | `catalog.json`, `history/`, använt `companion.sqlite` |
| Gateway | `/data/openclaw` | `openclaw.json`, agentfiler/sessioner, `companion-search.sqlite` |

Game/auth-Neon är konto-/speldatabasen sedan 2 oktober; zonmetadata har sin
egen databas. SQLite-filerna på disken är bevarade historiska källor.
Git och Blob-upload säkerhetskopierar inte Studio-index, konton eller saldo.
Behåll diskdata tills extern verifierad backup och isolerat återgångsprov finns.

`tools/backup-render-state.mjs` har profilerna `product`, `director`, `gateway`.
Stoppa/frys alla skrivare på respektive tjänst före backup; produktprofilen
kräver både Web och Lab stoppade. `--quiesced yes` är operatörens försäkran,
ingen automatisk kontroll. Maintenance Mode bevisar inte att bakgrundsskrivare
är stoppade. Samordna snapshots för en gemensam återställning.

```sh
node tools/backup-render-state.mjs backup --profile product --source /var/data --destination /tmp/product-snapshot --quiesced yes
node tools/backup-render-state.mjs verify --snapshot /tmp/product-snapshot
```

Kör varje profil i tjänsten som äger disken; välj ny privat destination utanför
dataroten och Git. Verktyget vägrar länkar/specialfiler, exporterar SQLite med
backup-API inklusive committad WAL, kontrollerar integritet och främmande
nycklar samt verifierar filhashar. Exportera hela snapshoten privat utanför
Render och kör `verify` där. `/tmp` är flyktig. Enskilda DB-kontroller bevisar
inte konsistens mellan olika databaser.

Återställ med alla skrivare stoppade till en **tom, monterad datarot** med rätt
profil. Bevara nuvarande data separat; verktyget skriver inte över.

```sh
node tools/backup-render-state.mjs restore --profile product --snapshot /tmp/product-snapshot --destination /var/data --quiesced yes
```

Director återställs till `/data/catalog`, Gateway till `/data/openclaw`.
Verifiera inloggning, saldo/shoe, BO-roller, Studio-projekt och historik efter
start och ytterligare omstart. Blanda inte äldre CRAIG med nyare speldata.
Efter avbruten restore: håll tjänsten stoppad och granska dataroten.
Backup/restore är provat med syntetiska filer; extern produktionsbackup och
full återläsning av hela diskprofilen är ännu inte slutverifierade.

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

`lab/.next/cache`, `apps/croupier-frontend/.next` och deras
`tsconfig.tsbuildinfo` är återbyggbara. Rensa endast när sessionsvakten saknar
aktiv session och inga berörda Next-/byggprocesser kör. `lab/tsconfig.json`
utesluter privat `data/` från appens typkontroll. Labbets övriga `.next`
innehåller en runtime som det befintliga integrationstestet faktiskt använder;
behåll den eller kör `npm --prefix lab run build` före full regression.
Använd exakta sökvägar; rensa inte `lab/data`, privata QA-kvitton, medier
eller journaler. Interaktiv start använder alltid den koordinerade startaren.

## Media och regression

Media lagras nu i `media/dealers/<dealer>/{runtime,source,review,staging}`,
`media/game` och `media/site`. `media/layout.json` binder exakt gamla paths,
publika URL:er, storlek och hash till nya filer. Originalnamn och historisk
Emil-/Kevin-proveniens bevaras i metadata; `v1` är ingen gemensam rotversion.
4 924 kopior kontrollerades före källradering. Privata rollback-ledgers ligger
i ignorerade `media/.migration`; `migrate-media-layout.mjs --rollback <ledger>`
vägrar överskrivning och behåller den kanoniska kopian. Kör med stoppade skrivare.

`docs/reference` har flyttats till `media/dealers/astrid/source/reference`.
Kalibreringsverktyg använder samma resolver. Privat Blob-export använder
`croupier/media/<samma-logiska-katalog>/<id>/<sha256>.<ext>`; indexet publiceras
efter återläsningshash. `media/blob-index.json` är aktivt i molnet; 4 265 filer
har verifierad återläsningshash. Äldre privata `croupier/videos`/`zones`-objekt
behålls tills alla projektlänkar är verifierade.

Neon-verktyg: `tools/migrate-sqlite-postgres.mjs` installerar/importerar till
tom, separat game-databas; `tools/postgres-backup-restore.mjs` verifierar full
rad-/sekvensparitet. De vägrar zon-databas och import med aktiv extern wallet.
Bevara orörda SQLite-backuper utanför Git. Efter första nya Neon-skrivning
kräver återgång senaste data/ledger; starta aldrig blindt en äldre SQLite-kopia.

Bevara råmedia, kalibreringar och `dealer-sync-baseline.json`. Varje taländring
är ett paket: exakt text, audio, video, frame-index, kalibrering och mänskligt
acceptanskvitto. Ny audio-/videohash ogiltigförklarar tidigare godkännande.
Bygg ersättningstagningar i separat staging. Kringgå aldrig indexets spärr
mot överskrivning av kalibrerade bytes genom att ta bort metadata.

Alla fyra dealers använder gemensam uppspelningsväg. Matcha exakt replik;
välj aldrig talvideo efter ungefärlig längd eller loopa gammal mun över nytt
ljud. Källor: `web/public/dealer-engine.mjs`,
`web/public/performance-player.mjs`, `pipeline/build-index.mjs`.
Äldre automatiska warp-/offsetrecept är ingen generell instruktion för nya takes.

För spelar-/mediaändring: kör hooken och
`node pipeline/audit-dealer-sync.mjs --probe`; granska Vera, Amira, Mei och
Astrid med `?dealer=<name>&rehearsal=1`, två uppspelningar i följd.
Hash, waveform, första munrörelse och tester godkänner inte synk/kortkontakt.
Uppdatera endast avsiktligt granskade baselineposter med per-line-resultat.
Kända kvarvarande fel: [JOHN-HANDOFF.md](JOHN-HANDOFF.md).
