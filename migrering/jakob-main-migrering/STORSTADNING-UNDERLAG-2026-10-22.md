# Storstädning: nuläge, raderingskandidater och underagentuppdrag

Skrivet 22 oktober 2026 på Jakobs beställning. Detta är underlag för J05/J06/J09/J10
i [masterplanen](../MASTERPLAN.md), inte en ny statuskälla. Procent och VERIFIED
ägs fortsatt av `migrering/status.json`. Allt nedan är läst från `main`
(`7afae426`, lika med `origin/main`), GitHub-API och den lokala disken.

## Jakobs riktning som underlaget bygger på

- Publika ytor: `scoutgaming.tech/admin`, `/partner`, `/lobby`. Lobbyn leder till
  blackjack eller roulette (ett roulettespel). Spelet startas enbart via `/game`
  med parametrar i URL:en.
- Inga lokala SQLite-filer, ingen lokal backoffice, inga dubblerade ytor och
  inget från Kevin-legacy i produktvägen. Neon är register, Blob är media.
- Render `croupier-v2` ska bara köra spelmotorn. OpenClaw Director/Gateway är
  egna Render-tjänster.
- Kevins kvarvarande aktiviteter (K04–K07) behöver hans grenar som
  portningskälla tills O03 är verifierad. Stäng skrivvägen till `main`,
  radera inte källan.

## Nuläge i siffror (verifierat 22 oktober)

| Mått | Värde |
| --- | --- |
| Spårade filer på `main` | 3 221 filer, 375 MB (git ls-tree) |
| `.git` | 2,4 GB; packad historik 2,36 GiB |
| Råa blobbytes i hela historiken | ca 3,2 GB; ca 1,4 GB nås från `main`, ca 1,5 GB nås bara via Kevins grenar |
| Historik från `main` per utdöd rot | `media/` 755 MB, `docs/` 260 MB, `emil/` 61 MB, `lab/` 54 MB, `web/` 48 MB, `assets/` 20 MB, `content/` 18 MB |
| Historik från `main` per filtyp | mp4 469 MB, md 259 MB, json 134 MB, mjs 133 MB, glb 126 MB, h264 113 MB, png 97 MB |
| Ospårat på disk | `arkiv/` 927 MB, `lab/` 796 MB (bara `lab/data/`), `open-claw/` 88 KB |
| node_modules | `apps/studio` 428 MB, `apps/studio/client` 141 MB, `services/game` 11 MB |
| SQLite-filer på disk | 17 st, alla under `lab/data/` eller `arkiv/`, ingen spårad |
| SQLite i npm-beroenden | 0; koden använder Nodes inbyggda `node:sqlite` |
| Grenar | 50 lokala, 52 på origin; 17 av origins är redan mergade i `main` |
| Worktrees | 12 (varav 3 låsta) under `C:/Users/jakem/.codex/worktrees` och scratchpad |

`lab/`, `open-claw/` och `arkiv/` finns inte på `origin/main`. Jakobs minne stämmer.

## Vad som återstår av migreringen

Den tekniska Neon-/Blob-flytten är klar i produktion enligt
[CLOUD-MIGRATION](../../docs/CLOUD-MIGRATION.md). Det som återstår är
masterplanens produkt- och städarbete: 9/20 VERIFIED (45 %). Jakobs
"storstädning" är redan beställd som fyra aktiviteter, men saknar två beslut.

| Aktivitet | Status | Vad Jakobs beställning tillför |
| --- | --- | --- |
| J05 Förenkla runtime och byggkedja | IN_PROGRESS | Beslutet "Render = enbart spelmotor". Idag bygger `ops/cloud/Dockerfile` Studio och `ops/cloud/config.mjs` startar två barn: `services/game/server.mjs` på port 4173 och `next start` för `apps/studio` på 4188 bakom `gateway.mjs`. |
| J06 Rensa testlås och rikta CI | IN_PROGRESS | Radera tester för avvecklade funktioner (lista nedan), inte `test/` som helhet. |
| J08 Admin styr versionerad spelkonfiguration | IN_PROGRESS | Oförändrad. |
| K04 Spelklient från händelser, K05 exakt mediakoppling | IN_PROGRESS | Avgör om `card-presentation/` och Astrid-klientmodulerna ersätts. |
| J09 Avveckla oanvända databaskontrakt | TODO | Oförändrad; bo-/craig-tabeller blir kandidater när `/bo` är borta. |
| K06, K07 | TODO | Kevins verifieringar; kräver hans grenar och fixtures. |
| J10 Ren klon, start och återställning | TODO | Här hör Git-historikbantning och branch-/worktreestädning hemma. |
| O02, O03 | TODO | Slutgrind. |

Två saker finns inte i planen och behöver läggas till i J05 (inte som nya trackers):

1. **Ytbeslutet:** `/game` blir enda spelstart. Lobbyn länkar idag
   `/play/{game}?operator=&table=` (`apps/studio/client/lobby/lib/catalog.mjs:86`);
   `packages/navigation/game-entry.mjs` behandlar redan `/game` som kanonisk
   adress med parametrarna `dealer, presentation, lane, rehearsal, table, launch`.
   `apps/web` serverar samma speldokument på `/game`, `/blackjack`, `/v2`,
   `/play/blackjack`, `/player-login` och `/bo/*`. `apps/web/lib/game-url.ts`
   pekar som standard på `croupier-v2.onrender.com/blackjack?dealer=astrid`.
2. **Astrid-GPU-imagen:** se avsnittet om talstacken.

## Mapp för mapp: vad det är och vad som gäller

Bedömning: RADERA = inga aktiva konsumenter hittade, FLYTTA = aktiv kod med
missvisande plats/namn, BEHÅLL = aktiv, UTRED = underagent avgör med konsumentkarta.

| Mapp | Fynd | Bedömning |
| --- | --- | --- |
| `lab/` (rot, ospårad) | Endast `lab/data/`: `players/croupier.db` + `craig.db`, `qa-*-20260921`, `voice-cache`, `voice-previews`, `platform-private/*` (gamla QA-körningar och backuper), `social-history`, `observations`, `v5-publish`. Skrivs fortfarande av `apps/studio/lib/voice-preview.mjs`, `apps/studio/lib/social-store.mjs`, `services/game/native-ai-qa-*.mjs`, `tools/activate-native-ai-qa.mjs`. | RADERA lokalt. Underagent F stänger skrivarna så mappen inte återuppstår. |
| `open-claw/` (ospårad) | Gammal OpenClaw-stateroot före flytten till `services/openclaw`. | RADERA lokalt. |
| `arkiv/` (ignorerad) | Kanonisk lokal återställningsplats enligt AGENTS.md. Innehåller bl.a. en `.venv` med numpy och gamla worktree-kopior. | Jakobs beslut; följ `tools/retention-policy.json`. Flytta ut ur checkouten eller behåll två senaste datum. |
| `services/game/node_modules` | Lokal `npm ci`-installation, ignorerad. Inte ett städobjekt; tas bort = spelservern startar inte lokalt. | BEHÅLL (ingen Git-effekt). |
| `test/` (474 spårade) | 270 sviter + 204 fixtures. 161 fixtures är `astrid-select-baseline` (används av `test/presentation-select-astrid-baseline.mjs` och `tools/astrid-select-baseline.mjs`). 11 är `kevin-5aa7ed1` (används av `blackjack-core`, `blackjack-presentation`, `postgres-k04-flow`, dvs. K02/K04). Allt körs i CI via `.githooks/pre-commit-full`. | Inte RADERA som helhet: slutgrinden `CI` är rulesetets enda krav på `main`, och auth-, wallet-, rums- och spelregelproven är det som hindrar fel från att nå produktion. J06 raderar per avvecklad funktion. |
| `services/game/public/bo/` | `emails/*.html` (statiska skisser; Studio läser mallar från `packages/shared/email-templates.mjs`), `generations.json` (servern svarar 410), `speech-qa.html/.mjs` (behörighetsstyrd tal-QA). `/bo` omdirigeras redan till `/admin`. | RADERA `emails/` och `generations.json`. `speech-qa` UTRED. Serverdelen `bo-*.mjs` och CRAIG-handoff tillhör J05 A. |
| `services/game/public/card-presentation/` | Aktiv kortprojektion; `app.mjs` importerar `renderer-support.js`, `local-card-overlay.mjs` är adaptern. | BEHÅLL tills K04:s trelagersruntime bevisat ersätter den. |
| `services/game/public/lab/` | Fristående gammal lipsync-pilot (`index.html`, `astrid-pilot.track.json`). | RADERA efter grep på `astrid-pilot.track.json`. |
| `services/game/public/docs/` | `partner-api.md/.html`. | FLYTTA till `docs/games/` eller RADERA html-kopian. |
| `services/game/public/roulette-test/` + `games/roulette/preview.mjs` + `server.mjs:767` + `test/roulette-preview.mjs` + `tools/roulette-ui-fixture.mjs`, `tools/roulette-scene-fixture.mjs` | Det andra roulettespelet: en separat förhandsvisning med egen serverhanterare och SQLite-fixture. | RADERA som en enhet. `public/roulette/` och `games/roulette/` är spelet. |
| `services/game/public/astrid-camera-*.mjs`, `astrid-wake-word.mjs`, `astrid-voice-*.css`, `services/game/astrid-transcription.mjs` | Kamera/transkription. `--astrid-camera` är pensionerad enligt README; `CROUPIER_ASTRID_CAMERA` är opt-in av. `app.mjs` importerar fortfarande `createAstridCameraControl`. 7 tester i gruppen `speech/astrid-camera`. | UTRED, troligen RADERA med flagga, import och tester. |
| `services/game/public/astrid-green-*.mjs`, `astrid-folded-rest.mjs`, `astrid-idle-scheduler.mjs`, `astrid-speech-join.mjs` | Astrids green-screen-presentation; `clip-mapping.mjs` refererar `astrid-green`. | UTRED mot lobbyns dealerutbud. Astrid är märkt legacyreferens; media bevaras i Blob, implementationer behöver inte bevaras. |
| `services/game/public/lissabon-profile.mjs`, `services/game/lissabon-profiles.mjs` | Lokal gästprofil; inaktiv i Postgres-läge. Flaggvärdet `lissabon-stream-lane` krävs av `ops/cloud/config.mjs`. | RADERA modulerna; byt flaggvärdet samordnat. |
| `apps/studio/components/kevin-bo/` (26) | **Är partnerportalens UI**: `PartnerOperatorWorkspace`, `views/rooms`, `views/team`, `views/integration`, `views/overview`, `partner-copy`, navigationsvakt. Importeras av `partner-workspace.tsx`, `partner-session-actions.tsx`, `workspace-surface-page.tsx`. | BEHÅLL. Högst FLYTTA till `apps/studio/components/partner/` för namnets skull. |
| `test/fixtures/kevin-5aa7ed1/` | Frysta Kevin-fixtures för K02/K04-kontraktstest. | BEHÅLL till K07/O03. |
| `migrering/kevin-ks-migrering/` | K01-inventering med `verify-audit-chain.mjs` (`node:sqlite`, läser Kevins `demo.sqlite`). | BEHÅLL till O03, därefter arkiv. |
| `apps/web/app/*` | `/game`, `/blackjack`, `/v2`, `/play/blackjack`, `/player-login`, `/bo/[[...path]]` = samma speldokument. `/play`, `/casino.html`, `/demo` = redirect till lobby. `/labb-lissabon` = redirect till Render `/studio`. `next.config.mjs` omdirigerar `/lab`, `/labb`, `/studio-astrid`, `/studio-lissabon` till `/control`. | RADERA alla utom `/`, `/about`, `/game`; behåll `/play/*` som 308 till `/game` en release. |
| `vercel.json` | Routar fortfarande `/control/*` till Studio. | RADERA routen när J03:s redirects är verifierade. |
| `services/astrid-gpu-worker/gateway/` | Aktiv taltransport: importeras av `services/game/dealer-speech-runtime.mjs`, `generated-speech-stream.mjs`, `moving-speech-runtime.mjs`, `moving-speech-transport.mjs`, `shared-room-upgrade.mjs`, `speech-journal-runtime.mjs` och levererar `ws`-paketet till delat bord (K03/J07). | FLYTTA till `packages/speech-transport/`. |
| `services/astrid-gpu-worker/` (resten) | RunPod-worker med MuseTalk 1.5 på Astrids stillbild (`handler.py`, `workers/`, `assets/` inkl. 5,9 MB yuv, `Dockerfile`, `fetch/`, `tests/`, `tools/`, `docs/`). Dragan använder `services/moving-gpu-worker/`. CI kör Python-testerna på varje PR; två manuella workflows bygger/publicerar imagen. | UTRED, RADERA när Jakob bekräftar att Astrids fullfilstal är dött. Berör `speech-journal-runtime.mjs` (fullfile-budget), `generated-speech-*` (icke-strömmande väg), env-nycklar, `croupier.yml` steg `lipsync_contracts`, `.github/workflows/astrid-gpu-*.yml`. |
| `services/moving-gpu-worker/` | Dragans rörliga tal; separat image. | BEHÅLL. |
| `ops/cloud/` (34) | Render-startaren: `gateway.mjs` värdroutning, `lab-session-check`, `storage-export` (SQLite), `qa-stream-transport-*`, `vercel-ingress`. Krymper kraftigt när Render = spelmotor. | J05 A avgör fil för fil. |
| `media/` (736 spårade, 17 MB) | 442 under `dealers/astrid/staging`, 260 under `dealers/astrid/runtime`; `layout.json`, `blob-index.json`, `catalog/` är authoring-/importkällor som Docker utesluter. CI kör `build-lab-video-manifest.mjs --check` och `build-runtime-media-catalog.mjs --check` mot dem. 278 MB på disk kommer från ignorerade `media/.migration/`. | UTRED (G): `staging/` kan sannolikt lämna Git efter Blob-återläsning; manifest och JSON stannar. |
| `apps/web/public`, `apps/studio/client/lobby/public` (68 MB) | Publika sajtvideor/bilder (Astrid-intro, dealerporträtt, hero). | BEHÅLL; valfri flytt till Blob senare. |
| `docs/` (rot, 49) | Kanoniska dokument som CLAUDE.md pekar på. `JOHN-HANDOFF.md` är 160 KB. | BEHÅLL. Arkivera `docs/AI/openclaw/ASTRID-CAMERA-VOICE-PLAN.md`, `SLACK-ASTRID-SETUP-SV.md`, `docs/AI/lipsync-lokalt-2026-10-17.txt`, `docs/qa/*.json`, rotens `DRAGAN-TAL-FORKLARING-2026-10-19.txt`. |
| `tools/` | Engångsverktyg som är förbrukade efter flytten: `migrate-sqlite-postgres.mjs`, `migrate-lab-state.mjs`, `migrate-media-layout.mjs`, `start-local-comparison.mjs`, `start-lab-session.mjs`, `probe-qa.mjs`, `probe-model-eval.mjs`, `backup-render-state.mjs`, `push-work-mirrors.mjs` (GitLab pausat), `elevenlabs-lab-preview.mjs`. | UTRED-lista för E/F. Uppdatering 26 oktober: den oanvända JSON-exportören `postgres-backup-restore.mjs` avvecklas för PostgreSQLs fullbackup-/restoreväg; `raderingsgrind.mjs` och `check-orphan-tests.mjs` behålls. |
| `services/openclaw/lab/deploy/` (30) | Blandar Render-imagefiler med lokala `local-connection.mjs`, `local-session.mjs`, `companion-search-server.mjs` (alla `node:sqlite`). | UTRED: dela Render-image från lokal utveckling. |
| `packages/director/node/companion-store.mjs` | `companion.sqlite` på Directors Render-disk `/data/catalog`. OpenClaws eget tillstånd, inte produktregister. | BEHÅLL, låg prioritet. |
| `.gitignore` | Skyddsregler för rötter som inte längre finns (`/web/data/`, `/lab/...`, `/open-claw/...`, `/random-stuff-jakob/...`). | RADERA reglerna när mapparna är borta lokalt. |
| Rotens `.env.local`, `.env.emil`, `.env.dragan-*.local`, `inbox-token.txt` | Hemligheter utanför Git men i arbetsytan. | Kopiera privat före ren klon; de följer inte med. |

## Render `croupier-v2`: vad som faktiskt körs

Byggkontext är reporoten. Dockerfilen installerar `services/astrid-gpu-worker/gateway`,
`services/game` och `apps/studio`, bygger Studio med basePath `/studio`, och
`container-entry.mjs` startar via `start.mjs --start` ett `gateway.mjs` på publik port
med två loopback-barn: spelservern och en Next-process för Studio. Spelservern
har dessutom `/bo`-redirects, CRAIG-handoff, `/roulette-test`, `/studio-preview`,
Lissabon-profiler och `node:sqlite`-fallback (inaktiv i Postgres-läge, men kvar i
koden). OpenClaw Director och Gateway är redan separata Render-tjänster från
`services/openclaw/lab/render.yaml` med auto-deploy av.

Mål för J05: Render startar `services/game/server.mjs` direkt, Studio finns bara på
Vercel, `ops/cloud` krymper till konfiguration, hälsa och graceful shutdown.
Innan dess måste Studio-API:er som Vercel idag proxar mot Render (`LAB_API`-mönstret i
`packages/navigation/server/platform-routing.mjs`) kartläggas; det är J05:s första punkt.

## Kevin, `main` och GitHub-åtkomst

Läst 22 oktober via GitHub-API:

- Collaborators med push: `Jakeminator123` (admin), `EmaCodeHero` (Emil),
  `Johncleochile` (John), `invoicesolv` (Kevins sida; 24 commits på `main`
  21–22 oktober via PR #314 och #339, mergade av Jakob). `ImpactPL` (227 commits
  t.o.m. 20 september) är inte längre collaborator. `inbox/people.json` har
  Kevins GitHub som `null`; ingen inbjudan väntar.
- Ruleset `main: pull requests only`: PR krävs, statuscheck `CI` krävs, ingen
  force-push eller radering, admin kan kringgå. **Noll godkännanden krävs.** Varje
  collaborator kan därför öppna en PR från sin gren och merga den själv när CI är grön.
- `vercel.json` deployar `main` automatiskt och Render bygger `main` efter grön CI.
  En självmergad PR går alltså direkt till produktion.
- Ruleset `Long-lived team branches` skyddar `kevin`, `kevin-*`, `john*`, `emil*`,
  `jakob-gren`, `jakob-export`, `roulette-on-kevin-staging` mot radering.
- Ingen `CODEOWNERS` finns.

Åtgärd som stänger skrivvägen utan att ta bort portningskällan (Jakob utför i
GitHub-inställningarna, inte agenten):

1. Lägg `.github/CODEOWNERS` med `* @Jakeminator123`.
2. Ändra rulesetet: `required_approving_review_count: 1`,
   `require_code_owner_review: true`, `require_last_push_approval: true`.
3. Behåll push för Kevins konton så `kevin-*` kan pushas; valfritt ett ruleset
   som begränsar vilka grenmönster andra än admin får skapa.

Kevins kod på `main` idag: 79 egna commits och 227 från `ImpactPL` från
perioden 22 augusti–20 september när allt låg i en kodbas (BO-generationer,
3D-golv, assets). Filerna är sedan omstrukturerade av Jakob. Det som är kvar
med hans namn är partnerportalens komponenter (`kevin-bo`, aktiva), K02/K03-
portarna (VERIFIED, i Jakobs adaptrar) och 11 frysta fixtures. Mappen
`kevin/` finns inte i `main`:s träd. Skadan på `main`:s kod är låg; kostnaden
ligger i 1,5 GB historik som bara nås via hans grenar och i antalet grenar.

`kevin-staging` är en fristående app `kevin/croupier-scoutgg` (1 126 MB varav
1 098 MB media i `public/`, 54 testfiler, tre SQLite-databaser, gästcookie som
spelaridentitet, `BEGIN IMMEDIATE` per kommando utan `busy_timeout`, global
tick 250 ms, en process, ingen Postgres, ingen operatörs-/adminmodell).
K01-matrisen klassar merparten av serverdelarna som D (släpp) eller M (main
vinner) och portar regelkärna, auditkedja, rumsstate och timers. Som bas för en
plattform hade den krävt att allt main redan har (Neon, Blob, auth, wallet med
`NUMERIC`, advisory locks, operatörer, partner, admin, CI) byggts om från noll.

## Git-historik, media och klon

- Historik från `main` innehåller ca 820 MB binärer (mp4, glb, h264, png, mp3,
  yuv, jpg) och ca 220 MB utdöda rötter. Därutöver 1,5 GB bara via Kevins grenar.
- `git filter-repo` finns lokalt. En omskrivning av `main` ger ingen storleksvinst
  så länge `kevin*`, `jakob-gren`, `emil`, `john` pekar på samma historik, och
  rulesetet hindrar radering av dem. Ordning: arkivera grenarna till ett separat
  repo (`scoutgaming-kevin-archive`) efter O03, ta bort dem från huvudrepot,
  kör `filter-repo` på `main` (bort med `media/**`-binärer, `emil/`, `lab/`, `web/`,
  `assets/`, `content/`, `kevin/`), och låt alla klona om. Förväntad pack: under 300 MB.
  Detta hör till J10, inte nu: 12 worktrees och öppna PR:er måste först vara stängda.
- Omedelbar lättnad utan omskrivning: `git clone --filter=blob:none
  git@github.com:Jakeminator123/scoutgaming.git` ger en ren arbetskopia på
  minuter. `lab/`, `arkiv/`, `.env*` följer inte med; kopiera `.env*` privat.
  Behåll den gamla checkouten tills `.codex/worktrees` är avvecklade; de
  delar dess `.git`.
- Avignorera inte `lab/data` eller SQLite i `.gitignore`: ignoreringsfiler är
  inte behörigheter, agenten ser filerna ändå, och ett avignorerat `lab/data`
  skulle lägga 796 MB i indexet.

## Underagentuppdrag

Alla uppdrag börjar med en läsande konsumentkarta (route, UI, tjänst, adapter,
data, build, test, doc) och slutar med en raderingslista per fil, med
`node tools/raderingsgrind.mjs <bas> --strict` som grind. Ingen DDL, deploy,
flaggaktivering eller radering av andras grenar. Varje agent arbetar i egen
worktree med avgränsade filer.

| Uppdrag | Filer och frågor | Leverans |
| --- | --- | --- |
| **A. Render = spelmotor (J05)** | `ops/cloud/**`, `services/game/server.mjs` (bo-, lab-, lissabon-, roulette-test-, studio-preview-grenar), `packages/navigation/server/platform-routing.mjs`, `packages/server-transport/configuration.mjs`. Vilka Studio-API:er svarar Render på idag? Vilka env-nycklar och `node:sqlite`-vägar försvinner? | Före/efter-karta över processer och routes; PR som startar enbart spelservern. |
| **B. Spelklientens legacy** | `services/game/public/**`: astrid-camera/wake-word/transcription, astrid-green/folded-rest/idle-scheduler/speech-join, `lab/`, `docs/`, `bo/`, `roulette-test/`, `lissabon-profile`, `dealer-version-switcher`, `rigged-review`, `calibrate`. Verifiera att `card-presentation/`, `vendor/three/`, `shared-room-*` och `layered-presentation` stannar. | Raderingslista + tester som följer med; grönt `gameplay`- och `speech`-spår. |
| **C. Ytor och URL:er** | `apps/web/app/**`, `apps/web/lib/game-url.ts`, `apps/web/next.config.mjs`, `vercel.json`, `packages/navigation/*.mjs`, `apps/studio/client/lobby/lib/catalog.mjs`. Gör `/game?game=&operator=&table=` kanonisk; `/play/*` blir 308; ta bort `/v2`, `/bo`, `/blackjack`, `/player-login`, `/casino.html`, `/labb-lissabon`, `/demo`, `/control`-route. | Routekarta före/efter; lobby till `/game` verifierat i isolerad miljö. |
| **D. Talstacken** | `services/astrid-gpu-worker/**`, `services/moving-gpu-worker/**`, `services/game/{dealer,generated,moving}-speech-*.mjs`, `speech-journal-runtime.mjs`, `apps/speech/**`, `apps/web/api/platform-*.mjs`, `.github/workflows/*gpu*`, `croupier.yml`. Flytta `gateway/` till `packages/speech-transport/`; inventera Astrid-imagens konsumenter. | Flytt-PR; avvecklingsplan för Astrid-imagen med exakta filer, flaggor och CI-steg. |
| **E. Tester och CI (J06)** | `test/**`, `apps/studio/test/**`, `apps/web/test/**`, `ops/cloud/test/**`, `.githooks/pre-commit-full`, `.github/workflows/croupier.yml`, `tools/ci-changes.mjs`, `tools/orphan-tests-exceptions.json`. Klassa varje svit mot aktivt beteende; ta B/C/D:s listor som indata. Avgör `astrid-select-baseline` (161 filer). | Testurvalsmatris; raderings-PR; mätning före/efter. |
| **F. Lokal state och ignores** | `lab/`, `open-claw/`, `arkiv/`, `media/.migration/`, rotens `.env*`, `.gitignore`, skrivarna `apps/studio/lib/voice-preview.mjs`, `apps/studio/lib/social-store.mjs`, `services/game/native-ai-qa-*.mjs`, `tools/activate-native-ai-qa.mjs`, `tools/*migrate*`, `tools/start-*`, `tools/probe-*`. | Säker lokal raderingslista; PR som tar bort lokala skrivare och förbrukade verktyg. |
| **G. Spårad media** | `media/**`, `tools/media/**`, `tools/build-runtime-media-catalog.mjs`, `.gitattributes`, CI-stegen `build-lab-video-manifest --check` och `build-runtime-media-catalog --check`. Kan `dealers/astrid/staging` lämna Git efter Blob-återläsning? Vad behöver `layout.json`, `blob-index.json`, `catalog/` lokalt? | Beslutsunderlag med hashkvitton; eventuell PR efter K05. |
| **H. Git-hygien och åtkomst** | Branch-triage (17 mergade origin-grenar, lokala mergade), worktree-avveckling, `CODEOWNERS` + rulesetändring, arkivstrategi för Kevin-grenar, `filter-repo`-plan med storleksmätning. | Städlista för Jakob; inga raderingar av andras grenar utan hans explicita val. |

Ordning: A och C först (beslut om ytor och Render styr resten), B och D
parallellt, E när B/C/D har listor, F när som helst (lokalt), G efter K05,
H:s ruleset nu och resten sist i J10.

## Varningssignaler

1. `main` auto-deployar till Vercel och Render; rulesetet kräver noll godkännanden.
2. `apps/studio/components/kevin-bo` är `/partner`, inte legacy.
3. `services/astrid-gpu-worker/gateway` är den levande taltransporten och
   `ws`-leverantör till delat bord.
4. `services/game/public/card-presentation` är aktiv kortprojektion.
5. Att radera `test/` gör CI-grinden tom: PR:er blir gröna utan att något bevisas.
6. Tre worktrees är låsta och två ligger i en Claude-scratchpad; kontrollera
   ägare före `git worktree remove`.
7. `arkiv/` innehåller en Python-`.venv`; räkna inte in den i repots storlek.
8. Rotens `.env*` och `inbox-token.txt` finns bara i denna checkout.
