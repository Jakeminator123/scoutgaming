# A11 · Kasinogolvet `/casino.html`

| Fält | Värde |
| --- | --- |
| Våg | 2 · omgång 2 · mergas in efter A18 och A10, före A16 |
| Väntar på | B5 · A05 · A10 och A18 inmergade |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 25 % · frontendbygget följer kasinots importträd |

## Mål

3D-kasinogolvet är pensionerat. `/casino.html` svarar med en permanent
omdirigering till `/play`, så att gamla länkar fungerar. Kod, GLB-filer och
byggsteg som bara fanns för golvet är borta.

## Fakta (00ea55c5)

- `web/public/casino.html` och `casino.mjs` importerar
  `vendor/three/three.module.js`, `vendor/three/GLTFLoader.js`,
  `casino-navigation.mjs`, `shoe-model.mjs` och `player-rig.mjs`.
  `floor-test.html` laddar `/assets/casino-floor.glb`.
- Golvet länkas inte från något gränssnitt, men byggs och serveras:
  - `apps/croupier-frontend/tools/prepare-platform-ui.mjs` följer importerna
    från `casino.mjs` och kopierar `casino.html` till `runtime-ui/`;
  - `apps/croupier-frontend/lib/server-ui.mjs` har `['/casino.html','casino.html']`;
  - `apps/croupier-frontend/next.config.mjs` har
    `outputFileTracingIncludes['/casino.html']`;
  - `apps/croupier-frontend/app/casino.html/route.ts`;
  - `ops/cloud/vercel-ingress.mjs` har `['/casino.html','/casino.html']`;
  - `apps/croupier-frontend/test/platform-ui.mjs` (rad ~292, ~299) och
    `ops/cloud/test/vercel-ingress.test.mjs` testar golvet;
  - `docs/system-map/routes.json` har rutten (rad ~1205–1224).
- Media: `media/game/runtime/assets/casino-floor.glb` (17,5 MB), `player.glb`
  (2,2), `player.asset.json`, `blackjack-3d/{blackjack-table.glb,blackjack-room.glb,profile.json}`
  (4,6). Kontrollera även `table.png`, `room-extended.png`, `shoe.png`,
  `cardback.png`, `tray.png` och `chip-gold.png`. De kan användas av spelet.
- Tester: `test/casino-navigation.mjs` (i kroken), `test/blackjack-asset-state.mjs`
  (med `web/public/blackjack-asset-state.mjs`, som bara nås från test).

## Ägda filer

Filerna ovan, efter justering mot A05, samt deras rader i
`.githooks/pre-commit-full` och `docs/system-map/routes.json`. Kontrollera
`shoe-model.mjs` och `vendor/three/*` innan de tas bort: de kan ha andra
konsumenter. Lämna dem i så fall kvar.

**Rör inte:** `/v2`-raderna i samma filer (A16), media som spelet använder och
dokument (lista behovet för A17).

## Steg

0. Steg 0 enligt ORKESTRERING §4. Ombasera på `main` efter att A10 mergats.
1. **Omdirigering:** byt `apps/croupier-frontend/app/casino.html/route.ts` till
   en 308 till `/play` med samma query, enligt mönstret för befintliga
   omdirigeringar. Uppdatera route-posten i `routes.json` (metoder, syfte) och
   frontendens test för att visa omdirigeringen.
2. **Bygget:** ta bort kasinokön och kopieringen av `casino.html` i
   `prepare-platform-ui.mjs`, raden i `server-ui.mjs`, include-raden i
   `next.config.mjs` och raden i `vercel-ingress.mjs` (ersätt med
   omdirigeringen, om ingressen hanterar adressen före Next).
3. **Ta bort** kasinokoden, GLB-filerna och testerna (`git rm`), samt raderna i
   kroken. Uppdatera medieregistren via verktygen (se A10 steg 1).
4. **Prov:**
   - `node --test apps/croupier-frontend/test/platform-ui.mjs apps/croupier-frontend/test/game-entry.mjs ops/cloud/test/vercel-ingress.test.mjs`;
   - `node tools/check-orphan-tests.mjs`;
   - `node docs/system-map/verify.mjs --check`;
   - `node tools/build-runtime-media-catalog.mjs --check`;
   - orkestratorn kör `pnpm --dir apps/croupier-frontend build` med samma
     miljö som CI använder för plattformsbygget.

## Klart när

- [ ] `/casino.html` ger 308 till `/play` (provat lokalt i test och efter deploy
      i produktion).
- [ ] Frontendbygget och hela sviten är gröna.

## Tveksamt att lyfta

- Om någon bild i `media/game/runtime/assets/` har en spelkonsument.
- Om `vendor/three` fortfarande behövs av något annat. Det avgörs annars i A17.
