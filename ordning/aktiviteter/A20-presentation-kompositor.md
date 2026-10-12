# A20 · `packages/presentation`: kompositor och preview ut ur `test-videoeditor/`

| Fält | Värde |
| --- | --- |
| Våg | 3 · först i strukturfasen · ensam, inga parallella kodflyttar |
| Väntar på | B12 · M1 mergad till `main` och verifierad · inga öppna PR:er som rör konsumenterna nedan |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 30 % · tre byggkedjor och layer-lanens runtime |

## Mål

Produktionskoden för kompositorn och layer-previewn ligger under
`packages/presentation/`. Mappen `test-videoeditor/` finns inte längre.
Publika adresser (`/composition-runtime/*`, `/layer-packs/*`, Studio
`/preview/*`) och filhashar är oförändrade.

## Fakta (00ea55c5)

- `test-videoeditor/` har 51 filer och 11,8 MB:
  - `program/web/` (`app.js`, `bridge.js`, `compositor.js`, `geometry.js`,
    `index.html`, `lanes.js`, `player.js`, `style.css`, `viewer.css`,
    `viewer.html`, `viewer.js`);
  - `program/docs/` (`FORMATLASNING.md`, `INTEGRATION.md`);
  - `preview/site/` (34 filer, 11,7 MB: media och manifest för layer-lanen);
  - `preview/prepare.mjs` (+ test) och README-filer.
- Konsumenter:
  - `apps/croupier-frontend/tools/prepare-platform-ui.mjs` kopierar
    `program/web/{compositor,geometry}.js` till `public/composition-runtime/`.
    `apps/croupier-frontend/test/platform-ui.mjs` provar det.
  - `web/composition-runtime.mjs` serverar `/composition-runtime/{compositor,geometry}.js`
    via `new URL('../test-videoeditor/program/web/…', import.meta.url)`.
  - `web/layer-packs.mjs`: `runtimeRoot = resolve(root, 'test-videoeditor/program/web')`.
    Layer-media kommer från `lab/preview-build`.
  - `lab/tools/prepare-preview.mjs`: `previewRoot = test-videoeditor/preview`,
    `webRoot = test-videoeditor/program/web`. Bygger `lab/preview-build`, som
    Studio serverar under `/preview/[...path]` och Render byggt i
    Docker-imagen.
  - Tester: `test/composition-runtime.mjs`, `lab/test/dealer-framing.test.mjs`,
    `lab/test/preview-prepare.test.mjs` och `test-videoeditor/preview/prepare.test.mjs`.
  - Systemkarta: `docs/system-map/routes.json` (rad ~278, ~4205, ~4226).
  - Text: `CLAUDE.md` rad 16, `docs/JOHN-HANDOFF.md` och
    `docs/LOCAL-PRESENTATION-RUNTIME.md`.

## Målstruktur

```text
packages/presentation/
  README.md            (kort: vad paketet äger, vilka som läser det)
  compositor/          ← test-videoeditor/program/web/*  (samma filnamn)
  docs/                ← test-videoeditor/program/docs/*
  preview/             ← test-videoeditor/preview/*      (prepare.mjs, site/, README)
```

## Ägda filer

`test-videoeditor/**` → `packages/presentation/**`, och konsumenterna ovan
(bara sökvägsrader). Dessutom `docs/system-map/routes.json` (berörda
poster), `CLAUDE.md` rad 16, sökvägsrader i `docs/LOCAL-PRESENTATION-RUNTIME.md`
och `docs/JOHN-HANDOFF.md`, `.githooks/pre-commit-full` (om en testsökväg
ändras) samt `.dockerignore` och `.gitignore` om de nämner mappen.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kontrollera att inga öppna PR:er rör
   konsumentfilerna (`gh pr list --state open`, sedan `gh pr diff <nr> --name-only`).
1. **Commit 1, ren flytt:** `git mv test-videoeditor/program/web packages/presentation/compositor`,
   och motsvarande för `program/docs` och `preview`. Inget innehåll ändras.
2. **Commit 2, sökvägar:** uppdatera varje konsument. Publika URL:er och
   utdatamappar (`public/composition-runtime/`, `lab/preview-build`) ändras inte.
   Sök med `rg 'test-videoeditor'`. Bara `ordning/` och historiska dokumentcitat
   får finnas kvar.
3. **README** i `packages/presentation/`: ägarskap, konsumenter och regeln att
   publika URL:er är stabila.
4. **Prov:**
   - `node --test test/composition-runtime.mjs lab/test/dealer-framing.test.mjs lab/test/preview-prepare.test.mjs packages/presentation/preview/prepare.test.mjs apps/croupier-frontend/test/platform-ui.mjs test/layer-packs-route.mjs test/layered-presentation.mjs`;
   - `node docs/system-map/verify.mjs --check` och
     `node tools/check-orphan-tests.mjs`. Orphan-kontrollen måste hitta
     `prepare.test.mjs` på den nya platsen; uppdatera kroken om det behövs;
   - orkestratorn: `npm --prefix lab run build` (prepare-preview, där hasharna
     ska stämma), frontendbygget med plattformsmiljö, och hela sviten.
5. **Efter deploy (orkestratorn):** `?lane=layer-preview&rehearsal=1`, två
   uppspelningar i rad, samt `/composition-runtime/compositor.js` på
   www.scoutgaming.tech med samma innehåll som i repot.

## Klart när

- [ ] `test-videoeditor/` finns inte.
- [ ] Alla tre byggkedjor och proven är gröna.
- [ ] Layer-lanen spelar likadant efter deploy.

## Tveksamt att lyfta

- Om den fristående redigeraren (`app.js`, `index.html`, `viewer.*`) fortfarande
  används. Den flyttas med, men kan pensioneras senare.
