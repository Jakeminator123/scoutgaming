# Baslinje · main `00ea55c5` · 2026-10-12

Frysta fakta som aktiviteterna jämför mot i steg 0. Mät om med verktygen i
`ordning/verktyg/` från repo-roten. Storlekar är blobstorlek i Git-trädet
(MiB), inte disk eller `.git`.

## 1. Repo och leverans

| Mått | Värde | Källa / kommando |
| --- | --- | --- |
| Bas | `00ea55c5` "Record completed media history cleanup and recovery checkpoint" | `git log -1 origin/main` |
| Spårade filer | 4 412 filer · 790,18 MB | `node ordning/verktyg/tree-sizes.mjs "" 1` |
| Lokal `.git` | 1,61 GB (var 4,66 GB före historikrensningen 2026-10-12) | `docs/JOHN-HANDOFF.md` överst |
| GitHub-regel på `main` | "main: pull requests only" (id 24642403): PR krävs, 0 godkännanden, merge/squash, ingen radering, ingen force-push; admin får kringgå | `gh api repos/Jakeminator123/scoutgaming/rulesets/24642403` |
| Övriga brancher | Inget skydd | `gh api repos/Jakeminator123/scoutgaming/branches` |
| Lokal pre-push | `tools/check-push-target.mjs`: bara `refs/heads/main`, fast-forward, systemkartekontroll per commit | `.githooks/pre-push` |
| Feature-branch-push hittills | `git push --no-verify` efter manuell `node docs/system-map/verify.mjs --check` (PR #15, #17) | tidigare chatt |
| CI | `.github/workflows/croupier.yml` på push till `main` och PR mot `main` | workflow `on:` |
| Pre-commit | Full svit (`.githooks/pre-commit-full`) om något annat än dokumentlistan i `tools/precommit-checks.mjs` stagas | `node tools/precommit-checks.mjs --plan` |
| Testfiler | 359 · 0 föräldralösa · 2 undantag | `node tools/check-orphan-tests.mjs` |
| Systemkarta | gul · 0 röda · 14 gula kontrakt · 165 varningar | `node docs/system-map/verify.mjs --check` |
| GitGuardian | 0 öppna · 17 ignorerade · kontroll för `00ea55c5` i kö · historisk skanning `too_large` | `node tools/security-status.mjs` |

### Brancher och worktrees

| Remote branch | Före / efter main | Läge |
| --- | --- | --- |
| `kevin` | 113 före / 83 efter | Separat app `kevin/croupier-scoutgg/`, egen deploy croupier.scoutgg.dev; inkorg #10 |
| `john` | 1 / 62 | Johns gren |
| `emil` | 0 / 178 | Helt innehållen i main |
| `jakob-export` | 78 / 83 | Okänt syfte, egna commits |
| `jakob/dealer-forge` | PR #16 öppen | Aktiv agent `dealer-forge` |
| `jakob/shoe-transition-slots` | PR #17 mergad | Kan raderas |
| `codex/dealer-desktop-framing` | PR #14 mergad | Kan raderas |
| `codex/john-n2-admin-partners` | PR #12 mergad | Kan raderas |

Lokala worktrees utöver huvudcheckouten: `.codex/worktrees/{180a (detached), 8e3c (test-video-jakob, remote raderad), d5ed (codex/dealer-desktop-framing), e37e (detached)}`,
`.cursor/worktrees/croupier/{dealer-forge (8 ändrade poster), shoe-transitions}` samt `repo-ordning` (denna plan).

## 2. Storlek per område

| Område | MB | Filer |
| --- | ---: | ---: |
| `media/` | 731,74 | 2 455 |
| `apps/` | 21,13 | 129 |
| `test-videoeditor/` | 11,78 | 51 |
| `services/` | 8,22 | 44 |
| `lab/` | 7,59 | 721 |
| `web/` | 3,42 | 247 |
| `test/` | 2,33 | 355 |
| `docs/` | 1,37 | 17 |
| `open-claw/` | 0,74 | 83 |
| `pipeline/` | 0,63 | 116 |
| `ops/` · `tools/` · `random/` · `presentation-runtime/` · `planes/` | 0,37 · 0,32 · 0,32 · 0,06 · 0,05 | 62 · 40 · 30 · 14 · 9 |

### Media (urval)

| Sökväg | MB | Filer | Kommentar |
| --- | ---: | ---: | --- |
| `media/dealers/astrid/runtime/indexed/` | 213,69 | 267 | performance 100,4 · rig 62,0 · streams 20,7 · actor 13,2 · scene/table-png 10,6 · speech 3,8 |
| `media/dealers/astrid/runtime/presentation/` | 165,93 | 83 | idle 77,7 · deal 68,8 · repliker 17,8 (aktuell lokal Astrid-presentation) |
| `media/dealers/astrid/runtime/composited/` | 80,67 | 189 | green-speak 31,5 · seam-repair 22,9 · 2026-09-09 7,7 · table-v2 4,6 … |
| `media/dealers/astrid/runtime/assets/` | 41,43 | 5 | `astrid-collection-sweep.glb` 38,5 |
| `media/dealers/astrid/source/3d/` | 23,01 | 26 | tre `motion-samples.json` 23,0 |
| `media/dealers/{amira,vera,mei}/runtime/indexed/` | 41,9 · 48,4 · 36,9 | 108 · 178 · 102 | |
| `media/dealers/amira/runtime/composited/` | 10,36 | 62 | |
| `media/game/runtime/assets/` | 32,98 | 12 | `casino-floor.glb` 17,5 · `table.png` 6,6 · `blackjack-3d/blackjack-table.glb` 4,4 · `player.glb` 2,2 |
| Staging (`media/game/staging`, `media/dealers/{astrid,amira}/staging`) | 9,11 · 6,04 · 0,32 | 852 · 452 · 37 | 181 Markdown-QA-anteckningar |
| Register `layout.json` · `blob-index.json` · `catalog/legacy.json` · `catalog/presentation.json` | 0,93 · 1,35 · 0,72 · 0,02 | 4 | Behålls (molnläge och katalog) |

Render-imagen byggs med `ops/cloud/Dockerfile` (`COPY . .`). `.dockerignore`
utesluter `media/**/source`, `media/**/staging`, `media/**/review` och `docs`,
men **all `media/**/runtime` bakas in i spelmotorns image**.

## 3. Kod och beroenden

| Mätning | Resultat | Kommando |
| --- | --- | --- |
| `web/public` (122 spårade källfiler inklusive 5 granskningssidor) | 95 produkt · 12 bara granskningssidor · 11 bara test · 2 bara pipeline · 2 ingen | `node ordning/verktyg/public-reach.mjs` (första mätningen exkluderade `review/` och gav 117 filer: 95/13/6/3) |
| Bara granskningssidor | `review/2026-09-09/{index.html,contact.html,contact.mjs}`, `review/amira-composite/{index.html,review.mjs}`, samt actor-composite-scene, animation-clock, blender-card-layout, blender-table-details, blender-table-scene, dealing-card och movement-cues | samma |
| Bara test | blackjack-asset-state, bo/media-preview, dealer-collection, dealer-face, dealer-motion, dealer-rig, ready-motion, rigged-card-layout, rigged-discard-state, rigged-face-playback, shoe-contact-occlusion | samma |
| Bara pipeline | astrid-folded-rest, astrid-idle-scheduler | samma |
| Ingen | dealer-studio.css, table-scene.mjs | samma |
| Produkt men inte från HTML | dealer-engine, speech-playback, astrid-green-dealer, astrid-green-speak m.fl. (nås via Studio-serverns originalmedia) | samma, längre utdata |
| Codex kontrollmätning | 90 publika moduler, 56 nås från produktions- eller lokala ingångar, 34 utanför den konservativa grafen | Codex `remaining-modules.json` (extern) |
| Studio `lab/{components,lib,app}` (330 filer) | utan importör: family-video-upload.tsx, kevin-bo/port-source.mjs, page-template.mjs, original-media-runtime.mjs (serveras som fil) · bara test: background-zone-schedule, media-family-resolver, social-store, zone-workspaces | `node ordning/verktyg/lab-unused.mjs` |
| `pipeline/` (109 skriptfiler) | 6 krok/CI · 2 externa · 14 bara interna · 87 utan konsument | `node ordning/verktyg/pipeline-consumers.mjs` |
| Importer mellan områden | `lab/lib → web(server)` 125 · `web(server) → lab/lib` 34 · `lab/lib → web/public` 30 · `apps/croupier-frontend → web/public` 26 · `pipeline → web/public` 46 · `presentation-runtime → lab/lib` 13 · `lab/lib → open-claw/lab/src` 15 | `node ordning/verktyg/cross-imports.mjs` |
| Mest delade serverfiler | `web/storage/studio-contract.mjs` (37 importer från Studio), `web/dealer-identity.mjs` 11, `web/presentation-layers.mjs` 9, `web/storage/operator-store.mjs` 8 · åt andra hållet `lab/lib/studio-model.mjs` 10, `cloud-media-store.mjs` 6 | rg i A22 |

### Kända korsberoenden i bygg och drift

- `apps/croupier-frontend/tools/prepare-platform-ui.mjs` importerar
  `ops/vercel-entry/build.mjs`, kopierar `web/public/blackjack-entry.mjs`, följer
  importträdet från `web/public/casino.mjs`, kopierar
  `test-videoeditor/program/web/{compositor,geometry}.js`, alla `web/public/*.css`
  samt `index.html → game.html`, `blackjack-entry.html → blackjack.html`, `casino.html`.
- `test-videoeditor/` läses av frontendbygget, `web/composition-runtime.mjs`,
  `web/layer-packs.mjs` (layer-lanens runtime) och `lab/tools/prepare-preview.mjs`.
- Systemkartan (`docs/system-map/*.json`, `verify.mjs`) är en spärr i pre-commit,
  pre-push och CI: registrerade sökvägar måste finnas, varje Next-route i
  `apps/croupier-frontend/app` och `lab/app` måste finnas i `routes.json`, och
  planerade rader kräver id i `random/checklista-2026-10-08.md` (hårdkodad sökväg).
- `tools/check-orphan-tests.mjs` + `tools/orphan-tests-exceptions.json`: varje
  testfil måste köras av krok/CI/paketskript eller vara undantagen.
- `lab/next.config.mjs` utesluter `../random/**` och `../media/dealers/**` ur
  Studio-bundlen och tar med `media/layout.json`, `media/blob-index.json`,
  `media/catalog/*.json` och SQL.
- `vercel.json`: tjänsterna `web` (`apps/croupier-frontend`), `studio` (`lab`),
  `speech` (`apps/croupier-speech`).

## 4. Dokument

| Mått | Värde |
| --- | --- |
| Markdown totalt | 296 filer: 181 i `media/**/staging`, 29 i `random/`, 9 i `planes/`, 7 övrig media, 70 i övrigt |
| Största | `docs/JOHN-HANDOFF.md` 222 KB · `docs/CLOUD-MIGRATION.md` 88 KB · `lab/docs/README.md` 56 KB · `lab/README.md` 31 KB |
| `open-claw/lab/docs/` | 12 dokument, bl.a. daterad `CLOUD-ACTIVATION-2026-09-29.md` |

## 5. Pågående arbete som kan röra sig

| Vad | Ägare | Berör |
| --- | --- | --- |
| PR #16 Dealer Forge (+ migration 008), mergad efter baslinjen som `234614e3` (se §6) | agent `dealer-forge` | `lab/lib/dealer-forge-*`, `lab/app/api/forge`, `lab/app/control/dealer-forge`, `ops/neon-studio/008-*`, `migrations.mjs` |
| `lab/policies/project.seed.json` | agent `shoe-transitions` (PR #17 mergad; claim kan vara gammal) | Studio-policy |
| Lokal 3lager-media (Johanna/Paow) | Jakob, ospårad | `web/public/review/2026-09-09/3lager/` (ska inte committas av agenter) |
| Övriga ospårade | Jakob | `e.id`, `.cursor/settings.json`, `.agents/skills/source-command-ping/` |

## 6. Rörelse efter baslinjen (observerad samma dag)

Medan planen skrevs flyttade `main` till `234614e3`, där PR #16 Dealer Forge
mergades (8 commits, 35 filer). Siffrorna ovan gäller fortfarande `00ea55c5`.
Aktiviteterna mäter om i steg 0.

| Berört | Påverkar |
| --- | --- |
| `AGENTS.md` och `docs/CLOUD-MIGRATION.md` (ny regel: deploy-valfria migrationer i tre steg, först `008-dealer-forge.sql`) | A01, A02, A03 ombaserar; regeln behålls |
| `docs/ENVIRONMENT-VARIABLES.md`, `docs/environment-variables.json`, `docs/system-map/routes.json` | A01 (systemkartan) |
| Nytt i Studio: `lab/lib/dealer-forge-{api,catalog,images,service,store}.mjs`, `runway-client.mjs`, `lab/app/control/dealer-forge`, `lab/app/api/forge`, `lab/components/dealer-forge-page.*` | A05 (Studio-räkningen blir större än 330), A22 (`studio-native-runtime.mjs`, `web/storage/studio-runtime.mjs`) |
| `lab/package.json`: nytt beroende `sharp` 0.35.4 | Kataloglänkar för `node_modules` (ORKESTRERING §2) |
| `ops/neon-studio/008-dealer-forge.sql`, `migrations.mjs`, `tools/check-migration-readiness.mjs` | Ingen planaktivitet. Migrationen är `deploymentOptional`. |

Därefter, samma förmiddag:

| SHA | Vad | Påverkar |
| --- | --- | --- |
| `f410c229` | PR #18 `jakob/dealer-forge-seed` mergad | Studio (Dealer Forge) |
| `e160af12` | "Keep published dealer packages readable after optional shoe slots": frysta paket utan `transition.shoe` (johns-spelbolag rev 14, sg-test rev 15, nordic-bet rev 1) läses igen av `/play`. Det är Codex-överlämningens prioriterade avvikelse. | A04 och A99 kontrollerar |
| `c0827abc` | `origin/main` mergad in i `jakob/repo-ordning` | Integrationsbranchen |
| `12a12fd6` | Studio låst till Node 24.x (`lab/package.json`) | Agenter med Node 22 kör fortfarande proven; CI och Vercel kör 24 |
| `91969107` | Migration 008 körd i produktion; båda runtime-kontrollerna kräver exakt 001–008. 008 är **inte** längre valfri. | Bevaras vid varje integration |
| `45ff5c25` | CI: gemensam FFmpeg/jq-installation med cache per Ubuntu-image (`.github/actions/setup-ffmpeg`, `tools/ci-install-ffmpeg.sh`) | CI-timeouten från 12 oktober |
| (plan, ingen kod) | Handoffen §2: "Nästa uppdrag: lanes blir bara sammansättning", cirka 230 filer | Våg 3 får inte flytta samma moduler samtidigt |

- Lokala branchen `ORCHISTRATOR` (`4ecedd72`, samma patch som `e160af12`) är raderad.
- `kevin` har rört sig till `eea5e40b`.
- Worktreen `.codex/worktrees/180a` är borta och `a014` (detached) är ny.
- `.cursor/worktrees/croupier/dealer-forge` står på `jakob/dealer-forge-pin-008` (aktiv).
- Huvudcheckouten har ocommittade ändringar från andra agenter i
  `docs/JOHN-HANDOFF.md` och `lab/package*.json` (Node 24-låsning).

## 7. Toleranser i steg 0

- Läs §6 först. Den listar redan känd rörelse.
- **Stoppa och rapportera** om en fil i aktivitetens borttagningslista har fått en
  ny produktkonsument, om en ägd fil ändrats på `main` av någon annan sedan
  baslinjen, eller om systemkartan har röda fel innan du börjat.
- **Fortsätt men notera** om antal filer/MB avviker mindre än 5 % eller om nya
  gula systemkartevarningar uppstått.
- Notera alltid aktuell `origin/main`-SHA i rapporten.

## 8. Produktionsfakta (Codex-överlämning 2026-10-12, endast SELECT)

Lästes av en annan agent från Neon-projektet `wandering-hill-60561912`, gren
`br-flat-fog-b161a6r8`, databas `croupier_game`, scope `production/croupier`.
Inga spelar- eller kontouppgifter lästes, och inget skrevs. Underlagen ligger
lokalt utanför repot:
`C:/Users/jakem/.codex/visualizations/2026/10/12/01a12ebb-0f5c-7e72-b93b-8e3c6f297053/history-cleanup/`
(`astrid-audit.json`, `astrid-dependencies.json`, `astrid-production-audit.json`,
`astrid-published-packages.json` m.fl.). Molnagenter når dem inte; fakta nedan räcker.

| Fakta | Följd |
| --- | --- |
| 37 mediaregisterposter. Astrid har 10 poster (31,4 MB), och ingen av deras SHA-256 matchar Astrids gamla filer i Git | Gamla Astrid-filer i Git är inte molnuppspelningens källa |
| 31 publicerade paket, varav 29 med presentationsdata (gzip avkodad, SHA-256 verifierad). Ingen direkt hashreferens till gamla Astrid-filer | Paketen påverkas inte av att gamla Astrid-filer tas bort ur trädet |
| Sparad projektkonfiguration refererar **12 bankklipp i `media/dealers/astrid/runtime/presentation` (72 276 298 byte)** | Avregistrera inte och ta inte bort ur Blob. Behåll register och metadata. |
| `runtime/presentation` har 51 registrerade bankklipp (172,3 MB) | Samma |
| De senaste paketen för johns-spelbolag och sg-test har fem frysta mediarecords för Johanna och Paow | Ditt 3lager-material är separat; rör det inte |
| Paketavvikelsen `transition.shoe` (se §6) | Rättad i `e160af12` |
| Objektens existens i Blob och full visuell liveuppspelning är **inte** verifierade | Kontrolleras av orkestratorn i A31/A99 |
| Astrids `staging` (6,3 MB) innehåller arbets- och kalibreringsmetadata | A14 får inte radera med en generell staging-regel |
| Återställningsunderlag från historikrensningen finns i samma externa mapp under `approved/` (`original.bundle`, `reflog-only.pack`, `original-git-metadata.zip`) | Omfattar inte ignorerat eller ospårat arbete |

## 9. Lokalt utanför Git (2026-10-12, namn och storlek, innehåll inte läst)

| Sökväg | Storlek | Vad | Får agenter röra? |
| --- | ---: | --- | --- |
| `lab/data/platform-private/` | 748 MB · 9 839 filer | Privat plattformsdata: QA-evidens (`n2-pg-qa` 460 MB, `native-cloud-browser-evidence` 82 MB, `retained-bank-qa-readback` 32 MB …), loggar och privata produktionsnycklar | Nej, aldrig läsa innehåll |
| `lab/data/` övrigt | 40 MB | Sparat projekt, historik, spelare, röstcache, QA-mappar från 21 sep, loggar | Nej |
| `web/public/review/2026-09-09/3lager/` | – (ospårat) | Jakobs trelagermaterial (Johanna/Paow), inklusive `Gronstripp/.venv` 161 MB | Nej |
| `apps/croupier-frontend/.next`, `lab/.next`, `lab/preview-build` | 159 · 13 · 12 MB | Byggutdata, återskapas | Bara orkestratorn, med Jakobs ok (A19) |
| `apps/croupier-frontend/public/*` (genererade kopior), `runtime-ui/` | ~3 MB | Kopieras av `prepare-platform-ui.mjs`. Innehåller inaktuella kopior, t.ex. `rigged-table-scene.mjs` | A19 |
| `ops/vercel-entry/preview/{.vercel,dist}` | 1,8 · 1,8 MB | Lokal länk till ett separat Vercel-projekt, och byggutdata | A18/A19 |
| `media/.migration/` | 9,5 MB · 4 filer | Journaler från medieomläggningen 2026-10-02 (`tools/migrate-media-layout.mjs`) | A19 (arkivera efter Jakobs ok) |
| `random/*.pdf`, `random/env-backup-*/`, `random/bilder-*/` | – | Jakobs privata lokala filer | Nej |

Ignoreringsregler: `.cursorignore` = `.ignore`. De döljer för Cursor och `rg`:
`media/**/source/`, `media/**/staging/`, `media/layout.json`,
`media/blob-index.json`, `vendor/`, alla binärer (`*.mp4`, `*.png`, `*.glb` …),
`lab/data/`, `web/data/` och `.env*`. `.cursorignore` stoppar dessutom Cursors
egna filverktyg; terminal och MCP omfattas inte. Spårade filer under mönstren
söks med `git grep` och läses med `git show HEAD:<sökväg>` (ORKESTRERING §4
punkt 13), aldrig med `rg --no-ignore`.
Privata mönster (`random-stuff-jakob/jakob-docs/arkiv/`, `.env*`,
`lab/data/platform-private/`) läses aldrig.
