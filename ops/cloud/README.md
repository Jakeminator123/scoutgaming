# Cloud runtime: one game process

Vercel's `scoutgaming` project owns the public web and Studio Services, including
Admin. Render `croupier-v3` runs the authoritative game engine in
`services/game/server.mjs` behind the gateway in this directory.

```text
Browser → Vercel web / Admin / Studio
                    │ signed backend requests
                    ▼
          Render gateway → one game process
                    │
          scoped Neon data + private Blob bytes
```

The deployment recipe and dated runtime evidence are in
[RENDER-V3.md](RENDER-V3.md). The
[deployment map](../../docs/CLOUD-MIGRATION.md#ytor-och-datalagring--produktion-och-nya-qa),
[environment register](../../docs/ENVIRONMENT-VARIABLES.md) and
[restoration guide](../../docs/ENVIRONMENT-RESTORATION.md) own their respective
contracts and acceptance status.

## Image and storage

Build from the repository root:

```sh
docker build -f ops/cloud/Dockerfile.game .
```

The image contains the gateway and game runtime, with an explicit import
closure. It has no Studio/Next process, Next build or private bootstrap media.
See [CONTAINER-CONTEXT.md](CONTAINER-CONTEXT.md) for the build boundary.

Ordinary cloud startup requires PostgreSQL, the scoped Neon Studio policy and
private Blob. Runtime catalogue metadata comes from Neon, not a disk index.
The active v3 deployment has no product disk. The container entrypoint retains
its bounded mount/mountless permission checks; these are not permission to
seed a disk, copy a local database or introduce another product writer.

The combined Dockerfile and two-child startup are retired.
`CROUPIER_CLOUD_LAB_CHILD` is unnecessary; activation with `1` is rejected.
Existing private backups, media and the suspended older services are not
deleted or reactivated by this code cleanup.

## Startup and shutdown

`node ops/cloud/start.mjs --check` validates configuration and the applicable
storage/bootstrap preflight without starting a game process. It can read the
configured database. It does not prove public HTTPS, media, persistence or
restore acceptance.

`node ops/cloud/start.mjs --start` additionally requires
`CROUPIER_CLOUD_LAUNCH=pilot`. It starts one loopback game process, runs the
gateway's local access checks, then binds the public platform port. There is
no Studio build preflight or Studio child to start.

On shutdown the launcher signals the game child and drains the gateway in
parallel within the existing shutdown budget. HTTP, upgraded sockets and
provider retirement retain their own guards. Only allowlisted finite game
diagnostics pass through `child-diagnostics.mjs`; raw child output and
credentials are not forwarded. Actual restart and in-flight persistence need
their own deployment evidence.

An empty cloud authentication database still requires explicit, strong
`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD` credentials. Remove the bootstrap
credentials after the account is provisioned. Startup does not create a
named local default administrator or print a password.

## Routing and feature boundaries

The Vercel transport verifies its exact transport/public origins and signed
ingress headers. Web owns player/staff sessions and authorization; neither a
browser header nor a query parameter can substitute for these checks.
`LAB_PUBLIC_URL` remains an authentication/handoff contract, not the address
of a local Studio process.

The gateway never proxies `/studio` to a local Next server. Retained document
aliases redirect through the existing frontend flow. The separate-hosts
compatibility checks still restrict game, BO and handoff routes; they do not
create a second application process. Game launch remains server-authenticated
and preserves its operator, room and frozen package selection.

On the exact Render transport, `GET /__cloud/health` returns plain text `ok`.
`GET /__cloud/version` returns the parent deployment's validated commit SHA.
These exact paths are diagnostic endpoints; query/path variants are not
alternate health or authorization routes. Health alone proves neither
database readiness nor a complete game flow.

SSE, media ranges, authenticated WebSockets, moving callbacks and shared-room
transports retain the gateway's existing validation. Their feature flags and
application checks still decide availability.

The speech relay URL/token pair may be absent only when generated speech,
camera and moving speech are disabled. Half a pair is rejected. Without the
required runtime, chat fails as unconfigured; successful startup does not
establish speech/chat acceptance or start a paid worker.

## Historical export boundary

`storage-export.mjs` still implements the explicitly selected historical
maintenance/export modes. It runs without the game child and is not the normal
Neon/Blob startup or rollback path. Its removal requires a separate review of
the retained recovery procedure. Do not enable historical export flags or
reopen a suspended QA service to follow an old pilot recipe.

Current verification uses the existing image, runtime, ingress/session,
stream/range and shutdown tests under `ops/cloud/test`. Local checks, exact-SHA
CI, deployment readiness and application acceptance remain separate evidence.
