# Render `croupier-v3`: spelmotorn

Spelmotorn är Render `croupier-v3`, tjänst `srv-dbd6nfon74is73aiblf0` i workspace `tea-d19jsa63jp1c73ch0sc0`. Den kör `services/game/server.mjs` bakom gatewayn i `ops/cloud` och äger kort, sko, saldo, utbetalningar och delat bord. Admin, lobby och spelskal ligger på Vercel. Ingen Studio-process och ingen disk ingår. Daterade deploykvitton finns i [historiken](../../docs/history/RENDER-V3-2026-10.md) och [NEXT-AGENT](../../docs/NEXT-AGENT.md).

## Tjänsten

| Fält | Värde |
| --- | --- |
| Typ, region, plan | Web Service, Docker, Frankfurt, `1c-2g`, en instans |
| Repo och branch | `Jakeminator123/scoutgaming`, `main` |
| Docker context och Dockerfile | `.` (reporoten), `ops/cloud/Dockerfile.game` |
| Health check | `/__cloud/health` |
| Port | 10000 (`PORT` sätts av Render) |
| Disk | Ingen |
| Auto-deploy | Av; deploy sker manuellt efter grön merge |

Imagen installerar bara `services/game` och `services/astrid-gpu-worker/gateway` och kopierar en uttrycklig fillista, se [CONTAINER-CONTEXT](CONTAINER-CONTEXT.md). Build-filter om Render bara ska bygga vid relevanta ändringar: `ops/cloud/**`, `ops/neon-game/**`, `ops/neon-studio/**`, `packages/**`, `services/game/**`, `services/astrid-gpu-worker/gateway/**`, `tools/media-layout.mjs`, `tools/runtime-media-catalog.mjs`, `tools/media-blob-index-reader.mjs`, `.dockerignore`. `ops/cloud/test/game-image.test.mjs` håller listan i takt med spelserverns importer.

Staging har en egen Render-tjänst, `croupier-k06-k07-staging` (`srv-dbf61l0m7kps73ft7mk0`), med samma recept och egna värden. Jakob startar och stoppar den.

## Miljövariabler

Hela tabellen står i [ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md#render-croupier-v3-spelmotorn). Minsta uppsättningen för start:

- `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_STREAM_LANE=lissabon-stream-lane` (`NODE_ENV=production` sätts av imagen)
- `CROUPIER_DATABASE=postgres`, `CROUPIER_GAME_DATABASE_URL` (Neon med TLS)
- `CROUPIER_STUDIO_NEON_POLICY=1`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`
- `CROUPIER_MEDIA_STORAGE=blob`, `BLOB_READ_WRITE_TOKEN`
- Ingress från Vercel: `CROUPIER_VERCEL_TRANSPORT_ORIGIN=https://croupier-v3.onrender.com`, `CROUPIER_PUBLIC_ORIGIN` och `PUBLIC_URL` (båda `https://www.scoutgaming.tech`), `CROUPIER_VERCEL_INGRESS_SECRET`

Utan `PUBLIC_URL` härleds originen från `RENDER_EXTERNAL_URL` och starten stoppar med `Invalid or missing CROUPIER_PUBLIC_ORIGIN`. `BO_URL`, `LAB_PUBLIC_URL` och `CROUPIER_GAME_ORIGIN` härleds och sätts inte. `CROUPIER_SHARED_TABLE_ENABLED` är osatt i produktionen till O03 ([regeln](../../docs/ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling)); `CROUPIER_CLOUD_LAB_CHILD` är borttagen och `1` stoppar starten.

Render MCP kan skriva env men inte läsa värden; en skrivning sammanfogar nycklar och startar en deploy direkt. Läs värden via REST med `RENDER_API_KEY` från gitignorerad `.env.local` och skriv aldrig ut dem.

## Deploy

1. Merga efter grön CI. Kontrollera att schemat som koden kräver redan är applicerat (`node tools/check-migration-readiness.mjs`).
2. Starta deployen manuellt för exakt den SHA som mergats: Render MCP `trigger_deploy` för `srv-dbd6nfon74is73aiblf0`, eller panelen.
3. Kontrollera:
   - loggen visar `Cloud pilot listening after local access checks`;
   - `GET https://croupier-v3.onrender.com/__cloud/health` ger `ok`;
   - `GET /__cloud/version` ger `{schemaVersion:1, provider:"render", commitSha}` med rätt SHA;
   - `/studio` ger 307 till `https://www.scoutgaming.tech/studio` (bokmärkesredirect, ingen Studio på Render);
   - det ändrade flödet fungerar från www.
4. Director (`srv-danhlpjtqb8s73bv530g`) och Gateway (`srv-danhiv3tqb8s73burkq0`) deployas om bara när `packages/director` eller `services/openclaw/lab` ändras.

Vercel och Render får ha olika SHA när bara frontend ändrats, men kompatibiliteten ska vara kontrollerad. Grön CI eller "live" i Render är inget kvitto på att rätt kod kör.

## Återgång

Gå tillbaka till en granskad tidigare SHA enligt [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten). Återgångskoden måste förstå installerat schema, frysta paket och sparade format, till exempel sparad idle-rotation. `croupier-v2` och `croupier-vercel-preview-qa` är raderade; det finns ingen äldre motor eller kombinerad image att gå tillbaka till.

## Trafik

| Trafik | Mottagare |
| --- | --- |
| Health, version och signerad ingress från Vercel | Gatewayn och `services/game` |
| Spel-, konto- och publiceringskontrakt, rumssocket för delat bord | Spelmotorn |
| Talströmmar och worker-callbacks | Talreläet i gatewayn, när funktionerna är på |
| Admin och Studio-API:er | Vercels `studio`-tjänst |
| Gamla Studio-dokumentlänkar till Render | Redirect till Vercel |

## Prov i repot

- `node --test --test-concurrency=4 ops/cloud/test/*.test.mjs`: start med en spelprocess, signerad ingress och riktig Web-session, media- och sockettransport, avstängning. Linux-signalprov körs i CI. `game-image.test.mjs` kontrollerar COPY-listan.
- Workflowet `Render v3 container check` (`.github/workflows/product-container-check.yml`, jobb `game-image`) bygger `Dockerfile.game`, kör nätverkslös paketupplösning och `start.mjs --check`. Det körs på PR:er som rör workflowfilen, `.dockerignore`, `Dockerfile.game` eller spel- och gatewaypaketens `package.json`/låsfil, och via `workflow_dispatch`; inte vid push till `main`. Ingen image publiceras.
