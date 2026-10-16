# Systemkartan: data, kontroll och begränsningar

[Öppna kartan](index.html). Den beskriver hela Scoutgaming-systemet, inte
bara OpenClaw eller Astrid. [AI-dokumentationen](../AI/README.md) samlar
agenternas guider och den daterade Render-inventeringen.

| Fil | Ansvar |
| --- | --- |
| catalog.json | Tjänster, kopplingar och daterade driftbelägg |
| routes.json | Sidor, API-rutter, alias och källkopplingar |
| storage.json | Databaser, SQL-kontrakt och lagringslager |
| flows.json | Systemflöden och begrepp med källhänvisningar |
| contracts.json | Kontrollernas källfiler, baslinjehashar och testkopplingar |
| planned.json | Hänvisningar till återstående krav i CLOUD-MIGRATION |
| verify.mjs | Jämför katalogen med vald kod och eventuell test-evidens |
| build.mjs | Bygger HTML-vyn från data och kontrollresultat |
| index.html | Fristående, inbäddad ögonblicksbild av kartan |

## Kontrollen används

Verifieraren körs som en separat, informativ rapport i
`.github/workflows/croupier.yml` och kan anropas manuellt. Den körs inte
som leveransspärr vid lokal commit eller push. En gammal katalog får inte
förhindra att sidor, filer eller tester avvecklas enligt produktbeslut.
`tools/system-map-evidence.mjs` kopplar testresultat till version och
indatahashar. Det är alltså ett aktivt verktyg, inte bara en gammal skiss.

Läsande kontroll från repots rot, med projektets Node-version:

```sh
node docs/system-map/verify.mjs --check --ref HEAD
node docs/system-map/build.mjs --check --ref HEAD
```

`--ref` väljer en Git-version; utan flaggan läses arbetskopian. `build --check`
verifierar underlaget utan att skriva HTML och bevisar inte att en tidigare
incheckad `index.html` redan innehåller dagens data. Bygg separat HTML med
`--output` och versionsbunden test-evidens när en ny karta ska levereras.

Rött resultat ger felstatus från det manuella kontrollkommandot och markerar
rapporten; kartans rapportsteg och artefaktuppladdning är inte produktgrindar.
Verkliga regressionstester, SQL/HTTPS-acceptans och obligatorisk
migrationsberedskap förblir blockerande. **Gult stoppar inte leverans**: ändrad kod,
schemadrift och inaktuell evidens måste granskas. Grått betyder att giltigt
testbelägg inte tillförts för kontraktet. Det betyder inte att testet misslyckats.
Grönt gäller endast kontrollens angivna version och belägg; det bevisar inte
produktionsdrift, videokvalitet, läppsynk eller komplett databasåtkomst.

## Avgränsad uppdatering 15 oktober 2026

Källversion efter integration av PR149: `9b6f4d112ad2bf56d173c1b5538dc97232719a34`, med de synliga
arbetskopieändringarna i `codex/runtime-contracts`. Tjänsteansvar och
produktnivåer har kontrollerats mot Vercels routing och verkliga konsumenter:
web/frontend, studio/Lab för Admin, Partner och Lobby, separat taltransport,
Render-spelmotor, Director och privat OpenClaw Gateway. `lab/lib` är aktiva
gemensamma tjänster. Partner är en riktig N2-yta; fixture-API:t är separat.
Övriga flöden behåller sina äldre, uttryckligt daterade evidensposter.

SQL-katalogen innehåller nu 57 tabeller, 382 kolumner, 57 primärnycklar och
31 främmande nycklar. Följande tidigare inventeringsluckor är fyllda:

- `006-operator-audit.sql`: `croupier_studio.operator_audit_events`.
- `008-dealer-forge.sql`: `croupier_studio.forge_dealers` och `forge_jobs`.
- `011-gpu-daily-budget.sql`: separat CHECK-ändring, ingen ny tabell.

De elva SQL-källorna är kodinventerade; installerat live-schema, fulla
index/CHECK/UNIQUE/triggers och grants är inte verifierade av katalogen.

Samordnarens driftkvitto cirka **14 oktober 22:25 UTC** identifierar Vercel
`scoutgaming` READY och Render `croupier-v2` LIVE på `a0df4e26`.
Render health gav 200. Projekt-, team- och deployment-ID finns i
`catalog.json`. Det är deployment-/hälsobevis, inte ny UI-, login-,
tal- eller medieacceptans. Director, Gateway, providers och QA har ingen
ny driftversionsverifiering. De två gamla native-QA-projekten saknar
produktionsdomäner; dokumenterad reserv är otillgänglig och inte verifierad
som användbar reserv. Se ENVIRONMENT-RESTORATION för ägarskapskvitton.

Kontroll av den gemensamma arbetskopian gav **gult**, noll fel och 14 gula
kontrakt: **156 `input.changed`** mot den bevarade baslinjen
`e602ea91bb7e39f394ec61362b6a6db5209ae6c6`, samt **31
`input.worktree-changed`** för ännu ocommittade indata. Samma fil kan beröra
flera kontrakt. Inga SQL-inventeringsvarningar kvarstår. Dessa siffror är ett
daterat arbetskopiekvitto och ändras vid efterföljande integration/commit.
Ingen färsk CI-test-evidens matades in, och ingen baslinjehash uppdaterades.
`contracts.catalogSha` anger bara den nya katalogens källversion.

Både `verify --check` och `build --check` har körts. Efter PR149-integrationen
regenererades HTML med ordinarie byggkommando; källversionen är `9b6f4d11`.
En kontroll som ger `currentSha=null` kan inte styrka drift mot HEAD;
slutkontrollen identifierar rätt version. Ingen beständig Git- eller
säkerhetskonfiguration ändrades. De fyra inbäddade faktakatalogerna matchar
JSON-filerna och gula markeringar är avsiktligt bevarade.
Kör inte `--refresh-baseline` bara för att dölja dessa varningar.

## Partnerreferenser efter PR150, 15 oktober 2026

Arbetskopian utgår från main `8e97ee83`. Aktiva hänvisningar pekar nu på
`lab/components/workspace-surface-page.tsx` och
`lab/components/kevin-bo/partner-operator-workspace.jsx`; källansvar och N1/N2-
kontroller är bevarade. Kartans bredare faktainventering behåller sin tidigare
källversion; detta är en avgränsad sökvägsuppdatering efter klientstädningen.

Den gamla klientens sökväg under `expectedHashes` är historisk baslinjedata
och ligger kvar. Aktiva `sources` följer de nya modulerna; inga hashar har
flyttats, ersatts eller nollställts för att göra kontrollen grön. HTML genereras
med ordinarie `build.mjs`; slutkontrollens varningar redovisas separat nedan.

Slutkontroll mot arbetskopian på `8e97ee83`: `verify --check`, ordinarie
HTML-generering och `build --check` passerade utan fel. Resultatet är gult:
159 `input.changed` och 10 `input.worktree-changed`, totalt 169 varningar i
14 kontrakt. Inga andra varningskoder eller SQL-inventeringsluckor finns i
detta kvitto. Ingen färsk test-evidens importerades. Baslinje och samtliga
`expectedHashes` är identiska med HEAD; de fyra inbäddade faktakatalogerna
matchar JSON-filerna. Antal och sökvägar är ett daterat arbetskopiekvitto,
inte ett krav på att efterföljande integration ska ge samma varningsantal.
