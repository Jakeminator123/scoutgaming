# Single-host cloud runtime scaffold

This package prepares one long-lived Node host for Web and Next Lab on one
durable filesystem. It is **blocked from starting** until authenticated public
access is implemented and reviewed. `ops/cloud/start.mjs --start` always stops
at a code-level gate, regardless of environment variables. No image has been
built or deployed from this package.

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
`BETTALOTTO_PARTNER_BASE_URL`; `BO_URL`, partner base, and game origin must all
equal `PUBLIC_URL`. `CROUPIER_STREAM_LANE` must be
`lissabon-stream-lane`. Game and Lab origins must have different hostnames.
Optional Director and product speech relay URL/token pairs are passed only to
their intended child. Optional Partner observer credentials are passed only to
Lab. Paid generated speech, camera, guest profiles, and passwordless local
profiles are disabled in this first package. `LAB_VIDEO_ARCHIVE`, if supplied,
must be an absolute existing directory and is passed identically to both apps.

The gateway would listen on one public `PORT`, route exact game/Lab Host headers
to separate loopback processes, preserve public Host and Origin, strip untrusted
forwarding headers, and stream response bodies including SSE and media ranges.
Unknown hosts and proxy-style request targets are rejected. Both public origins
require platform HTTPS in front of this HTTP listener. The gateway does not
authenticate requests. The current Lab guard rejects public hostnames. BO JWT
audience and current-identity checks have been tightened in this checkout, but
public-host routing and cookie behavior remain unverified; do not remove the
start gate until authenticated Lab access and those tests are complete. The proxy does not
support WebSocket upgrades.

`node ops/cloud/start.mjs --check` performs read-only layout validation after a
production Lab build exists. It returns 2 while launch is blocked. The launcher
would stop accepting requests, let in-flight requests drain briefly, terminate
Lab then Web, and force-stop unresponsive children. Child stdout/stderr is not
forwarded because initial startup may contain credentials. The current Web
process does not expose an explicit graceful database-close hook; restart and
in-flight transaction behavior still need an isolated deployment test.
