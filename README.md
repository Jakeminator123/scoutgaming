# Croupier

Croupier is the working blackjack demo with server-owned game state and a
shared playback path for four AI dealers. It is a development product, not a
certified RNG/RGS or a real-money system.

The focused Astrid studio and the advanced editor now share **Lab**.
See [start and architecture](lab/README.md) and the [user guide](lab/docs/README.md).
For a disposable local preview with existing films and no external providers:

```powershell
node lab/start.mjs --offline --no-open
```

[Start-Lab.cmd](Start-Lab.cmd) starts the existing connected profile.
[Start-Lissabon.cmd](Start-Lissabon.cmd) is a compatibility shortcut.
Private existing Lissabon data stay at their current location; no database is moved.
The general editor remains at `/tree`. Key names and locations
(no secret values) are listed in [_ENVIROMENT-INFO.md](_ENVIROMENT-INFO.md).
OpenClaw/Gateway and the existing Render blueprint live under [open-claw/](open-claw/README.md).

## Sources of truth

- The private [GitHub repository](https://github.com/Jakeminator123/github-work)
  is the active source on `jakemanator123-github-work`. Keep it private.
  GitLab integration is paused; `Jakobs-v1` preserves commit `600093e` on both
  services. See [migration and delivery](docs/GITHUB-MIGRATION.md).
- [Cloud preparation](docs/CLOUD-MIGRATION.md) describes the game, animation
  engine, durable storage and access changes needed to replace local hosting.
- Historical GitLab code and wiki remain as the v1 reference. New V2 work and
  documentation are delivered to GitHub only.
- [Croupier documentation · V5](https://github.com/Jakeminator123/animation-events-v1)
  is the source repository for the interactive documentation canvas. It does
  not own game outcomes or runtime contracts.
- The active repo-near V5 documentation is under
  [`docs/animation-events/v5-7-days-mvp/`](docs/animation-events/v5-7-days-mvp/README.md),
  with a [portable seven-day handoff](docs/animation-events/v5-7-days-mvp/HANDOFF-7-DAGAR.md).
  Seven remaining working days after the D0 start gate are Jakob's planning horizon, not a verified
  launch date or a new historical meeting decision.

Work on `jakemanator123-github-work`; deliver with `node tools/push-github-work.mjs`.
Kevin’s reviewed source is imported selectively; no push to his branch is authorized.

## Documentation navigation

- [Jakob's short start guide](docs/systemkarta/START-HAR.md):
  repo map, private mirror, local environment files and indexing boundary.
- [System map](docs/systemkarta/README.md): explanations by system area.
- [Findings](docs/findings/README.md): evidenced bugs, improvement proposals and open checks across this repository; implementation and QA remain in Jira CAC.
- Personal historical reports are outside the active checkout and agent reading paths.

## Runtime map

| Area | Main implementation |
| --- | --- |
| Blackjack rules and cryptographic demo shuffle | `web/public/blackjack.mjs` |
| Persistent shoe, commands and public game view | `web/shoe-game.mjs` |
| Wallet, persistence and HTTP server | `web/server.mjs` |
| Partner transport and presentation events | `web/partner-api.mjs`, `web/partner-presentation.mjs` |
| Dealer playback | `web/public/dealer-engine.mjs`, `web/public/performance-player.mjs` |
| Media build and validation | `pipeline/` |

The code has two public client paths:

- Native: server command → `/api/table` public state → client choreography.
- Partner: server command → `/api/v1/table` public state and `presentation[]`;
  the same presentation list can be delivered as `round.events` over SSE.

The Partner stream is not a monitor of native table calls. The local lab tests
saved examples and separate social chat; a live product-player connection remains
work to verify and implement for the selected client path.

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
