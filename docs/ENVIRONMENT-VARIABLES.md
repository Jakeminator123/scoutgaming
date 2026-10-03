# Miljövariabler per tjänst

Detta är nyckelnamnsförteckningen, inte en hemlighetsfil. Den maskinläsbara
listan finns i [`environment-variables.json`](environment-variables.json).
Ändra båda när en variabel läggs till, tas bort eller byter betydelse.
`node tools/check-environment-variables.mjs` körs i Git-hook och CI och
kontrollerar namn som läses av molnstart, Vercelbygge och GPU-relä.
Den kontrollerar **inte** värden eller leverantörspaneler. Vid ändring direkt
i Render/Vercel/RunPod: jämför endast nyckelnamn med listan och uppdatera
repo-dokumentationen i samma leverans. Lagra aldrig värden här.

Aktuell källa: `Jakeminator123/github-work` på `main`.
Vercels frontend använder `apps/croupier-frontend` med UI-kontraktet nedan.
Aktuell drift och QA: [molnkarta](CLOUD-MIGRATION.md), [handoff](JOHN-HANDOFF.md).

Director/Gateway-konfiguration: se [OpenClaws källindex](../open-claw/lab/docs/README.md).

Backoffice/Lab vidarebefordrar
`CROUPIER_DATA_DIR` till Lab för läsning av samma äldre BO-granskningsdata,
`BO_URL` i molnet för administration och `CROUPIER_GAME_ORIGIN` lokalt.
I dagens ännu oflyttade drift sparas aktiva klippval i `LAB_STUDIO_DATA_DIR`;
Web läser samma projekt via `CROUPIER_PRESENTATION_STUDIO_DIR`. Dessa sökvägar
är inte reservkällor när den nya gemensamma Neon-policyn är aktiverad.
Inga credentials skickas i navigationen.

Gemensam inloggning använder de befintliga game-/CRAIG-kontona och två
behörigheter: admin för spel/Studio/Backoffice, spelare för spel. Native
lösenordshantering går genom samma signerade Render-authority som övrig
administration; `CROUPIER_STUDIO_NATIVE_ADMIN` och Neon-policyn ovan styr
runtimevalet. Ingen ny roll-, lösenords- eller inloggningsvariabel införs.
Kontoroller och lösenord ändras i Backoffice, aldrig genom klientens env.

### Ny plattform: explicit opt-in

Render: `CROUPIER_DATABASE=postgres` kräver `CROUPIER_GAME_DATABASE_URL` till
en separat TLS-skyddad game-databas, färdiginstallerat `product-v1`-schema och
verifierad import. `sqlite` är kompatibilitetsstandard; en game-URL utan
postgres-flagga är fel. Zon-URL får aldrig vara reserv för konton/spel.

Ett isolerat native-QA-prov får använda
`CROUPIER_CLOUD_DATA_ROOT=/var/data/native-studio-qa/<12 hextecken>`.
Containern kräver då postgres och gemensam policyflagga, exakt matchande
`qa_native_<suffix>`-miljö, workspace `croupier` och den separata Neon-
databasen/rollen `croupier_studio_qa_<suffix>`. Skrivbara QA-kataloger skapas
efter att rootprivilegier släppts. Den befintliga diskens övriga data bevaras.

Vercel-spel/BO: `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`,
`CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN` och serverhemligheten
`CROUPIER_VERCEL_INGRESS_SECRET`. `CROUPIER_GAME_URL` bevaras för äldre
flagga-av-kompatibilitet. Inga DB-, Blob- eller talleverantörsnycklar behövs här.

Vercel-Lab UI: `CROUPIER_LAB_REMOTE_UI=1`, samma fyra origins/ingressnyckel,
`CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`
och `BO_URL` till publik origin. Serverrendering läser autentiserad revision
från Render; den får inte falla tillbaka till ett nytt lokalt seed-projekt.

Gemensam sparad policy är aktiverad i den nya isolerade native-QA-miljön;
**produktion är ännu inte omkopplad**:
`CROUPIER_STUDIO_NEON_POLICY=1` på Render och båda Vercel-byggena kräver samma
`CROUPIER_GAME_DATABASE_URL` till befintliga game/auth-Neon, installerat
checksumverifierat product-v1 samt Studio-migrationerna 001, 002, 003 och 004. Samma
`CROUPIER_STUDIO_ENVIRONMENT_ID` och `CROUPIER_STUDIO_WORKSPACE_ID` måste anges
på båda tjänsterna. Projekt och administration läses i en enda transaktion;
projektrevision, administrationsrevision och gemensam spelrevision redovisas.
Saknade sparade dokument, fel schema eller tier-dealer utan exakt registrerad
idle ger fel. Ingen automatisk seed, diskfallback eller dubbelskrivning ingår.
Studio-save använder CAS, historik och audit; osparade utkast blir inte spelpolicy.

Native administration kräver **både** `CROUPIER_STUDIO_NATIVE_ADMIN=1` och
den gemensamma policyflaggan. `CROUPIER_STUDIO_ENVIRONMENT_ID` och
`CROUPIER_STUDIO_WORKSPACE_ID` är explicita serverägda scopes; de läses aldrig
från klienten. De två tekniska UI-origins består bakom samma publika adress.
Flaggan migrerar/initialiserar ingenting och får inte slås på före verifierad
import och kompletterad administration/spelprojektion. Avstängd flagga behåller
dagens BO; fel med påslagen flagga ger felstängning, inte iframe/diskfallback.
Produktionsprojekten har ännu inte bytt källa. Den separata native-QA-miljön
har egen Neon-databas, scope och datarot samt två egna Vercelprojekt; dess
uppgifter får inte användas som produktionskonfiguration. Konto-/partnerhandlers
är inkopplade bakom flaggorna; endast verkligt inkopplade actions annonseras.
Spelarstatus och partner-
launch/credit/revoke går genom signerad Render-kommandogräns med aktuell
Neon-identitet och engångsnonce, aldrig en lokal Vercel-walletmutation.
Den använder befintliga `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`
och `CROUPIER_VERCEL_INGRESS_SECRET`. Verifierad import, auth/HTTPS- och
restartacceptans i drift återstår före aktivering; det isolerade SQL-/HTTPS-/
restartprovet är godkänt. En koddeploy är inte källbytet.
`RESEND_API_KEY` och `CROUPIER_STUDIO_MAIL_FROM` på Vercel-Studio krävs tillsammans
för riktiga invite/resend/reset-mail. Avsändaren är en explicit e-postadress
på en ägd och providerverifierad domän; ingen äldre hårdkodad avsändare används.
Saknad leveransadapter gör dessa actions otillgängliga; befintliga
inloggningar kräver inte en mailnyckel och tokenläckage till UI är inte fallback.
Resend Free och avsändardomänen `scoutgaming.tech` är verifierade och kopplade
till det separata QA-Studio. Ett godkänt invitationsmejl skickades genom den
verkliga Studio-handlaren 2026-10-03; Resend bekräftar `delivered` och mejlet
hittades i mottagarens Gmail-skräppost kl. 17:31 svensk tid. QA-testkontot och
dess tokens städades bort efter provet,
så mejlets länk är nu ogiltig. Ett separat verkligt resetmejl har inte skickats.
Ingen betald plan eller produktionsaktivering har gjorts.
För driftkonfiguration används avsedda Render-/Vercel-värden. Lokala provider-
nycklar kan tillhöra ett annat konto och får inte automatiskt ersätta dem.
Native videoregistret kräver `CROUPIER_MEDIA_STORAGE=blob`,
`CROUPIER_MEDIA_BLOB_INDEX` till samma verifierade aktiva manifest och
serverhemligheten `BLOB_READ_WRITE_TOKEN` på Vercel-Studio. Token är därför
villkorlig i nyckelregistret för det nya läget; den installeras inte genom
kodändringen. Nya reviewposter/klassificeringar läses ur Neon, utan gamla
uploads-/klassificeringsfiler. Aktiva bankklipp och deras exakta ID/hash består.
Tillfällig hashverifierad bytescache är disponibel scratch, inte beständig metadata.

Det separata betalda QA-provet har en avstängd koppling:
`CROUPIER_P6_QA_ROUTER=1` accepteras endast på Render-tjänsten
`srv-datj7l893c1s73ar3u50`, med dess exakta QA-origin, Neon-databas, scope och
datarot. Saknad eller `0` flagga importerar inga privata QA-adaptrar.
`CROUPIER_P6_QA_ROUTER_SOURCE_SHA256`, `CROUPIER_P6_SDK_RUN_ID` och
`CROUPIER_P6_SDK_DEPLOYMENT_ID` binder den granskade, separat installerade
kopplingen till körningen. `CROUPIER_P6_SDK_WORKER_TOKEN`,
`CROUPIER_P6_SDK_READBACK_TOKEN` och `CROUPIER_P6_SDK_TICKET_SECRET` är
separata privata nycklar för worker, läsande processkvitto och engångsbiljetter.
De ger ingen automatisk kostnadsreservation eller rätt att starta ett nytt
försök. Plattformens `RENDER_SERVICE_ID` och `RENDER_GIT_COMMIT` kontrolleras
också. Web får endast de explicita QA-variablerna, inga talleverantörsnycklar;
Lab får inga nya QA-nycklar. Opt-in nekar `NODE_OPTIONS`, `NODE_PATH`,
`LD_PRELOAD`, `NODE_EXTRA_CA_CERTS` och `NODE_TLS_REJECT_UNAUTHORIZED`.
En saknad, ändrad eller osäkert lagrad privat adapter stoppar uppstarten.
Kopplingen är ännu inte installerad eller aktiverad i QA eller produktion.

Det avgränsade funktionstestet använder dessutom `CROUPIER_P6_BOUNDED_TEST=1`,
`CROUPIER_P6_BOUNDED_MANIFEST_SHA256` och `CROUPIER_P6_SDK_OPENAI_API_KEY`.
Dessa får endast nå Web i den ovan namngivna isolerade QA-tjänsten, med
full käll-SHA, befintlig operatör/spelarlänk och ett privat manifest med
högst 30 minuters giltighet. Lab får inga nya QA-nycklar. SDK-nyckeln hör
till den installerade OpenAI-klienten; ordinarie talnycklar fortsätter följa
den explicita befintliga providerkopplingen. Ursprunglig journal och redan
förbrukade reservationer bevaras. Högst två generationer, tre SDK-anrop,
två TTS-anrop, två GPU-submissioner och en worker tillåts utan automatisk
omkörning. Exakta Cartesia-/counting-priser är backlog; faktisk USD-kostnad
är okänd och ingen återbetalning eller nollkostnad antas.

Render-ingress: `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`,
`CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_GAME_ORIGIN` och
`BETTALOTTO_PARTNER_BASE_URL` anger samma exakta publika Vercel-origin.
Idag gäller `CROUPIER_PUBLIC_GAME_PATH=/game`. Vid det samordnade Neon-bytet väljer
policyflaggan i stället `/blackjack` som speladress, `/game` som filtrerad
omdirigering och `/player-login` som spelarentré. Launch/callback använder
samma effektiva adress; nativeflaggan ensam byter ingen speladress.
`CROUPIER_VERCEL_TRANSPORT_ORIGIN` anger
exakt Render-origin och `CROUPIER_VERCEL_INGRESS_SECRET` matchar UI-projekten.
Host/forwarded headers utan privat ingressbevis nekas.

Gemensam privat media: `CROUPIER_MEDIA_BLOB_INDEX` är opt-in med aktiv
Blob-lagring och pekar på `/app/media/blob-index.json` eller exakt härledd
`studio/media-blob-index.json`. Publika assets kräver public-allowlist;
privata bankklipp kräver autentisering och exakt familj, roll, fil-ID, hash,
storlek och Blob-path. Originalpreview har dessutom inventory-allowlist.
Källa/review/staging blir inte allmänt publik genom indexet. Aktivt indexläge
ger 503 vid saknad eller felaktig källa, utan lokal bytesfallback.
Gamla explicita `LAB_VIDEO_ARCHIVE=/app/emil/dealklipp-v1` normaliseras till
`/app/media/dealers/astrid/runtime/presentation`; andra overrides bevaras.

Tillfällig SQLite-export: `CROUPIER_STORAGE_MAINTENANCE=export` och separat
`CROUPIER_STORAGE_EXPORT_SECRET` startar en exporttjänst med noll Web/Lab-
skrivare. Normalt spel ger 503; endast hemlighetsskyddad POST kan hämta backup
inklusive committad WAL. Flaggan får inte kombineras med postgres. Ta bort
båda efter migrering. Aktuellt verifieringsläge står i handoffen.

Native talgranskning använder samma privata Blobindex och exakta registrerade
audio-/video-/text-/indexhashar. Det äldre fristående röstprovet stoppas före
cache-/inställningsläsning och Cartesia-anrop när Neon- eller nativeflaggan är på.
`LAB_STUDIO_DATA_DIR` är bara en kvarvarande lokal legacy-consumer; det ger
inte Vercel en beständig talcache.

Fullfilsvägen med Neon kräver separat explicit `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`
och `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` samt motsvarande redan verifierad
beständig policy. Värdena skickas endast till Web när fullfilsvägen uttryckligen
är vald; streamvägen behåller sin sessionsreservation. De båda vägarna räknas
i samma dygnstak. Belopp accepterar högst sex decimaler och 1–10 000 000
mikro-USD. Migration 004 skapar ingen policy och återbetalar eller nollställer
ingen historisk kostnad. Den gamla streamreservationen bevisar inte rätt
fullfilspris; detta måste bestämmas mot avsedda providerkonton innan liveprov.

Fryst export av äldre Studio-/taljournalfiler på befintlig PostgreSQL-drift:
`CROUPIER_STORAGE_MAINTENANCE=studio-export`, `CROUPIER_DATABASE=postgres`,
`CROUPIER_STUDIO_NEON_POLICY=0` samt `CROUPIER_GENERATED_SPEECH=0`,
`CROUPIER_CLOUD_GENERATED_SPEECH=0` och `CROUPIER_GENERATED_SPEECH_STREAMING=0`
måste anges uttryckligen. En separat `CROUPIER_STORAGE_EXPORT_SECRET` med minst
32 byte krävs. Starten behåller disk-/byggkontroller men ansluter inte till
PostgreSQL eller bootstrappar konton. Inga Web-/Lab-barn startas; exakt GET
`/__cloud/health` bekräftar läget och noll barn, skrivare och provideranrop.
Alla andra anrop ger 503, även den äldre export-API:n med korrekt hemlighet.
Frysta bytes hämtas separat privat via SSH. Hälsokontrollen bevisar inte att
tidigare externa GPU-jobb har dränerats; detta måste verifieras före import.
Kod och isolerade tester är förberedelse, inte genomfört produktionsbyte.

| Tjänst | Krävs | Vid första start | Villkorligt/valfritt | Värdhanterat |
| --- | --- | --- | --- | --- |
| Render: spel + BO + Lab (`/studio`) | `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_LAB_BASE_PATH=/studio` (även Docker-bygget), `CROUPIER_CLOUD_DATA_ROOT`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER` + `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` på tom databas | Se grupper nedan | Render sätter `PORT`, `RENDER_EXTERNAL_URL` |
| Vercel: spel/BO (`apps/croupier-frontend`) | `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_VERCEL_INGRESS_SECRET` | – | `CROUPIER_GAME_URL` är äldre flagga-av-kompatibilitet; UI behöver inga modell-/DB-/Blob-nycklar | – |
| Vercel: Lab UI (`lab`) | `CROUPIER_LAB_REMOTE_UI=1`, samma origins/ingress, `CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `BO_URL` | – | Dagens SSR läser Render; nytt native-läge kräver gemensam `CROUPIER_STUDIO_NEON_POLICY`, explicit scope/game-Neon och alla fyra migrationsversionerna ovan | – |
| Vercel: äldre statisk ingång (`ops/vercel-entry`, inte längre publicerad) | `CROUPIER_GAME_ORIGIN` = Render-tjänstens exakta HTTPS-origin utan snedstreck på slutet | – | Historiskt byggkontrakt | – |
| Render: separat GPU-relä (ännu ej driftsatt) | `WORKER_SECRET`, annat `TICKET_SECRET` (båda minst 32 tecken), `ALLOWED_ORIGINS` = exakta spel-origins | – | – | Render sätter `PORT` |
| Render: OpenClaw Director (separat Blueprint) | `LAB_API_TOKEN` (genereras), `OPENCLAWAPI_KEY` (från privata Gateway) | – | `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens talendpoint och anges privat; `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`, `HOST`, `PORT`, `LAB_DATA_DIR`, `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_DASHBOARD_ENABLED` enligt Blueprint | Produkt-token ska skilja sig från `LAB_API_TOKEN`; Blueprint kopplar Director till Gateway |
| Render: privat OpenClaw Gateway | Separata `OPENCLAWAPI_KEY` och `OPENCLAW_MODEL_API_KEY` | – | `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, lokalt endast `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`; `CROUPIER_SPEECH_VISION` är opt-in | Blueprint anger icke-hemliga standardvärden; två nycklar anges privat |
| RunPod: äldre separat GPU-testworker | Inga egna env-nycklar krävs av imagen | – | `AVATAR_ID` för annan avatar; `NVIDIA_DRIVER_CAPABILITIES`, `NVENC` endast om GPU-konfigurationen kräver det | Endpoint-id, API-nyckel och worker-inställningar hanteras i RunPod och av anropande tjänst |
| Lokal Lab/OpenClaw | Inga globala krav; beror på anslutningssätt | – | Se `open-claw/lab/.env.example` och `lab/.env.example`; nyckelnamnen speglas i JSON-listan | – |

Äldre statisk kompatibilitet: `node build.mjs --frontend-preview` använder samma
`CROUPIER_GAME_ORIGIN` som standardbygget och inför **ingen ny env-nyckel**.
Next-landningens `CROUPIER_GAME_URL` används bara med UI-flaggan av.
Den aktiva UI-vägen använder exakt publik/backend/Lab-origin och privat
ingressnyckel. Huvudprojektets Preview pekar mot produktion; syntetisk QA
kräver `croupier-player-preview-qa` och den isolerade Render-backenden med
egen game-Neon och privata ingressnycklar. QA innehåller separat zon-Neon
och Blob-integration; UI vidarebefordrar lagringsanrop till backend.
Lab-serverns zonlagring läser nu enbart `CROUPIER_ZONES_DATABASE_URL`;
de andra är alternativa leverantörsformat och styr inte zonflödet.
`BLOB_READ_WRITE_TOKEN` finns för Production/Preview/Development och är en
serverhemlighet. Render-tjänsternas Gateway-, Lab- och speech-tokenpar
verifierades samtidigt; de behöver inte kopieras till Vercels startsidor.
Se [live-kvittot](../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

### Sparade talnycklar och första adminkontot

På Render `croupier-v2` finns nu `CARTESIA_API_KEY`, `RUNPOD_API_KEY` och
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=zsudl8tmzcmiv1`. Namn/närvaro är
kontrollerade. Den 29 september aktiverades `CROUPIER_GENERATED_SPEECH=1`,
`CROUPIER_CLOUD_GENERATED_SPEECH=1` och `CROUPIER_GENERATED_SPEECH_STREAMING=1`
genom env-deploy `dep-datnfph7lnhs73e2c670`. Två riktiga strömmar gav första
videobild; följdsvar och visuell läppsynk är ännu inte godkända. Sessionens
reservation är 0,50 USD och dagens konservativa budget 9,94 USD. Se
[talets driftskvitto](JOHN-HANDOFF.md).

Gatewayns nya kod-, Compose- och Blueprint-standard för `OPENCLAW_MODEL_ID`
är `gpt-5.6-terra`. En befintlig `/data/openclaw/openclaw.json` bevaras vid
omstart och kräver ett uttryckligt byte av sparade rollmodeller; ett env-byte
ensamt bevisar inte att Gatewayns primärmodell har ändrats.

Den 1 oktober återlästes både processmiljön och fem sparade rollmodeller som
Terra efter en riktig env-deploy; vanlig Restart service hade behållit den
gamla miljöbilden. Se [driftkvittot](JOHN-HANDOFF.md).

### Adaptiv chatt genom samma OpenClaw

Ny kod har opt-in `OPENCLAW_SPEECH_ROUTING=adaptive` på **Director** och
`OPENCLAW_SPEECH_DEEP_MODEL=gpt-6-sol`. Standard är `fixed`: ingen andra
modell aktiveras av enbart koddeploy eller katalogregistrering. Vid adaptive
kan Astrids vanliga modell begära en enda fördjupning; tekniska fel eller
ogiltiga svar utlöser inte fler modellanrop. Båda anropen går genom samma
verktygslösa OpenClaw-roll. Slutligt svar ger högst en talvideo.

Sätt `OPENCLAW_SPEECH_TIMEOUT_MS=20000` på **både croupier-v2 och Director**
före aktivering. Spelets molnstart skickar den enbart till Web; den är en
sammanlagd chattdeadline, inte en ny 20-sekundersfrist per modell.
`OPENCLAW_TIMEOUT_MS=8000` kan ligga kvar för övriga Director-råd.
Gateway behöver modellen i sin tillåtna katalog men inga routervariabler.
Inga av dessa variabler hör hemma på Vercels startsida eller RunPod.

Den lokala Lab-startaren tillåter samma explicita speech-timeout och
skickar den bara till Web. I denna checkout är privat `lab/.env.local` satt
till `20000`, med effektiv generisk timeout kvar på `8000`; ingen lokal
server har startats. Senare privata speech-/cloud-storage-filer och processenv
har fortfarande högre prioritet. Compose-mallen ändras inte av detta.
Aktivera först efter verifierad modell- och bildåtkomst samt ny kod i båda
berörda tjänsterna. [Flöde och prov](JOHN-HANDOFF.md).

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
  Spelkonton och saldon använder en separat game/auth-Neon-databas.
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
  behåller reserver genom omstart. Se [aktuell handoff](JOHN-HANDOFF.md).
  Ingen av dessa funktioner är
  nödvändig för de registrerade förinspelade klippen.
- Partner: `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET` och
  `BETTALOTTO_PARTNER_PLAYER_ID` är en grupp om partnerkopplingen används.

Sätt inte `DEMO_GUEST_ACCESS=1`, `CROUPIER_GENERATED_SPEECH_PREVIEW=1`
eller `CROUPIER_LISSABON_PROFILES=1` i molndrift; startvalideringen avvisar
dem. Lösenord och token är endast i leverantörens hemlighetslager eller
ignorerad lokal `.env`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

Game/auth använder nu separat Neon med verifierad extern backup och full
återläsningsparitet. Bevara historiska SQLite-filer; efter nya Neon-skrivningar
får en äldre SQLite-kopia aldrig återaktiveras som datakälla. Den nya
Git-kopplade UI-projekten har rätt rot/branch och kanoniska origins/ingress;
kontrollera varje automatisk deploy där. Native Node-funktionerna för
`/speech-stream` och `/lipsync-worker` har 300 respektive 600 sekunders gräns.
Genererat tal genom Render/Cartesia/RunPod har passerat två tidigare liveprov;
kallstart, exakt synk och fysisk mikrofon återstår enligt handoffen.
