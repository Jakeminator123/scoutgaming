# Previewbyggkällor

`site/` är granskat, versionshanterat material som kopieras av
`apps/studio/tools/prepare-preview.mjs`. Dess katalog och medier är byggkällor
för förberedaren och dess prov, inget produktregister.

Förberedaren verifierar filnamn och SHA-256 mot `site/media-hashes.json`,
kopierar materialet till ignorerade `apps/studio/preview-build/` och hämtar delade
renderarmoduler från `../compositor/`.

I molndrift serverar `/studio/preview/*` endast `compositor.js` och
`geometry.js`, efter behörighetskontroll. Äldre sida, katalog och medier svarar
410 med hänvisning till `/admin/rehearsal`; de är ingen produktionsspelare.

Från reporoten:

```powershell
node apps/studio/tools/prepare-preview.mjs
node --test --test-concurrency=4 apps/studio/test/preview-prepare.test.mjs apps/studio/test/preview-files.test.mjs
```

Välj och granska nytt material uttryckligen. Original, arbetsutkast och
sessionsfiler är inte byggkällor. En förhandsvisning innebär ingen publicering
eller verifierad läppsynk.
