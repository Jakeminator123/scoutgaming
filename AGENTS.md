# Croupier continuity and dealer regression rules

## GitHub-only work — 2026-09-28

Work only on `jakemanator123-github-work`, in `Jakeminator123/github-work`.
GitLab integration is paused: no inbox fetch/send, wiki publication or mirror
push. Deliver with `node tools/push-github-work.mjs`; never push `main` or
force-push. `tools/repository-policy.json` and the pre-push hook enforce this
destination. This section supersedes historical GitLab workflow instructions
elsewhere in this checkout. `Jakobs-v1` at
`600093e4522efc57bd82979cff65492a528ffeb7` is verified on both GitHub and GitLab.
It preserves committed v1; local ignored profiles/settings require separate
private backup. See `docs/GITHUB-MIGRATION.md` and `docs/CLOUD-MIGRATION.md`.

## Active documentation and private archive

Use `lab/docs/README.md` for the user guide, `docs/animation-events/README.md`
for the current sprint, and the active system map for technical references.
Jakob's personal `random-stuff-jakob/jakob-docs/arkiv/` is retired and excluded
from this checkout. Do not read, index, summarize, restore from Git history,
follow old archive links, or search external backup locations for its contents
unless Jakob explicitly requests a specific historical document. Old handoff
mentions are provenance, not instructions to retrieve archived material.
Read source text and relevant metadata selectively; do not scan media binaries
or generated artifacts for ordinary documentation questions.

## Local servers and browser tabs

Run only one local Croupier product/lab server pair at a time, including QA
on different ports. Use the coordinated launchers and their session guard;
do not bypass it with direct server commands, another port or deleted state.
Stop the current pair before switching environments, preserving saved data.
Short-lived isolated test fixtures must clean up their own processes.

From Codex, start Lissabon with `--no-open`. Before opening browser tabs,
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
- Use Jira CAC as the live work tracker. Read the current issue description, Expected Result and custom fields before implementing. Move an issue to **In Dev** when starting work, **Ready for QA** when the fix and reproduction evidence are ready, and **In Testing** while its QA is actually underway. Only mark **Done** after the issue's full expected result is verified; move failed QA back to In Dev. Discover current transitions instead of assuming status IDs. Update statuses as work advances, not only in the final handoff. All current CAC dealer reports concern Astrid even if an older report says Vera.
