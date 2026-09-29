# Miljövariabler per tjänst

Detta är nyckelnamnsförteckningen, inte en hemlighetsfil. Den maskinläsbara
listan finns i [`environment-variables.json`](environment-variables.json).
Ändra båda när en variabel läggs till, tas bort eller byter betydelse.
`node tools/check-environment-variables.mjs` körs i Git-hook och CI och
kontrollerar namn som läses av molnstart, Vercelbygge och GPU-relä.
Den kontrollerar **inte** värden eller leverantörspaneler. Vid ändring direkt
i Render/Vercel/RunPod: jämför endast nyckelnamn med listan och uppdatera
repo-dokumentationen i samma leverans. Lagra aldrig värden här.

Status 2026-09-29: Render visar `croupier-v2` som **Live** på
`https://croupier-v2.onrender.com` (build `a055b5c`). Vercels
`github-work-vercel-entry` har `CROUPIER_GAME_ORIGIN` satt till denna exakta
offentliga origin för Production och Preview. Värdet är en publik adress,
ingen hemlighet. En ny Production-deploy från `0507cf5c` blev **READY**;
Production är fortfarande endast landningssidan med Render-länk.
Vid föregående browserkontroll svarade
`https://github-work-vercel-entry.vercel.app/` 200 med en Blackjack-länk
till Render, och länken öppnade den publika inloggningssidan. En separat
läsande HTTPS-kontroll gav 200 för Vercels `/` och 200/`ok` för Renders
`/__cloud/health`. Inloggning, spelrunda, omstart och beständig data är ännu
inte verifierade i drift.

En separat läsande Render-kontroll 2026-09-29 visade att OpenClaw Director och
Gateway fortfarande är Live från GitLab `jakeminator123/work` på `8e10017d`.
De använder alltså ännu inte GitHub-branchens Blueprint. Det ändras först med
ett separat, granskat källbyte i Render; inga hemlighetsvärden behövs i denna
förteckning. Se [OpenClaw-kedjan och checklistan](../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

| Tjänst | Krävs | Vid första start | Villkorligt/valfritt | Värdhanterat |
| --- | --- | --- | --- | --- |
| Render: spel + BO + Lab (`/studio`) | `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_LAB_BASE_PATH=/studio` (även Docker-bygget), `CROUPIER_CLOUD_DATA_ROOT`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER` + `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` på tom databas | Se grupper nedan | Render sätter `PORT`, `RENDER_EXTERNAL_URL` |
| Vercel: statisk ingång (`ops/vercel-entry`) | `CROUPIER_GAME_ORIGIN` = Render-tjänstens exakta HTTPS-origin utan snedstreck på slutet | – | – | – |
| Render: separat GPU-relä (ännu ej driftsatt) | `WORKER_SECRET`, annat `TICKET_SECRET` (båda minst 32 tecken), `ALLOWED_ORIGINS` = exakta spel-origins | – | – | Render sätter `PORT` |
| Render: OpenClaw Director (separat Blueprint) | `LAB_API_TOKEN` (genereras), `OPENCLAWAPI_KEY` (från privata Gateway) | – | `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens talendpoint och anges privat; `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`, `HOST`, `PORT`, `LAB_DATA_DIR`, `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_DASHBOARD_ENABLED` enligt Blueprint | Produkt-token ska skilja sig från `LAB_API_TOKEN`; Blueprint kopplar Director till Gateway |
| Render: privat OpenClaw Gateway | Separata `OPENCLAWAPI_KEY` och `OPENCLAW_MODEL_API_KEY` | – | `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, lokalt endast `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`; `CROUPIER_SPEECH_VISION` är opt-in | Blueprint anger icke-hemliga standardvärden; två nycklar anges privat |
| RunPod: GPU-worker (ännu ej aktiverad) | Inga egna env-nycklar krävs av imagen | – | `AVATAR_ID` för annan avatar; `NVIDIA_DRIVER_CAPABILITIES`, `NVENC` endast om GPU-konfigurationen kräver det | Endpoint-id, API-nyckel och worker-inställningar hanteras i RunPod och av anropande tjänst |
| Lokal Lab/OpenClaw | Inga globala krav; beror på anslutningssätt | – | Se `open-claw/lab/.env.example` och `lab/.env.example`; nyckelnamnen speglas i JSON-listan | – |

Vercels opt-in `node build.mjs --frontend-preview` använder samma
`CROUPIER_GAME_ORIGIN` som standardbygget och inför **ingen ny env-nyckel**.
Det är ännu bara ett statiskt förhandsbygge; se
[`VERCEL-FRONTEND-MIGRATION.md`](VERCEL-FRONTEND-MIGRATION.md) innan
Production-ingången ändras.

Render-spelets villkorliga grupper:

- Konto/data: `CROUPIER_PLAYER_ACCOUNTS`, `LAB_VIDEO_ARCHIVE`. Spelar- och
  Lab-datakataloger härleds från `CROUPIER_CLOUD_DATA_ROOT`; manuella
  `CROUPIER_DATA_DIR`, `LAB_STUDIO_DATA_DIR`,
  `CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR` och
  `CROUPIER_GENERATED_SPEECH_DIR` får bara ange exakt samma härledda sökvägar.
- Vercel-spelarproxy: `CROUPIER_VERCEL_FRONTEND_ORIGIN` är valfri och av som
  standard. Ange endast den förhandsversionens exakta HTTPS-origin utan path,
  wildcard eller avslutande snedstreck. Den tillåter spelarens POST-anrop med
  detta Origin när Render fortfarande får sitt eget publika Host; BO och Lab
  får ingen ny tillåtelse. Konfigurationen aktiverar ingen Vercel-rewrite eller
  Production-frontend. Kontrollera Host, cookies och omdirigeringar i Preview
  innan variabeln används i drift.
- En origin: `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`,
  `CROUPIER_GAME_ORIGIN`, `BETTALOTTO_PARTNER_BASE_URL` kan utelämnas när
  Render levererar `RENDER_EXTERNAL_URL`. I separat-värdläge måste dessa
  origins konfigureras enligt `ops/cloud/config.mjs`.
- Presentation/AI: `CROUPIER_PRESENTATION_DIRECTOR_URL` +
  `CROUPIER_PRESENTATION_DIRECTOR_TOKEN`, `LAB_REMOTE_URL` +
  `LAB_REMOTE_TOKEN`. Varje par sätts tillsammans. `OPENCLAW_TIMEOUT_MS`
  är valfri tidsgräns.
- Kamera: `CROUPIER_ASTRID_CAMERA=1` kräver
  `CROUPIER_ASTRID_TRANSLATION_KEY`.
- Genererat tal/video: `CROUPIER_GENERATED_SPEECH=1` och
  `CROUPIER_CLOUD_GENERATED_SPEECH=1` kräver `CARTESIA_API_KEY`,
  `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Streaming
  `CROUPIER_GENERATED_SPEECH_STREAMING=1` kräver dessutom olika
  `CROUPIER_SPEECH_STREAM_WORKER_SECRET` och
  `CROUPIER_SPEECH_STREAM_TICKET_SECRET`. Ingen av dessa funktioner är
  nödvändig för de förinspelade Lissabon-klippen.
- Partner: `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET` och
  `BETTALOTTO_PARTNER_PLAYER_ID` är en grupp om partnerkopplingen används.

Sätt inte `DEMO_GUEST_ACCESS=1`, `CROUPIER_GENERATED_SPEECH_PREVIEW=1`
eller `CROUPIER_LISSABON_PROFILES=1` i molndrift; startvalideringen avvisar
dem. Lösenord och token är endast i leverantörens hemlighetslager eller
ignorerad lokal `.env`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

Aktuell driftsättningsföljd: låt Render-tjänsten starta och få sin `onrender.com`-
adress; kontrollera `/__cloud/health`, inloggning och en spelrunda. Sätt sedan
den exakta adressen som Vercels `CROUPIER_GAME_ORIGIN` och gör ett nytt bygge.
GPU-relä och RunPod aktiveras separat efter kostnadsbeslut och verkligt prov.
