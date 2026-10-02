# Återställning och skydd av data

Arbetskopian är `C:\Users\jakem\Projects\croupier` på `main`.
Den äldre kopian under Scout-Gaming är inte produktens källa.
Start och drift: [CLOUD-MIGRATION.md](CLOUD-MIGRATION.md).

## Lokal miljö

Använd koordinerad startare enligt [labbguiden](../lab/docs/README.md).
Kör endast ett produkt-/labbpar; stoppa det före miljöbyte. Från Codex används
`--no-open`. Återanvänd spel- och labbflik, bevara utkast och spel.
Stoppade servrar förblir stoppade tills Jakob ber om start.
Bevara sparade Lissabon-profiler på befintlig plats; isolerade testprofiler
får inte ersätta dem. Lokal backup: `tools/backup-lissabon-state.mjs`.

## Beständig molndata

| Tjänst | Datarot | Bevara tillsammans |
| --- | --- | --- |
| Produkt/BO/Studio | `/var/data` | `players/croupier.db`, `players/craig.db`, `players/bo.json`, hela `studio/`, använda `generations/` och `speech/` |
| Director | `/data/catalog` | `catalog.json`, `history/`, använt `companion.sqlite` |
| Gateway | `/data/openclaw` | `openclaw.json`, agentfiler/sessioner, `companion-search.sqlite` |

SQLite är fortfarande konto-/speldatabasen; Neon lagrar zonmetadata.
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
full återläsning i drift är ännu inte slutverifierade.

## Media och regression

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