# Render `croupier-v3`: spelmotor utan Studio

Aktiv spelmotor är Render `croupier-v3`, tjänst `srv-dbd6nfon74is73aiblf0` i workspace `tea-d19jsa63jp1c73ch0sc0`. Den kör `services/game/server.mjs` bakom gatewayn i `ops/cloud`; Admin/Studio ligger på Vercel. Ingen Next-/Studio-process eller produktdisk ingår i v3.

**Färsk kontroll 25 oktober 2026:** rätt repo/main, `ops/cloud/Dockerfile.game`, Frankfurt, 1c-2g och Auto-deploy av. Deployment `dep-dbf1qie7bikc73bsg650` är live på `23debde7155346e30ee5a3f3dfbe54cd09ea2789`; faktisk HTTP ger samma SHA, health 200/ok, capability v27/200 och v28/200 med `idleRotation: pose-graph-v1`. Detta driftkvitto föregår tom-katalogstödet i PR #391 samt P6-/tvåprocessavvecklingen. Dessa senare kodleveranser behöver ett nytt versionsbundet deploykvitto innan de kan kallas driftsatta. Äldre `croupier-v2` är suspenderad och används inte som återgång.

## Syfte

- Befintliga publika kontrakt för allt Vercel skickar till Render:
  ingresshemlighet, WebSocket-upgrade, moving-callback, `/__cloud/health`,
  `/__cloud/version`, delat-rum-socket.
- Mindre image och snabbare bygge: `ops/cloud/Dockerfile.game` installerar
  bara `services/game` och `services/astrid-gpu-worker/gateway` och kopierar
  en uttrycklig fillista (ingen `apps/`, ingen `next build`).
- `start.mjs` startar alltid en spelprocess (internt `web`, på 127.0.0.1:4173).
  Kombinerad Dockerfile, Next-byggkontroll och Studio-upstream är borttagna.
  Ingen `CROUPIER_CLOUD_LAB_CHILD` behövs i imagen eller CI; osatt, tomt
  eller `0` ger enprocessläge, medan `1` avvisas som pensionerat.
  Vercels sessionskontroll använder fortfarande Webs identitetstjänst.

## Tjänst i Render

| Fält | Värde |
| --- | --- |
| Typ, region, plan | Web Service, Docker, Frankfurt, `1c-2g`. |
| Repo/branch | `Jakeminator123/scoutgaming`, `main`; deploya uttryckligt granskad SHA. |
| Docker context | `.` (reporoten) |
| Dockerfile path | `ops/cloud/Dockerfile.game` |
| Health check path | `/__cloud/health` |
| Port | 10000 (`PORT` sätts av Render) |
| Disk | Ingen. |
| Auto-deploy | Av; leverans är uttrycklig och versionsbunden. |

Build-filter (om Render ska bygga bara vid relevanta ändringar):
`ops/cloud/**`, `ops/neon-game/**`, `ops/neon-studio/**`, `packages/**`,
`services/game/**`, `services/astrid-gpu-worker/gateway/**`,
`tools/media-layout.mjs`, `tools/runtime-media-catalog.mjs`,
`tools/media-blob-index-reader.mjs`, `.dockerignore`.
`ops/cloud/test/game-image.test.mjs` håller listan ärlig mot spelserverns
statiska importstängning.

## Miljövariabler för v3 (namn, aldrig värden)

Utgå från det aktuella v3-kontraktet och [miljöguiden](../../docs/ENVIRONMENT-VARIABLES.md). En separat verifieringsmiljö behöver egna scope, konton och nycklar; kopiera inte produktionshemligheter. Imagen sätter
`NODE_ENV=production`; Render sätter
`PORT`, `RENDER_EXTERNAL_URL`, `RENDER_SERVICE_ID`, `RENDER_GIT_COMMIT`.

Krävs för start (`config.mjs`):

- `CROUPIER_CLOUD_LAUNCH=pilot`
- `CROUPIER_CLOUD_LAYOUT=single-origin`
- `CROUPIER_DATABASE=postgres`, `CROUPIER_GAME_DATABASE_URL` (Neon, `sslmode=require`)
- `CROUPIER_STUDIO_NEON_POLICY=1`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`
- `CROUPIER_MEDIA_STORAGE=blob`, `BLOB_READ_WRITE_TOKEN`
- `CROUPIER_STREAM_LANE=lissabon-stream-lane`

`OPENCLAW_PRODUCT_SPEECH_URL` och `OPENCLAW_PRODUCT_SPEECH_TOKEN` är ett
valfritt par när genererat tal, kamera och moving är av. Aktiv AI-media kräver
fortfarande ett verkligt relä. Utan relä är spelchatten okonfigurerad och
avvisar anrop; detta är inte verifierad chatt eller talacceptans. Ett halvt
par avvisas alltid. Inspelad spelmedia kräver ingen separat AI-tjänst.

Vercel-ingress (krävs för att Vercel ska nå v3):

- `CROUPIER_VERCEL_TRANSPORT_ORIGIN` = **v3:s egen** adress, `https://croupier-v3.onrender.com`
  (gatewayn jämför med `Host` och, vid rörligt tal, med `RENDER_EXTERNAL_URL`).
- `CROUPIER_PUBLIC_ORIGIN` = `https://www.scoutgaming.tech` (samma som Vercel).
- `PUBLIC_URL` = `https://www.scoutgaming.tech`: spelets publika origin.
  `config.mjs` kräver att den är lika med `CROUPIER_PUBLIC_ORIGIN`; utan den härleds
  origin från `RENDER_EXTERNAL_URL` och starten stoppar med
  `Invalid or missing CROUPIER_PUBLIC_ORIGIN` (verifierat 22 oktober på första v3-deployen).
- `CROUPIER_VERCEL_INGRESS_SECRET` = samma hemlighet som Vercel-projektet.

Tal (endast de funktioner som faktiskt ska vara aktiverade):

- `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_STREAMING`
- `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`
- `CROUPIER_SPEECH_STREAM_WORKER_SECRET`, `CROUPIER_SPEECH_STREAM_TICKET_SECRET`
- `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD`, `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD`, `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`
- `CROUPIER_DEALER_SPEECH_PROFILES`, `ELEVENLABS_API_KEY`
- Rörligt tal: `CROUPIER_MOVING_SPEECH_ENABLED`, `CROUPIER_MOVING_SPEECH_BANK_RECORD`,
  `CROUPIER_MOVING_SPEECH_ENDPOINT_ID`, `CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY`,
  `CROUPIER_MOVING_SPEECH_IMAGE`, `CROUPIER_MOVING_SPEECH_RELEASE_SHA256`,
  `CROUPIER_MOVING_SPEECH_TICKET_SECRET`, `CROUPIER_STUDIO_MOVING_DRIFT_API`,
  `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` och
  `CROUPIER_MOVING_SPEECH_WORKER_ORIGIN` = **v3:s egen** adress (måste vara lika
  med `RENDER_EXTERNAL_URL` och transportorigin).

Valfria enligt aktiv funktion: `CROUPIER_PRESENTATION_DIRECTOR_URL`,
`CROUPIER_PRESENTATION_DIRECTOR_TOKEN`, `OPENCLAW_TIMEOUT_MS`,
`OPENCLAW_SPEECH_TIMEOUT_MS`, `CROUPIER_PLAYER_ACCOUNTS`,
`CROUPIER_VERCEL_FRONTEND_ORIGIN`, `CROUPIER_SHARED_TABLE_ENABLED`,
`CROUPIER_ASTRID_CAMERA`, `CROUPIER_ASTRID_TRANSLATION_KEY`.
`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD` behövs inte: konton finns redan i Neon.
`CROUPIER_ZONES_DATABASE_URL` är valfritt isoleringsskydd om en äldre zonadress finns: samma databas som game/auth nekas, även genom pooler-alias. Den skapar ingen zon-/Studio-konsument och behövs inte för start.

Sätt **inte** på v3 (hör till äldre kombinerad start, lokala produktdata eller avstängda sidofunktioner):

- `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN`, `BETTALOTTO_PARTNER_BASE_URL`:
  härleds från spelets origin (`PUBLIC_URL`) i single-origin och behöver inte sättas.
- `CROUPIER_LAB_BASE_PATH`, `NEXT_PUBLIC_LAB_BASE_PATH`, `LAB_REMOTE_URL`,
  `LAB_REMOTE_TOKEN`, `BETTALOTTO_PARTNER_KEY_ID`,
  `BETTALOTTO_PARTNER_SECRET`, `BETTALOTTO_PARTNER_PLAYER_ID` (nådde bara Lab-barnet).
- `CROUPIER_CLOUD_DATA_ROOT`, `CROUPIER_DATA_DIR`, `LAB_STUDIO_DATA_DIR`,
  `CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`,
  `CROUPIER_GENERATED_SPEECH_DIR`, `LAB_VIDEO_ARCHIVE`, `CROUPIER_MEDIA_BLOB_INDEX`,
  `CROUPIER_STORAGE_MAINTENANCE`, `CROUPIER_STORAGE_EXPORT_SECRET`, `CROUPIER_P6_*`,
  `CROUPIER_PUBLIC_GAME_PATH` (härleds).
- Blockerade: `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW`,
  `CROUPIER_LISSABON_PROFILES`, `NODE_OPTIONS`, `NODE_PATH`.

Kontroll innan trafik: `render logs` ska visa
`Cloud pilot listening after local access checks`; `GET https://croupier-v3.onrender.com/__cloud/health`
ger `ok`, `/__cloud/version` ger `{schemaVersion:1, provider:"render", commitSha}`
och `/studio` ger 307 till `https://www.scoutgaming.tech/studio` (bokmärkesredirect,
ingen Studio på Render).

## Leverans och återställning

1. Frys granskad kod-SHA och kontrollera att installerat Neon-schema, frysta paket och redan sparade medieformat är kompatibla.
2. Använd ordinarie PR/CI och nödvändig migrationsreadiness. Manuell v3-deploy ska peka på den granskade versionen; grön CI är inte ett deploykvitto.
3. Återläs faktisk `/__cloud/version`, `/__cloud/health` och berörda capability-/produktflöden. Vercel och Render får ha olika SHA när bara frontend ändrats, men deras kompatibilitet måste verifieras.
4. Vid kodåtergång: använd en granskad kompatibel v3-version enligt [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten). Återöppna inte v2 eller återställ gamla env-/lokalregister som genväg. En läsare som inte kan läsa sparad rotation är ingen giltig återgång.

## Ansvar för trafik

| Trafik | Aktiv mottagare |
| --- | --- |
| Health/version och signerad ingress från Vercel | v3-gateway och `services/game` |
| Auktoritativa spel-/konto-/publiceringskontrakt och rumssocket | Spelmotorn och befintliga delade tjänster |
| Talströmmar och worker-callbacks | Befintligt relä/gateway enligt aktiverade funktioner |
| Admin/Studio-sidor och API:er | Vercels Studio-tjänst; ingen Next-process på Render |
| Direkt äldre Studio-dokumentlänk till Render | Befintlig omdirigering till Vercel; otillåten intern Studio-upstream nekas |

Route- och behörighetskontroller ska följa dessa aktiva tjänster. En gammal sida, testsnapshot eller kombinerad image är inget bevarandekrav när dess ersättare är verifierad.

## Verifiering i repo

- `node --test --test-concurrency=4 ops/cloud/test/*.test.mjs`: enprocess-start,
  signerad ingress och verklig Web-session, media-/sockettransport samt
  avstängning. Linux-signalprov körs i Linux-CI. `game-image.test.mjs`
  verifierar COPY-listan och paketupplösningen.
- CI `Render v3 container check`, jobb `game-image`: bygger
  `Dockerfile.game`, kör nätverkslös paketupplösning och `start.mjs --check`
  utan Lab-bygge. Ingen image publiceras.
