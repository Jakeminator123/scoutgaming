# A12 · Originalmedia som reservvisning i Studio

| Fält | Värde |
| --- | --- |
| Våg | 2 · parallell med A10, A13, A15, A16 · före A17 och A30 |
| Väntar på | B6 · A04 (registrerad media finns för det Studio visar) · A05 |
| Branch / worktree | `jakob/ordning-a12` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a12` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 35 % · många Studio-sidor berörs |

## Mål

Studio visar bara registrerad media. Saknas en video visas den befintliga
statustexten "Ingen spelbar video för den här situationen …". API:t
`/api/original-media` och dess server- och klientkod är borta.

## Fakta (00ea55c5)

- Spelklienten använder inte originalmedia: `web/public/app.mjs` kräver
  presentation `local` eller `layered`.
- Studio:
  - `lab/components/stage.tsx` visar `OriginalMediaPlayer` när ingen
    registrerad video finns (`showOriginal`).
  - `studio-session.tsx` och `control-activity-page.tsx` hämtar
    `/api/original-media`.
  - `control-events-page.tsx`, `video-library.tsx` och `game-stream.tsx` använder
    `resolveOriginalDefault`.
  - `events-preview.tsx` har typerna `OriginalMediaCatalog` och
    `OriginalMediaEntry`.
  - Dessutom `event-tree.tsx`, `events-inspector.tsx`, `video-coverage.tsx` och
    `speech-source.tsx`.
- Server: `lab/app/api/original-media/route.ts`, `[...path]/route.ts`,
  `lab/lib/original-media.mjs`, `original-media-server.mjs` (+ `.d.mts`) och
  `original-media-runtime.mjs` (serveras som fil). `MODULES` listar
  webbklientmoduler som serveras till Studio: `dealer-engine`,
  `actor-compositor`, `actor-edge-blend`, `actor-grade`, `speech-playback`,
  `performance-player`, `local-film-player`, `verified-video-buffer`,
  `performance-contact`, `card-art`, `dealer-reach`, `scene-join` och
  `vendor/three/*`.
- Routning: `apps/croupier-frontend/lib/platform-routing.mjs`, `LAB_API`
  (rad ~39), innehåller `original-media`.
- Systemkarta: `routes.json` (rad ~2034–2053), samt `flows.json` och
  `contracts.json`.
- Tester: `lab/test/original-media.test.mjs`,
  `lab/components/original-media-player.test.mjs`, delar av
  `lab/test/blob-source-routing.test.mjs`, `lab/test/game-stream-lifecycle.test.mjs`
  och `lab/components/video-workflow.test.mjs`.
- **Ska stå kvar:** `lab/lib/legacy-clip-inventory.mjs` och
  `lab/lib/studio-voice-lines.mjs`. De läser den indexerade banken för andra
  syften (A30). Webbklientmodulerna i `MODULES` tas inte bort här (A17).

## Ägda filer

Server- och klientfilerna ovan, konsumentkomponenterna (bara reservlogiken),
`platform-routing.mjs` och dess test, testerna ovan, poster i
`docs/system-map/{routes,flows,contracts}.json`, och rader i kroken om en
testfil tas bort.

**Rör inte:** `web/public/**`, `lab/lib/legacy-clip-inventory.mjs`,
`lab/lib/studio-voice-lines.mjs`, `lab/lib/video-registry.mjs` och dokument
(lista behovet för A17, t.ex. `lab/VIDEO-LIBRARY.md` och `lab/docs/README.md`).

## Steg

0. Steg 0 enligt ORKESTRERING §4. Läs A04:s Studio-svar: finns registrerad media
   för varje dealer och händelse som Studio i dag visar via reserven? Finns
   luckor ska de stå i rapporten, och B6 i prompten måste uttryckligen godta
   dem. Annars stoppa.
1. **Kartlägg** i varje konsument vad som händer utan originaldata. Ta bort
   reservvägen, men behåll registrerad visning och felmeddelanden.
2. **Ta bort** API, lib, spelare och tester. Uppdatera `LAB_API` och
   frontendens routningstest.
3. **Systemkartan:** ta bort route-, flödes- och kontraktsposterna. Lägg in
   motsvarigheten om ett kontrakt bara bytt källa.
4. **Prov:**
   - `node --test lab/test/*.test.mjs lab/components/*.test.mjs`, eller de som
     berörs;
   - `node --test apps/croupier-frontend/test/platform-ui.mjs`;
   - `npx --prefix lab tsc --noEmit -p lab/tsconfig.json`, eller det kommando
     lab använder;
   - `node docs/system-map/verify.mjs --check` och
     `node tools/check-orphan-tests.mjs`;
   - orkestratorn kör `npm --prefix lab run build`.
5. **Kaskad:** kör `node ordning/verktyg/public-reach.mjs` och lista moduler
   som nu saknar konsument. Det är indata till A17.

## Klart när

- [ ] Ingen kod refererar `original-media`.
- [ ] Studio-sidorna Händelser, Uppspelning, Klippbibliotek och Dealers & klipp
      fungerar med registrerad media (prov plus orkestratorns manuella koll i
      lokal offline-Studio).
- [ ] Studio-bygget och hela sviten är gröna.

## Tveksamt att lyfta

- Varje händelse eller dealer som tappar förhandsvisning.
- Om `speech-source.tsx` eller `video-coverage.tsx` använder originaldata för
  annat än visning, t.ex. täckningsstatistik.
