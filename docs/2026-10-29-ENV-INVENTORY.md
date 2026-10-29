# Miljöinventering efter migreringen, 2026-10-29

Svar på Jakobs fråga: "Kan det finnas något i env-variablerna som läser från en gammal databas eller något gammalt?" Läst den 29 oktober 2026 på main `a05917c3` (produktionsdeploy `dpl_66mzFEGBVQYE2Ct1hGv1CwQ3qeN3`, READY 01:14Z): Vercel MCP (namn, scope, typ, datum och kommentar för båda projekten, utan dekryptering), Render MCP (tjänstdata; inga namn), Neon MCP (grenar, endpoints, databaser och roller; ingen SQL), `git grep -w` per namn i `apps`, `packages`, `services`, `ops` och `tools` utan tester, och `node tools/check-environment-variables.mjs`. Här står bara namn, scope, typ och datum, aldrig värden. Registret och [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) rättades i samma PR. Inget ändrades i någon panel eller i Neon. Ersätter inventeringen från 28 oktober; dess Render-läsning bärs över nedan eftersom den inte kunde göras om.

## Kort svar

Ingen variabel i Vercel eller Neon pekar på en gammal databas, en gammal Render-tjänst eller en raderad Vercel-yta, så långt namn, metadata och Neon-identiteter kan visa det:

- Produktionens Neon-koppling i Vercel (16 `CROUPIER_NEON_*`) hör till resursen `store_f0uLTbYiQKqQjLCY`, som Vercel själv binder till Neon-projektet `croupier-production` `wandering-hill-60561912`, alltså samma databas som den handsatta `CROUPIER_GAME_DATABASE_URL`. Koden läser inte dessa namn, och ingen källfil läser `DATABASE_URL`, `POSTGRES_URL` eller `PG*`, så de kan inte styra vilken databas som används. Prefixet `CROUPIER_NEON_` gör också att `pg`-biblioteket, som annars läser `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` ur processmiljön, inte ser dem; ingen pool skapas utan `connectionString`.
- Produktionens `CROUPIER_GAME_DATABASE_URL` i Vercel är orörd sedan 2026-10-04. Alla backup- och restoregrenar i Neon är skapade 27–28 oktober och har egna endpoint-värdnamn, så den adressen kan inte peka på dem.
- Neon-orgen `org-green-butterfly-00780270` har exakt två projekt, `croupier-production` och `croupier-k06-k07-staging`. Den gamla orgen `org-lucky-cake-48388035` har inga croupier-projekt kvar (fyra orelaterade projekt; rörs inte). Zones-projektet finns inte.
- Render-workspacen har bara `croupier-v3`, `croupier-k06-k07-staging`, `croupier-lab-director`, `croupier-lab-openclaw` och tre orelaterade tjänster. `croupier-v2` och `croupier-vercel-preview-qa` är borta.
- Blob: `CROUPIER_MEDIA_STORE_ID` i `scoutgaming` hör till `store_AqwvebTbBHarOjvG` (`croupier-media-private`), previews `BLOB_READ_WRITE_TOKEN` till `store_7E06N1P4w9Mu1dZD`. Produktionens `BLOB_READ_WRITE_TOKEN` är Sensitive och går inte att binda till butik via metadata; den är orörd sedan 2026-10-04, från före flytten till teamet, och butiken flyttades med token intakt 2026-10-08.

Det som är gammalt är namn som ingen kod läser (listan under [Rester](#rester-saknas-risk)) och tre saker utanför Vercel: RunPod-mallens `MOVING_CALLBACK_ORIGIN` (pekar på raderade `croupier-v2`; workern avvisar då jobben, så inget läcker), Renders `CROUPIER_MOVING_SPEECH_BANK_RECORD`/`_ENDPOINT_ID` (utbytta i T3, läses inte) och Neons QA-roller och restoremål.

Vad som inte kunde läsas: Render-tjänsternas variabelnamn (Render MCP visar dem inte och `RENDER_API_KEY` finns inte i den här miljön; senaste läsning 28 oktober), Sensitive-värden i Vercel (går aldrig att läsa tillbaka), RunPod-mallens miljö och GitHubs repository secrets.

## Vercel `scoutgaming` (`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`)

51 poster i Production, 10 i Preview, 3 i Development; `hiddenProductionEnvCount` 0. Domäner i projektet: `www.scoutgaming.tech`, `scoutgaming.tech`, `croupier-lab-ui.vercel.app`, `croupier-frontend.vercel.app` och två `scoutgaming-*.vercel.app`. Typ: S = Sensitive, E = Encrypted, P = Plain. Scope: Prod/Prev/Dev.

| Namn | Typ | Scope | Skapad → ändrad | Läses av | Bedömning |
| --- | --- | --- | --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | S | Prod | 10-04 | studio | krävs |
| `CARTESIA_API_KEY` | S | Prod | 10-04 → 10-14 | studio (röstprov) | valfri |
| `CROUPIER_AI_IMAGE_ENABLED` | P | Prod, Prev, Dev | 10-29 | studio | Jakobs beslut 2026-10-29: på i alla miljöer |
| `CROUPIER_AI_IMAGE_DAILY_LIMIT` | P | Prod, Prev, Dev | 10-29 | studio | mjukt tak 12; hårt tak i OpenAI-projektet |
| `CROUPIER_BACKEND_ORIGIN` | S | Prod (10-04 → 10-22), Prev (10-22) | | web, studio, speech | krävs; ändrad 22 oktober när `croupier-v3` skapades |
| `CROUPIER_CLOUD_GENERATED_SPEECH` | P | Prod | 10-04 | talmodulen, verkningslös på Vercel | rest, steg 1 |
| `CROUPIER_DATABASE` | P | Prod | 10-04 | Render-läsvägen, nås inte | rest, steg 2 |
| `CROUPIER_DEALER_IMPORT_AI` | E | Prod, Prev, Dev | 10-13 → 10-15 | studio | Prod behålls; Prev/Dev steg 4 |
| `CROUPIER_GAME_DATABASE_URL` | S | Prod | 10-04 | studio | krävs; orörd sedan före alla backup-grenar |
| `CROUPIER_GENERATED_SPEECH` | P | Prod | 10-04 | talmodulen | rest, steg 1 |
| `CROUPIER_GENERATED_SPEECH_PREVIEW` | P | Prod | 10-04 | talmodulen (nekad) | rest, steg 1 |
| `CROUPIER_GENERATED_SPEECH_STREAMING` | P | Prod | 10-04 | talmodulen | rest, steg 1 |
| `CROUPIER_LAB_BASE_PATH` | P | Prod (10-04), Prev (10-02 → 10-15) | | studio, byggtid | krävs |
| `CROUPIER_LAB_REMOTE_UI` | P | Prod, Prev | 10-04 / 10-02 → 10-15 | `remote-ui.mjs`, nås inte | rest, steg 2 |
| `CROUPIER_LAB_UI_ORIGIN` | P | Prod, Prev | 10-04 / 10-02 → 10-15 | bara utan unified UI | rest, steg 3 (villkoret uppfyllt) |
| `CROUPIER_MEDIA_BLOB_INDEX` | P | Prod | 10-04 | ignoreras | rest, steg 2 |
| `CROUPIER_MEDIA_STORAGE` | P | Prod | 10-04 | studio | krävs |
| `CROUPIER_MEDIA_STORE_ID` | P | Prod, Prev | 10-08 → 10-15 | ingen (Blob-koppling, `store_AqwvebTbBHarOjvG`) | värdhanterad |
| `CROUPIER_NEON_*` (16) | S | Prod | 10-16 → 10-28 | ingen (Neon-koppling, `store_f0uLTbYiQKqQjLCY` = `wandering-hill-60561912`) | värdhanterad; Preview avmarkerad 10-28 |
| `CROUPIER_PUBLIC_ORIGIN` | P | Prod (10-04), Prev (10-02 → 10-15) | | web, studio, speech | krävs |
| `CROUPIER_STREAM_LANE` | P | Prod, Prev | 10-04 / 10-02 → 10-15 | bara `connectedLane` i Admin | rest, steg 2 |
| `CROUPIER_STUDIO_ENVIRONMENT_ID` | P | Prod | 10-04 | studio | krävs |
| `CROUPIER_STUDIO_MAIL_FROM` | P | Prod | 10-06 | studio | villkorlig, par med Resend |
| `CROUPIER_STUDIO_MOVING_DRIFT_API` | P | Prod | 10-19 | studio | villkorlig |
| `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` | P | Prod | 10-19 | web, studio | villkorlig (en profil, `baseline`) |
| `CROUPIER_STUDIO_NATIVE_ADMIN` | P | Prod | 10-04 | web, studio, byggtid | krävs |
| `CROUPIER_STUDIO_NEON_POLICY` | P | Prod | 10-04 | web, studio | krävs |
| `CROUPIER_STUDIO_WORKSPACE_ID` | P | Prod | 10-04 | studio | krävs |
| `CROUPIER_VERCEL_INGRESS_SECRET` | S | Prod | 10-04 | web, studio, speech | krävs |
| `CROUPIER_VERCEL_UI` | P | Prod | 10-06 | web, studio, speech | krävs |
| `CROUPIER_VERCEL_UNIFIED_UI` | P | Prod | 10-06 | web, studio | krävs |
| `DEMO_GUEST_ACCESS` | P | Prod | 10-04 | talmodulen (nekad) | rest, steg 1 |
| `OPENAI_API_KEY` | E | Prod | 10-13 | studio (import, assistent, AI-bilder) | villkorlig |
| `OPENCLAW_API_KEY` | S | Prod | 10-12 → 10-13 | studio (OpenClaw-fliken) | villkorlig |
| `RESEND_API_KEY` | S | Prod | 10-04 → 10-11 | studio | villkorlig |
| `RUNWAY_API_KEY` | S | Prod | 10-12 | studio | valfri |

Jämfört med 28 oktober: `BO_URL`, `CROUPIER_ASTRID_CAMERA` och `CROUPIER_PLAYER_ACCOUNTS` är borttagna (Jakob), Neon-kopplingens 16 Preview-poster är borta (Preview avmarkerad i kopplingen 10-28; butikens projektmetadata listar fortfarande "preview" som miljö, men inga Preview-poster injiceras), och de två AI-bildnamnen är nya i alla tre scopen. Nekade namn (`RUNPOD_*`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `CROUPIER_ZONES_DATABASE_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN`) saknas. Inget krävt namn saknas: `CROUPIER_VERCEL_FRONTEND_ORIGIN`, `LAB_PUBLIC_URL`, `OPENCLAW_MODEL_*` och `CROUPIER_AI_IMAGE_MODEL/RENDERER/REASONING` är valfria och osatta, så kodens standardvärden gäller.

## Vercel `croupier-k06-k07-staging` (`prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`)

16 poster, alla i Production-scope utom `BLOB_READ_WRITE_TOKEN` (alla tre): `CROUPIER_PUBLIC_ORIGIN` (previews egen adress), `CROUPIER_BACKEND_ORIGIN` (Render-stagingen), `CROUPIER_STUDIO_ENVIRONMENT_ID` (`staging_k06_k07`), `CROUPIER_STUDIO_WORKSPACE_ID` (`croupier`), `CROUPIER_STUDIO_NATIVE_ADMIN`, `CROUPIER_VERCEL_UI`, `CROUPIER_VERCEL_UNIFIED_UI`, `CROUPIER_STUDIO_NEON_POLICY`, `CROUPIER_LAB_BASE_PATH`, `CROUPIER_MEDIA_STORAGE` (alla P, 10-25); `CROUPIER_VERCEL_INGRESS_SECRET` (S, 10-25); `CROUPIER_GAME_DATABASE_URL` (S, 10-25 → 10-28 19:46Z); `BLOB_READ_WRITE_TOKEN` (E, 10-25, `store_7E06N1P4w9Mu1dZD`); `OPENAI_API_KEY`, `CROUPIER_AI_IMAGE_ENABLED`, `CROUPIER_AI_IMAGE_DAILY_LIMIT` (S, 10-28; taket 20 här mot 12 i `scoutgaming`).

Avvikelser: `BLOB_READ_WRITE_TOKEN` är Encrypted, inte Sensitive, och flaggas av Vercel som läsbar hemlighet; gör om den som Sensitive. `CROUPIER_GAME_DATABASE_URL` ändrades 28 oktober under O03:s restoreprov, och värdet går inte att läsa; att den pekar på `croupier_staging` och inte på `croupier_staging_restore_o02` kontrolleras i panelen. Projektet saknar med rätta `CROUPIER_LAB_REMOTE_UI`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_STREAM_LANE`, `CROUPIER_DATABASE` och tal-, mejl- och Runway-namnen.

## Render

Tjänstdata läst 2026-10-29; variabelnamnen lästes senast 2026-10-28 via REST och bärs över här. Render MCP visar inga namn, och `RENDER_API_KEY` saknas i den här miljön.

| Tjänst | ID | Plan, region | autoDeploy | Läge 10-29 | Namn (10-28) |
| --- | --- | --- | --- | --- | --- |
| `croupier-v3` | `srv-dbd6nfon74is73aiblf0` | 1c-2g, Frankfurt, Docker `ops/cloud/Dockerfile.game` | av | igång, ändrad 01:14Z | 45 |
| `croupier-k06-k07-staging` | `srv-dbf61l0m7kps73ft7mk0` | 1c-2g, Frankfurt, Docker | av | igång | 20 |
| `croupier-lab-director` | `srv-danhlpjtqb8s73bv530g` | starter, Frankfurt, disk `/data/catalog` | av | igång | 16 |
| `croupier-lab-openclaw` (privat) | `srv-danhiv3tqb8s73burkq0` | standard, Frankfurt, disk `/data/openclaw` | av | igång | 10 |

Från läsningen 10-28, som fortfarande gäller tills någon läser om: alla 45 namn på `croupier-v3` är registrerade och lästa av `ops/cloud/config.mjs` eller `services/game`; förbjudna namn, bootstrap-namn och diskvägar saknas i både produktion och staging; ingen variabel pekar på `croupier-v2`, `croupier-vercel-preview-qa` eller någon astrid-, lissabon-, impactwin- eller player-preview-värd (`CROUPIER_STREAM_LANE=lissabon-stream-lane` är ett levande anslutnings-ID); `CROUPIER_SHARED_TABLE_ENABLED=1` i både produktion (sedan 10-28 13:52Z) och staging; `CROUPIER_MOVING_SPEECH_ENABLED=0` i produktionen. Kvarstående panelavvikelse: `croupier-v3` har `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` (läses inte sedan T3) men saknar `CROUPIER_MOVING_SPEECH_BANK_RECORDS`. Director har `OPENCLAW_SPEECH_TIMEOUT_MS` och `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY` bara i panelen; Gateway har `CROUPIER_SPEECH_VISION` (på) och `OPENCLAW_DASHBOARD_ORIGIN` bara i panelen.

Övriga tjänster i workspacen (`sajtmaskin-dash`, `openclaw-sajtagenten`, `spelsajt-game-server`) hör till andra repon och rörs inte.

## Neon

**`croupier-production` `wandering-hill-60561912`** (org `org-green-butterfly-00780270`, Postgres 18, Frankfurt, historik 6 h):

| Gren | ID | Förälder | Skapad | Endpoint | Läge |
| --- | --- | --- | --- | --- | --- |
| `main` (default, Vercel-skyddad) | `br-flat-fog-b161a6r8` | – | 09-29 | `ep-fragrant-meadow-b1qzb0qv` (0.25–8 CU) | aktiv, produktionen |
| `backup-before-008-010-20261027` | `br-round-wind-b120esv6` | main | 10-27 17:41Z | ingen | vilande |
| `backup-ren-start-20261028` | `br-morning-scene-b1a0ykzk` | main | 10-28 04:50Z | `ep-royal-boat-b1wfld85` | suspenderad |
| `backup-before-o03-20261028` | `br-winter-sunset-b1dnm0kb` | main | 10-28 13:08Z | `ep-falling-violet-b1u3t8pm` | suspenderad |
| `o03-restore-proof` | `br-delicate-sea-b1ukv9y2` | backup-before-o03 | 10-28 13:09Z | `ep-square-snow-b1v6kiy7` | suspenderad |

Databaser på `main`: bara `croupier_game` (ägare `croupier_game`). Roller på `main`: `croupier_game` (approllen), `neondb_owner`, `kevin_migration_readonly` (10-21, Jakobs beslut), och två QA-rester från 2–3 oktober: `croupier_game_qa` och `croupier_studio_qa_abc92154cb15`.

**`croupier-k06-k07-staging` `red-violet-36066351`** (Vercel Marketplace, Postgres 18, Frankfurt, historik 24 h): en gren `main` `br-plain-voice-b9yu49xi`, endpoint `ep-billowing-surf-b93x7p3c` (0.5–2 CU, aktiv). Databaser: `croupier_staging` (previews), `croupier_staging_restore` (10-25) och `croupier_staging_restore_o02` (10-28), alla ägda av `croupier_staging_migrator`, samt Marketplace-standarden `neondb`. Roller: `croupier_staging_migrator`, `croupier_staging_app`, `neondb_owner`.

Identiteterna i [START-HERE](../START-HERE.md#identiteter) stämmer (projekt, gren, databas för båda miljöerna). Ingen env-variabel kan verifieras mot endpoint-värdnamn utan att dekryptera, men produktionens adress är äldre än alla grenar utom `main`.

## Kod mot drift

- **Variabler i drift som ingen kod når** (a): på Vercel de tolv i [borttagningslistan](ENVIRONMENT-VARIABLES.md#att-ta-bort-ur-vercel-production), plus de 16 `CROUPIER_NEON_*` och `CROUPIER_MEDIA_STORE_ID`, som kopplingarna injicerar och koden inte läser. På Render (10-28) `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID`.
- **Variabler koden kräver men som saknas** (b): inga. `CROUPIER_MOVING_SPEECH_BANK_RECORDS` saknas på Render men krävs bara med `CROUPIER_MOVING_SPEECH_ENABLED=1`, som är `0`.
- **Namn som pekar på gamla resurser** (c): `CROUPIER_LAB_UI_ORIGIN` (värdet är aliasvärden `croupier-lab-ui.vercel.app`, som nu är en domän på produktionsprojektet; läses inte i unified-läget), RunPod-mallens `MOVING_CALLBACK_ORIGIN` (`croupier-v2`, rättas före rörligt tal; ligger inte i Vercel eller Render), `CROUPIER_ASTRID_TRANSLATION_KEY` på Render (levande: Whisper för spelarens mikrofon, namnet är historiskt), `CROUPIER_STREAM_LANE=lissabon-stream-lane` (levande ID). Inga `*_V2*`-, `SQLITE*`- eller preview-qa-namn i någon panel. Koden har en död diagnosväg i `packages/server-transport/socket-core.mjs` (`platformSocketDiagnostics`) som bara skulle slå på mot `croupier-player-preview-qa.vercel.app` och `croupier-vercel-preview-qa.onrender.com`; den returnerar alltid en no-op i dag och kan raderas med sina prov i en kod-PR.
- **Avvikelser mot `environment-variables.json`** (d), rättade i samma PR: 28 oktobers uppgifter om Preview-kopplingen, `BO_URL`/`CROUPIER_ASTRID_CAMERA`/`CROUPIER_PLAYER_ACCOUNTS`, AI-bildnamnens scope och tak, och att `runpod-gpu-worker` saknade `MOVING_CALLBACK_ORIGIN` och `MOVING_BANK_STORE`. `node tools/check-environment-variables.mjs` passerar.

## Rester, saknas, risk

| Kategori | Vad | Risk |
| --- | --- | --- |
| Rester, Vercel `scoutgaming` | 12 namn i borttagningslistan (steg 1–4), varav `CROUPIER_LAB_UI_ORIGIN` nu är fri att ta bort | ingen: läses inte eller är verkningslösa |
| Rester, Vercel-kopplingar | 16 `CROUPIER_NEON_*` och `CROUPIER_MEDIA_STORE_ID` | ingen: pekar på rätt resurser och läses inte |
| Rester, Render `croupier-v3` | `CROUPIER_MOVING_SPEECH_BANK_RECORD`, `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` | ingen förrän rörligt tal slås på; då krävs `_BANK_RECORDS` |
| Rester, RunPod | `MOVING_CALLBACK_ORIGIN` → `croupier-v2` | ingen läcka (workern avvisar), men blockerar rörligt tal |
| Rester, Neon produktion | rollerna `croupier_game_qa`, `croupier_studio_qa_abc92154cb15`; grenarna `backup-before-008-010-20261027`, `backup-ren-start-20261028` (och efter beslut `backup-before-o03-20261028` + `o03-restore-proof`) med tre vilande endpoints | låg: roller med lösenord mot produktionsdata; grenar kostar lagring |
| Rester, Neon preview | databaserna `croupier_staging_restore`, `croupier_staging_restore_o02`, `neondb` | låg: bara risk om previews adress pekas om dit |
| Saknas | inget krävt namn | – |
| Risk fel databas/Blob | ingen hittad: ingen kod läser kopplingsnamn eller generiska `DATABASE_URL`/`POSTGRES_URL`; produktionsadressen är från 10-04 | – |
| Risk, previewhemlighet | previews `BLOB_READ_WRITE_TOKEN` är Encrypted i stället för Sensitive | låg: previewbutik, inte produktion |

## Förslag till Jakob (inget utfört)

1. Vercel `scoutgaming`: ta bort de tolv namnen i ordningen i [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md#att-ta-bort-ur-vercel-production); steg 3 är inte längre blockerat. Överväg att koppla bort Neon-integrationen helt, eftersom koden inte läser den (Blob-kopplingen behålls för butiken).
2. Vercel `croupier-k06-k07-staging`: gör `BLOB_READ_WRITE_TOKEN` Sensitive; bekräfta i panelen att `CROUPIER_GAME_DATABASE_URL` pekar på `croupier_staging`.
3. Render `croupier-v3`: ta bort `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` och lägg in `CROUPIER_MOVING_SPEECH_BANK_RECORDS` först när rörligt tal ska på (en env-skrivning startar en deploy; bordet ska vara tomt).
4. RunPod: sätt `MOVING_CALLBACK_ORIGIN=https://croupier-v3.onrender.com` i mallen före `CROUPIER_MOVING_SPEECH_ENABLED=1`.
5. Neon produktion: radera QA-rollerna och de backup-grenar som inte längre behövs (D6 i [NEXT-AGENT](NEXT-AGENT.md)); Neon preview: radera `croupier_staging_restore*` och `neondb` när restoreproven är avslutade.
6. Kod: radera `platformSocketDiagnostics` i `packages/server-transport/socket-core.mjs` med dess prov.
7. Lägg `RENDER_API_KEY` i `.env.local` på den maskin som ska läsa om Render-namnen.
