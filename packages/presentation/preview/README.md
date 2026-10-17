# Studios förhandsvisningsmaterial

`site/` innehåller granskat, versionshanterat material för Studios skyddade
förhandsvisning på `/control/preview`. Byggkällan används fortfarande av
`lab/tools/prepare-preview.mjs`; den äldre branchspecifika `/test`-byggaren
är pensionerad.

Förberedaren verifierar filnamn och SHA-256 mot `site/media-hashes.json`,
kopierar materialet till ignorerade `lab/preview-build/` och hämtar spelare,
kompositor, brygga och geometri från `../compositor/`. Studio serverar resultatet
under `/studio/preview/*` med sin befintliga behörighetskontroll.

Från reporoten:

```powershell
node lab/tools/prepare-preview.mjs
node --test --test-concurrency=4 lab/test/preview-prepare.test.mjs lab/test/preview-files.test.mjs
```

Välj och granska nytt material uttryckligen. Original, arbetsutkast och
sessionsfiler är inte byggkällor. En förhandsvisning innebär ingen automatisk
publicering eller verifierad läppsynk.
