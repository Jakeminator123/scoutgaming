# Latest: Astrid CAC-1–7 follow-up — 9 September 2026, late evening

Read [ASTRID-CAC-FOLLOWUP.md](ASTRID-CAC-FOLLOWUP.md) first. CAC-5/6/7 are now included: one room plus transparent floor shadows; totals below betting spots with neighbour-aware split clearance; consistent GPU edge cleanup without regenerated footage. The 3D/resting card share one bitmap and deliveries route to the nearest measured release for the actual card fan. All source media/audio and the other dealers are preserved.

The desktop scene now reserves space below the table using a shared actor/table/shoe/card camera transform. Deal Now is below the betting area, preventing its interception of centre-seat clicks. Phone gameplay follows the active server hand and keeps outer card fans in view. Actual seven-seat phone hit/bust/double/stand/settlement and split/side-bet checks were exercised on isolated4180 data. The latest real three-seat recording is available through the existing rehearsal button. See the follow-up for measured balances, evidence and limits.

Still staged: source pose discontinuities, motion softness, exact seven-seat capture, filmed reveal/collection/shoe-change, full phoneme approval and physical-device verification remain. Do not mark the full goal achieved from these tests. No generation credits were spent in this follow-up and no Jira issue was closed.

# Earlier: Astrid CAC-1–4 checkpoint — 9 September 2026, evening

Read [ASTRID-CAC-FIXES.md](ASTRID-CAC-FIXES.md) for the issue-by-issue evidence and remaining limitations. Every CAC report refers to Astrid, even when named Vera. Current path remains `/?dealer=astrid&performance=staged&rehearsal=1`; 4176 serves the new static files after refresh. This is still staged, not the completed realism milestone or a production deployment.

The staged table now uses one clean room, full actor masks for every original Astrid stream, and matched masks with unchanged embedded goodluck/win audio. Native speech hides both idle RGB and idle hands. New left/right deliveries share the same first72 front-outlet frames as centre/own delivery. Silent takes play at1.75 after loading (about4s); speech stays1x. Controls avoid rendered cards/totals/wallet, with phone and split total positioning corrected. Active chip/total values read server hand stakes instead of the original betting draft.

Evidence is in the actual game: **Watch updated three-seat deal** opens the new recording. Initial left/centre/right plus upcard/hole, left hit, split, right double, dealer draws and two completed rounds were exercised on isolated4178 data. Refresh retained the same cards and balance. All four goodluck lines repeated twice; Astrid's other gameplay lines completed sequentially, native mute cleared its layers. Deep roster/performance/actor probes and36 hook tests passed;197 service checks,77 split checks and50,000 randomized rounds passed. See the report for exact observations; logs are not full lip-sync approval.

Outstanding: generated motion softness, some legacy-to-performance pose joins, corrective slides from the three direction releases to seven seat/card-fan destinations, real-device Safari/mobile acceptance, and filmed reveal/collection/shoe change. No CAC ticket was closed automatically. Do not replace source media or calibrations based only on these technical passes. Other dealers' assets are unchanged and local guest access remains enabled.

Screenshot reporting now preserves Steps/Expected Results in local JSON/Markdown before Jira posting and in every project's description. `tools/bugshot.sh` records the current local script, including concurrent expected-image additions; tests do not create Jira tickets. Missing historical Expected Results cannot be reconstructed from the existing CAC reports.

# Latest: front-outlet pickup and native movement resolution — 9 September 2026

Astrid's staged own-card delivery now reuses the first 72 frames of the good player extraction, then continues along the felt to her own cards. The former top-of-stack pickup is no longer selected. Both action videos now retain native 1080p RGB instead of being reduced to 720p. The player choreography and all four dealers' speech assets are preserved. No backend or login behavior changed.

Read [ASTRID-FRONT-OUTLET.md](ASTRID-FRONT-OUTLET.md) for the exact source recipe, events, shared-extraction regression, actual-game recording and remaining limits. The uninterrupted initial-deal proof includes player/upcard/player/hole; all four speech repetitions and all 32 checks pass. Refresh recovery and settlement were verified using the new isolated 4177 database. Preserve Kevin's 4176 data and any active hand.

The speech/idle-to-dealing room and pose transition is still visible: legacy clips have a baked background, while dealing uses an isolated actor. Native encoding improves source detail but cannot eliminate generated blur. Partial-card extraction, release-to-fan correction, mobile layout and the remaining filmed actions are not accepted. This is a staged improvement, not full milestone completion. The earlier checkpoints below are historical; the old high shoe pickup is superseded by this repair.

# Astrid actual-game dealing and transition checkpoint — 9 September 2026

For a clean continuation prompt, use [PROJECT-HANDOVER-PROMPT.md](PROJECT-HANDOVER-PROMPT.md). It incorporates the useful parts of the older Claude handover while distinguishing historical instructions from the current implementation and Kevin's latest direction.

The active review path is `/?dealer=astrid&performance=staged&rehearsal=1` in the existing blackjack application. The normal dealer routes and existing speech assets remain preserved. This is a staged playable implementation, not completion of every item in the realistic-table plan.

- Player delivery and a separate dealer delivery use packed actor RGB, actor alpha and foreground fingers from one presented-video clock. Measured server-card corners follow contact, then release to the actual transformed DOM card fan. Pickup/landing cues use that same clock. The backend still owns all draws, balances, legal moves, cut position and settlements.
- The dealer take now handles her initial upcard, face-down hole card and all additional dealer draws. Hole-card reveal is still a CSS flip; there is no filmed reveal/collection/shoe-change take yet.
- A new empty-hand lead-in matches the folded resting pose to the original player take's entry. Its 24 frames are prepended; all original contact frames, speech assets and card tracking stay unchanged in speed. Rejected sweep and wrong-direction generations are not loaded.
- Removed long dissolves and the reset to the legacy idle between every card. The previous presented actor stays visible during loading; a new layer replaces it only when its first frame is rendered. No transparent actor blend is used during delivery. The last resting frame is held between actions, so waiting is currently static until another action or speech starts.
- One uniform camera fit registers dealer, shoe, table and tracked card on desktop and portrait viewports. No new account, registration, game or wallet API was introduced. Local guest access remains enabled.

Actual game checks: $5 initial rounds included player/upcard/player/hole delivery; stand performed two additional dealer draws and settled. Refresh recovered J clubs / 2 diamonds against dealer 4 spades with the same $995 balance and $5 bet. After the transition fix, two more consecutive own-card draws were recorded: the presented actor remained visible through the entire boundary, with no idle reset. The final initial-deal recording captured the new player-entry joins and all four deliveries; the recording tool stopped during the final return, while the game completed normally. Confirmed 6 hearts / 8 diamonds against 9 hearts and a face-down hole card, then refreshed to exactly those cards and the same $995 balance / $5 bet. Recordings are in `web/public/dealers/astrid/performance/initial-deal-review.mp4` and `dealer-turn-review.mp4`; they are silent visual evidence, not proof of audio output.

Regression: all four dealers' goodluck line played twice consecutively through the actual rehearsal interface. Astrid used embedded audio/video; Vera, Amira and Mei used matched original streams. Deep 90-stream asset audit passes with the pre-existing missing-take warnings. Hook suite and performance contract tests pass. Earlier in this checkpoint the service checks (197), split checks (77) and 50,000-round sweep passed. No real user database was modified for fixtures. Preview 4176 uses its own temporary data directory; do not delete it while Kevin is playing.

Known limits: extraction still fits partially occluded marker geometry; some release positions require a corrective slide. The own-card source reaches high on the shoe and briefly lifts the prop. Side-direction captures, filmed reveal/collection/shoe change, complete Astrid phoneme review, realistic continuous idle, native Safari and real iPhone/Android checks remain outstanding. The 390 × 844 check also exposed overlapping player/dealer card fans and duplicated mobile header elements; mobile layout is not accepted. Browser viewport checks do not substitute for physical-device acceptance. Do not enable this as default until the full plan's acceptance checks pass. The walkable prototype remains saved outside this milestone.

Source takes, exact packed assets, camera/events/frame records, generation receipts and repeatable preparation scripts are saved with this checkpoint. See `docs/ASTRID-CONTROLLED-CAPTURE.md`. Historical notes below are retained for recovery; current notes above take precedence.

# Walkable casino checkpoint — 9 September 2026

User clarified that the target includes moving a player around the casino, not just a filmed table. `/casino.html` is now a real navigable Three.js room connected to the existing four dealer routes. WASD/arrows, drag look, touch movement and click-to-walk table buttons work. First/third person can be switched. The table proximity prompt enters the existing blackjack game. The bottom “Walk casino” link returns to the saved approach position. Demo wallet and round remain server-owned; no new wallet or independent card simulation was added to the room.

The generated guest GLB (`assets/player.glb`, Tripo job `f048bb88-ceff-473f-92a5-020ba114a45a`) is a real textured full-body mesh. Higgsfield rigging job `ffe67af4-f21a-45c8-a76b-b0ae29fc3470` failed without a reason. `player-rig.mjs` binds a basic local locomotion skeleton to this specific A-pose mesh; it is not a facial or dealer-hand rig. Footstep sounds follow rendered gait phase, opt-in. Source/job metadata is preserved privately under `content/staging/2026-09-09/walkable/`.

Astrid background registration was scaled 32% too large: her 3168x1344 source needs scene width/height multipliers 2.63602/1.11831. Corrected the dealer configuration and removed the extra centre-plate vignette. Checked the actual seated scene at desktop width. No dealer speech media/calibration changed in this checkpoint.

Verified: generated avatar and gait rendered; click-to-walk reached Astrid and exposed seat action; entering table loaded the actual game. Started an isolated $5 hand (5 hearts + ace spades against dealer 6 spades), left to the floor, returned to the same position, sat again and recovered the same cards with $1,000 balance and $5 bet, without a second deduction. Stand completed and balance settled at $1,010. Phone controls and first-person view checked; no browser warnings/errors observed. Three navigation tests cover table/wall collision and table selection. Deep all-four-dealer audit still passes with existing known missing speech takes.

**Scope limits:** the walkable floor has real geometry and an animated guest, but no rigged dealer NPCs or multiplayer. Sitting transitions into the existing fixed-camera game. The earlier hand-contact rehearsal is still rejected for floating contact; Astrid's live action remains disabled rather than reusing the shuffling take. A reference clip can guide pickup/grip/release choreography; it is not model training. This is a playable development build, not photorealistic final delivery.

# Latest saved follow-up — 9 September 2026

The core checkpoint `a91f22c` is pushed and GitLab pipeline 2833139374 passed. No new John commits or recorded GitLab deployments were found during this session.

New hand-contact inspection: `/review/2026-09-09/contact.html`. The cleaned actor take now contains no generated card props. Its real 3D review card follows measured fingertips on the video frame clock, with pickup/landing sounds. This remains a review fixture: hand occlusion and actual table/shoe alignment are not accepted, so it does not replace live dealing. See `ASTRID-DEALING-RETAKE.md` for exact boundaries and next acceptance steps.

Astrid native goodluck was played twice consecutively and logged two complete embedded audio/video cycles. Earlier win twice and all-four-dealer repetitions also completed. These playback checks are not blanket approval of every phoneme or voice likeness.

# Croupier — gameplay handoff for John

Updated 9 September 2026. Read this alongside `ENVIRONMENT-RESTORATION.md` and Git history. This is a working demo with outstanding audiovisual defects, not final delivery.


## 9 September checkpoint — current work

Remote check found no newer commits from John, no open MRs and no GitLab deployment records. Branch head at start was `9721e82`; its pipeline 2829487983 passed. The Higgsfield top-up is now visible (1,002.12 credits at start), superseding the old credit blocker below.

Card foley now comes from presented 3D movement: a light extraction at the first visible movement and a separate soft felt contact at landing. Muted/hidden and skipped frames cannot replay stale pickup cues. The unfilmed hit-button knock was removed. Reduced-motion/DOM fallback emits landing only. All dealers share this path.

Astrid `win` and `goodluck` have new finished MP4s with embedded audio. `speech-media.json` selects these through the shared playback/abort queue; a native video overlays the existing dealer canvas in the same crop. No second MP3 or independent mouth clock runs for these takes. Original streams/calibrations remain intact. Exact transcripts and frame contact sheets were reviewed; voice likeness and full human phoneme acceptance remain open. Native media, text and review notes are now fingerprinted by the roster audit.

The procedural shoe now has beveled acrylic, rounded base/outlet/follower and steel fixings. The reached cut card lies beside the shoe. Counts and game rules still come from the server. A generated GLB failed shape/transparency review and is not used in gameplay.

`/review/2026-09-09/` shows the live shoe with rotation/full/half/cut controls and generated candidates. These inspection controls do not change any player's game. Two card-bearing Astrid action takes failed integration review: first changed framing; second retained framing/rest but produced duplicate cards, including one retained by person segmentation. An empty-hand actor plate is being generated for a server-owned 3D card to follow; no replacement action has been promoted yet. Mei's generated push is awaiting wording review because ASR reports “state” for “stake”; her existing audio is untouched.

Verification so far: 20 focused tests and deep 90-stream audit; all four dealers' goodluck rehearsed twice, Astrid native win twice; isolated Mei round dealt/stand/dealer draws/settlement returned to betting with $1,005 from $1,000 after a $5 winning hand, no browser errors. Gameplay rule suite: 197 service checks, persisted split/double/insurance/idempotency, 77 split assertions and 50,000-round sweep. No real player DB was modified for fixtures.

Local review server: localhost:4174, separate temp database. User preview: 127.0.0.1:4173. The preview server had stopped and was restarted. Low disk space prevented downloading a larger transcription model; the task's temporary Python environment was removed, freeing roughly 1 GB. Existing user files and previous private backups were preserved.

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
