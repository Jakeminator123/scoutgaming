# Scoutgaming / Croupier

Croupier is the working casino demo with server-owned game state and shared
playback for registered dealers. Start with blackjack; roulette has its own
server and presentation contracts. Current acceptance and unfinished work are
recorded in [the handoff](docs/JOHN-HANDOFF.md). This development demo is not a
certified RNG/RGS or a real-money system.

Public site: [www.scoutgaming.tech](https://www.scoutgaming.tech/).
The single Vercel project **scoutgaming**, on team **scoutgaming**, builds the
frontend and Studio Services. Render service **croupier-v2** owns the game
engine and live transport. See [cloud and storage](docs/CLOUD-MIGRATION.md).

## Product entry points

| Surface | Current entry | Transition |
| --- | --- | --- |
| Internal administration | `/admin` | New backoffice. Existing `/control` links remain compatible; many redirect to the corresponding `/admin` tool while retaining page context and permission checks. |
| Operator portal | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | Real registered operators and scoped memberships; ordinary routes do not use demo fallback data. |
| Player lobby | `/lobby` | New lobby. Existing `/play`, `/play/profil`, `/play/historik` and `/play/blackjack` remain during the transition. |

`/admin` and `/lobby` are served by the Lab service from
`packages/design-preview/`. Their names do not imply that every old workflow
has moved. The lobby launches the existing game engine; it does not replace it.
Partner team access and branding drafts exist. Operator game data/reports,
chips and partner password reset still have open work; consult the cloud
checklist before calling a surface complete.

`/studio` is the Lab service's Next.js basePath. It is not another product.
`/lissabon`, `/lab`, `/labb` and `/bo` are retired product aliases. Some stored
IDs, filenames and the `lissabon-stream-lane` flag remain compatibility details.
Keep a compatibility path while active callers or saved data need it; the name
alone is no reason to keep an obsolete page or parallel registry. New UI work
belongs in `/admin` and `/lobby`; the [user guide](lab/docs/README.md) covers
active entry points, operator access, compatibility redirects and working tools.

## Source and folder map

| Folder | Responsibility | Guide |
| --- | --- | --- |
| `apps/croupier-frontend/` | Public Next frontend, player pages and ingress to the game/Studio services | [Frontend](apps/croupier-frontend/README.md) |
| `lab/` | Active Studio/Admin service, staff/operator APIs, published-product launcher and offline fixtures | [Lab](lab/README.md) |
| `web/` | Authoritative game server, authentication, wallet, persistence and game client source | [Game server](web/README.md) |
| `packages/presentation/` | Shared compositor, presentation selection, idle rules and reviewed layer preview | [Presentation](packages/presentation/README.md) |
| `packages/design-preview/` | Active admin/lobby UI source and browser bundle builder | [Admin/lobby](packages/design-preview/README.md) |
| `services/astrid-gpu-worker/` | GPU lip sync plus shared speech transport; the historical name does not restrict sessions to Astrid | [Speech service](services/astrid-gpu-worker/README.md) |
| `tools/media/` | Media utilities with separate inputs, banks and export formats | [Media tools](tools/media/README.md) |
| `media/` | Source/review/staging material and import manifests; deployed registry data comes from Neon and media bytes from Blob | [Media and restoration](docs/ENVIRONMENT-RESTORATION.md#media-och-regression) |
| `open-claw/` | OpenClaw/Gateway integration and its deployment tools | [OpenClaw](open-claw/README.md) |
| `ops/`, `tools/` | Deployment, migration, import and repository utilities | [Cloud](docs/CLOUD-MIGRATION.md), [container context](ops/cloud/CONTAINER-CONTEXT.md) |
| `test/`, `lab/test/` | Game/shared-service regression and Studio/API tests; component tests also live beside their source | [Verification](AGENTS.md#verification-during-editing) |

[AI documentation](docs/AI/README.md) collects agent flows and OpenClaw guides.

These are source responsibilities, not independent products. For example,
Vercel's `web` Service builds `apps/croupier-frontend/`; the root `web/` folder
is the game server and client. Imports still cross some app/package boundaries;
a neutral package name alone does not make that code independent.

There is no tracked root `random/` folder. Ignore rules allow private local
backups/screenshots there; those files are not project instructions. Personal
archives and conversation exports stay outside active agent reading paths.

## Runtime and shared terms

[TERMINOLOGI](lab/docs/TERMINOLOGI.md) is the single source for the product
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

`web/server.mjs` owns cards, shoe, wallet and payouts. Native commands expose
public state through `/api/table`; partner commands use `/api/v1/table` and
`presentation[]` (also delivered as `round.events` over SSE). The game client
uses the shared local/layered presentation path. Studio observation follows
the player's real receipts; a separate preview needs an explicit action.
Generated speech uses the registered dealer's profile and the speech gateway,
not an independent Lab player. The retained full-file GPU path is Astrid-specific.

## Open the product or an isolated fixture

To print the published lobby URL from Codex:

```powershell
node lab/start.mjs --no-open
```

This starts no local servers or registry. Only an explicit offline start creates
an isolated temporary server pair without external providers:

```powershell
node lab/start.mjs --offline --no-open
```

The offline launcher enforces one fixture pair and removes its temporary data
when stopped. Existing `lab/data` authoring/recovery files are preserved and do
not become product state. The old `--cloud-storage`, `--astrid-camera` and
`--check` modes are retired; `--skip-build` requires `--offline`.
Check the package's Node engine and Volta pin before local scripts; `lab/`
requires Node 24.x and pins 24.21.0. See the [user guide](lab/docs/README.md)
for fixture options and the [Lab guide](lab/README.md) for development setup.

`node_modules/` contains installed dependencies; `.next/` contains Next build
output and cache. Both are normal local generated folders and excluded from
Git/indexing. Reinstall/rebuild if removed with the relevant process stopped.
`lab/preview-build/` and `lab/design-preview-build/` are also generated;
`packages/presentation/preview/site/` and the tracked `web/public/` sources are
build inputs. Keep manifests, lockfiles, calibration and source media.

## Documentation and delivery

The active source is [Jakeminator123/scoutgaming](https://github.com/Jakeminator123/scoutgaming),
branch `main`. The old `github-work` address redirects here. GitLab inbox, wiki
and mirror are paused; reviewed upstream code is imported selectively.

Use these documents in place instead of adding competing status reports:

- [Handoff and open acceptance](docs/JOHN-HANDOFF.md).
- [Cloud migration and delivery](docs/CLOUD-MIGRATION.md).
- [Data restoration and media rules](docs/ENVIRONMENT-RESTORATION.md).
- [Environment variable registry](docs/ENVIRONMENT-VARIABLES.md).
- [Presentation runtime](docs/LOCAL-PRESENTATION-RUNTIME.md).
- [Game manuals](docs/games/README.md) and the [user guide](lab/docs/README.md).

Deliver from `jakob/*`, `codex/*` or `cursor/*` with one pull request to `main`.
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
