# Miljövariabler per tjänst

Detta är den läsbara nyckelnamnsförteckningen. Den maskinläsbara listan finns i
[`environment-variables.json`](environment-variables.json) och används av CI
och systemkartan. Båda är aktiva referenser; ingen av dem laddas som processmiljö.
De innehåller inga hemliga värden. Ignorerade `.env`/`.env.local` och tjänsternas
miljöinställningar är separata och ska inte raderas vid dokumentstädning.
Ändra båda när en variabel läggs till, tas bort eller byter betydelse.
`node tools/check-environment-variables.mjs` körs i Git-hook och CI och
kontrollerar namn som läses av molnstart, Vercelbygge, GPU-relä och
migreringsgrinden.
Den kontrollerar **inte** värden eller leverantörspaneler. Vid ändring direkt
i Render/Vercel/RunPod: jämför endast nyckelnamn med listan och uppdatera
repo-dokumentationen i samma leverans. Lagra aldrig värden här.

Aktuell källa: `Jakeminator123/scoutgaming` på `main`; gamla `github-work`
vidarebefordras av GitHub till samma repo-ID `1380630440`.
Vercelprojektet `scoutgaming` bygger `apps/croupier-frontend` och `lab` som
Services från reporoten. Båda använder samma projektmiljö och `fra1`.
Aktuell drift och QA: [molnkarta](CLOUD-MIGRATION.md), [handoff](JOHN-HANDOFF.md).

Verifierad produktion 4 oktober: gemensam Neon-policy och native Studio är
aktiva. Render kör utan produktdisk och utan `CROUPIER_CLOUD_DATA_ROOT`;
`CROUPIER_MEDIA_BLOB_INDEX=/app/media/blob-index.json` och disponibel OS-temp
ersätter gamla diskvägar. Tre tal-/streamflaggor är ON i produktion, OFF i QA.
QA:s disk, SDK, journaler och reservationer bevaras. Inga nya envnamn införs.

Director/Gateway-konfiguration: se [OpenClaws källindex](../open-claw/lab/docs/README.md).

Studio-flikens modellinställningar använder den inloggade administratörens
vanliga Studio-session. `OPENCLAWAPI_KEY` finns server-only i Vercel-projektet
`scoutgaming`, endast production, och måste motsvara Directors befintliga
Gateway-lösenord. Nyckeln får inte skickas till webbläsaren eller till spelets
frontend. Det vanliga `LAB_API_TOKEN` ger ingen rätt att administrera Gateway.
De avvecklade `LAB_REMOTE_URL`/`LAB_REMOTE_TOKEN` behöver inte återaktiveras.

På `croupier-lab-director` används dessutom
`OPENCLAW_STUDIO_ADMIN_DEVICE_KEY`: en privat Ed25519-nyckel i base64-kodad
PKCS8. Den signerade serveridentiteten paras uttryckligen i befintlig Gateway
med `operator.read` och `operator.admin`. Nyckeln hör inte hemma i Studio,
frontend, QA eller Git. Ingen autentiseringsspärr stängs av. Det avgränsade
API:t tillåter endast modellval för befintliga Croupier-agenter; verktyg,
leverantörshemligheter och nätverksinställningar ändras inte där.

`BO_URL` anger publik origin för auth/handoff och `CROUPIER_GAME_ORIGIN`
används lokalt. Aktiva klippval och administration läses nu från gemensamma
Neon-revisioner. `CROUPIER_DATA_DIR`, `LAB_STUDIO_DATA_DIR`,
`CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`,
`CROUPIER_GENERATED_SPEECH_DIR`, `LAB_VIDEO_ARCHIVE` och lagringsexportens
två variabler är avvecklade i produktion och får inte återinföras som fallback.
Namnregistret behåller namn som fortfarande läses av nekande guards eller
historiska exportkontrakt; listning betyder inte att de ska sättas i produktion.
Inga credentials skickas i navigationen.

Gemensam inloggning använder de befintliga game-/CRAIG-kontona och två
behörigheter: admin för spel/Studio/Backoffice, spelare för spel. Native
lösenordshantering går genom samma signerade Render-authority som övrig
administration; `CROUPIER_STUDIO_NATIVE_ADMIN` och Neon-policyn ovan styr
runtimevalet. Ingen ny roll-, lösenords- eller inloggningsvariabel införs.
Kontoroller och lösenord ändras i Backoffice, aldrig genom klientens env.

### Aktiv molnkonfiguration

Panelgranskning 8 oktober 2026 (Vercel `scoutgaming`, namn jämförda mot denna
förteckning): Jakob har lagt in `LLM_LOGIN_UN` och `LLM_LOGIN_PW` med
Studio-kontot `LLM`:s inloggning. Ingen kod läser dem; de är inte en del av
någon tjänsts konfiguration och ska inte registreras som krav. Rekommendation:
ta bort dem ur Vercel och förvara inloggningen i en lösenordshanterare. Studio-
inloggningen är ett konto i Neon (`/control/administration?tab=accounts`), inte
en miljövariabel. Värden står aldrig här.

Lokala env-filer (konsoliderade 8 oktober 2026). Vercel production är källan
för delade nycklar. Förnya lokalt med `vercel env pull --environment=production
--yes <tempfil>` och slå ihop; systemnycklar `VERCEL_*`, `NX_*`, `TURBO_*` tas
bort. Nycklar som bara finns lokalt (OpenClaw-agent/modell/tal-URL/token,
`LAB_API_TOKEN`, `LAB_PARTNER_*`, `BETTALOTTO_*`, `ELEVENLABS_*`) behålls från
den lokala filen. Placering: rotens `.env.local` och `lab/.env.local` är samma
innehåll; opt-in-filerna `lab/.env.generated-speech.local`,
`lab/.env.cloud-storage.local` och `lab/.env.cloud-activation.local` läses av
`open-claw/lab/deploy/local-connection.mjs` under respektive flagga. Äldre
kopior sparas under `/random/env-backup-*/` (Git-ignorerat). Vid avvikelse
mellan lokal fil och Vercel för samma namn vann Vercel (gällde API-nycklar för
Cartesia, OpenAI, Gemini, RunPod, OpenClaw och `LAB_REMOTE_*`).

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

Diskfri produktion kräver i stället postgres, gemensam Neon-policy, privat Blob,
en explicit TLS-skyddad Neon-URL och frånvaro av gamla diskvariabler.
TLS `require`, `verify-ca` och `verify-full` accepteras; befintlig produktion
behåller `verify-full`. CROOT ska vara **unset**, inte en tom sträng.

Vercel-spel/BO: `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`,
`CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN` och serverhemligheten
`CROUPIER_VERCEL_INGRESS_SECRET`. `CROUPIER_GAME_URL` bevaras för äldre
flagga-av-kompatibilitet. Gemensamt Neon-läge använder dess serverägda
policy-/scope-/lagringskopplingar; inga hemligheter skickas till klientprops.

Aktivt gemensamt Scoutgaming-projekt: rotens `vercel.json` bygger
webb och Studio som Services. `CROUPIER_VERCEL_UNIFIED_UI=1` tillsammans med
`CROUPIER_VERCEL_UI=1` och `CROUPIER_STUDIO_NATIVE_ADMIN=1` använder samma
publika origin för båda; `CROUPIER_LAB_UI_ORIGIN` behövs då inte för routingen.
Render-origin måste fortfarande vara separat och ingressnyckeln stannar på
servern. Studio behåller `/studio` som basePath och sin befintliga Neon/Blob/mail-
konfiguration. De två nya flaggorna är production-scopade i samma projekt,
utan nyckelkopior. Git-autobyggen är återaktiverade; rootDirectory och
ignored-build-kommandot är null, framework är services. Det äldre Studio-
aliaset bevaras även i native-konfigurationens exakta tillåtna origins.
Det domänlösa reservprojektet scoutgaming-legacy-frontend har i stället
ignored-build `exit 0` och automatisk domäntilldelning avstängd.

Vercel-Lab UI: `CROUPIER_LAB_REMOTE_UI=1`, samma fyra origins/ingressnyckel,
`CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`
och `BO_URL` till publik origin. Native serverrendering läser samma autentiserade
Neon-revision som Render; ingen lokal seed- eller diskfallback finns.

Gemensam sparad policy är aktiverad i produktion och i isolerad native-QA:
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
Flaggan migrerar/initialiserar ingenting. Produktionsimport och gemensam
spelprojektion är verifierade; native administration är på i Vercel-Studio.
Render har native-adminflaggan avsiktligt OFF och behåller spelauktoritet och
signerade kommandon, medan Neon-policyn är ON. Avstängd administration ger
ingen gammal BO-/iframefallback. Den separata native-QA-miljön
har egen Neon-databas, scope och datarot samt två egna Vercelprojekt; dess
uppgifter får inte användas som produktionskonfiguration. Konto-/partnerhandlers
är inkopplade bakom flaggorna; endast verkligt inkopplade actions annonseras.
Spelarstatus och partner-
launch/credit/revoke går genom signerad Render-kommandogräns med aktuell
Neon-identitet och engångsnonce, aldrig en lokal Vercel-walletmutation.
Den använder befintliga `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`
och `CROUPIER_VERCEL_INGRESS_SECRET`. Isolerad auth/SQL/HTTPS/restart är
godkänd; faktisk produktionsimport, policy-/aliasbyte och diskfri omstart är
verifierade. Produktionskonton har inte använts för nya syntetiska authprov.
`RESEND_API_KEY` och `CROUPIER_STUDIO_MAIL_FROM` på Vercel-Studio krävs tillsammans
för riktiga invite/resend/reset-mail. Avsändaren är en explicit e-postadress
på en ägd och providerverifierad domän; ingen äldre hårdkodad avsändare används.
Saknad leveransadapter gör dessa actions otillgängliga; befintliga
inloggningar kräver inte en mailnyckel och tokenläckage till UI är inte fallback.
Resend Free och avsändardomänen `scoutgaming.tech` verifierades och kopplades
till det separata QA-Studio den 3 oktober. Ett godkänt invitationsmejl skickades genom den
verkliga Studio-handlaren 2026-10-03; Resend bekräftar `delivered` och mejlet
hittades i mottagarens Gmail-skräppost kl. 17:31 svensk tid. QA-testkontot och
dess tokens städades bort efter provet,
så mejlets länk är nu ogiltig. Ett separat verkligt resetmejl har inte skickats.
Den 6 oktober återlästes en icke-tom domänbegränsad produktionsnyckel och
`CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech` i samma Studio-projekt,
nu scoutgaming. Native invite/reset-adaptern gav Delivered till Resends sandbox.
Den tomma extra Marketplace-installationen är borttagen; fungerande delad
Resend-koppling och QA bevaras. Free-planen är kvar. Ett riktigt produktionskontos
invitation/aktivering/reset och mottagarinkorg är fortsatt oprövade (checklistans F).
För driftkonfiguration används avsedda Render-/Vercel-värden. Lokala provider-
nycklar kan tillhöra ett annat konto och får inte automatiskt ersätta dem.
Native videoregistret kräver `CROUPIER_MEDIA_STORAGE=blob`,
`CROUPIER_MEDIA_BLOB_INDEX` till samma verifierade aktiva manifest och
serverhemligheten `BLOB_READ_WRITE_TOKEN` på Vercel-Studio. Token är därför
villkorlig i nyckelregistret för det nya läget; den installeras inte genom
kodändringen. Nya reviewposter/klassificeringar läses ur Neon, utan gamla
uploads-/klassificeringsfiler. Aktiva bankklipp och deras exakta ID/hash består.
Tillfällig hashverifierad bytescache är disponibel scratch, inte beständig metadata.

### Bevarad QA

Den isolerade native-QA-miljön har egen backend, databas, scope och hostname.
AI/GPU/kamera och native-admin är OFF; Cartesia-/RunPodnycklar finns inte där.
SDK, sourcepins, ursprungliga manifest, journaler och förbrukade reservationer
bevaras. Varken koddeploy eller återstående generationskvot öppnar ett nytt prov.

Namnregistret behåller de källlästa `CROUPIER_P6_QA_ROUTER`-, SDK- och bounded-
variablerna. Den avstängda routern laddar inga privata adaptrar. När en sådan
koppling uttryckligen används kräver koden exakt QA-tjänst/origin/databas/scope,
manifest- och källhashar, avgränsad giltighet och separata worker/readback/ticket-
nycklar. Lab får inga QA-nycklar. Processinjektion via NODE_OPTIONS/NODE_PATH/
LD_PRELOAD eller ändrad TLS-tillit nekas. Ursprungliga tider/poster skrivs inte om.
Fullfils- och streamkostnader går genom samma beständiga budgetskydd.

Aktuell usage, testtak, okänd kostnad och öppen acceptans finns i
[handoffen](JOHN-HANDOFF.md#budget-och-framtida-prov). Äldre installationsdetaljer
finns i [Git före städningen](https://github.com/Jakeminator123/github-work/blob/6b9dad55ced03ee0573e24b472b4dcbba2b97776/docs/ENVIRONMENT-VARIABLES.md).

### Origins och privata medier

Render-ingress: `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`,
`CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_GAME_ORIGIN` och
`BETTALOTTO_PARTNER_BASE_URL` anger samma exakta publika Vercel-origin.
Aktiv gemensam Neon-policy väljer `/blackjack` som speladress, `/game` som filtrerad
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
`LAB_VIDEO_ARCHIVE` är avvecklad i gemensamt Neon-läge; gammal archiveväg
normaliseras inte till en aktiv reservkälla.

`CROUPIER_STORAGE_MAINTENANCE` och `CROUPIER_STORAGE_EXPORT_SECRET` gäller
historiska exportlägen. De ska vara borttagna i migrerad produktion;
återaktivera inte gamla disk-/exportsättare från en äldre konfigurationsbeskrivning.

Native talgranskning använder samma privata Blobindex och exakta registrerade
audio-/video-/text-/indexhashar. Det äldre fristående röstprovet stoppas före
cache-/inställningsläsning och Cartesia-anrop när Neon- eller nativeflaggan är på.
`LAB_STUDIO_DATA_DIR` får inte återinföras i aktiv gemensam Neon-drift.

Fullfilsvägen med Neon kräver separat explicit `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`
och `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` samt motsvarande redan verifierad
beständig policy. Värdena skickas endast till Web när fullfilsvägen uttryckligen
är vald; streamvägen behåller sin sessionsreservation. De båda vägarna räknas
i samma dygnstak. Belopp accepterar högst sex decimaler och 1–10 000 000
mikro-USD. Migration 004 skapar ingen policy och återbetalar eller nollställer
ingen historisk kostnad. Den gamla streamreservationen bevisar inte rätt
fullfilspris. Production/version 1-policy är adopterad inom bevarade tak;
avgränsade funktionstest får använda dokumenterat okänd USD enligt det
uttryckliga acceptansundantaget. Exakta tariffer förblir backlog.

### Tjänsteansvar

Import/ALL0 och produktionsbyte är avslutade. Originalkvitton och återställningsregler
finns i [handoffen](JOHN-HANDOFF.md) och [återställningsguiden](ENVIRONMENT-RESTORATION.md).
Återanvänd inte historiska exportflaggor som normal driftkonfiguration.

| Tjänst | Krävs | Vid första start | Villkorligt/valfritt | Värdhanterat |
| --- | --- | --- | --- | --- |
| Render: spel och aktiva runtime-/kommandofunktioner | `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_LAB_BASE_PATH=/studio` (även Docker-bygget), `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | Bootstrap endast vid uttryckligt separat tomdatabasuppdrag; befintliga produktionskonton bevaras | Aktiv produktion kräver postgres/Neon/Blob och saknar CROOT; monterad QA använder sin exakta isolerade CROOT | Render sätter `PORT`, `RENDER_EXTERNAL_URL` |
| Vercel: spel/Studio-ingång (`apps/croupier-frontend`) | `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_VERCEL_INGRESS_SECRET` | – | Gemensam serverägd Neon-/scope-/lagringspolicy; `CROUPIER_GAME_URL` är äldre flagga-av-kompatibilitet | – |
| Vercel: native Studio (`lab`) | `CROUPIER_LAB_REMOTE_UI=1`, samma origins/ingress, `CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `BO_URL` | – | Gemensam `CROUPIER_STUDIO_NEON_POLICY`, native-adminflagga, explicit scope/game-Neon och Studio 001–005; SSR läser Neon | – |
| Vercel: äldre statisk ingång (`ops/vercel-entry`, inte längre publicerad) | `CROUPIER_GAME_ORIGIN` = Render-tjänstens exakta HTTPS-origin utan snedstreck på slutet | – | Historiskt byggkontrakt | – |
| Render: separat GPU-relä (ännu ej driftsatt) | `WORKER_SECRET`, annat `TICKET_SECRET` (båda minst 32 tecken), `ALLOWED_ORIGINS` = exakta spel-origins | – | – | Render sätter `PORT` |
| Render: OpenClaw Director (separat Blueprint) | `LAB_API_TOKEN` (genereras), `OPENCLAWAPI_KEY` (från privata Gateway) | – | `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens talendpoint och anges privat; `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`, `HOST`, `PORT`, `LAB_DATA_DIR`, `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_DASHBOARD_ENABLED` enligt Blueprint | Produkt-token ska skilja sig från `LAB_API_TOKEN`; Blueprint kopplar Director till Gateway |
| Render: privat OpenClaw Gateway | Separata `OPENCLAWAPI_KEY` och `OPENCLAW_MODEL_API_KEY` | – | `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, lokalt endast `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`; `CROUPIER_SPEECH_VISION` är opt-in | Blueprint anger icke-hemliga standardvärden; två nycklar anges privat |
| RunPod: äldre separat GPU-testworker | Inga egna env-nycklar krävs av imagen | – | `AVATAR_ID` för annan avatar; `NVIDIA_DRIVER_CAPABILITIES`, `NVENC` endast om GPU-konfigurationen kräver det | Endpoint-id, API-nyckel och worker-inställningar hanteras i RunPod och av anropande tjänst |
| Lokal Lab/OpenClaw | Inga globala krav; beror på anslutningssätt | – | Se `open-claw/lab/.env.example` och `lab/.env.example`; nyckelnamnen speglas i JSON-listan | – |
| GitHub Actions: Studio-migreringsgrind | – | – | `CROUPIER_GAME_DATABASE_URL` är repository secret och läses av readiness-kontrollen vid push till main; `CROUPIER_MIGRATION_CONFIRM` är lokal operatörsbekräftelse och sätts aldrig i CI eller Vercel | – |

`tools/check-migration-readiness.mjs` läser `CROUPIER_GAME_DATABASE_URL` som
GitHub-repository secret i `presentation-studio` vid push till `main`. Samma
namn används av en operatör lokalt. `CROUPIER_MIGRATION_CONFIRM` ska vara
exakt `apply-pending` endast i den terminal som kör `--apply`. Sätt den aldrig
i CI eller Vercel.

Huvudprojektets Preview kan peka mot produktion. Syntetiska spel-/kontoprov
kräver den separata native-QA-backenden och dess egen databas/hostname.
De aktuella QA-fronterna heter `croupier-native-qa-abc92154cb15` och
`croupier-native-studio-qa-abc92154cb15`. Den äldre `croupier-player-preview-qa`
är en avvecklingskandidat, inte rekommenderad testentré; delade integrations-
resurser måste kontrolleras före projektradering. Se [driftskartan](CLOUD-MIGRATION.md).

Lab läser bara `CROUPIER_ZONES_DATABASE_URL` för zoner. Generella DATABASE_URL/
POSTGRES_URL är inte reserv för detta. Vercel-konfiguration kopieras inte
automatiskt till Render. Produkt-, Lab- och Gateway-token har olika roller.

### Talnycklar och sparade modeller

På Render `croupier-v2` finns tal-/GPU-konfigurationens `CARTESIA_API_KEY`,
`RUNPOD_API_KEY` och `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Produktens tre
aktiveringsflaggor är ON. Aktuell verifiering och kostnadsgränser finns i
[handoffen](JOHN-HANDOFF.md); gamla deploy-ID:n och gamla budgetbelopp är inte
instruktioner för att ersätta dagens konfiguration. Lokala nycklar kan höra
till annat konto och ersätter inte driftens nycklar automatiskt.

Gatewayns nya kod-, Compose- och Blueprint-standard för `OPENCLAW_MODEL_ID`
är `gpt-5.6-terra`. En befintlig `/data/openclaw/openclaw.json` bevaras vid
omstart och kräver ett uttryckligt byte av sparade rollmodeller; ett env-byte
ensamt bevisar inte att Gatewayns primärmodell har ändrats.

Sparade modeller visas och ändras genom Studios avgränsade OpenClaw-flik.
En miljöändring eller omstart bevisar inte ett lyckat modellbyte; läs tillbaka
Gatewayns verkliga sparade konfiguration.

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
  Lokal standard utan flagga är disk. Migrerad produktion kräver uttrycklig
  Blob-konfiguration; familjeregistret ligger i scoped Neon Studio och
  ersätter produktens gamla `videos/index.json` på Render-disk. Den gamla
  produktdisken är avvecklad och dess externa backup bevaras. QA:s separata
  disk och lokala filprofiler har egna livscykler.
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
- Konto/data: `CROUPIER_PLAYER_ACCOUNTS` styr kontofunktionen. Migrerad
  produktion har separat game/auth-Neon och ingen CROOT/diskfallback.
  Endast isolerad monterad QA får använda den validerade CROOT-katalogen
  och dess exakt härledda datavägar; gamla LAB_VIDEO_ARCHIVE/diskvariabler
  ska inte kopieras till produktion.
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
- Röst och kamera: `CROUPIER_ASTRID_CAMERA=1` kräver
  `CROUPIER_ASTRID_TRANSLATION_KEY` och `CROUPIER_STREAM_LANE=lissabon-stream-lane`.
  Flaggan var OFF efter migrationen och sätts åter till ON i produktion på
  Jakobs beställning 4 oktober; QA förblir OFF. Nyckelns läsande modellkontroll
  gav åter HTTP 200 för `whisper-1` samma dag. Detta bevisar inte en genomförd
  mikrofoninspelning. Rösten översätts av OpenAI; Astrids svar använder fortsatt
  Cartesia. Bilder kräver vald `gpt-6-luna` eller `gpt-5.6-terra`.
  Webbspelaren kräver spelarens val och enhetsbehörighet. Inspelning börjar
  aldrig automatiskt vid sidladdning; manuellt engångsmeddelande finns när
  webbläsaren saknar lokal wake-word-igenkänning. Se aktuell driftavläsning i handoff.
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
