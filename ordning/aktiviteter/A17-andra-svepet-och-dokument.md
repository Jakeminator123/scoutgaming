# A17 · Andra svepet: föräldralös kod och samlade dokumentändringar

| Fält | Värde |
| --- | --- |
| Våg | 2 · sist, efter att A10–A16 är mergade eller strukna |
| Väntar på | A10–A16 · rapporternas "Dokumentändringar som behövs" |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 20 % |

## Mål

Det som blev föräldralöst när våg 2 tog bort sina områden tas bort.
Dokumenten beskriver det nya läget i ett samlat pass.

## Fakta (00ea55c5, före våg 2)

- Utan konsument i `web/public`: `table-scene.mjs` och `dealer-studio.css`
  (om A10 inte redan tagit den).
- Bara test: `blackjack-asset-state`, `bo/media-preview`, `ready-motion` och
  `shoe-contact-occlusion` (de som A10, A11 och A16 inte redan tagit). Moduler
  som bara granskningssidorna når hör till A16.
- Studio utan importör: `family-video-upload.tsx`, `page-template.mjs` och
  `kevin-bo/port-source.mjs` (generator, A13 avgör). Bara test:
  `background-zone-schedule.mjs`, `media-family-resolver.mjs`,
  `social-store.mjs` och `zone-workspaces.mjs`. Kan vara planerade funktioner,
  så märk dem `kräver beslut`.
- Kandidater efter A12: `dealer-engine.mjs`, `actor-compositor.mjs`,
  `actor-edge-blend.mjs`, `actor-grade.mjs`, `speech-playback.mjs`,
  `vendor/three/*` och `performance-contact.mjs`. Bara om de saknar
  produktkonsument efter våg 2 och A30 inte behöver dem.
- Från våg 1–2: täckningsluckorna i `ordning/rapporter/A00-tackning.md`
  (`apps/croupier-frontend/public`, `media/site/*`, `services/astrid-gpu-worker/assets`,
  `pipeline/data`, `pipeline/irs`). Därtill `pipeline/load-dealer-rig.mjs`, som
  importerar den borttagna `dealer-rig.mjs` (A10), kommentarer som nämner
  borttagna skript (`web/public/styles.css`, `pipeline/build-index.mjs`,
  `pipeline/trim-speak-start.py`), `ops/cloud/CONTAINER-CONTEXT.md` och
  `.dockerignore`-rader för `assets/astrid-3d` och `assets/blackjack-3d`, samt B17
  (ignoreringsregler) om Jakob säger ja.
- Från våg 1–2: täckningsluckorna i `ordning/rapporter/A00-tackning.md`
  (`apps/croupier-frontend/public`, `media/site/*`, `services/astrid-gpu-worker/assets`,
  `pipeline/data`, `pipeline/irs`). Därtill `pipeline/load-dealer-rig.mjs`, som
  importerar den borttagna `dealer-rig.mjs` (A10), kommentarer som nämner
  borttagna skript (`web/public/styles.css`, `pipeline/build-index.mjs`,
  `pipeline/trim-speak-start.py`), `ops/cloud/CONTAINER-CONTEXT.md` och
  `.dockerignore`-rader för `assets/astrid-3d` och `assets/blackjack-3d`, samt B17
  (ignoreringsregler) om Jakob säger ja.
- Engångsverktyg: `tools/migrate-media-layout.mjs` och
  `tools/deduplicate-media.mjs`, med `test/media-migration.mjs` och
  `test/media-deduplication.mjs` i kroken. De behålls om de används för
  registren.

## Ägda filer

Kandidaterna ovan efter förnyad mätning, samt dokumenten
`docs/LOCAL-PRESENTATION-RUNTIME.md`, `docs/CLOUD-MIGRATION.md`,
`docs/JOHN-HANDOFF.md` (avsnittet "Senaste leveranser"), `lab/docs/README.md`,
`lab/README.md`, `lab/VIDEO-LIBRARY.md`, `open-claw/lab/docs/*`, `AGENTS.md`
(bara medie- och legacyrader som blivit fel) och `CLAUDE.md` (samma).

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kör alla fem verktyg och jämför med
   BASLINJE och med varje våg 2-rapport.
1. **Föräldralöst:** för varje kandidat, bevisa att den saknar produktkonsument
   (`public-reach.mjs`, `lab-unused.mjs`, `rg`). Ta bort den tillsammans med
   tester som bara skyddar den, och raderna i kroken.
2. **Dokument:** för in varje punkt från rapporternas "Dokumentändringar som
   behövs". Uppdatera regler i AGENTS.md och CLAUDE.md som pekar på borttagna
   filer, t.ex. rader om `test-videoeditor` (lämnas till A20) och 3D. Lägg in
   A15:s lista "Verktyg som finns kvar".
3. **Daterade OpenClaw-dokument:** `open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md`
   och liknande. För in det som fortfarande gäller i `open-claw/lab/docs/README.md`
   eller `DEPLOYMENT.md`, och ta bort resten. Läs först
   `open-claw/lab/docs/README.md` (projektregel).
4. **Tomma mappar:** kör `git ls-files` per mapp som omgångarna rört. Ta bort
   platshållare (`.gitkeep`, tomma README) i mappar utan annat spårat innehåll
   och utan användning. Lista mappar som bara innehåller ignorerade lokala filer
   för A19. Ta aldrig bort `web/public/review/2026-09-09/`, `lab/data`,
   `web/data` eller `random/` lokalt.
5. **Prov:** `node tools/check-orphan-tests.mjs`,
   `node docs/system-map/verify.mjs --check`, riktade `node --test` och
   `rg` efter länkar till borttagna filer.

## Klart när

- [ ] `public-reach.mjs` ger 0 `none` och 0 `test-only` utom motiverade undantag.
- [ ] `lab-unused.mjs` ger bara motiverade poster.
- [ ] Inga dokument pekar på borttagna filer.

## Tveksamt att lyfta

- Test-only-moduler i `lab/lib` som kan vara halvfärdiga funktioner.
- Om `vendor/three` ska bort helt.
