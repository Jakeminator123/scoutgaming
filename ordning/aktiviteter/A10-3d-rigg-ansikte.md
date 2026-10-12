# A10 · 3D-, rigg- och ansiktsspåret

| Fält | Värde |
| --- | --- |
| Våg | 2 · parallell med A12, A13, A15, A16 · före A11, A14 och A17 |
| Väntar på | B4 · rapporterna A04 och A05 |
| Branch / worktree | `jakob/ordning-a10` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a10` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 25 % · elva tester i kroken, register som måste stämma |

## Mål

Det riggade 3D-dealerspåret (Blender, GLB, ansikte, hår, IK, rörelseprover)
är borta ur aktiv kod, tester, pipeline och media. Spelet, Studio, partnerportalen
och den lokala och lagrade uppspelningen är oförändrade.

## Fakta (00ea55c5)

- Media: `media/dealers/astrid/runtime/indexed/rig/` (23 filer, 62,0 MB,
  inklusive `face-study/astrid-rigged.glb` 39,6 MB),
  `media/dealers/astrid/source/3d/` (26 filer, 23,0 MB, varav tre
  `motion-samples.json`), `media/dealers/astrid/runtime/assets/astrid-collection-sweep.glb`
  (38,5 MB) och möjligen `media/game/source/3d/` (5 filer). Totalt cirka 123,5 MB.
- Klientmoduler som bara nås från test eller pipeline: `dealer-rig.mjs`,
  `dealer-face.mjs`, `dealer-motion.mjs`, `dealer-collection.mjs`,
  `rigged-card-layout.mjs`, `rigged-discard-state.mjs`,
  `rigged-face-playback.mjs`, `blender-card-layout.mjs`,
  `blender-table-details.mjs`, `blender-table-scene.mjs`, `dealing-card.mjs`.
  Utan konsument: `dealer-studio.css`. Kontrollera även `rigged-review.css`.
- Tester i kroken (rad ~81–85): `test/dealer-motion.mjs`,
  `dealer-skin-contact.mjs`, `rigged-card-layout.mjs`,
  `rigged-layout-contact.mjs`, `rigged-discard-state.mjs`,
  `dealer-collection.mjs`, `dealer-face.mjs`, `rigged-face-playback.mjs`,
  `rigged-face-bindings.mjs`, `dealer-face-calibration.mjs` och
  `dealer-face-skin.mjs`. `generations-api.mjs` på samma rad är **inte** 3D.
- Pipeline (utan konsument, 3D/Blender/ansikte/hår): `add-dealer-controls.py`,
  `apply-dealer-hair-study.py`, `apply-dealer-reviewed-fit.py`,
  `assemble-blackjack-project.py`, `attach-dealer-face.py`,
  `bake-dealer-actions.py`, `bake-dealer-collection.py`,
  `bake-dealer-facial-performance.py`, `bake-dealer-hair-study.py`,
  `build-blackjack-table.py`, `build-dealer-face.py`,
  `capture-dealer-lip-study.py`, `check-dealer-table-collision.py`,
  `check-rigged-game.mjs`, `clean-dealer-surface.py`, `dealer_glb_materials.py`,
  `dealer_oral_fit.py`, `dealer_posterior_neck_fit.py`,
  `export-dealer-collection.mjs`, `export-dealer-face.py`,
  `export-dealer-facial-performance.mjs`, `fit-dealer-face-landmarks.py`,
  `fit-dealer-face.py`, `groom-dealer-hair.py`, `inspect-dealer-asset.mjs`,
  `map-dealer-face-texture.py`, `optimize-dealer-face.py`,
  `package-dealer-face.py`, `patch-dealer-export-geometry.mjs`,
  `prepare-dealer-facial-keyframes.mjs`, `prepare-dealer-lip-retarget.mjs`,
  `prepare-dealer-rig.py`, `render-dealer-appearance.py`,
  `sample-dealer-collection.mjs`, `sample-dealer-rig.mjs`,
  `study-dealer-scalp-coverage.py`, `test-blender-card-layout.mjs`,
  `test-blender-card-stack.mjs`, `test-blender-table-frustum.mjs`,
  `texture-dealer-face.py`, `transfer-dealer-animations.mjs`,
  `verify-dealer-calibrated-native.py`, `verify-dealer-collection-export.mjs`,
  `verify-dealer-export.mjs`, `verify-dealer-facial-export.mjs`,
  `verify-dealer-hair-study.py`, `verify-dealer-ik-panel.py`,
  `verify-dealer-neck.py`, `verify-dealer-posterior-neck.py` och
  `verify-dealer-reviewed-projects.py`. Bara internt: `capture-dealer-face.py`,
  `dealer-ik-panel.py` och `data/astrid-posterior-neck-fit.json`.
- `media/game/runtime/assets/blackjack-3d/*` och `player.glb` refereras av
  `pipeline/sample-dealer-*.mjs` och `test/rigged-card-layout.mjs`, men ägs av
  A11 (kasinot). A10 tar bort sina konsumenter. A11 tar bort filerna.

## Ägda filer

Filerna ovan, efter justering mot A05:s lista, samt:
- motsvarande rader i `.githooks/pre-commit-full`;
- poster i `media/layout.json`, `media/blob-index.json` och
  `media/catalog/*.json` för borttagna sökvägar, men bara via de befintliga
  generatorerna eller kontrollverktygen;
- poster i `docs/system-map/*.json` som pekar på borttagna filer;
- `.dockerignore`, för rader som bara gäller borttagna sökvägar.

**Rör inte:** `media/game/runtime/assets/**` (A11), `web/public/casino*.mjs`
(A11), `pipeline/audit-*.mjs` om inte T3 visar att de bara skyddar 3D,
dokument i `docs/` och `lab/docs` (lista behovet för A17), samt allt i
`media/**/runtime/presentation`, `indexed/{performance,streams,actor,audio,speech}`.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Läs A05:s 3D-avsnitt och A04:s rader för
   träden ovan. Stryk varje fil som A05 märkt `kräver beslut` eller `osäker`
   och skriv den under `Tveksamt`.
1. **Kontrollera registren.** Ta reda på hur `media/layout.json`,
   `media/blob-index.json` och katalogerna byggs (`tools/migrate-media-layout.mjs`,
   `tools/build-runtime-media-catalog.mjs`, `pipeline/build-lab-video-manifest.mjs`).
   Gör ändringarna med verktygen. Handredigera bara om verktyget saknas, och
   redovisa det i så fall.
2. **Ta bort** kod, tester, pipeline och media i den ordningen, med `git rm`.
   Ta bort testraderna i kroken.
3. **Sök rester:** `rg` på varje borttaget filnamn (utan `ordning/`). Ingen
   kvarvarande import eller sökväg i kod, test, konfig eller systemkarta.
4. **Prov:**
   - `node tools/check-orphan-tests.mjs`;
   - `node docs/system-map/verify.mjs --check` (0 röda);
   - `node tools/build-runtime-media-catalog.mjs --check`;
   - `node pipeline/build-lab-video-manifest.mjs --check`;
   - `node pipeline/audit-dealer-sync.mjs --probe` (oförändrat mot baslinjen);
   - `node ordning/verktyg/public-reach.mjs` och `pipeline-consumers.mjs`
     (före och efter);
   - riktade `node --test` för tester som importerar något i närheten
     (`test/performance-*.mjs`, `test/scene-join.mjs`,
     `test/dealer-reach.mjs`).
5. **Rapportera** borttagna byte per område, före och efter
   `tree-sizes.mjs media/dealers/astrid 5`.

## Klart när

- [ ] Inga referenser kvar till borttagna filer.
- [ ] Kontrollerna ovan är gröna, och audit-dealer-sync är oförändrad.
- [ ] Hela sviten är grön (orkestratorn).

## Tveksamt att lyfta

- Filer där A05 eller provningen visar en levande konsument.
- `test/dealer-reach.mjs`, om det läser både 3D- och videodata.
