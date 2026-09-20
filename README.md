# Croupier

Croupier is the working blackjack demo with server-owned game state and a
shared playback path for four AI dealers. It is a development product, not a
certified RNG/RGS or a real-money system.

For the separate local presentations editor, see [Croupier Studio in `lab/`](lab/README.md).
On Windows, double-click [Start-Labb.cmd](Start-Labb.cmd). Key names and locations
(no secret values) are listed in [_ENVIROMENT-INFO.md](_ENVIROMENT-INFO.md).
OpenClaw/Gateway and the existing Render blueprint live under [open-claw/](open-claw/README.md).

## Sources of truth

- This GitLab repository is the source for game code, RNG, wallet, media and
  runtime behavior.
- The [GitLab wiki](https://gitlab.com/scout-gg/croupier/-/wikis/home) records
  shared decisions, workflow and handoffs.
- [`Jakeminator123/animation-events-v1` · V3](https://github.com/Jakeminator123/animation-events-v1/tree/v3-9-days-mvp)
  is the source repository for the interactive documentation canvas. It does
  not own game outcomes or runtime contracts.
- The active repo-near V3 documentation is under
  [`docs/animation-events/v3-9-days-mvp/`](docs/animation-events/v3-9-days-mvp/README.md).
  The path is historical; V3 is staged work, not a nine-day promise.

Jakob works on `jakeminator123/work`. Kevin owns integration decisions and the
current Croupier engine; do not push documentation work to `main` or Kevin's
branch without an agreed integration step.

## Runtime map

| Area | Main implementation |
| --- | --- |
| Blackjack rules and cryptographic demo shuffle | `web/public/blackjack.mjs` |
| Persistent shoe, commands and public game view | `web/shoe-game.mjs` |
| Wallet, persistence and HTTP server | `web/server.mjs` |
| Partner transport and presentation events | `web/partner-api.mjs`, `web/partner-presentation.mjs` |
| Dealer playback | `web/public/dealer-engine.mjs`, `web/public/performance-player.mjs` |
| Media build and validation | `pipeline/` |

The verified public flow is:

`Round/RNG` → `shoe-game command` → `public gameView` →
`Partner API presentation[]` → status-filtered player/media.

Internal round events are implementation details unless a public contract
explicitly exposes them.

## Run locally

Normal authenticated server:

```sh
node web/server.mjs
```

Temporary guest access for local product development:

```sh
sh web/preview.sh
```

The default local URL is `http://127.0.0.1:4173/`.

## Validation

The repository hook runs the media/player audits and regression suites:

```sh
.githooks/pre-commit
```

For any media or player change, also run:

```sh
node pipeline/audit-dealer-sync.mjs --probe
```

Passing hashes and tests protect against regressions but do not prove visual
quality, lip sync or physical card contact. See
[`docs/JOHN-HANDOFF.md`](docs/JOHN-HANDOFF.md) for the latest verified state and
known gaps.
