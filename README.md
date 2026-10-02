# Croupier

Croupier is the working blackjack demo with server-owned game state and a
shared playback path for four AI dealers. It is a development product, not a
certified RNG/RGS or a real-money system.

The focused Astrid studio, advanced editor and administration share **Backoffice/Lab**.
See [start and architecture](lab/README.md) and the [user guide](lab/docs/README.md).
The cloud entry is [Croupier on Vercel](https://www.scoutgaming.tech/).
[The game](https://www.scoutgaming.tech/game) and
[Backoffice/Lab](https://www.scoutgaming.tech/studio) share that origin.
Render owns the game engine, APIs and persistent projects. Existing BO tools are available under
Administration with their original permissions. Observation follows the game
player's receipts; a separate Lab preview requires an explicit action.
See the [current cloud and storage map](docs/CLOUD-MIGRATION.md)
and [route guide](docs/LOCAL-PRESENTATION-RUNTIME.md).
For a disposable local preview with existing films and no external providers:

```powershell
node lab/start.mjs --offline --no-open
```

[Start-Lab.cmd](Start-Lab.cmd) starts the existing connected profile.
[Start-Lissabon.cmd](Start-Lissabon.cmd) is a compatibility shortcut.
Lissabon has been removed. Private saved projects, history and players now live
in `lab/data`, after a verified backup outside Git. See the restoration guide.
The general editor remains at `/tree`. Key names and locations
(no secret values) are listed in [environment variables](docs/ENVIRONMENT-VARIABLES.md).
OpenClaw/Gateway and the existing Render blueprint live under [open-claw/](open-claw/README.md).

## Sources of truth

- The private [GitHub repository](https://github.com/Jakeminator123/github-work)
  is the active source on `main`. Keep it private.
  GitLab integration is paused; `Jakobs-v1` preserves commit `600093e` on both
  services. See [migration and delivery](docs/CLOUD-MIGRATION.md).
- [Cloud and storage map](docs/CLOUD-MIGRATION.md) describes services and delivery.
- Historical GitLab references do not authorize inbox, wiki or mirror work.
  New code and documentation are delivered to GitHub only.
- [Croupier documentation · V5](https://github.com/Jakeminator123/animation-events-v1)
  is the source repository for the interactive documentation canvas. It does
  not own game outcomes or runtime contracts.
- Repo documentation is limited to five current Markdown files in `docs/`.
  Update them in place; further reports and sprint documents are paused.

Work on `main`; deliver with `node tools/push-github-work.mjs`.
Kevin’s reviewed source is imported selectively; no push to his branch is authorized.

## Documentation navigation

- [Latest verified work and open checks](docs/JOHN-HANDOFF.md).
- [Deployment and storage map](docs/CLOUD-MIGRATION.md).
- [Data restoration and media rules](docs/ENVIRONMENT-RESTORATION.md).
- [Environment variable registry](docs/ENVIRONMENT-VARIABLES.md).
- [Presentation runtime](docs/LOCAL-PRESENTATION-RUNTIME.md).

Keep these five documents short and update in place. New reports and sprint
documentation are paused. Personal archives remain outside agent reading paths.

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

The Partner transport and the native player's observation feed have different
contracts. Astrid Studio follows the native player's real playback receipts
when observation is configured. The ordinary game can be opened independently;
Studio does not run a competing Astrid video. See the route guide above for
recorded media, observation and generated speech streams.

Internal round events are implementation details unless a public contract
explicitly exposes them.

## Run locally

Use the coordinated `node lab/start.mjs --offline --no-open` launcher shown
above for an isolated, temporary preview. Use `Start-Lab.cmd` for the saved
connected profile. Both go through the shared session guard. Stop the current
product/Lab pair before changing environments; never bypass the guard with
a direct server command or another port. A stopped environment stays stopped
until a new start is requested. Follow [the user guide](lab/docs/README.md)
for current commands and the actual addresses printed by the launcher.

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
