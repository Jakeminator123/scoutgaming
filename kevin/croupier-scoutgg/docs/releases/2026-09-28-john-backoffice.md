# John's final backoffice: reporting-only production candidate

Based on live runtime `5b07f6a`; preserve current deployed frontend and media.
Adds read-only `operations` and `workspace` views for John's final BO and changes
retired BO redirects to `https://croupier.scoutgg.dev/bo/`.

Only `server/server.mjs`, `server/shared-table.mjs`, `server/operations.mjs` and
`server/bo-workspace.mjs` are deployment inputs. No OpenClaw, speech, rules, shoe,
wallet or gameplay presentation changes are part of this release.

The actual live files were byte-compared with the baseline before constructing
the candidate. All 27 backoffice, transaction and shared-table tests pass.
BO source: `scout-gg/croupier`, branch `codex/john-final-backoffice`, `05a977f3`.
Release verification/rollback is recorded with that BO source.
