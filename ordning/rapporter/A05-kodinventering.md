# A05 · Kodinventering (läsande)

Mätt på `43bb429cf5dc4d70b7b95fac8c8567e481f9f769` med Node v22.23.3.
`origin/main` vid mätningen: `919691072212c044ccaf5aeaa8f0b2fbf99b1bf5`
(2 commits före den här basen; ingen av dem rör en borttagningskandidat).

Märkning: `säker` = ingen produktkonsument, inget beslut utöver områdets B.
`kräver beslut` = nåbar för en användare, eller ett B säger att filen ska stå kvar.
`osäker` = dynamisk sökväg, strängträff eller motstridig klass.

## Steg 0

| Mätning | Baslinje `00ea55c5` | Nu `43bb429c` | Tolerans |
| --- | --- | --- | --- |
| `public-reach.mjs` | 122: 95 / 12 review / 11 test / 2 pipeline / 2 none | samma 95/12/11/2/2 | inom |
| `pipeline-consumers.mjs` | 109: 6 hook / 2 external / 14 internal / 87 none | samma | inom |
| `lab-unused.mjs` | 330 filer; 4 utan importör, 4 bara test | 339 filer; samma 4+4 namn | känd rörelse §6 (Dealer Forge). +2,7 % |
| `cross-imports.mjs` | lab/lib→web(server) 125, lab/lib→web/public 30, frontend→web/public 26, pipeline→web/public 46, presentation-runtime→lab/lib 13, lab/lib→open-claw 15, web(server)→lab/lib 34 | 131, 31, 26, 46, 13, 15, 34 | +6 och +1, under 5 %, samma forge-rörelse |
| Review-sidor | fem spårade | samma fem, klass `review-only` | inom |

`lab-unused` har en nyckelkollision: `page-template.mjs` och `page-template.tsx`
får samma nyckel. `page-template.mjs` har produktimportörer (nedan). Den är
struken från radering.

## Delade moduler som står kvar

| Fil | Varför | Märkning |
| --- | --- | --- |
| `web/public/local-film-player.mjs`, `verified-video-buffer.mjs`, `card-art.mjs` | `app.mjs` (kortkonst rad 23) och `performance-player.mjs:1-5` | kräver beslut |
| `web/public/performance-player.mjs` | `app.mjs:211-216` skapar den för varje icke-lager-spel. Bara `playLocalClip` anropas där (`local-presentation.mjs:25,84`) | kräver beslut |
| `web/public/performance-contact.mjs`, `actor-compositor.mjs`, `actor-edge-blend.mjs`, `actor-grade.mjs`, `dealer-reach.mjs`, `scene-join.mjs` | statisk import från `performance-player.mjs:4-9`. `actor-compositor.mjs:3` drar in `actor-grade.mjs` | kräver beslut |
| `web/public/vendor/three/three.module.js` + `three.core.min.js` | `performance-player.mjs:3`; modulen importerar `./three.core.min.js` | kräver beslut |
| `web/public/vendor/three/GLTFLoader.js` | `casino.mjs:2`, `floor-test.html:7`, `review/2026-09-09/index.html:3`, `blender-table-scene.mjs:2`. Inte den levande spelaren | säker först när A11 och A16 är borta |
| `web/public/vendor/three/BufferGeometryUtils.js` | ingen träff utanför `vendor/` | säker (A17) |
| `web/public/shoe-model.mjs` | bara `casino.mjs:4`, `review/2026-09-09/index.html:4`, `contact.mjs:2`, `table-scene.mjs:2` | säker först efter A11+A16+`table-scene` |
| `media/game/runtime/assets/cardback.png` | `styles.css:342`, `performance-player.mjs:385`, `partner-presentation.mjs:30` | kräver beslut |
| `shoe.png`, `chip-gold.png` | `partner-presentation.mjs:30` via `web/partner-api.mjs:143` | kräver beslut (A30) |
| `lab/lib/legacy-clip-inventory.mjs`, `lab/lib/studio-voice-lines.mjs` | A12 och A30 | kräver beslut |

`play()` / `playJoin()` i `performance-player.mjs` (Three, packad video) anropas
från produkten bara av `lab/lib/original-media-runtime.mjs:108-110`. Importen
ligger ändå i den levande bunten.

## 3D, rigg och ansikte (A10, B4)

Klient. Klass från `public-reach.mjs`. Tester i `.githooks/pre-commit-full`.

| Fil | Klass | Konsumenter | Tester | Systemkarta | Dokument | Märkning |
| --- | --- | --- | --- | --- | --- | --- |
| `dealer-rig.mjs`, `dealer-face.mjs`, `dealer-motion.mjs`, `dealer-collection.mjs`, `rigged-card-layout.mjs`, `rigged-discard-state.mjs`, `rigged-face-playback.mjs` | test-only | bara `test/` och pipeline-skript utan konsument | krok 81–85, samma namn | ingen route | ingen i `AGENTS.md` / `CLAUDE.md` / `lab/docs` | säker |
| `dealer-studio.css` | none | ingen namnträff. `prepare-platform-ui.mjs:62-66` kopierar alla css om filen finns | – | – | – | säker |
| `rigged-review.css` | product, inte från HTML | `ops/vercel-entry/build.mjs:12` listar den. Ingen kod sätter klassen `rigged-review`. `scene=rigged-review` släpps av `gameEntryRedirect` (`test/game-entry-contract.mjs:77`) | – | – | – | osäker |
| `test/dealer-motion.mjs`, `dealer-skin-contact.mjs`, `rigged-card-layout.mjs`, `rigged-layout-contact.mjs`, `rigged-discard-state.mjs`, `dealer-collection.mjs`, `dealer-face.mjs`, `rigged-face-playback.mjs`, `rigged-face-bindings.mjs`, `dealer-face-calibration.mjs`, `dealer-face-skin.mjs` | krok | bara 3D-modulerna, utom att `rigged-card-layout.mjs:5`, `rigged-layout-contact.mjs:10` och `dealer-collection.mjs:9` läser `media/game/runtime/assets/blackjack-3d/profile.json` (A11) | krok 81–85, bara detta spår. `generations-api.mjs` på rad 85 är inte 3D | – | – | säker |
| `test/dealer-reach.mjs` | krok rad 77 | `dealer-reach.mjs` (står kvar) och `media/game/staging/2026-09-13/per-seat-video/targets.json:6` | samma rad som `scene-join` och `ready-motion` | – | – | kräver beslut. Inte A10 |
| Pipeline none, 3D-listan i A10 (add/apply/assemble/attach/bake-dealer-*/build-dealer-face/build-blackjack-table/capture-dealer-lip/check-*/clean/dealer_*/export-dealer-*/fit-*/groom/inspect/map/optimize/package/patch/prepare-dealer-*/render/sample-dealer-*/study/test-blender-*/texture/transfer/verify-dealer-*) | none | ingen utanför listan | inte i krok/CI | – | – | säker |
| `pipeline/load-dealer-rig.mjs` | external | `test/rigged-layout-contact.mjs:5`, `dealer-face-skin.mjs:8`, `dealer-collection.mjs:7`, `dealer-skin-contact.mjs:5`, plus `sample-dealer-*.mjs` (none) | krok via testerna ovan | – | – | säker tillsammans med testerna |
| `capture-dealer-face.py`, `dealer-ik-panel.py`, `data/astrid-posterior-neck-fit.json` | internal | bara andra pipelinefiler i 3D-mängden | – | – | – | säker tillsammans med mängden |
| `media/dealers/astrid/runtime/indexed/rig/` | 23 filer, 61,98 MB | pipeline none + 3D-tester | samma | – | – | säker |
| `media/dealers/astrid/source/3d/` | 26 filer, 23,01 MB | samma | samma | – | – | säker |
| `media/dealers/astrid/runtime/assets/astrid-collection-sweep.glb` | 40 375 164 byte | ingen i trelagerkedjan | – | – | – | säker |
| `media/game/source/3d/` | 5 json | `assemble-blackjack-project.py:7`, `build-blackjack-table.py:14` (båda none) | – | – | – | säker |
| `pipeline/audit-astrid-actor.mjs`, `audit-performance.mjs` | hook/CI | se T3 | krok 68–69, CI `croupier.yml:196-197` | – | – | kräver beslut. Inte A10 |

`blender-card-layout.mjs`, `blender-table-details.mjs`, `blender-table-scene.mjs`,
`dealing-card.mjs` är `review-only`. De stannar hos A16.

Inga env-nycklar i `docs/environment-variables.json` läses bara av 3D.
`CROUPIER_ASTRID_CAMERA` är kameran, inte riggen. `CROUPIER_PROOF_DIR` läses av
`check-rigged-game.mjs` och saknas i registret.

## Kasinot (A11, B5)

| Fil | Klass | Konsumenter | Tester | Systemkarta | Dokument | Märkning |
| --- | --- | --- | --- | --- | --- | --- |
| `web/public/casino.html`, `casino.mjs`, `floor-test.html` | product (HTML utanför review) | `prepare-platform-ui.mjs:35` följer `casino.mjs`; `:67` kopierar `casino.html`. `server-ui.mjs:9`. `next.config.mjs:9`. `app/casino.html/route.ts:3-4`. `vercel-ingress.mjs:32` | `platform-ui.mjs:292-299` väntar 200. `vercel-ingress.test.mjs` har kasinoraden. `test/casino-navigation.mjs` krok rad 70 | `routes.json` `frontend-casino-html` ~1204. Aliastext ~977 | ingen länk i `lab/docs` | kräver beslut |
| `casino-navigation.mjs`, `player-rig.mjs` | product via casino.html | `casino.mjs:3,5`. Navigationstestet | krok rad 70, bara navigationen | – | – | säker givet B5 |
| `web/public/blackjack-asset-state.mjs` | test-only | `test/blackjack-asset-state.mjs:14` pekar på `blackjack-table.glb` | krok rad 80, bara den filen | – | – | säker givet B5 |
| `casino-floor.glb`, `player.glb`, `player.asset.json`, `blackjack-3d/*` | media | `floor-test.html:15`, `casino.mjs:48`, `build-blackjack-table.py`, 3D-tester mot `profile.json` | A10-testerna måste släppa `profile.json` först | – | – | säker efter A10 |
| `table.png`, `room-extended.png` | media | bara `ops/vercel-entry/preview/vercel.template.json:61,65` | preview-test nämner `/assets/table.png` | – | – | osäker (A18) |
| `tray.png` | media | ingen sökvägsträff | – | – | – | säker |
| `cardback.png`, `shoe.png`, `chip-gold.png` | – | se delade moduler | – | – | – | kräver beslut. Inte A11 |
| `shoe-model.mjs`, `vendor/three/*` | – | andra konsumenter | `platform-ui.mjs:293` kräver GLTFLoader så länge kasinot byggs | – | – | lämna |

`/casino.html` omdirigeras inte. `gameEntryRedirect` rör bara `/v2`.

## Originalmedia i Studio (A12, B6)

Nåbar reserv i Studio. Spelklienten importerar den inte (`app.mjs:78` kräver
`local` eller `layered`).

| Fil | Klass | Konsumenter | Tester | Systemkarta | Dokument | Märkning |
| --- | --- | --- | --- | --- | --- | --- |
| `lab/app/api/original-media/route.ts`, `[...path]/route.ts` | Next-rötter | `original-media-server.mjs` | `lab/test/original-media.test.mjs` via `npm --prefix lab test`. Kroken kör `blob-source-routing.test.mjs` (rad 64), som också testar annat | `routes.json` ~2033 och ~2095. `contracts.json` har sha för båda route-filerna | `lab/VIDEO-LIBRARY.md:25` | kräver beslut |
| `original-media.mjs`, `original-media-server.mjs`, `original-media.d.mts` | produkt | `stage.tsx:7`, `studio-session.tsx:214`, `control-activity-page.tsx:47`, `control-events-page.tsx:8`, `events-preview.tsx:14`, `events-inspector.tsx:13`, `game-stream.tsx:7`, `video-library.tsx:12`, `video-coverage.tsx:6`, `speech-source.tsx:2` | samma, plus `game-stream-lifecycle.test.mjs`, `video-workflow.test.mjs` | `flows.json` ~913 `original-media-player.tsx` | `lab/VIDEO-LIBRARY.md` | kräver beslut |
| `original-media-runtime.mjs` | ingen statisk importör | serveras som fil, `original-media-server.mjs:18`. Anropar `PerformancePlayer.play` | original-media-testet | – | – | kräver beslut |
| `original-media-player.tsx` | produkt | `stage.tsx` när registrerad video saknas | `original-media-player.test.mjs` (lab `components/*.test.mjs`) | flows.json | – | kräver beslut |
| `platform-routing.mjs` `LAB_API` | delad | rad 39 innehåller `original-media` | frontendens routningstest | routes-mönster ~624 | – | bara den token. Kräver beslut |

`MODULES` i `original-media-server.mjs:21` namnger webbmoduler. De tas inte bort
i A12. Efter A12 saknar `dealer-engine.mjs` och `speech-playback.mjs`
produktkonsument, men inte de som `performance-player.mjs` importerar.

## `/v2`, composited och granskningssidor (A16, B10)

Se T2. Composited läses som katalog, inte av spelaren.

| Fil | Klass | Konsumenter | Tester | Systemkarta | Dokument | Märkning |
| --- | --- | --- | --- | --- | --- | --- |
| `app/v2/route.ts`, `server-ui.mjs:9`, `next.config.mjs:9`, `vercel-ingress.mjs:32` | levande alias | `platformUiDocument` anropar `gameEntryRedirect` före filen | `platform-ui.mjs:300` väntar 307 till `/`. `game-entry-contract.mjs:75-79`. `vercel-ingress.test.mjs:61` skickar vidare till publik `/v2` | `routes.json` `frontend-v2` ~1420. Texten ~982 är fel, se dokument | `lab/README.md:408` | kräver beslut |
| `web/public/review/2026-09-09/{index.html,contact.html,contact.mjs}`, `review/amira-composite/{index.html,review.mjs}` | review-only | statiska sidor på spelservern. Ospårad `3lager/` rörs inte | – | – | – | kräver beslut |
| `actor-composite-scene.mjs`, `animation-clock.mjs`, `blender-card-layout.mjs`, `blender-table-details.mjs`, `blender-table-scene.mjs`, `dealing-card.mjs`, `movement-cues.mjs` | review-only | bara sidorna ovan. `dealing-card.mjs:1-2` importerar movement-cues och animation-clock | krok rad 70: `test/animation-clock.mjs`, `test/movement-cues.mjs` (saknas i A16:s lista) | – | – | säker givet B10, tillsammans med de två testerna |
| `astrid-green-dealer.mjs`, `astrid-green-speak.mjs`, `astrid-speech-join.mjs` | product enligt verktyget | ingen import från `app.mjs`. Träffen är `clip-mapping.mjs:58,69` (selectortext, `actualPlayback: false`) plus pipeline-tester. `blender-card-layout.mjs:1` importerar `quadMatrix` | pipeline `test-astrid-green-*.mjs`, `test-amira-*.mjs` (none) | – | – | osäker |
| `astrid-folded-rest.mjs`, `astrid-idle-scheduler.mjs` | pipeline-only | pipeline `test-astrid-folded-rest-lifecycle.mjs`, `test-astrid-idle-scheduler.mjs` | inte i kroken | – | – | säker givet B10 |
| `idle-video-loop.mjs` | product via green-dealer | `astrid-green-dealer.mjs:3`. Egen test | krok rad 78 | – | – | osäker tills green-dealer är borta, sedan A17 |
| Pipeline: `test-astrid-green-*.mjs`, `test-amira-green-speak.mjs`, `test-amira-transitions.mjs`, `test-astrid-folded-rest-lifecycle.mjs`, `test-astrid-idle-scheduler.mjs`, `build-dealer-v2-release.mjs` | none | ingen | – | – | – | säker givet B10 |
| `media/dealers/astrid/runtime/composited/` | 189 filer, 80,67 MB | `tools/migrate-media-layout.mjs:36` mappar `review/` hit. `clip-mapping.mjs:45-70` läser `review/astrid-green-speak` och `review/astrid-table-v2`. `media/catalog/legacy.json` har speak.json | clip-mapping i krok rad 87 | – | – | kräver beslut |
| `media/dealers/amira/runtime/composited/` | 62 filer, 10,36 MB | samma mappning. `build-dealer-v2-release.mjs:30` | – | – | – | kräver beslut |
| `web/clip-mapping.mjs` | krok via `test/clip-mapping.mjs` | katalog, `actualPlayback: false` på rad 32, 39, 57, 70. Partner-API:t importerar inte filen | krok rad 87. A16 får bara ta composited-poster | – | handoffen om `legacyClipPolicy` | kräver beslut. Policyfält rörs inte |

`web/partner-presentation.mjs` läser `performance/manifest.json` och
`streams/index.json`, inte composited-trädet.

## Staging (A14, B8)

Kodträffar utanför `media/` och `ordning/`: 3D-skripten mot
`media/dealers/astrid/staging/2026-09-10/astrid-head-v2`, `test/dealer-reach.mjs:6`
mot `media/game/staging/2026-09-13/per-seat-video/targets.json`,
`build-return-continuation.mjs:14` (default `return-bridge`, den mappen finns inte),
`build-hands.sh` (osspårad Vera-sökväg). Läppsynkkedjan läser inte de här
mapparna. `docs/dealer-sync-baseline.json` och `docs/qa/*.json` nämner inte
`staging/`.

| Träd | Filer | Konsument | Märkning |
| --- | ---: | --- | --- |
| `media/game/staging/` | 852 | bara `per-seat-video/targets.json` i kroken | kräver beslut för den filen (A14 gör om fixturen). Övriga kataloger säker efter det |
| `media/dealers/amira/staging/2026-09-20/` | 37 | ingen | säker |
| `media/dealers/astrid/staging/2026-09-10/astrid-head-v2` | 9 | A10-ansiktsskripten | säker efter A10 |
| övrig Astrid-staging (`2026-09-19` 365, `2026-09-20` 78, varav `astrid-green-speak-elevenlabs` 175 och `astrid-seam-repair` 32) | 443 | ingen kodsökväg. Codex säger att trädet har kalibreringsmetadata | osäker |
| `media/dealers/astrid/source/calibration/lipsync-overrides.json.pre-retime` | 1 | ingen läsare. `sync-existing.py:86` skriver suffixet bredvid den levande overrides-filen, inte den här kopian. Handoff rad 394 | säker |

`web/public/review/2026-09-09/3lager/` är ospårad och finns inte här. Rörs inte.

## Pipeline-rest (A15, B9)

A15:s none-kandidater är fortfarande none, utom `mouth-crops.json`.

| Fil | Klass | Konsument | Märkning |
| --- | --- | --- | --- |
| A15-kandidaterna utom `mouth-crops.json` och läppsynk (`align-dealer-speech-export.mjs`, `auto-rescue.py`, `bake-cutout.sh`, `bake-with-table.sh`, `build-astrid-actor-mattes.py`, `build-contact-review.mjs`, `build-previews.sh`, `build-return-continuation.mjs`, `capture-astrid-speech.py`, `debug-burn.py`, `export-kf.py`, `face-keyframes.py`, `harvest-speak.py`, `harvest-visemes.py`, `kf-sheet.py`, `make-master-v2.py`, `merge-astrid-master.py`, `normalize-bake.sh`, `normalize-stream-order.py`, `prepend-contact-entry.mjs`, `room-voice.py`, `save-checkpoint.py`, `submit-speak-batch.py`, `test-actor-composite.mjs`, `test-actor-edge-blend.mjs`, `viseme-render.py`, `viseme-timeline.py`) | none | ingen kodkonsument. Inte krok/CI | säker |
| `mouth-crops.json` | internal | `sync-existing.py:9` | kräver beslut. Struken från A15-radering |
| Läppsynk: `sync-existing.py`, `sync-audio-warp.py`, `auto-phrase-warp.py`, `measure-lipsync.py`, `retime-video-map.py`, `retime-video-warp.py`, `apply-lipsync.py`, `trim-speak-start.py`, `measure-onset.py` | none eller internal | `sync-existing.py:6,32,91` anropar warp/retime/apply. `apply-lipsync.py:24,29` anropar measure. Ingen krok | kräver beslut (B9 behåller) |
| `bake-composite.sh`, `build-hands.sh` | internal | bara kommentarer i `normalize-bake.sh` och `bake-cutout.sh` | kräver beslut (omtag) |
| `encode.sh` | internal | anrop `harvest-speak.py:36`. Nämns i `build-index.mjs:7` och `trim-speak-start.py:3` | kräver beslut |
| hook/CI: `audit-dealer-sync.mjs`, `audit-performance.mjs`, `audit-astrid-actor.mjs`, `build-lab-video-manifest.mjs`, `build-index.mjs`, `pack-contact-media.mjs` | hook/CI | kroken och CI | kräver beslut. Rörs inte |
| `pipeline/lipsync-overrides.json` | external enligt verktyget | basnamnet träffar även mediakopian. Filens egen läsare är `apply-lipsync.py:12` för Vera | osäker |

## `web/public`-rest (A17)

| Fil | Klass | Konsumenter | Tester | Märkning |
| --- | --- | --- | --- | --- |
| `table-scene.mjs` | none | importerar `shoe-model` och three. Ingen nämner filen | – | säker |
| `bo/media-preview.mjs` | test-only | – | `test/bo-media-preview.mjs` krok rad 86 | säker tillsammans med testet |
| `ready-motion.mjs` | test-only | – | krok rad 77. Testet läser actor-provenance | kräver beslut (delar rad med levande `scene-join`) |
| `shoe-contact-occlusion.mjs` | test-only | kommentar mot shoe-model | krok rad 76, samma rad som `performance-contact` | säker, raden delas |
| Övriga product-men-inte-HTML (`astrid-camera-audio-worklet.mjs`, röst-css, `dealer-speech-profile.mjs`, operator-kontrakten, `speech-reply-library.mjs`) | product | riktiga importörer i server, Studio och lobby | krok | kräver beslut. Inte A17 |

## Studio-rest (A17) och A13

| Fil | Verktyg | Faktiskt | Märkning |
| --- | --- | --- | --- |
| `page-template.mjs` | no importer | importör bland annat `lab-studio.tsx:21`, `control-events-page.tsx:19`, `studio-administration.tsx:11`, `page-template.tsx:4` | struken. Kräver beslut (står kvar) |
| `family-video-upload.tsx` | no importer | bara `studio-content.test.mjs`. `video-library.tsx` använder `VideoUpload`. `preview-page.test.mjs:200` väntar att den inte renderas | kräver beslut |
| `kevin-bo/port-source.mjs` | no importer | generator för fabriken. Ingen statisk importör | kräver beslut. A13, inte radering |
| `background-zone-schedule.mjs` | test-only | bara `lab/lib/background-zone-schedule.test.mjs`, utanför labbs testglob | osäker |
| `media-family-resolver.mjs` | test-only | re-export. Produkten importerar `presentation-runtime/media-family-resolver.mjs` | kräver beslut. Bara labb-wrappern är lös |
| `social-store.mjs` | test-only | kroktester och `ops/neon-studio/legacy-snapshot.mjs:54` kräver källtexten | kräver beslut |
| `zone-workspaces.mjs` | test-only | `lab/test/zone-cloud-store.test.mjs` krok rad 50 | kräver beslut |
| `kevin-bo/original-views.jsx`, `original.css`, `kevin-backoffice.jsx` | levande | `kevin-backoffice.jsx` använder `original.views[view]` för riktiga operatörer. `navigation.mjs` har 24 destinationer, varav roulette och baccarat `planned` | kräver beslut. A13 bryter ut, tar inte bort |

## Ops (A18, B15) och engångsverktyg

| Fil | Konsumenter | Märkning |
| --- | --- | --- |
| `ops/vercel-entry/build.mjs` | `prepare-platform-ui.mjs:4`, `test/blackjack-entry-http.mjs:10`, `test/player-signup.mjs:9`, `preview/build.mjs` | kräver beslut. Flyttas, raderas inte |
| `ops/vercel-entry/{README.md,index.html,vercel.json,.env.example,.gitignore}` | inget bygge. Env-registret `vercel-entry` sources rad 120–125. `catalog.json` `environment.vercel-entry` ~367 | kräver beslut (B15) |
| `ops/vercel-entry/preview/**`, `test/build-preview.mjs`, `test/preview-routes.mjs` | preview-test i krok rad 64. `test/vercel-presentation-video-origin.mjs` använder `github-work-vercel-entry.vercel.app` | osäker |
| `ops/caddy/bettalotto-game-auth.Caddyfile` | ingen träff i kod. `BETTALOTTO_PARTNER_*` är partnernycklar, inte filen | osäker (T6) |
| `tools/migrate-media-layout.mjs`, `tools/deduplicate-media.mjs` | krok rad 55: `test/media-migration.mjs`, `test/media-deduplication.mjs`. `contracts.json` och `storage.json` nämner deduplicate | kräver beslut. Behåll |

## T2

`/v2` serverar inte en egen spelare.

1. `web/public/game-entry-contract.mjs:52-56` ger alltid ett mål för
   `/v2`, `/v2/` och `/v2/index.html`: `publicGamePath(env)` plus godkänd query
   (`dealer`, `presentation` local|layered, `lane`, `rehearsal`, `table`,
   `operator`, launch-JWT, observatör). `performance`, `motion` och `scene` släpps.
   Bevis: `test/game-entry-contract.mjs:75-79`.
2. `publicGamePath` (`:16-19`): `/blackjack` när `CROUPIER_STUDIO_NEON_POLICY=1`,
   annars `CROUPIER_PUBLIC_GAME_PATH` eller `/`. Dokumentet säger att flaggan är
   satt på Render och båda Vercel-byggena.
3. Vercel med unified UI och canonical game (`platform-routing.mjs:100-106`)
   skickar `/v2` till `/play/blackjack` med samma query, inklusive launch om den
   ser ut som en JWT.
4. Render (`web/server.mjs:1157-1160`) svarar 307 med samma funktion, före
   statiska filer. Launch på `/v2` hanteras tidigare (`:727-736`): med Neon blir
   det 303 till `/blackjack` och en sessionskaka. Utan Neon kan första hoppet
   stanna på `/v2` utan launch, och nästa anrop tar 307.
5. `app/v2/route.ts` anropar `platformUiDocument`. `server-ui.mjs:9` mappar
   `/v2` till `game.html`, men rad 79–80 omdirigerar först.
   `platform-ui.mjs:300` väntar 307 till `/` när Neon-flaggan är av.
6. Ingress (`vercel-ingress.mjs:32-52`) skickar transportvärdens `/v2` till den
   publika värdens `/v2`. Den kanoniserar inte själv.
7. `dealer-version-switcher.mjs:6-25` ignorerar versionsargumentet och pekar på
   `/` eller `/blackjack`, aldrig `/v2`.
8. `app.mjs:78` och `:197-216` har ingen `/v2`-gren och ingen composite-gren.

`server-ui.mjs` måste ha `game.html`-raden kvar tills omdirigeringen är
flyttad, annars blir svaret 404 (`:75`) i stället för 307.

## T3

Inget av skripten skyddar 3D-riggen. Båda körs utan `--probe` i kroken och med
`--probe` i CI (`.github/workflows/croupier.yml:196-197`).

`audit-performance.mjs` läser `dealers/astrid/performance/manifest.json` via
medialayout och validerar med `performance-contact.mjs` (checksumma, kalibrering,
packad RGB/mask). Samma manifest läses av det levande partner-API:t
(`partner-api.mjs:143` och `storage/async-partner-api.mjs:151` →
`buildAssetsManifest`, `partner-presentation.mjs:20-28`) och av
`legacy-clip-inventory.mjs:54` samt `original-media-server.mjs:69`.
`playLocalClip` laddar inte manifestet. Skyddet är alltså levande katalogdata,
inte bordets nuvarande film.

`audit-astrid-actor.mjs` jämför `runtime/indexed/streams` med
`runtime/indexed/actor` (mattor, provenance, talpar, rumsplatta). Ingen
produktimport laddar actor-mattorna. De korskontrollerade tal- och RGB-hasharna
tillhör den indexerade bank som partnerkatalogen och originalmedian fortfarande
läser. Testerna `ready-motion.mjs` och `scene-join.mjs` läser
`dealers/astrid/actor/provenance.json`. Skriptet ska inte följa med A10.

## Kaskader

När A12 tar reserven, och A16 tar green/review:

| Modul | Kvarvarande produktkonsument | Nästa |
| --- | --- | --- |
| `dealer-engine.mjs` | ingen i `app.mjs`. Kvar: `test/dealing-cues.mjs` (krok 70) och DealerEngine-delen av `test/speech-playback.mjs` (samma rad testar även levande `speech-queue.mjs`) | A17, efter att testet delats |
| `speech-playback.mjs` | bara `astrid-green-speak.mjs:3` och original-runtime | A17 efter A12+A16, samma testdelning |
| `actor-compositor.mjs`, `actor-edge-blend.mjs`, `actor-grade.mjs`, `performance-contact.mjs`, `dealer-reach.mjs`, `scene-join.mjs`, `vendor/three/three.module.js`, `three.core.min.js`, `card-art.mjs`, `local-film-player.mjs`, `verified-video-buffer.mjs`, `performance-player.mjs` | `app.mjs` → `performance-player.mjs` | står kvar |
| `shoe-model.mjs` | ingen när casino, review och `table-scene.mjs` är borta | A17 |
| `GLTFLoader.js` | ingen när casino, floor-test, review och blender-table-scene är borta | A16 eller A17. A11 lämnar den |
| `idle-video-loop.mjs` | ingen när green-dealer är borta | A17, med krok rad 78 |
| `BufferGeometryUtils.js` | ingen redan nu | A17 |

## Föreslagen fördelning (A10–A17)

| Aktivitet | Får | Får inte |
| --- | --- | --- |
| A10 | test-only-modulerna, `dealer-studio.css`, 3D-testerna på krok 81–85, none-skripten i A10-listan, `load-dealer-rig.mjs`, de tre internal-filerna, rigg, `source/3d`, sweep-glb, `media/game/source/3d` | auditarna, `vendor/three`, `test/dealer-reach.mjs`, blender-filerna, `blackjack-3d/**`, `rigged-review.css` tills `build.mjs:12` är borta |
| A11 | casino-dokumentet, `casino.mjs`, `floor-test.html`, navigation, player-rig, blackjack-asset-state, GLB-filerna, `player.asset.json`, `tray.png`, raderna i server-ui, next.config, ingress, prepare och routes | `/v2`-rader, `shoe-model.mjs`, `vendor/three`, `cardback.png`, `shoe.png`, `chip-gold.png`, `table.png`, `room-extended.png` |
| A12 | API, lib, spelare, reservgrenarna i de namngivna komponenterna, `LAB_API`-token, original-media-tester | `web/public/**`, legacy-clip-inventory, studio-voice-lines |
| A13 | oförändrad. `port-source.mjs` är generatorn, inte död kod | ingen radering under B7 |
| A14 | game-staging utom att `targets.json` får en ny fixtur först, Amira-staging, astrid-head-v2 efter A10, `.pre-retime` | övrig Astrid-staging tills osäkerheten är löst |
| A15 | none-kandidaterna utom läppsynk och `mouth-crops.json` | hook/CI, läppsynkkedjan, A10, A16, `encode.sh` / `build-hands.sh` / `bake-composite.sh` |
| A16 | fem review-filer, review-only-modulerna, `test/animation-clock.mjs`, `test/movement-cues.mjs`, pipeline-green, composited först efter katalogbeslut, `/v2` enligt T2 | `legacyClipPolicy`, `performance-player.mjs`, `shoe-model` tills casino och table-scene är borta, `actor-compositor` |
| A17 | `table-scene.mjs`, `bo/media-preview.mjs` + test, `shoe-contact-occlusion`-testet, `BufferGeometryUtils.js`, kaskadtabellen, `family-video-upload.tsx` bara efter beslut | `page-template.mjs`, social-store, zone-workspaces, presentation-runtime-resolvern, migrate/deduplicate |
| A18 | oförändrad mot briefen. `build.mjs` är levande | Caddy och preview tills B15/T6 |

## Dokumentändringar som behövs

A17 för in dem. Inget dokument är ändrat här.

- `docs/system-map/routes.json` ~982 och gränstexten för `frontend-v2` /
  `frontend-casino-html`: " /v2 is not generally canonicalized" stämmer inte med
  `game-entry-contract.mjs:52`.
- `lab/README.md:408`: `/v2/` finns kvar som omdirigering, inte som egen spelare.
- `docs/system-map/flows.json` ~242: originalvägen beskrivs som DealerEngine
  bredvid den levande `playLocalClip`.
- `lab/VIDEO-LIBRARY.md:25` om A12 tar `/api/original-media`.
- `docs/ENVIRONMENT-VARIABLES.md` ~289 och `catalog.json` `environment.vercel-entry`
  när A18 flyttar `build.mjs`.
- `docs/JOHN-HANDOFF.md` ~394 om `.pre-retime` tas bort.
- A15:s kvarvarande verktyg (läppsynk, auditar, build-index, build-lab-video-manifest,
  pack-contact-media) ska in i `docs/LOCAL-PRESENTATION-RUNTIME.md`.

## Tveksamt

- `rigged-review.css` är namngiven av A18:s `build.mjs` och kopieras inte som
  klass. Parallell A10 ska lämna den.
- Astrids staging utom `astrid-head-v2` kan vara enda kalibrerings- eller
  godkännandekopian. Ingen kod pekar dit, men filerna är inte öppnade.
- `page-template.mjs` är ett falskt "no importer" från `lab-unused.mjs`.
- `test/speech-playback.mjs` blandar död `DealerEngine` med levande `speech-queue.mjs`.
- `pipeline/lipsync-overrides.json` kan vara en basnamnsträff, inte en extern konsument.
- Partnerns `deals`-lista från performance-manifestet är levande kod. Om något
  paket faktiskt anropar den avgör A30, inte den här läsningen.
- `background-zone-schedule.test.mjs` ligger i `lab/lib/` och träffas inte av
  `lab/package.json` testglob.
