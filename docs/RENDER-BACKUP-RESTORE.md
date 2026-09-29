# Render: beständig data, backup och återställning

Status 2026-09-29: backup → kopiering till separat lokal tempdestination →
verifiering → återställning → två återöppningar är provat via det verkliga
CLI-verktyget med **enbart syntetiska testfiler**, för alla tre profiler.
Originalkälla och första snapshot togs bort före återställningen i provet.
Ingen verklig spelar-, CRAIG-, Director- eller Gateway-databas har
öppnats, kopierats eller ändrats av backupgranskningen. Render-dashboarden
verifierades den 29 september cirka 15:38 UTC: `croupier-v2` har en 5 GB-disk
monterad på `/var/data`. En riktig omstart med datakontroll, export utanför
Render och återläsning i drift är fortfarande inte verifierade.

## Vad måste överleva en omstart?

| Render-tjänst | Beständig rot | Innehåll som måste bevaras tillsammans |
| --- | --- | --- |
| Spel + BO + Studio (`croupier-v2`) | `CROUPIER_CLOUD_DATA_ROOT=/var/data` | `players/croupier.db` (spel, shoe, saldo, sessioner, chatt/Probe), `players/craig.db` (CRAIG-konton, roller, BO-hemlighet och Lab-sessioner), `players/bo.json`; hela `studio/` (projekt, historik, social policy, uppladdningar); `generations/` och `speech/` om generering har använts. |
| Director (`croupier-lab-director`) | `LAB_DATA_DIR=/data/catalog` | `catalog.json`, `history/` och `companion.sqlite` om labbminne har använts. |
| Privat Gateway (`croupier-lab-openclaw`) | `OPENCLAW_STATE_DIR=/data/openclaw` | `openclaw.json`, agenternas filer/sessioner och `companion-search.sqlite` med sökreservationer. |

Produktens rot härleds i `ops/cloud/config.mjs`; Directors och Gateways diskar
deklareras i `open-claw/lab/render.yaml`. Kataloger under Git-checkouten,
inklusive bundlad media, återskapas från deploy och är inte användardata.
Lokal `lissabon/data` har en **separat** rutin i `tools/backup-lissabon-state.mjs`.
Flytta inte dess privata innehåll till Render som bieffekt av denna rutin.

Render bevarar bara filer **under** respektive diskmontering genom omstart och
deploy. Diskarna är tjänstbundna och finns inte i build, pre-deploy eller
one-off-jobb. Render gör dagliga disksnapshots, men [Render avråder från att
använda diskrestore för databasåterställning](https://render.com/docs/disks).
Den här rutinen ger en separat, verifierbar export och är ingen ersättning för
att kontrollera att de tre diskarna faktiskt är monterade.

## Verktygets kontrakt

`tools/backup-render-state.mjs` har profilerna `product`, `director` och
`gateway`. Det går rekursivt genom **en angiven datarot** och tar med vanliga
filer. Det vägrar symboliska länkar och specialfiler. SQLite-filer (`.db`,
`.sqlite`, `.sqlite3`) exporteras med Node/SQLite backup-API, som tar med
committade WAL-sidor. Den fristående kopian växlas till ett enda SQLite-filformat
och får både `PRAGMA integrity_check` och `PRAGMA foreign_key_check`.
Den senare avvisar brutna deklarerade tabellreferenser som SQLite-sidkontrollen
ensam inte upptäcker. Kontrollerna ersätter inte tjänstens egen acceptans av
data eller relationer mellan olika databasfiler. Andra filer kopieras med kontroll mot
källhash före och efter. Snapshoten skrivs först i en privat tillfällig katalog,
verifieras med SHA-256 och publiceras därefter med namnbyte. Målet måste vara
nytt och ligga utanför dataroten och Git-checkouten.

`--quiesced yes` är en **operatörsförsäkran**, ingen automatisk processkontroll.
Stoppa eller frys samtliga skrivare på den aktuella tjänsten före kopiering.
Render Maintenance Mode ger 503 för HTTP-anrop men stoppar inte nödvändigtvis
bakgrundsskrivare; använd det inte ensamt som bevis. För produktprofilen måste
Web **och** Lab vara stoppade samtidigt. För Director respektive Gateway måste
deras egna processer vara stoppade. Ta de tre tjänsternas snapshots under ett
samordnat underhållsfönster om en gemensam återställning krävs. Ett öppet
skrivflöde kan ge olika tidpunkter i `croupier.db`, `craig.db` och JSON-filerna,
trots att varje enskild SQLite-kopia klarar integritetskontrollen.

Exempel på kommandon när källan är avstängd och dataroten fortfarande är
monterad i tjänstens underhållsmiljö. Använd en privat katalog utanför disken;
ersätt platshållarna med absoluta sökvägar. Skriv aldrig hemligheter i
kommandoraden eller Git.

```sh
node tools/backup-render-state.mjs backup --profile product --source /var/data --destination /tmp/product-snapshot --quiesced yes
node tools/backup-render-state.mjs backup --profile director --source /data/catalog --destination /tmp/director-snapshot --quiesced yes
node tools/backup-render-state.mjs backup --profile gateway --source /data/openclaw --destination /tmp/gateway-snapshot --quiesced yes
node tools/backup-render-state.mjs verify --snapshot /tmp/product-snapshot
```

Kör varje profil **i den tjänst som äger disken**. Exportera därefter hela
snapshotkatalogen krypterat till ett privat lager utanför Render, kontrollera
`verify` igen på den mottagna kopian och spara den med åtkomstbegränsning och
retention. `/tmp` är flyktig; lämna aldrig enda kopian där. [Render beskriver
SCP för överföring från tjänstens disk](https://render.com/docs/disks#transferring-files).
Den exakta underhållsstarten, extern mottagare och återkommande schema är ännu
inte etablerade. Bygg/pre-deploy-jobb kan inte läsa den monterade disken.

## Återställning

1. Stoppa alla skrivare för tjänsten och behåll en separat, verifierad kopia av
   det nuvarande datainnehållet. Gör en återställning mot **en tom, monterad
   datarot** med samma profil. Verktyget skriver aldrig över en befintlig fil.
2. Kontrollera snapshoten på återställningsvärden och kör:

   ```sh
   node tools/backup-render-state.mjs verify --snapshot /tmp/product-snapshot
   node tools/backup-render-state.mjs restore --profile product --snapshot /tmp/product-snapshot --destination /var/data --quiesced yes
   ```

   Använd på motsvarande sätt `director` → `/data/catalog` och `gateway` →
   `/data/openclaw`. Återställningen bygger först en privat stagingkatalog **på
   målvolymen**, verifierar kopian, flyttar sedan färdiga toppnivåposter till
   den tomma roten och städar sin stagingkatalog. Ett upptaget mål, fel profil,
   korrupt backup eller extra fil avvisas. Vid strömavbrott mitt i publiceringen
   ska tjänsten hållas stoppad och dataroten granskas; automatisk överskrivning
   eller rensning av befintliga data ingår inte.
3. Starta tjänsterna med samma konfiguration och verifiera inloggning, rätt
   spelare/saldo/shoe, BO-roll, Lab-projekt och Director/Gateway-historik. Gör
   en ny omstart och kontrollera samma värden. Först då är faktisk Render-
   persistens och återläsning provad. Återställ aldrig en äldre CRAIG-kopia
   ihop med en nyare spelarkopia utan särskild datagranskning.

En monterad Render-disk som redan innehåller data är **inte** ett tomt mål.
Denna första rutin har avsiktligt ingen destruktiv `--replace`. Planera separat
hur en tom återställningsvolym eller kontrollerad karantän skapas innan ett
skarpt haveri; det steget är ännu inte övat. Renders egen disksnapshotrestore
kan tappa ändringar efter snapshoten och är inte denna verifierade filrutin.

## Inloggning och OAuth-beslut

**Beslut: inför inte OAuth nu.** Spelarens nuvarande `/api/auth/login` använder
existerande CRAIG-användarnamn/e-post och scrypt-lösenord via
`web/craig-identity.mjs`; första lyckade login länkar ett separat spelarkonto.
BO använder CRAIG-konton/roller, en signerad HttpOnly-cookie och kontrollerar
aktuell roll/lösenordsstämpel. BO→Lab och BO→spel har kortlivade engångskoder
och serverkontrollerad session. En valfri separat lokal spelarkontotyp finns
bakom `CROUPIER_PLAYER_ACCOUNTS=1`; den är av som standard i molnprofilen.

OAuth skulle tillföra en identitetsleverantör och konto-länkning utan ett
nuvarande krav på extern inloggning. Det löser varken diskpersistens eller
återställning. Verifiera i stället befintlig CRAIG-/BO-inloggning och
behörighetsindragning på riktig HTTPS-värd före bredare drift. Om Jakob senare
vill ha Google/Microsoft/annan federerad inloggning behövs ett separat beslut
om leverantör, konto-länkning och återhämtningsväg. Inga OAuth-konton,
klient-ID:n eller nycklar har skapats.

## Lokalt prov

`node --test test/backup-render-state.mjs` använder enbart temporära SQLite-
och JSON-fixtures. Tretton prov täcker alla tre profiler, committad WAL,
hashmanipulation, extra snapshotfil, korrupt SQLite, sökvägstraversering,
fel profil, upptaget mål, symbolisk länk och brutna deklarerade främmande nycklar.
Det sista felet reproducerades före rättningen: `integrity_check` gav `ok`
och filens hash stämde, men en rad pekade på en förälder som saknades.
Backup, verifiering och återställning avvisar nu det felet utan publicerad
snapshot eller filer i återställningsmålet.

De tre CLI-proven exporterar produkt (5 filer), Director (2 filer) och Gateway
(3 filer), kopierar hela snapshoten till en annan tempkatalog utanför checkouten
och tar därefter bort den syntetiska källan och ursprungliga snapshoten.
Mottagarkopian verifieras och återställs till en tom rot. Samtliga filbytes
jämförs och databaserna stängs och öppnas två gånger. Produkten använder de
riktiga modulerna för CRAIG-identitet, spelarsession och sko: syntetiskt lösenord,
reader-roll, samma spelar-id/session, saldo 995 och oavslutad hand med exakt
skoordning består. Director-minne, Gateway-kvitto och JSON-/historikfiler består
också. Ett nytt restore mot det fyllda målet avvisas. Tempkataloger städas via
testets avslutshantering; inga servrar eller molnresurser startas.

Detta verifierar lokal filöverföring och återöppning, inte krypterad transport,
lagrets retention, en riktig Render-omstart eller HTTPS-inloggning efter skarp
återställning. De driftkraven ovan kvarstår. Proven öppnar aldrig
`lissabon/data/players` eller Render-data.
