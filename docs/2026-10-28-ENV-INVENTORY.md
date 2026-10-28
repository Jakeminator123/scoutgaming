# Miljöinventering inför O03, 2026-10-28

Underlag för O03:s säkerhets- och runtimekvitto ([O02-PLAN §5.4](plans/O02-PLAN.md)). Gjord genom läsning den 28 oktober 2026: Render REST (env-vars och tjänstdata), Vercel REST (namn, mål och typ, utan dekryptering), `node tools/check-environment-variables.mjs` och `git grep -w` per namn i `apps`, `packages`, `services`, `ops` och `tools` utan tester. Här står bara namn; flaggor anges som PÅ/AV och adresser som tjänst. Registret och [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) rättades i samma PR.

## Render

| Tjänst | Plan, region | autoDeploy | Läge vid läsningen |
| --- | --- | --- | --- |
| `croupier-v3` | 1c-2g, Frankfurt, Docker | av | igång, 45 namn |
| `croupier-k06-k07-staging` | 1c-2g, Frankfurt, Docker | av | igång (inte suspenderad), 20 namn |
| `croupier-lab-director` | starter, Frankfurt, disk | av | igång, 16 namn |
| `croupier-lab-openclaw` (privat) | standard, Frankfurt, disk | av | igång, 10 namn |

- **croupier-v3:** alla 45 namn är registrerade och lästa av `ops/cloud/config.mjs` eller `services/game`. Inga döda namn.
- **Förbjudna och bootstrap-namn** (`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_*`, `CROUPIER_CLOUD_LAB_CHILD`, `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW`, `CROUPIER_LISSABON_PROFILES`, `NODE_OPTIONS` m.fl., diskvägarna `*_DIR`) saknas i både produktion och staging.
- **Bara i produktionen** (25 namn): allt tal (`CROUPIER_GENERATED_SPEECH_STREAMING`, `CROUPIER_DEALER_SPEECH_PROFILES`, `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_*`), rörligt tal (`CROUPIER_MOVING_SPEECH_*` utom flaggan), driftväljaren, paren `OPENCLAW_PRODUCT_SPEECH_*` och `CROUPIER_PRESENTATION_DIRECTOR_*`, `OPENCLAW_SPEECH_TIMEOUT_MS` och `CROUPIER_ASTRID_TRANSLATION_KEY`.
- **Bara i staging:** `CROUPIER_SHARED_TABLE_ENABLED` (PÅ). Produktionen har den osatt enligt regeln.
- **Flaggor i produktionen:** genererat tal, streaming, dealerprofiler, `CROUPIER_MOVING_SPEECH_ENABLED`, `CROUPIER_STUDIO_MOVING_DRIFT_API` och `CROUPIER_ASTRID_CAMERA` är PÅ. I staging är tal, rörligt tal och kamera AV.
- **Driftväljaren** har en profil, `baseline`, vars endpoint och digest är lika med motorns. Imagen anges som GHCR-digest. Rörligt tal och helfilstal använder olika RunPod-endpoints och olika nycklar.
- **Director:** `OPENCLAW_PRODUCT_SPEECH_URL` och `CROUPIER_PRESENTATION_DIRECTOR_URL` pekar båda på Director, med olika token. `OPENCLAW_HOSTPORT` pekar på Gatewayns privata värd, och Gatewayns `OPENCLAW_DASHBOARD_ORIGIN` pekar på Director.
- **Pensionerade värdar:** ingen variabel pekar på croupier-v2, croupier-vercel-preview-qa eller någon astrid-, lissabon-, impactwin- eller player-preview-värd. `CROUPIER_STREAM_LANE=lissabon-stream-lane` är ett levande anslutnings-ID.
- **Bara i panelen, inte i Blueprint:** `OPENCLAW_SPEECH_TIMEOUT_MS` och `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY` på Director, `CROUPIER_SPEECH_VISION` (PÅ) och `OPENCLAW_DASHBOARD_ORIGIN` på Gateway.

## Vercel

**Projektet `scoutgaming`** har 52 namn i Production (36 egna och 16 `CROUPIER_NEON_*`), 25 i Preview och 1 i Development (`CROUPIER_DEALER_IMPORT_AI`).
- **Förhandsmiljöer:** `vercel.json` (`git.deploymentEnabled`) tillåter deploy bara från `main`. Senaste preview-deploy är från 16 oktober, så PR-grenar får inga förhandsmiljöer.
- **ignoreCommand:** projektinställningen släpper igenom `main|jakob/|codex/|cursor/`. Allt utom `main` är dött på grund av grenregeln. Inställningen bor i Vercel och ändras där.
- **Döda på Vercel** (bara spelmotorn läser dem): `BO_URL` (Production och Preview), `CROUPIER_ASTRID_CAMERA`, `CROUPIER_PLAYER_ACCOUNTS`.
- **Lästa men AV:** `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW`, `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH` och `CROUPIER_GENERATED_SPEECH_STREAMING` läses av `packages/presentation/server/generated-speech-runtime.mjs` via Studio. Bara `1` gör något, så osatt och `0` ger samma beteende.
- **Preview bär produktionens Neon-koppling:** alla 16 `CROUPIER_NEON_*` är integrationsposter (en post per namn för Preview och Production). Preview stängs av i Neon-kopplingens miljöval, inte med `vercel env rm`. Development har inga Neon-namn.
- **Nekade namn** (`RUNPOD_*`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `CROUPIER_ZONES_DATABASE_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN`) saknas, som de ska.
- **`CROUPIER_LAB_UI_ORIGIN`** är ett alias i projektet själv och krävs när `CROUPIER_LAB_REMOTE_UI=1`.

**Projektet `croupier-k06-k07-staging`** har 13 namn och ingen Git-koppling. Det saknar `CROUPIER_LAB_REMOTE_UI`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_STREAM_LANE`, `CROUPIER_DATABASE` och alla AI-, tal-, mejl- och Runway-namn.

## Tal och läppsynk

| Leverantör | Var namnet finns |
| --- | --- |
| ElevenLabs | Bara `croupier-v3`. Nyckeln förs vidare eftersom dealerprofilerna är PÅ. Ett läsande anrop visar ett aktivt Pro-konto med PAOW-rösten, vilket stämmer med beslutet att produktionsnyckeln är Kevins konto |
| OpenAI | Gateway (`OPENCLAW_MODEL_*`), Vercel (`OPENAI_API_KEY` för import och assistent), `croupier-v3` (`CROUPIER_ASTRID_TRANSLATION_KEY`, Whisper för spelarens mikrofon) |
| Cartesia | `croupier-v3` och Vercel Production (röstprov) |
| Runway | Bara Vercel Production (Dealer Forge) |
| RunPod/GPU-worker | `croupier-v3`: helfilstal och rörligt tal. GPU-reläet (`render-gpu-relay`) är inte driftsatt. Miljön på RunPod-sidan är inte inventerad |
| Gemini | Ingenstans |

## Rättat i registret i samma PR

- `BO_URL` borttaget ur `vercel-lab-ui`.
- `CROUPIER_GAME_ORIGIN` är villkorlig i `vercel-entry` och står i dokumentet som "sätts inte på Vercel".
- `CROUPIER_LAB_UI_ORIGIN` står som krävd när `CROUPIER_LAB_REMOTE_UI=1`.
- Agentnamnen har prefixet `openclaw/`.
- `packages/director/configuration.mjs` är källa för Director, med nio nya namn: `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN` som nekade, `LAB_COMPANION_*` (tre), `OPENCLAW_DASHBOARD_ORIGIN`, `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`, `OPENCLAW_PRODUCT_SPEECH_URL` och `RENDER_EXTERNAL_URL` som värdhanterad.
- `vercel-lab-ui` läser nu `studio-render-persistence.mjs` och `generated-speech-runtime.mjs`, med de namn de läser.
- Pensionerade diskvägar och `CROUPIER_CLOUD_LAB_CHILD` ligger som nekade i `render-game`.

## Kvar för O03 och för Jakob

- Ta bort `BO_URL`, `CROUPIER_ASTRID_CAMERA` och `CROUPIER_PLAYER_ACCOUNTS` ur Vercel. Kräver Jakobs körning eller behörighet.
- Avmarkera Preview i Neon-kopplingen.
- Förenkla ignoreCommand.
- Blueprint får panelnamnen i en separat PR, eftersom `services/openclaw/lab/` är ett runtimeprefix enligt frysregeln F5.
- `CROUPIER_SHARED_TABLE_ENABLED=1` på `croupier-v3` efter Jakobs godkännande. Därefter raderas staging.
- Jakob avgör om rörligt tal ska vara PÅ medan Dragans tal är pausat, och om spelarmikrofonen med Whisper är en avsedd funktion.
