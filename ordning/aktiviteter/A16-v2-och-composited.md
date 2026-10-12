# A16 · `/v2` och nycklad composited-media

| Fält | Värde |
| --- | --- |
| Våg | 2 · utvecklas parallellt, mergas efter A11 (samma frontendfiler) |
| Väntar på | B10 · A04 (paket och partnerprotokoll) · A05 (T2: vad `/v2` gör) |
| Branch / worktree | `jakob/ordning-a16` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a16` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 45 % · sammanflätat med `legacyClipPolicy` och partnerhändelser |

## Mål

Det gröna och nycklade spåret från september (Astrid green-speak, seam-repair,
table-v2, folded-rest, elevated, Amira composite) är avvecklat om B10 säger
det. `/v2` omdirigeras eller behålls utifrån T2. Inga publicerade paket och
ingen partnerkontrakt påverkas.

## Fakta (00ea55c5)

- Media: `media/dealers/astrid/runtime/composited/` (189 filer, 80,7 MB) och
  `media/dealers/amira/runtime/composited/` (62 filer, 10,4 MB). Båda ingår i
  Render-imagen.
- Kod: `web/clip-mapping.mjs` (i kroken via `test/clip-mapping.mjs`; enligt
  tidigare fakta "katalog, spelar inte"), `web/public/astrid-green-dealer.mjs`,
  `astrid-green-speak.mjs`, `astrid-folded-rest.mjs`,
  `astrid-idle-scheduler.mjs` och möjligen `astrid-speech-join.mjs`. Dessutom
  regler i `environment.css` och `blender-table-scene.mjs` (A10).
- Pipeline: `test-astrid-green-*.mjs`, `test-amira-green-speak.mjs`,
  `test-amira-transitions.mjs`, `test-astrid-folded-rest-lifecycle.mjs`,
  `test-astrid-idle-scheduler.mjs` och `build-dealer-v2-release.mjs`.
- `/v2`: `apps/croupier-frontend/app/v2/route.ts`, `server-ui.mjs`
  (`['/v2','game.html']`), `ops/cloud/vercel-ingress.mjs` och `routes.json`
  (rad ~1421–1440). Spelklienten kräver `local` eller `layered`, så `/v2` är
  troligen bara ett alias. A05 avgör det (T2).
- Handoffen: "`legacyClipPolicy` … har faktiska konsumenter … är inte
  generellt obsoleta". Ta inte bort policyfält eller läsare.

## Ägda filer

Filerna ovan efter A05:s lista, `/v2`-raderna i de delade frontendfilerna,
poster i `docs/system-map/*.json`, register via verktyg och rader i kroken.

**Rör inte:** `legacyClipPolicy`-läsare och policyfält, `web/partner-presentation.mjs`
(A30), `media/**/runtime/{indexed,presentation}` och dokument.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Ombasera efter A11. Läs A04 (används
   composited-träden av något paket eller av partnerprotokollet?) och A05 (T2).
   Stoppa om något paket eller kontrakt använder trädet.
1. **`/v2`:** om T2 visar ett alias, gör det till en 308 till `/play/blackjack`
   eller `/play` med bevarad query. Vilket mål det blir står i B10. Annars
   behålls `/v2` och skillnaden beskrivs i rapporten.
2. **`web/clip-mapping.mjs`:** ta reda på vilka poster som pekar på composited-filer.
   Ta bara bort de posterna, och bara om ingen läsare behöver dem. Uppdatera
   `test/clip-mapping.mjs` för de borttagna posterna, utan att försvaga övriga
   asserts.
3. **Ta bort** klientmoduler, pipeline-skript och media enligt den bekräftade
   listan. Uppdatera registren via verktygen.
4. **Prov:**
   - `node --test test/clip-mapping.mjs test/native-partner-events.mjs test/native-observation.mjs apps/croupier-frontend/test/platform-ui.mjs ops/cloud/test/vercel-ingress.test.mjs`;
   - `node tools/build-runtime-media-catalog.mjs --check` och
     `node pipeline/build-lab-video-manifest.mjs --check`;
   - `node pipeline/audit-dealer-sync.mjs --probe`;
   - `node docs/system-map/verify.mjs --check` och
     `node tools/check-orphan-tests.mjs`.

## Klart när

- [ ] Composited-träden är borta, eller behålls med motivering.
- [ ] `/v2` beter sig enligt B10.
- [ ] Partnerhändelser och observation är oförändrade enligt proven.

## Tveksamt att lyfta

- Varje composited-fil som någon katalog, något paket eller någon policy pekar på.
- Om `clip-mapping.mjs` exponeras utåt via partner-API:t.
