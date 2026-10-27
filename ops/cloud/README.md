# Cloud runtime: one game process

Vercel's `scoutgaming` project runs the public web, Admin (Studio) and speech services. Render `croupier-v3` runs the game engine (spelmotorn), `services/game/server.mjs`, behind the gateway in this directory.

```text
Browser → Vercel web / Admin / speech
                    │ signed backend requests
                    ▼
          Render gateway → one game process
                    │
          scoped Neon data + private Blob bytes
```

The service, deploy and checks are in [RENDER-V3.md](RENDER-V3.md), the build boundary in [CONTAINER-CONTEXT.md](CONTAINER-CONTEXT.md), the deployment map in [CLOUD-MIGRATION](../../docs/CLOUD-MIGRATION.md#ytor-och-datalagring), variables in [ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md) and backup and rollback in [ENVIRONMENT-RESTORATION](../../docs/ENVIRONMENT-RESTORATION.md).

## Files

| File | Role |
| --- | --- |
| `Dockerfile.game` | The only image: game engine and gateway, explicit COPY list, no Studio or Next build |
| `start.mjs` | `--check` validates configuration; `--start` (requires `CROUPIER_CLOUD_LAUNCH=pilot`) starts one loopback game process, runs local access checks and binds `PORT` |
| `config.mjs` | Validates the process environment and refuses retired or unsafe keys |
| `gateway.mjs`, `vercel-ingress.mjs` | Public listener, signed Vercel ingress, `/__cloud/health` and `/__cloud/version` |
| `container-entry.mjs` | Entrypoint: fixes only the exact mount directory, then drops root |
| `process-group.mjs`, `child-diagnostics.mjs` | Child process supervision and the allowlist of finite diagnostics that reach the log |
| `access-check.mjs` | Read-only local access probes before the public port opens |
| `lab-session-check.mjs` | Loopback session check the gateway asks the game process for staff requests |
| `storage-export.mjs` | Historical PostgreSQL `studio-export` freeze only; not a startup or rollback path |
| `test/` | Image, startup, ingress/session, stream/range and shutdown tests |

## Runtime rules

- Startup requires PostgreSQL, the scoped Neon Studio policy and private Blob. Catalogue metadata comes from Neon, never from a disk index or files in the image.
- The service has no disk. The entrypoint's mount checks are not permission to seed a disk, copy a local database or add another writer.
- `CROUPIER_CLOUD_LAB_CHILD` is retired; anything other than empty or `0` stops startup. There is no Studio child and the gateway never proxies `/studio` to a local Next server; old document links redirect to Vercel.
- An empty authentication database needs strong `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD` once; remove them after the first administrator exists. Startup never creates a default administrator or prints a password.
- The speech relay pair `OPENCLAW_PRODUCT_SPEECH_URL/TOKEN` may be absent only while generated speech, camera and moving speech are off; half a pair is rejected. Without it, chat answers as unconfigured.

## Routing

The Vercel transport verifies exact transport and public origins and the signed ingress headers. Web owns player and staff sessions; no browser header or query parameter replaces those checks. `LAB_PUBLIC_URL` is an authentication handoff contract, not the address of a Studio process. Game launch stays server-authenticated and keeps its operator (bolag), room (rum) and frozen package (paket).

`GET /__cloud/health` returns plain `ok` and `GET /__cloud/version` the deployment's validated commit SHA, only on those exact paths. Health alone proves neither database readiness nor a working game. SSE, media ranges, authenticated WebSockets, moving-speech callbacks and the shared-table (delat bord) socket keep the gateway's validation; feature flags decide availability.

On shutdown the launcher signals the game child and drains the gateway within the shutdown budget. Only allowlisted finite diagnostics pass through `child-diagnostics.mjs`.
