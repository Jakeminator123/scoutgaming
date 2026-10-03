# Croupier continuity and dealer regression rules

## Local agent coordination

Follow `agent-talk/README.md`. Run `node tools/agent-talk.mjs status <your-id>`
at task start, between work steps (about every 30 seconds while active), and
before commit/push. Claim affected paths before editing; use ping/ack for
overlap and done to release. Keep major progress notes short. No background
polling; file messages do not wake paused agents or override user instructions.

## GitHub-only work on main — 2026-10-02

Work only on `main`, in `Jakeminator123/github-work`. Jakob explicitly moved
all work to `main` on 2026-10-02 and requested removal of the other branches.
Do not create another branch or worktree unless Jakob explicitly requests it.
GitLab integration is paused: no inbox fetch/send, wiki publication or mirror
push. Deliver with `node tools/push-github-work.mjs`; never force-push or
push another branch. `tools/repository-policy.json` and the pre-push hook enforce this
destination. This section supersedes historical GitLab workflow instructions
elsewhere in this checkout. `Jakobs-v1` at
`600093e4522efc57bd82979cff65492a528ffeb7` is verified on both GitHub and GitLab.
It preserves committed v1; local ignored profiles/settings require separate
private backup. See `docs/CLOUD-MIGRATION.md`.

## GitGuardian visibility at start and delivery

At task start and before commit/push, read the remote `main` security status.
Use `node tools/security-status.mjs`; if local GitHub CLI access is unavailable,
use the connected GitHub `github_fetch` tool. Read `branches/main` first, freeze
its full SHA, then read that commit's `check-runs`, `check-suites` and `status`.
`node tools/security-status.mjs --mcp --ref <full-sha>` prints the exact GET URLs.
Follow pagination; an incomplete response is a coverage gap. After push, check
the delivered SHA again. Do not install software or create access grants for
this check automatically.

Expose only app/name/status/conclusion, numeric GitGuardian incident links,
repository-relative file and line. Never print raw check output, annotations'
messages, scanner matches, secret values, API error bodies or tokens. The tool's
exported collector/redactor supports safe connector responses and annotations.
Report known alerts and coverage gaps to the coordinating agent; continue work
that they do not affect.

A queued suite, missing run, neutral/skipped check or green ordinary CI is not
proof of no incidents. GitGuardian's GitHub checks target pull requests; this
repo's direct-main workflow also needs the intended GitGuardian workspace's
incident view. A practical read fallback is already available in signed-in
Chrome: `node tools/security-status.mjs --browser` prints workspace `795524`'s
repo-filtered open-incidents URL and the known incident link. Reuse that tab;
verify the workspace and selected `Source` is `Jakeminator123/github-work`
(source `30689542`). If needed, choose `Source`, search the exact repo name,
and select it. This filter was verified on 2026-10-03; recheck its visible repo
binding each time. Read only distinct incident ID/status/repo/file/line/time
metadata fields. Do not read full page/row text or screenshots containing
snippets, save views, resolve/ignore incidents or change access. Report the
observed pages and missing coverage; the browser plan itself performs no read.
The complete API incident list remains `not-read` without a separately authorized
`incidents:read` API token or an already connected read-only GitGuardian source.
Do not silently use another person's workspace or mark incident coverage clear
without reading it. No `scan` or write permission is needed for incident reads.
See [GitGuardian check runs](https://docs.gitguardian.com/internal-monitoring/prevent/detect-secrets-in-real-time-in-github)
and [API scopes](https://docs.gitguardian.com/api-docs/authentication).

## Active documentation and private archive

Use `lab/docs/README.md` for the user guide and
`docs/LOCAL-PRESENTATION-RUNTIME.md` for technical references.
Keep at most five Markdown files under `docs/`. Update these in place;
new reports and sprint documentation are paused at Jakob's request.
Jakob's personal `random-stuff-jakob/jakob-docs/arkiv/` is retired and excluded
from this checkout. Do not read, index, summarize, restore from Git history,
follow old archive links, or search external backup locations for its contents
unless Jakob explicitly requests a specific historical document. Old handoff
mentions are provenance, not instructions to retrieve archived material.
Ordinary file searches must honor `.ignore`; dependencies, generated caches and binary media are excluded. Read source text and relevant metadata selectively; do not scan media binaries
or generated artifacts for ordinary documentation questions.

## Local servers and browser tabs

Run only one local Croupier product/lab server pair at a time, including QA
on different ports. Use the coordinated launchers and their session guard;
do not bypass it with direct server commands, another port or deleted state.
Stop the current pair before switching environments, preserving saved data.
Short-lived isolated test fixtures must clean up their own processes.

From Codex, start Lab with `--no-open`. Before opening browser tabs,
inspect the connected browser and reuse the existing Croupier game or lab
tab for that surface. Reload when its URL is already correct; navigate that
same tab when replacing an older URL. Preserve drafts and ongoing play.
Keep one game tab and one lab tab; replace obsolete agent-created duplicates
after the replacement works. Do not close unrelated user tabs. A request to
stop servers leaves them stopped until a subsequent start is requested.

Explicit `/chef` or `$chef`: follow `.agents/skills/chef/SKILL.md`. Before shared integration/push, run `node tools/croupier-chef.mjs status`; coordinate with the registered owner if another chat holds the role. No automatic role activation, polling or broad agent wakeups.

For OpenClaw installation, configuration, Gateway, MCP or runtime work, first
read `open-claw/lab/docs/README.md`. It routes to the official-source and
deployed-version index. Fetch external documentation only when the current
question needs it, not on every turn or runtime event.

The GitLab inbox is paused. Jakob explicitly requested deletion of the entire
local `.croupier-inbox/` on 2026-09-28, including identities, read cursors,
drafts and checkpoints. Do not restore these or initialize the old inbox
automatically. No ordinary turn-start inbox check is required in the GitHub
workflow. Explicit future chef activation may create fresh local role state.

`.croupier-inbox/` is ignored local inbox state, not a media archive or general
scratch area. New files there should be only small identities, read cursors,
shared cache, chef state, or message drafts. Do not place Git worktrees,
downloads, generated media, or test builds inside it. Existing small QA evidence
may remain. Exclude the directory from broad file searches and indexing; use
the inbox command or a targeted state-file read when needed.

`tools/push-work-mirrors.mjs` is a compatibility entry point for GitHub-only
delivery. It no longer contacts GitLab. The retired `gitlab-work` GitHub repo
must not be used.

Read `docs/JOHN-HANDOFF.md` and `docs/ENVIRONMENT-RESTORATION.md` before changing gameplay or media. This repository is the working product; the older checkout nested inside Scout-Gaming is not the current source.

- Preserve existing dirty files, especially raw media and calibration scripts. Do not reset, clean, or replace the whole media directory.
- Keep all four dealers on the shared playback path. Never choose a speaking video by approximate duration or loop a recorded sentence over continuing audio.
- Each speech change is a set: exact text, recorded audio, video, frame index, calibration and acceptance notes. A different audio/video hash invalidates prior visual approval.
- Build replacement takes in a separate staging directory. `build-index.mjs` refuses to overwrite calibrated video with different bytes. Do not bypass that check by deleting metadata from the live index.
- Run `node pipeline/audit-dealer-sync.mjs --probe` and the tests in `.githooks/pre-commit` for every media/player change. Review all four dealers using `?dealer=<name>&rehearsal=1`, including two consecutive plays. Rehearsal uses the actual game player.
- The asset baseline protects against unreviewed changes; it is NOT proof of correct lip sync. Read the known gaps in the handoff. Do not mark a take approved based only on a hash, waveform, test pass or first-mouth onset.
- Only update the baseline after inspecting intentional changes and recording the per-line result. Never regenerate unrelated approved assets while repairing one take. Do not use pasted mouth overlays; previous user feedback rejected them.
- Keep server-owned cards, shoe counts, wallet and payouts authoritative. Do not manipulate the real user database for testing. Use an isolated server/database and a different hostname.
- Temporary guest access stays on for local product development until the user asks otherwise. Do not treat this demo as ready for real money.
- At each delivery, commit only task-owned files and update the handoff with what changed, what was tested and what remains broken. Keep conversation exports private and outside Git; never depend on chat history alone.
- Jira/CAC and legacy GitLab tracking are retired by Jakob's decision on 2026-10-02. Use GitHub for source, delivery and checks, and the checklist in `docs/CLOUD-MIGRATION.md` as the live migration tracker. No Jira connector, ticket, status transition or GitLab inbox/wiki/mirror is a prerequisite or an authorized workflow. Read the task's expected result and acceptance conditions before implementing. Update the checklist and the one John-handoff as work advances; check an item complete only when its full expected result is verified. Do not create an external tracker or a second masterplan automatically.
