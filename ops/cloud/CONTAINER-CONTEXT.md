# Render v3: byggkontext och verifiering

Den aktiva spelmotorn `croupier-v3` byggs från reporoten med `ops/cloud/Dockerfile.game`:

```sh
docker build -f ops/cloud/Dockerfile.game .
```

Imagen kör `services/game/server.mjs` bakom gatewayn i `ops/cloud`. Studio/Admin och spelarens webbgränssnitt byggs på Vercel. Se [Render-guiden](RENDER-V3.md) för startkontrakt och [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten) för kompatibel kodåtergång.

| Kopieras till v3-imagen | Roll |
| --- | --- |
| `services/game/` | Spelserver, konton, auktoritativ ekonomi och spelregler |
| `packages/` | Delade kontrakt, register, media- och publiceringstjänster |
| `services/astrid-gpu-worker/gateway/` | Befintligt talrelä; detta startar eller bygger ingen GPU-worker |
| `ops/cloud/`, `ops/neon-game/`, `ops/neon-studio/` | Start/gateway och befintliga schemakontrakt; inga migreringar appliceras av Dockerbygget |
| Tre uttryckliga `tools/`-moduler | Layout-, runtimekatalog- och Blob-indexadaptrar enligt Dockerfilen |

Varken `apps/`, `media/` eller lokal Studio-bootstrapdata ingår. Spelserverns statiska importstängning kontrolleras av `ops/cloud/test/game-image.test.mjs`; Node-moduler och Linuxpaket installeras i imagen. Manifest och låsfiler kopieras före produktkoden, så en ren källändring kan återanvända beroendelagret.

CI `Render v3 container check` bygger den aktiva imagen två gånger, med en tillfällig källändring i runnerns checkout. Den kräver cacheträff för låst installation och kör därefter nätverkslösa kontroller av beroenden, frånvaro av Studio/lokala medieregister samt v3-startkonfiguration. Fixturvärdena i denna nätverkslösa kontroll ansluter inte till Neon, Blob eller någon app. Inga imager publiceras eller driftsätts av kontrollen.

Det ersatta CI-jobbet byggde `ops/cloud/Dockerfile`, kompilerade Studio och krävde den historiska privata bootstrapmappen. Dessa är inte längre leveranskrav för Render. Den äldre Dockerfilen och kombinerade startens kvarvarande QA-/kodkonsumenter är en separat avvecklingsyta; det gamla receptet är ingen produktionsåterställning.

Neon är registerkälla: scoped `runtime_media_catalogs` innehåller layout, Blob-index och presentationsmetadata; `speech_reply_records` innehåller svarsbibliotekets metadata. Exakta mediebytes hämtas från privat Blob. Saknad/felaktig katalog får inte ersättas av filer ur imagen. Historiska authoringfiler eller dealeridentiteter blir inte krav på nya installationer bara för att gamla tester använder dem.

`.dockerignore` filtrerar bland annat Git, privata `arkiv/`, hemligheter, muterbara appdata och mediers source/staging/review ur byggkontexten. V3 använder dessutom en uttrycklig COPY-lista. Filtreringen raderar inga lokala filer och är inte ett skäl att behålla en ersatt runtimeväg. OpenClaw och GPU-workern har egna Dockerfiler/byggkontexter.

Verifiera faktiskt driftsatt SHA, health, kontraktsversion och det ändrade beteendet vid leverans. Ett lyckat containerbygge bevisar bara bygg-/startkontraktet; moln-, media- och återställningsacceptans redovisas separat i [molnplanen](../../docs/CLOUD-MIGRATION.md).
