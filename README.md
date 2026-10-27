# Scoutgaming / Croupier

Croupier is the working casino demo with server-owned game state and shared
playback for registered dealers. Start with blackjack; roulette has its own
server and presentation contracts. Start with [START-HERE.md](START-HERE.md). Current acceptance and next steps are
recorded in [the current handoff](docs/NEXT-AGENT.md); dated receipts live in
[JOHN-HANDOFF](docs/history/JOHN-HANDOFF-2026-10.md). This development demo is not a
certified RNG/RGS or a real-money system.

Public site: [www.scoutgaming.tech](https://www.scoutgaming.tech/).
The single Vercel project **scoutgaming**, on team **scoutgaming**, builds the
frontend and Studio Services. Render service **croupier-v3** owns the game
engine and live transport. See [cloud and storage](docs/CLOUD-MIGRATION.md).

## Product entry points

| Surface | Current entry | Transition |
| --- | --- | --- |
| Internal administration | `/admin` | New backoffice. Existing `/control` links remain compatible; many redirect to the corresponding `/admin` tool while retaining page context and permission checks. |
| Operator portal | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | Real registered operators and scoped memberships; ordinary routes do not use demo fallback data. |
| Player lobby | `/lobby` | The lobby links every room to the one game start `/game?game=blackjack|roulette&operator=…&table=…`. `/play/profil` and `/play/historik` remain the player area; `/play`, `/play/blackjack`, `/blackjack` and `/roulette` are permanent redirects for one release. |
| Game start | `/game` | Blackjack is proxied from the engine after the live session check. A roulette room is sent (307) to the engine document `/play/roulette?operator=&table=`, which stays the roulette address until the engine client stops posting the page query as its room context. `/player-login` is the player sign-in. `/v2`, `/bo`, `/casino.html`, `/demo` and `/labb-lissabon` are gone (404). |

`/admin` and `/lobby` are served by the Studio service from
`apps/studio/client/`. Their names do not imply that every old workflow
has moved. The lobby launches the existing game engine; it does not replace it.
Partner team access and branding drafts exist. Operator game data/reports,
chips and partner password reset still have open work; consult the cloud
checklist before calling a surface complete.

`/studio` is the Studio service's Next.js basePath. It is not another product.
`/lissabon`, `/lab`, `/labb` and `/bo` are retired product aliases. Some stored
IDs, filenames and the `lissabon-stream-lane` flag remain compatibility details.
Keep a compatibility path while active callers or saved data need it; the name
alone is no reason to keep an obsolete page or parallel registry. New UI work
belongs in `/admin` and `/lobby`; the [user guide](apps/studio/docs/README.md) covers
active entry points, operator access, compatibility redirects and working tools.

## Source and folder map

| Folder | Responsibility | Guide |
| --- | --- | --- |
| `apps/web/` | Public Next frontend, player pages and ingress to the game/Studio services | [Frontend](apps/web/README.md) |
| `apps/speech/` | Long-running speech/WebSocket ingress with its own Node 22 runtime | [Deployment](docs/CLOUD-MIGRATION.md) |
| `apps/studio/` | Active Studio/Admin service, staff/operator APIs, published-product launcher and offline fixtures | [Studio](apps/studio/README.md) |
| `services/game/` | Authoritative game server, authentication, wallet, persistence and game client source | [Game server](services/game/README.md) |
| `packages/presentation/` | Shared playback, presentation selection, browser contracts and generated-speech server cores | [Presentation](packages/presentation/README.md) |
| `packages/shared/` | Portable media rules, Studio game-command signing and the pure shoe rule; game owns shuffle, wallet and payouts | [Media formats](docs/games/KLIPP-OCH-FORMAT.md) |
| `packages/director/` | Shared Director, speech and social contracts; callers own transport, environment and state | [director](packages/director/) |
| `packages/navigation/` | Shared public entry, redirect and player handoff contracts | [navigation](packages/navigation/) |
| `packages/operators/` | Shared operator identity, access and lifecycle rules | [operators](packages/operators/README.md) |
| `packages/player-catalog/` | Shared player-facing catalogue projection | [player-catalog](packages/player-catalog/) |
| `packages/server-transport/` | Shared HTTP and request parsing primitives | [server-transport](packages/server-transport/) |
| `packages/storage/` | Shared PostgreSQL transaction and SQL core; apps own pools and schema inputs | [storage](packages/storage/README.md) |
| `packages/studio-access/` | Shared identity, scope and permission rules; apps own sessions and HTTP | [studio-access](packages/studio-access/README.md) |
| `packages/studio-registry/` | Shared registry, media and publication contracts and repositories | [studio-registry](packages/studio-registry/README.md) |
| `apps/studio/client/` | Active admin/lobby UI source and browser bundle builder | [Admin/lobby](apps/studio/client/README.md) |
| `services/astrid-gpu-worker/` | GPU lip sync plus shared speech transport; the historical name does not restrict sessions to Astrid | [Speech service](services/astrid-gpu-worker/README.md) |
| `tools/media/` | Media utilities with separate inputs, banks and export formats | [Media tools](tools/media/README.md) |
| `media/` | Source/review/staging material and import manifests; deployed registry data comes from Neon and media bytes from Blob | [Media and restoration](docs/ENVIRONMENT-RESTORATION.md#media-och-regression) |
| `services/openclaw/` | OpenClaw/Gateway integration and its deployment tools | [OpenClaw](services/openclaw/README.md) |
| `ops/`, `tools/` | Deployment, migration, import and repository utilities | [Cloud](docs/CLOUD-MIGRATION.md), [container context](ops/cloud/CONTAINER-CONTEXT.md) |
| `test/`, `apps/studio/test/` | Game/shared-service regression and Studio/API tests; component tests also live beside their source | [Verification](AGENTS.md#verification-during-editing) |

[AI documentation](docs/AI/README.md) collects agent flows and OpenClaw guides.

These are source responsibilities, not independent products. For example,
Vercel's `web` Service builds `apps/web/`; the `services/game/` folder
is the game server and client. Imports still cross some app/package boundaries;
a neutral package name alone does not make that code independent.

There is no tracked root `random/` folder. Ignore rules allow private local
backups/screenshots there; those files are not project instructions. Personal
archives and conversation exports stay outside active agent reading paths.

## Runtime and shared terms

[TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md) is the single source for the product
model, ownership and the terms bolag, spel, rum, bakgrund, dealer, bord and
sammansättning. Do not derive another model from folder names or legacy lane
fields. [LOCAL-PRESENTATION-RUNTIME](docs/LOCAL-PRESENTATION-RUNTIME.md)
records the implemented storage/runtime limits and media formats. Keep
published package, room, dealer and asset identities stable during transition.
Neon is the product registry for saved configuration, media catalogue and reply
metadata; private Blob stores media bytes. Local source files and authoring
exports are not a runtime fallback. Dragan is the ordinary dealer; Astrid is a
labelled legacy reference without a three-layer version. Her exact media and
working speech flows remain useful reference material on the same cloud path.
Shared composition drafts are not room-specific writes; allowed room appearance
is saved through the existing scoped partner room editor.

`services/game/server.mjs` owns cards, shoe, wallet and payouts. Native commands expose
public state through `/api/table`; partner commands use `/api/v1/table` and
`presentation[]` (also delivered as `round.events` over SSE). The game client
uses the shared local/layered presentation path. Studio observation follows
the player's real receipts; a separate preview needs an explicit action.
Generated speech uses the registered dealer's profile and the speech gateway,
not an independent Lab player. The retained full-file GPU path is Astrid-specific.

## Open the product

To print the published lobby URL from Codex:

```powershell
node apps/studio/start.mjs --no-open
```

This starts no local servers or registry. The checkout holds no local product
register: Neon is the register and Blob stores media bytes. The SQLite-backed
offline fixture (`--offline`, `--skip-build`) and the old `--cloud-storage`,
`--astrid-camera` and `--check` modes are retired; isolated trials run on
staging or in CI's isolated Postgres.
Check the package's Node engine and Volta pin before local scripts; `apps/studio/`
requires Node 24.x and pins 24.21.0. See the [user guide](apps/studio/docs/README.md)
for start options and the [Lab guide](apps/studio/README.md) for development setup.

`node_modules/` contains installed dependencies; `.next/` contains Next build
output and cache. Both are normal local generated folders and excluded from
Git/indexing. Reinstall/rebuild if removed with the relevant process stopped.
`apps/studio/preview-build/` and `apps/studio/design-preview-build/` are also generated;
`packages/presentation/preview/site/` and the tracked `services/game/public/` sources are
build inputs. Keep manifests, lockfiles, calibration and source media.

## Documentation and delivery

The active source is [Jakeminator123/scoutgaming](https://github.com/Jakeminator123/scoutgaming),
branch `main`. The old `github-work` address redirects here. GitLab inbox, wiki
and mirror are paused; reviewed upstream code is imported selectively.

Use these documents in place instead of adding competing status reports:

- [Current handoff and next steps](docs/NEXT-AGENT.md); dated history in [JOHN-HANDOFF](docs/history/JOHN-HANDOFF-2026-10.md).
- [Cloud migration and delivery](docs/CLOUD-MIGRATION.md).
- [Data restoration and media rules](docs/ENVIRONMENT-RESTORATION.md).
- [Environment variable registry](docs/ENVIRONMENT-VARIABLES.md).
- [Presentation runtime](docs/LOCAL-PRESENTATION-RUNTIME.md).
- [Game manuals](docs/games/README.md) and the [user guide](apps/studio/docs/README.md).

Deliver from a `jakob/*` branch with one pull request to `main`.
`tools/repository-policy.json` and the pre-push hook enforce the allowed targets;
`node tools/push-github-work.mjs` pushes the feature branch. Direct `main` push
requires the explicit emergency option. Never force-push or push to Kevin's branch.

Local commits run changed-file checks and available nearby tests through
`.githooks/pre-commit`; `node tools/precommit-checks.mjs --plan` shows the selection.
Run additional relevant tests when shared behavior changes. Full regression
and frontend typechecking run in CI, or explicitly with
`sh .githooks/pre-commit --full`; they are not required for every intermediate
local commit. Focused passes and matching hashes do not establish complete
runtime, visual lip sync or card contact acceptance. Follow [AGENTS.md](AGENTS.md)
for the verification and delivery requirements.
