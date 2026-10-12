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

The staff menu has four groups (`lab/lib/scout-navigation.mjs`). Studio:
Dealers & klipp `/control/clips`, Dealer Forge `/control/dealer-forge`,
Bord & bakgrunder `/control/library`, Sammansättningar `/control/compositions`.
Spelbolag: Bolag & team `/control/companies`, Spelrum & publicering
`/control/rooms`. Drift: Spelstatus & integritet
`/control/administration?tab=operations`, Betalningar & journal `?tab=finance`.
System: Konton & åtkomst `?tab=accounts`, API & integrationer `?tab=partners`,
Agentmodeller `/control/openclaw`, Intern agentchatt `/control/openclaw?tab=chat`.
The footer is Översikt `/control` and Guide & hjälp `/control/guide`.
Provspelning & logg `/control/rehearsal` stays contextual to dealer, composition,
operator and room. Pages that remain without their own menu row: Spelhändelser
& villkor `/control/events` (overview without `?event=`, editor with it),
Klippbibliotek `/control/videos`, Svarsbibliotek `/control/replies` and Probe
`/control/probe`. `/control/preview` redirects to `/control/compositions`.
`/control/lanes` redirects to `/control/rooms`, and `?tab=companies` to
`/control/companies`. `/control/activity` redirects to `/control/rehearsal`.
`/control/zones` and `/zones` redirect to `/control/preview`, which then goes to
compositions. `/control/backgrounds` redirects to `/control/compositions`.
`/control/tree` redirects to `/control/events` with its query.
`/control/operator-chat` redirects to the chat tab. Old `lane` query values are
accepted; Studio links emit `composition`.

The partner portal is level 2. Operator staff sign in at `/partner/login` and see
only active memberships. Internal admins use the same N1 login. Normal partner
routes do not fall back to demo data. The menu is Översikt, Spelrum
(`/partner/{operatorSlug}/rooms`), Team & behörigheter and Integration.
Operators, roles and memberships are created from Bolag & team on
`/control/companies`; a new e-mail receives an activation link to
`/partner/set-password`. Company appearance (`branding`, table colour) is read
and written with `presentations.configure`, with revision checks. Players,
transactions and reports are not connected (N2.4). Chips (L4) and partner
password reset are not done.
The lobby, `/play/profil` and `/play/historik` exist. The profile can be edited
(display name and language). The lobby shows Spelar hos from `?operator=`.
Render's `/blackjack?operator=` and Vercel's `/play/blackjack?operator=` limit
lane and dealer to the package.

`/studio` is the Next.js basePath of the lab service, not a fourth product and
not the name to use in the UI. `/lissabon`, `/lab`, `/labb`, and `/bo` are retired
aliases. A stream-lane flag named `lissabon-stream-lane` is not a product URL.

See [start and architecture](lab/README.md) and the [user guide](lab/docs/README.md).
The single `scoutgaming` Vercel project builds the web and lab apps as two
Services from this repository's main branch, both in Frankfurt. Render owns the
authoritative game engine and live transport. Lab admin uses native Neon policy
and private Blob. Isolated QA remains separate. Full AI/GPU acceptance remains open in the migration checklist. Partner sign-in
and the player lobby exist. T2 and T4 are not done: the audit journal table,
chips and game data for operators remain (N2.4). Render's `/blackjack?operator=`
and Vercel's `/play/blackjack?operator=` limit lane and dealer to the package.
Neon `croupier-production` and Blob `croupier-media-private` live on the
`scoutgaming` Vercel team and are connected to the project.
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
In the cloud, dealers and clips are edited at `/control/clips`, compositions at
`/control/compositions`, and event conditions at `/control/events`. Key names and locations
(no secret values) are listed in [environment variables](docs/ENVIRONMENT-VARIABLES.md).
OpenClaw/Gateway and the existing Render blueprint live under [open-claw/](open-claw/README.md).

## Sources of truth

- The private [GitHub repository](https://github.com/Jakeminator123/scoutgaming)
  is the active source on `main`. Keep it private.
  Tag `Jakobs-v1` identifies filtered checkpoint `b9355ab`; original media history is preserved in the private recovery backup. See [recovery](docs/ENVIRONMENT-RESTORATION.md).
- [Cloud and storage map](docs/CLOUD-MIGRATION.md) describes services and delivery.
- GitLab inbox, wiki, and mirror are paused. New code and documentation are delivered to GitHub only.
- [Croupier documentation · V5](https://github.com/Jakeminator123/animation-events-v1)
  is the source repository for the interactive documentation canvas. It does
  not own game outcomes or runtime contracts.
- Repo documentation is limited to five current Markdown files in `docs/`.
  Update them in place; further reports and sprint documents are paused.

Deliver on a feature branch (`jakob/*`, `codex/*` or `cursor/*`) and open a pull
request into `main`. Those branches are the allowed push targets, without
force-push, branch deletion or tags. A direct push to `main` is only an explicit
admin emergency path. The push hook still only names `main` until that rule is
applied in the hook. This repository-cleanup work is collected on
`jakob/repo-ordning`; each wave reaches `main` as its own pull request after
Jakob’s approval.
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
| Roulette generator, result events and `/roulette-test` diagnostics (no bets or wallet) | [`web/games/roulette/`](web/games/roulette/README.md) |
| Wallet, persistence and HTTP server | `web/server.mjs` |
| Partner transport and presentation events | `web/partner-api.mjs`, `web/partner-presentation.mjs` |
| Dealer playback | Game client: `web/public/local-presentation.mjs`, `web/public/layered-presentation.mjs`, `web/public/performance-player.mjs`. `web/public/app.mjs` accepts only `local` or `layered`. Studio's original-media reserve is retired; registered video stays on the shared stage |
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

The repository hook runs the media/player checks and regression suites:

```sh
.githooks/pre-commit
```

The indexed dealer bank and `pipeline/audit-dealer-sync.mjs` are no longer in
the tree. Rehearsal of registered clips stays in the real player.

Passing hashes and tests protect against regressions but do not prove visual
quality, lip sync or physical card contact. See
[`docs/JOHN-HANDOFF.md`](docs/JOHN-HANDOFF.md) for the latest verified state and
known gaps.
