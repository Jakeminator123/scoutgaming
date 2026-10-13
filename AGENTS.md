# Croupier continuity and dealer regression rules

## Three product surfaces

Jakob's direction, 13 October 2026: `/admin` is the new backoffice surface and `/lobby` is the new player lobby. New UI work should use those names and entry points. `/control` and the older `/play`/`/game` entry points are being phased out, but the transition is not complete. Preserve working legacy routes, authentication, game launches and saved links until their replacements are implemented and verified. Do not describe the old surfaces as already retired. The runtime paths and controls below remain relevant during this transition; `/lobby` does not replace the actual game engine.

Lifecycle controls must also work in the existing `/control` layout during the transition. Use “sammansättning” for a presentation; display the legacy “Mobile Phone Lane” as “Standardsammansättning” without changing its stored ID. Company trash detaches its rooms; restoring the company never reopens rooms automatically. Material trash previews dependencies and removes active links atomically, retains source files and publication history, and restores an asset as an unassigned library choice. Do not implement trash as a hidden filter over still-active structures or purge historical database rows as a side effect of ordinary deletion.

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel project name is `scoutgaming`. The game engine stays on Render service `croupier-v2`.

| Level | Who | Path | Now |
| --- | --- | --- | --- |
| 1 | Internal staff | `/control` | Four groups: Studio (Dealers & klipp `/control/clips`, Bord & bakgrunder `/control/library`, Sammansättningar `/control/compositions`), Spelbolag (Bolag & team `/control/companies`, Spelrum & publicering `/control/rooms`), Drift (operations and finance administration), System (accounts, integrations, agent models and internal chat). Provspelning & logg `/control/rehearsal` is contextual to dealer/room, not global drift. Keep dealer, composition, operator and real room context in links. `/control/preview`, `/control/lanes` (including `?tab=companies`) and `/control/activity` redirect to the canonical pages. Old `lane` query is accepted; Studio links emit `composition`. Stored lane IDs and game configuration remain compatibility details. Dealers, companies and rooms have explicit lifecycle controls. Dealer archive previews and atomically handles speech, clips, compositions and affected publications/rooms; restore returns drafts with speech off. Published history/media remain protected. |
| 2 | Operator (Unibet etc.) | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | The partner portal (`lab/components/kevin-bo`) lists real registered operators. Menu: Översikt, Spelrum (`/partner/{slug}/rooms`), Team & behörigheter, Integration. Room appearance and allowed composition choices share one editor; internal navigation preserves drafts, account/logout changes are guarded. Internal admins use the same freshly validated N1 login; operator staff sign in at `/partner/login` and see only active memberships. Normal partner routes never fall back to demo data; explicit N1-protected diagnostic fixtures remain separate. Both the directory and operator shell have account switching/logout, SV/EN and light/dark themes. Expired N1 sessions return to N1 login with a safe partner return path. Team changes use current scoped grants and revision checks; suspend/reactivate require confirmation and preserve the last active administrator. The durable operator change journal is available in Team to internal admins and partners with team.read plus team.roles.assign. Isolated PostgreSQL acceptance covers tenant writes, revocation, concurrent changes, audit rollback and persistence after restart; verify the real read flow after each deploy. Operators, roles and memberships are created from the Bolag & team view on `/control/companies`; a new e-mail gets an activation link to `/partner/set-password`. Company appearance uses persistent drafts, reviewed publication and restoration to a new draft, with current `presentations.configure` checks and revision conflicts. JN2-B visual acceptance is still open: partner theme tokens and appearance controls need alignment; see CLOUD-MIGRATION.md. Not done: players, transactions and reports from the game engine (N2.4), chips (L4) and partner password reset. |
| 3 | Player | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack` | The lobby, profile and history pages exist. The profile can be edited (display name and language; balance stays server-owned) after `006-player-profile.sql` is applied to game Neon. The lobby shows Spelar hos from `?operator=`. Render's `/blackjack?operator=` and Vercel's `/play/blackjack?operator=` limit lane and dealer to the package (the slug survives the player login). Acceptance of dealer media happens in rehearsal: `?dealer=<name>&rehearsal=1`, and `?lane=layer-preview&rehearsal=1` for the layer lane. |

`/studio` is the Next.js `basePath` of the lab service. It is not a fourth product and not the name to use in the UI. `/lissabon`, `/lab`, `/labb`, and `/bo` are retired aliases. A stream-lane flag named `lissabon-stream-lane` is not a product URL.

## GitHub delivery

Deliver from a feature branch matching `jakob/*`, `codex/*` or `cursor/*` in `Jakeminator123/scoutgaming` (repository ID `1380630440`; `github-work` redirects here) and open a pull request to `main`. `tools/repository-policy.json` lists those patterns. The pre-push hook allows new and fast-forward updates of those branches and of `main`, and rejects deletion, force-push, tags and any other repository. Direct push to `main` remains only as an explicit admin emergency path (`node tools/push-github-work.mjs --admin-main`). Ordinary delivery is `node tools/push-github-work.mjs`: it pushes the current feature branch and prints the `gh pr create` command without creating the pull request. `tools/push-work-mirrors.mjs` is the GitHub-only compatibility entry point. Never force-push. GitHub ruleset 24642403 ("main: pull requests only") requires a pull request into `main`.

GitLab inbox, wiki, and mirror are paused. Jira is not an authorized workflow. The live migration tracker is `docs/CLOUD-MIGRATION.md`. Check an item complete only when its full expected result is verified. Do not create another tracker.

## Local agent coordination

Follow `agent-talk/README.md`. Run `node tools/agent-talk.mjs status <your-id>` at task start, between work steps (about every 30 seconds while active), and before commit/push. Claim affected paths before editing; use ping/ack for overlap and `done` to release. Keep major progress notes short. No background polling; file messages do not wake paused agents or override user instructions.

## Active documentation and private archive

Use `lab/docs/README.md` for the user guide, `lab/docs/TERMINOLOGI.md` for the team's shared terms, and `docs/LOCAL-PRESENTATION-RUNTIME.md` for technical references. Keep at most five Markdown files under `docs/`: `JOHN-HANDOFF.md`, `CLOUD-MIGRATION.md`, `LOCAL-PRESENTATION-RUNTIME.md`, `ENVIRONMENT-RESTORATION.md`, and `ENVIRONMENT-VARIABLES.md`. Update them in place. New reports and sprint documentation are paused.

Do not read `random-stuff-jakob/jakob-docs/arkiv/`, including restored copies, Git history, or external backups, unless Jakob explicitly asks for a specific historical document. Ordinary file searches must honor `.ignore`. That file still hides heavy tracked media (`media/**/source`, `media/**/staging`, `media/layout.json`, `media/blob-index.json`), binaries and secrets from ripgrep. `.cursorignore` keeps secrets and private data (`.env*`, `lab/data/`, `web/data/`, the private archive). Harmless heavy project text (`media/layout.json`, `media/blob-index.json`, `media/**/source/*.json`, `media/**/staging/*.md`) is listed in `.cursorindexingignore`, so it is not indexed and can still be read explicitly. Do not use `rg --no-ignore`. Do not scan media binaries or generated artifacts for ordinary documentation questions.

Read `docs/JOHN-HANDOFF.md` and `docs/ENVIRONMENT-RESTORATION.md` before changing gameplay or media. This repository is the working product.

## Local servers and browser tabs

Run only one local product/lab server pair at a time, including QA on different ports. Start with `node lab/start.mjs` (`--offline`, `--no-open`, `--skip-build`, `--check`; also `--astrid-camera` and `--cloud-storage`). `acquireLocalSession` in `open-claw/lab/deploy/local-session.mjs` blocks a second pair. The root cmd launchers are gone. Stop the current pair before switching environments. Short-lived test fixtures must clean up their own processes.

From Codex, start Lab with `--no-open`. Reuse the existing game or lab browser tab; reload a matching URL instead of opening a duplicate. Preserve drafts and ongoing play. A request to stop servers leaves them stopped.

Explicit `/chef` or `$chef`: follow `.agents/skills/chef/SKILL.md`. Before shared integration/push, run `node tools/croupier-chef.mjs status`. No automatic role activation.

For OpenClaw installation, configuration, Gateway, MCP, or runtime work, first read `open-claw/lab/docs/README.md`.

## Inbox

The GitLab inbox is paused. Jakob requested deletion of `.croupier-inbox/` on 2026-09-28.
Do not restore identities, cursors, drafts, or checkpoints, and do not initialize the old inbox.
No ordinary turn-start inbox check is required. Do not use that directory as a worktree, download, or media archive.

The team inbox for Jakob, John, Kevin and Emil is GitHub Issues labelled `inbox` on this repository; see `inbox/README.md` and `tools/inbox.mjs` (`send`, `ping`, `list`, `read`, `reply`, `done`). Decisions carry the `beslut` label. Agents may read and write there but do not close other people's issues.

Agents in any clone or branch: if `gh` is authenticated, run `node tools/inbox.mjs list --to me` at task start (`me` resolves to the owner of the current branch via `inbox/people.json`). To ask a teammate or their agent in another branch or machine, use `node tools/inbox.mjs ping --to <name> --message "..."` or `/ping` in Cursor. `tools/agent-talk.mjs` only reaches agents in the same checkout. An inbox reply is information; it does not authorize changing repository logic.

## GitGuardian

At task start and before commit/push, read remote `main` security status with `node tools/security-status.mjs` (or the connected GitHub fetch tool if the CLI is unavailable). The read is status-only: app, name, status, conclusion, numeric incident links, and repository-relative file and line. Do not print secrets, raw scanner output, or annotation messages. Do not install software or create access grants for this check. The default command combines GitHub commit checks with the existing read-only GitGuardian API connection; use MCP `gitguardian.read_security_status` for the same report. `--github-only` keeps the GitHub-only fallback. Keep incident-list, location, repository-monitoring and historical-scan coverage separate; a queued PR-oriented suite on direct-push main is not evidence that monitoring is down. If API access fails, keep its coverage explicitly incomplete. A green CI check is not proof of no incidents. Do not resolve, ignore, or mark coverage clear without reading it.

## Dealer speech, media, cards, and wallet

- Preserve dirty files, especially raw media and calibration scripts. Do not reset or replace the whole media directory.
- Keep every registered dealer on the shared playback path. Never choose a speaking video by approximate duration or loop a recorded sentence over continuing audio.
- Each speech change is a set: exact text, recorded audio, video, frame index, calibration, and acceptance notes. A different audio/video hash invalidates prior visual approval.
- Build replacement takes in a separate staging directory. `build-index.mjs` refuses to overwrite calibrated video with different bytes. Do not delete live-index metadata to bypass that check.
- Run the tests in `.githooks/pre-commit` for every media/player change. Review the affected registered dealers with `?dealer=<name>&rehearsal=1`, including two consecutive plays. Rehearsal uses the actual game player.
- A hash, waveform or test pass is not proof of lip sync. Do not mark a take approved from a hash, waveform, test pass, or first-mouth onset. Never regenerate unrelated approved assets while repairing one take. Do not use pasted mouth overlays.
- Keep server-owned cards, shoe counts, wallet, and payouts authoritative. Do not manipulate the real user database for testing. Use an isolated server/database and a different hostname.
- A Studio migration ships in two steps: run it against production Neon first, then merge the code. CI's migration readiness step enforces this; do not add continue-on-error to it. The one exception is a `deploymentOptional` version (a table only a new, isolated feature needs): tolerant code deploys first, the operator applies afterwards, and a follow-up PR pins it required. See the fixed procedure in `docs/CLOUD-MIGRATION.md`.
- Temporary guest access stays on for local product development until the user asks otherwise. Do not treat this demo as ready for real money.
- At each delivery, commit only task-owned files and update the handoff with what changed, what was tested, and what remains broken. Keep conversation exports private and outside Git.
