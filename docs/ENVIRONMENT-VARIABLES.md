# Miljövariabler per tjänst

Läsbar referens till [`environment-variables.json`](environment-variables.json), som är den maskinkontrollerade listan. Här står namn, krav, var värdet sätts och vad det gör, aldrig värden.

`sources` för Render-spelmotorn och Studio följer den registrerade medieruntimen efter avvecklingen av legacy-klippinventeringen.

- Varje tillägg, borttagning eller betydelseändring uppdaterar både denna fil och JSON-registret i samma leverans ([AGENTS.md](../AGENTS.md#verifiering-och-säkerhet)).
- `node tools/check-environment-variables.mjs` körs i CI och i den fokuserade hooken för varje ändrad fil utanför dokumentationen (och för registret och verktyget). Den kontrollerar att varje namn som de registrerade källfilerna läser finns i registret, att ingen spårad kodfil nämner ett [fast värde](#fasta-värden) och att en staged env-ändring följs av båda filerna. Värden och leverantörspaneler kontrolleras inte.
- `node tools/check-environment-variables.mjs --compare <tjänst> <env-fil>` jämför bara nyckelnamnen i en lokal fil med registret och skriver aldrig ut värden.
- En ändring direkt i en panel jämförs mot listan och antecknas här.

Krav i tabellerna: **krävs** (starten stoppar utan), **villkorlig** (krävs när funktionen är på), **valfri**, **värdhanterad** (plattformen sätter), **nekas** (värdet stoppar starten eller förs inte vidare).

## Var värden sätts och läses

| Plats | Tjänster | Läsa | Skriva |
| --- | --- | --- | --- |
| Vercel, projekt `scoutgaming`, Production | web, studio, speech | `vercel env ls` (namn och scope); Sensitive-värden går inte att läsa tillbaka | Jakob eller CLI; gäller från nästa deploy |
| Render, tjänstens Environment | `croupier-v3`, Director, Gateway, `scoutgaming-preview-engine` | Render REST-API med `RENDER_API_KEY` från gitignorerad `.env.local`; Render MCP läser inte värden | Render MCP `update_environment_variables` sammanfogar nycklar och startar en deploy direkt; kontrollera `/__cloud/health` efteråt |
| Render Blueprint `services/openclaw/lab/render.yaml` | Director, Gateway | I repot | Via PR; icke-hemliga standardvärden, hemligheter med `sync: false` |
| GitHub repository secret | CI (`.github/workflows/croupier.yml`) | Inte möjligt | Jakob |
| Gitignorerad `.env.local` på Jakobs dator | Lokala verktyg och agenter | Bara av det verktyg som behöver namnet | Aldrig till Git eller chatt |

Inga miljögrupper eller secret files används. Render-konfiguration kopieras aldrig automatiskt till Vercel eller tvärtom, och produktionshemligheter kopieras aldrig till staging eller Preview.

## Vercel `scoutgaming`: web, studio och speech

Ett projekt med tre tjänster (`vercel.json`). Registret delar upp dem som `vercel-frontend-production` (web och speech), `vercel-lab-ui` (studio) och `vercel-entry` (spelarbygget). Produktens värden sätts i Production. Den separata testmiljön är projektet `scoutgaming-preview`, som också använder sitt Production-scope; `scoutgaming`s Preview-scope är inte den miljön. AI-bildnamnen får finnas i flera scope enligt Jakobs beslut. Aktuell namnförteckning är `environment-variables.json`; antal panelposter är inte ett kontrakt.

| Namn | Krav | Tjänst | Syfte |
| --- | --- | --- | --- |
| `CROUPIER_VERCEL_UNIFIED_UI`, `CROUPIER_STUDIO_NATIVE_ADMIN`, `CROUPIER_LAB_BASE_PATH`, `CROUPIER_STUDIO_NEON_POLICY`, `CROUPIER_MEDIA_STORAGE` | läses inte; fasta i koden | web, studio | Se [Fasta värden](#fasta-värden). Panelposterna tas bort efter deploy ([listan](#att-ta-bort-i-panelen)) |
| `CROUPIER_PUBLIC_ORIGIN` | krävs | web, studio, speech | `https://www.scoutgaming.tech`; även länkar i mejl |
| `CROUPIER_BACKEND_ORIGIN` | krävs | web, studio, speech | Spelmotorns exakta origin, `https://croupier-v3.onrender.com`. Den aktiverar transporten i `packages/server-transport/configuration.mjs`. Saknad origin i Production fäller `apps/web`-bygget; lokalt och i CI ger den bara landningssidan och Studio-proxyn svarar 503. Om origin är satt men `CROUPIER_VERCEL_INGRESS_SECRET` saknas kastar konfigurationen ett fel; Studio-proxyn svarar då 500. Båda ska sättas tillsammans i den avsedda miljön |
| `CROUPIER_VERCEL_INGRESS_SECRET` | krävs, Sensitive | web, studio, speech | Signerar anrop till spelmotorn; samma värde som på Render |
| `CROUPIER_LAB_UI_ORIGIN` | läses inte | – | Lästes bara utan unified-läget, som nu är fast; ingen källfil läser den (Miljövariabler 2). Assistenten (`assistantRequestConfiguration` i `studio-native-request.mjs`) och Admin litar bara på `CROUPIER_PUBLIC_ORIGIN`. Borttagen ur panelen (läst 2026-10-29 16:10); domänen `croupier-lab-ui.vercel.app` finns kvar i projektet |
| `LAB_PUBLIC_URL` | villkorlig | studio | Betrodd proxy-origin för sessionskontrollen; ingen lokal Studio-process |
| `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID` | krävs | studio | Serverägt scope (`production`/`croupier`); samma som på spelmotorn |
| `CROUPIER_GAME_DATABASE_URL` | krävs, Sensitive | studio | Neon `croupier_game` med TLS. `CROUPIER_NEON_*` väljer inte registret |
| `BLOB_READ_WRITE_TOKEN` | krävs, Sensitive | studio | Privat Blob för uppladdning och medie-API; Blob är fast, token avgör om media är konfigurerad |
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
| `CARTESIA_API_KEY` | valfri | studio | Röstverifiering för sparat tal via `studio-speech-build-service.mjs`; det fristående röstprovet är avvecklat |
| `CROUPIER_STUDIO_MOVING_DRIFT_API`, `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` | villkorlig | web, studio | Driftväljaren för rörligt tal, se nedan |
| `CROUPIER_VERCEL_FRONTEND_ORIGIN` | valfri | studio | Betrott proxyursprung för en separat förhandsfrontend; tom i produktionen |
| `CROUPIER_GAME_ORIGIN` | sätts inte på Vercel | web (`vercel-entry`), studio | Behövs bara när `apps/web/tools/player-ui-build.mjs` körs fristående. Vercel-bygget (`prepare-platform-ui.mjs`) tar originen från `CROUPIER_BACKEND_ORIGIN`. Studio läser den bara i den lokala partnerreferensen (`partner-observer.mjs:41`, se nedan) |
| `CROUPIER_MEDIA_BLOB_INDEX` | sätts inte | studio | Ignoreras: runtime-vägarna skickar alltid med `runtimeCatalog` från Neon (`registry-reader.mjs`, `media-runtime.mjs`), och `media/blob-index.json` utesluts från bundeln i `apps/studio/next.config.mjs` |
| `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_STREAMING` | sätts inte på Vercel | studio | Läses av den delade `generated-speech-runtime.mjs`, men kan aldrig slå på något på Vercel: talet kräver `HOST` `0.0.0.0` (eller `localhost` lokalt) och för molnet en `PUBLIC_URL`, och ingen av dem finns där. Talet körs på Render |
| `BO_URL` | sätts inte | – | Läses inte på Vercel; bara spelmotorn härleder den |
| `CROUPIER_ASTRID_CAMERA`, `CROUPIER_PLAYER_ACCOUNTS` | sätts inte | – | Läses bara av spelmotorn |
| `CROUPIER_NEON_*` (16 namn), `CROUPIER_MEDIA_STORE_ID` | värdhanterad | projektet | Injiceras av Vercels Neon- och Blob-kopplingar; koden läser dem inte (ingen källfil läser heller `DATABASE_URL`, `POSTGRES_URL` eller `PG*`). Alla 16 Neon-poster hör till resursen `store_f0uLTbYiQKqQjLCY`, som är Neon-projektet `croupier-production` `wandering-hill-60561912`, alltså samma databas som `CROUPIER_GAME_DATABASE_URL`; sedan 2026-10-28 bara i Production (Preview avmarkerad i kopplingen). `CROUPIER_MEDIA_STORE_ID` hör till `store_AqwvebTbBHarOjvG` (Production och Preview) |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` | nekas | web, studio | Talleverantörerna bor på Render; Vercel ska inte ha kopior |
| `CROUPIER_ZONES_DATABASE_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | nekas | studio | Hör till spelmotorn respektive Director |
| `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW` | nekas | studio | `1` stänger av molntalet respektive slår på den lokala förhandsvisningen (bara med `HOST=localhost`). Borttagna ur panelen (läst 2026-10-29 16:10) |
| `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`, `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD`, `CROUPIER_GENERATED_SPEECH_DIR`, `LAB_STUDIO_DATA_DIR` | nekas | studio | Talbudget och endpoint hör till Render; diskvägarna är pensionerade |
| `NODE_ENV`; `HOST`, `CROUPIER_CLOUD_RUNTIME`, `PUBLIC_URL` | värdhanterad; sätts inte | studio | Läses av den delade talmodulen för att känna igen molnet; Vercel sätter `NODE_ENV` |
| `VERCEL` | värdhanterad | studio | Vercel sätter den. `apps/studio/lib/public-assistant.mjs:55` tar då Scoutguidens hastighetsgräns per `x-vercel-forwarded-for`, annars en gemensam hink |
| `NEXT_PUBLIC_ADMIN_WORKSPACE`, `NEXT_PUBLIC_LAB_BASE_PATH` | sätts inte; byggdefinierade | studio | Ingen panelpost: esbuild skriver in värdena i Admin-SPA:n (`apps/studio/client/build.mjs:42`, `client/surface-bundle.mjs:19`; `1` för admin, annars `0`) och `apps/studio/lib/lab-url.mjs:14` läser dem. Basvägen är den fasta `/studio` (också `next.config.mjs`) |
| `CROUPIER_LAB_INTERNAL_SECRET` | sätts inte | studio | Det gamla molnlabbets gräns i `apps/studio/lib/http-guard.mjs:19,30`: tillsammans med `LAB_PUBLIC_URL` (https-origin) och minst 32 byte släpper den in anrop med rubriken `x-croupier-lab-authorized` till de lokalvaktade vägarna. Båda är osatta på Vercel, så de vägarna svarar 403 där |
| `BETTALOTTO_API`, `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET`, `BETTALOTTO_PARTNER_PLAYER_ID`, `BETTALOTTO_PARTNER_BASE_URL` | sätts inte; bara lokalt | studio | Partnerreferensen `/api/inputs/reference` (`apps/studio/lib/partner-reference.mjs:13-19`, `partner-observer.mjs:3-15,41`; äldre alias `LAB_PARTNER_*`). Vägen är lokalvaktad (`partner-reference.mjs:67`); `BETTALOTTO_API` läses också ur rotens `.env` och `apps/studio/.env.local` |

**Var Studio och `/admin` läser data.** Datakällan väljs bara av `CROUPIER_GAME_DATABASE_URL` (värden måste sluta på `.neon.tech`, annars 503) och scopet `CROUPIER_STUDIO_ENVIRONMENT_ID`/`CROUPIER_STUDIO_WORKSPACE_ID` (`apps/studio/lib/studio-native-runtime.mjs:63-85`); dokumenten och runtimekatalogen läses per scope (`packages/studio-registry/server/repository.mjs:113-121`). Det finns ingen reserv till fil, JSON, SQLite, PGlite eller seed. `CROUPIER_NEON_*` (16 namn) och `CROUPIER_MEDIA_STORE_ID` är integrationsposter som ingen källfil läser. Ett namn läses i koden men gör ingenting i Vercel-driften och är inte satt där:

- `CROUPIER_MEDIA_BLOB_INDEX`: `packages/studio-registry/server/media-blob-index.mjs:25`; katalogen från Neon (`runtimeCatalog`, `:17` och `media-runtime.mjs:57`) går alltid före.

Studio läser inte längre `CROUPIER_STREAM_LANE` (Admins `connectedLane` är alltid `false`, ingen komponent läste den) eller `CROUPIER_DATABASE` (PostgreSQL är enda vägen).

Speech (`apps/speech`) läser `PORT` och samma transportnycklar som web; den har inga egna namn. Native Node-funktionerna `/speech-stream` och `/lipsync-worker` har 300 respektive 600 sekunders gräns i `vercel.json`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

Den fristående operatörens tal-QA-adapter är avvecklad 31 oktober. Dess källfil är borttagen ur miljöregistrets `sources`; inga variabler eller panelvärden ändras av detta. Produktens taladaptrar och deras budget-/behörighetskontroller finns kvar.

### Sparade röst-ID:n i Vercel

Jakobs beslut 2026-10-30: projektet `scoutgaming` lagrar `ELEVENLABS_PAOW_VOICE_ID`, `ELEVENLABS_DRAGAN_VOICE_ID` och `ELEVENLABS_JAKOB_VOICE_ID` som Config i **Production, Preview och Development**, utan branchfilter. Det gäller de tre miljöerna i detta projekt, inte det separata projektet `scoutgaming-preview`.

Posterna är valfria referensvärden utan runtime-läsare; de byter ingen dealers sparade talprofil och aktiverar ingen generering. Paow och Dragan finns redan i `packages/presentation/contracts/dealer-voice-catalog.json`. API-nyckeln måste separat ha åtkomst till valt röst-ID. Ingen ElevenLabs-nyckel kopieras till Vercel.

Läskontroll 2026-10-30: `ELEVENLABS_API_KEY` på Render `croupier-v3` listar Jakob och ABYDM men saknar Paows röst (`voice_not_found`). Kontoprofilen avvisar samma nyckel med `missing_permissions`. Jakob vidarebefordrade därefter Kevins besked: detta är Impactwin-kontot, där Jakob och Adebayor/ABYDM ligger; Paow och Dragan ligger kvar i Kevins vanliga ElevenLabs-konto. Kontotillhörigheten kommer från Kevins besked, inte en lyckad profilfråga. Runtime använder i dag en gemensam ElevenLabs-nyckel; ett byte till Kevins konto ger därför inte åtkomst till Impactwins röster. Inget nyckelbyte eller stöd för flera konton ingår i denna ändring.

**Senaste beslut, Jakob 2026-10-30:** samla alla fyra röster hos Kevin. Jakob och ABYDM är API-verifierat Instant Voice Clones (`category=cloned`); deras ljudunderlag är hämtat privat inför återskapande på Kevins konto. Kopiorna får nya ID:n. Kevins kontonyckel saknas ännu; inga kopior eller aktiva nyckel-/profilbyten har gjorts. Verifiera alla fyra röster på målkontot före byte och bevara Impactwins original tills ersättningen är kontrollerad.

## Fasta värden

<a id="fasta-värden"></a>

Fem flaggor hade bara ett värde i produktionen och preview och är sedan Miljövariabler 2 fasta i koden. Ingen källfil läser dem. `node tools/check-environment-variables.mjs` fäller env-läsningar och env-deklarationer av namnen i `hardcodedNames`, även i prov och byggskript. Kommentarer, beskrivande strängar och vanliga objektfält får nämna namnen. Kontrollen använder Studios låsta Babel-parser för JS/TS: direkta `process.env`-/`env`-medlemmar, destrukturering och lokala `const`-alias, samt env-objekt i konfiguration. Den kontrollerar också `.env`-mallar (inklusive kommenterade exempelnycklar), JSON-fältet `env` och Render-blueprints. Andra konfigurationsformat ingår inte. Godtyckligt beräknade nycklar, funktionsreturer och omtilldelade alias utvärderas inte. `docs/`, Markdown och `.github/workflows/` ligger fortsatt utanför denna audit. Kravet på båda inventeringsfilerna i samma commit vid env-ändringar är oförändrat.

Staged-kontrollen jämför env-uttryck och deras direkta standardvärden i HEAD och index. Lokala bindningsnamn och andra argument i ett omgivande funktionsanrop ingår inte; den tolkar inte hjälpfunktioners egna standardvärden. Den är en avgränsad syntaxkontroll, ingen fullständig semantisk jämförelse.

| Tidigare variabel | Fast värde | Var det står i koden |
| --- | --- | --- |
| `CROUPIER_VERCEL_UNIFIED_UI` | `1`: en publik origin för spel och Admin | `packages/server-transport/configuration.mjs` (`unifiedUi`, `labUiOrigin` = den publika originen), `apps/studio/lib/studio-native-runtime.mjs`, `studio-native-request.mjs`, `apps/studio/proxy.ts` |
| `CROUPIER_STUDIO_NATIVE_ADMIN` | `1`: Admin körs nativt på Vercel | `nativeStudioAdminEnabled()` i `studio-native-runtime.mjs`, `nativeStudio` i `configuration.mjs` |
| `CROUPIER_LAB_BASE_PATH` | `/studio` | `apps/studio/next.config.mjs` (`basePath`, `NEXT_PUBLIC_LAB_BASE_PATH`), `client/build.mjs`, `client/surface-bundle.mjs`, `app/layout.tsx`, `companion-server.mjs`, `proxy.ts` |
| `CROUPIER_STUDIO_NEON_POLICY` | `1`: Neon är registret | `saved-game-policy.mjs`, `packages/navigation/game-entry.mjs` (`gameEntryEnabled`), `canonicalGame` i `configuration.mjs` och `ops/cloud/vercel-ingress.mjs`, `ops/cloud/config.mjs`, `container-entry.mjs`, `services/game/server.mjs` och talets journalkrav |
| `CROUPIER_MEDIA_STORAGE` | `blob`: privat Blob | `ops/cloud/config.mjs`, `container-entry.mjs`, `private-media-contract.mjs` och `media-runtime.mjs` (Blob är konfigurerad när `BLOB_READ_WRITE_TOKEN` finns), `services/game/server.mjs` |

Följder: `CROUPIER_LAB_UI_ORIGIN` (bara utan unified-läget), `CROUPIER_PUBLIC_GAME_PATH` (spelmotorns dokument är `/blackjack`, partnerlänken `/game`) och `CROUPIER_GENERATED_SPEECH_DIR` i talmodulerna (talet journalförs alltid i Neon) läses inte heller längre. Sedan Miljövariabler 2b står `CROUPIER_LAB_UI_ORIGIN` och `CROUPIER_PUBLIC_GAME_PATH` också i `hardcodedNames`, så vakten fäller även dem. Underhållsexporten (`CROUPIER_STORAGE_MAINTENANCE=studio-export`) kräver inte längre `CROUPIER_STUDIO_NEON_POLICY=0`; den startar ingen spelprocess och kräver fortfarande talflaggorna `0`.

## Gallring och efterkontroll

<a id="att-ta-bort-i-panelen"></a><a id="att-ta-bort-ur-vercel-production"></a>

Ordningen är kompatibel kod → grön PR → verifierad deploy → borttagning av den olästa posten. En env-ändring på Render startar en deploy; kontrollera tomma bord och inga saldoreservationer före en produktionsändring. Behåll ett privat återställningsunderlag för den beställda ändringen.

**Slutfört 30 oktober 2026:** de pensionerade Vercel-flaggorna togs bort i båda projekten, de fasta databas-/medieflaggorna togs bort i båda Render-motorerna och produktionens två olästa movingnamn togs bort. Återläsningen bekräftade oförändrade övriga värden. Återställningsunderlagen finns privat under `arkiv/2026-10-30/vercel-env-cleanup/`, `arkiv/2026-10-30/nattarbete/` och taluppdragets privata underlag. Inga talaktiveringar ingick.

Följande identifierades i inventeringen den 29 oktober och måste återläsas innan en separat ändring:

| Kandidat | Kontroll före åtgärd |
| --- | --- |
| `CROUPIER_DEALER_IMPORT_AI` i `scoutgaming`s Preview/Development | Läses inte i dessa scope; behåll Production-posten |
| Integrationsskapade `CROUPIER_NEON_*` och `CROUPIER_MEDIA_STORE_ID` | Ingen produktkod läser namnen. Kontrollera projektkopplingen och att de avsiktliga databas-/Blob-värdena fungerar utan den. Att koppla bort projektet är inte att radera Neon- eller Blob-resursen |
| Previews `BLOB_READ_WRITE_TOKEN` | Inventeringen visade Encrypted. Kontrollera aktuell typ och ändra till Sensitive med samma värde om det fortfarande behövs |
| Produktionens `CROUPIER_BACKEND_ORIGIN` | En publik URL hade typen Sensitive. Kan göras Plain; detta är kosmetik och påverkar inte transporten |

Välj efterkontroller efter den ändrade konsumenten: Admin-inloggning, lobby/launch, assistent eller Render-hälsa. Uppdatera denna guide och JSON-registret vid varje faktisk variabeländring. Panelernas antal poster ändras över tid och ska inte användas som städlista.

## Render `croupier-v3`: spelmotorn

Registerposten är `render-game`. `ops/cloud/config.mjs` validerar processmiljön vid start och vägrar starta vid fel; `node ops/cloud/start.mjs --check` provar konfigurationen utan att starta spelet. Driftreceptet står i [RENDER-V3](../ops/cloud/RENDER-V3.md).

| Namn | Krav | Syfte |
| --- | --- | --- |
| `NODE_ENV` | krävs, `production` (imagen sätter) | Produktionsläge |
| `CROUPIER_CLOUD_LAUNCH` | krävs, `pilot` | Tillåter `start.mjs --start` |
| `CROUPIER_CLOUD_LAYOUT` | krävs, `single-origin` | En publik origin. Kodens standard `separate-hosts` används inte |
| `CROUPIER_STREAM_LANE` | sätts inte; fast i starten | Anslutnings-ID `lissabon-stream-lane`, som `ops/cloud/config.mjs` sätter för spelprocessen. Panelposten läses inte längre och tas bort ([listan](#att-ta-bort-i-panelen)) |
| `CROUPIER_STUDIO_NEON_POLICY`, `CROUPIER_MEDIA_STORAGE` | läses inte; fasta i koden | Neon och privat Blob är fasta ([Fasta värden](#fasta-värden)); panelposterna tas bort ([listan](#att-ta-bort-i-panelen)) |
| `CROUPIER_DATABASE` | läses inte | PostgreSQL är enda databasvägen och fast i koden. Panelposten tas bort ([listan](#att-ta-bort-i-panelen)) |
| `CROUPIER_GAME_DATABASE_URL` | krävs | Neon `croupier_game`; TLS `require`, `verify-ca` eller `verify-full` (produktionen `verify-full`) |
| `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID` | krävs | Samma register och scope som Vercel |
| `BLOB_READ_WRITE_TOKEN` | krävs | Privat Blob; ingen diskreserv. Saknad token stoppar starten (utom i underhållsexporten) |
| `CROUPIER_VERCEL_TRANSPORT_ORIGIN` | krävs | Motorns egen adress, `https://croupier-v3.onrender.com` |
| `CROUPIER_PUBLIC_ORIGIN`, `PUBLIC_URL` | krävs, lika | `https://www.scoutgaming.tech` |
| `CROUPIER_VERCEL_INGRESS_SECRET` | krävs | Samma som Vercel |
| `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN` | härleds | Sätts inte i `single-origin`; satta måste de vara lika med den publika originen. `CROUPIER_PUBLIC_GAME_PATH` läses inte: spelmotorns dokument är fast `/blackjack` |
| `CROUPIER_SHARED_TABLE_ENABLED` | villkorlig, `0`/`1` | Delat bord, se nästa avsnitt |
| `CROUPIER_PLAYER_ACCOUNTS` | valfri, `0`/`1` | Spelarkonton |
| `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | villkorlig, par | Director för spelchatt, genererat tal och kamera. Utan paret avvisas chatten som okonfigurerad; inspelade repliker behöver det inte. Halvt par nekar AI-tal och chatt; spelstart valideras separat |
| `CROUPIER_PRESENTATION_DIRECTOR_URL`, `CROUPIER_PRESENTATION_DIRECTOR_TOKEN` | valfri, par | Presentationsanslutning till Director |
| `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_SPEECH_TIMEOUT_MS` | valfri | Tidsgränser; `OPENCLAW_SPEECH_TIMEOUT_MS=20000` på både motorn och Director före adaptiv chatt |
| `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH` | villkorlig, båda `1` eller båda av | Genererat tal. Helfilstal utan streaming kräver stillbildstrion nedan |
| `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` | villkorlig, alla tre eller ingen | Stillbildstal (astrid-gpu-worker). Med streaming och ingen av dem är stillbildsvägen av: rörligt tal går, dealers med stillbildsprofil svarar med text (`generated_speech_still_not_configured`). Rörligt tal utan trion fungerar bara med ElevenLabs-röst; en Cartesia-röst kräver trion (annars `generated_speech_voice_not_configured`). Delvis satt nekar genererat tal; spelstart valideras separat |
| `CROUPIER_GENERATED_SPEECH_STREAMING` | villkorlig | Strömmat tal; kräver olika `CROUPIER_SPEECH_STREAM_WORKER_SECRET` och `CROUPIER_SPEECH_STREAM_TICKET_SECRET` (minst 32 tecken), `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD` (högst 10) och `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` (högst 20, minst reserven) |
| `CROUPIER_SPEECH_FULLFILE_RESERVE_USD` | villkorlig | Reserv för helfilstal utan streaming; räknas mot samma dygnstak |
| `CROUPIER_DEALER_SPEECH_PROFILES`, `ELEVENLABS_API_KEY` | villkorlig | Röstprofil per dealer; kräver streaming och Neon. Saknad röst ger fel, aldrig en annan dealers röst |
| `CROUPIER_SPEECH_STARTUP_DISABLED` | intern, supervisor → spelbarn | Sätts till `1` när valfri talkonfiguration är ogiltig. Nekar genererat tal utan reservröst/bank; spelstart kräver fortfarande giltig spelkonfiguration, databas och schema. Läsbar status i `/__cloud/shared-room-health`. Sätts aldrig i leverantörspanelen. |
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

`LAB_REMOTE_URL`, `LAB_REMOTE_TOKEN` och `BETTALOTTO_PARTNER_*` läses inte av spelmotorns start.

### Verifierad tal- och miljöstatus, 30 oktober 2026

Jakob har pausat Jakob-2:s genererade läppsynk. Detta är en avstämning och rensning, inte talaktivering.

- **Preview:** `scoutgaming-preview-engine` är live på `56e153b8` efter omdeployen 16:25 UTC. De tre `CROUPIER_SPEECH_STREAM_WORKER_SECRET`, `CROUPIER_SPEECH_STREAM_TICKET_SECRET` och `CROUPIER_MOVING_SPEECH_TICKET_SECRET` är olika, 64 tecken vardera och skiljer sig från produktionens. Generated/moving är av; streamingflaggan saknas. Behåll hemligheterna: de har olika konsumenter.
- **ElevenLabs:** previews nyckel är samma som produktionens och API-listan innehåller Jakob och ABYDM, inte Paow/Dragan. Det bekräftar inte överlämningens uppgift om byte till Kevins vanliga konto. Inga nycklar eller röstprofiler har bytts av avslutsgranskningen.
- **Workerautentisering:** `generated-speech-session.mjs` skickar aktuell worker-hemlighet som `input.ws_token` när en session begärs. Någon ny permanent kopia i RunPod/Vercel behövs inte för denna kodväg. Ticket-hemligheterna ligger kvar på respektive motor.
- **Callback:** mall `5dkkc3wolw`, kopplad till `zjsdlni6cn8dvo`, ändrades med Jakobs uttryckliga godkännande 16:46 UTC till `MOVING_CALLBACK_ORIGIN=https://croupier-v3.onrender.com`. Image och övrig env återlästes oförändrade. Previews separata mall ska använda previews origin; den här mallen ska inte återanvändas mellan miljöerna.
- **Rensat:** produktionens olästa `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` togs bort 16:50 UTC, 42 → 40 poster. Krypterad lokal återställningskopia finns i `.cache/closeout-20261030/`. Övriga värden är oförändrade; preview hade inte dessa namn.
- **Åtkomst:** produktionens stillbildspar `zsudl8tmzcmiv1` och rörliga par `zjsdlni6cn8dvo` gav autentiserad health 200, utan pågående eller köade jobb, 16:52 UTC. Lokal RunPod-nyckel når ett annat konto än produktionens movingnyckel; generell env-synk är fel.
- **Återstår före ny aktivering:** matchad bankkarta `CROUPIER_MOVING_SPEECH_BANK_RECORDS`, dealerprofil/endpoint och faktiskt uppspelningsprov. Rörligt tal är av även i produktionen. Health 200 är inget genererings- eller läppsynkskvitto.

## Delade Blackjackrum — avgränsad inkoppling

`CROUPIER_SHARED_TABLE_ENABLED=1` slår på delade bord i spelmotorn: Postgres, befintlig Studio-repository och scope, samma appägda pool och demoplånbok. Saknade schema 008/009/010 stoppar starten; starten installerar inget. Ursprung följer `CROUPIER_VERCEL_FRONTEND_ORIGIN` och `CROUPIER_PUBLIC_ORIGIN`/`PUBLIC_URL`; i enkel-origin-layouten godtas den publika originen (PR #442, `cc415cd8`). Rumsvägarna routas i `vercel.json` (`/shared-room/*`) och `platform-routing.mjs` (`/api/shared-room/*`).

**Regel:** produktionens `croupier-v3` kör `=1` sedan O03 (satt 2026-10-28 13:52Z, deploy `dep-dbgvsc5g1s2s73cdoqkg` på `5f5bc88d`), satt med Jakobs separata godkännande efter verifierad readiness; preview kör `=1` sedan 27 oktober 2026. Flaggan ändras aldrig som bieffekt av ett prov. F11:s överlapp/återanslutning är [driftverifierade på e8d0b935](plans/organisation/F11-DRIFTKVITTO.md); en kod- och schemakompatibel release har ingen generell F11-spärr med tomma bord. Flaggbyte och tillämpliga publicerings-/konfigurationsbyten kräver fortfarande tomma bord. Återgången (flaggan `0` och låst deploy) står i [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten). Kontrollera `/__cloud/health` efter varje ändring. `/__cloud/shared-room-health` är inte publikt nåbar (gatewayen svarar 421 utanför Vercel-ingressen, och Vercel routar inte `/__cloud/*`); bordet kontrolleras i stället med en spelad hand och loggarna (`shared_room_runtime_unavailable`).

## Driftväljarens API

<a id="driftvaljarens-api"></a>

Servern registrerar driftväljaren för rörligt tal bara med `CROUPIER_STUDIO_MOVING_DRIFT_API=1` och `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`: en JSON-array med 1–8 profiler, var och en med exakt `id`, `label`, `dealerId`, `endpointId`, `releaseDigest` och `bankHash`. En profil per dealer: `id`, `dealerId` och `endpointId` är unika, så två dealers delar aldrig endpoint. Admins API styr en dealer per anrop: Taldrift på dealerns sida skickar `?dealerId=` vid läsning och `dealerId` i skrivningen. Med en profil får dealern utelämnas; med flera ger ett anrop utan dealer 400 och en dealer utan profil 422. Admins katalog (`/admin/_data/catalog`, fältet `movingSpeech.dealerIds`) listar dealers vars profil har ett `bankHash` på 64 hex, utan endpoint eller hashar; bara de dealerna kan få "Begär AI-tal" med en rörlig referens under **Röst och tal** (motorn kontrollerar banken vid start). Fel eller saknad konfiguration ger stängt API (503) utan att påverka resten av Admin. Flaggan startar ingen provider; `connected:true` kräver en färsk executor i samma databas, annars tillåts bara Av.

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
| `OPENCLAW_SPEECH_ROUTING`, `OPENCLAW_SPEECH_DEEP_MODEL` | valfri | `adaptive` använder Luna för första svaret och tillåter högst en fördjupning med `gpt-6.1-sol` för alla dealerprofiler. Äldre uttryckliga `gpt-6-sol`-val stöds; kodens standard för routing är `fixed` |

`fixed` är även återställningsläget för en enda modellpassering. Adaptiv
JSON-transport kräver en fast JSON-instruktion i indata, eftersom den pinnade
Gatewayen flyttar systemtexten till Responses `instructions`.
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
| `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API` | valfri | `https://api.openai.com/v1`, `gpt-6.1-sol`, `openai-responses`. Gäller nya konfigurationer; en sparad `openclaw.json` behåller sina rollmodeller tills de byts i Admin. Resonemang ställs i den sparade agentkonfigurationen, se [OpenClaw-drift](AI/openclaw/DEPLOYMENT.md#modeller-och-resonemang) |
| `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH` | valfri | `18789`, `/data/openclaw`, `/data/openclaw/openclaw.json` |
| `OPENCLAW_DASHBOARD_ORIGIN` | valfri | Directors exakta HTTPS-origin utan `/openclaw` |
| `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK` | valfri | Bara lokalt |
| `CROUPIER_SPEECH_VISION` | valfri, sätts i panelen | Bildstöd i talet, opt-in; Blueprint deklarerar den med `sync: false` och värdet sätts i panelen |

## Preview: skillnader mot produktionen

Preview, den tidigare stagingen (se [START-HERE](../START-HERE.md#preview)), använder samma namn som produktionen men egna värden. Den behålls efter O03.

- **Vercel `scoutgaming-preview`:** egen `CROUPIER_GAME_DATABASE_URL` till `croupier_staging` med rollen `croupier_staging_app`, eget scope (`staging_k06_k07`/`croupier`), egen Blob-token till `store_7E06N1P4w9Mu1dZD`, egen ingresshemlighet och `CROUPIER_PUBLIC_ORIGIN=https://preview.scoutgaming.tech`. `CROUPIER_BACKEND_ORIGIN` pekar på previewmotorns oförändrade Render-adress. AI-bilder har eget API-värde och dagstak (20, mot produktionens 12). Håll hemligheter Sensitive och kontrollera databasidentiteten med readiness, inte en gammal panelräkning.
- **Render `scoutgaming-preview-engine`** (`srv-dbf61l0m7kps73ft7mk0`, hette `croupier-k06-k07-staging` till 2026-10-29; adressen `croupier-k06-k07-staging.onrender.com` är oförändrad): samma namn som `croupier-v3` med previews adresser och hemligheter, `CROUPIER_SHARED_TABLE_ENABLED=1`, AI- och talflaggor av (egna talhemligheter finns, generated/moving är av; namnen och ordningen för att slå på den med Kevins RunPod- och ElevenLabs-konton står i [TALKEDJA-RUNPOD](TALKEDJA-RUNPOD.md#aktivera)) och bootstrap-inloggningen borttagen.
- **Paow i preview (planerat, inte satt):** Render `scoutgaming-preview-engine` får `CROUPIER_MOVING_SPEECH_ENABLED=1`, `CROUPIER_MOVING_SPEECH_BANK_RECORDS={"paow":<manifest>}`, en driftprofil `paow` (egen endpoint i Kevins RunPod-konto, `releaseDigest` = `CROUPIER_MOVING_SPEECH_RELEASE_SHA256`, `bankHash` = bankarkivets SHA-256), `CROUPIER_MOVING_SPEECH_IMAGE` och `_RELEASE_SHA256` ur publiceringskvittot, `_WORKER_ORIGIN=https://croupier-k06-k07-staging.onrender.com`, `_RUNPOD_API_KEY` (Kevins konto), `_TICKET_SECRET`, `ELEVENLABS_API_KEY` (Kevins konto) och `CROUPIER_DEALER_SPEECH_PROFILES=1`, som `CROUPIER_MOVING_SPEECH_ENABLED=1` kräver och som i sin tur kräver streaming (`CROUPIER_GENERATED_SPEECH=1`, `CROUPIER_CLOUD_GENERATED_SPEECH=1`, `CROUPIER_GENERATED_SPEECH_STREAMING=1`; Neon är fast, `ops/cloud/config.mjs`). Vercel `scoutgaming-preview` får samma `CROUPIER_STUDIO_MOVING_DRIFT_API`/`_PROFILES`. Inga nya namn. Steg för steg: [PAOW-BANK-KORNING](PAOW-BANK-KORNING.md).
- Agenternas Admin-inloggning till preview ligger under `STAGING_ADMIN_LOGIN_UN` och `STAGING_ADMIN_LOGIN_PW` i gitignorerad `.env.local`. De är inga tjänstevariabler.

## Övriga poster i registret

| Registerpost | Namn | Status |
| --- | --- | --- |
| `github-actions-tooling` | `CROUPIER_GAME_DATABASE_URL` och `CROUPIER_PREVIEW_DATABASE_URL` (repository secrets), `CROUPIER_MIGRATION_CONFIRM` | Jobbet `migration-readiness` i `.github/workflows/croupier.yml` kör `tools/check-migration-readiness.mjs`. Vid push eller manuell körning på branchen `preview` och PR med bas `preview` läser det previews migreringsledger med `CROUPIER_PREVIEW_DATABASE_URL` (befintlig roll `croupier_staging_app`; själva kontrollen använder lästransaktioner), som stegen ger skriptet som `CROUPIER_GAME_DATABASE_URL`; saknas den secreten fallerar jobbet i stället för att läsa produktionen. Alla andra körningar läser produktionens ledger med `CROUPIER_GAME_DATABASE_URL`. Preview-secreten sätts i GitHub mot avsedd stagingdatabas; ett befintligt secret-namn bevisar inte rätt anslutningsmål. `CROUPIER_MIGRATION_CONFIRM=apply-pending` sätts bara i den terminal där Jakob kör `--apply`, aldrig i CI eller Vercel |
| `local-runtime-media-import` | `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`, `CROUPIER_GAME_DATABASE_URL`, `CROUPIER_RUNTIME_IMPORT_CONFIRM` | `ops/neon-studio/runtime-media-import-run.mjs` byter runtime-katalogen ([REN-START](plans/REN-START.md) steg 6–7). Scope krävs alltid; `prepare` läser ingen databas, `plan` läser och `apply` skriver bara när `CROUPIER_RUNTIME_IMPORT_CONFIRM` är den granskade planens `planHash`. Sätts bara i Jakobs terminal, aldrig i CI, Vercel eller Render |
| `local-republish-rooms` | `CROUPIER_GAME_DATABASE_URL`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`; `CROUPIER_REPUBLISH_CONFIRM` krävs vid `--apply` | `tools/republish-rooms.mjs` (L3 PR 4) publicerar om bolag vars aktuella paket saknar `rooms` (pkg+1; kräver Studio 023 och kolumnen). Standard är provkörning, även utan `--dry-run`. Skrivning kräver `--apply` och exakt `<databas>/<environment>/<workspace>` i `CROUPIER_REPUBLISH_CONFIRM`; kontrolleras mot läst mål. Sätts bara i Jakobs terminal för körningen, aldrig i CI, Vercel eller Render; ta bort bekräftelsen efteråt. Mål och ordning finns i [återställningsguiden](ENVIRONMENT-RESTORATION.md) |
| `render-gpu-relay` | `WORKER_SECRET`, `TICKET_SECRET`, `ALLOWED_ORIGINS`, `PORT` | Separat GPU-relä i `services/astrid-gpu-worker/gateway/server.mjs`; inte driftsatt |
| `runpod-gpu-worker` | `AVATAR_ID`, `NVIDIA_DRIVER_CAPABILITIES`, `NVENC`, `MOVING_CALLBACK_ORIGIN`, `MOVING_BANK_STORE` | GPU-workrarna på RunPod (`services/astrid-gpu-worker`, `services/moving-gpu-worker`); endpoint, nyckel och mallens miljö hanteras i RunPod och läses inte härifrån. `MOVING_CALLBACK_ORIGIN` måste vara spelmotorns exakta origin (`https://croupier-v3.onrender.com`, i preview `https://croupier-k06-k07-staging.onrender.com`, alltså en mall per miljö); mall `5dkkc3wolw` är rättad och återläst mot `croupier-v3` den 30 oktober 16:46 UTC. Endpoints i Kevins RunPod-konto med våra images: se [TALKEDJA-RUNPOD](TALKEDJA-RUNPOD.md) |
| `local-lab-openclaw` | Mallen `services/openclaw/lab/.env.example` | Lokala verktyg; ingen lokal produktstart läser den. Den inaktuella `apps/studio/.env.example` raderades 2026-10-29. `CROUPIER_ZONES_DATABASE_URL` (Zones-projektet är raderat) och namnen som bara den mallen listade togs samtidigt bort ur posten |
| `local-emil-provider-check` | `EMIL_RUNPOD_API_KEY`, `EMIL_RUNPOD_ENDPOINT_ID`, `EMIL_CARTESIA_API_KEY`, `EMIL_ELEVENLABS_API_KEY`, `EMIL_GEMINI_API_KEY` | `node tools/check-provider-profile.mjs --profile <scoutgaming\|emil> --env-file <fil>` läser bara den valda filen och nekar blandade par. `RUNPOD_ENDPOINT_ID` är inget alias |
| `vercel-zones-qa` | `CROUPIER_ZONES_*` | Historik: projektet `croupier-player-preview-qa` raderades 8 oktober 2026 |

`RENDER_API_KEY` i `.env.local` ger agenter läsning av Render-konfiguration via REST. Den används inte av produktkoden och står därför inte i registret.

## Databasidentiteter bakom adresserna

Produktionens `CROUPIER_GAME_DATABASE_URL` (Vercel, Render, GitHub-secret) ska peka på Neon `croupier-production` `wandering-hill-60561912`, branch `main` `br-flat-fog-b161a6r8`, endpoint `ep-fragrant-meadow-b1qzb0qv`, databas och roll `croupier_game`.

Previews ska peka på Neon `scoutgaming-preview` `red-violet-36066351`, branch `main` `br-plain-voice-b9yu49xi`, endpoint `ep-billowing-surf-b93x7p3c`, databas `croupier_staging`, roll `croupier_staging_app`. GitHub-secreten `CROUPIER_PREVIEW_DATABASE_URL` använder samma databas och approll; den rättades från `neondb` den 30 oktober efter verifierad readiness. Kontrollverktyget använder lästransaktioner, men approllen är inte i sig en begränsad läsroll; en separat CI-roll kräver ett eget behörighetsbeslut.

Sensitive-värden kan inte läsas tillbaka i Vercel. Verifiera därför readiness och tjänstens databasidentitet mot Neon-endpointen; ett gammalt ändringsdatum räcker inte. Backup- och restoregrenar har egna endpoints och ska aldrig vara tjänsternas mål. Kvarvarande kandidater för gallring finns i [återställningsguiden](ENVIRONMENT-RESTORATION.md#kvar-att-bedöma-för-gallring).

## Databasadresser i tester

Tester med injicerad pool eller schemafunktion använder `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`: adressen saknar inloggning och lösenordet skapas slumpmässigt vid körningen. `test/test-credential-fixtures.mjs` stoppar incheckade Neon-adresser med användare och lösenord i `test/` och `apps/studio/test/`. Lägg inte till scannerundantag för att dölja en sådan fixture.
