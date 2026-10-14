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

Verifieraren anropas från `.githooks/pre-commit-full`,
`.github/workflows/croupier.yml` och `tools/check-push-target.mjs`.
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

Rött resultat stoppar kontrollen. **Gult stoppar inte leverans**: ändrad kod,
schemadrift och inaktuell evidens måste granskas. Grått betyder att giltigt
testbelägg inte tillförts för kontraktet. Det betyder inte att testet misslyckats.
Grönt gäller endast kontrollens angivna version och belägg; det bevisar inte
produktionsdrift, videokvalitet, läppsynk eller komplett databasåtkomst.

## Kontroll 13 oktober 2026

Senaste vid granskningen tillgängliga `main`,
`579c47e32d977ea5e2eaef5eec565ccd1c1dfe18`, gav **gult**: inga strukturella fel,
åtta gula och sex grå kontrakt, 64 varningar. Ingen färsk CI-test-evidens
matades in i denna läsande kontroll.

59 varningar gällde indata som ändrats sedan baslinjen. De fem övriga gällde
två SQL-källor och tre tabeller som saknas i `storage.json`:

- `ops/neon-studio/006-operator-audit.sql`: `croupier_studio.operator_audit_events`.
- `ops/neon-studio/008-dealer-forge.sql`: `croupier_studio.forge_dealers`
  och `croupier_studio.forge_jobs`.

Katalogens inspectionDate är 7 oktober och dess runtimeEvidence beskriver
5 oktober. Dessa datum är inte dagens deploykontroll. Den lokala arbetskopians
HEAD `40fc0d83` låg efter granskad main och gav 53 varningar; den synkades inte
över pågående arbete. Kontrollen använde verifierarens reader-gränssnitt och
lokala Git-objekt med en processlokal safe.directory, eftersom dess vanliga
Git-läsare isolerar global konfiguration i Windows-sandboxen. Ingen Git- eller
säkerhetskonfiguration ändrades.

Bedömning: maskinläsbara kontrakt, källspårning och testkopplingar är en bra
grund. Katalogens underhåll släpar efter implementationen. Saknade SQL-objekt
ska inventeras och berörda testbelägg förnyas innan kartan kallas uppdaterad.
Kör inte `--refresh-baseline` bara för att få bort gula markeringar; granska
först ändringarna. Ingen baslinje, maskinkatalog eller HTML-vy har skrivits om
av dokumentationsstädningen.
