# Local environment restoration — 2026-09-08

Working directory: `/Users/solvifyab/Desktop/croupier`.
Branch: `codex/restore-casino-environment`.
Run: `HOST=127.0.0.1 node web/server.mjs`.
Game: http://127.0.0.1:4173/
Rehearsal: http://127.0.0.1:4173/?rehearsal=1

## Preserved baseline
The original checkout was already at 8de4800. Its uncommitted source media, encoded working files, calibration scripts and bust-settle test are preserved. The inspection clone under Scout-Gaming is not the running app. No dealer media regenerated; no generation credits spent; no production deployment.

## Changes
- Replace the foreground table PNG with a Three.js mesh: felt surface, extruded body, raised leather rail, brass edge and card shoe. Render only on resize/context restoration; pixel ratio capped at 1.75.
- Crop the room plate at the rear rail, eliminating its duplicate foreground furniture. Preserve dealer film, original scene registration and hands; correct wide-screen framing.
- Project seat targets from the same camera as the table; three targets fit within the portrait viewport. Original table image remains a WebGL fallback.
- Speech turns own their timers, cancellation and audio events. Audio is ready before cutting to the take; only its requested painted frame starts the delay. Repeating a line no longer mistakes the old clip for a new start. Unmatched audio never reuses a mouth saying different words.
- Tag decoded frames with submission-time identity, clear pending decodes on interrupts and match hand mattes by timestamp.
- Optional rehearsal panel selects four existing dealers and recorded lines, explicitly showing missing matching clips. Play twice exercises real in-game playback, without AI generation.
- Reject the observed upstream session-limit message as a chat failure instead of showing it as dealer dialogue.

## Verification
- Six speech/decoder/provider-message regression tests pass.
- Split suite: 77 checks and 50,000 randomized rounds pass.
- Existing original-checkout bust-settle suite: 10 checks pass.
- Browser: desktop Vera and Astrid rendered; portrait 390x844 has three fully visible main-bet targets. A demo Astrid round completed (goodluck, insurance, dealer blackjack, placebets), without logged errors. Vera goodluck repeated twice: start/end at 07:39:51.580/54.878 UTC, then 54.947/58.245 UTC, no overlap.
- Syntax and whitespace checks pass.

## Remaining work and limits
This is a real 3D table with filmed dealers, not rigged 3D human characters. Existing assets contain no GLB/glTF character rigs. Preserving the approved faces while adding a full human rig, facial blend shapes and natural motion requires a separate character pipeline and visual acceptance.
Playback fixes do not prove every original take has accurate lip motion. Missing clips and existing per-take word/phoneme mismatches remain visible in rehearsal. Compare by ear and eye; do not regenerate approved takes blindly.
The external chat backend returned a session-limit error during the demo. Recorded dialogue works independently; the upstream account limit itself is not fixed.
The stream builder still requires the documented calibration pass after rebuilt assets. No streams were rebuilt here.
