# Previewbyggkällor och isolerade prov

`site/` är granskat, versionshanterat material som fortfarande kopieras av
`apps/studio/tools/prepare-preview.mjs`. Den äldre branchspecifika `/test`-byggaren
är pensionerad. Sidans katalog och medier används endast i explicit isolerad
offlinefixtur; de utgör inget produktregister.

Förberedaren verifierar filnamn och SHA-256 mot `site/media-hashes.json`,
kopierar materialet till ignorerade `lab/preview-build/` och hämtar delade
renderarmoduler från `../compositor/`.

I native molndrift serverar `/studio/preview/*` endast `compositor.js` och
`geometry.js`, efter befintlig behörighetskontroll. Äldre sida, katalog och
medier svarar 410 med hänvisning till `/admin/rehearsal`. De ska inte beskrivas
som en tillgänglig produktionsspelare.

Från reporoten:

```powershell
node apps/studio/tools/prepare-preview.mjs
node --test --test-concurrency=4 apps/studio/test/preview-prepare.test.mjs apps/studio/test/preview-files.test.mjs
```

Välj och granska nytt material uttryckligen. Original, arbetsutkast och
sessionsfiler är inte byggkällor. En förhandsvisning innebär ingen automatisk
publicering eller verifierad läppsynk.
