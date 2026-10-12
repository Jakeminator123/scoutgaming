# A21 · `presentation-runtime/` in i `packages/presentation`

| Fält | Värde |
| --- | --- |
| Våg | 3 · efter A20 · ensam |
| Väntar på | A20 mergad och deployad |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 30 % · cirka 45 importörer och en publik URL |

## Mål

Urvals- och idleregler ligger i `packages/presentation/runtime/` bredvid
kompositorn. Beroendena utåt är kartlagda för A22. Webbläsarens URL
`/presentation-runtime/*` är oförändrad.

## Fakta (00ea55c5)

- 14 filer: `idle-policy`, `legacy-clip-policy` (+ `.d.mts`),
  `legacy-standard-variants`, `live-idle`, `media-families`,
  `media-family-policy`, `media-family-resolver`, `registered-idle-policy`
  (+ `.d.mts`), `registered-idle-rules`, `registered-idle`, `selection` och
  `shoe-transitions`.
- Beroenden **utåt** (fel håll för ett delat paket): `lab/lib` (13 importer),
  `lab/components` (1), `lab/policies` (1), `open-claw/lab/src` (3),
  `web(server)` (2) och `web/public` (2).
- Cirka 45 konsumenter i `lab/lib`, `lab/components`, `lab/test`, `web/`,
  `web/storage/`, `web/public/local-presentation.mjs`, `test/`, `tools/`,
  `ops/vercel-entry/build.mjs` och `docs/system-map/flows.json`
  (`rg -l 'presentation-runtime/'`).
- Publik väg: `web/server.mjs` (rad ~868) serverar `/presentation-runtime/*` till
  webbläsaren. `ops/vercel-entry/build.mjs` (rad ~20) släpper igenom sökvägar
  som börjar med `presentation-runtime/`.

## Ägda filer

`presentation-runtime/**` → `packages/presentation/runtime/**`, och
importrader i alla konsumenter (bara sökvägar). Dessutom serveringslogiken i
`web/server.mjs` (bara mappningen URL → fil), `ops/vercel-entry/build.mjs`
(samma), `docs/system-map/*.json`, `docs/environment-variables.json` (om en
flyttad fil står som `source`), sökvägsrader i dokument och rader i kroken.

**Rör inte:** logiken i filerna. Beroendena utåt vänds inte här; de listas för
A22.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Inga öppna PR:er som rör konsumenterna.
1. **Commit 1, ren flytt:** `git mv presentation-runtime packages/presentation/runtime`.
2. **Commit 2, sökvägar:**
   - Relativa importer i alla konsumenter. Kontrollera djupet (`../` blir
     `../../packages/presentation/runtime/` osv.).
   - `web/server.mjs`: URL:en `/presentation-runtime/<fil>` serverar filen från
     den nya platsen. URL:en ändras inte.
   - `ops/vercel-entry/build.mjs`: samma mappning.
   - `web/public/*`, som laddar via URL, ändras inte.
3. **Beroendekarta** i rapporten: varje import från `runtime/` till `lab/`,
   `web/` och `open-claw/`, med vad som används. Det är indata till A22.
4. **Prov:**
   - `node --test` för alla testfiler som importerar paketet
     (`rg -l 'packages/presentation/runtime' test lab/test ops web | …`);
   - `node --test test/local-presentation.mjs test/presentation-select-dealers.mjs test/registered-idle.mjs test/registered-idle-rules.mjs test/frozen-dealer-events.mjs test/registered-cloud-playback.mjs lab/test/legacy-clip-policy.test.mjs lab/test/shoe-transitions.test.mjs ops/vercel-entry/test/build-preview.mjs`;
   - `node tools/astrid-select-baseline.mjs` i kontrolläge (baslinjen 160 anrop
     ska vara oförändrad; skriv inte med `--write`);
   - `node docs/system-map/verify.mjs --check`,
     `node tools/check-environment-variables.mjs` och
     `node tools/check-orphan-tests.mjs`;
   - orkestratorn: Studio-bygge, frontendbygge, hela sviten, och efter deploy
     rehearsal för fyra dealers.

## Klart när

- [ ] `presentation-runtime/` finns inte. `/presentation-runtime/*` svarar som förut.
- [ ] Astrid-baslinjen för select är oförändrad, och alla prov och byggen är gröna.
- [ ] Beroendekartan för A22 finns i rapporten.

## Tveksamt att lyfta

- Om någon extern partner laddar `/presentation-runtime/*` direkt. Då måste URL:en
  vara permanent.
