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

Ett projekt med tre tjänster (`vercel.json`). Registret delar upp dem som `vercel-frontend-production` (web och speech via `packages/server-transport/configuration.mjs` och `packages/navigation/server/platform-routing.mjs`), `vercel-lab-ui` (studio, med Next-proxyn `apps/studio/proxy.ts`) och `vercel-entry` (spelarbygget). Allt sätts i Production. Läst 2026-10-29 (namn, scope och typ, inga värden; [inventeringen](2026-10-29-ENV-INVENTORY.md)): 51 poster i Production (35 egna och 16 `CROUPIER_NEON_*`), 10 i Preview och 3 i Development. Undantag: `CROUPIER_AI_IMAGE_ENABLED` och `CROUPIER_AI_IMAGE_DAILY_LIMIT` ligger med avsikt i alla tre scopen (Jakobs beslut 2026-10-29), `CROUPIER_DEALER_IMPORT_AI` ligger också i Development och Preview, där den inte gör något, och Preview-scopet har sju handsatta poster till (se [Att ta bort ur Vercel](#att-ta-bort-ur-vercel-production)). Preview-scopet pekar på produktionens adresser men saknar ingresshemligheten och databasadressen och är ingen skrivbar testmiljö; den riktiga previewn är projektet `scoutgaming-preview`.

| Namn | Krav | Tjänst | Syfte |
| --- | --- | --- | --- |
| `CROUPIER_VERCEL_UI` | krävs, `1` | web, studio, speech | Slår på transporten till spelmotorn |
| `CROUPIER_VERCEL_UNIFIED_UI` | krävs, `1` | web, studio | En publik origin för spel och Admin; kräver `CROUPIER_STUDIO_NATIVE_ADMIN=1` |
| `CROUPIER_STUDIO_NATIVE_ADMIN` | krävs, `1`; läses även vid bygget | web, studio | Admin körs på Vercel; spelmotorn behåller spelauktoriteten |
| `CROUPIER_PUBLIC_ORIGIN` | krävs | web, studio, speech | `https://www.scoutgaming.tech`; även länkar i mejl |
| `CROUPIER_BACKEND_ORIGIN` | krävs | web, studio, speech | Spelmotorns exakta origin, `https://croupier-v3.onrender.com` |
| `CROUPIER_VERCEL_INGRESS_SECRET` | krävs, Sensitive | web, studio, speech | Signerar anrop till spelmotorn; samma värde som på Render |
| `CROUPIER_LAB_UI_ORIGIN` | sätts inte; ska bort | web, studio | Läses bara när `CROUPIER_VERCEL_UNIFIED_UI` inte är `1`: då är den Studiozonens egen origin, och `packages/server-transport/configuration.mjs` och `studio-native-runtime.mjs` kräver att den skiljer sig från den publika originen och spelmotorns. I unified-läget ignoreras den överallt, också av assistenten (`/studio/api/assistant` och `/studio/api/public-assistant` via `assistantRequestConfiguration` i `studio-native-request.mjs`), som då bara kräver `CROUPIER_PUBLIC_ORIGIN`; den koden (`3e866f74`) är i produktion sedan deployen av `a05917c3` (`dpl_66mzFEGBVQYE2Ct1hGv1CwQ3qeN3`, 2026-10-29). Värdet i Production är den gamla aliasvärden `croupier-lab-ui.vercel.app`, som fortfarande är en domän i projektet |
| `CROUPIER_LAB_REMOTE_UI` | läses inte; ska bort ur panelen | studio | Den gamla Lab-fjärrvägen. `remote-ui.mjs` är raderad (steg G i admin-förenklingen); ingen källfil läser namnet |
| `CROUPIER_LAB_BASE_PATH` | krävs, `/studio`; byggtid | studio | basePath; `NEXT_PUBLIC_LAB_BASE_PATH` härleds vid bygget |
| `CROUPIER_STREAM_LANE` | sätts inte på Vercel; ska bort | studio | Blir bara `connectedLane` i Admins arbetsyta, som ingen komponent läser, och `app/api/health` körs bara lokalt. Anslutnings-ID:t behövs bara på spelmotorn (Render) |
| `LAB_PUBLIC_URL` | villkorlig | studio | Betrodd proxy-origin för sessionskontrollen; ingen lokal Studio-process |
| `CROUPIER_STUDIO_NEON_POLICY` | krävs, `1` | web, studio | Neon är registret; ingen disk- eller seedreserv |
| `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID` | krävs | studio | Serverägt scope (`production`/`croupier`); samma som på spelmotorn |
| `CROUPIER_GAME_DATABASE_URL` | krävs, Sensitive | studio | Neon `croupier_game` med TLS. `CROUPIER_NEON_*` väljer inte registret |
| `CROUPIER_MEDIA_STORAGE`, `BLOB_READ_WRITE_TOKEN` | krävs (`blob`), Sensitive | studio | Privat Blob för uppladdning och medie-API |
| `RESEND_API_KEY`, `CROUPIER_STUDIO_MAIL_FROM` | villkorlig, par | studio | Inbjudan och lösenordsåterställning för personal och bolag; utan dem skapas kontot men inget mejl skickas |
| `CROUPIER_DEALER_IMPORT_AI` | valfri, `1` | studio | AI-förslag i klippimporten och Admin-assistenten |
| `OPENCLAW_MODEL_API_KEY`, `OPENCLAW_MODEL_API`, `OPENCLAW_MODEL_BASE_URL`, `OPENAI_API_KEY` | villkorlig | studio | Modellen för importen, assistenten och "Skapa bakgrund med AI"; `OPENAI_API_KEY` används bara mot OpenAI när den särskilda nyckeln saknas. En uttryckligt tom nyckel stänger av. AI-bilder kräver Responses-API:t (`OPENCLAW_MODEL_API` osatt eller `openai-responses`) |
| `CROUPIER_AI_IMAGE_ENABLED` | valfri, av; bara `1` slår på. Satt `1` i Production, Preview och Development sedan 2026-10-29 (Jakobs beslut, paneländring) | studio | Slår på "Skapa bakgrund med AI" (`POST /studio/api/layer-assets/generate`, `apps/studio/lib/ai-background-api.mjs`). Nyckeln ensam räcker inte: utan `1` svarar vägen `ai_image_disabled` och dialogen visar "Inte påslaget", utan anrop till OpenAI |
| `CROUPIER_AI_IMAGE_MODEL` | valfri, standard `gpt-6.1-sol` | studio | Modellen som skriver bildprompten ur den fasta ramen och referenserna och anropar Responses-API:ts bildverktyg. Ogiltigt namn stänger av funktionen |
| `CROUPIER_AI_IMAGE_RENDERER` | valfri, standard `gpt-image-2.5-sunburst` | studio | Bildverktygets renderare (OpenAI:s GPT Image-modell), bredvid `CROUPIER_AI_IMAGE_MODEL`. Ogiltigt namn stänger av funktionen |
| `CROUPIER_AI_IMAGE_REASONING` | valfri, standard `xhigh` | studio | Resonemangsnivå för modellen ovan: `low`, `medium`, `high`, `xhigh` eller `max` (OpenAI:s nivåer för gpt-6.1-sol; Jakobs "extra hög" = `xhigh`). Annat värde stänger av funktionen |
| `CROUPIER_AI_IMAGE_DAILY_LIMIT` | valfri, standard `20`. Satt `12` i Production, Preview och Development sedan 2026-10-29 (Jakobs beslut, paneländring) | studio | Högst så många AI-bildförslag per dygn (Stockholmstid), 0–1000; `0` stänger av. Räknas i minnet per Vercel-instans och nollställs vid kallstart, eftersom ingen databastabell finns för den. Det är därför ingen hård gräns: den hårda gränsen sätts som budget i OpenAI-projektet. Varje försök räknas, även misslyckade |
| `OPENCLAW_API_KEY` (alias `OPENCLAWAPI_KEY`) | villkorlig, Sensitive | studio | Admins OpenClaw-flik mot Gateway; samma värde som Gatewayns nyckel, aldrig till webbläsaren |
| `RUNWAY_API_KEY` | valfri | studio | "Skapa material" under Dealers & klipp |
| `CARTESIA_API_KEY` | valfri | studio | Röstprov i Admin |
| `CROUPIER_STUDIO_MOVING_DRIFT_API`, `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` | villkorlig | web, studio | Driftväljaren för rörligt tal, se nedan |
| `CROUPIER_VERCEL_FRONTEND_ORIGIN` | valfri | studio | Betrott proxyursprung för en separat förhandsfrontend; tom i produktionen |
| `CROUPIER_GAME_ORIGIN` | sätts inte på Vercel | web (`vercel-entry`), studio | Behövs bara när `apps/web/tools/player-ui-build.mjs` körs fristående. Vercel-bygget (`prepare-platform-ui.mjs`) tar originen från `CROUPIER_BACKEND_ORIGIN`. Studio läser den bara i den lokala partnerreferensen (`partner-observer.mjs:41`, se nedan) |
| `CROUPIER_DATABASE` | sätts inte på Vercel; ska bort | studio | Läses av `studio-render-persistence.mjs` och `studio-policy-runtime.mjs` på den lokala Render-läsvägen, som inte nås med native Admin. Krävs bara på spelmotorn |
| `CROUPIER_MEDIA_BLOB_INDEX` | sätts inte på Vercel; ska bort | studio | Ignoreras: runtime-vägarna skickar alltid med `runtimeCatalog` från Neon (`registry-reader.mjs`, `media-runtime.mjs`), och `media/blob-index.json` utesluts från bundeln i `apps/studio/next.config.mjs` |
| `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_STREAMING` | sätts inte på Vercel; ska bort | studio | Läses av den delade `generated-speech-runtime.mjs`, men kan aldrig slå på något på Vercel: talet kräver `HOST` `0.0.0.0` (eller `localhost` lokalt) och för molnet en `PUBLIC_URL`, och ingen av dem finns där. Talet körs på Render |
| `BO_URL` | sätts inte | – | Läses inte på Vercel; bara spelmotorn härleder den |
| `CROUPIER_ASTRID_CAMERA`, `CROUPIER_PLAYER_ACCOUNTS` | sätts inte | – | Läses bara av spelmotorn |
| `CROUPIER_NEON_*` (16 namn), `CROUPIER_MEDIA_STORE_ID` | värdhanterad | projektet | Injiceras av Vercels Neon- och Blob-kopplingar; koden läser dem inte (ingen källfil läser heller `DATABASE_URL`, `POSTGRES_URL` eller `PG*`). Alla 16 Neon-poster hör till resursen `store_f0uLTbYiQKqQjLCY`, som är Neon-projektet `croupier-production` `wandering-hill-60561912`, alltså samma databas som `CROUPIER_GAME_DATABASE_URL`; sedan 2026-10-28 bara i Production (Preview avmarkerad i kopplingen). `CROUPIER_MEDIA_STORE_ID` hör till `store_AqwvebTbBHarOjvG` (Production och Preview) |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` | nekas | web, studio | Talleverantörerna bor på Render; Vercel ska inte ha kopior |
| `CROUPIER_ZONES_DATABASE_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | nekas | studio | Hör till spelmotorn respektive Director |
| `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW` | nekas; ska bort | studio | `1` stänger av molntalet respektive slår på den lokala förhandsvisningen (bara med `HOST=localhost`). Avvikelse 2026-10-29: båda är satta till `0` i Production, där de inte gör något |
| `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`, `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD`, `CROUPIER_GENERATED_SPEECH_DIR`, `LAB_STUDIO_DATA_DIR` | nekas | studio | Talbudget och endpoint hör till Render; diskvägarna är pensionerade |
| `NODE_ENV`; `HOST`, `CROUPIER_CLOUD_RUNTIME`, `PUBLIC_URL` | värdhanterad; sätts inte | studio | Läses av den delade talmodulen för att känna igen molnet; Vercel sätter `NODE_ENV` |
| `VERCEL` | värdhanterad | studio | Vercel sätter den. `apps/studio/lib/public-assistant.mjs:55` tar då Scoutguidens hastighetsgräns per `x-vercel-forwarded-for`, annars en gemensam hink |
| `NEXT_PUBLIC_ADMIN_WORKSPACE`, `NEXT_PUBLIC_LAB_BASE_PATH` | sätts inte; byggdefinierade | studio | Ingen panelpost: esbuild skriver in värdena i Admin-SPA:n (`apps/studio/client/build.mjs:55`, `client/surface-bundle.mjs:18`; `1` för admin, annars `0`) och `apps/studio/lib/lab-url.mjs:14` läser dem. Basvägen härleds ur `CROUPIER_LAB_BASE_PATH` |
| `CROUPIER_LAB_INTERNAL_SECRET` | sätts inte | studio | Det gamla molnlabbets gräns i `apps/studio/lib/http-guard.mjs:19,30`: tillsammans med `LAB_PUBLIC_URL` (https-origin) och minst 32 byte släpper den in anrop med rubriken `x-croupier-lab-authorized` till de lokalvaktade vägarna. Båda är osatta på Vercel, så de vägarna svarar 403 där |
| `BETTALOTTO_API`, `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET`, `BETTALOTTO_PARTNER_PLAYER_ID`, `BETTALOTTO_PARTNER_BASE_URL` | sätts inte; bara lokalt | studio | Partnerreferensen `/api/inputs/reference` (`apps/studio/lib/partner-reference.mjs:13-19`, `partner-observer.mjs:3-15,41`; äldre alias `LAB_PARTNER_*`). Vägen är lokalvaktad (`partner-reference.mjs:67`); `BETTALOTTO_API` läses också ur rotens `.env` och `apps/studio/.env.local` |

**Var Studio och `/admin` läser data.** Datakällan väljs bara av `CROUPIER_GAME_DATABASE_URL` (värden måste sluta på `.neon.tech`, annars 503) och scopet `CROUPIER_STUDIO_ENVIRONMENT_ID`/`CROUPIER_STUDIO_WORKSPACE_ID` (`apps/studio/lib/studio-native-runtime.mjs:63-85`); dokumenten och runtimekatalogen läses per scope (`packages/studio-registry/server/repository.mjs:113-121`). Det finns ingen reserv till fil, JSON, SQLite, PGlite eller seed. `CROUPIER_NEON_*` (16 namn) och `CROUPIER_MEDIA_STORE_ID` är integrationsposter som ingen källfil läser. Fyra namn läses i koden men gör ingenting i Vercel-driften (`CROUPIER_STUDIO_NATIVE_ADMIN=1`, `CROUPIER_VERCEL_UNIFIED_UI=1`) och står i [Att ta bort](#att-ta-bort-ur-vercel-production):

- `CROUPIER_STREAM_LANE`: `apps/studio/app/api/admin/workspace/[section]/route.ts:19` (blir bara `connectedLane`) och `app/api/health/route.ts:3` (lokalvaktad).
- `CROUPIER_LAB_UI_ORIGIN`: `apps/studio/lib/studio-native-runtime.mjs:67`, `lib/studio-native-request.mjs:51` och `packages/server-transport/configuration.mjs:17` läser den bara utan unified-läget.
- `CROUPIER_MEDIA_BLOB_INDEX`: `packages/studio-registry/server/media-blob-index.mjs:25`; katalogen från Neon (`runtimeCatalog`, `:17` och `media-runtime.mjs:57`) går alltid före.
- `CROUPIER_DATABASE`: `apps/studio/lib/studio-render-persistence.mjs:39` och `packages/presentation/server/studio-policy-runtime.mjs:15`, den gamla Render-läsvägen.

Speech (`apps/speech`) läser `PORT` och samma transportnycklar som web; den har inga egna namn. Native Node-funktionerna `/speech-stream` och `/lipsync-worker` har 300 respektive 600 sekunders gräns i `vercel.json`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

### Att ta bort ur Vercel Production

Målbild efter läs-only-granskningen 2026-10-29 (main `84a5db4e`), kontrollerad igen mot panelen senare samma dag (main `a05917c3`): alla tolv poster ligger kvar. Ingen av variablerna läses vid bygget, och alla saknas redan i `scoutgaming-preview`, som fungerar. Jakob tar bort dem i panelen eller med `vercel env rm` efter mergen, i denna ordning, och ändringen gäller från nästa deploy:

1. Talflaggorna och gästflaggan, alla `0`: `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_STREAMING`, `CROUPIER_GENERATED_SPEECH_PREVIEW` och `DEMO_GUEST_ACCESS`.
2. De gamla Lab- och Render-vägarna: `CROUPIER_LAB_REMOTE_UI`, `CROUPIER_MEDIA_BLOB_INDEX`, `CROUPIER_DATABASE` och `CROUPIER_STREAM_LANE` (Production och Preview).
3. `CROUPIER_LAB_UI_ORIGIN` (Production och Preview). Villkoret är uppfyllt: koden där assistenten bara kräver `CROUPIER_PUBLIC_ORIGIN` (`3e866f74`) ingår i produktionsdeployen `dpl_66mzFEGBVQYE2Ct1hGv1CwQ3qeN3` (`a05917c3`, READY 2026-10-29 01:14Z). Gör gärna domänen `croupier-lab-ui.vercel.app` till en redirect till www och behåll den, så att ingen annan kan ta namnet.
4. Development- och Preview-scopet för `CROUPIER_DEALER_IMPORT_AI`; Production behålls.

Redan gjort av Jakob (bekräftat i panelen 2026-10-29): `BO_URL`, `CROUPIER_ASTRID_CAMERA` och `CROUPIER_PLAYER_ACCOUNTS` är borta ur projektet, och Neon-kopplingens Preview-scope är avmarkerat, så `CROUPIER_NEON_*` finns bara i Production.

Kontrollera efteråt `/admin`-inloggningen, `/lobby`, `/game` med en spelad hand, att `/studio/api/assistant` svarar 200 och att Admin › System visar AI-agenterna. Granskningens övriga förslag, att koppla bort Neon-integrationen helt (de 16 `CROUPIER_NEON_*`, som koden inte läser) och att ta bort de övriga handsatta Preview-posterna (`CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_BASE_PATH`, `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_MEDIA_STORE_ID`), är separata beslut och ingår inte här.

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
| `CROUPIER_MOVING_SPEECH_ENABLED` | villkorlig | Rörligt tal; kräver dealerprofiler och `CROUPIER_MOVING_SPEECH_BANK_RECORDS`, `_RUNPOD_API_KEY`, `_IMAGE` (GHCR-digest), `_RELEASE_SHA256`, `_TICKET_SECRET`, `_WORKER_ORIGIN` (lika med `RENDER_EXTERNAL_URL`) samt driftväljaren med en profil per bank |
| `CROUPIER_MOVING_SPEECH_BANK_RECORDS` | villkorlig | Bankkartan: ett JSON-objekt med dealer-ID som nyckel och bankens privata manifest som värde, högst 8 dealers och 128 KiB. Varje manifest ligger under `croupier/media/dealers/<samma id>/runtime/moving-bank/`. Läses bara med `CROUPIER_MOVING_SPEECH_ENABLED=1`. Ersätter `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` (T3, 28 oktober 2026); endpointen står i dealerns driftprofil |
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

### Kända felkonfigurationer: måste rättas av Jakob före aktivering

Ingen av dem stoppar spelet i dag, men de gör att inget AI-tal fungerar i produktionen. Ordningen och ersättningsvärdena står i [TALKEDJA-RUNPOD](TALKEDJA-RUNPOD.md#aktivera); inget är ändrat i någon panel.

1. **Stillbildsparet pekar inte på en endpoint** (rapporterat 22–23 oktober, inte omläst): `RUNPOD_API_KEY` är Kevins/Emils RunPod-nyckel och endpointen är `kiud9j0a7fp5gn`, som är Kevins staging-pod, inte en serverless-endpoint; RunPod svarar 404. Kevins nyckel mot vår `zsudl8tmzcmiv1` ger 401. Vilket namn som bär `kiud9j0a7fp5gn` (`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` eller den olästa `CROUPIER_MOVING_SPEECH_ENDPOINT_ID`) kontrolleras i panelen. Rättning: `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` pekar på en endpoint med vår astrid-gpu-worker i samma konto som nyckeln.
2. **Callback mot raderad tjänst:** RunPod-mallen `5dkkc3wolw` för den rörliga endpointen `zjsdlni6cn8dvo` har `MOVING_CALLBACK_ORIGIN=https://croupier-v2.onrender.com`. Den ska vara `https://croupier-v3.onrender.com` innan `CROUPIER_MOVING_SPEECH_ENABLED=1`; workern avvisar jobb med fel callback-värd, så det kan inte läcka till fel motor.
3. **Gamla bankvariabler kvar, ny saknas:** `croupier-v3` har `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID`, som ingen kod läser sedan T3, men saknar `CROUPIER_MOVING_SPEECH_BANK_RECORDS`. Ta bort de gamla; lägg in kartan när rörligt tal ska på.
4. **Rörlig nyckel och endpoint:** att `CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY` hör till samma konto som driftprofilens endpoint är inte verifierat efter flytten från `croupier-v2`.
5. **Dragans profil är rörlig medan rörligt är av:** stillbildsvägen nekar en `motion-video`-profil (`services/game/dealer-speech-runtime.mjs:60`), så Dragan får inget AI-tal förrän rörligt är på eller profilen sparas om som `video-frame`. Det är en Admin-inställning, ingen variabel.

Render-namnen lästes senast 2026-10-28 via REST ([inventeringen](2026-10-29-ENV-INVENTORY.md)); Render MCP visar inga namn, så en ny läsning kräver `RENDER_API_KEY` i `.env.local`.

## Delade Blackjackrum — avgränsad inkoppling

`CROUPIER_SHARED_TABLE_ENABLED=1` slår på delade bord i spelmotorn: Postgres, befintlig Studio-repository och scope, samma appägda pool och demoplånbok. Saknade schema 008/009/010 stoppar starten; starten installerar inget. Ursprung följer `CROUPIER_VERCEL_FRONTEND_ORIGIN` och `CROUPIER_PUBLIC_ORIGIN`/`PUBLIC_URL`; i enkel-origin-layouten godtas den publika originen (PR #442, `cc415cd8`). Rumsvägarna routas i `vercel.json` (`/shared-room/*`) och `platform-routing.mjs` (`/api/shared-room/*`).

**Regel:** produktionens `croupier-v3` kör `=1` sedan O03 (satt 2026-10-28 13:52Z, deploy `dep-dbgvsc5g1s2s73cdoqkg` på `5f5bc88d`), satt med Jakobs separata godkännande efter verifierad readiness; preview kör `=1` sedan 27 oktober 2026. Flaggan ändras aldrig som bieffekt av ett prov. Med flaggan på deployas `croupier-v3` bara när bordet är tomt tills F11 är rättad, och återgången (flaggan `0` och låst deploy) står i [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten). Kontrollera `/__cloud/health` efter varje ändring. `/__cloud/shared-room-health` är inte publikt nåbar (gatewayen svarar 421 utanför Vercel-ingressen, och Vercel routar inte `/__cloud/*`); bordet kontrolleras i stället med en spelad hand och loggarna (`shared_room_runtime_unavailable`).

## Driftväljarens API

<a id="driftvaljarens-api"></a>

Servern registrerar driftväljaren för rörligt tal bara med `CROUPIER_STUDIO_MOVING_DRIFT_API=1` och `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`: en JSON-array med 1–8 profiler, var och en med exakt `id`, `label`, `dealerId`, `endpointId`, `releaseDigest` och `bankHash`. En profil per dealer: `id`, `dealerId` och `endpointId` är unika, så två dealers delar aldrig endpoint. Admin styr en dealer; med fler än en profil är Admins API stängt tills Admin kan välja dealer (T5). Fel eller saknad konfiguration ger stängt API (503) utan att påverka resten av Admin. Flaggan startar ingen provider; `connected:true` kräver en färsk executor i samma databas, annars tillåts bara Av.

För spelmotorn krävs dessutom `CROUPIER_MOVING_SPEECH_ENABLED=1` och exakt en profil för varje dealer i `CROUPIER_MOVING_SPEECH_BANK_RECORDS`, och ingen profil utan bank. Varje profils `releaseDigest` är lika med `CROUPIER_MOVING_SPEECH_RELEASE_SHA256`, `endpointId` är dealerns egen endpoint (`[a-z0-9]{6,64}`) och `bankHash` är bankarkivets SHA-256 (`archive.sha256` i dealerns manifest), som motorn kontrollerar vid start. Samma profil-JSON sätts på Vercel och Render. Driftläget sparas per dealer i miljöns rad (`state.dealers.<dealerId>`), utan ny migrering. Lagret mäter som databasen (`octet_length(state::text)`) och stannar vid 28 KiB för raden och 3 400 byte per dealer, så en full dealer aldrig spärrar en annan; en rad från före T3 ersätts vid första skrivningen och alla dealers börjar i Av. Budgeten är per dealer (`<dealerId>-test-20261017`, Dragans befintliga `dragan-test-20261017` oförändrad); dygnstaket är miljöns och delas. Tabellen `croupier_studio.moving_drift_control` kräver SELECT, INSERT och UPDATE för runtime-rollen `croupier_game` (beviljat i produktionen 19 oktober 2026). Av i Admin är den ordinarie stoppvägen.

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

Directors läsare är `packages/director/configuration.mjs` (`DIRECTOR_ENV_KEYS`). Blueprint deklarerar `OPENCLAW_PRODUCT_SPEECH_TOKEN` och `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY` med `sync: false` och `OPENCLAW_SPEECH_TIMEOUT_MS` med `20000`; de hemliga värdena sätts bara i panelen.

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
| `CROUPIER_SPEECH_VISION` | valfri, sätts i panelen | Bildstöd i talet, opt-in; Blueprint deklarerar den med `sync: false` och värdet sätts i panelen |

## Preview: skillnader mot produktionen

Preview, den tidigare stagingen (se [START-HERE](../START-HERE.md#preview)), använder samma namn som produktionen men egna värden. Den behålls efter O03.

- **Vercel `scoutgaming-preview`** (hette `croupier-k06-k07-staging` till 2026-10-29): 16 poster (läst 2026-10-29, namnen lästa igen efter namnbytet), alla i Production-scope utom Blob-token: egen `CROUPIER_GAME_DATABASE_URL` till `croupier_staging` med approllen `croupier_staging_app` (Sensitive, senast ändrad 2026-10-28 19:46Z; värdet går inte att läsa tillbaka, så att den fortfarande pekar på `croupier_staging` och inte på ett restoremål verifieras i panelen), eget scope (`staging_k06_k07`/`croupier`), egen Blob-token till `store_7E06N1P4w9Mu1dZD`, egen ingresshemlighet och egen publik adress i `CROUPIER_PUBLIC_ORIGIN`, sedan 2026-10-29 previews domän preview.scoutgaming.tech; `CROUPIER_BACKEND_ORIGIN` pekar på Render-tjänstens oförändrade adress. Paneländring 2026-10-28: `OPENAI_API_KEY` (Sensitive), `CROUPIER_AI_IMAGE_ENABLED=1` och `CROUPIER_AI_IMAGE_DAILY_LIMIT=20` sattes direkt i projektet (Production-scope) för AI-bilder; taket är alltså 20 här och 12 i `scoutgaming`. Avvikelse: `BLOB_READ_WRITE_TOKEN` är av typen Encrypted i alla tre scopen, inte Sensitive, och Vercel flaggar den som läsbar hemlighet; gör om den som Sensitive. Projektet saknar `CROUPIER_LAB_UI_ORIGIN`, vilket är rätt från `3e866f74`, där assistenten bara kräver `CROUPIER_PUBLIC_ORIGIN`; en äldre låst SHA ger 503 från assistenten.
- **Render `scoutgaming-preview-engine`** (`srv-dbf61l0m7kps73ft7mk0`, hette `croupier-k06-k07-staging` till 2026-10-29; adressen `croupier-k06-k07-staging.onrender.com` är oförändrad): samma namn som `croupier-v3` med previews adresser och hemligheter, `CROUPIER_SHARED_TABLE_ENABLED=1`, AI- och talflaggor av (ingen egen taluppsättning ännu; namnen och ordningen för att slå på den med Kevins RunPod- och ElevenLabs-konton står i [TALKEDJA-RUNPOD](TALKEDJA-RUNPOD.md#aktivera)) och bootstrap-inloggningen borttagen.
- Agenternas Admin-inloggning till preview ligger under `STAGING_ADMIN_LOGIN_UN` och `STAGING_ADMIN_LOGIN_PW` i gitignorerad `.env.local`. De är inga tjänstevariabler.

## Övriga poster i registret

| Registerpost | Namn | Status |
| --- | --- | --- |
| `github-actions-tooling` | `CROUPIER_GAME_DATABASE_URL` (repository secret), `CROUPIER_MIGRATION_CONFIRM` | CI läser produktionens migreringsledger med `tools/check-migration-readiness.mjs`. `CROUPIER_MIGRATION_CONFIRM=apply-pending` sätts bara i den terminal där Jakob kör `--apply`, aldrig i CI eller Vercel |
| `local-runtime-media-import` | `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`, `CROUPIER_GAME_DATABASE_URL`, `CROUPIER_RUNTIME_IMPORT_CONFIRM` | `ops/neon-studio/runtime-media-import-run.mjs` byter runtime-katalogen ([REN-START](plans/REN-START.md) steg 6–7). Scope krävs alltid; `prepare` läser ingen databas, `plan` läser och `apply` skriver bara när `CROUPIER_RUNTIME_IMPORT_CONFIRM` är den granskade planens `planHash`. Sätts bara i Jakobs terminal, aldrig i CI, Vercel eller Render |
| `render-gpu-relay` | `WORKER_SECRET`, `TICKET_SECRET`, `ALLOWED_ORIGINS`, `PORT` | Separat GPU-relä i `services/astrid-gpu-worker/gateway/server.mjs`; inte driftsatt |
| `runpod-gpu-worker` | `AVATAR_ID`, `NVIDIA_DRIVER_CAPABILITIES`, `NVENC`, `MOVING_CALLBACK_ORIGIN`, `MOVING_BANK_STORE` | GPU-workrarna på RunPod (`services/astrid-gpu-worker`, `services/moving-gpu-worker`); endpoint, nyckel och mallens miljö hanteras i RunPod och läses inte härifrån. `MOVING_CALLBACK_ORIGIN` måste vara spelmotorns exakta origin (`https://croupier-v3.onrender.com`, i preview `https://croupier-k06-k07-staging.onrender.com`, alltså en mall per miljö); mallen pekar enligt [TALKEDJA](plans/TALKEDJA.md) ännu på den raderade `croupier-v2`. Endpoints i Kevins RunPod-konto med våra images: se [TALKEDJA-RUNPOD](TALKEDJA-RUNPOD.md) |
| `local-lab-openclaw` | Mallen `services/openclaw/lab/.env.example` | Lokala verktyg; ingen lokal produktstart läser den. Den inaktuella `apps/studio/.env.example` raderades 2026-10-29. `CROUPIER_ZONES_DATABASE_URL` (Zones-projektet är raderat) och namnen som bara den mallen listade togs samtidigt bort ur posten |
| `local-emil-provider-check` | `EMIL_RUNPOD_API_KEY`, `EMIL_RUNPOD_ENDPOINT_ID`, `EMIL_CARTESIA_API_KEY`, `EMIL_ELEVENLABS_API_KEY`, `EMIL_GEMINI_API_KEY` | `node tools/check-provider-profile.mjs --profile <scoutgaming\|emil> --env-file <fil>` läser bara den valda filen och nekar blandade par. `RUNPOD_ENDPOINT_ID` är inget alias |
| `vercel-zones-qa` | `CROUPIER_ZONES_*` | Historik: projektet `croupier-player-preview-qa` raderades 8 oktober 2026 |

`RENDER_API_KEY` i `.env.local` ger agenter läsning av Render-konfiguration via REST. Den används inte av produktkoden och står därför inte i registret.

## Databasidentiteter bakom adresserna

Produktionens `CROUPIER_GAME_DATABASE_URL` (Vercel, Render, GitHub-secret) ska peka på Neon `croupier-production` `wandering-hill-60561912`, branch `main` `br-flat-fog-b161a6r8`, endpoint `ep-fragrant-meadow-b1qzb0qv`, databas `croupier_game`, roll `croupier_game`. Previews ska peka på `croupier-k06-k07-staging` `red-violet-36066351`, branch `main` `br-plain-voice-b9yu49xi`, endpoint `ep-billowing-surf-b93x7p3c`, databas `croupier_staging`, roll `croupier_staging_app`. Sensitive-värden går inte att läsa tillbaka, så kontrollen är: Vercel-postens ändringsdatum (produktionens är orörd sedan 2026-10-04, före alla backup-grenar), Render `/__cloud/health` och `/__cloud/version`, och Neon-panelens anslutningar per endpoint. Backup- och restoregrenar i produktionen (`backup-before-008-010-20261027`, `backup-ren-start-20261028`, `backup-before-o03-20261028`, `o03-restore-proof`) har egna endpoints och egna värdnamn; ingen tjänst ska ha en adress med dem. Rester som inte är adresser står i [inventeringen](2026-10-29-ENV-INVENTORY.md#neon).

## Databasadresser i tester

Tester med injicerad pool eller schemafunktion använder `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`: adressen saknar inloggning och lösenordet skapas slumpmässigt vid körningen. `test/test-credential-fixtures.mjs` stoppar incheckade Neon-adresser med användare och lösenord i `test/` och `apps/studio/test/`. Lägg inte till scannerundantag för att dölja en sådan fixture.
