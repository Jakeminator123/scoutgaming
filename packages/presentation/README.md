# packages/presentation

Paketet äger presentationskompositorn, layer-previewn och urvals-/idlereglerna.

- `compositor/` — spelare, kompositor, brygga, geometri och den fristående redigeraren (`app.js`, `index.html`, `viewer.*`). Redigeraren följer med men serveras inte.
- `docs/` — `FORMATLASNING.md` och `INTEGRATION.md`.
- `preview/` — `prepare.mjs` och det granskade materialet i `preview/site/`.
- `runtime/` — urval, idle, filmfamiljer, legacy-klipp och skobyten. Lab, Web och OpenClaw läser modulen. Importerna tillbaka till `lab/`, `web/` och `open-claw/` är kvar till A22.

Dessa läser paketet:

- `apps/croupier-frontend/tools/prepare-platform-ui.mjs` kopierar `compositor.js` och `geometry.js` till `apps/croupier-frontend/public/composition-runtime/`.
- `web/composition-runtime.mjs` serverar `/composition-runtime/*`.
- `web/layer-packs.mjs` serverar `/layer-packs/*` från `compositor/`.
- `lab/tools/prepare-preview.mjs` bygger `lab/preview-build`, som Studio serverar under `/preview/*`.
- `lab/lib`, `lab/components`, `web/presentation-api.mjs`, `web/storage` och `web/studio-preview.mjs` importerar `runtime/`.
- `web/server.mjs` släpper in `/presentation-runtime/*`. `web/presentation-api.mjs` läser filen från `runtime/`.

Publika adresser är stabila: `/composition-runtime/*`, `/layer-packs/*`, `/presentation-runtime/*` och Studio `/preview/*` (publikt `/studio/preview/*`). Filhashar för källfilerna ändras inte när bara sökvägen flyttas.

Python-verkstaden fanns bara på den raderade grenen `test-video-jakob`. Mediabitarna stannar som filer. De går inte till blob eller databas.
