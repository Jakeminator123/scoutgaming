# A05 · Kodinventering: död och legacybunden kod (läsande)

| Fält | Värde |
| --- | --- |
| Våg | 1 · parallell med alla · skriver bara i `ordning/rapporter/` |
| Väntar på | – |
| Leder till | B4–B10 · exakta filistor för A10–A17 |
| Branch / worktree | `jakob/ordning-inventering` (delas med A04 och A06) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 5 % |

## Mål

Verifierade filistor per avvecklingsområde: filer, konsumenter, tester i
kroken, poster i systemkartan, dokumentnämningar och vad som blir föräldralöst
i nästa steg.

## Fakta (00ea55c5)

Se BASLINJE §3. Utgångslistor:

- `web/public`: 13 moduler bara för test, 6 bara för pipeline, 3 utan
  konsument (`node ordning/verktyg/public-reach.mjs`).
- `pipeline/`: 87 skript utan konsument, 14 bara interna
  (`node ordning/verktyg/pipeline-consumers.mjs`).
- Studio: 4 utan importör, 4 bara för test (`node ordning/verktyg/lab-unused.mjs`).
- 3D-tester i kroken (`.githooks/pre-commit-full` rad ~81–85):
  `dealer-motion`, `dealer-skin-contact`, `rigged-card-layout`,
  `rigged-layout-contact`, `rigged-discard-state`, `dealer-collection`,
  `dealer-face`, `rigged-face-playback`, `rigged-face-bindings`,
  `dealer-face-calibration`, `dealer-face-skin`. Dessutom körs
  `pipeline/audit-astrid-actor.mjs` och `audit-performance.mjs` (rad ~68–69).
- `/casino.html`: frontendbygget följer `web/public/casino.mjs`
  (`three`, `GLTFLoader`, `casino-navigation`, `shoe-model`, `player-rig`).
  Inte länkad från något gränssnitt.
- Originalmedia i Studio: `lab/app/api/original-media/**`,
  `lab/lib/original-media{,-server,-runtime}.mjs`,
  `lab/components/original-media-player.tsx` och konsumenterna `stage.tsx`,
  `studio-session.tsx`, `control-activity-page.tsx`, `control-events-page.tsx`,
  `events-preview.tsx`, `event-tree.tsx`, `events-inspector.tsx`,
  `game-stream.tsx`, `video-library.tsx`, `video-coverage.tsx` och
  `speech-source.tsx`.

## Ägda filer

Endast `ordning/rapporter/A05-kodinventering.md` (ny).

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kör alla fem verktyg och jämför.
1. **Per område** (3D/rigg/ansikte · kasinot · originalmedia i Studio ·
   `/v2` och composited/grön nyckling · staging · pipeline-rest ·
   `web/public`-rest · Studio-rest · engångsverktyg i `tools/` som
   `migrate-media-layout.mjs` och `deduplicate-media.mjs`):
   - filer (exakta sökvägar);
   - importörer och namnare, uppdelade på produkt, test, pipeline och dokument
     (fil:rad);
   - tester i kroken eller CI som skyddar området, och om de bara skyddar det;
   - poster i `docs/system-map/{routes,flows,contracts,catalog}.json`;
   - nämningar i `docs/*.md`, `lab/docs`, `lab/README.md`, `AGENTS.md` och
     `CLAUDE.md`;
   - miljövariabler som bara området läser (`docs/environment-variables.json`);
   - delade moduler som **ska stå kvar**, t.ex. `local-film-player.mjs`,
     `verified-video-buffer.mjs`, `card-art.mjs`, `performance-player.mjs` och
     `shoe-model.mjs`, om de har andra konsumenter.
2. **T2:** vad `/v2` gör i dag. Följ `apps/croupier-frontend/app/v2/route.ts`,
   `apps/croupier-frontend/lib/server-ui.mjs`, `ops/cloud/vercel-ingress.mjs`,
   `web/public/dealer-version-switcher.mjs` och `app.mjs`.
   **T3:** vad `audit-astrid-actor.mjs` och `audit-performance.mjs` skyddar.
3. **Kaskader:** vad blir föräldralöst när ett område tas bort? Exempel:
   tas originalmedia bort, så tappar `dealer-engine.mjs`, `actor-compositor.mjs`,
   `actor-edge-blend.mjs`, `actor-grade.mjs`, `speech-playback.mjs` och
   `vendor/three/*` kanske sin sista konsument. Kontrollera varje. Detta är
   indata till A17.
4. **Märk** varje fil `säker` (ingen produktkonsument, inget beslut behövs utöver
   områdets B), `kräver beslut` (nåbar för användare) eller `osäker`
   (dynamisk laddning, strängbyggda sökvägar).

## Rapportformat

Ett avsnitt per område med tabellen `fil | klass | konsumenter | tester | systemkarta | dokument | märkning`.
Därefter avsnitten "T2", "T3", "Kaskader", "Föreslagen fördelning per aktivitet
(A10–A17)" och "Tveksamt".

## Klart när

- [ ] Varje fil i A10–A17:s preliminära listor är bekräftad, flyttad till rätt
      aktivitet eller struken, med bevis.
- [ ] T2 och T3 är besvarade.
