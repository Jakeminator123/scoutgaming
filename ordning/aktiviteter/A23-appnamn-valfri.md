# A23 · Appnamn och tjänstegränser (valfri)

| Fält | Värde |
| --- | --- |
| Våg | 3 · sist i strukturfasen · valfri · en delaktivitet per PR |
| Väntar på | A22 klar · uttryckligt B12-ja för varje del |
| Branch / worktree | `jakob/ordning-a23-<del>` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a23-<del>` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 60 % · drift, lokala data och alla byggkedjor |

## Mål

Mappnamnen beskriver ansvar. Vinsten är bara begriplighet, medan risken är hög.
Min rekommendation är att vänta tills våg 1–2 och A20–A22 har gått i drift en
tid.

| Del | Flytt | Det som måste följa med |
| --- | --- | --- |
| 23a | `lab/` → `apps/studio/` | `vercel.json` (`studio.root`), `ops/cloud/Dockerfile` (`npm --prefix lab`, `lab/.next`, `lab/data`), CI (`npm --prefix lab`), `lab/next.config.mjs` (relativa `../`-vägar), `lab/start.mjs`, `open-claw/lab/deploy/local-session.mjs` (`lab/data`), `docs/system-map/verify.mjs` (`'lab/app'` är hårdkodat), `.gitignore`, `.dockerignore`, `.ignore`, `tools/precommit-checks.mjs` (`lab/README.md` …), alla `../lab/`-importer, dokument och regler |
| 23b | `web/` → `services/game/` (server) och `apps/player/` (`web/public`) | Dockerfile (`npm --prefix web`, CMD via `ops/cloud`), `prepare-platform-ui.mjs`, `ops/vercel-entry`, `pipeline → web/public` (46 importer), `web/data` (lokal spel-DB) |
| 23c | `open-claw/lab/src` → `packages/openclaw/` | `open-claw/lab/render.yaml` (`dockerContext: ./open-claw/lab`). En flytt ut ur kontexten bryter gateway-imagen, så Dockerfilerna måste byggas om |

## Gemensamma krav

- **Lokala data:** `lab/data` och `web/data` är privata, Git-ignorerade och
  innehåller sparade projekt, historik och spelare. Flytten får aldrig radera
  eller tömma dem. Gör flytten av lokala data till ett separat, manuellt steg
  för Jakob, med backup enligt `docs/ENVIRONMENT-RESTORATION.md`.
- Ren `git mv` först, sedan sökvägar.
- Orkestratorn bygger Docker-imagen lokalt:
  `docker build -f ops/cloud/Dockerfile .`.
- Leverera inte nära en planerad demo. Ha en revert-PR förberedd.
- Varje del verifieras i produktion innan nästa startas:
  N1 → paket → N2 → rum → N3, rehearsal för fyra dealers, partnerinloggning
  och OpenClaw-hälsa (23c).

## Steg per del

0. Steg 0 enligt ORKESTRERING §4. Inga öppna PR:er i berörda mappar. Den här
   delen kan inte köras parallellt med något annat.
1. Inventera varje förekomst av den gamla sökvägen:
   `rg -n --hidden --glob '!.git' '<gammal>'`, även i `.github`, `.githooks`,
   Dockerfiler, `vercel.json` och `render.yaml`. Skriv listan i rapporten.
2. Commit 1: `git mv`. Commit 2: alla sökvägar.
3. Prov: hela sviten, alla byggen och Docker-bygget (orkestratorn),
   `node docs/system-map/verify.mjs --check`,
   `node tools/check-environment-variables.mjs` och
   `node tools/check-orphan-tests.mjs`.
4. Efter deploy: röktest enligt ovan.

## Klart när

- [ ] Varje genomförd del är verifierad i produktion.
- [ ] Ej genomförda delar har en motivering i registret.

## Tveksamt att lyfta

- Varje del. Inget av detta görs utan uttryckligt ja per del.
