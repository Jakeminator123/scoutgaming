# Render `croupier-v3`: spelmotor utan Studio

Recept för en ny Render Web Service som bara kör spelmotorn
(`services/game/server.mjs`) bakom den befintliga gatewayn i `ops/cloud`.
Ingen Next-/Studio-process, inget `/studio`-alias, ingen disk. Receptet
skapar ingen tjänst och ändrar inga miljövärden; Jakob skapar tjänsten och
byter blågrönt från `croupier-v2`.

## Syfte

- Samma publika kontrakt som `croupier-v2` för allt Vercel skickar till Render:
  ingresshemlighet, WebSocket-upgrade, moving-callback, `/__cloud/health`,
  `/__cloud/version`, delat-rum-socket.
- Mindre image och snabbare bygge: `ops/cloud/Dockerfile.game` installerar
  bara `services/game` och `services/astrid-gpu-worker/gateway` och kopierar
  en uttrycklig fillista (ingen `apps/`, ingen `next build`).
- Startflaggan `CROUPIER_CLOUD_LAB_CHILD=0` (inbakad i imagen) gör att
  `start.mjs` startar ett barn (Web på 127.0.0.1:4173), hoppar över
  Lab-byggkontrollen och låter gatewayn svara 421 på allt som förr gick till
  Next-barnet. Oförändrad flagga = exakt dagens v2-beteende.

## Tjänst i Render

| Fält | Värde |
| --- | --- |
| Typ, region, plan | Web Service, Docker, Frankfurt, samma plan som v2 (`1c-2g`). |
| Repo/branch | `Jakeminator123/scoutgaming`, `main` (eller `codex/v3-game-server` för första bygget). |
| Docker context | `.` (reporoten) |
| Dockerfile path | `ops/cloud/Dockerfile.game` |
| Health check path | `/__cloud/health` |
| Port | 10000 (`PORT` sätts av Render) |
| Disk | Ingen. |
| Auto-deploy | Av tills blågrönt bytet är gjort. |

Build-filter (om Render ska bygga bara vid relevanta ändringar):
`ops/cloud/**`, `ops/neon-game/**`, `ops/neon-studio/**`, `packages/**`,
`services/game/**`, `services/astrid-gpu-worker/gateway/**`,
`tools/media-layout.mjs`, `tools/runtime-media-catalog.mjs`,
`tools/media-blob-index-reader.mjs`, `.dockerignore`.
`ops/cloud/test/game-image.test.mjs` håller listan ärlig mot spelserverns
statiska importstängning.

## Miljövariabler för v3 (namn, aldrig värden)

Kopiera värden från `croupier-v2` där namnet finns i listan. Imagen sätter
`NODE_ENV=production` och `CROUPIER_CLOUD_LAB_CHILD=0`; Render sätter
`PORT`, `RENDER_EXTERNAL_URL`, `RENDER_SERVICE_ID`, `RENDER_GIT_COMMIT`.

Krävs för start (`config.mjs`):

- `CROUPIER_CLOUD_LAUNCH=pilot`
- `CROUPIER_CLOUD_LAYOUT=single-origin`
- `CROUPIER_DATABASE=postgres`, `CROUPIER_GAME_DATABASE_URL` (Neon, `sslmode=require`)
- `CROUPIER_STUDIO_NEON_POLICY=1`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`
- `CROUPIER_MEDIA_STORAGE=blob`, `BLOB_READ_WRITE_TOKEN`
- `CROUPIER_STREAM_LANE=lissabon-stream-lane`
- `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN`

Vercel-ingress (krävs för att Vercel ska nå v3):

- `CROUPIER_VERCEL_TRANSPORT_ORIGIN` = **v3:s egen** adress, `https://croupier-v3.onrender.com`
  (inte v2:s; gatewayn jämför med `Host` och, vid rörligt tal, med `RENDER_EXTERNAL_URL`).
- `CROUPIER_PUBLIC_ORIGIN` = `https://www.scoutgaming.tech` (samma som Vercel).
- `CROUPIER_VERCEL_INGRESS_SECRET` = samma hemlighet som Vercel-projektet.

Tal (samma namn och värden som på v2 om tal ska vara på):

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

Valfria (bara om de används på v2 i dag): `CROUPIER_PRESENTATION_DIRECTOR_URL`,
`CROUPIER_PRESENTATION_DIRECTOR_TOKEN`, `OPENCLAW_TIMEOUT_MS`,
`OPENCLAW_SPEECH_TIMEOUT_MS`, `CROUPIER_PLAYER_ACCOUNTS`,
`CROUPIER_VERCEL_FRONTEND_ORIGIN`, `CROUPIER_SHARED_TABLE_ENABLED`,
`CROUPIER_ASTRID_CAMERA`, `CROUPIER_ASTRID_TRANSLATION_KEY`.
`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD` behövs inte: konton finns redan i Neon.

Sätt **inte** på v3 (Studio/Lab/BO/disk eller v2-bundna):

- `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN`,
  `BETTALOTTO_PARTNER_BASE_URL`: härleds från `RENDER_EXTERNAL_URL` i
  single-origin. Kopieras v2-värdena (`croupier-v2.onrender.com`) vägrar v3 starta.
- `CROUPIER_LAB_BASE_PATH`, `NEXT_PUBLIC_LAB_BASE_PATH`, `LAB_REMOTE_URL`,
  `LAB_REMOTE_TOKEN`, `CROUPIER_ZONES_DATABASE_URL`, `BETTALOTTO_PARTNER_KEY_ID`,
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

## Blågrönt byte

1. Skapa `croupier-v3` enligt ovan med Auto-deploy av; vänta på grön deploy
   och kontrollerna ovan.
2. Vercel **Preview**: sätt `CROUPIER_BACKEND_ORIGIN=https://croupier-v3.onrender.com`
   (projekt `scoutgaming`, scope Preview) och verifiera en preview: lobby,
   signerad launch till `/play/blackjack?launch=`, en spelrunda, talström om på.
3. Vercel **Production**: samma namn, samma värde. Redeploy utan byggcache
   behövs inte; värdet läses vid runtime i `platformConfiguration`.
   Gör bytet när Drift står i Av (ingen pågående rörlig talsession:
   RunPod-callbacks går till den origin som startade jobbet).
4. Låt v2 stå kvar oförändrad i minst en vecka. Slå på Auto-deploy på v3
   först när v2 inte längre tar trafik.

Återgång: sätt `CROUPIER_BACKEND_ORIGIN` tillbaka till
`https://croupier-v2.onrender.com` (Production först om felet är skarpt, sedan
Preview). v2:s env är orörd. Neon och Blob delas av båda tjänsterna; inget
data flyttas vid bytet.

## Routekarta: svarar Render på i dag -> v3

| Väg (från Vercel eller direkt) | v2 i dag | v3 |
| --- | --- | --- |
| `/__cloud/health`, `/__cloud/version` | gateway | oförändrat |
| Signerad ingress: AUTH, PLAYER, BACKOFFICE (`/api/bo/config`, `game-login`, `lab-login`, `speech-qa`), PRESENTATION, ROULETTE_ROOM/PREVIEW, PUBLIC_MEDIA, `/packages/*` publika moduler, `/api/v1/*`, `/api/operators*`, studio-preview, moving-speech `rest`/`bank` | Web | oförändrat |
| Signerad launch `/blackjack?launch=`, `/game?launch=`, operatördokument | Web | oförändrat |
| WebSocket `/speech-stream`, `/lipsync-worker`, `/moving-speech-stream`, `/lipsync-moving/*`, delat rum `/shared-room/*` | gateway -> Web/relä | oförändrat |
| `/__vercel/lab/session` (Web-ägd identitetskontroll) | gateway -> Web `/api/auth/lab/check` | oförändrat |
| `/api/auth/lab/start`, `/api/auth/lab/callback`, `/api/bo/lab-login` (Web-ägd CRAIG-handoff) | Web | oförändrat (svaret leder till en Studio som inte finns på Render; Vercel äger Studio) |
| `/api/auth/lab/check` publikt | 421 | 421 |
| `/studio`, `/studio/*` dokument och `/studio/_next/*` | Next-barn (efter Lab-session) | 421 (direkt GET utan hemlighet: 307 till Vercel som förut) |
| `/studio/api/*` via signerad ingress (`LAB_API` i `platform-routing.mjs`: voice, inputs, chat, presentation, probe, simulate, zones, generated-speech, project, videos, dealers, layer-assets, clip-controls, social) | Next-barn | 421 |
| `/lab`, `/studio-astrid`, `/studio-lissabon` | 307 `/control` | oförändrat |
| `/bo/*`, `/control*`, `/roulette-test`, Lissabon-profiler i `services/game` | Web | oförändrat (ägs av andra städuppdrag) |

Vercel skickar i dag ingenting till `/studio/*` på Render: `vercel.json`
skriver om `/studio/:path*` till Vercels Studio-tjänst innan `apps/web`
ser begäran, och `apps/studio/lib/ui-server.ts` tar den nativa Admin-vägen
före `remote-ui.mjs` när `CROUPIER_STUDIO_NATIVE_ADMIN=1`. `LAB_API`-grenen
i `backendPlatformPath` är därmed död kod i produktion; v3 svarar 421 om
något ändå försöker.

## Verifiering i repo

- `node --test --test-concurrency=4 ops/cloud/test/*.test.mjs` (standardläge
  och `CROUPIER_CLOUD_LAB_CHILD=0` i samma sviter; `game-image.test.mjs`
  låser COPY-listan).
- CI `Product container cache check`, jobb `game-image`: bygger
  `Dockerfile.game`, kör nätverkslös paketupplösning och `start.mjs --check`
  utan Lab-bygge. Ingen image publiceras.
