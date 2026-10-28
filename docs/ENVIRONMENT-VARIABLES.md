# Miljövariabler per tjänst

Läsbar referens till [`environment-variables.json`](environment-variables.json), som är den maskinkontrollerade listan. Här står namn, krav, var värdet sätts och vad det gör, aldrig värden.

- Varje tillägg, borttagning eller betydelseändring uppdaterar både denna fil och JSON-registret i samma leverans ([AGENTS.md](../AGENTS.md#verifiering-och-säkerhet)).
- `node tools/check-environment-variables.mjs` körs i hook och CI. Den kontrollerar att varje namn som de registrerade källfilerna läser finns i registret och att en staged env-ändring följs av båda filerna. Värden och leverantörspaneler kontrolleras inte.
- `node tools/check-environment-variables.mjs --compare <tjänst> <env-fil>` jämför bara nyckelnamnen i en lokal fil med registret och skriver aldrig ut värden.
- En ändring direkt i en panel jämförs mot listan och antecknas här.

Krav i tabellerna: **krävs** (starten stoppar utan), **villkorlig** (krävs när funktionen är på), **valfri**, **värdhanterad** (plattformen sätter), **nekas** (värdet stoppar starten eller förs inte vidare).

## Var värden sätts och läses

| Plats | Tjänster | Läsa | Skriva |
| --- | --- | --- | --- |
| Vercel, projekt `scoutgaming`, Production | web, studio, speech | `vercel env ls` (namn och scope); Sensitive-värden går inte att läsa tillbaka | Jakob eller CLI; gäller från nästa deploy |
| Render, tjänstens Environment | `croupier-v3`, Director, Gateway, Render-stagingen | Render REST-API med `RENDER_API_KEY` från gitignorerad `.env.local`; Render MCP läser inte värden | Render MCP `update_environment_variables` sammanfogar nycklar och startar en deploy direkt; kontrollera `/__cloud/health` efteråt |
| Render Blueprint `services/openclaw/lab/render.yaml` | Director, Gateway | I repot | Via PR; icke-hemliga standardvärden, hemligheter med `sync: false` |
| GitHub repository secret | CI (`.github/workflows/croupier.yml`) | Inte möjligt | Jakob |
| Gitignorerad `.env.local` på Jakobs dator | Lokala verktyg och agenter | Bara av det verktyg som behöver namnet | Aldrig till Git eller chatt |

Inga miljögrupper eller secret files används. Render-konfiguration kopieras aldrig automatiskt till Vercel eller tvärtom, och produktionshemligheter kopieras aldrig till staging eller Preview.

## Vercel `scoutgaming`: web, studio och speech

Ett projekt med tre tjänster (`vercel.json`). Registret delar upp dem som `vercel-frontend-production` (web och speech via `packages/server-transport/configuration.mjs` och `packages/navigation/server/platform-routing.mjs`), `vercel-lab-ui` (studio) och `vercel-entry` (spelarbygget). Allt sätts i Production; Preview pekar på produktionens adresser men saknar ingresshemligheten och är ingen skrivbar testmiljö.

| Namn | Krav | Tjänst | Syfte |
| --- | --- | --- | --- |
| `CROUPIER_VERCEL_UI` | krävs, `1` | web, studio, speech | Slår på transporten till spelmotorn |
| `CROUPIER_VERCEL_UNIFIED_UI` | krävs, `1` | web, studio | En publik origin för spel och Admin; kräver `CROUPIER_STUDIO_NATIVE_ADMIN=1` |
| `CROUPIER_STUDIO_NATIVE_ADMIN` | krävs, `1`; läses även vid bygget | web, studio | Admin körs på Vercel; spelmotorn behåller spelauktoriteten |
| `CROUPIER_PUBLIC_ORIGIN` | krävs | web, studio, speech | `https://www.scoutgaming.tech`; även länkar i mejl |
| `CROUPIER_BACKEND_ORIGIN` | krävs | web, studio, speech | Spelmotorns exakta origin, `https://croupier-v3.onrender.com` |
| `CROUPIER_VERCEL_INGRESS_SECRET` | krävs, Sensitive | web, studio, speech | Signerar anrop till spelmotorn; samma värde som på Render |
| `CROUPIER_LAB_UI_ORIGIN` | krävs när `CROUPIER_LAB_REMOTE_UI=1` | web, studio | Studiozonens egen origin; `apps/studio/lib/remote-ui.mjs` kräver att den skiljer sig från den publika originen och från spelmotorns, annars svarar Studio 503 |
| `CROUPIER_LAB_REMOTE_UI` | krävs, `1` | studio | Studio bakom den publika originen |
| `CROUPIER_LAB_BASE_PATH` | krävs, `/studio`; byggtid | studio | basePath; `NEXT_PUBLIC_LAB_BASE_PATH` härleds vid bygget |
| `CROUPIER_STREAM_LANE` | krävs, `lissabon-stream-lane` | studio | Anslutnings-ID mot spelmotorn |
| `LAB_PUBLIC_URL` | villkorlig | studio | Betrodd proxy-origin för sessionskontrollen; ingen lokal Studio-process |
| `CROUPIER_STUDIO_NEON_POLICY` | krävs, `1` | web, studio | Neon är registret; ingen disk- eller seedreserv |
| `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID` | krävs | studio | Serverägt scope (`production`/`croupier`); samma som på spelmotorn |
| `CROUPIER_GAME_DATABASE_URL` | krävs, Sensitive | studio | Neon `croupier_game` med TLS. `CROUPIER_NEON_*` väljer inte registret |
| `CROUPIER_MEDIA_STORAGE`, `BLOB_READ_WRITE_TOKEN` | krävs (`blob`), Sensitive | studio | Privat Blob för uppladdning och medie-API |
| `RESEND_API_KEY`, `CROUPIER_STUDIO_MAIL_FROM` | villkorlig, par | studio | Inbjudan och lösenordsåterställning för personal och bolag; utan dem skapas kontot men inget mejl skickas |
| `CROUPIER_DEALER_IMPORT_AI` | valfri, `1` | studio | AI-förslag i klippimporten och Admin-assistenten |
| `OPENCLAW_MODEL_API_KEY`, `OPENCLAW_MODEL_API`, `OPENCLAW_MODEL_BASE_URL`, `OPENAI_API_KEY` | villkorlig | studio | Modellen för importen, assistenten och "Skapa bakgrund med AI"; `OPENAI_API_KEY` används bara mot OpenAI när den särskilda nyckeln saknas. En uttryckligt tom nyckel stänger av. AI-bilder kräver Responses-API:t (`OPENCLAW_MODEL_API` osatt eller `openai-responses`) |
| `CROUPIER_AI_IMAGE_MODEL` | valfri, standard `gpt-6.1-sol` | studio | Modellen som skriver bildprompten ur den fasta ramen och referenserna och anropar Responses-API:ts bildverktyg (`POST /studio/api/layer-assets/generate`, `apps/studio/lib/ai-background-api.mjs`). Bildverktyget renderar med `gpt-image-2.5-sunburst`, fast i koden. Ogiltigt namn stänger av funktionen |
| `CROUPIER_AI_IMAGE_REASONING` | valfri, standard `xhigh` | studio | Resonemangsnivå för modellen ovan: `low`, `medium`, `high`, `xhigh` eller `max` (OpenAI:s nivåer för gpt-6.1-sol; Jakobs "extra hög" = `xhigh`). Annat värde stänger av funktionen |
| `CROUPIER_AI_IMAGE_DAILY_LIMIT` | valfri, standard `20` | studio | Högst så många AI-bildförslag per dygn (Stockholmstid), 0–1000; `0` stänger av. Räknas i minnet per Vercel-instans och nollställs vid kallstart, eftersom ingen databastabell finns för den. Det är därför ingen hård gräns: den hårda gränsen sätts som budget i OpenAI-projektet. Varje försök räknas, även misslyckade |
| `OPENCLAW_API_KEY` (alias `OPENCLAWAPI_KEY`) | villkorlig, Sensitive | studio | Admins OpenClaw-flik mot Gateway; samma värde som Gatewayns nyckel, aldrig till webbläsaren |
| `RUNWAY_API_KEY` | valfri | studio | "Skapa material" under Dealers & klipp |
| `CARTESIA_API_KEY` | valfri | studio | Röstprov i Admin |
| `CROUPIER_STUDIO_MOVING_DRIFT_API`, `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` | villkorlig | web, studio | Driftväljaren för rörligt tal, se nedan |
| `CROUPIER_VERCEL_FRONTEND_ORIGIN` | valfri | studio | Betrott proxyursprung för en separat förhandsfrontend; tom i produktionen |
| `CROUPIER_GAME_ORIGIN` | sätts inte på Vercel | web (`vercel-entry`) | Behövs bara när `apps/web/tools/player-ui-build.mjs` körs fristående. Vercel-bygget (`prepare-platform-ui.mjs`) tar originen från `CROUPIER_BACKEND_ORIGIN` |
| `CROUPIER_DATABASE` | krävs, `postgres` | studio | `studio-render-persistence.mjs` svarar 503 utan `postgres` och en Neon-adress |
| `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_STREAMING` | valfri, av | studio | Läses av `generated-speech-runtime.mjs` via Studios talväg; bara `1` slår på, så osatt och `0` är samma sak. Talet körs på Render |
| `BO_URL` | sätts inte | – | Läses inte på Vercel; bara spelmotorn härleder den |
| `CROUPIER_ASTRID_CAMERA`, `CROUPIER_PLAYER_ACCOUNTS` | sätts inte | – | Läses bara av spelmotorn |
| `CROUPIER_NEON_*` (16 namn), `CROUPIER_MEDIA_STORE_ID` | värdhanterad | projektet | Injiceras av Vercels Neon- och Blob-kopplingar; koden läser dem inte |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` | nekas | web, studio | Talleverantörerna bor på Render; Vercel ska inte ha kopior |
| `CROUPIER_ZONES_DATABASE_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | nekas | studio | Hör till spelmotorn respektive Director |
| `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW` | nekas | studio | `1` stänger av molntalet respektive slår på den lokala förhandsvisningen |
| `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`, `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD`, `CROUPIER_GENERATED_SPEECH_DIR`, `LAB_STUDIO_DATA_DIR` | nekas | studio | Talbudget och endpoint hör till Render; diskvägarna är pensionerade |
| `NODE_ENV`; `HOST`, `CROUPIER_CLOUD_RUNTIME`, `PUBLIC_URL` | värdhanterad; sätts inte | studio | Läses av den delade talmodulen för att känna igen molnet; Vercel sätter `NODE_ENV` |

Speech (`apps/speech`) läser `PORT` och samma transportnycklar som web; den har inga egna namn. Native Node-funktionerna `/speech-stream` och `/lipsync-worker` har 300 respektive 600 sekunders gräns i `vercel.json`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

## Render `croupier-v3`: spelmotorn

Registerposten är `render-game`. `ops/cloud/config.mjs` validerar processmiljön vid start och vägrar starta vid fel; `node ops/cloud/start.mjs --check` provar konfigurationen utan att starta spelet. Driftreceptet står i [RENDER-V3](../ops/cloud/RENDER-V3.md).

| Namn | Krav | Syfte |
| --- | --- | --- |
| `NODE_ENV` | krävs, `production` (imagen sätter) | Produktionsläge |
| `CROUPIER_CLOUD_LAUNCH` | krävs, `pilot` | Tillåter `start.mjs --start` |
| `CROUPIER_CLOUD_LAYOUT` | krävs, `single-origin` | En publik origin. Kodens standard `separate-hosts` används inte |
| `CROUPIER_STREAM_LANE` | krävs, `lissabon-stream-lane` | Anslutnings-ID |
| `CROUPIER_DATABASE` | krävs, `postgres` | Enda databasvägen; annat värde stoppar starten |
| `CROUPIER_GAME_DATABASE_URL` | krävs | Neon `croupier_game`; TLS `require`, `verify-ca` eller `verify-full` (produktionen `verify-full`) |
| `CROUPIER_STUDIO_NEON_POLICY`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID` | krävs | Samma register och scope som Vercel |
| `CROUPIER_MEDIA_STORAGE`, `BLOB_READ_WRITE_TOKEN` | krävs (`blob`) | Privat Blob; ingen diskreserv |
| `CROUPIER_VERCEL_TRANSPORT_ORIGIN` | krävs | Motorns egen adress, `https://croupier-v3.onrender.com` |
| `CROUPIER_PUBLIC_ORIGIN`, `PUBLIC_URL` | krävs, lika | `https://www.scoutgaming.tech` |
| `CROUPIER_VERCEL_INGRESS_SECRET` | krävs | Samma som Vercel |
| `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN`, `CROUPIER_PUBLIC_GAME_PATH` | härleds | Sätts inte i `single-origin`; satta måste de vara lika med den publika originen |
| `CROUPIER_SHARED_TABLE_ENABLED` | villkorlig, `0`/`1` | Delat bord, se nästa avsnitt |
| `CROUPIER_PLAYER_ACCOUNTS` | valfri, `0`/`1` | Spelarkonton |
| `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | villkorlig, par | Director för spelchatt, genererat tal och kamera. Utan paret avvisas chatten som okonfigurerad; inspelade repliker behöver det inte. Halvt par stoppar starten |
| `CROUPIER_PRESENTATION_DIRECTOR_URL`, `CROUPIER_PRESENTATION_DIRECTOR_TOKEN` | valfri, par | Presentationsanslutning till Director |
| `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_SPEECH_TIMEOUT_MS` | valfri | Tidsgränser; `OPENCLAW_SPEECH_TIMEOUT_MS=20000` på både motorn och Director före adaptiv chatt |
| `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH` | villkorlig, båda `1` eller båda av | Genererat tal; kräver `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` |
| `CROUPIER_GENERATED_SPEECH_STREAMING` | villkorlig | Strömmat tal; kräver olika `CROUPIER_SPEECH_STREAM_WORKER_SECRET` och `CROUPIER_SPEECH_STREAM_TICKET_SECRET` (minst 32 tecken), `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD` (högst 10) och `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` (högst 20, minst reserven) |
| `CROUPIER_SPEECH_FULLFILE_RESERVE_USD` | villkorlig | Reserv för helfilstal utan streaming; räknas mot samma dygnstak |
| `CROUPIER_DEALER_SPEECH_PROFILES`, `ELEVENLABS_API_KEY` | villkorlig | Röstprofil per dealer; kräver streaming och Neon. Saknad röst ger fel, aldrig en annan dealers röst |
| `CROUPIER_MOVING_SPEECH_ENABLED` | villkorlig | Rörligt tal; kräver dealerprofiler och `CROUPIER_MOVING_SPEECH_BANK_RECORD`, `_ENDPOINT_ID`, `_RUNPOD_API_KEY`, `_IMAGE` (GHCR-digest), `_RELEASE_SHA256`, `_TICKET_SECRET`, `_WORKER_ORIGIN` (lika med `RENDER_EXTERNAL_URL`) samt driftväljaren med exakt en profil |
| `CROUPIER_STUDIO_MOVING_DRIFT_API`, `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` | villkorlig | Samma profil-JSON som i Admin |
| `CROUPIER_ASTRID_CAMERA`, `CROUPIER_ASTRID_TRANSLATION_KEY` | villkorlig | Spelarens mikrofon och översättning; kameraflaggan kräver nyckeln |
| `CROUPIER_VERCEL_FRONTEND_ORIGIN` | valfri | Extra betrott webbläsarursprung; tom i produktionen, då godtas den publika originen |
| `CROUPIER_ZONES_DATABASE_URL` | valfri | Skydd: nekar samma databas som game/auth, även via pooler-alias. Öppnar inga zonvägar |
| `GENERATIONS_READ_TOKENS` | valfri, sätts inte i Render | Kommaseparerade sha256-hexdigester (inte tokenvärden) av godkända bearer-token för den läsande `/api/v1/generations`-ytan i `services/game/generations-api.mjs`; bara `/mapping` svarar, övriga vägar ger 410. `services/game/server.mjs` läser processmiljön och annars `CROUPIER_ENV_FILE` eller `/etc/croupier/agent.env`. Osatt eller tomt ger 401 på allt. `ops/cloud/config.mjs` för inte vidare nyckeln till spelprocessen och mappningen är av i molnet, så i Render `croupier-v3` svarar ytan alltid 401. Rotation: lägg till eller ta bort en digest och starta om |
| `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER`, `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` | första start | Skapar första administratören i en tom kontodatabas; tas bort efteråt. Ändrar aldrig ett befintligt lösenord |
| `PORT`, `HOST`, `RENDER_EXTERNAL_URL`, `RENDER_SERVICE_ID`, `RENDER_GIT_COMMIT`, `RENDER_INSTANCE_ID`, `CROUPIER_CLOUD_RUNTIME` | värdhanterad | Render och starten sätter dem; `RENDER_GIT_COMMIT` blir SHA i `/__cloud/version` |
| `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW`, `CROUPIER_LISSABON_PROFILES` | nekas | `1` stoppar starten |
| `NODE_OPTIONS`, `NODE_PATH`, `LD_PRELOAD`, `NODE_EXTRA_CA_CERTS`, `NODE_TLS_REJECT_UNAUTHORIZED` | nekas | Förs aldrig vidare till spelprocessen |
| `CROUPIER_CLOUD_LAB_CHILD` | pensionerad | Annat än tomt eller `0` stoppar starten; borttagen ur produktionen |
| `CROUPIER_DATA_DIR`, `LAB_STUDIO_DATA_DIR`, `CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`, `CROUPIER_GENERATED_SPEECH_DIR` | pensionerad | Satt värde stoppar starten (SQLite- och diskvägarna är borta) |
| `CROUPIER_CLOUD_DATA_ROOT`, `LAB_VIDEO_ARCHIVE`, `CROUPIER_MEDIA_BLOB_INDEX`, `CROUPIER_STORAGE_MAINTENANCE`, `CROUPIER_STORAGE_EXPORT_SECRET`, `NEXT_PUBLIC_LAB_BASE_PATH` | sätts inte | Läses bara av vakter, den historiska `studio-export` eller tester |

`LAB_REMOTE_URL`, `LAB_REMOTE_TOKEN`, `CROUPIER_LAB_BASE_PATH` och `BETTALOTTO_PARTNER_*` läses inte av spelmotorns start.

## Delade Blackjackrum — avgränsad inkoppling

`CROUPIER_SHARED_TABLE_ENABLED=1` slår på delade bord i spelmotorn: Postgres, befintlig Studio-repository och scope, samma appägda pool och demoplånbok. Saknade schema 008/009/010 stoppar starten; starten installerar inget. Ursprung följer `CROUPIER_VERCEL_FRONTEND_ORIGIN` och `CROUPIER_PUBLIC_ORIGIN`/`PUBLIC_URL`; i enkel-origin-layouten godtas den publika originen (PR #442, `cc415cd8`). Rumsvägarna routas i `vercel.json` (`/shared-room/*`) och `platform-routing.mjs` (`/api/shared-room/*`).

**Regel:** produktionens `croupier-v3` har flaggan osatt. Den sätts där bara som del av O03, efter Jakobs separata godkännande och verifierad readiness, aldrig som bieffekt av ett prov. Stagingen kör `=1` sedan 27 oktober 2026. Kontrollera `/__cloud/health` efter varje ändring.

## Driftväljarens API

<a id="driftvaljarens-api"></a>

Servern registrerar driftväljaren för rörligt tal bara med `CROUPIER_STUDIO_MOVING_DRIFT_API=1` och `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`: en JSON-array med 1–8 profiler, var och en med exakt `id`, `label`, `endpointId`, `releaseDigest` och `bankHash`. Fel eller saknad konfiguration ger stängt API (503) utan att påverka resten av Admin. Flaggan startar ingen provider; `connected:true` kräver en färsk executor i samma databas, annars tillåts bara Av.

För spelmotorn krävs dessutom `CROUPIER_MOVING_SPEECH_ENABLED=1` och exakt en profil (`baseline`) vars `endpointId` och `releaseDigest` är lika med `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` och `CROUPIER_MOVING_SPEECH_RELEASE_SHA256`, och vars `bankHash` är bankpostens SHA-256. Samma profil-JSON sätts på Vercel och Render. Tabellen `croupier_studio.moving_drift_control` kräver SELECT, INSERT och UPDATE för runtime-rollen `croupier_game` (beviljat i produktionen 19 oktober 2026). Av i Admin är den ordinarie stoppvägen.

## Director `croupier-lab-director`

Registerposten är `render-openclaw-director`; standardvärden står i Blueprint `services/openclaw/lab/render.yaml`.

| Namn | Krav | Syfte |
| --- | --- | --- |
| `LAB_API_TOKEN` | krävs (Blueprint genererar) | Directors eget API |
| `OPENCLAW_API_KEY` (alias `OPENCLAWAPI_KEY`) | krävs (från Gateway) | Gatewayns nyckel; inom samma källa vinner det kanoniska namnet |
| `OPENCLAW_PRODUCT_SPEECH_TOKEN` | villkorlig, sätts privat | Spelmotorns talrelä; samma värde som på `croupier-v3`, skilt från `LAB_API_TOKEN` |
| `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL` | krävs ett av dem | Gatewayns adress (Blueprint hämtar `hostport` från Gateway) |
| `HOST`, `PORT`, `LAB_DATA_DIR` | valfri | `0.0.0.0`, `4188`, `/data/catalog` |
| `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_SPEECH_AGENT` | valfri | OpenClaw-rollerna `openclaw/croupier-director`, `openclaw/croupier-chat`, `openclaw/croupier-speech` (Blueprint och kodens standard) |
| `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_SPEECH_TIMEOUT_MS` | valfri | Råd 8000 ms; tal 20000 ms tillsammans med spelmotorn |
| `OPENCLAW_SPEECH_ROUTING`, `OPENCLAW_SPEECH_DEEP_MODEL` | valfri | `adaptive` tillåter en fördjupning med `gpt-6-sol` (Blueprint); kodens standard är `fixed` |
| `OPENCLAW_DASHBOARD_ENABLED` | valfri | Gatewayns inloggning via Director |
| `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY` | valfri, hemlig | Ed25519-nyckel (base64 PKCS8) för Admins modellval; bara på Director |
| `OPENCLAW_DASHBOARD_ORIGIN`, `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK` | valfri | Utan origin används `RENDER_EXTERNAL_URL` (värdhanterad) när `OPENCLAW_DASHBOARD_ENABLED=true`; loopback bara lokalt |
| `LAB_COMPANION_ENABLED`, `LAB_COMPANION_FUN_ENABLED`, `LAB_COMPANION_WEB_ENABLED` | valfri | Följeslagarfunktionerna; bara `false` stänger av |
| `OPENCLAW_PRODUCT_SPEECH_URL` | valfri, bara lokalt | Directors egen relämottagare i labbet; sätts inte på Render |
| `LAB_REMOTE_URL`, `LAB_REMOTE_TOKEN` | nekas | Lokalt fjärrläge som skickar vidare till en annan Director; stänger av Gateway-inloggningen och sätts aldrig på Render |

Directors läsare är `packages/director/configuration.mjs` (`DIRECTOR_ENV_KEYS`). Bara panelen, inte Blueprint, äger värdet för `OPENCLAW_PRODUCT_SPEECH_TOKEN` och `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY`.

## Gateway `croupier-lab-openclaw`

Privat tjänst; registerposten är `render-openclaw-gateway`.

| Namn | Krav | Syfte |
| --- | --- | --- |
| `OPENCLAW_API_KEY` (alias `OPENCLAWAPI_KEY`) | krävs, sätts privat | Gatewayns lösenord; samma som Director och Studio |
| `OPENCLAW_MODEL_API_KEY` | krävs, sätts privat | Modelleverantörens nyckel |
| `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API` | valfri | `https://api.openai.com/v1`, `gpt-5.6-terra`, `openai-responses`. Gäller nya konfigurationer; en sparad `openclaw.json` behåller sina rollmodeller tills de byts i Admin |
| `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH` | valfri | `18789`, `/data/openclaw`, `/data/openclaw/openclaw.json` |
| `OPENCLAW_DASHBOARD_ORIGIN` | valfri | Directors exakta HTTPS-origin utan `/openclaw` |
| `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK` | valfri | Bara lokalt |
| `CROUPIER_SPEECH_VISION` | valfri, sätts i panelen | Bildstöd i talet, opt-in; satt i panelen |

## Staging: skillnader mot produktionen

Staging (se [START-HERE](../START-HERE.md#staging)) använder samma namn som produktionen men egna värden, och tas bort efter O03.

- **Vercel `croupier-k06-k07-staging`:** egen `CROUPIER_GAME_DATABASE_URL` till `croupier_staging` med approllen `croupier_staging_app`, eget scope (`staging_k06_k07`/`croupier`), egen Blob-token till `store_7E06N1P4w9Mu1dZD`, egen ingresshemlighet och den egna publika adressen `croupier-k06-k07-staging.vercel.app`.
- **Render `croupier-k06-k07-staging`:** samma namn som `croupier-v3` med stagingens adresser och hemligheter, `CROUPIER_SHARED_TABLE_ENABLED=1`, AI- och talflaggor av och bootstrap-inloggningen borttagen.
- Agenternas Admin-inloggning till stagingen ligger under `STAGING_ADMIN_LOGIN_UN` och `STAGING_ADMIN_LOGIN_PW` i gitignorerad `.env.local`. De är inga tjänstevariabler.

## Övriga poster i registret

| Registerpost | Namn | Status |
| --- | --- | --- |
| `github-actions-tooling` | `CROUPIER_GAME_DATABASE_URL` (repository secret), `CROUPIER_MIGRATION_CONFIRM` | CI läser produktionens migreringsledger med `tools/check-migration-readiness.mjs`. `CROUPIER_MIGRATION_CONFIRM=apply-pending` sätts bara i den terminal där Jakob kör `--apply`, aldrig i CI eller Vercel |
| `local-runtime-media-import` | `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`, `CROUPIER_GAME_DATABASE_URL`, `CROUPIER_RUNTIME_IMPORT_CONFIRM` | `ops/neon-studio/runtime-media-import-run.mjs` byter runtime-katalogen ([REN-START](plans/REN-START.md) steg 6–7). Scope krävs alltid; `prepare` läser ingen databas, `plan` läser och `apply` skriver bara när `CROUPIER_RUNTIME_IMPORT_CONFIRM` är den granskade planens `planHash`. Sätts bara i Jakobs terminal, aldrig i CI, Vercel eller Render |
| `render-gpu-relay` | `WORKER_SECRET`, `TICKET_SECRET`, `ALLOWED_ORIGINS`, `PORT` | Separat GPU-relä i `services/astrid-gpu-worker/gateway/server.mjs`; inte driftsatt |
| `runpod-gpu-worker` | `AVATAR_ID`, `NVIDIA_DRIVER_CAPABILITIES`, `NVENC` | Äldre GPU-testworker; endpoint och nyckel hanteras i RunPod |
| `local-lab-openclaw` | Mallarna `apps/studio/.env.example` och `services/openclaw/lab/.env.example` | Lokala verktyg; ingen lokal produktstart läser dem |
| `local-emil-provider-check` | `EMIL_RUNPOD_API_KEY`, `EMIL_RUNPOD_ENDPOINT_ID`, `EMIL_CARTESIA_API_KEY`, `EMIL_ELEVENLABS_API_KEY`, `EMIL_GEMINI_API_KEY` | `node tools/check-provider-profile.mjs --profile <scoutgaming\|emil> --env-file <fil>` läser bara den valda filen och nekar blandade par. `RUNPOD_ENDPOINT_ID` är inget alias |
| `vercel-zones-qa` | `CROUPIER_ZONES_*` | Historik: projektet `croupier-player-preview-qa` raderades 8 oktober 2026 |

`RENDER_API_KEY` i `.env.local` ger agenter läsning av Render-konfiguration via REST. Den används inte av produktkoden och står därför inte i registret.

## Databasadresser i tester

Tester med injicerad pool eller schemafunktion använder `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`: adressen saknar inloggning och lösenordet skapas slumpmässigt vid körningen. `test/test-credential-fixtures.mjs` stoppar incheckade Neon-adresser med användare och lösenord i `test/` och `apps/studio/test/`. Lägg inte till scannerundantag för att dölja en sådan fixture.
