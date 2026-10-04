# Återställning och skydd av data

Arbetskopian är `C:\Users\jakem\Projects\croupier` på `main`.
Den äldre kopian under Scout-Gaming är inte produktens källa.
Start och drift: [CLOUD-MIGRATION.md](CLOUD-MIGRATION.md).

P8 4 oktober 17:26 UTC: product/QA-containerstart på `1fb2307` misslyckades
på fel förväntad HTTP-status i startprovet (401 i stället för den verifierade
anonyma tal-QA-routens 403). b0bc är fortsatt LIVE; auth rättas inte eller
öppnas. Endast provets kontrakt rättas, med verklig handler i befintligt test.
Produktdisken och tolv ersatta Blob-alias är kvar. Extern fullständig backup
behålls under och efter nästa release; ingen omimport eller journalreset.

Aktuell migrationscheckpoint 4 oktober 17:14 UTC: main b0bc5814 är publicerad
med grön CI. Alla tre QA-tjänster kör exakt b0bc med 10/10 bevarandekontroller,
faktisk Linux-källa/SDK och oförändrat OFF42. QA är återställd till
AI-/admin-/P6-flaggor OFF efter closed39
på cc77/dep-db1687s9v7es73e56rv0, med router404, health200 och lease0.
Senaste speluppspelningen nådde synlig/hörbar END men provider HTTP200
CANCELLED avläst efter END. Funktionell admission kan återanvända den exakt
matchande completed-request/END/browsercleanup-efter-END-kedjan för oförändrade
playbackbytes. Exakt tid för providerstatusövergång finns inte i kvittot.
b0bc:s naturliga provider-COMPLETED är lokalt testat, ännu inte liveverifierat.
Ingen ytterligare generering eller budget-/reservationsändring görs.
Egen Cartesia-nyckel i rotens ignorerade `.env` är även kopierad till Labs
ignorerade `.env.local`; före-filen är privat säkerhetskopierad och alla andra
miljörader bevarade. Driftens nyckel byts separat efter dataomkopplingen.
Manifest, SDK, append-only-journaler och reservationer ska bevaras. Ett nytt
fönster får inte återanvända eller skriva om tidigare poster; partial failure
ska stängas explicit innan någon produktionsimport. Produktionens data och
Studio-policy är importerade och faktisk driftparitet PASS. P7-admission/cloudplan/BEFORE är sparade
och importens underhållsdeployment `dep-db16rv0u01pc73d442p0` var LIVE/childless med
0 barnprocesser, skrivare och providerprocesser. Endpointen är tillfälligt
Max 0/Active 0/FlashBoot OFF under importens faktiska ALL0-avläsning. Den är nu
sparad och återavläst som Max 1/Active 0/FlashBoot ON inför provideraktivering.
Fryst export och GET-dränering finns;
slutvalidering och faktisk produktionsimport PASS. Importkvitto SHA256
`0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d`
visar exakt oförändrade 32 konto-/speltabeller. Fristående paritet och faktisk
runtime-/aliasomkoppling är PASS; Render `dep-db17ojvavr4c73alutjg` är LIVE
på b0bc med gemensam Neon-policy. Alla 17 aliaspekare är verifierade.
Färsk konto-/kostnadsavläsning PASS 17:09 UTC. Produktens tre providerflaggor
är återställda ON; dep-db18gfh42hec73eh9a60 är LIVE och faktisk readback PASS.
QA förblir OFF med fem gamla lagringsvariabler borttagna och övriga 37 värden,
disk, SDK, journaler och reservationer bevarade.
Hela gamla /var/data är säkerhetskopierad externt:
206 filer, 10 mappar, 125 745 905 källbyte; full inventering, oförändrade
metadata, arkivläsbarhet och överförings-/arkivhash PASS. Privat backup finns i
`C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`,
kvitto SHA256 `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
Kör därför ingen gammal diskrestore eller
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
