# A00 · Täckning av inventeringen

Mätt 2026-10-12 på integrationsbranchen efter våg 1 (A01–A06 och A30 fas 1
inmergade) med `node ordning/verktyg/coverage.mjs`. 91 spårade mappar (djup 2,
och djup 3 för `media`, `lab`, `web`, `apps` och `pipeline`); 61 nämns i minst en
rapport. Tabellen nedan anger skälet för de 30 som inte gör det. Lokala, ospårade
mappar ingår inte här; de täcks av A19 (BASLINJE §9).

| Mapp | Filer | MiB | Skäl | Åtgärd |
| --- | ---: | ---: | --- | --- |
| `.codex`, `.github/actions`, `agent-talk` | 1 · 1 · 2 | 0,01 | Agent- och CI-konfiguration. `.github/actions/setup-ffmpeg` kom med `45ff5c25`. | Inget städomfång |
| `apps/croupier-frontend/api`, `components`, `test`, `tools` | 2 · 27 · 12 · 1 | 0,32 | Aktiv hemsida och spelarytor. Korsimporter mätta i BASLINJE §3; inga kandidater i A05. | Inget städomfång |
| `apps/croupier-frontend/public` | 35 | 20,61 | **Inte analyserad.** Hemsidans egna media (landningsfilmer, lobbyporträtt, platshållare). Låg utanför A04:s omfång (`media/`). | A17: kontrollera konsumenter, särskilt `placeholder*` och `3d-purple-…jpg` |
| `apps/croupier-speech` | 3 | 0,00 | Aktiv Vercel-tjänst (tal). | Inget städomfång |
| `lab/animations`, `lab/schemas`, `lab/tools`, `lab/test/fixtures`, `lab/docs/templates` | 20 · 7 · 2 · 7 · 1 | 0,49 | Aktiv Studio-kod, scheman och fixturer. `lab-unused.mjs` gav inga kandidater här. | Inget städomfång |
| `lab/app/fonts`, `login`, `openclaw`, `operator-chat`, `probe`, `set-password`, `tree` | 10 | 0,11 | Aktiva Studio-routes eller omdirigeringar. Alla står i `docs/system-map/routes.json`. Omdirigeringar behålls ("inget blir sämre"). | Inget städomfång |
| `media/site/runtime`, `media/site/source` | 9 · 8 | 2,55 | **Lucka i A04.** Hemsidans media under `media/`. | A17: klassa enligt A04:s mall |
| `ops/neon-game` | 3 | 0,01 | Spelets SQL-schema och migration 006. Aktivt. | Inget städomfång |
| `pipeline/data`, `pipeline/irs` | 1 · 1 | 0,11 | **Kan ha blivit föräldralösa** när A10 (`dealer-ik-panel.py`) och A15 (`room-voice.py`) tog bort sina läsare. | A17: kontrollera efter V2 |
| `services/astrid-gpu-worker` | 44 | 8,22 | Egen tjänst (läppsynk). Behålls. `assets/` (4 filer, 8 MB) är inte analyserade. | A17: kontrollera `assets/` |
| `test/fixtures` | 172 | 0,51 | Testfixturer för aktiva tester. | Inget städomfång |
| `web/public/card-presentation`, `web/public/lab` | 10 · 6 | 0,30 | Aktiva klientmoduler (produkt i `public-reach.mjs`). | Inget städomfång |

Verktygsförbättringar efter den andra granskningen (2026-10-12): alla verktyg
listar filer som inte kunde läsas och avslutar då med kod 2. `pipeline-consumers.mjs`
och `public-reach.mjs` redovisar referenser från `media/` och dokument som en egen
klass i stället för att ignorera dem. `cross-imports.mjs` räknar varje
`packages/<namn>` separat och har `--all-edges`. `lab-unused.mjs` hanterar
namnkrockar som `page-template.mjs`/`page-template.tsx`.
