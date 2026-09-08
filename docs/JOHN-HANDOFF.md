# Croupier — gameplay handoff for John

Updated 8 September 2026. Read this alongside `ENVIRONMENT-RESTORATION.md` and Git history. This is a working demo with outstanding audiovisual defects, not final delivery.

## Where the actual work is

- Working repository on Kevin's Mac: `/Users/solvifyab/Desktop/croupier`.
- Branch: `codex/restore-casino-environment`.
- The older `/Users/solvifyab/Desktop/Scout-Gaming/croupier` clone is not the current implementation.
- Local preview: run `sh web/preview.sh`, then open `http://127.0.0.1:4173/`.
- Four dealers: `?dealer=vera`, `?dealer=astrid`, `?dealer=amira`, `?dealer=mei`.
- Private recovered conversation: `/Users/solvifyab/Desktop/Scout-Gaming/.codex-audit/casino-conversation-recovered-2026-09-08.md`.
- Private checkpoints: `/Users/solvifyab/Desktop/Croupier-Backups/`. The Git bundle contains committed history. A separate working-media-and-code archive preserves nonignored modified/untracked product assets and scripts; the user database and ignored files remain only in the original workspace.
- Sharing an account does not by itself copy this Mac's workspace to another computer. Use the private GitLab branch below. No account invitation has been sent by this task.

## Open this project on John's computer

John needs access to the private `scout-gg/croupier` GitLab project and a Git client authenticated to GitLab. A GitLab account alone does not grant project access. In a terminal:

```sh
git clone --branch codex/restore-casino-environment git@gitlab.com:scout-gg/croupier.git
cd croupier
git config --local core.hooksPath .githooks
sh web/preview.sh
```

Use a Node version with `node:sqlite` support. The media audit also needs `ffprobe` from FFmpeg. No npm install is needed for the local server. Open the cloned `croupier` folder as a local project in the Codex desktop app, then open `http://127.0.0.1:4173/` and ask Codex to read `AGENTS.md` and this handoff before editing.

The clone contains the deployed dealer media and code. It creates a new local demo database; Kevin's accounts, wallet data and provider credentials are not transferred. Unfinished source media and the full recovered conversation are in Kevin's private checkpoint, not the GitLab branch. The committed handoff preserves the working context needed to start gameplay improvements.

## Product direction and completed foundation

Gameplay synchronization comes first, then conversation. Preserve the photographic dealer identities. The table, shoe and flying cards have Three.js geometry; the people remain video, not rigged 3D humans. The bottom table selector exposes all four dealers. Forced login is temporarily bypassed locally, at Kevin's request; the branded action-triggered modal and CRAIG integration remain in code.

The backend owns an eight-deck shoe, one burn, a 75% cut-card threshold, end-of-round reshuffles, idempotent actions and payouts. Frontend choreography waits for actual card landing. Split, double, insurance, settlement and cut-card transitions were tested on an isolated database. Automatic small talk is disabled.

## Sync status — do not assume approved

| Dealer | Indexed speech takes | Missing bank takes | Remaining work |
| --- | ---: | --- | --- |
| Vera | 32 | greet_back, limits_vip, house_edge, thanks, small_talk, side_when, ask_me, farewell_bank | Review every spoken line; filmed hands do not grip arbitrary 3D cards. |
| Astrid | 17 | None | goodluck/win word-to-mouth mismatch needs replacement takes. Other lines still need full visual review. Fingertips are clipped in the dealing source. |
| Amira | 15 | chatter1, chatter2 | Full visual review and new dealing-action footage. |
| Mei | 14 | push, chatter1, chatter2 | Full visual review; push is a gameplay gap. New dealing-action footage needed. |

All existing speech takes have calibration and enough total video duration for audio plus delay. All 90 main streams are checked for index integrity and B-frame compatibility. These checks cannot prove correct phonemes. The initial hash baseline records the current imperfect state; it is NOT an approved-quality baseline.

**Latest user review: Astrid’s existing action looks like shuffling and is rejected as realistic dealing.** See `ASTRID-DEALING-RETAKE.md` for the verified source defect and replacement contract. No replacement take has been generated. Kevin approved the saved four-panel storyboard in `docs/reference/astrid-dealing-approved-concept.png`. The rejected action is disabled in gameplay; direct shoe delivery is temporary until the approved motion exists.

Astrid has four measured fingertip release cues. Cards wait for painted video frames, and the dealer returns to rest after the last delivery. This improves timing, but does not create missing fingers or a genuine filmed shoe pickup. Amira/Mei do not have dealing footage. Do not describe the entire roster as hand-synced.

Generation remains blocked: the connected Higgsfield Team workspace reported 3.02 credits after Kevin said he topped up. The available Chrome profile was signed out. Identify the credited workspace/account. Unlimited website passes do not cover MCP/CLI. Do not purchase another pass automatically. The earlier 180-credit estimate covered two Astrid speech takes with one retry each, not all dealer hands.

## Safe change and review workflow

1. Enable the versioned local checks after cloning: `git config --local core.hooksPath .githooks`.
2. Run `node pipeline/audit-dealer-sync.mjs --probe` (Node and ffprobe required). It fails for unexpected media/text/calibration changes, invalid indexes, B frames or audio longer than its take. Known missing takes remain explicitly listed.
3. Prepare one replacement in a separate staging folder. Preserve the exact identity, voice and words. Keep both hands inside frame for dealing; stage a full action including rest, pickup/contact, release and return.
4. Rebuild the staging index, calibrate the new asset pair, then review it with sound. An identical index rebuild preserves timing/other clips; replacing a calibrated live take with different bytes is rejected.
5. Use the in-game rehearsal at `/?dealer=mei&rehearsal=1` (change dealer via its selector). Review every changed line twice, then greeting, goodluck, double, bust, insurance, win, lose and push across all four dealers. Watch word shape, pauses, final mouth closure, transitions and hands. Compare the original approved take if one exists. Do not use the old `/lab/` pilot videos as evidence for the shipped player.
6. Record dealer, line, reason, before/after hashes, measured delay, reviewer/date, visual result and remaining defects in the change description. No take currently has blanket visual approval.
7. After the intentional media diff has been reviewed, record it with `node pipeline/audit-dealer-sync.mjs --record-baseline --probe`. Inspect the JSON diff. Never use this command simply to silence a failing check.
8. Run `.githooks/pre-commit`, `node test/shoe-game.mjs`, and `node test/split-rules.mjs`. Check initial deal, hit, stand, split, double, insurance and next round in an isolated database. CI repeats the tests when pushed to GitLab; it has not yet run remotely.
9. Commit a bounded change and update this handoff. Run `python3 pipeline/save-checkpoint.py --transcript /path/to/this-session.jsonl` to save a verified Git bundle, handoff, readable conversation, unfinished media/code archive and checksum manifest outside the repo. Without `--transcript`, it still backs up committed history and the handoff. Do not reset the existing dirty raw-media work.

## Code map

- `web/public/app.mjs`: shared choreography, speech queue and rehearsal UI.
- `web/public/dealer-engine.mjs`: WebCodecs frame presentation and hand mattes.
- `web/public/speech-playback.mjs`: speech cancellation/timer ownership.
- `web/public/speech-lines.mjs`: fallback captions; each dealer's audio bank overrides them.
- `web/public/dealing-card.mjs`, `table-scene.mjs`: 3D card/table rendering.
- `pipeline/build-index.mjs`: safe, metadata-preserving partial index rebuilds.
- `pipeline/audit-dealer-sync.mjs`, `docs/dealer-sync-baseline.json`: roster regression gate.
- `.githooks/pre-commit`, `.gitlab-ci.yml`: local and remote test entry points.

## Conversation continuity

The Codex conversation reader returned only the beginning, while the local session contained later messages and the repo retained later commits. A readable transcript was recovered. The app display itself was not repaired. Future work must update this handoff and Git independently of the chat UI. No process can guarantee that the app will never hide history again; these files make the project recoverable without it.
