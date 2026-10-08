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
| 3 | Player | [/play](https://www.scoutgaming.tech/play), [/play/profil](https://www.scoutgaming.tech/play/profil), [/play/historik](https://www.scoutgaming.tech/play/historik) and [/play/blackjack](https://www.scoutgaming.tech/play/blackjack) |

Staff pages share one template: Översikt `/control`, Dealers & klipp
`/control/clips`, Klippbibliotek `/control/videos`, Bakgrundszoner `/control/zones`,
Händelser `/control/events` (overview without `?event=`, editor with it),
Förhandsvisning `/control/preview`, Lanes `/control/lanes`, Agentmodeller `/control/openclaw`,
Operatörschatt `/control/openclaw?tab=chat`, Administration
`/control/administration` with four deep links to its tabs, Uppspelning
`/control/activity`, Probe `/control/probe` and Guide & hjälp `/control/guide`.
`/control/tree` redirects to `/control/events` with its query. `/control/operator-chat`
redirects to the chat tab. `/control/backgrounds` redirects to `/control/zones`.

The Partnerportal is level 2. Operator staff sign in at `/partner/login` and see
a scoped snapshot. Internal staff without `partner_session` still see the demo
preview. Players and transactions are not connected (L10). Company appearance
(`branding`) can be read and written within the lane, but the write requires
roles (N2.2). The lobby, `/play/profil` and `/play/historik` exist. The profile
can be edited (display name and language). The lobby shows Spelar hos from
`?operator=`. Render's `/blackjack?operator=` limits lane and dealer to the
package; Vercel's `/play/blackjack` does not yet.

`/studio` is the Next.js basePath of the lab service, not a fourth product and
not the name to use in the UI. `/lissabon`, `/lab`, `/labb`, and `/bo` are retired
aliases. A stream-lane flag named `lissabon-stream-lane` is not a product URL.

See [start and architecture](lab/README.md) and the [user guide](lab/docs/README.md).
The single `scoutgaming` Vercel project builds the web and lab apps as two
Services from this repository's main branch, both in Frankfurt. Render owns the
authoritative game engine and live transport. Lab admin uses native Neon policy
and private Blob. Isolated QA remains separate. Full AI/GPU acceptance remains open in the migration checklist. Partner sign-in
and the player lobby exist. T2 and T4 are not done: onboarding, the audit journal
and game data remain (L2, L10). Render's `/blackjack?operator=` limits lane and
dealer to the package; Vercel's `/play/blackjack` does not yet.
Existing backoffice tools keep their original permissions. Observation follows the game
player's receipts; a separate lab preview requires an explicit action.
See the [current cloud and storage map](docs/CLOUD-MIGRATION.md)
and [route guide](docs/LOCAL-PRESENTATION-RUNTIME.md).
For a disposable local preview with existing films and no external providers:

```powershell
node lab/start.mjs --offline --no-open
```

`node lab/start.mjs --no-open` starts the existing connected profile.
Private saved projects, history and players now live
in `lab/data`, after a verified backup outside Git. See the restoration guide.
In the cloud the general editor is `/control/events`. Key names and locations
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

Use `node lab/start.mjs --offline --no-open` shown
above for an isolated, temporary preview. Use `node lab/start.mjs --no-open` for the saved
connected profile. Both go through `acquireLocalSession` in
`open-claw/lab/deploy/local-session.mjs`. Stop the current
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
