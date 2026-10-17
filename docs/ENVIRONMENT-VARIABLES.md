# Miljövariabler per tjänst

Senaste leveransstatus finns i [CLOUD-MIGRATION.md](CLOUD-MIGRATION.md),
och kvarvarande arbete/ägare i [JOHN-HANDOFF.md](JOHN-HANDOFF.md).
PR182:s kanoniska lokala Gateway-env är levererad; det innebär inte att
alla äldre profilfiler är borttagna eller att ny läppsynk är aktiverad.
Inventeringens daterade antal nedan är inte en ny liveavläsning.

## Läsande jämförelse, 17 oktober 2026

**Uppföljning 18:33 UTC:** faktisk POST `/chat` från www verifierades i
Renders requestlogg på `croupier-v2`. Vercel Production har
`CROUPIER_BACKEND_ORIGIN=https://croupier-v2.onrender.com` och scope
`production/croupier`. Talets separata Vercel-service är transport;
Render äger sessionerna och providerjobben.

Renders spelanslutning använder databas/roll `croupier_game` och zones
använder `neondb`/`neondb_owner` på samma poolade Neon-host
`ep-fragrant-meadow-b1qzb0qv-pooler.c-5.eu-central-1.aws.neon.tech`.
Neons metadata binder den till `croupier-production`, main
`br-flat-fog-b161a6r8`, inte preview-v2. Render har scope
`production/croupier` och produktens taladress är
`https://croupier-lab-director.onrender.com`. Inga länkade env-grupper
visades på tjänstens env-sida. Vercels Sensitive databasvärden lämnas
inte ut av connectorn; dessa hemligheters fullständiga likhet är därför
inte nyverifierad. Vercels Preview-backend pekar också på produktion;
det är inte en isolerad testmiljö.

Rootens och Labs `.env.local` har 52 respektive 47 aktiva tilldelningar,
inga dubblettnamn och samma jämförda RunPod/Astrid/OpenClaw/scope-värden.
`lab/.env.cloud-storage.local` har tre tilldelningar och dess zones-URL
pekar på samma main-host och `neondb`. Filen är en explicit lokal profil,
inte en automatiskt inläst Render-konfiguration. `lab/.env.example`
innehåller enbart kommentarer och kan inte skriva över något värde.

Dockerkontexten utesluter `.env`, `.env.*` och motsvarande filer i
undermappar. Molnstarten använder processmiljö och uttryckliga barnprocess-
allowlists. För lokala OpenClaw-inställningar läser `readSettings` endast
sin fasta nyckellista: senare uttrycklig fil vinner över tidigare fil,
och processmiljön vinner över båda. Dessa lokala filer kan därför skilja
sig från molnet utan att vara molnets aktiva inställningar.

Efter avslutat uppvärmningsprov togs den avvecklade Dragan-endpointens
Render-variabel bort och moving-enabled sparades som 0. Den lokala
Dragan-runtimeprofilens gamla endpoint togs också bort och flaggan sattes
till 0. Nycklar, bank och övriga profiler kopierades inte mellan miljöer.
Felen med gammal endpoint och nyckelbehörighet var verkliga, men den här
kontrollen visar ingen felriktad Neon-anslutning i den faktiska talkedjan.
Se aktuellt prov-/kostnadskvitto i [handoffen](JOHN-HANDOFF.md).

**Stoppuppföljning 19:17 UTC:** även det senare köade provets endpoint
`dgpazl8h3a64uj` och template är borttagna och tom workerlista verifierad.
Draganprofilen är OFF. Render har återläst enabled=0 och ingen moving-endpoint
sparad med Save only; den körande processens cleanup väntar på nästa ordinarie
deploy. Det är sparad konfiguration, inte ett nytt runtimekvitto.
Senaste provet kom förbi reservationen men stoppades av den privata guardens
worker-räkning. Aktuellt budget-/stoppkvitto och nästa steg finns i handoffen.

Nedanstående avläsning 16:09 är historisk och föregår detta prov.

Kontrollen omfattade riktiga lokala profiler, Vercel-projektet/teamet
`scoutgaming`, aktuella Render-tjänsteidentiteter och kodens konsumenter.
Inga miljövärden ändrades. Render-MCP saknar env-GET, men befintlig
RenderCLI-inloggning gav en läsande kontroll via det dokumenterade API:t
17 oktober 16:09 UTC: produkt 61, Director 16 och Gateway 10 direkt satta
variabelnamn. Inga värden sparades eller skrevs ut. Länkade miljögrupper och
samtliga hemlighetsvärden är inte jämförda i denna senare kontroll.
Dragan-testets separata runtime-
endpoint verifierades genom det faktiska jobbets journal och providerstatus.

De tre produktrollerna är aktiva och har olika startkommandon; ingen är
verifierat överflödig. Ingen Astrid-namngiven Render-tjänst finns bland de
åtta tjänsterna i workspacet. Astrids RunPod-endpoint, GHCR-image och
GitHub-workflows är separata resurser. Gamla QA:s underhållsläge och äldre
revision räcker inte som raderingsgrund: dess 1 GiB-disk kräver separat
ägarskaps-/återställningskontroll. `game-engine` hör till Impactwin och är
inte en verifierad dublett av `croupier-v2`.

| Tjänst | Ansvar |
| --- | --- |
| Vercel `scoutgaming` | Webb, Admin och proxy till spelmotorn. Äldre generated-speech-/streaming-/cloud-speech-flaggor är 0. Moving-nycklar ligger inte här. |
| Render `croupier-v2` | Spelmotor samt samordning av chattsvar, röst, RunPod-session, budget och uppspelning. |
| Render `croupier-lab-director` | Produktens taladapter via `OPENCLAW_PRODUCT_SPEECH_URL/TOKEN`, vidare till privat Gateway. |
| Render `croupier-lab-openclaw` | OpenClaw-roller som skapar text och beslut. Producerar inte GPU-video. |
| RunPod | Kör Pythonmotorn för läppsynk med vald avatarbank. |
| GitHub Actions / GHCR | GPU-workflows bygger/publicerar worker-image. De startar inte RunPod-jobb. Databaskontrollen ligger separat i produktens `croupier.yml`. |

Root och Lab har samma generiska `RUNPOD_API_KEY` och Astrid-endpoint
`zsudl8tmzcmiv1`; båda skiljer sig från de explicit namngivna Emil-värdena.
Dragan-runtime har en separat nyckel och separat endpoint. Den senaste
testendpointen är avvecklad enligt handoffen; dess kvarvarande env-referens
är inte en fungerande tjänst. Lokala Cartesia-/ElevenLabs-värden matchar
Emil-profilens värden, vilket inte bevisar kontoägare. Inga dubbla aktiva
tilldelningar hittades i de fyra jämförda profilerna.

Dragan väljer ElevenLabs. Cartesia används fortfarande i Admins talbygge
och röstpreview, och den gemensamma molnkonfigurationens genererade talväg
validerar även Cartesia och det generiska RunPod-paret. Dessa får därför
inte klassas som oanvända bara utifrån Dragan-profilen.

Lokal kommentarstädning är utförd 17 oktober: nio rubrikrader i rootens
`.env.local`, `lab/.env.local` och `lab/.env.cloud-storage.local` rättades.
Alla 52, 47 respektive 3 tilldelningar, deras ordning och innehållet från
första tilldelningen är oförändrade. Exakta original ligger i det privata
`arkiv/2026-10-17/` med ursprungliga sökvägar. `.env.emil` var redan korrekt.
Inga nycklar eller tjänsteinställningar ändrades. Återstående kandidater:

- `CROUPIER_MEDIA_BLOB_INDEX` behövs inte i produktens Neon-runtime. Kontrollera
  uttryckliga importverktyg innan en lokal förekomst tas bort.
- För Vercels `DID_API_KEY`, `ELEVENLABS_VIDEO_KEY` och `GITGUARDIAN_API_TOKEN`
  hittades inga aktiva produktläsare. Klarlägg externa verktygsägare och scope
  före borttagning; detta är kandidater, inte ett raderingsbeslut.
- Behåll providerpar, övriga driftflaggor och plattformens Marketplace-metadata
  tills deras konsumenter har verifierats. Likrikta inte alla tjänsters env.

<a id="aktuell-avgränsning-15-oktober-2026-kväll"></a>

## Runtimekontrakt, 16 oktober 2026

Dragan-vägen använder ett separat, explicit aktiverat block på Render.
`CROUPIER_MOVING_SPEECH_ENABLED=1` kräver Neon/PostgreSQL, privat Blob och
registrerade talprofiler. `BANK_RECORD` är JSON med en validerad privat
manifestreferens (inte själva banken); `ENDPOINT_ID`, `RUNPOD_API_KEY`, `IMAGE`,
`RELEASE_SHA256`, `TICKET_SECRET` och `WORKER_ORIGIN` använder samma prefix
`CROUPIER_MOVING_SPEECH_`. Imagen måste vara vår GHCR-digest; worker-origin
måste exakt motsvara `RENDER_EXTERNAL_URL`. Bara Web får dessa värden.
Lab får inga nya GPU-nycklar. Flagga av lämnar tidigare miljö oförändrad.
Banköverföring/callback går direkt till Render; webbläsarens auth och tal går
via den ordinarie sajten. Ändra inte Astrids befintliga variabler vid aktivering.
Bankens avgränsade Blob-klient begär `Accept-Encoding: identity`; detta bevarar
exakt byteantal och undviker långsam komprimerad kallhämtning. Originalens
lagringsklient och Astrids inställningar ändras inte.

Testets stabila budget-ID är `dragan-test-20261017`: taljournalens tak är
4,80 USD och dess reservation är 1,20 USD per försök inklusive marginal.
Jakob höjde den 17 oktober det sammanlagda RunPod-taket först från 5 till 10 USD och därefter till **15 USD**.
Det ändrar inte automatiskt taljournalens befintliga 4,80 USD-konfiguration. Efter det köade provet är fyra reservationer om 1,20 USD bokförda och noll sessioner öppna; gränsen är nådd och historiken ska bevaras.
Det sammanlagda taket omfattar
även tidigare beredning, endpointförsök och reserver för fördröjd fakturering.
Den separata infrastrukturns kostnadsvakt måste därför använda aktuell
sammanräkning före aktivering. Reservationer återbetalas inte automatiskt;
osäkra providersvar blockerar återförsök. Faktisk fakturering och avveckling
kontrolleras separat; aktuellt kvitto sammanfattas i JOHN-HANDOFF.

Den nya runtimekoden kräver scoped Neon som enda metadataregister, inklusive
`runtime_media_catalogs` och `speech_reply_records` från migration 012.
Privat Blob lagrar mediebytes och kräver `CROUPIER_MEDIA_STORAGE=blob` samt
serverhemligheten `BLOB_READ_WRITE_TOKEN`. Katalogens layout, index,
presentationsmanifest och JSON-original läses ur Neon och valideras mot
revision/hash; lokal disk eller äldre Blob-JSON används inte som reserv.

`CROUPIER_MEDIA_BLOB_INDEX` är inte ett produktkrav och ska inte återinföras
för detta läge. Lokala katalogfiler och äldre indexinställningar hör endast
till uttryckliga authoring-/importverktyg eller isolerade tester. Ingen
envändring eller fysisk radering av bevarade lokala data följer av denna text.
Vanlig `node lab/start.mjs` öppnar publicerad `/lobby`; `--no-open` skriver
adressen utan serverstart eller profilinläsning. Bara `--offline` startar en
temporär fixture utan externa tjänster. `--skip-build` kräver `--offline`;
de tidigare `--cloud-storage`, `--astrid-camera` och `--check` avvisas.

**Migration 012 och katalog-/svarsimport är klara enligt huvudagentens
återläsningskvitto 16 oktober 18:38 UTC. Runtimebyte och driftacceptans väntar;**
produkten kör ännu bridgeversion `3165ab6`. Detta är ett attribuerat kvitto,
inte en ny liveavläsning. Aktuell leveransstatus
finns endast i [CLOUD-MIGRATION](CLOUD-MIGRATION.md) och
[JOHN-HANDOFF](JOHN-HANDOFF.md). Daterade filindex- och startkvitton nedan
bevaras som historik; deras gamla krav ersätts av detta avsnitt.

## Daterad env-inventering, 15 oktober 2026 kväll

[environment-variables.json](environment-variables.json) är det maskinkontrollerade
namn-/tjänstekontraktet. Denna översikt ersätter morgonens upprepade statuslistor.
Inga hemlighetsvärden återges och inga miljövärden i molnet eller Emil-profiler
ändras. Äldre QA:s publika ingång stängdes genom underhållsläge, se nedan.
Det valda arbetsflödet är grön PR → main → test på ordinarie produktionsadress;
[CLOUD-MIGRATION.md](CLOUD-MIGRATION.md) beskriver leveransvägen.

| Profil/miljö | Verifierat antal | Loader, prioritet och bygge/runtime |
| --- | --- | --- |
| Root `.env.local` | 52 namn | Explicit valda hjälpverktyg, bland annat providerprofil. Vanlig `lab/start.mjs` läser **inte** filen. `readProfile` ärver inte processnycklar. |
| `lab/.env.local` | 47 namn | Den tidigare anslutna startens prioritet var root `.env` → Lab local → valfri generated-speech → opt-in cloud-storage → processmiljö. Vanlig `lab/start.mjs` använder inte längre denna profil. Next-byggen och uttryckliga verktyg har sina egna loaderkontrakt. |
| `lab/.env.cloud-storage.local` | 3 namn, oförändrad vid kvittot | Bevarad privat lagringsprofil. Det tidigare `--cloud-storage`-läget är avvecklat; filen aktiverar inte produktlagring via vanlig lokal start. |
| `.env.emil` | 5 EMIL_-namn, oförändrad | Endast explicit profilkontroll; ingen automatisk runtimekoppling. |
| Vercel Production/Preview/Development | 65 poster, 56 unika namn; scope 56/30/5 | Metadata utan dekryptering, inga branchspecifika poster. En post kan ha flera scopes. `vercel.json` anger web, studio och speech. Plattformen tillhandahåller valt scopes processmiljö för bygge/runtime. |
| Render produkt/QA/Director/Gateway | Färsk API-läsning: 53/37/16/10 namn | Jakob's workspace, 15 oktober 20:07 UTC. Inga miljögrupper och inga secret files för dessa fyra tjänster. `ops/cloud/start.mjs`/`config.mjs` validerar processmiljö och vidarebefordrar valda namn; Director/Gateway har egna settings/Blueprint. Konfigurationsläsning är inte ett funktionsprov. |

Next läser med **första träffen** som vinnare: processmiljö →
`.env.$NODE_ENV.local` → `.env.local` → `.env.$NODE_ENV` → `.env`,
från respektive appkatalog. Endast `.env.local` hoppas över i testläge.
Lab-bygget kan läsa sin env-fil även när isolerade barnprocesser filtrerar
bort ett namn; filtrering är därför inte ensam grund för borttagning.

`CROUPIER_LAB_BASE_PATH` och `CROUPIER_STUDIO_NATIVE_ADMIN` läses vid bygge
i `lab/next.config.mjs`. Endast den härledda publika sökvägen
`NEXT_PUBLIC_LAB_BASE_PATH` skickas till klienten. Hemligheter förblir
serverinställningar. Isolerad lokal start blockerar senare privata env-filläsningar.
`readSettings` läser valda filer följt av processmiljö; Studio anger root
`.env` och Lab local. Kanoniska `OPENCLAW_API_KEY` vinner över alias inom
varje källa, även om den är tom; senare källa har fortfarande högre prioritet.
Director-tjänsten, Studio och spelservern väljer varsin filpolicy och datarot.
`packages/director/node/settings-reader.mjs` äger den enda Node-filläsaren. Den gemensamma
allowlisten, aliasnormaliseringen och projektionen finns i
`packages/director/configuration.mjs`, som inte läser filer eller processmiljö.
Tjänstens `LAB_ROOT` och samtliga befintliga datakataloger är oförändrade.

### Render: färsk läsning och driftgränser

Jakob bekräftade workspace `tea-d19jsa63jp1c73ch0sc0`. Tjänsteägare/repo
verifierades före den filtrerade GET-läsningen; bara namn, offentliga flaggor
och jämförelser utan hemlighetsvärden sparades. Ingen env-pull, SSH,
nyckeländring, deployment eller providerstart gjordes.

Läsbild 15 oktober 20:07 UTC (deploymenthistorik, inte senaste main):

| Tjänst | Live vid läsningen | Automatisk deployment |
| --- | --- | --- |
| Produkt `croupier-v2` | `2f02c4cd85bf5b07f424ba01d6605d6c4205530a`, `dep-db8i2irm8hqs738fins0` | main efter godkända kontroller |
| Äldre QA `croupier-vercel-preview-qa` | `ee0608044f7c78b80c4f46023cd67a7b391e17f0`, `dep-db1em4ad0e5s73fcv3f0` | Av |
| Director `croupier-lab-director` | `e57f28ef7df64e3bd81c415c31b37e05f04af2b8`, `dep-db7300rrjlhs739ovtl0` | Av |
| Gateway `croupier-lab-openclaw` | `538e5f1ff4a0eb5d30b4e1daab5ffa1ca2d43688`, `dep-db73t967bikc73a3eneg` | Av |

Produkt och äldre QA svarade då båda HTTP 200/`ok` på sina befintliga
`/__cloud/health`. Det bevisade tillgänglig gateway, inte inloggning,
databasparitet eller godkänd QA-isolering. QA sattes senare 21:40:42 UTC
i underhållsläge och svarar nu 503; produkten svarar fortsatt 200.
Ingen tjänst suspenderades. Aktuell QA-status och genomförande står nedan;
senaste produktions-SHA finns i leveransens PR-kvitto.

Alla fyra är Docker-tjänster. Render erbjuder miljövariabler som byggargument
och runtime-miljö; ett byggargument måste användas uttryckligen i Dockerfile.
Produktens aktuella Dockerfile deklarerar `CROUPIER_LAB_BASE_PATH` som ARG/ENV
före Next-bygget. Providerhemligheterna deklareras inte som ARG där.
Director/Gateway har separata runtime-konfigurationer och fasta Docker-defaults.
Ingen miljögrupp kan överlagra tjänstvärden i det nu lästa workspacet.
API-konfigurationen bevisar inte vilka senare sparade värden som finns i en
äldre körande container. Källa: [Render Docker](https://render.com/docs/docker).

Produktens befintliga genererade tal/streaming, dealerprofiler och Astrid-kamera
är konfigurerade till 1 på Render. QA:s tal/streaming/kamera är konfigurerade
till 0. `CROUPIER_STUDIO_NATIVE_ADMIN=0` på båda Render-tjänsterna är
transportgränsen mot Vercels aktiva Admin, inte en instruktion att likrikta
flaggorna. Befintlig taltransport ska inte beskrivas som helt avstängd:
ny rörlig Kevin/Emil-integration är en separat, ännu ej aktiverad leverans.
Inga jobb eller nya mediegodkännanden ingår i denna kontroll.

Nyckelfritt underlag: `arkiv/2026-10-15/admin-consolidation/env-render-receipt.json`.

### Behåll, flytta eller ta bort per namn

Varje utskrivet namn omfattas av radens beslut. Namnlistan förenar aktuell
lokal/Vercel-inventering med KEVI:s daterade Render-inventering. Server-runtime
är normalfas om inte bygge, verktyg eller metadata anges. Källinventeringen
omfattade 993 riktat valda spårade käll-/konfigurationsfiler; media, beroenden
och privata kataloger skannades inte. Kommentarer och dynamiska prefix är
bedömda separat från aktiva runtime-läsare.

| Namn | Konsument och fas | Beslut |
| --- | --- | --- |
| `BETTALOTTO_API`, `BETTALOTTO_PARTNER_BASE_URL`, `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_PLAYER_ID`, `BETTALOTTO_PARTNER_SECRET` | partner-reference.mjs, partner-observer.mjs, ops/cloud/config.mjs | Behåll kanoniska namn. |
| `BLOB_READ_WRITE_TOKEN`, `CROUPIER_MEDIA_STORAGE`, `CROUPIER_ZONES_DATABASE_URL` | cloud-media-store.mjs, zone-cloud-store.mjs | Driftens Blob-/zoninställningar; vanliga lokala starter kopplar inte in dessa tjänster. |
| `CROUPIER_MEDIA_BLOB_INDEX` | media-blob-index.mjs, uttryckliga verktyg/tester | Äldre filindexinställning; ersatt av scoped Neon-katalog i produktens runtime. |
| `CROUPIER_DATABASE`, `CROUPIER_GAME_DATABASE_URL`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_NEON_POLICY`, `CROUPIER_STUDIO_WORKSPACE_ID` | studio-native-runtime.mjs, ops/cloud/config.mjs; game-URL även CI | Behåll exakta databas-/tjänstgränser. |
| `CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_REMOTE_UI`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_VERCEL_INGRESS_SECRET` | packages/server-transport/configuration.mjs och lab/lib/remote-ui.mjs | Behåll per miljö; kopiera inte ingress till Preview. |
| `CROUPIER_LAB_BASE_PATH`, `CROUPIER_STUDIO_NATIVE_ADMIN`, `CROUPIER_VERCEL_UI`, `CROUPIER_VERCEL_UNIFIED_UI` | Next-konfiguration, middleware och serverrouting; base path/native-admin även bygge | Behåll; ändring kan kräva nytt bygge. |
| `BO_URL`, `CROUPIER_GAME_ORIGIN`, `CROUPIER_PUBLIC_GAME_PATH`, `CROUPIER_VERCEL_TRANSPORT_ORIGIN`, `LAB_PUBLIC_URL`, `PUBLIC_URL` | ops/cloud/config.mjs och proxy; GAME_ORIGIN även player-ui-build.mjs | Behåll aktiva kompatibilitetsnamn. |
| `CROUPIER_LISSABON_PROFILES`, `CROUPIER_PLAYER_ACCOUNTS`, `CROUPIER_STREAM_LANE`, `DEMO_GUEST_ACCESS` | web/server.mjs, ops/cloud/config.mjs | Behåll; isolerad start sätter egna värden. |
| `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_DEALER_SPEECH_PROFILES`, `CROUPIER_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_PREVIEW`, `CROUPIER_GENERATED_SPEECH_STREAMING` | ops/cloud/config.mjs och web/server.mjs | Behåll; förekomst är inte aktivering/acceptans av ny läppsynk. |
| `CROUPIER_ASTRID_CAMERA`, `CROUPIER_ASTRID_TRANSLATION_KEY` | web/server.mjs, ops/cloud/config.mjs, local-connection.mjs | Behåll befintlig Astrid-väg. |
| `CARTESIA_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, `ELEVENLABS_API_KEY`, `RUNPOD_API_KEY` | ops/cloud/config.mjs och explicit providerverktyg; Cartesia även Studio | Behåll kompletta Scoutgaming-par; återinför inte borttagna Vercel-kopior. |
| `EMIL_CARTESIA_API_KEY`, `EMIL_ELEVENLABS_API_KEY`, `EMIL_GEMINI_API_KEY`, `EMIL_RUNPOD_API_KEY`, `EMIL_RUNPOD_ENDPOINT_ID` | Dynamiskt EMIL_-prefix i check-provider-profile.mjs; endast explicit fil/profil | Behåll separat, oförändrat; ingen normal runtimekoppling. |
| `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`, `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD`, `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD`, `CROUPIER_SPEECH_STREAM_TICKET_SECRET`, `CROUPIER_SPEECH_STREAM_WORKER_SECRET` | ops/cloud/config.mjs och speech-konfiguration | Behåll tak och separata hemligheter; inga jobb för inventeringen. |
| `LAB_API_TOKEN`, `LAB_REMOTE_TOKEN`, `LAB_REMOTE_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN`, `OPENCLAW_PRODUCT_SPEECH_URL` | settings.mjs, local-connection.mjs, ops/cloud/config.mjs | Behåll separata adresser/tokenroller. |
| `LAB_DATA_DIR`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_DASHBOARD_ENABLED`, `OPENCLAW_HOSTPORT`, `OPENCLAW_SPEECH_AGENT`, `OPENCLAW_SPEECH_DEEP_MODEL`, `OPENCLAW_SPEECH_ROUTING`, `OPENCLAW_SPEECH_TIMEOUT_MS`, `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY`, `OPENCLAW_TIMEOUT_MS` | Director settings/Blueprint och miljöregistrets tjänstekontrakt | Behåll tjänstprofilen; ingen ny agentaktivering. |
| `CROUPIER_SPEECH_VISION`, `OPENCLAW_API_KEY`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_MODEL_API`, `OPENCLAW_MODEL_API_KEY`, `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_STATE_DIR` | Gateway/settings; modellnyckel/base URL även dealer-import-model.mjs | Behåll skilda Gateway-/modell-/produktroller. |
| `CROUPIER_DEALER_IMPORT_AI`, `OPENAI_API_KEY`, `RUNWAY_API_KEY` | dealer-import-model.mjs och runway-client.mjs; OpenAI även villkorad kamerareserv | Behåll. Ingen generering genom inventeringen. |
| `CROUPIER_STUDIO_MAIL_FROM`, `RESEND_API_KEY` | studio-native-mail.mjs | Behåll; isolerad start stänger av skarpa utskick. |
| `CROUPIER_CLOUD_LAUNCH`, `CROUPIER_CLOUD_LAYOUT`, `HOST`, `NODE_ENV`, `PORT` | ops/cloud/config.mjs, Director/plattform; NODE_ENV även bygge | Behåll. PORT är värdhanterad där plattformen sätter den. |
| `CROUPIER_CLOUD_DATA_ROOT` | Färskt verifierad endast på äldre QA med 1 GiB-disk; ops/cloud/config.mjs | Behåll QA:s återställningsunderlag. Återinför inte i produktion och radera inte den äldre disken. |
| `CROUPIER_PRESENTATION_DIRECTOR_TOKEN`, `CROUPIER_PRESENTATION_DIRECTOR_URL` | ops/cloud/config.mjs | Behåll separat presentationsanslutning. |
| `CROUPIER_QA_LOGIN_PASSWORD`, `CROUPIER_QA_LOGIN_USERNAME` | Privata autentiserade verifieringsverktyg; ingen aktiv produktläsare hittad | Behåll verifieringsunderlag. |
| `DID_API_KEY`, `ELEVENLABS_VIDEO_KEY`, `GITGUARDIAN_API_TOKEN` | Ingen aktiv produktläsare verifierad. DID-träffen är kommentar; ElevenLabs-video har ett negativt vidarebefordringstest. Extern användning oklar | Behåll tills exakt verktygsägare/konsument är klarlagd. |
| `CROUPIER_MEDIA_STORE_ID` | Vercel Marketplace-metadata; ingen aktiv källkonsument hittad | Lokala kopior borttagna; Vercel behålls. |
| `CROUPIER_NEON_DATABASE_URL`, `CROUPIER_NEON_DATABASE_URL_UNPOOLED`, `CROUPIER_NEON_NEON_PROJECT_ID`, `CROUPIER_NEON_PGDATABASE`, `CROUPIER_NEON_PGHOST`, `CROUPIER_NEON_PGHOST_UNPOOLED`, `CROUPIER_NEON_PGPASSWORD`, `CROUPIER_NEON_PGUSER`, `CROUPIER_NEON_POSTGRES_DATABASE`, `CROUPIER_NEON_POSTGRES_HOST`, `CROUPIER_NEON_POSTGRES_PASSWORD`, `CROUPIER_NEON_POSTGRES_PRISMA_URL`, `CROUPIER_NEON_POSTGRES_URL`, `CROUPIER_NEON_POSTGRES_URL_NO_SSL`, `CROUPIER_NEON_POSTGRES_URL_NON_POOLING`, `CROUPIER_NEON_POSTGRES_USER` | Vercel Marketplace-hanterade namn; ingen direkt källkonsument hittad | Behåll molnmetadata; ersätter inte GAME/ZONES-URL. |

Ingen ytterligare flytt är verifierat motiverad: root, Lab, cloud-storage och
Emil har olika läsare och gränser. Samla ansvar och dokumentation här;
slå inte samman profiler genom generell env-pull eller kopiering.

### Genomförd lokal förenkling

Endast `CROUPIER_MEDIA_STORE_ID` togs bort ur root och Lab: 53→52 respektive
48→47 namn. Alla andra parsade värden är exakt oförändrade. Byteverifierade
original finns i huvudcheckoutens privata kanoniska arkiv:
`arkiv/2026-10-15/.env.local` och `arkiv/2026-10-15/lab/.env.local`.
Kopiorna har samma effektiva åtkomstregler med skyddad DACL; originalens
ägare/ACL ändrades inte. Återställ endast efter jämförelse med aktuell fil.

Alla åtta kombinationer av generated speech/kamera/cloud storage gav identisk
loader-/barnprocesskonfiguration före/efter. Settings/providerprofil var också
identiska; Emil-/cloud-storage-filerna behöll sina hashvärden. Jämförelsen
gjorde noll nätanrop och startade noll processer. Därefter passerade 44
befintliga provider-/env-/local-connection-tester utan skip/fel.
Inget nytt bygge, providerjobb eller lokalt serverpar behövdes.

Nyckelfria kvitton finns privat i `arkiv/2026-10-15/admin-consolidation/`:
`env-name-consumers.json`, `env-vercel-names.json`,
`env-local-cleanup-receipt.json` och `env-focused.log`.
Tidigare underlag: `lab/data/platform-private/provider-env-alignment/inventory.json`.

### QA efter användarbeställd återgång

QA-agenten återställde sin utbyggnad på Jakobs separata direkta uppdrag.
Kvittot 15 oktober 13:48 UTC anger 24 återställda kodändringar, borttagen egen
worktree/branch/stash och radering av egen ny databas, två roller och Blobstore.
Egen läsning bekräftar att arbetskopian saknas i registret och på gamla sökvägen,
och att angiven stash saknas. Molnraderingarna är **agentens tillskrivna kvitto**.
Bevara `arkiv/2026-10-15/preview-qa-isolation/rollback-receipt.json`;
återskapa inte de 24 ändringarna som kvarvarande arbete.

Färsk Vercel-metadata/icke-hemliga flaggor visar 30 Preview-namn, kvarvarande
produktionsadresser och saknad `CROUPIER_VERCEL_INGRESS_SECRET` i Preview.
Ingen isolerad Preview-skrivmiljö är verifierad. Kopiera inte
produktionshemligheten dit. Äldre Render-QA/databas är andra resurser än de
raderade. Läsningen 20:07 UTC bekräftade att äldre QA var live utan
underhållsläge; den publika ingången är nu stängd enligt kvittot nedan.
Game-databasen är separat
(`croupier_studio_qa_abc92154cb15` jämfört med `croupier_game`) på samma
databashost; detta är konfigurationsmetadata, ingen läsning av datainnehåll.
Ingresshemlighet och Studio environment-ID skiljer sig från produktion,
men `BLOB_READ_WRITE_TOKEN` har exakt samma konfigurerade värde.
En separat databas är därför inte bevis för medieisolering.

Jakobs beslut att förenkla till ett main-flöde genomfördes 21:40:42 UTC:
endast `srv-datj7l893c1s73ar3u50` i `tea-d19jsa63jp1c73ch0sc0` fick
underhållsläge via `render services update srv-datj7l893c1s73ar3u50 --maintenance-mode --confirm`.
Färsk API-läsning bekräftar `maintenanceMode.enabled=true`, oförändrad
1 GiB-disk `dsk-datj7lg93c1s73ar3us0` på `/var/data` och auto-deploy av.
QA:s `/` och `/__cloud/health` svarar HTTP 503; produktens health och www:s
Lobby svarar 200. Inga env-värden, databaser eller medier ändrades.
Nyckelfritt genomförandekvitto:
`arkiv/2026-10-15/admin-consolidation/qa-maintenance-receipt.json`.

Underhållsläget är återställbart och raderar inga data. Tjänsten körs fortfarande;
det är inte en kostnadsavveckling. Privat nät och SSH är fortsatt tillgängliga
([Render underhållsläge](https://render.com/docs/maintenance-mode)).
En framtida återöppning använder samma tjänst med `--maintenance-mode=false`,
men kräver först ett uttryckligt återöppningsbeslut och verifierade gränser.
Återöppna inte QA eller återkoppla Preview förrän data-/mediegränser är
verifierade. Kopiera inte produktionsnycklar som lösning.

### Tidigare åtgärder och återställning

KEVI:s tidigare kvitto anger tre borttagna `LAB_PARTNER_*`-alias per root-/Lab-fil,
likvärdig konfiguration i åtta profiler och 16 riktade tester. Tidigare lokal
städning av 8 257 återbyggbara filer/cirka 646 MB är separat från Git-spårad kod.
Upprepa inte städpasset. Avsiktligt saknade byggutdata är inte i sig kodregression.

Tidigare `lab/.env.generated-speech.local` och `lab/.env.cloud-activation.local`
är arkiverade under `arkiv/2026-10-14/` med ursprungliga undersökvägar.
Två unika streamhemligheter i cloud-activation-kopian bevaras; ingen aktiv
loader läser filen. Original från profilrättningen finns också under
`arkiv/2026-10-14/` (root local, Emil och Lab local). Sju inaktiva exporter
och original före tidigare justering 15 oktober finns under
`arkiv/2026-10-15/env-alignment/`. Original före rättad ogiltig Lab-rad:
`arkiv/2026-10-15/samordning/env-media-verification/lab.env.local.before-malformed-line`.
Arkivkopior väljs aldrig automatiskt eller skrivs över aktiva filer utan jämförelse.

### Explicit läsande providerkontroll

Kör från rätt checkout och ange den avsedda privata filen:

```powershell
node tools/check-provider-profile.mjs --profile scoutgaming --env-file C:\Users\jakem\Projects\croupier\.env.local
node tools/check-provider-profile.mjs --profile emil --env-file C:\Users\jakem\Projects\croupier\.env.emil
```

Verktyget läser endast vald fil, stoppar dubbletter/blandade/ofullständiga
RunPod-par och gör GET mot fasta adresser utan omdirigering. Scoutgaming kräver
`RUNPOD_API_KEY` + `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`; Emil sitt prefixerade
par. `RUNPOD_ENDPOINT_ID` är inget produktalias. Tidigare GET 200 bevisar
åtkomst, inte godkänd läppsynk. Tillfällig Emil-kopiering till generella namn
är ersatt av profilerna och ska inte återinföras. Ändring i Emils fjärrmiljö
kräver separat uttryckligt godkännande.

`croupier-production` är namnet på befintliga Neon-projektet
`wandering-hill-60561912`, inte en ny databas. Produktion använder
`croupier_game`, zoner `neondb`. Namnbytet dokumenterades i commit
`022fab5ed623a1af5ddb13d2f43b218cea687437`; det visar inte säkert vem
som ändrade i molnet. Tidigare TLS-/read-only-kvitto och GitHub-run 38721888413
verifierade game-databas/roll och migrationsberedskap. GitHub kan inte lämna
tillbaka secretvärdet; kvittot bevisar inte URL-byteidentitet. Vercel-/Neon-
revisionsmatchning och privat MP4-HEAD var läsprov, inte nya spel-/talacceptanser.
Originalkvitton finns i det privata underlaget.

Kevin-paketet med 274 filer har enligt tidigare kvitto 58 exakta Blob-/Neon-
matchningar. Övriga 216 är varken import- eller raderingslista. Kroppsklipp,
repliker och worker-avatarbank har olika roller. Ingen helbranch-import eller
ny mediekatalog ingår i env-förenklingen.

## Databasadresser i tester

Tester med injicerad minnespool eller schemafunktion använder
`test/fixtures/database-url.mjs` för syntetiska PostgreSQL-adresser.
Basadressen saknar användaruppgifter; ett slumpmässigt lösenord skapas bara
vid testkörningen. Hjälparen läser inga miljöhemligheter, ansluter inte och
skriver inte adressen till disk eller logg. Behåll injicerad databas även när
testets värdnamn behöver sluta med `neon.tech` för att pröva valideringen.

`test/test-credential-fixtures.mjs` körs i ordinarie full hook/CI och stoppar
incheckade Neon-adresser med användare/lösenord i `test/` och `lab/test/`.
Rapporten innehåller bara filsökväg, rad och felkod. Skyddet är avgränsat till
återfallet från incident 38176586 och ersätter inte GitGuardian eller skyddar
mot alla typer av falsklarm. Lägg inte till scannerundantag för att gömma en
sådan fixture. Rättad kod stänger inte historiska incidenter automatiskt;
bedöm deras ursprung separat och ändra status endast med rätt mandat.

## Dealerimportens begränsade rådgivare, 13 oktober 2026

Klippassistenten använder en stateless modelladapter i importvyn under
`/admin/clips`. Den gemensamma Adminroboten beskrivs separat nedan.
Den är avstängd tills `CROUPIER_DEALER_IMPORT_AI=1` och de serverägda
`OPENCLAW_MODEL_API_KEY` finns i **Studio-tjänsten**. För officiella
OpenAI-API:t fungerar även sajtens befintliga `OPENAI_API_KEY` om den särskilda
nyckeln inte är angiven. En uttryckligen tom särskild nyckel stänger av
kopplingen; OpenAI-nyckeln skickas aldrig till en anpassad leverantör.
Gatewayns befintliga inställningar innebär inte att Studio har dessa värden.
`OPENCLAW_MODEL_API` stöder `openai-responses` (förval) och `openai-completions`;
`OPENCLAW_MODEL_BASE_URL` är en HTTPS-bas, med `https://api.openai.com/v1` som förval.
Modellrollerna är fasta på servern: kartläggning använder `gpt-6.1-sol` med
`high`, äldre importchatt använder `gpt-5.6-luna` med `medium`. Adaptern
läser inte `OPENCLAW_MODEL_ID`; Gatewayns modellinställning är separat.
Ingen nyckel kopieras, tjänst aktiveras eller leverantör konfigureras av kodleveransen.

Modellen får högst tio filbeskrivningar, avgränsad användarkontext och tillåtna fack.
Vanlig chatt kräver ingen vald dealer. Den får en begränsad projektion av
verklig dealer-/fackkatalog och högst fyra lyckade fråge-/svarspar (3 000 tecken
per meddelande, 12 000 totalt), som opålitlig kontext. Samma historik kan följa
med till kartläggningen. Inga ekonomi-, drift-
eller rumsregister kopplas in genom denna inställning.
Inga bildrutor, mediebytes, verktyg, hemligheter eller skrivbehörigheter följer med.
Begäran anger `store:false`. Kartläggning har högst 12 000 outputtokens och
60 sekunders timeout; chatt har 2 600 och 20 sekunder. Budgeten inkluderar
resonemangstokens. Ofullständiga svar får inte bli placeringsförslag.
Två samtidiga anrop och sex anrop per minut/användare begränsas per serverprocess;
det är inte en gemensam kostnadsgräns mellan instanser. Utan modell eller vid fel
visar kartläggningen uttryckligen filnamnsregler. Chatt visar i stället att AI-svaret
inte är tillgängligt och lämnar placeringar/godkännanden orörda. Sparandet använder befintlig
N1-behörighet och privata Blob-/registerflöden efter separat mänskligt godkännande.

## Gemensam webbchatt och Adminroboten

Samma befintliga Studio-konfiguration ovan aktiverar modelladaptern för
`/studio/api/assistant`. Inga nya miljövariabler införs. Modell-ID:n måste
finnas hos den valda leverantören: Scoutguiden använder `gpt-6-luna`/low;
Adminroboten och OpenClaw-läget använder `gpt-6.1-sol`/high. Ingen tyst
reservmodell används. Modellen kan lämna ett förslag, aldrig köra det.

Publik hjälp får endast statisk produktkunskap. N1 får avgränsade aktuella
inventarier och redigerad Gatewaymetadata. Alla skrivningar behöver signerad
förhandsvisning och separat bekräftelse genom befintliga behörighetskontroller.
Bekräftelsenyckeln härleds med egen domän från Studios befintliga servernyckel;
ingen ny klienthemlighet eller databasroll skapas. Fyra samtidiga och åtta anrop
per minut/aktör begränsas per process, inte globalt mellan Vercelinstanser.
Publik trafik använder Vercels anslutningsheader eller gemensam reservbucket.
Maximalt 2 400/8 000 outputtokens och 20/55 sekunder för publik/intern modell.
`store:false`, verktygsfria modellanrop och samma ursprung krävs.

OpenClaw-läget återanvänder befintlig N1-skyddad Director/Gatewaykoppling.
Gatewayns agentmodeller är separat konfiguration. Åtgärden kan bara välja en
modell som finns i aktuell Gatewaykatalog och kräver bekräftelse. Modellbyte
rensar rollens reservmodeller och kan starta om Gatewayn; förhandsvisningen
visar detta. Ingen Renderadministration eller fri Gatewaykonfiguration öppnas.

## Avslutsrättning 13 oktober 2026: Vercel och Blob-metadata

CLI och anslutna Vercel-verktyg verifierade teamet `scoutgaming`, projektet
`scoutgaming` (`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`) och samma team i den lokala
projektlänken. Det personliga teamet finns också men användes inte för åtgärden.
Enligt Jakobs uttryckliga begäran togs endast `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY`
(`R8EEeym41phJSfgk`, Production + Preview) bort från projektinställningarna.
Posten hade Blob-contentHint och giltigt Ed25519/PEM-format; den är en publik
webhooknyckel, inte en API-nyckel, och läses inte av applikationskoden.

Efterläsning verifierade att posten saknas och att övriga env-posters ID,
namn, typ och scope är oförändrade. `BLOB_READ_WRITE_TOKEN` behölls.
Det privata lagret `croupier-media-private` (`store_AqwvebTbBHarOjvG`) är
fortsatt aktivt med 1 845 objekt. Projektkopplingens ID, projekt, prefix och
Production/Preview-scope är oförändrade; dess env-metadata speglar borttagningen.
Ingen fil, lagringsresurs eller token raderades. En framtida återanslutning av
lagret kan tillföra managed metadata på nytt; den lokala filen styr inte
Vercels projektinställningar eller redan skapade deployments.

`OPENAI_API_KEY` uppdaterades separat i rotens Git-ignorerade `.env.local`.
Övriga lokala rader bevarades. Värdet kopierades inte till molninställningar,
dokumentation eller Git, och ingen leverantörskontroll/debiterbar körning gjordes.
En nyckel som klistrats in i chatten ska ersättas före fortsatt användning.

## Förteckning och tidigare verifieringskvitton

Detta är den läsbara nyckelnamnsförteckningen. Den maskinläsbara listan finns i
[`environment-variables.json`](environment-variables.json) och används av CI.
Guiden och JSON-registret är aktiva referenser; ingen av dem laddas som processmiljö.
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

Slutkontroll 12 oktober 2026, 13:56 UTC: kod `19c44902` har grön
[GitHub-CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/38257724379).
Director `dep-db6eciqd0e5s73aef4f0` och Gateway `dep-db6eciid0e5s73aef360`
är live på denna commit efter omstart med enbart `OPENCLAW_API_KEY`.
Det äldre `OPENCLAWAPI_KEY` saknas på båda; 16 respektive 10 env-poster återstår.
Credentialvärdet och samtliga andra värden är verifierat oförändrade;
backup finns privat under `lab/data/platform-private/env-cleanup-20261012/`.
Director använder nu repo-roten som Docker-kontext med en separat strikt
filallowlist, samma Dockerfile-sökväg och bevarad disk. Gatewayens byggkontext,
disk och sparade konfiguration är bevarade. Hälsa för spel, QA, Director och
Vercel ger 200. Autentiserad admin visar ansluten Gateway, samma konfigurationshash,
fem roller och fyra modeller. Detta är anslutningskontroll, inte nytt
godkännande av genererat tal eller läppsynk.

Webb och spelserver verifierades på `4ea767cf`, som innehåller PAOW-/envfixarna;
den publika `dealer-compositing.mjs` matchar `fe8b6372` bytevis. Dockerfixen
kräver enbart ny Director-image. GitGuardian läst på `19c44902`: noll öppna,
17 tidigare ignorerade incidenter och aktiv övervakning. Platstäckningen är
partiell och historisk skanning är `too_large`; detta är ingen full säkerhetsfriskrivning.

Historiskt driftkvitto 4 oktober, före katalogbytet ovan: gemensam Neon-policy och native Studio var
aktiva. Render körde utan produktdisk och utan `CROUPIER_CLOUD_DATA_ROOT`;
`CROUPIER_MEDIA_BLOB_INDEX=/app/media/blob-index.json` och disponibel OS-temp
ersatte gamla diskvägar. Tre tal-/streamflaggor var ON i produktion, OFF i QA.
QA:s disk, SDK, journaler och reservationer bevaras. Inga nya envnamn införs.

Director/Gateway-konfiguration: se [OpenClaws källindex](AI/openclaw/README.md).

Studio-flikens modellinställningar använder den inloggade administratörens
vanliga Studio-session. `OPENCLAW_API_KEY` är det rättade namnet för Gateway-
hemligheten i Vercel-projektet `scoutgaming`, endast production, och måste motsvara Directors befintliga
Gateway-lösenord. Nyckeln får inte skickas till webbläsaren eller till spelets
frontend. Det vanliga `LAB_API_TOKEN` ger ingen rätt att administrera Gateway.
De avvecklade `LAB_REMOTE_URL`/`LAB_REMOTE_TOKEN` behöver inte återaktiveras.

Studio och det bevarade verktyget för explicit anslutningskontroll accepterar även `OPENCLAWAPI_KEY`
för befintliga tjänster. Inom samma env-källa vinner `OPENCLAW_API_KEY`;
senare filer och processmiljön behåller sin vanliga prioritet. Ett uttryckligen
tomt rättat värde stänger av anslutningen även när det gamla namnet är satt.
Båda namnen töms i isolerade barn som inte ska få Gateway-hemligheten.
Den lokala produktprocessen får nyckelvärdet endast som `OPENCLAW_API_KEY`;
`OPENCLAWAPI_KEY` hålls tomt även vid direkt Gateway-anslutning. Det ändrar
inte kompatibel inläsning eller env-filernas prioritet och kräver ingen ny profil.
Gatewayens startkod har samma prioritet och normaliserar barnprocessen till
det rättade namnet. Render-Blueprint och Compose använder `OPENCLAW_API_KEY`
för både Director och Gateway. Det äldre namnet är endast kompatibilitet.

Env-granskning 12 oktober: 59 Vercel-poster motsvarar 51 unika namn.
Alla 18 namn utan referens i produktkällorna hör till de registrerade Neon-/
Blob-kopplingarna. De handsatta namnen har källreferenser; det bevisar inte att
varje villkorligt flöde är aktivt. Hemliga molnvärden är maskerade i pluginen
och har inte likhetsverifierats mot lokala filer. Rootens två OpenClaw-namn
och labbets äldre namn innehöll lokalt samma värde. Preview saknar avsiktligt
produktionskonton, native Studio och leverantörsnycklar; dessa ska inte kopieras
dit som del av namnbytet.
Rättningen har verifierats med 56 riktade env-/Studio-/isolationsprov. De två
aktiva lokala `.env.local`-filerna använder nu det rättade namnet och har samma
Gateway-värde. Kodstödet är levererat i `36c8ef59` med full regression:
2 895 godkända prov, 11 villkorliga undantag och 0 fel. Vercel-versionen
`dpl_5JueKQrBNhtvdVN2w4LaeNAALKbs` blev READY före env-bytet.
Vercel tillåter inte namnbyte på Sensitive-poster. Det rättade namnet skapades
därför som en Production-hemlighet från den lokala filen via CLI-stdin, efter
ett läsande 200-svar från Directors admin-API med samma Gateway-nyckel.
Den äldre Vercel-posten togs därefter bort. Efterläsning visar 59 poster,
51 unika namn och inga ändringar av övriga posters namn, typ eller scope.
Vid den tidigare env-granskningen rättades rotens lokala
`CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` mot Vercels publika post; labbets kopia
matchade då redan posten. Vercel-posten togs senare bort enligt nedan.
`LAB_PARTNER_*` används genom en dynamisk kompatibilitetsmappning i
`lab/lib/partner-observer.mjs`; en sökning efter fullständiga namn missar detta.
`GEMINI_API_KEY` saknar referenser i mains källkod och ingår inte i den isolerade
startarens allowlist. Den har tagits bort från båda aktiva lokala env-filerna,
tillsammans med tomma äldre `RUNPOD_ENDPOINT_ID` och plattformsägda `VERCEL`.
Övriga lokala värden är oförändrade. Borttagna värden har en privat,
Git-ignorerad backup under `lab/data/platform-private/env-cleanup-20261012/`.
Den aktiva `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` och dynamiska partneralias
behålls. Rendergranskningen omfattar endast Croupiers fyra tjänster i Jakobs
workspace; andra projekt och de registrerade Vercel-integrationerna bevaras.

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

Panelgranskning 12 oktober 2026 (Vercel `scoutgaming`, namn och typer jämförda
mot denna förteckning; inga värden lästes eller kopierades). Borttaget efter
Jakobs beslut: `LLM_LOGIN_UN` och `LLM_LOGIN_PW` (sensitive, alla tre miljöer)
samt sex tomma plain-rader i Production som ingen Vercel-tjänst skiljer från
saknade värden: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `LAB_REMOTE_URL`,
`LAB_REMOTE_TOKEN`, `CROUPIER_PRESENTATION_DIRECTOR_TOKEN` och `NODE_OPTIONS`.
Kvar med avsikt: tomma `CARTESIA_API_KEY` och `RUNPOD_API_KEY` (blockerade för
`vercel-lab-ui`; `lab/lib/voice-preview.mjs` skiljer tomt från saknat),
`CROUPIER_MEDIA_STORE_ID` (managed, hör till Blob-kopplingen; läses inte av
koden). Den då kvarvarande `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` togs bort
13 oktober enligt nedan. Även `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW`
och `CROUPIER_LISSABON_PROFILES` = `0` i Production (läses av talvägen;
Render-motorn vägrar starta om någon är `1`, `ops/cloud/config.mjs`). Inga
formatfel (radbrytningar, citattecken, blanksteg) hittades i läsbara variabler.
Sensitive-värdens form går inte att läsa tillbaka och är okontrollerad.

**Historik: env-konsolideringen 8 oktober 2026.** Då hämtades Vercel
production till en temporär fil och delade värden slogs ihop med lokala
verktygsnycklar. Root/Lab fick gemensamma värden; Vercel gavs företräde vid
konflikt. Äldre backupplatser benämndes `/random/env-backup-*/`.
Detta beskriver den tidigare åtgärden, inte dagens uppdateringsrutin.

**Gällande rutin, förtydligad 16 oktober:** använd
[den aktuella loader- och profilkartan](#aktuell-avgränsning-15-oktober-2026-kväll)
och besluten per namn ovan. Root `.env.local`, Lab, cloud-storage och Emil
har olika konsumenter och får inte slås ihop genom generell env-pull.
`LAB_PARTNER_*` har ersatts i de aktiva profilerna av kanoniska namn och ska
inte återinföras från äldre kopior. Kompatibel inläsning finns ännu kvar i
`partner-observer.mjs`. Vanlig produktstart läser inga privata profilfiler;
äldre generated-speech-/cloud-storage-prioritet gäller endast verktyg som
uttryckligen använder den loadern, inte `lab/start.mjs`.
Återställningskopior hör till rotens kanoniska `arkiv/<datum>/<ursprunglig-sökväg>`
enligt [AGENTS.md](../AGENTS.md), och väljs aldrig automatiskt som env-källa.
Äldre kopiors existens, innehåll eller flytt verifieras inte genom denna
dokumenträttning; aktuell återställning kräver jämförelse mot avsedd profil.

**Verifiering 11 oktober 2026:** Kopplingarna i huvudkopian och arbetskopian 74b4 pekar nu på team `scoutgaming`, `team_Scxorb9qtZHjNae1YEQnFCaT`, och projekt `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`. Root/Lab har identiska lokala env-filer med 56 namn, med privata backuper av tidigare filer och länkar. Vercel production-pull returnerade 59 namn men bara 29 icke-tomma värden; de andra 30 kan inte användas som bevis på hemlighetsparitet. Tomt molnsvar ersatte inte sju befintliga lokala värden. Andra otillgängliga värden lämnades osatta, och systemnycklar samt oanvända LLM_LOGIN_* togs inte med i de aktiva filerna. De privata snapshotsen för alla tre miljöerna och jämförelsekvittot finns under lab/data/platform-private/cloud-sync-audit; de ska inte läggas i Git. Lokal utveckling fortsätter via den isolerade startaren, vars barn saknar produktions-game-URL och postgresläge. Full produktions-env lokalt och fungerande modell-/medieanrop är inte verifierade. Vercel-pluginens gamla scope ger 403 i scoutgaming; CLI har verifierad åtkomst. Neon-ägaren är nu liveverifierat "Vercel: scoutgaming", `org-green-butterfly-00780270`; organisationen i stycket nedan är den historiska uppgiften före flytten.

Var databaserna bor (bekräftat 8 oktober 2026 via Neon MCP): ett enda Neon-projekt,
**`croupier-production`** (omdöpt 8 oktober 17:15 från `croupier-astrid-background-zones-db`;
id `wandering-hill-60561912`, gren `main`, Neon-organisationen "Vercel: jakeminator123's
projects", dvs. Vercel-styrd), innehåller flera databaser:
`croupier_game` (schemana `croupier_game`, `croupier_auth`, `croupier_studio` – spelet,
konton och Studio-policy; det är den `CROUPIER_GAME_DATABASE_URL` pekar på från både
Render och Vercel), `croupier_game_qa`, `croupier_game_restore_check`,
`croupier_studio_qa_abc92154cb15` och `neondb` (zonerna, `CROUPIER_ZONES_DATABASE_URL`).
Resursen och Blob-lagret `croupier-media-private` (787 MB, region arn1) flyttades
8 oktober 17:25 på Jakobs beslut från det personliga teamet `jakeminator123s-projects`
till teamet `scoutgaming` (Vercel "Transfer Database" respektive "Transfer Store") och
kopplades till produktionsprojektet `scoutgaming` (Production + Preview, Sensitive, ingen
automatisk Neon-gren per deploy). Kopplingarna fick egna prefix så att de handsatta
nycklarna inte rörs: Neon injicerar 16 namn `CROUPIER_NEON_*` och Blob injicerar
`CROUPIER_MEDIA_STORE_ID` + `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` (read-write-token-rutan
lämnades av). Koden läser ingen av dem; `CROUPIER_GAME_DATABASE_URL` och
`BLOB_READ_WRITE_TOKEN` är fortsatt de auktoritativa värdena och verifierades oförändrade
(namnjämförelse 44 → 59 namn, bara tillägg; `/api/operators/sg-test` svarade före, under
och efter). Render berördes inte (egen kopia av `CROUPIER_GAME_DATABASE_URL`).
Bieffekt: QA-projektet `croupier-player-preview-qa` förlorade sin Neon-koppling och därmed
`CROUPIER_ZONES_*` i Preview/Development; produktionen har aldrig haft dem. Projektet
raderades 18:40 samma dag (legacy, inga egna domäner).
Migration `006-player-profile.sql` kördes där 8 oktober 16:48 (två nya nullbara kolumner,
4 spelare oförändrade).

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
webb, Studio och taltransport som Services. Talservicen i
`apps/croupier-speech` delar befintlig origin-/ingresskonfiguration genom
`packages/server-transport/configuration.mjs`; inga nya nycklar behövs.
Gemensam serverrouting för frontend, Studio och Render-ingress ägs av
`packages/navigation/server/platform-routing.mjs`, med relativa källimporter till
rena navigationskontrakt och samma transportkonfiguration. Modulflytten ändrar
inga miljönycklar, origins, ingressvalidering eller behörigheter.
`CROUPIER_VERCEL_UNIFIED_UI=1` tillsammans med
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
för riktiga invite/resend/reset-mail. Sedan 8 oktober 2026 gäller samma två nycklar
och `CROUPIER_PUBLIC_ORIGIN` även inbjudan av operatörspersonal (partner-API:t `team`
`invite` och admin-åtgärden `operator-membership` med e-post): länken byggs mot den
publika originen till `/partner/set-password`; utan mejlnycklar skapas kontot men inget
mejl går, och svaret avslöjar inte det. Inga nya variabelnamn. Avsändaren är en explicit e-postadress
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
Native videoregistret kräver `CROUPIER_MEDIA_STORAGE=blob`, scoped Neon-katalog
och serverhemligheten `BLOB_READ_WRITE_TOKEN` på Vercel-Studio. Token är därför
villkorlig i nyckelregistret för det nya läget; den installeras inte genom
kodändringen. Nya reviewposter/klassificeringar läses ur Neon, utan gamla
uploads-/klassificeringsfiler. Aktiva bankklipp och deras exakta ID/hash består.
Tillfällig hashverifierad bytescache är disponibel scratch, inte beständig metadata.

### Äldre QA-kontrakt — inte aktuellt driftkvitto

Aktuell återgång och öppna driftkontroller står överst i dokumentet.
Följande beskriver det tidigare kontraktet, inte bevis för att miljön är stängd.

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
[handoffen](JOHN-HANDOFF.md#2-öppna-kontroller-och-kända-fel). Äldre installationsdetaljer
finns i [Git före städningen](https://github.com/Jakeminator123/github-work/blob/6b9dad55ced03ee0573e24b472b4dcbba2b97776/docs/ENVIRONMENT-VARIABLES.md).

### Origins och privata medier

Källinventeringen omfattar de aktiva `lab/lib/cloud-media-store.mjs` och
`lab/lib/video-registry.mjs` för både Render och Studio samt Studios
`lab/lib/legacy-clip-inventory.mjs`. De har inte flyttats eller tagits bort.
Studio läser även `LAB_PUBLIC_URL` som betrodd proxy-origin.
`CROUPIER_DATA_DIR` förekommer i äldre lokala verktyg men är ingen
inventeringsreserv i gemensam Neon-drift. Detta kräver ingen
ny tjänsteinställning eller ändring av hemliga värden.

Render-ingress: `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`,
`CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_GAME_ORIGIN` och
`BETTALOTTO_PARTNER_BASE_URL` anger samma exakta publika Vercel-origin.
Aktiv gemensam Neon-policy väljer `/blackjack` som speladress, `/game` som filtrerad
omdirigering och `/player-login` som spelarentré. Launch/callback använder
samma effektiva adress; nativeflaggan ensam byter ingen speladress.
`CROUPIER_VERCEL_TRANSPORT_ORIGIN` anger
exakt Render-origin och `CROUPIER_VERCEL_INGRESS_SECRET` matchar UI-projekten.
Host/forwarded headers utan privat ingressbevis nekas.

Gemensam privat media: layout och Blob-index kommer från samma scoped,
revisionsverifierade Neon-katalog. Publika assets kräver public-allowlist;
privata bankklipp kräver autentisering och exakt familj, roll, fil-ID, hash,
storlek och Blob-path. Originalpreview har dessutom inventory-allowlist.
Källa/review/staging blir inte allmänt publik genom indexet. Saknad eller
felaktig katalog/källa ger 503, utan lokal metadata- eller bytesfallback.
`LAB_VIDEO_ARCHIVE` är avvecklad i gemensamt Neon-läge; gammal archiveväg
normaliseras inte till en aktiv reservkälla.

`CROUPIER_STORAGE_MAINTENANCE` och `CROUPIER_STORAGE_EXPORT_SECRET` gäller
historiska exportlägen. De ska vara borttagna i migrerad produktion;
återaktivera inte gamla disk-/exportsättare från en äldre konfigurationsbeskrivning.

Native talgranskning använder samma Neon-katalog och exakta registrerade
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
| Render: spel och aktiva runtime-/kommandofunktioner | `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_LAB_BASE_PATH=/studio` (även Docker-bygget), `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | Bootstrap endast vid uttryckligt separat tomdatabasuppdrag; befintliga produktionskonton bevaras | Aktiv produktion kräver postgres/Neon/Blob och saknar CROOT; monterad QA använder sin exakta isolerade CROOT | Render sätter `PORT`, `RENDER_EXTERNAL_URL` och `RENDER_GIT_COMMIT`; den sista används enbart som sanerat runtime-SHA-kvitto i /__cloud/version, utan manuell Git-fallback |
| Vercel: spel/Studio-ingång (`apps/croupier-frontend`) | `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_VERCEL_INGRESS_SECRET` | – | Gemensam serverägd Neon-/scope-/lagringspolicy; `CROUPIER_GAME_URL` är äldre flagga-av-kompatibilitet | – |
| Vercel: native Studio (`lab`) | `CROUPIER_LAB_REMOTE_UI=1`, samma origins/ingress, `CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `BO_URL` | – | Gemensam `CROUPIER_STUDIO_NEON_POLICY`, native-adminflagga, explicit scope/game-Neon och Studio 001–005; SSR läser Neon. `RUNWAY_API_KEY` (valfri, server-only) aktiverar **Dealers & klipp → Skapa material** på `/control/clips?view=generate` med vald dealer; utan den visas facken men inga Runway-jobb kan startas. Nyckeln läses av `lab/lib/runway-client.mjs`, skickas bara till `https://api.dev.runwayml.com` och aldrig till Blob eller nedladdningsadresser. Forge kräver dessutom den deploy-valfria Studio-migrationen 008 (`forge_dealers`, `forge_jobs`). | – |
| Frontendens spelarbygge (`apps/croupier-frontend/tools/player-ui-build.mjs`, tjänst `vercel-entry`) | `CROUPIER_GAME_ORIGIN` = spelserverns exakta HTTPS-origin utan snedstreck på slutet | – | Krävs när bygget anropas utan explicit origin | – |
| Render: separat GPU-relä (ännu ej driftsatt) | `WORKER_SECRET`, annat `TICKET_SECRET` (båda minst 32 tecken), `ALLOWED_ORIGINS` = exakta spel-origins | – | – | Render sätter `PORT` |
| Render: OpenClaw Director (separat Blueprint) | `LAB_API_TOKEN` (genereras), `OPENCLAW_API_KEY` (från privata Gateway) | – | `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens talendpoint och anges privat; `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`, `HOST`, `PORT`, `LAB_DATA_DIR`, `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_DASHBOARD_ENABLED` enligt Blueprint | Produkt-token ska skilja sig från `LAB_API_TOKEN`; Blueprint kopplar Director till Gateway |
| Render: privat OpenClaw Gateway | Separata `OPENCLAW_API_KEY` och `OPENCLAW_MODEL_API_KEY` | – | `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, lokalt endast `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`; `CROUPIER_SPEECH_VISION` är opt-in | Blueprint anger icke-hemliga standardvärden; två nycklar anges privat |
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
De tidigare QA-fronterna hette `croupier-native-qa-abc92154cb15` och
`croupier-native-studio-qa-abc92154cb15`. Färsk projektlistning 15 oktober
visar endast `scoutgaming` i teamet `scoutgaming`; äldre namn nedan är historik. Det äldre `croupier-player-preview-qa`
raderades 8 oktober 18:40 på Jakobs beslut, efter att Neon- och Blob-resurserna
flyttats till teamet `scoutgaming`; raden `vercel-zones-qa` i registret är historik.
Se [driftskartan](CLOUD-MIGRATION.md).

Lab läser bara `CROUPIER_ZONES_DATABASE_URL` för zoner. Generella DATABASE_URL/
POSTGRES_URL är inte reserv för detta. Vercel-konfiguration kopieras inte
automatiskt till Render. Produkt-, Lab- och Gateway-token har olika roller.

### Synkade privata nycklar, 11 oktober 2026

Rotens ignorerade `.env.local` innehåller aktuella lokala värden. Befintliga
selektiva läsare använder även `.env` och `lab/.env.local`; deras överlappande
nycklar hålls därför lika, utan att ladda alla hemligheter i varje process.
Detta är en verifierad engångssynk, ingen automatisk molnsynk vid filändring.

- ElevenLabs har ett runtime-namn: `ELEVENLABS_API_KEY`. Den angivna
  dubbla prefixeringen rättades med det separat verifierade kontovärdet.
  PAOWs och Dragges exakta originalröst-ID svarade 200 vid läsande kontroll.
  `ELEVENLABS_OC_API` och `ELEVENLABS_VIDEO_KEY` är borttagna ur de tre
  lokala env-filerna; Lab har ingen ElevenLabs-nyckel. Ingen leverantörsnyckel
  återkallades och ingen alternativ röst valdes.
- Render `croupier-v2` har den verifierade `ELEVENLABS_API_KEY`. Läsning
  efter skrivning bekräftade värdet och att andra Render-värden var orörda.
  Lokal Cartesia synkades till den fungerande Render-nyckeln; båda tidigare
  värdena nådde Victoria, men molnets fungerande konto ersattes inte.
- Vercel `scoutgaming` Production fick `OPENCLAWAPI_KEY` och
  `RESEND_API_KEY` från rotens `.env.local`, båda som Sensitive.
  OpenClaws verkliga adminläsning svarade 200 och Resend matchade redan före
  skrivningen. Övriga Vercel-variabler förblev oförändrade, inklusive
  integrationsstyrda Neon/Blob-värden och separata Preview-inställningar.
- Vercels gamla Cartesia/RunPod/OpenAI/Gemini/Director-fält är avsiktligt
  tomma. De fylls inte från lokala filer. ElevenLabs behövs inte på Vercel,
  i GPU-workern eller som GitHub-secret: Render genererar ljud och skickar
  ljudet vidare till workern.

Kontokontroll 12 oktober 2026: nuvarande ElevenLabs-runtime-nyckel i lokal
Web och Render tillhör Kevin (Pro). Det är fortfarande originalklonernas
workspace, inte ett verifierat Jakob-konto. Kontot byts först när egen nyckel
och tillgång till PAOW/Dragge är verifierade; nyckelnamn får inte användas som
bevis på ägare. Instant-kloner delas inom samma workspace enligt
[ElevenLabs](https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice).
Originalinspelningar behöver bevaras separat; genererade svar ersätter dem inte.
RunPod-endpointen kontrollerades i Jakobs inloggade konto och runtime-nyckeln
klarade en obetald health-läsning. Cartesias runtime-värde överensstämmer mellan
lokal Web och Render, men kontoägaren är inte verifierad. Inga nyckelvärden
lagras i denna förteckning. Den aktiva ElevenLabs-vägen använder enbart
`ELEVENLABS_API_KEY` för TTS; historiska video-/OC-namn införs inte som
automatiska reserver. Ljudleverantörsnycklar stannar på Render Web; Vercel,
GPU-workern och GitHub behöver inga kopior för svarsbiblioteket.

Synk av nycklar bevisar inte TTS eller läppsynk. Dealerprofilflaggan förblir
av tills den nya GPU-imagen och hela PAOW-förloppet accepterats.

### Avgränsad kontokontroll, 16 oktober 2026

Efter Jakobs uttryckliga godkännande användes endast lokala `.env.local`-
värden mot RunPods/Cartesias egna läs-API:er. Inga värden skrevs ut och
filerna var oförändrade efter kontrollen. Web/Labs tre relevanta värden
överensstämmer; inga ärvda processvärden fanns för dessa namn.

- RunPod: konfigurerad endpoint `zsudl8tmzcmiv1` gav health 200. Konto-
  identitetsfrågan gav 401, även med dokumenterad GraphQL-autentisering.
  Nyckeln skiljer sig från `EMIL_RUNPOD_API_KEY`. Detta bevisar åtkomst,
  inte färskt kontoägande; tidigare kontokvitto ovan är historiskt.
- Cartesia: voices gav 200. `CARTESIA_API_KEY` är byteidentisk med
  `EMIL_CARTESIA_API_KEY` i den separata privata profilen. Det bevisar
  gemensamt värde, inte att kontoägaren är Emil eller Jakob. Standardnyckeln
  är inte ett ägarbevis; konto/organisation behöver verifieras separat.
- Renders effektiva runtimevärden lästes inte tillbaka i detta steg.
  Den lokala jämförelsen får inte beskrivas som full molnverifiering.

Ingen provider, röst, flagga, credential eller resurs ändrades och inga
TTS-/GPU-jobb kördes. Editorn `lipsync-test` läser över huvud taget inga env-filer.

### Talnycklar och sparade modeller

Nya dealerprofiler kräver `CROUPIER_DEALER_SPEECH_PROFILES=1` på Render
`croupier-v2`, tillsammans med befintlig streaming och Neon-journal. Flaggan är
av tills en workerimage som stöder profilbunden avatar och protokoll 3 har verifierats.
`ELEVENLABS_API_KEY` behövs där för ElevenLabs-profiler; Cartesia-profiler använder
`CARTESIA_API_KEY`. Molnstartaren vidarebefordrar nyckeln enbart till Web-processen,
inte Lab, webbläsaren eller GitHub Actions. Lokala `.env.local` och `lab/.env.local`
förs inte automatiskt över till Render. Inga nya GitHub-secrets krävs för TTS.
Röst-ID, modell och referens sparas per dealer i Studio; runtime kontrollerar
röstbehörighet med ett läsande API-anrop innan GPU-jobbet. Saknad röst eller nyckel
ger fel, aldrig Astrids röst som reserv. Budget och återstartsregler är oförändrade.

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

Den tidigare anslutna Lab-startaren tillät samma explicita speech-timeout och
skickade den bara till Web. Vid kvittot var privat `lab/.env.local` satt
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
  Vanlig lokal start öppnar publicerad produkt utan eget lagringsläge.
  Migrerad runtime kräver uttrycklig Blob-konfiguration; familjeregistret ligger i scoped Neon Studio och
  ersätter produktens gamla `videos/index.json` på Render-disk. Den gamla
  produktdisken är avvecklad och dess externa backup bevaras. QA:s separata
  disk och lokala filprofiler har egna livscykler.
- Bakgrundszoner: `CROUPIER_ZONES_DATABASE_URL` kräver aktiv privat media
  och en separat TLS-skyddad Postgres-anslutning. Den skickas endast till
  Lab. Schemat i `lab/lib/zone-cloud-schema.sql` installeras uttryckligen;
  det är installerat i zonprojektet efter separat QA den 29 september.
  Generella `DATABASE_URL`/`POSTGRES_URL` används aldrig som reserv.
  Spelkonton och saldon använder en separat game/auth-Neon-databas.
- Lokal provkörning: `node lab/start.mjs --offline --no-open` startar endast
  isolerade temporära testdata, utan externa lagringstjänster. Tidigare
  `--cloud-storage` avvisas; den privata profilfilen bevaras. Render/Vercel
  använder sina egna serverinställningar och får inga automatiska lokala kopior.
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
  decimalformat och högst 20 USD, minst sessionsreserven. Även den går
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

### Medieläsarnas appägarskap

Studio och game kopplar egna Blob-adaptrar till den gemensamma medialäsaren
i `packages/studio-registry/server/media-runtime.mjs`. Apparna behåller
sina tidigare roots och lokala filpolicyer. `CROUPIER_DATA_DIR` har samma
legacy-standardkatalogregel; `NEXT_PUBLIC_LAB_BASE_PATH` behåller den
befintliga preview-URL-regeln för tom basväg respektive `/studio`.
`CROUPIER_VERCEL_FRONTEND_ORIGIN` fortsätter styra det exakta betrodda
proxyursprunget. Källinventariet följer de nya kompositionerna; flytten inför
inga nya miljövariabler, ändrar inga värden och skapar ingen lokal fallback
vid ett Neonfel.

Den befintliga sparade spelpolicyns miljöläsare ägs av
`packages/presentation/server/saved-game-policy.mjs`. Importverktyget binder samma
dokumentkontrakt; flytten inför inga nya nycklar, värden eller fallbackregler.

Fullfile-talets miljöläsare ägs nu av
`packages/presentation/server/generated-speech-runtime.mjs`. Appkompositionerna
tillför den ursprungliga repository-roten explicit. Runtime läser aktuell processmiljö
vid status/get, behåller samma konfigurationsnyckel och kräver samma journal/artifacts
i Neon-läget. Ingen ny miljövariabel, processdelad global eller automatisk providerstart införs.

Policybootstrapens miljögrind ägs av
`packages/presentation/server/studio-policy-runtime.mjs`. Game och Studio tillför
samma migrationskontroll och varsin befintlig medialäsare; schema/readSaved-ordningen
och det avstängda SQLite/offline-läget är oförändrade. Svarsbankens gemensamma kärna
får appens befintliga Blob-metoder och samma env/blobClient/cacheDir. Ingen ny
miljövariabel, cache eller automatisk provideranslutning införs.
