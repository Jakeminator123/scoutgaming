# A04 · Medieinventering (läsande)

| Fält | Värde |
| --- | --- |
| Våg | 1 · parallell med alla · skriver bara i `ordning/rapporter/` |
| Väntar på | – |
| Leder till | B6, B8, B10, B11 · A10–A16, A30, A31 |
| Branch / worktree | `jakob/ordning-inventering` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-inventering` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 5 % |

## Mål

Ett bevisat svar per medieträd: vem använder det i dag, finns en molnkopia,
följer det med i Render-imagen eller Vercel-bundlen, och vad är rätt åtgärd?

## Fakta (00ea55c5)

Se BASLINJE §2. `media/` är 732 MB av 790. All `media/**/runtime` bakas in i
Render-imagen (`ops/cloud/Dockerfile`: `COPY . .`, `.dockerignore` utesluter
bara `source`, `staging` och `review`). Studio-bundlen utesluter
`media/dealers/**` men tar med `media/layout.json`, `media/blob-index.json`
och `media/catalog/*.json`.

Kända konsumenter av den indexerade banken utanför `pipeline/`:
`lab/lib/legacy-clip-inventory.mjs`, `lab/lib/original-media-server.mjs`,
`lab/lib/studio-voice-lines.mjs`, `web/clip-mapping.mjs`,
`web/partner-presentation.mjs`, `web/public/dealer-engine.mjs`,
`tools/build-runtime-media-catalog.mjs` (`--check` i kroken),
`tools/deduplicate-media.mjs` och `tools/migrate-media-layout.mjs`, plus tester.

## Ägda filer

Endast `ordning/rapporter/A04-medieinventering.md` (ny). Allt annat läses.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kör
   `node ordning/verktyg/tree-sizes.mjs media 5` och jämför med BASLINJE §2.
1. **Träd för träd** (djup 4–6 efter behov) för varje dealer
   (`astrid`, `vera`, `amira`, `mei` och övriga under `media/dealers/`),
   `media/game/*` och `media/site/*`. Ange:
   - storlek och antal filer;
   - konsumenter: `rg` på sökvägsfragment och filnamn i kod, tester, verktyg och
     konfig. Uteslut `media/`, `ordning/`, `random/`, `planes/` och
     `docs/system-map/index.html`, och skilj produkt, Studio, test, pipeline och
     dokument åt;
   - om logiska sökvägar finns i `media/layout.json`, `media/blob-index.json`
     (Blob-kopia?), `media/catalog/presentation.json` och `legacy.json`,
     `media/dealers/*/runtime/presentation/lab-video-manifest.json` och
     `docs/qa/*.json`. Läs JSON-filerna riktat, med nycklar eller rg, inte i
     sin helhet;
   - om trädet följer med i Render-imagen (`.dockerignore`) och Studio-bundlen
     (`lab/next.config.mjs`).
2. **Klassa** varje träd: `runtime-spel` · `runtime-layer-lane` ·
   `studio-reserv` · `partnerprotokoll` · `ci-kontroll` · `test-fixtur` ·
   `pipeline` · `ingen`.
3. **Per dealer:** hur väljer spelet media i dag? Följ
   `web/public/game-entry-contract.mjs` → `/api/presentation/config|select|videos`
   i `web/presentation-api.mjs` → registrerad media
   (`lab/lib/video-registry.mjs`, `cloud-media-store.mjs`). För layered:
   `/layer-packs/` i `web/layer-packs.mjs`. Avgör **T1** (handoffens "Rätt
   dealer" mot koden) så långt koden räcker. Skriv vad som bara kan avgöras med
   produktionsdata.
4. **Rekommendation per träd:** behåll · flytta (vart) · ta bort (vilken
   aktivitet) · utred (vad saknas). Ta med bytevinst för Git-trädet och
   Render-imagen.
5. **Produktionsfrågor:** frågor som bara Neon eller Blob kan besvara (frysta
   paket, uppladdade videor, Blob-objekt). Orkestratorn läser dem.

## Rapportformat

Tabell: `träd | MB | filer | klass | konsumenter (fil:rad) | Blob | Render | Studio-bundle | åtgärd | aktivitet`.
Därefter avsnitten "Per dealer", "T1", "Produktionsfrågor" och "Tveksamt".

## Klart när

- [ ] Varje träd över 1 MB och varje träd som nämns i A10–A16 och A30 är klassat
      med bevis.
- [ ] T1 är besvarad eller avgränsad till konkreta produktionsfrågor.
