# Croupier

Croupier is the working blackjack demo with server-owned game state and a
shared playback path for four AI dealers. It is a development product, not a
certified RNG/RGS or a real-money system.

Public site: [www.scoutgaming.tech](https://www.scoutgaming.tech/). Apex
`scoutgaming.tech` is a 308 to www. The Vercel project name is `scoutgaming`.
The game engine stays on Render service `croupier-v2`.

The public surfaces are not feature-complete:

| Level | Who | Path |
| --- | --- | --- |
| 1 | Internal staff | [/control](https://www.scoutgaming.tech/control) |
| 2 | Operator | [/partner](https://www.scoutgaming.tech/partner) and `/partner/{operatorSlug}` |
| 3 | Player | [/play](https://www.scoutgaming.tech/play) and [/play/blackjack](https://www.scoutgaming.tech/play/blackjack) |

Staff tools are being gathered under `/control/clips`, `/control/administration`,
`/control/tree`, `/control/videos`, `/control/openclaw`, `/control/activity`,
`/control/guide`, `/control/zones`, `/control/events`, `/control/probe`, and
`/control/operator-chat`. Kevin's imported backoffice is only the level-2 preview.
Real operator login, tenant data, and the player lobby, profile, and history are not done.

`/studio` is the Next.js basePath of the lab service, not a fourth product and
not the name to use in the UI. `/lissabon`, `/lab`, `/labb`, and `/bo` are retired
aliases. A stream-lane flag named `lissabon-stream-lane` is not a product URL.

See [start and architecture](lab/README.md) and the [user guide](lab/docs/README.md).
The single `scoutgaming` Vercel project builds the web and lab apps as two
Services from this repository's main branch, both in Frankfurt. Render owns the
authoritative game engine and live transport. Lab admin uses native Neon policy
and private Blob. Isolated QA remains separate. Full AI/GPU acceptance,
actual partner login, and the player lobby remain open in the migration checklist.
Existing backoffice tools keep their original permissions. Observation follows the game
player's receipts; a separate lab preview requires an explicit action.
See the [current cloud and storage map](docs/CLOUD-MIGRATION.md)
and [route guide](docs/LOCAL-PRESENTATION-RUNTIME.md).
For a disposable local preview with existing films and no external providers:

```powershell
node lab/start.mjs --offline --no-open
```

[Start-Lab.cmd](Start-Lab.cmd) starts the existing connected profile.
[Start-Lissabon.cmd](Start-Lissabon.cmd) is a compatibility shortcut.
Private saved projects, history and players now live
in `lab/data`, after a verified backup outside Git. See the restoration guide.
In the cloud the general editor is `/control/tree`. Key names and locations
(no secret values) are listed in [environment variables](docs/ENVIRONMENT-VARIABLES.md).
OpenClaw/Gateway and the existing Render blueprint live under [open-claw/](open-claw/README.md).

## Sources of truth

- The private [GitHub repository](https://github.com/Jakeminator123/scoutgaming)
  is the active source on `main`. Keep it private.
  Tag `Jakobs-v1` preserves commit `600093e`. See [migration and delivery](docs/CLOUD-MIGRATION.md).
- [Cloud and storage map](docs/CLOUD-MIGRATION.md) describes services and delivery.
- GitLab inbox, wiki, and mirror are paused. New code and documentation are delivered to GitHub only.
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
contracts. Lab observation follows the native player's real playback receipts
when observation is configured. The ordinary game can be opened independently;
the lab service does not run a competing Astrid video. See the route guide above for
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
