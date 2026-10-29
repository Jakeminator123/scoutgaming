# Scoutgaming: börja här

Live-dealer blackjack för spelbolag: Admin publicerar dealer, material och rum, lobbyn startar spelet och spelmotorn äger kort, sko och saldo. Den här filen är ingången för människor och agenter; Jakobs aktuella beslut gäller före allt annat.

Läsordning:

1. **START-HERE** (den här filen): produktväg, identiteter, publiceringsordning, hur man kör, testar och levererar.
2. **[docs/NEXT-AGENT.md](docs/NEXT-AGENT.md)**: aktuellt läge, återstående aktiviteter och vem som agerar.
3. **[migrering/STATUS.md](migrering/STATUS.md)**: aktivitetsstatus, genererad från [status.json](migrering/status.json), som är enda statuskällan.

Reglerna står i [AGENTS.md](AGENTS.md). Vad orden betyder beskrivs brett i [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md) (referens, inte tvingande ordlista).

## En produktväg

| Del | Kod | Drift |
| --- | --- | --- |
| Admin, lobby, partner | `apps/studio` (basePath `/studio`; publika vägar `/admin`, `/lobby`, `/partner`) | Vercel, team `scoutgaming`, projekt `scoutgaming` → www.scoutgaming.tech |
| Startsida och spelskal `/game`, `/play/{game}` | `apps/web` | Vercel, samma projekt (`vercel.json` styr tjänsterna) |
| Tal | `apps/speech` | Vercel |
| Spelmotor: regler, sko, kort, saldo, `/api/table`, `/api/studio-game/command` | `services/game` | Render `croupier-v3` |
| Talkedjan i drift | `packages/director` (Director-biblioteket) och `services/openclaw/lab` (Director-tjänsten; Gateway-image och deploy i `deploy/`) | Render `croupier-lab-director`, `croupier-lab-openclaw` |
| Produktregister och konton | Neon Postgres, scheman `croupier_game`, `croupier_auth`, `croupier_studio` (SQL i `ops/neon-game`, `ops/neon-studio`) | Neon |
| Media | Vercel Blob | Blob |
| Delade tjänster | `packages/*` (presentation, storage, studio-registry, operators, navigation …) | Byggs in i båda apparna |

Beslut (Jakob 2026-10-27): Vercel + Render + Neon + Blob är den enda vägen, och `main` är den enda produktvägen. Ingen SQLite, inga lokala produktregister, inga parallella QA-ytor. `/control` och `/lab` svarar bara med redirect till `/admin`; `/bo` är borta. PGlite är ett dev-beroende för tester, inte en produktväg. Kvarvarande rester är avvecklingsobjekt, inte bevarandekrav.

## Identiteter

| Miljö | Tjänst | Identitet |
| --- | --- | --- |
| Produktion | GitHub | `Jakeminator123/scoutgaming`, repo-ID `1380630440`, målbranch `main` |
| Produktion | Vercel | team `scoutgaming` `team_Scxorb9qtZHjNae1YEQnFCaT`, projekt `scoutgaming` `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`, www.scoutgaming.tech; deployar `main` automatiskt. Projektets "Ignored Build Step" släpper bara igenom `main` (`vercel.json` delas av båda projekten och tillåter `main` och `preview`; filtret per projekt får inte tas bort) |
| Produktion | Render, workspace `tea-d19jsa63jp1c73ch0sc0` | spelmotor `croupier-v3` `srv-dbd6nfon74is73aiblf0` (manuell deploy efter grön CI); Director `croupier-lab-director` `srv-danhlpjtqb8s73bv530g`; Gateway `croupier-lab-openclaw` `srv-danhiv3tqb8s73burkq0` (privat tjänst) |
| Produktion | Neon | org "Vercel: scoutgaming" `org-green-butterfly-00780270`, projekt `croupier-production` `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game` med scheman `public`, `croupier_auth`, `croupier_game`, `croupier_studio` |
| Produktion | Blob | `croupier-media-private` `store_AqwvebTbBHarOjvG` |
| Preview | GitHub | samma repo, långlivad branch `preview` (skapad 2026-10-29 från `main` a05917c3); tar emot push från `main`/`jakob/*` och PR:er med bas `preview`. Rulesetet "preview: no deletion, no force push" skapas av Jakob innan branchen används; utan det skyddar bara pre-push-hooken, och GitHubs auto-delete raderar branchen om den någonsin blir head i en mergad PR |
| Preview | Vercel | projekt `scoutgaming-preview` `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14` (hette `croupier-k06-k07-staging` till 2026-10-29), preview.scoutgaming.tech; deployar branchen `preview` automatiskt. Projektets "Ignored Build Step" släpper bara igenom `preview` (samma `vercel.json` som produktionen; filtret per projekt får inte tas bort) |
| Preview | Render | `croupier-k06-k07-staging` `srv-dbf61l0m7kps73ft7mk0`, byggs från branchen `preview`; `CROUPIER_SHARED_TABLE_ENABLED=1` sedan 2026-10-27 |
| Preview | Neon | projekt `croupier-k06-k07-staging` `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, databas `croupier_staging` |
| Preview | Blob | `croupier-k06-k07-staging` `store_7E06N1P4w9Mu1dZD` (riktigt, godkänt material får ligga här; aldrig produktionstoken eller riktiga spelardata) |
| Raderat | Render | `croupier-v2` och `croupier-vercel-preview-qa` raderades 2026-10-27 (Jakobs beslut). Äldre dokument som nämner dem beskriver historik. |

Andra tjänster i samma Render-workspace och Neon-orgen `org-lucky-cake-48388035` hör till andra projekt; rör dem inte. Kevin har läsrollen `kevin_migration_readonly` i produktionens Neon och sin GitHub-åtkomst (Jakobs beslut 2026-10-27). Hans brancher (`kevin*`, `codex/kevin-*`) rörs aldrig; bra beteenden skrivs om i mains moduler.

## Publiceringsordning

Allt som är grönt går direkt till produktion, i denna ordning:

1. Schemamigrering före kravhöjning: Jakob applicerar SQL i `ops/neon-*` (`node tools/check-migration-readiness.mjs --apply`) innan kod som kräver schemat mergas. CI läser produktionens migreringsledger.
2. Merge till `main` efter grön full CI. Vercel deployar `main` automatiskt.
3. Render `croupier-v3` deployas manuellt (Render MCP) efter varje grön merge; kontrollera `https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. Director och Gateway deployas om när deras kod ändras.
4. Admin-publicering (paket och rummets spelinställningar) sist, när koden är live.

`CROUPIER_SHARED_TABLE_ENABLED` (delat bord) är `=1` i produktionen sedan O03 (satt 2026-10-28 13:52Z, deploy `dep-dbgvsc5g1s2s73cdoqkg` på `5f5bc88d`) och i preview. Med bordet på deployas `croupier-v3` bara när bordet är tomt, tills F11 är rättad ([ENVIRONMENT-RESTORATION](docs/ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten)). Se [ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling).

## Preview

Två miljöer räcker (Jakobs beslut 2026-10-29): `main` är produktion och branchen `preview` är preview. Preview är den tidigare stagingen, som behålls efter O03 (Jakobs beslut D5, 2026-10-28); Render-, Neon- och Blob-resurserna i identitetstabellen heter fortfarande `croupier-k06-k07-staging`. Källan är branchen `preview` på GitHub, inte längre en låst SHA via API: Vercel-projektet `scoutgaming-preview` deployar varje push till `preview` till preview.scoutgaming.tech, och Render-tjänsten byggs från samma branch. Till `preview` får bara `main` och `jakob/*` pushas (pre-push-hooken tillåter fast-forward, nekar radering, force-push och push från en lokal `kevin*`-checkout), aldrig Kevins arbete; `preview` är ingen featurebranch och mergas aldrig till `main`, inte heller indirekt: `origin/preview` mergas aldrig in i `main` eller en `jakob/*`-branch, och `merge-pr.mjs` nekar en PR mot `main` vars head bär previews historik. `preview` innehåller alltid `main`: så länge `preview` inte divergerat fast-forwardas den från `main` (`node tools/push-github-work.mjs --environment preview` på `main`), annars synkas den med en PR från `main` med bas `preview` som mergas med `node tools/merge-pr.mjs <nr> --head <full-sha> --base preview`. Preview är inget obligatoriskt steg före produktion: orkestratorn avgör när en visuell koll behövs. Jakob startar och stoppar Render-tjänsten; en agent startar den bara under ett prov och säger till när provet är klart. Testkonton är syntetiska, utöver Jakobs egna inloggningar (Admin och spelare) som speglats dit från produktionen (Jakobs beslut 2026-10-28). Previews Admin-inloggning ligger i gitignorerad `.env.local` under nycklarna `STAGING_ADMIN_LOGIN_UN` och `STAGING_ADMIN_LOGIN_PW`. Lösenord skrivs aldrig i Git eller chatt. Produktion och Johns Bet-demon rörs aldrig vid prov. Acceptanskvitton skrivs som `docs/*-ACCEPTANCE.json` med versions-, deploy- och databasidentiteter.

## Köra och testa

1. Node 24 via Volta (`apps/studio/package.json` pinnar versionen). `npm ci` i `apps/studio`, `services/game` och `services/astrid-gpu-worker/gateway`; `pnpm install` i `apps/web`. I en ny worktree behöver pre-commit `npm ci` i `apps/studio` och i det paket som provas.
2. `node apps/studio/start.mjs --no-open` skriver den publicerade lobbyns adress och startar inga lokala servrar.
3. Riktade prov: `node --test --test-concurrency=4 <filer>`. Sviter: `sh .githooks/pre-commit-full <svit>` med `studio`, `admin`, `contracts`, `database`, `presentation`, `access`, `speech`, `gameplay` eller `engine`. PGlite-proven (`test/fixtures/pglite-pool.mjs`) kör utan Postgres-installation; motorn över HTTP mot riktig Postgres körs med `node tools/run-engine-qa.mjs --postgres-bin <bin>`.
4. Pre-commit (`.githooks/pre-commit`) kör riktade kontroller på ändrade filer; `node tools/precommit-checks.mjs --plan` visar urvalet. Full regression, Chrome och isolerad Postgres körs i CI (`.github/workflows/croupier.yml`) eller med `sh .githooks/pre-commit --full`.
5. Riktig acceptans görs i preview: Admin → spara → publicera → lobby → `/game?game=blackjack` → spelad hand → omladdning. Ljud och läppsynk bedöms av Jakob.

## Leverera

1. `git fetch`, sedan egen branch `jakob/*` från färsk `origin/main` (Claude-underagenter: `jakob/claude-*` i en worktree under `.claude/worktrees`).
2. Committa med repots hookar, aldrig `--no-verify`. Läs `node tools/security-status.mjs` före push och merge.
3. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot (eller `git push -u origin <branch>` och `gh pr create`). PR mot `main`, öppnad som klar (inte draft), med raden `Buggranskning: <verktyg/modell>, <nivå>, <fynd>` efter egen granskning av diffen ([AGENTS.md](AGENTS.md#leverans-och-merge)).
4. Den obligatoriska kontrollen heter `CI` och gäller PR:ens head; branchen behöver inte vara à jour med `main`. Vänta på grön CI, merga. Vem som får merga står i [AGENTS.md](AGENTS.md#leverans-och-merge); orkestratorn mergar med `node tools/merge-pr.mjs <nr> --head <full-sha>` (under O02 även `--freeze <kandidat-sha>`), som nekar om main sedan CI-körningen ändrat samma filer eller paketrot; merga då in `origin/main` och låt CI köra om.
5. Till preview, när en ändring ska ses på preview.scoutgaming.tech före eller i stället för merge: `node tools/push-github-work.mjs --environment preview` från `main` eller `jakob/*` (fast-forward av `preview` till HEAD; flaggan krävs även på en lokal `preview`). Har `preview` divergerat nekar verktyget; öppna då en PR med bas `preview` (`gh pr create --base preview --head jakob/<branch>`), så gör GitHub mergen på preview-sidan. Merga aldrig `origin/preview` in i `main` eller en `jakob/*`-branch: det drar previews innehåll in i nästa PR mot `main`, och `merge-pr.mjs` nekar en sådan head. En PR mot `preview` mergas av orkestratorn med `node tools/merge-pr.mjs <nr> --head <full-sha> --base preview` efter grön `CI` (samma ägar-, CI- och kevin-kontroller som mot `main`) eller av Jakob personligen; agenter använder aldrig GitHubs merge-knapp. `main` är fortfarande den enda produktvägen: en ändring på `preview` når produktionen bara via en PR från sin `jakob/*`-branch mot `main`.
6. Uppdatera [docs/NEXT-AGENT.md](docs/NEXT-AGENT.md) vid överlämning. Samordning sker i PR:er och [teaminboxen](inbox/README.md).

## Kanoniska dokument

| Fråga | Dokument |
| --- | --- |
| Läge, återstående arbete, kända fällor | [NEXT-AGENT](docs/NEXT-AGENT.md) |
| Aktivitetsstatus och plan | [STATUS](migrering/STATUS.md), [MASTERPLAN](migrering/MASTERPLAN.md) |
| Regler för agenter | [AGENTS](AGENTS.md) |
| Vad orden betyder (bred referens) | [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md) och Admins Hjälp `/admin/guide` |
| Arbetssteg i Admin | [användarguiden](apps/studio/docs/README.md) |
| Drift, moln och återställning | [CLOUD-MIGRATION](docs/CLOUD-MIGRATION.md), [ENVIRONMENT-RESTORATION](docs/ENVIRONMENT-RESTORATION.md), [RENDER-V3](ops/cloud/RENDER-V3.md) |
| Miljövariabler | [ENVIRONMENT-VARIABLES](docs/ENVIRONMENT-VARIABLES.md) |
| Lagrings- och uppspelningskontrakt | [LOCAL-PRESENTATION-RUNTIME](docs/LOCAL-PRESENTATION-RUNTIME.md) |
| AI-verktyg och OpenClaw | [docs/AI](docs/AI/README.md) |
| Alla dokument: vad, för vem, när de uppdateras | [docs/README](docs/README.md) |
| Daterade kvitton (bevis, inte läge) och raderade dokument | `docs/<datum>-*-ACCEPTANCE.json`; raderade står i [HISTORIK](docs/HISTORIK.md) |
