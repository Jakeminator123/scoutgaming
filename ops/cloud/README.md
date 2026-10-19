# Cloud runtime and compatibility launch

## Current deployment and storage

Vercel team/project `scoutgaming` serves the public web and Studio Services.
Render `croupier-v2` owns the authoritative game engine and live transport.
Production accounts, game state and Studio data/revisions use Neon; media and
finished speech packages use private Blob. See the current
[deployment map and acceptance](../../docs/CLOUD-MIGRATION.md#ytor-och-datalagring--produktion-och-nya-qa).

`services/game/server.mjs` selects PostgreSQL only with `CROUPIER_DATABASE=postgres`.
The retained SQLite adapter/default is for compatible local/isolated operation;
its presence does not establish which backend production uses.
`config.mjs` and `container-entry.mjs` support a mountless container with
PostgreSQL, Neon Studio policy and private Blob. They reject retired product
disk-directory settings; `config.mjs` also requires the media Blob index for
mountless operation. Do not restore an old product disk to follow the pilot
instructions below. Isolated QA and separate Director/Gateway state can still
have disks. No runtime mode, environment value or provider setting is changed
by this documentation.

## Retained single-origin compatibility mode

Set `CROUPIER_CLOUD_LAYOUT=single-origin`. The exact game origin is taken from
`PUBLIC_URL` or Render's `RENDER_EXTERNAL_URL`; BO and Lab default to that same
origin. The game stays at `/`, BO at `/bo`, and authenticated Lab at `/studio`.
Do not invent extra onrender.com subdomains. All Lab requests still require a
live admin session, checked by Web, and the private gateway header. The internal
identity endpoint remains inaccessible publicly. This mode shares a browser
origin and therefore does **not** provide three-host browser isolation.

The Dockerfile builds Lab with `CROUPIER_LAB_BASE_PATH=/studio` by default.
Next embeds this public path at build time; changing it requires a rebuild.
Startup rejects a build with a mismatched path. For the original three-host
mode, build with `--build-arg CROUPIER_LAB_BASE_PATH=` and select
`CROUPIER_CLOUD_LAYOUT=separate-hosts` (the config's compatibility default).
Local development still uses an empty base path.

For the disk-backed compatibility mode, the image uses `/var/data` with
`CROUPIER_CLOUD_DATA_ROOT=/var/data`; this is not required by the mountless
Neon/Blob production mode above. The entrypoint can adjust ownership of
only that exact directory, then drops root and supplementary groups before
loading the application. It never recursively changes ownership or seeds
private databases. Already non-root launches must be the image's node user.
Disk persistence and startup must be verified for the specific isolated deployment.

## 2026-09-29: explicit pilot launch

The following records the original pilot and retained compatibility paths,
not the current production topology or its acceptance status. Consult the
deployment map above for subsequent Neon/Blob migration and dated receipts.

The former unconditional stop has been replaced by an explicit
`CROUPIER_CLOUD_LAUNCH=pilot` selection. This is not production acceptance.
`--check` now returns 0 for valid configuration, disk access, bootstrap and Lab
build checks; it starts nothing and does not prove public access or durability.
`--start` starts the two loopback children, temporarily binds the gateway to
loopback, and checks anonymous player/BO/Lab rejection, a forged Lab session,
host isolation and the actual Lab guard. Only after these pass does it bind
the public port. A failed check stops startup and its children.

Keep the first deployment limited to demo users and empty player data. Real
HTTPS login, cookies, a complete game round, media, restart survival and
database backup/restore must still be accepted on the chosen host. GPU and
camera retain their separate opt-in flags; selecting pilot does not enable
either. No service, image publication or paid job was created by this change.
See [current delivery and remaining acceptance](../../docs/CLOUD-MIGRATION.md).

The original pilot prepared one long-lived Node host for Web and Next Lab on
one durable filesystem. A BO-to-Lab admin sign-in handoff, per-request Lab session
check, route partition, and private Lab authorization header are implemented in
this checkout. The explicit pilot launch enables host verification without
claiming the public HTTPS, persistence or full media flow already works.
No image has been built or deployed from this package as part of this change.

Build context is the repository root (`docker build -f ops/cloud/Dockerfile .`).
The existing `.dockerignore` excludes local secrets and mutable data. Supply
secrets through the hosting platform. The current config derives `players`
under `CROUPIER_CLOUD_DATA_ROOT` only for SQLite or explicit storage export;
the former shared `studio`, `generations` and `speech` product directories are
retired. Do not seed a compatibility disk from private local databases.
A directory check cannot prove persistence; use the
[backup and restoration rules](../../docs/ENVIRONMENT-RESTORATION.md).

For **separate-hosts**, required configuration: `NODE_ENV=production`, public `PORT`, exact HTTPS
origins in `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN`, and
`BETTALOTTO_PARTNER_BASE_URL`. Game, BO, and Lab must have three distinct
hostnames; the partner base and game origin must equal `PUBLIC_URL`.
`CROUPIER_STREAM_LANE` must be `lissabon-stream-lane`.
The product speech relay URL/token pair is required; the Director URL/token
pair is optional. Each pair reaches only its intended child. Optional Partner
observer credentials are passed only to Lab. Guest profiles and passwordless
local profiles are disabled. `OPENCLAW_TIMEOUT_MS` defaults to 8000 and must
be between 1000 and 30000. On a new empty CRAIG database, provide a strong
`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD` pair through host secrets for
the first boot, then remove it after the account is created. Never put those
values in Git or command logs. `LAB_VIDEO_ARCHIVE`, if supplied,
must be an absolute existing directory and is passed identically to both apps.

Camera and transcription are off by default. Opt in with
`CROUPIER_ASTRID_CAMERA=1` and a dedicated Web-only
`CROUPIER_ASTRID_TRANSLATION_KEY`. Whisper translation returns English.
Image understanding additionally requires verified Luna/Terra vision support
on the deployed external OpenClaw Gateway. Nonstream generated speech/video
is also off by default; opt in with both `CROUPIER_GENERATED_SPEECH=1` and
`CROUPIER_CLOUD_GENERATED_SPEECH=1`, plus Web-only Cartesia and RunPod
credentials and `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. The Web child listens
on loopback behind the guarded HTTPS gateway. The gateway now forwards only
the two exact game-host WebSocket speech routes to Web's authenticated relay
when streaming is explicitly configured. Cloud launch requires pilot opt-in;
real HTTPS, cookies, provider calls and GPU playback have not passed QA.

In **separate-hosts** mode the gateway listens on one public `PORT`: exact game and BO Host headers
route to loopback Web, and the exact Lab Host routes to loopback Next. On the
game Host, only the exact `GET /api/bo/config` BO route remains available for
the game UI; other `/bo` and `/api/bo` routes are rejected. The BO Host serves
only BO UI/API routes. The Lab Host reserves `/api/auth/lab/start` and
`/api/auth/lab/callback` for a Web-backed sign-in handoff, while
`/api/auth/lab/check` is never publicly routed. The gateway preserves public
Host and Origin, strips untrusted forwarding and Lab-authorization headers,
and streams response bodies including SSE and media ranges. Unknown hosts and
proxy-style request targets are rejected. All three public origins require
platform HTTPS in front of this HTTP listener. The gateway checks each Lab
request against the current CRAIG admin identity in Web over loopback. A valid
check makes the gateway add a runtime-generated secret header to Next Lab;
the Lab guard accepts the exact public Lab Host only with that header and the
expected HTTPS forwarding headers. A new Lab session comes from an admin BO
cookie through a one-use handoff code; Lab gets a host-only HttpOnly cookie.
BO and Lab sessions carry a monotonic CRAIG auth epoch so an old session stays
revoked after a role or password is changed back. Public Lab handoff starts are
rate limited and capped in persistent state.
Local identity, route, guard and loopback WebSocket upgrade tests pass, but
actual public-host routing, cookies and WebSocket behavior remain unverified.
Camera and paid media have explicit opt-in configuration, but
their provider and browser paths have not passed a staged deployment test;
this is not yet a complete remote Astrid experience.

Variable placement and remaining acceptance are documented in the
[current environment register](../../docs/ENVIRONMENT-VARIABLES.md) and
[cloud acceptance checklist](../../docs/CLOUD-MIGRATION.md). The two stream
secrets must differ and reach only Web; RunPod receives the worker token as a
private sessionsjobb input. No paid worker is started by this package.

`node ops/cloud/start.mjs --check` performs read-only layout validation after a
production Lab build exists. It also rejects an empty or missing CRAIG database
without bootstrap credentials. It returns 0 only for these local checks. The launcher
would stop accepting requests, let in-flight requests drain briefly, terminate
Lab then Web, and force-stop unresponsive children. Child stdout and stderr
are discarded, except for the allowlist in `child-diagnostics.mjs` applied to
both streams (the game emits these with `console.warn`, i.e. stderr): finite moving-speech/drift events
(`moving_drift_guard_rejected`, `moving_drift_readback_*`,
`moving_speech_preparation_failed`, `moving_speech_stream_interrupted`,
`moving_speech_recovery`) whose fields are enums, safe application codes or
bounded identifiers, at most 2000 lines per process, tagged `source:"game"`.
Startup lines, timing traces with free text and anything containing
credentials still never reach the platform log. The current Web
process does not expose an explicit graceful database-close hook; restart and
in-flight transaction behavior still need an isolated deployment test.
