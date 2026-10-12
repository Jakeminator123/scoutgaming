# packages/presentation

Paketet äger presentationskompositorn och layer-previewn.

- `compositor/` — spelare, kompositor, brygga, geometri och den fristående redigeraren (`app.js`, `index.html`, `viewer.*`). Redigeraren följer med men serveras inte.
- `docs/` — `FORMATLASNING.md` och `INTEGRATION.md`.
- `preview/` — `prepare.mjs` och det granskade materialet i `preview/site/`.

Dessa läser paketet:

- `apps/croupier-frontend/tools/prepare-platform-ui.mjs` kopierar `compositor.js` och `geometry.js` till `apps/croupier-frontend/public/composition-runtime/`.
- `web/composition-runtime.mjs` serverar `/composition-runtime/*`.
- `web/layer-packs.mjs` serverar `/layer-packs/*` från `compositor/`.
- `lab/tools/prepare-preview.mjs` bygger `lab/preview-build`, som Studio serverar under `/preview/*`.

Publika adresser är stabila: `/composition-runtime/*`, `/layer-packs/*` och Studio `/preview/*` (publikt `/studio/preview/*`). Filhashar för källfilerna ändras inte när bara sökvägen flyttas.

Python-verkstaden fanns bara på den raderade grenen `test-video-jakob`. Mediabitarna stannar som filer. De går inte till blob eller databas.
