# Astrid reference comparison loop

User reference: [Live Blackjack by Evolution Gaming — Casino Canuck](https://www.youtube.com/watch?v=dfE-7NV4Vh8). Use this as the behavioural and visual-quality target for Astrid. Preserve Astrid's own face, hair, outfit, room, table and camera. This is an implementation/evaluation loop, not training model weights.

The existing `finish-astrid-gameplay-verification` heartbeat was updated in place to **every 30 minutes**, ACTIVE, in the existing task. It compares evidence, attempts one bounded improvement when justified, checks actual gameplay and records the result. It should report verified improvements, meaningful failures or required input, not repeat unchanged status. No second automation was created.

## Tool and reference evidence

Used the requested [claude-video /watch](https://github.com/bradautomates/claude-video), pinned at `83da59fa78c3eee9e20f515fe75c438bb5166efd`, installed locally at `/Users/solvifyab/.codex/tools/claude-video`. The existing yt-dlp 2025.12.08 download failed with HTTP 403; the isolated 2026.08.19 runtime succeeded. Do not reuse the obsolete system downloader. Use `watch-reference.sh` below. No API key was required, used or saved for this reference inspection.

Cached source: `watch/download/video.mp4`, with SHA and decoded media properties in `receipt.json`. Downloaded source and extracted frames stay local and are ignored by Git; do not ship third-party footage in the game. Full scan: 16 inspected frames across the approximately 142-second clip. Focused opening: 24 inspected frames over 0–12 seconds at 2 samples/second. These are visual observations, not an audio/transcript analysis: no captions were available and Whisper was disabled.

The watch report rounds timestamps to whole seconds; extraction also samples rather than measuring a release at every native frame. Treat timing below as approximate, not exact contact calibration.

## Initial comparison — 13 September 2026

Astrid baseline: commit `bc3b06f`, the actual seven-seat round reviewed immediately before this reference request at 18:53–18:54 UTC. This request adds a benchmark and scheduled iteration; it does not claim a new gameplay improvement merely from watching the reference.

| Criterion | Reference observation | Astrid baseline / next requirement |
| --- | --- | --- |
| First-pass cadence | About 0:05–0:11 shows continuous outward deliveries and immediate empty-hand returns. Roughly 0.7–1.0 seconds between successive placements; remeasure native frames before tight calibration. | Last verified opening played 16 card takes in about 17.5 seconds after entry, roughly 1.1 seconds/card including gaps. Reduce wasted holds and setup latency before globally accelerating motion. |
| Real receiving positions | Different arm extensions and wrist angles place cards across the visible table arc. | Server cards reach seven fans, but four inner seats still reuse nearby directional footage. Physical contact is not accepted. |
| Shoe and hand roles | One hand stays near the shoe while the dealing hand carries/slides the next card and returns. No folded-arm reset between successive cards. | Feeding-hand paper remnants and estimated hand proxies remain. Correct source motion/contact rather than stretching the actor. |
| Before/after motion | Around 0:00–0:05 the dealer gestures, clears the table area and goes directly to the shoe. At about 1:02 she rests with hands together; she does not mechanically repeat one resting pose after every action. | New matched entries/returns are installed. They add roughly two seconds per connection; evaluate gesture economy and natural readiness without reintroducing hard cuts. |
| Human body and attention | Head/gaze follow destinations; shoulder and torso shifts support the reach. The first pass has visible destination-specific wrist placement. | Keep natural filmed proportions; no actor warp. Current generated footage is not sufficient evidence for four new physical reaches. |
| Contact and collection | Cards remain physical objects under the fingers. Around 0:53 the dealer reaches across to gather cards; around 1:02 the table is clear. | Paper remnants and synthetic contact must be judged at pickup, release and collection, not merely by final card positions. |
| Scene and skin continuity | The same camera and exposure persist through the sampled first-person view. Around 1:37 the recording deliberately changes UI/view; that is not a dealer continuity target. | Preserve current camera, table, identity and exposure through idle/speech/action/return; evaluate face and hand colours together. |

The largest remaining discrepancy is **destination-specific physical contact and continuous hand motion**, not a lack of a 60 fps output label. Do not call the target achieved by changing playbackRate or interpolating additional frames alone.

## Each scheduled comparison

1. Read AGENTS.md, the latest handoff, this file and saved generation receipts. Confirm the current branch/media hashes; never duplicate a pending generation.
2. Reuse the cached reference. Inspect the relevant moment with `/watch`; for contact timing, inspect denser native frames as needed and explicitly distinguish measurements from estimates. Do not repeatedly download the whole video.
3. Observe a real isolated Astrid round at `?dealer=astrid&performance=staged&motion=smooth60`. Never play a hand or reload an active hand in the user's guest. Capture before dealing, pickup, every served direction, release, return, decisions, dealer draws when present, speech and settlement.
4. Save a comparison under `runs/<timestamp>/`: reference time, game commit and media hashes, exact observed difference, relevant visual evidence, affected seats, timing method and uncertainty. Mark unobserved items unverified rather than passing them. This is not a numeric similarity score unless a reproducible metric exists.
5. Choose the highest-impact supported change, implement it separately and compare before/after. Keep identity, exact paired speech/audio and server-owned cards/wallet intact. Reject unsuitable media. Keep 3D paused.
6. Run checks appropriate to the change and the repository-required audits. A rendered full round and inspected clip transitions are required for a gameplay improvement claim. Record regressions and unresolved limits. Commit only task-owned files and update the handoff.
7. Notify only a verified improvement, meaningful failure or concrete blocker. Pause the loop only after the user's visual target is verified; do not treat a completed generation or a green test suite as acceptance.
