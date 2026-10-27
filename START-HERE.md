# Scoutgaming: börja här

Live-dealer blackjack för spelbolag. Den här filen är ingången för människor och agenter: vad produkten består av, var saker finns, hur man testar och hur man levererar. Regler för agenter står i [AGENTS.md](AGENTS.md); Jakobs aktuella beslut gäller före allt annat.

## En produktväg

| Del | Kod | Drift |
| --- | --- | --- |
| Admin, lobby, partner | `apps/studio` (basePath `/studio`; publika vägar `/admin`, `/lobby`, `/partner`) | Vercel, team `scoutgaming`, projekt `scoutgaming` → www.scoutgaming.tech |
| Startsida och spelskal `/game`, `/play/{game}` | `apps/web` | Vercel, samma projekt (`vercel.json` styr tjänsterna) |
| Tal | `apps/speech` | Vercel |
| Spelmotor: regler, sko, kort, saldo, `/api/table`, `/api/studio-game/command` | `services/game` | Render `croupier-v3` |
| Produktregister och konton | Neon Postgres, scheman `croupier_game`, `croupier_auth`, `croupier_studio` (SQL i `ops/neon-game`, `ops/neon-studio`) | Neon |
| Media | Vercel Blob | Blob |
| Delade tjänster | `packages/*` (presentation, storage, studio-registry, operators, navigation …) | Byggs in i båda apparna |

Isolerad staging för alla prov: Vercel `croupier-k06-k07-staging`, Render `croupier-k06-k07-staging` (suspenderad när den inte används), Neon `red-violet-36066351` / `croupier_staging`. Endast syntetiska konton. Produktion och Johns Bet-demon rörs aldrig vid tester.

Beslut: Vercel + Render + Neon + Blob är den enda vägen. Ingen SQLite, inga lokala produktregister, inga parallella QA-ytor, inga `/control`-, `/bo`- eller `/lab`-ytor. Kvarvarande rester är avvecklingsobjekt, inte bevarandekrav.

## Var saker finns

- Migrationens läge: [migrering/status.json](migrering/status.json) är enda statuskällan; [STATUS.md](migrering/STATUS.md) genereras med `node migrering/status.mjs --write`. Planen: [MASTERPLAN.md](migrering/MASTERPLAN.md). Aktivitetskriterier: [jakob-main-migrering/AKTIVITETER.md](migrering/jakob-main-migrering/AKTIVITETER.md), [kevin-ks-migrering/AKTIVITETER.md](migrering/kevin-ks-migrering/AKTIVITETER.md).
- Senaste överlämning: [docs/NEXT-AGENT.md](docs/NEXT-AGENT.md). Historik och detaljerade kvitton: [docs/JOHN-HANDOFF.md](docs/JOHN-HANDOFF.md).
- Drift och återställning: [docs/ENVIRONMENT-RESTORATION.md](docs/ENVIRONMENT-RESTORATION.md), [docs/CLOUD-MIGRATION.md](docs/CLOUD-MIGRATION.md), [docs/ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md).
- Produktbegrepp och Studio-guide: [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md), [Studio-guiden](apps/studio/docs/README.md). Lagrings- och uppspelningskontrakt: [LOCAL-PRESENTATION-RUNTIME.md](docs/LOCAL-PRESENTATION-RUNTIME.md).
- Kevins referens: branchen `kevin` (innehåller hela `kevin-staging`). Bra beteenden skrivs om i mains moduler; hans brancher och utkast-PR:er mergas aldrig.
- Inloggningar och nycklar: lokalt i gitignorerad `.env.local`, aldrig i Git eller chatt.

## Köra och testa

1. Node 24.21.0 via Volta. `npm ci` i `apps/studio`, `services/game` och `services/astrid-gpu-worker/gateway`; `pnpm install` i `apps/web`.
2. Riktade prov: `node --test --test-concurrency=4 <filer>`. Sviter: `sh .githooks/pre-commit-full <svit>` med `studio`, `admin`, `contracts`, `database`, `presentation`, `access`, `speech`, `gameplay`.
3. Pre-commit kör riktade kontroller på ändrade filer. Full regression, Chrome och isolerad Postgres körs i CI (`.github/workflows/croupier.yml`); Postgres-proven är Linux/CI-only.
4. Riktig acceptans görs i staging: Admin → spara → publicera → lobby → `/play/blackjack` → spelad hand → omladdning, med versions-, deploy- och databasidentiteter i kvittot (`docs/*-ACCEPTANCE.json`). Starta Render-stagingen bara under provet och stoppa den efteråt.
5. Ljud och läppsynk bedöms av Jakob. Hash, testpass eller kodläsning är inte AV-godkännande.

## Leverera

- Arbeta på `jakob/*`, `codex/*` eller `cursor/*`. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot. PR mot `main`; merge efter grön full CI och oberoende granskning. Ägarregler i [AGENTS.md](AGENTS.md).
- Samordna via `node tools/agent-talk.mjs status <id>` i checkouten och GitHub-tråden [#312](https://github.com/Jakeminator123/scoutgaming/issues/312).
- Markera en aktivitet VERIFIED i `status.json` först när dess kriterier är bevisade. Uppdatera `docs/NEXT-AGENT.md` vid överlämning.

## Läge 27 oktober 2026

70 % = 14/20 verifierade aktiviteter; J08 verifierades på kvällen i isolerad staging ([kvitto](docs/2026-10-27-J08-STAGING-ACCEPTANCE.json)). Nästa mål är K04, K05, K06 och K07, sedan O02 och O03. K05 kräver Jakobs AV-godkännande av PAOW:s tal i produktionen. Parallell städning: SQLite bort helt, Astrid-legacy (hårdkodat `'astrid'` i probe/chat/avbokning), `/control`-rester och dokumentationen.
