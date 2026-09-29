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
`https://croupier-v2.onrender.com`, senast verifierad Live-deploy `225433fe` från
GitHub `Jakeminator123/github-work`/`jakemanator123-github-work`.
Vercels nya `croupier-frontend` är Git-kopplat till `Jakeminator123/github-work`,
branch `jakemanator123-github-work`, rot `apps/croupier-frontend`. Dess första
Production-deploy från `d78eb4cb` är READY, och `CROUPIER_GAME_URL` är sparad
för Production och Preview med Render-spelets riktiga URL.
`github-work-vercel-entry` och `croupier-landing-preview-qa` är borttagna;
Vercels API bekräftade 404 för båda den 29 september. `CROUPIER_GAME_ORIGIN`
hör till den äldre statiska byggkoden och den kvarvarande spelpreviewn;
variabeln styr inte Next-sidan. Spelpreviewn är manuellt driftsatt utan Git-koppling. Dess browserprov
med ett syntetiskt konto styrker spelrunda, saldo efter omladdning och synlig
Astridvideo mot en isolerad Render-testbackend. Det bevisar inte produktions-
omstart, backup eller läppsynk. Se [aktuell resurskarta](CLOUD-CURRENT-STATE-2026-09-29.md).

OpenClaw Director och Gateway är båda **Live från GitHub** på `15bd1541`.
Ett internt Render-prov bekräftade att spelets produkt-token accepteras av
Director utan att värdet lästes ut; Directors `/healthz`, tokenavgränsning och
privat Gateway-modellista provades separat. Ett giltigt produktbeslut genom
hela spelkedjan återstår. Se [OpenClaw-kedjan](../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

| Tjänst | Krävs | Vid första start | Villkorligt/valfritt | Värdhanterat |
| --- | --- | --- | --- | --- |
| Render: spel + BO + Lab (`/studio`) | `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_LAB_BASE_PATH=/studio` (även Docker-bygget), `CROUPIER_CLOUD_DATA_ROOT`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER` + `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` på tom databas | Se grupper nedan | Render sätter `PORT`, `RENDER_EXTERNAL_URL` |
| Vercel: publik Next-landning (`apps/croupier-frontend`) | `CROUPIER_GAME_URL` = avsedd speladress för aktuell miljö | – | Kodfallback går till produktions-Render; lås värdet i projektet före automatisk Git-publicering | – |
| Vercel: äldre statisk ingång (`ops/vercel-entry`, inte längre publicerad) | `CROUPIER_GAME_ORIGIN` = Render-tjänstens exakta HTTPS-origin utan snedstreck på slutet | – | Historiskt byggkontrakt | – |
| Render: separat GPU-relä (ännu ej driftsatt) | `WORKER_SECRET`, annat `TICKET_SECRET` (båda minst 32 tecken), `ALLOWED_ORIGINS` = exakta spel-origins | – | – | Render sätter `PORT` |
| Render: OpenClaw Director (separat Blueprint) | `LAB_API_TOKEN` (genereras), `OPENCLAWAPI_KEY` (från privata Gateway) | – | `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens talendpoint och anges privat; `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`, `HOST`, `PORT`, `LAB_DATA_DIR`, `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_DASHBOARD_ENABLED` enligt Blueprint | Produkt-token ska skilja sig från `LAB_API_TOKEN`; Blueprint kopplar Director till Gateway |
| Render: privat OpenClaw Gateway | Separata `OPENCLAWAPI_KEY` och `OPENCLAW_MODEL_API_KEY` | – | `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, lokalt endast `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`; `CROUPIER_SPEECH_VISION` är opt-in | Blueprint anger icke-hemliga standardvärden; två nycklar anges privat |
| RunPod: separat GPU-testworker (ej produktkopplad) | Inga egna env-nycklar krävs av imagen | – | `AVATAR_ID` för annan avatar; `NVIDIA_DRIVER_CAPABILITIES`, `NVENC` endast om GPU-konfigurationen kräver det | Endpoint-id, API-nyckel och worker-inställningar hanteras i RunPod och av anropande tjänst |
| Lokal Lab/OpenClaw | Inga globala krav; beror på anslutningssätt | – | Se `open-claw/lab/.env.example` och `lab/.env.example`; nyckelnamnen speglas i JSON-listan | – |

Vercels opt-in `node build.mjs --frontend-preview` använder samma
`CROUPIER_GAME_ORIGIN` som standardbygget och inför **ingen ny env-nyckel**.
Den importerade Next-landningen har däremot `CROUPIER_GAME_URL`: i QA måste
den sättas till den isolerade spel-Previewns exakta publika URL, annars faller
knapparna tillbaka till `croupier-v2` i produktion. Det tidigare separata
QA-landningsprojektet är avvecklat. Konfigurera en isolerad speladress i
huvudprojektets Preview-miljö före spel-QA; dess nuvarande värde pekar på
produktion. Spelarprojektet `croupier-player-preview-qa` har egen Preview-
`CROUPIER_GAME_ORIGIN`, separata Neon-integrationer och Blob-token. Där finns
17 `CROUPIER_ZONES_*`-nycklar för Preview/Development från zon-Neon.
Lab-serverns zonlagring läser nu enbart `CROUPIER_ZONES_DATABASE_URL`;
de andra är alternativa leverantörsformat och styr inte zonflödet.
`BLOB_READ_WRITE_TOKEN` finns för Production/Preview/Development och är en
serverhemlighet. Render-tjänsternas Gateway-, Lab- och speech-tokenpar
verifierades samtidigt; de behöver inte kopieras till Vercels startsidor.
Se [live-kvittot](../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

### Sparade talnycklar och första adminkontot

På Render `croupier-v2` finns nu `CARTESIA_API_KEY`, `RUNPOD_API_KEY` och
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=zsudl8tmzcmiv1`. Namn/närvaro är
kontrollerade; riktigt tal har inte API-testats. `CROUPIER_GENERATED_SPEECH`
och `CROUPIER_CLOUD_GENERATED_SPEECH` är inte aktiverade. Nycklarna ensamma
startar inte talflödet. Sparande med Save only kräver en efterföljande deploy.

`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` ska sparas som serverhemlighet i
Render → `croupier-v2` → Environment, tillsammans med bootstrap-användaren.
Den används bara för att skapa första administratören i en tom CRAIG-databas.
En ändring av variabeln ändrar inte lösenordet för ett befintligt konto.

Render-spelets villkorliga grupper:

- Privat media: `CROUPIER_MEDIA_STORAGE=blob` kräver
  `BLOB_READ_WRITE_TOKEN`. Båda skickas till Web och Lab eftersom Lab laddar
  upp och spelservern levererar valda familjeklipp. Filerna är privata;
  behöriga API-routes hanterar GET, HEAD och Range utan publik Blob-URL.
  Standard utan flagga är disk. Familjeregistrets `videos/index.json`
  ligger fortsatt på den beständiga Render-disken och måste säkerhetskopieras.
- Bakgrundszoner: `CROUPIER_ZONES_DATABASE_URL` kräver aktiv privat media
  och en separat TLS-skyddad Postgres-anslutning. Den skickas endast till
  Lab. Schemat i `lab/lib/zone-cloud-schema.sql` installeras uttryckligen;
  det är installerat i zonprojektet efter separat QA den 29 september.
  Generella `DATABASE_URL`/`POSTGRES_URL` används aldrig som reserv.
  Befintliga spelkonton och saldon ligger kvar i sin tidigare databas.
- Lokal molnlagring: koordinerad `node lab/start.mjs --cloud-storage --no-open`
  läser den Git-ignorerade `lab/.env.cloud-storage.local` med samma tre namn.
  Flaggan är opt-in. Nycklarna begränsas till avsedda serverprocesser och
  nätåtkomst till lagringens exakta ursprung. Render kräver motsvarande
  server-env och en deploy; Vercel-projektets värden kopieras inte automatiskt.
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
  `CROUPIER_ASTRID_TRANSLATION_KEY`. Båda är verifierade i Render-runtime
  2026-09-29 cirka 09:26 CEST. En läsande modellkontroll med nyckeln gav
  HTTP 200 för `whisper-1`; det bevisar inte en genomförd mikrofoninspelning.
  Webbspelaren kräver fortfarande spelarens val och enhetsbehörighet.
- Genererat tal/video: `CROUPIER_GENERATED_SPEECH=1` och
  `CROUPIER_CLOUD_GENERATED_SPEECH=1` kräver `CARTESIA_API_KEY`,
  `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Streaming
  `CROUPIER_GENERATED_SPEECH_STREAMING=1` kräver dessutom olika
  `CROUPIER_SPEECH_STREAM_WORKER_SECRET` och
  `CROUPIER_SPEECH_STREAM_TICKET_SECRET` samt
  `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD` (positivt decimaltal, högst
  10 USD, högst sex decimaler). Sessionsreserven skickas enbart till Web
  och måste beräknas från den avsedda RunPod-sessionens pris före aktivering.
  `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` krävs samtidigt, med samma
  decimalformat och högst 10 USD, minst sessionsreserven. Även den går
  endast till Web. Redan förbrukade GPU-medel ska räknas av från dagens
  tillgängliga budget före aktivering; den beständiga sessionsliggaren
  behåller reserver genom omstart. Se den separata streaminghandoffen.
  Ingen av dessa funktioner är
  nödvändig för de förinspelade Lissabon-klippen.
- Partner: `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET` och
  `BETTALOTTO_PARTNER_PLAYER_ID` är en grupp om partnerkopplingen används.

Sätt inte `DEMO_GUEST_ACCESS=1`, `CROUPIER_GENERATED_SPEECH_PREVIEW=1`
eller `CROUPIER_LISSABON_PROFILES=1` i molndrift; startvalideringen avvisar
dem. Lösenord och token är endast i leverantörens hemlighetslager eller
ignorerad lokal `.env`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

Aktuell driftsättningsföljd: behåll Render-spelet och dess SQLite tills en
extern verifierad backup, separat game-Neon och återgångsprov finns. Den nya
Git-kopplade landningen har rätt rot/branch och lagrad `CROUPIER_GAME_URL`;
kontrollera varje automatisk deploy där. RunPods separata testendpoint
har producerat syntetisk MP4; Render-spelet använder ännu inget GPU-relä.
