# Render v3: byggkontext och verifiering

Spelmotorn `croupier-v3` byggs från reporoten med `ops/cloud/Dockerfile.game`:

```sh
docker build -f ops/cloud/Dockerfile.game .
```

Imagen kör `services/game/server.mjs` bakom gatewayn i `ops/cloud`. Admin, lobby och spelskal byggs på Vercel. Se [RENDER-V3](RENDER-V3.md) för tjänst och deploy och [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten) för kodåtergång.

| Kopieras till imagen | Roll |
| --- | --- |
| `services/game/` | Spelmotorn: konton, saldo, kort, sko och spelregler |
| `packages/` | Delade kontrakt, register-, medie- och publiceringstjänster |
| `services/astrid-gpu-worker/gateway/` | Talreläet; bygger eller startar ingen GPU-worker |
| `ops/cloud/`, `ops/neon-game/`, `ops/neon-studio/` | Start, gateway och schemakontrakt; bygget applicerar inga migreringar |
| Tre uttryckliga `tools/`-moduler | Layout-, runtimekatalog- och Blob-indexadaptrar enligt Dockerfilen |

`apps/`, `media/` och lokal bootstrapdata ingår inte. `ops/cloud/test/game-image.test.mjs` kontrollerar spelserverns importer mot COPY-listan. Manifest och låsfiler kopieras före koden, så en ren källändring återanvänder beroendelagret. Produktionsberoenden installeras med `--omit=dev`; PGlite stannar utanför imagen.

Workflowet `Render v3 container check` bygger imagen två gånger med en tillfällig källändring, kräver cacheträff för den låsta installationen och kör nätverkslösa kontroller av beroenden, frånvaro av Studio och lokala medieregister samt startkonfigurationen. Fixturvärdena ansluter inte till Neon, Blob eller någon app, och ingen image publiceras.

Det finns bara en Dockerfile för spelmotorn och en spelprocess. Den kombinerade Studio- och spelstarten är borttagen. Studio-sessioner kontrolleras av spelserverns identitetstjänst genom signerad Vercel-ingress.

Neon är registret: scoped `runtime_media_catalogs` innehåller layout, Blob-index och presentationsmetadata, och `speech_reply_records` talreplikerna. Mediebytes hämtas från privat Blob. En saknad eller felaktig katalog ersätts aldrig av filer ur imagen.

`.dockerignore` filtrerar bort Git, privata `arkiv/`, hemligheter, appdata och mediers source, staging och review. Filtreringen raderar inga lokala filer. OpenClaw och GPU-workern har egna Dockerfiler.

Ett lyckat containerbygge bevisar bara bygg- och startkontraktet. Vid leverans kontrolleras driftsatt SHA, health och det ändrade beteendet enligt [driftkartan](../../docs/CLOUD-MIGRATION.md#kontrollera-en-deploy).
