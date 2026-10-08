# Prompt T9: lagerspelaren från test-video-jakob bakom en flagga i spelet

Kör i en egen agent/chatt. **Modell: Claude Opus 5.5 (max) eller GPT-5.3-codex** – det
rör spelklientens presentationsväg (`web/public/app.mjs`) och måste hålla dagens Astrid-
väg byte-identisk. Orkestratorn granskar före merge. Jakob 8 okt: grenen `test-video-jakob`
är inte redo för main som helhet, men fler features får tas in. Media stannar som filer.

Skriven 8 okt 2026 av orkestrator 2 efter `5912800e`. Checklista: T9, T4, T5, C7.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md`
(Dealer speech, media, cards, wallet – hela avsnittet), `docs/JOHN-HANDOFF.md` (8 okt),
`random/checklista-2026-10-08.md` (T-spåret), `random/k1-fakta-spelvagen-2026-10-08.md`
(tabell 2: prod spelar en full-frame mp4; keyat material bara i `/v2`),
`test-videoeditor/README.md`, `test-videoeditor/program/docs/INTEGRATION.md` (**grenens
egen integrationsordning – följ steg 4: "bakom ett separat val/feature flag, nuvarande
spelväg återställbar"**), `test-videoeditor/program/docs/FORMATLASNING.md`,
`test-videoeditor/program/web/{player,compositor,bridge,geometry,lanes}.js`,
`test-videoeditor/preview/site/catalog.json` (hur Paow-paketet beskrivs: dealer, variant,
clips med role/duration, background, table, layers), `lab/tools/prepare-preview.mjs`
(hur grenens filer speglas och hashas in i `lab/preview-build`), `lab/app/preview/[...path]/route.ts`
(sessionsskyddad filservering), `web/public/app.mjs` (sök `localPresentationEnabled`,
`presentation=`, `gameLaneFromDocument`, `#scene`, `table-pick`, `player-choices`),
`web/public/game-entry-contract.mjs` + `web/public/game-lanes.mjs` (dataset: `gameLane`,
`gameDealer`, `gamePresentation`, `gameChoices` från N3.4), `web/game-entry-operator.mjs`,
`web/partner-presentation.mjs` (typen `presentation[]` som bridge.js konsumerar),
`web/public/local-presentation.mjs`. Läs grenen med `git show origin/test-video-jakob:<path>`
– **ingen checkout, ingen merge av grenen**. Ingen commit/push/branch utan orkestratorns
ord. Inget mot produktion. Agent-talk-id `t9-lager`: `node tools/agent-talk.mjs status
t9-lager` vid start, var 30:e sekund, före rapport.

## Fakta

- `test-videoeditor/program/web/*` i main är en byte-identisk spegel av grenen; den
  Python-verkstaden (`program/studio/*.py`, `server.py`) stannar på grenen.
- `bridge.js` tar `{ roundId, presentation[] }` från servern och spelar deal/reveal
  som lager; `unsupported[]` för tal, settle, turn, split. Kort ritas av värdspelet.
- Prod-vägen: `gameLane: mobile-phone`, `presentation: local`, Astrid full-frame mp4
  + SVG-kort. Astrid-baslinjen (`tools/astrid-select-baseline.mjs`, 160 anrop) **måste**
  förbli grön; `select` rörs inte.
- Paow/Dragge-paketet (720p, 12 MB) ligger som filer under `lab/preview-build` (gitignorerat,
  byggs av `prepare-preview`) och serveras bara bakom adminsession på `/studio/preview/*`.

## Mål: tre lager i spelet som opt-in, utan att röra dagens väg

1. **Serverkatalog: ny lane-renderer `layered`.** I `web/public/game-lanes.mjs`
   `GAME_LANES` (eller där katalogen definieras) lägg lane-id `layer-preview` med
   `renderer: 'layered'`, `dealer: 'paow'`, `presentation: 'layered'`. `gameLaneSelection`
   returnerar `presentation: 'layered'` för den; `gameLaneFromDocument` accepterar
   `layered` **bara** när `gameLane === 'layer-preview'`. Standardlane och
   `mobile-phone` oförändrade (byte-jämförelsetestet ska vara oförändrat utan `?lane=`).
   Lanen är **inte** aktiv i `policy.gameLane`; den nås bara via `?lane=layer-preview`
   eller ett operatörspaket som listar den. Dealer-id `paow`/`dragge` läggs till i
   `dealers`-listan för lane-validering men **inte** i `project.dealers` (Studio har
   exakt fyra; rör inte `studio-model`).
2. **Paketfiler till spelet.** `prepare-preview.mjs` producerar även `web/public/layer-packs/
   <dealer>/manifest.json` + media som **symlink/kopia från `lab/preview-build`**? Nej –
   `web/public` är publik och Jakob vill inte ha media publikt förrän klart. Gör i stället:
   Render-servern serverar `/layer-packs/<dealer>/*` **bara** när `?lane=layer-preview`
   är vald i sessionen (cookie/flagga satt av entry) och filerna finns lokalt under
   `lab/preview-build` (läs `previewBuildDirectory`). Saknas filerna → lanen svarar
   `unavailable` och klienten faller tillbaka till 2D-reserv med texten `Lagerpaket saknas`.
   Range-stöd och `Cross-Origin-Resource-Policy: same-origin` som i `/preview/[...path]`.
3. **Klient: `web/public/layered-presentation.mjs`** (ny) importerar `player.js`,
   `compositor.js`, `bridge.js`, `geometry.js` från `/layer-packs/runtime/` (kopior av
   `test-videoeditor/program/web/*.js` som `prepare-preview` redan verifierar) och
   monterar en `<canvas>` i `#scene` **i stället för** `<video>` när
   `gamePresentation === 'layered'`. `bridge.consume({ roundId, presentation })` matas
   med samma serverlista som `local-presentation.mjs` får i dag. `unsupported[]`
   loggas till Uppspelning (`recordActivity`-vägen, se hur `local-presentation` kvitterar)
   och **lämnas till värdspelet**: tal spelas inte (Paow har inga repliker), settle/turn
   visas av dagens DOM/HUD. Kort ritas fortfarande av dagens SVG-lager ovanpå canvasen
   (bridge:s kortstaplar stängs av: `boxBase: 0`, ingen egen kortritning).
4. **Spelarens val (N3.4) kopplas:** `gameChoices.background` är inte längre `baked`
   för `layer-preview`; bakgrund/bord från `catalog.json` (`a_nearly_still…`,
   `emil-v3-table`) listas som tillåtna och `player-choices.mjs` skickar valet till
   `player.setAssets`. Dealerbyte Paow↔Dragge via samma panel. För `mobile-phone`
   förblir allt som i dag.
5. **Rehearsal-panelen** (`?rehearsal=1`) fungerar för `layer-preview`: välj deal-klipp
   ur manifestet, Play twice, kvitton `card-landed`/`queue-idle` syns i statusraden.
6. **Inget** i wallet, shoe, kort, auth. `web/shoe-game.mjs` orörd. `select`/`presentation-api`
   orörda (Paow går inte via `select`; den har inga varianter än).

## Tester

- `test/game-lanes.mjs`: `layer-preview` → `layered`; `mobile-phone` byte-identiskt;
  `gameLaneFromDocument` avvisar `layered` på fel lane.
- `test/layered-presentation.mjs` (nytt, fejk-DOM som `test/player-choices.mjs`):
  monterar canvas, `consume` med en deal-lista ger `card-landed`-kvitto; `unsupported`
  för `speak` loggas, inte kastas; saknat paket → 2D-reserv + text.
- `test/layer-packs-route.mjs`: 404 utan lane-flagga, 200 + Range med; path-traversal 404.
- `test/presentation-select-astrid-baseline.mjs` grön (du rör inte select, men kör den).
- `node pipeline/audit-dealer-sync.mjs --probe` PASS; `node test/fuzz-blackjack.mjs` grön;
  `.githooks/pre-commit`-testerna gröna.
- Lokalt: `node lab/start.mjs --no-open`, öppna `/blackjack?lane=layer-preview&rehearsal=1`
  i den redan öppna fliken (ingen ny flik), ta EN skärmbild till rapporten, stäng
  servrarna efteråt.

## Rapport

Tabell Åtgärd | Status | Verifierat hur | Risk %. Vilka filer från grenen som nu körs i
spelet (lista) och hur de hålls byte-identiska (hash). Vad `unsupported[]` innehöll i
provet. **Tveksamt**: allt där du valt mellan grenens antaganden och repots (särskilt
kortritning, box-mappning 0..6→1..7, och om `layer-preview` ska kunna publiceras i ett
operatörspaket redan nu).
