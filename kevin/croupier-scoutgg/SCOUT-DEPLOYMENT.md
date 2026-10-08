# Scout demo deployment

Public address: https://croupier.scoutgg.dev/

Host: `scout-hel1` (`ssh scout`), 37.27.199.225.
The playable demo runs independently from Emil's `astrid-utdelning` service on
8700, his older demo on 8500, and the Croupier site on 4173. Do not restart or
replace those services when deploying this app.

- Service: `astrid-scout-demo.service` (system service, user `astrid-scout`).
- Code: `/opt/astrid-scout-demo/releases/<git-commit>`.
- Active release: `/opt/astrid-scout-demo/current` symlink.
- Persistent wallets and generated answers: `/var/lib/astrid-scout-demo/`.
- Server-only configuration: `/etc/astrid-scout-demo.env`, root-owned mode 600.
- Listener: `BIND_HOST=127.0.0.1`, `PORT=8620`.
- GPU callback: `SESSION_URL=wss://croupier.scoutgg.dev`.
- HTTPS: Caddy, dedicated hostname block in `drift/scout-demo.caddy`.
- DNS: Cloudflare `scoutgg.dev` zone, dedicated A record to this host.

Never copy local `.env`, `data/`, `answers/`, `public-url.txt`, or `node_modules`
into a release. Package tracked runtime files with `git archive`; run
`npm ci --omit=dev --ignore-scripts` on the server. Link each release's `data`
and `answers` to the persistent directories before switching `current`.
Restart only `astrid-scout-demo`. Keep the previous release for rollback: point
`current` back to it and restart that same service. Credentials and SQLite data
must survive release switches.

## Source preservation

Before deploying, the running `/home/emil/astrid-utdelningsdemo` was inspected.
On 25 September, `server/astrid.mjs`, `cartesia.mjs`, `llm.mjs`, and
`serverless.mjs` were imported unchanged from that installation. This retains
Emil's updated voice streaming and GPU encoder selection/session handling.
The Scout game/UI and `/api/table` integration remain on this branch. English
remains the UI's default; importing the language-aware backend adds no language
selector or extra generated clips.

Verify after deployment: HTTPS page, `/api/health`, `/api/clips`, media range
requests, WebSocket connection, and an actual demo round through collection.
The timer must be visible only before dealing and return for the next round.

## Release verification, 25 September 2026

Runtime release: `dce5e61f655559355278f1ac24d6d77024225155`.

- All 26 tests passed on scout-hel1 using Node 24.18.0.
- Service is enabled and active, bound to 127.0.0.1:8620.
- Dedicated DNS A record exists; Cloudflare 1.1.1.1 and Google 8.8.8.8 both
  resolve it to the server. DNS proxy is off.
- Caddy obtained a valid Let's Encrypt certificate. Public HTTPS health returns
  200; MP4 range requests return 206. No certificate checks were disabled.
- Public API returns 6 idle clips, 8 deals and 51 recorded lines.
- A separate test session placed main $5 + PP $5 + 21+3 $5, reached insurance,
  declined, stood, settled and collected. Balance persisted across a fresh state
  request and the round cleared. Cookie has HttpOnly, SameSite=Strict and Secure.
  A foreign-Origin table request returned 403.
- Emil's service on 8700 and the original Croupier service remained running.
- Browser verification from the local mobile hotspot was blocked by its cached
  NXDOMAIN response (negative TTL 1800 seconds), although public resolvers and
  the server resolved the name correctly. No local DNS settings were changed.
  The earlier local browser round verifies the UI; the checks above verify the
  deployed backend. A fresh rendered round on this hostname remains to verify
  after that DNS cache expires. No generated chat reply was requested in this
  deployment check.

## Split fix follow-up, 25 September 2026

Current runtime release: `f46f8f8` (previous release `dce5e61`). The separate
Scout demo was restarted with no connected visitors. All 30 tests passed on the
server; the public HTTPS copies of all three changed UI modules match the local
SHA256 hashes. Caddy, main Croupier and Emil's 8700 demo remain healthy.

The local rendered split/hit/settlement evidence and automated four-hand checks
are recorded in `review/2026-09-25-split/README.md`. Local DNS still returns the
cached NXDOMAIN response, so public-host browser acceptance remains outstanding.
