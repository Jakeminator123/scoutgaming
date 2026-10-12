# Croupier continuity and dealer regression rules

## Three product surfaces

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel project name is `scoutgaming`. The game engine stays on Render service `croupier-v2`.

| Level | Who | Path | Now |
| --- | --- | --- | --- |
| 1 | Internal staff | `/control` | One generation of pages on the shared template. Menu: Översikt `/control`, Dealers & klipp `/control/clips`, Klippbibliotek `/control/videos`, Händelser `/control/events` (overview without `?event=`, editor with it), Sammansättning `/control/preview` (layer preview; media in `test-videoeditor/preview/site`, the former branch `test-video-jakob` is deleted), Publicering `/control/lanes` (publish package; Bolag & team for operators, roles and memberships is the separate `?tab=companies` view under Administration; Render `/blackjack?operator=` and Vercel `/play/blackjack?operator=` read the package, the dealer row follows it), Agentmodeller `/control/openclaw`, Operatörschatt `/control/openclaw?tab=chat`, Administration `/control/administration` plus four deep links `?tab=tables|operations|finance|accounts`, Uppspelning `/control/activity`, Tal vid inaktivitet `/control/probe` (under Studio), Guide & hjälp `/control/guide`. `/control/tree` redirects (308, query kept) to `/control/events`. `/control/operator-chat` redirects to the chat tab. Studio contains Dealers & klipp, Bord & bakgrunder, Sammansättning and Publicering. Dealer breadcrumbs and tabs group Grundloop, Klipp, Scen & format, Tal & automatik, Svarsbibliotek and Inställningar; preserve dealer and lane context. Drift, AI & chatt and Administration are collapsible groups. Library/events/idle-speech are contextual links within Dealers & klipp; idle clips use Grundloop, Basklipp and Variation. `/control/zones` and `/zones` redirect to composition; `/control/backgrounds` reaches it through the zone alias. Stored zone data is retained. |
| 2 | Operator (Unibet etc.) | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | The partner portal (`lab/components/kevin-bo`) lists real registered operators. Internal admins use the same freshly validated N1 login; operator staff sign in at `/partner/login` and see only active memberships. Normal partner routes never fall back to demo data; explicit N1-protected diagnostic fixtures remain separate. Both the directory and operator shell have account switching/logout, SV/EN and light/dark themes. Expired N1 sessions return to N1 login with a safe partner return path. Team changes use current scoped grants and revision checks; suspend/reactivate require confirmation and preserve the last active administrator. The durable operator change journal is available in Team to internal admins and partners with team.read plus team.roles.assign. Isolated PostgreSQL acceptance covers tenant writes, revocation, concurrent changes, audit rollback and persistence after restart; verify the real read flow after each deploy. Operators, roles and memberships are created from the Bolag & team view on `/control/lanes?tab=companies`; a new e-mail gets an activation link to `/partner/set-password`. Company appearance uses persistent drafts, reviewed publication and restoration to a new draft, with current `presentations.configure` checks and revision conflicts. JN2-B visual acceptance is still open: partner theme tokens and appearance controls need alignment; see CLOUD-MIGRATION.md. Not done: players, transactions and reports from the game engine (N2.4), chips (L4) and partner password reset. |
| 3 | Player | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack` | The lobby, profile and history pages exist. The profile can be edited (display name and language; balance stays server-owned) after `006-player-profile.sql` is applied to game Neon. The lobby shows Spelar hos from `?operator=`. Render's `/blackjack?operator=` and Vercel's `/play/blackjack?operator=` limit lane and dealer to the package (the slug survives the player login). Acceptance of dealer media happens in rehearsal: `?dealer=<name>&rehearsal=1`, and `?lane=layer-preview&rehearsal=1` for the layer lane. |

`/studio` is the Next.js `basePath` of the lab service. It is not a fourth product and not the name to use in the UI. `/lissabon`, `/lab`, `/labb`, and `/bo` are retired aliases. A stream-lane flag named `lissabon-stream-lane` is not a product URL.

## GitHub-only work on main

Work only on `main` in `Jakeminator123/scoutgaming` (repository ID `1380630440`; `github-work` redirects here). Do not create another branch or worktree unless Jakob explicitly requests it. Deliver with `node tools/push-github-work.mjs`. Never force-push or push another branch. `tools/repository-policy.json` and the pre-push hook enforce this destination. `tools/push-work-mirrors.mjs` is the GitHub-only compatibility entry point.

GitLab inbox, wiki, and mirror are paused. Jira is not an authorized workflow. The live migration tracker is `docs/CLOUD-MIGRATION.md`. Check an item complete only when its full expected result is verified. Do not create another tracker.

## Local agent coordination

Follow `agent-talk/README.md`. Run `node tools/agent-talk.mjs status <your-id>` at task start, between work steps (about every 30 seconds while active), and before commit/push. Claim affected paths before editing; use ping/ack for overlap and `done` to release. Keep major progress notes short. No background polling; file messages do not wake paused agents or override user instructions.

## Active documentation and private archive

Use `lab/docs/README.md` for the user guide, `lab/docs/TERMINOLOGI.md` for the team's shared terms, and `docs/LOCAL-PRESENTATION-RUNTIME.md` for technical references. Keep at most five Markdown files under `docs/`: `JOHN-HANDOFF.md`, `CLOUD-MIGRATION.md`, `LOCAL-PRESENTATION-RUNTIME.md`, `ENVIRONMENT-RESTORATION.md`, and `ENVIRONMENT-VARIABLES.md`. Update them in place. New reports and sprint documentation are paused.

Do not read `random-stuff-jakob/jakob-docs/arkiv/`, including restored copies, Git history, or external backups, unless Jakob explicitly asks for a specific historical document. Ordinary file searches must honor `.ignore`. Do not scan media binaries or generated artifacts for ordinary documentation questions.

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
- Keep all four dealers on the shared playback path. Never choose a speaking video by approximate duration or loop a recorded sentence over continuing audio.
- Each speech change is a set: exact text, recorded audio, video, frame index, calibration, and acceptance notes. A different audio/video hash invalidates prior visual approval.
- Build replacement takes in a separate staging directory. `build-index.mjs` refuses to overwrite calibrated video with different bytes. Do not delete live-index metadata to bypass that check.
- Run `node pipeline/audit-dealer-sync.mjs --probe` and the tests in `.githooks/pre-commit` for every media/player change. Review all four dealers with `?dealer=<name>&rehearsal=1`, including two consecutive plays. Rehearsal uses the actual game player.
- The asset baseline is not proof of lip sync. Do not mark a take approved from a hash, waveform, test pass, or first-mouth onset. Update the baseline only after inspecting intentional changes and recording the per-line result. Never regenerate unrelated approved assets while repairing one take. Do not use pasted mouth overlays.
- Keep server-owned cards, shoe counts, wallet, and payouts authoritative. Do not manipulate the real user database for testing. Use an isolated server/database and a different hostname.
- A Studio migration ships in two steps: run it against production Neon first, then merge the code. CI's migration readiness step enforces this; do not add continue-on-error to it.
- Temporary guest access stays on for local product development until the user asks otherwise. Do not treat this demo as ready for real money.
- At each delivery, commit only task-owned files and update the handoff with what changed, what was tested, and what remains broken. Keep conversation exports private and outside Git.
