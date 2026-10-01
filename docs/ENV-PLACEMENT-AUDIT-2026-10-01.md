# Kodbaserad env-placering, 2026-10-01

Underlag för jämförelse med Render/Vercels faktiska miljöer. Lästa källor på
`f5f3fe2a`; efter uttrycklig utökning lästes endast nyckelnamn ur aktuell
repo-root-`.env`. Inga hemlighetsvärden har skrivits ut, inga andra privata
env-filer exporterats och inga driftinställningar ändrats. **En variabel i leverantörspanelen
bevisar inte att rätt barnprocess får den.** Tjänsternas aktuella värden,
deploy-SHA, resursåtkomst och sparade Gateway-modeller verifieras separat.
Tjänstnamnet `croupier-v2` väljer inte uppspelningsläge i koden. Den granskade
molnstarten kräver uttryckligen `lissabon-stream-lane`; modell-Gateway,
genererad talvideo och den vanliga spelaren är separata delar av flödet.

## Tjänster och nödvändiga anslutningar

| Tjänst | Start och grundkonfiguration | Anslutningar som krävs för avsedd funktion |
| --- | --- | --- |
| Render `croupier-v2` | `ops/cloud/Dockerfile` → `container-entry.mjs` → `start.mjs`; `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_CLOUD_DATA_ROOT=/var/data`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`; `/studio` måste matcha byggd `CROUPIER_LAB_BASE_PATH`. Render levererar `PORT` och `RENDER_EXTERNAL_URL`. | `OPENCLAW_PRODUCT_SPEECH_URL` + `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs redan av preflight. URL är Directors exakta HTTPS-origin. På tom spelardatabas krävs även `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER` + `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD`. |
| Render `croupier-lab-director` | `open-claw/lab/Dockerfile` → `deploy/start-director.mjs`; Blueprint anger `HOST=0.0.0.0`, `PORT=4188`, `LAB_DATA_DIR=/data/catalog`. `LAB_API_TOKEN` krävs för publik lyssnare. | `OPENCLAW_HOSTPORT` från privata Gateway **eller** `OPENCLAW_BASE_URL`, plus `OPENCLAWAPI_KEY`. `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens speech/probe och måste skilja sig från `LAB_API_TOKEN`. |
| Render `croupier-lab-openclaw` | Privat tjänst; `deploy/Dockerfile.gateway` → `start-gateway.mjs`. Separata `OPENCLAWAPI_KEY` och `OPENCLAW_MODEL_API_KEY` krävs. `OPENCLAW_STATE_DIR` och `OPENCLAW_CONFIG_PATH` pekar in i beständig disk. | Providerinställningar `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_API`, `OPENCLAW_MODEL_ID` skapar initial konfiguration. Befintlig native konfiguration bevaras; se modellrisker nedan. `OPENCLAW_GATEWAY_PORT` har seed/default 18789. |
| Vercel `croupier-frontend` | Next-rot `apps/croupier-frontend`. Enda appägda lästa env är `CROUPIER_GAME_URL`. | Hel spel-URL inklusive path/query. Kodfallback är produktens inloggningsingång `/blackjack?dealer=astrid`; den leder vidare till `/?dealer=astrid&presentation=local`. Det är inte den äldre `/v2`-spelaren. Behandla som byggvärde för prerenderade sidor. |
| Vercel statisk spelpreview | `ops/vercel-entry/preview/build.mjs`, efter att `preview/prepare.mjs` skapat `preview/vercel.json`. Separat från Next-landningen. Generiska `build.mjs --frontend-preview` ensam utför inte isolerings-/rewrite-kontrollerna. | `CROUPIER_GAME_ORIGIN` krävs vid bygge: exakt HTTPS-origin utan path/query/hash/slutslash. Måste matcha samtliga rewrite-destinationer. Previewförberedelsen avvisar produktionens origin och Vercel-origin som backend. |

Källor: [cloud-konfiguration](../ops/cloud/config.mjs),
[containerstart](../ops/cloud/container-entry.mjs),
[Blueprint](../open-claw/lab/render.yaml),
[Director-inställningar](../open-claw/lab/src/settings.mjs),
[Gateway-start](../open-claw/lab/deploy/start-gateway.mjs),
[Next-spellänk](../apps/croupier-frontend/lib/game-url.ts),
[previewbygge](../ops/vercel-entry/preview/build.mjs).

## Placering efter funktion

`—` betyder ingen konsument för denna funktion i den tjänstens applikationskod.
Det är inte ett förslag att automatiskt radera integrationers hanterade nycklar.
Produktens Web och Next-Lab är två processer i samma Render-tjänst.

| Variabel/grupp | Produkt: Web | Produkt: Next-Lab | Director | Gateway | Vercel |
| --- | --- | --- | --- | --- | --- |
| `CROUPIER_MEDIA_STORAGE`, `BLOB_READ_WRITE_TOKEN` | Ja, privat medieläsning | Ja, upload/läsning | — | — | Ingen mediekonsument i landning/preview |
| `CROUPIER_ZONES_DATABASE_URL` | Filtreras bort | Ja, endast zonmetadata | — | — | Ingen DB-konsument i landning/preview |
| `OPENCLAW_PRODUCT_SPEECH_URL` | Ja, till Director | Filtreras bort | Ingen upstream-URL behövs | — | — |
| `OPENCLAW_PRODUCT_SPEECH_TOKEN` | Ja, utgående auth | Filtreras bort | Ja, inkommande produkt-auth | — | — |
| `LAB_REMOTE_URL`, `LAB_REMOTE_TOKEN` | Filtreras bort | Ja, Lab → Director | Håll omarkerad för egen Director; remote-läge avvisar produkt-speech | — | — |
| `CROUPIER_PRESENTATION_DIRECTOR_URL`, `CROUPIER_PRESENTATION_DIRECTOR_TOKEN` | Ja, presentationsråd | Filtreras bort | Mottar med `LAB_API_TOKEN` | — | — |
| `LAB_API_TOKEN` | Ej vidarebefordrad | Ej vidarebefordrad; använd `LAB_REMOTE_TOKEN` | Ja | — | — |
| `OPENCLAWAPI_KEY`, `OPENCLAW_HOSTPORT` / `OPENCLAW_BASE_URL` | Ej vidarebefordrade i molnstart | Ej vidarebefordrade i molnstart | Ja, Director → Gateway | `OPENCLAWAPI_KEY` är Gateway-auth | — |
| `OPENCLAW_MODEL_API_KEY` | — | — | Behövs inte | Ja, modellprovider; även befintlig companion-sökning när kompatibel | — |
| `OPENCLAW_DASHBOARD_ORIGIN` | — | — | Valfri explicit origin; annars Render-origin när `OPENCLAW_DASHBOARD_ENABLED=true` | Krävs för att öppna native dashboard, Directors bare HTTPS-origin utan `/openclaw` | — |
| `LAB_COMPANION_ENABLED`, `LAB_COMPANION_WEB_ENABLED`, `LAB_COMPANION_FUN_ENABLED` | Ej vidarebefordrade | Ej vidarebefordrade i molnstart | Ja, strängen `false` stänger respektive funktion | Enabled/web läses; fun läses inte av startaren | — |
| `OPENCLAW_SPEECH_ROUTING`, `OPENCLAW_SPEECH_DEEP_MODEL` | Ej vidarebefordrade | Ej vidarebefordrade | Ja: `fixed`/`adaptive`, endast tillåten deep-modell `gpt-6-sol` | — | — |
| `OPENCLAW_SPEECH_TIMEOUT_MS` | Ja, yttre speech-relä | Filtreras bort | Ja, delad budget för beslut | — | — |
| `OPENCLAW_TIMEOUT_MS` | Ja, generisk fallback | Filtreras bort i molnstart | Ja, generisk modelltimeout | — | — |
| `CROUPIER_ASTRID_CAMERA`, `CROUPIER_ASTRID_TRANSLATION_KEY` | Ja, kamera/mikrofon och Whisper | Filtreras bort | — | — | — |
| `CROUPIER_SPEECH_VISION` | Filtreras bort | Filtreras bort | — | Ja, lägger till image-input för Luna/Terra/Sol i kompatibel katalog | — |
| `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH` | Ja, båda måste vara `1` | Filtreras bort | — | — | — |
| `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` | Ja, när genererat tal aktiveras | Filtreras bort | — | — | — |
| `CROUPIER_GENERATED_SPEECH_STREAMING` | Ja, kräver genererat tal | Filtreras bort | — | — | — |
| `CROUPIER_SPEECH_STREAM_WORKER_SECRET`, `CROUPIER_SPEECH_STREAM_TICKET_SECRET` | Ja, separata hemligheter; minst 32 tecken | Filtreras bort | — | — | — |
| `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD`, `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` | Ja, positiva ≤10 USD, högst sex decimaler; reserv ≤ dygnstak | Filtreras bort | — | — | — |
| `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET`, `BETTALOTTO_PARTNER_PLAYER_ID` | Filtreras bort | Ja, hela gruppen krävs tillsammans | — | — | — |
| `CROUPIER_VERCEL_FRONTEND_ORIGIN` | Ja, exakt separat HTTPS-origin för tillåten spelarproxy | Ingen Lab-behörighet | — | — | Ska sitta på Render-backend |

Den auktoritativa vidareföringen finns i `ops/cloud/config.mjs:210`.
Blob har opt-in `CROUPIER_MEDIA_STORAGE=blob`; default är `disk`. Blobtoken
ensam byter inte lagringsläge. Zoner behöver dessutom den avsedda
Neon-anslutningen med TLS och installerat `croupier_zones`-schema.
Familjernas register ligger fortfarande på beständig Render-disk; Blob lagrar
privata mediebytes. Spelarkonton är fortfarande SQLite.

## Konkreta konflikt- och aliasrisker

1. **Tre olika URL-namn har olika betydelser.** Next läser `CROUPIER_GAME_URL`;
   statisk preview läser `CROUPIER_GAME_ORIGIN`; `GAME_ORIGIN` ensamt läses
   inte av dessa byggytor. Nexts Lab-genvägar är hårdkodade till Render-produktens origin och följer
   inte `CROUPIER_GAME_URL` (`next.config.mjs:9`, `app/labb-lissabon/route.ts:3`).
   Previewrewrites saknar Lab/upload och generated-speech/stream. Att lägga
   Blob/Neon eller en ny origin i Vercel skapar inte dessa backendfunktioner.
2. **Produktens single-origin-adresser måste vara överens.** `PUBLIC_URL`
   kan härledas från `RENDER_EXTERNAL_URL`; `BO_URL`, `LAB_PUBLIC_URL`,
   `CROUPIER_GAME_ORIGIN` och `BETTALOTTO_PARTNER_BASE_URL` härleds då till
   samma origin. Manuella motstridiga värden stoppar start. `/studio` är en
   bygginställning också; bara ny runtime-env kan inte ändra Nexts basePath
   (`ops/cloud/config.mjs:113`, `ops/cloud/start.mjs:47`).
3. **Gateway-adressens manuella override vinner.** Directors `OPENCLAW_BASE_URL`
   har företräde framför `OPENCLAW_HOSTPORT`; en gammal URL kan därför göra
   Blueprintens korrekta privata hostport verkningslös
   (`deploy/start-director.mjs:5`, `src/settings.mjs:34`).
4. **Auth-nycklar är inte utbytbara.** Produktens speech-token ska matcha
   Directors speech-token. Lab remote- och presentations-token ska matcha
   Directors `LAB_API_TOKEN`. Directors `OPENCLAWAPI_KEY` ska matcha Gateway,
   vars modellprovider kräver en annan nyckel. `OPENCLAW_GATEWAY_PASSWORD`
   härleds av startaren; `OPENCLAW_GATEWAY_TOKEN` och
   `OPENCLAW_CONFIG_READONLY` tas uttryckligen bort (`start-gateway.mjs:24`).
5. **Timeout måste räcka i båda leden.** Produktens utelämnade
   `OPENCLAW_SPEECH_TIMEOUT_MS` faller tillbaka till generiska 8000 ms.
   Director adaptive utan explicit speech-timeout använder 20000 ms; fixed
   använder generisk timeout. Sätt avsiktligt samma speech-budget i produkt
   och Director; tillåtet explicit intervall är 1000–30000 ms. Generisk
   `OPENCLAW_TIMEOUT_MS` behöver inte höjas. Blueprint har ännu ingen explicit
   speech-timeout och sätter routing till `fixed`, så den är inte ett kvitto
   på den senare driftaktiveringen (`config.mjs:158`, `speech-routing.mjs:14`).
6. **Env-modell är inte samma sak som faktisk rollmodell.** Gateway bevarar
   `openclaw.json` och befintliga primärmodeller/fallbacks; ändrad
   `OPENCLAW_MODEL_ID`, API eller base URL ersätter inte dem. Katalogens
   bildstöd måste läsas separat. `CROUPIER_SPEECH_VISION=1` lägger till
   bildstöd, men att ta bort flaggan tar inte bort redan sparat image-input
   (`gateway-config.mjs:253`, `:289`). Director-routing gäller bara Astrid
   med Terra/Luna/default; annan uttrycklig modell hålls fast.
7. **Whisper och bildmodell har skilda grindar.** Web läser bara
   `CROUPIER_ASTRID_TRANSLATION_KEY`, ingen molnfallback till `OPENAI_API_KEY`.
   Kamera kräver dessutom Lissabon-lane. Whisper är fast `whisper-1` mot
   `/v1/audio/translations` och ger engelska; ingen `WHISPER_MODEL`-variabel
   finns här. Gateway-vision gör inte kamera/mikrofon aktiv och ersätter
   inte användarens samtycke (`web/server.mjs:711`, `astrid-transcription.mjs:127`).
8. **Neon-alias ger ingen fallback.** `DATABASE_URL`, `POSTGRES_URL` och
   integrationens övriga `CROUPIER_ZONES_POSTGRES_*`/`PG*` är inte zon-storets
   anslutning. Endast `CROUPIER_ZONES_DATABASE_URL` läses
   (`lab/lib/zone-cloud-store.mjs:46`). Nycklar provisionerade på Vercel
   innebär inte att Render eller lokal Lab fått dem.
9. **GPU-endpoint och hemligheter är funktionsspecifika.** Molnstart läser
   `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, inte `RUNPOD_ENDPOINT_ID`.
   `WORKER_SECRET`, `TICKET_SECRET`, `ALLOWED_ORIGINS` hör till separat
   fristående relä och aktiverar inte produktens inbyggda streaming.
   `ELEVENLABS_API_KEY`/`ELEVENLABS_OC_API` är inte Cartesia-nycklar.
   Genererat tal i Render skickas bara till Web; Labs lokala talprovsyta
   aktiveras därför inte av dessa produktvariabler.
10. **Dokumentregistret är ingen full runtime-validering.** Öppningen i
    `ENVIRONMENT-VARIABLES.md` innehåller uttryckligen historiska 29/9-SHA:n.
    Director-registret utelämnar faktiskt lästa dashboard-origin/loopback och
    `LAB_COMPANION_*`; Gateway-start läser också companion enabled/web.
    Companion-flaggor använder strängen `false`, kamera/tal/vision använder
    `1`; `0` stänger alltså inte companion. Dessa ska jämföras med rätt
    konsument, inte godtyckligt normaliseras (`src/settings.mjs:11`,
    `deploy/start-gateway.mjs:165`).

Produktens härledda diskvariabler (`CROUPIER_DATA_DIR`, `LAB_STUDIO_DATA_DIR`,
`CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`,
`CROUPIER_GENERATED_SPEECH_DIR`) ska inte peka på andra kataloger än
`CROUPIER_CLOUD_DATA_ROOT`-strukturen. `LAB_VIDEO_ARCHIVE` och
`CROUPIER_PLAYER_ACCOUNTS` är valfria. Molnstart avvisar lokalflaggorna
`DEMO_GUEST_ACCESS=1`, `CROUPIER_GENERATED_SPEECH_PREVIEW=1` och
`CROUPIER_LISSABON_PROFILES=1`.
Produktens `HOST`/barnportar styrs av startaren; en egen `HOST` i panelen
skickas inte vidare. Publik `PORT` får inte vara barnens 4173 eller 4188.
`CROUPIER_LAB_INTERNAL_SECRET` skapas vid varje produktstart och ska inte
manuellt återanvändas som någon extern API-nyckel.

## Lokal jämförelse och verifieringsgräns

Den koordinerade lokala startaren läser i ordning repo-`.env`,
`lab/.env.local`, `lab/.env.generated-speech.local` och, bara med
`--cloud-storage`, `lab/.env.cloud-storage.local`. Senare fil vinner och
process-env vinner sist. Kamera/tal/molnlagring kräver respektive uttryckliga
launcher-opt-in; tillgång till filen ensam aktiverar inte funktionerna.
En explicit `OPENCLAW_SPEECH_TIMEOUT_MS` går till Web, inte Next-Lab.
Lokala credential-alias som startaren accepterar är inte automatiskt giltiga
Render-alias (`open-claw/lab/deploy/local-connection.mjs:121`, `:405`).

### Root-`.env` och verkliga lokala startvägar

Nyckelinventering 1 oktober: root-`.env` finns och innehåller 17 namn.
Inga dubbla tilldelningar av samma nyckelnamn hittades i rootfilen.
Denna källkodsmatris provade inte värdena. Efterföljande begränsad jämförelse
av effektiv lokal konfiguration och levande molnanslutningar finns i
[driftauditen](CLOUD-ENV-STORAGE-AUDIT-2026-10-01.md).

| Grupp med befintliga namn i root-`.env` | Faktisk lokal läsning |
| --- | --- |
| `LAB_REMOTE_URL`, `LAB_REMOTE_TOKEN`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN`, `OPENCLAW_SPEECH_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAWAPI_KEY`, `OPENCLAW_MODEL_API_KEY` | Koordinerade anslutningsstartarens selektiva whitelist. Gateway/provider-nycklar skickas inte automatiskt till produktens cloud-relay-läge; modellprovider-nyckeln används även vid credential-separation. |
| `OPENAI_API_KEY`, `CARTESIA_API_KEY` | OpenAI-alias läses av den koordinerade startaren vid kamera-opt-in. Cartesia läses vid genererat tal och selektivt av vanliga Labs `readVoiceSettings`. |
| `LAB_API_TOKEN` | Ingår i native Directors `readSettings`; ingår inte i koordinerade produkt/Lab-startarens `PRIVATE_KEYS`. |
| `BETTALOTTO_API` | Vanliga Labs reference-modul läser selektivt root-`.env` sedan `lab/.env.local`. Koordinerad isolerad anslutning sätter uttryckligen tomt värde och skapar egen Partner-kontext. |
| `LAB_PARTNER_KEY_ID`, `LAB_PARTNER_PLAYER_ID`, `LAB_PARTNER_SECRET` | Partner-observer stöder dessa som process-env-alias, men läser inte rootfilen själv. Att namnen finns i rootfilen ensam konfigurerar därför inte denna observer. Koordinerad anslutning skapar egna canonical Partner-nycklar. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_OC_API` | Specialverktyget `tools/elevenlabs-lab-preview.mjs` läser rootfilen. De är inte produktens Cartesia-konfiguration och väljs inte av Lissabon-startarens talgrupp. |

Rootfilen saknar `BLOB_READ_WRITE_TOKEN`, `CROUPIER_MEDIA_STORAGE`,
`CROUPIER_ZONES_DATABASE_URL`, RunPod-nyckel/endpoint och
`OPENCLAW_SPEECH_TIMEOUT_MS`. Det är **inte** bevis på att de saknas i senare
prioriterade filer, processmiljö eller en redan startad tjänst.

| Startväg | Root-`.env`-beteende |
| --- | --- |
| `Start-Lab.cmd` → `lab/start.mjs`; även `Start-Lissabon.cmd` alias | Normal ansluten start använder `loadPrivateConnection` och ovannämnda filordning. Profilen aktiverar genererat tal; `--astrid-camera` och `--cloud-storage` väljer respektive tillägg. `--offline` använder separat isolerad fixture som blockerar env-filläsning. |
| `Start-Labb.cmd` → `Start-Labb.ps1` → `tools/start-lab-session.mjs` | Startar bara Next-Lab; wrappern laddar inte hela rootfilen till process-env. Lab-moduler läser selektivt OpenClaw-inställningar, Cartesia och reference-token enligt ovan. Ingen generell root-`.env`-laddning av Blob/Neon/Partner-alias sker där. |
| `Start-Lissabon.ps1` direkt | Auditen hittade en hänvisning till borttagna `lissabon/start.mjs`. Den är nu rättad till samma befintliga `lab/start.mjs` som `.cmd`-aliaset. PowerShell-syntax, målfilens existens och Node-syntax verifierades utan serverstart. |
| Native Director från checkout | `readSettings` läser selektivt root-`.env`, sedan `open-claw/lab/.env`, sedan process-env. Detta är en annan filkedja än koordinerad Lab-start. |
| Render produkt/Gateway och Vercelbyggkoden | Ingen implicit överföring från datorns root-`.env`. Produkt- och OpenClaw-Dockercontext utesluter privata env-filer. Gateway-start läser process-env; molnproduktens preflight likaså. Vercelprojekten använder sina egna konfigurerade byggmiljöer. |

Källor: `Start-Lissabon.ps1:27`, `Start-Lissabon.cmd:2`, `lab/start.mjs:67`,
`lab/policies/local-profile.json`, `tools/start-lab-session.mjs:20`,
`lab/lib/studio-server.mjs:12`, `lab/lib/voice-preview.mjs:26`,
`lab/lib/partner-reference.mjs:10`, `lab/lib/partner-observer.mjs:18`,
`open-claw/lab/deploy/local-connection.mjs:27` och `:483`.

Granskningen använde selektiva käll-/konfigurationsläsningar och rootfilens
nyckelnamn. Vercel-delen
granskades också av en oberoende underagent. Inga servrar startades, inga
providerjobb gjordes och inga env-värden exporterades. Vid driftjämförelsen
behövs både rätt nyckelplacering och säkra kontroller av aktiv barnprocess,
persistens, modellmetadata och resursåtkomst. Env-matrisen ensam bevisar inte
att en MP4 laddats upp eller att kamera, röst och läppsynk godkänts.

## Uppföljning 1 oktober, 11:15 UTC — privata RunPod-värden

Selektiv omläsning av de aktiva lokala filerna och processmiljön visar ingen
effektiv `RUNPOD_API_KEY`. De befintliga lokala endpointvärdena matchar
Render-produktens endpoint. Tomma äldre alias i `lab/.env.local` är alltså
inte en separat aktiv koppling till Emils podd. Detta uttalar sig inte om
okända eller arkiverade privata filer, och ingen sådan arkivsökning gjordes.

Render-nyckeln gav HTTP 200 på den konfigurerade endpointens `/health`, med
noll pågående eller köade jobb. Leverantörens administrativa REST-listning
gav däremot 401; behörighet till jobb-API bevisar inte administrativ åtkomst.
Dashboarden verifierade Croupier-imagen på SHA `12ce6d47` och
`AVATAR_ID=astrid_spel2x`. Inga nycklar kopierades mellan lokalt och molnet,
och inga hemliga värden sparades i dokumentationen.
