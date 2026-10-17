# packages/presentation

Paketet äger presentationskompositorn, layer-previewn och urvals-/idlereglerna.
Det används av dagens Studio och spelserver även om vissa verktyg, filnamn och
klippregler kommer från äldre Lab-/Lissabon-spår. Sammansättning är en
presentation; ett sparat lane-ID är en kompatibilitetsidentitet, inte en extra
produktnivå. Gemensamma begrepp och rumsmodellen definieras i
[runtimekontraktet](../../docs/LOCAL-PRESENTATION-RUNTIME.md).

- `compositor/` — spelare, kompositor, brygga, geometri och den fristående redigeraren (`app.js`, `index.html`, `viewer.*`). Redigeraren följer med men serveras inte.
- [Speldokumentation](../../docs/games/README.md) — blackjack och roulette på en gemensam ingång.
- `docs/` — referens för den fristående kompositorexporten och en hänvisning till den gemensamma formatlåsningen; ingen separat produktplan.
- `preview/site/` — granskat byggmaterial för isolerad offlinefixtur; förberedaren hämtar också delade renderarmoduler.
- `runtime/` — urval, idle, filmfamiljer, legacy-klipp och skobyten. Lab, Web och OpenClaw läser modulen. Importer tillbaka till `lab/`, `web/` och `open-claw/` finns kvar; vidare uppdelning är en öppen punkt i molnchecklistan.
- `capability-contract.mjs` — importfritt kontrakt för versionsförhandling mellan spelserver och Studio. Serverendpoint, readiness och bundlad klient använder samma representation; kontraktet ger ingen registrering eller behörighet.

Dessa läser paketet:

- `apps/croupier-frontend/tools/prepare-platform-ui.mjs` kopierar `compositor.js` och `geometry.js` till `apps/croupier-frontend/public/composition-runtime/`.
- `web/composition-runtime.mjs` serverar `/composition-runtime/*`.
- `web/layer-packs.mjs` serverar `/layer-packs/*` från `compositor/`.
- `lab/tools/prepare-preview.mjs` bygger `lab/preview-build`. Native molndrift serverar endast `compositor.js` och `geometry.js` under `/preview/*`; äldre sida, katalog och medier svarar 410. Explicit offlinefixtur behåller sitt isolerade previewmaterial.
- `lab/lib`, `lab/components`, `web/presentation-api.mjs`, `web/storage` och `web/studio-preview.mjs` importerar `runtime/`.
- `web/public/local-presentation.mjs` importerar `runtime/live-idle.mjs` direkt. Servern tillåter exakt `live-idle.mjs` och `idle-policy.mjs` under `/packages/presentation/runtime/`; de äldre `/presentation-runtime/*`-adresserna fungerar fortsatt. Den statiska frontendbyggaren behåller samma äldre outputadresser.

Publika adresser är stabila: `/composition-runtime/*`, `/layer-packs/*`, `/presentation-runtime/*` och Studio `/preview/*` (publikt `/studio/preview/*`). Filhashar för källfilerna ändras inte när bara sökvägen flyttas.

## Byggkällor och kompatibilitet

`preview/site/` och `media-hashes.json` är granskade byggkällor. Behåll dem;
`lab/preview-build/` är den genererade kopian och kan byggas om med
`node lab/tools/prepare-preview.mjs`. Studio använder denna förberedare
oberoende av branchnamn; den äldre branchspecifika frontendbyggaren är pensionerad.

`compositor/` innehåller både aktiv motor och fristående referens-UI. Bedöm
konsumenterna var för sig före radering. `runtime/` behåller äldre klipp- och
filmfamiljsregler för deras verkliga konsumenter; de anger inte hur varje ny
registrerad dealer måste organiseras. Radera inte kortkalibrering eller
publicerade identiteter för att ett lane-namn pensioneras.

För aktuella mediaformat och acceptans, använd [spelguiderna](../../docs/games/README.md)
och [handoffen](../../docs/JOHN-HANDOFF.md). En lokal referensexport innebär
ingen automatisk publicering eller verifierad läppsynk.
