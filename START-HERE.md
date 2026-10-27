# Scoutgaming: börja här

Live-dealer blackjack för spelbolag: Admin publicerar dealer, material och rum, lobbyn startar spelet och motorn äger kort, sko och saldo. Den här filen är enda ingången för människor och agenter. Reglerna står i [AGENTS.md](AGENTS.md); Jakobs aktuella beslut gäller före allt annat.

## En produktväg

| Del | Kod | Drift |
| --- | --- | --- |
| Admin, lobby, partner | `apps/studio` (basePath `/studio`; publika vägar `/admin`, `/lobby`, `/partner`) | Vercel, team `scoutgaming`, projekt `scoutgaming` → www.scoutgaming.tech |
| Startsida och spelskal `/game`, `/play/{game}` | `apps/web` | Vercel, samma projekt (`vercel.json` styr tjänsterna) |
| Tal | `apps/speech` | Vercel |
| Spelmotor: regler, sko, kort, saldo, `/api/table`, `/api/studio-game/command` | `services/game` | Render `croupier-v3` |
| Produktens talkedja i drift | `packages/director` (Director-biblioteket) och `services/openclaw/lab` (Director-tjänsten; Gateway-image och deploy i `deploy/`) | Render `croupier-lab-director`, `croupier-lab-openclaw` |
| Produktregister och konton | Neon Postgres, scheman `croupier_game`, `croupier_auth`, `croupier_studio` (SQL i `ops/neon-game`, `ops/neon-studio`) | Neon |
| Media | Vercel Blob | Blob |
| Delade tjänster | `packages/*` (presentation, storage, studio-registry, operators, navigation …) | Byggs in i båda apparna |

Beslut (Jakob 2026-10-27): Vercel + Render + Neon + Blob är den enda vägen, och `main` är den enda produktvägen. Ingen SQLite, inga lokala produktregister, inga parallella QA-ytor. `/control` och `/lab` är pensionerade och svarar bara med redirect till `/admin`; `/bo` är borta. PGlite är ett dev-beroende för tester, inte en produktväg. Kvarvarande rester är avvecklingsobjekt, inte bevarandekrav.

## Identiteter

| Miljö | Tjänst | Identitet |
| --- | --- | --- |
| Produktion | Vercel | team `scoutgaming` `team_Scxorb9qtZHjNae1YEQnFCaT`, projekt `scoutgaming` `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`, www.scoutgaming.tech; deployar `main` automatiskt |
| Produktion | Render, workspace `tea-d19jsa63jp1c73ch0sc0` | spelmotor `croupier-v3` `srv-dbd6nfon74is73aiblf0` (manuell deploy efter grön CI); Director `croupier-lab-director` `srv-danhlpjtqb8s73bv530g`; Gateway `croupier-lab-openclaw` `srv-danhiv3tqb8s73burkq0` (privat tjänst) |
| Produktion | Neon | org "Vercel: scoutgaming" `org-green-butterfly-00780270`, projekt `croupier-production` `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game` med scheman `public`, `croupier_auth`, `croupier_game`, `croupier_studio` |
| Produktion | Blob | `croupier-media-private` `store_AqwvebTbBHarOjvG` |
| Staging | Vercel | `croupier-k06-k07-staging` `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, croupier-k06-k07-staging.vercel.app; deployas från `main` via API |
| Staging | Render | `croupier-k06-k07-staging` `srv-dbf61l0m7kps73ft7mk0`, `CROUPIER_SHARED_TABLE_ENABLED=1` sedan 2026-10-27 |
| Staging | Neon | projekt `croupier-k06-k07-staging` `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, databas `croupier_staging` |
| Staging | Blob | `croupier-k06-k07-staging` `store_7E06N1P4w9Mu1dZD` (endast syntetiskt material) |
| Raderat | Render | `croupier-v2` och `croupier-vercel-preview-qa` raderades 2026-10-27 (Jakobs beslut). Äldre dokument som nämner dem beskriver historik. |

Kevin har läsrollen `kevin_migration_readonly` i produktionens Neon och sin GitHub-åtkomst (Jakobs beslut 2026-10-27). Hans brancher (`kevin*`, `codex/kevin-*`) rörs aldrig; bra beteenden skrivs om i mains moduler.

## Publiceringsordning

Allt som är grönt går direkt till produktion, i denna ordning:

1. Schemamigrering före kravhöjning: Jakob applicerar SQL i `ops/neon-*` (`node tools/check-migration-readiness.mjs --apply`) innan kod som kräver schemat mergas. CI läser produktionens migreringsledger.
2. Merge till `main` efter grön full CI. Vercel deployar `main` automatiskt.
3. Render `croupier-v3` deployas manuellt (Render MCP) efter varje grön merge. Director och Gateway deployas om när deras kod ändras.
4. Admin-publicering (paket och rumskonfiguration) sist, när koden är live.

`CROUPIER_SHARED_TABLE_ENABLED` (delat bord): stagingen kör `=1` sedan 2026-10-27, och delade bord startar i enkel-origin-layouten sedan PR #442 (`cc415cd8`). Produktionens `croupier-v3` har flaggan osatt; den sätts där bara som del av O03 efter Jakobs separata godkännande. Se [ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling).

## Staging

Staging är en tillfällig provbänk fram till O03 och raderas därefter. Jakob startar och stoppar Render-tjänsten; en agent startar den bara under ett prov och säger till när provet är klart. Endast syntetiska konton: stagingens Admin-inloggning ligger i gitignorerad `.env.local` under nycklarna `STAGING_ADMIN_LOGIN_UN` och `STAGING_ADMIN_LOGIN_PW` (läs aldrig in värdena i chatt eller Git). Produktion och Johns Bet-demon rörs aldrig vid prov. Acceptanskvitton skrivs som `docs/*-ACCEPTANCE.json` med versions-, deploy- och databasidentiteter.

## Vad agenter får göra

- Ingen merge, DDL, produktionsskrivning eller betald drift utan Jakobs beslut. Underagenter mergar aldrig; den orkestrerande Claude-sessionen mergar efter grön CI enligt ägarreglerna i AGENTS.md.
- Render MCP: deploy, loggar, metrik och skrivning av miljövariabler, men ingen läsning av env-värden. En env-skrivning sammanfogar nycklar och startar en deploy automatiskt. `RENDER_API_KEY` i gitignorerad `.env.local` ger läsning via Renders REST-API.
- Neon MCP: läsning är fri; destruktiva verktyg bara efter Jakobs ja.
- Vercel: CLI-token på Jakobs dator; staging deployas via API.
- Inloggningar och nycklar: lokalt i `.env.local`, aldrig i Git eller chatt. Läs `node tools/security-status.mjs` före push och merge.

## Köra och testa

1. Node 24 via Volta (`apps/studio/package.json` pinnar versionen). `npm ci` i `apps/studio`, `services/game` och `services/astrid-gpu-worker/gateway`; `pnpm install` i `apps/web`.
2. Riktade prov: `node --test --test-concurrency=4 <filer>`. Sviter: `sh .githooks/pre-commit-full <svit>` med `studio`, `admin`, `contracts`, `database`, `presentation`, `access`, `speech`, `gameplay` eller `engine`. PGlite-proven (`test/fixtures/pglite-pool.mjs`) kör utan Postgres-installation; motorn över HTTP mot riktig Postgres körs med `node tools/run-engine-qa.mjs --postgres-bin <bin>`.
3. Pre-commit (`.githooks/pre-commit`) kör riktade kontroller på ändrade filer; `node tools/precommit-checks.mjs --plan` visar urvalet. Full regression, Chrome och isolerad Postgres körs i CI (`.github/workflows/croupier.yml`) eller med `sh .githooks/pre-commit --full`. Använd aldrig `--no-verify`.
4. Riktig acceptans görs i staging: Admin → spara → publicera → lobby → `/game?game=blackjack` → spelad hand → omladdning.
5. Ljud och läppsynk bedöms av Jakob. Hash, testpass eller kodläsning är inte AV-godkännande.

## Leverera

- Arbeta på en branch `jakob/*` (Claude-underagenter: `jakob/claude-*`) från färsk `origin/main` och committa med repots hookar. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot; öppna PR mot `main` i `Jakeminator123/scoutgaming`. Policy: `tools/repository-policy.json`. Ingen force-push, inga taggar, ingen radering av andras brancher.
- Merge efter grön full CI av den orkestrerande sessionen eller Jakob, enligt ägarreglerna i [AGENTS.md](AGENTS.md). Den obligatoriska kontrollen heter `CI` och kräver att branchen är à jour med `main`: kör `gh pr update-branch` före merge. Samordning sker i PR:er och [teaminboxen](inbox/README.md).
- Claude Code: underagenter arbetar i egna worktrees under `.claude/worktrees` (gitignorerat), granskar varandras PR:er och rapporterar kort med bevis. Codex- och Cursor-agentkonfigurationen (`.codex`, `.agents`, Cursor-kommandon och -skills) är borttagen; Cursor används som editor med `.cursor/rules/scoutgaming.mdc`, som bara hänvisar hit.
- Uppdatera [docs/NEXT-AGENT.md](docs/NEXT-AGENT.md) vid överlämning. Markera en aktivitet VERIFIED i `migrering/status.json` först när kriterierna är bevisade.

## Läge

- Migrationens status: [migrering/STATUS.md](migrering/STATUS.md), genererad från [status.json](migrering/status.json), som är enda statuskällan. Planen: [MASTERPLAN.md](migrering/MASTERPLAN.md).
- Överlämning, återstående aktiviteter och vem som agerar: [docs/NEXT-AGENT.md](docs/NEXT-AGENT.md). Historik och daterade kvitton (inte aktuellt läge): [docs/history/](docs/history/README.md).
- 27 oktober 2026, kväll: alla produktionstjänster (Vercel `scoutgaming`, Render `croupier-v3`, `croupier-lab-director` och `croupier-lab-openclaw`) kör `main` `cc415cd8`. Studio-migrering 020 är applicerad i produktionen. Johns Bet har paketrevision 9 och publicerad spelkonfiguration `room-config-133cfffc-fdad-47f2-9c85-51b08de4a325` i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`, med alla 15 PAOW-tagningar godkända och mätta. Jakob spelade i produktionen och godkände (”allt funkade, hon pratar”) på dator och i datorwebbläsarens mobilvy.
- Känd defekt: spelaren kan se råtexten ”Tal: play() failed …” när webbläsaren blockerar autoplay; rättningen pågår på `jakob/claude-speech-autoplay`.
- Övriga guider: drift och återställning i [ENVIRONMENT-RESTORATION](docs/ENVIRONMENT-RESTORATION.md), [CLOUD-MIGRATION](docs/CLOUD-MIGRATION.md), [ENVIRONMENT-VARIABLES](docs/ENVIRONMENT-VARIABLES.md) och [RENDER-V3](ops/cloud/RENDER-V3.md); produktbegrepp i [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md) och [Studio-guiden](apps/studio/docs/README.md); lagrings- och uppspelningskontrakt i [LOCAL-PRESENTATION-RUNTIME](docs/LOCAL-PRESENTATION-RUNTIME.md); AI-verktyg i [docs/AI](docs/AI/README.md).
