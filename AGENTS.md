# Croupier continuity and dealer regression rules

For OpenClaw installation, configuration, Gateway, MCP or runtime work, first
read `open-claw/lab/docs/README.md`. It routes to the official-source and
deployed-version index. Fetch external documentation only when the current
question needs it, not on every turn or runtime event.

If this checkout is branch `jakeminator123/work`: do not push `main`. At each new user turn, run `node tools/croupier-inbox.mjs check` once; initialize via `ping-croupier` if needed. Shared fetch cache lasts 30 seconds; read cursors stay per chat. Nothing relevant: continue silently. No polling or checks on agent/tool updates. Missing API: report once, no automatic browser fallback on ordinary turns. Only the addressed agent answers; CC/all is informational. Read `ping-croupier` for replies/setup. Wiki: https://gitlab.com/scout-gg/croupier/-/wikis/home

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
