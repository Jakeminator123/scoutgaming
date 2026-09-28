# Single-host cloud runtime scaffold

This package prepares one long-lived Node host for Web and Next Lab on one
durable filesystem. A BO-to-Lab admin sign-in handoff, per-request Lab session
check, route partition, and private Lab authorization header are implemented in
this checkout. It is **blocked from starting** until public HTTPS access,
cookie behavior, persistence, and the full game/media/speech flow have been
verified on the intended host. `ops/cloud/start.mjs --start` always stops at a
code-level gate, regardless of environment variables. No image has been built
or deployed from this package.

Build context is the repository root (`docker build -f ops/cloud/Dockerfile .`).
The existing `.dockerignore` excludes local secrets and mutable data. Mount one
durable disk at an absolute path outside the checkout, supply it as
`CROUPIER_CLOUD_DATA_ROOT`, and supply secrets through the hosting platform.
The runtime derives `players`, `studio`, `generations`, and `speech` directories
on that disk. Web and Lab use the same `studio` path. Do not seed the disk from
private local databases by default. A directory check cannot prove persistence;
backup and restore, restart survival, and mount ownership need deployment tests.

Required configuration: `NODE_ENV=production`, public `PORT`, exact HTTPS
origins in `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN`, and
`BETTALOTTO_PARTNER_BASE_URL`. Game, BO, and Lab must have three distinct
hostnames; the partner base and game origin must equal `PUBLIC_URL`.
`CROUPIER_STREAM_LANE` must be `lissabon-stream-lane`.
Optional Director and product speech relay URL/token pairs are passed only to
their intended child. Optional Partner observer credentials are passed only to
Lab. Paid generated speech, camera, guest profiles, and passwordless local
profiles are disabled in this first package. `LAB_VIDEO_ARCHIVE`, if supplied,
must be an absolute existing directory and is passed identically to both apps.

The gateway would listen on one public `PORT`: exact game and BO Host headers
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
Local identity, route, and guard tests pass, but actual public-host routing and
cookie behavior remain unverified. The proxy does not support WebSocket
upgrades. This initial package deliberately disables paid speech and camera,
so it is not a complete remote Astrid experience.

`node ops/cloud/start.mjs --check` performs read-only layout validation after a
production Lab build exists. It returns 2 while launch is blocked. The launcher
would stop accepting requests, let in-flight requests drain briefly, terminate
Lab then Web, and force-stop unresponsive children. Child stdout/stderr is not
forwarded because initial startup may contain credentials. The current Web
process does not expose an explicit graceful database-close hook; restart and
in-flight transaction behavior still need an isolated deployment test.
