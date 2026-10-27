# Scoutgaming

Live-dealer blackjack (and roulette) for gaming companies. Staff build dealers,
clips and scene templates in Admin and publish them to a company's rooms; players
start from the lobby; the game engine owns cards, shoe, wallet and payouts. This
is a development demo, not a certified RNG/RGS or a real-money system.

Public site: [www.scoutgaming.tech](https://www.scoutgaming.tech/). Swedish
documentation starts in [START-HERE.md](START-HERE.md); current state is in
[docs/NEXT-AGENT.md](docs/NEXT-AGENT.md).

## Surfaces

| Address | For | Served by |
| --- | --- | --- |
| `/admin` | Staff: dealers, clips, templates, companies, rooms, operations | `apps/studio` on Vercel (`/studio` is its technical basePath) |
| `/partner` | A company's own staff and rooms | `apps/studio` |
| `/lobby`, `/game?game=…`, `/play/{game}` | Players | `apps/studio` (lobby) and `apps/web` (game shell) |
| Game engine, `/api/table` | Rules, cards, wallet | `services/game` on Render `croupier-v3` |

Neon Postgres is the product registry and accounts store; private Vercel Blob
holds media. `/control` and `/lab` only redirect to `/admin`; `/bo` is gone.

## Repository map

| Folder | Responsibility |
| --- | --- |
| [`apps/studio/`](apps/studio/README.md) | Admin, partner portal, lobby and their APIs |
| [`apps/web/`](apps/web/README.md) | Landing page, game shell and ingress |
| `apps/speech/` | Speech/WebSocket ingress |
| [`services/game/`](services/game/README.md) | Authoritative game engine and game client source |
| [`services/openclaw/`](services/openclaw/README.md) | Director and OpenClaw Gateway |
| [`packages/`](packages/presentation/README.md) | Shared presentation, storage, registry, access and navigation code |
| `ops/`, `tools/` | Schema SQL, deployment and repository tools |
| `media/` | Source and review material; deployed media comes from Blob |

## Getting started

```sh
node apps/studio/start.mjs --no-open   # prints the published lobby URL; starts no local servers
```

Node 24 via Volta. Install with `npm ci` in the package you work on
(`pnpm install` in `apps/web`). Tests, delivery and merge rules are in
[START-HERE.md](START-HERE.md) and [AGENTS.md](AGENTS.md). Deliver from a
`jakob/*` branch with a pull request to `main`; never force-push.
