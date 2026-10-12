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
| `web/public` (117 källfiler) | 95 produkt · 13 bara test · 6 bara pipeline · 3 ingen | `node ordning/verktyg/public-reach.mjs` |
| Bara test | animation-clock, blackjack-asset-state, bo/media-preview, dealer-collection, dealer-face, dealer-motion, dealer-rig, movement-cues, ready-motion, rigged-card-layout, rigged-discard-state, rigged-face-playback, shoe-contact-occlusion | samma |
| Bara pipeline | astrid-folded-rest, astrid-idle-scheduler, blender-card-layout, blender-table-details, blender-table-scene, dealing-card | samma |
| Ingen | actor-composite-scene.mjs, dealer-studio.css, table-scene.mjs | samma |
| Produkt men inte från HTML | dealer-engine, speech-playback, astrid-green-dealer, astrid-green-speak m.fl. (nås via Studio-serverns originalmedia) | samma |
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

Huvudcheckouten hade dessutom en lokal, opushad commit (`4ecedd72` "Keep published
dealer packages readable after optional shoe slots") från en annan agent.

## 7. Toleranser i steg 0

- Läs §6 först. Den listar redan känd rörelse.
- **Stoppa och rapportera** om en fil i aktivitetens borttagningslista har fått en
  ny produktkonsument, om en ägd fil ändrats på `main` av någon annan sedan
  baslinjen, eller om systemkartan har röda fel innan du börjat.
- **Fortsätt men notera** om antal filer/MB avviker mindre än 5 % eller om nya
  gula systemkartevarningar uppstått.
- Notera alltid aktuell `origin/main`-SHA i rapporten.
