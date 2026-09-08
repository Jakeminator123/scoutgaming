# Local environment restoration — 2026-09-08

Working directory: `/Users/solvifyab/Desktop/croupier`.
Branch: `codex/restore-casino-environment`.
Run: `HOST=127.0.0.1 node web/server.mjs`.
Game: http://127.0.0.1:4173/
Rehearsal: http://127.0.0.1:4173/?rehearsal=1

## Preserved baseline
The original checkout was already at 8de4800. Its uncommitted source media, encoded working files, calibration scripts and bust-settle test are preserved. The inspection clone under Scout-Gaming is not the running app. The initial restoration did not regenerate dealer media or spend generation credits. No production deployment.

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

## Visual correction loop — 8 September
- Added a generated 3:1 outer room plate (`assets/room-extended.png`) based on the existing empty-room source. The central original backdrop remains registered to the filmed dealer. The transition excludes the original outer sconces, avoiding doubled lights. Other dealers retain their own registered scenes.
- Added two table pedestals, bronze feet/collars, deeper table body, carpet and soft cast shadows. Reduced desktop tabletop depth to leave room for the supports.
- Replaced the primitive shoe blocks with the existing detailed transparent shoe cutout, facing the fixed camera, with a contact shadow on the felt. This is a photographic billboard, not a fully modeled interactive shoe. Its horizontal placement is clamped inside phone viewports.
- Unified betting-ring centres, perspective and rotations. Labels follow their crescent rather than independent calibration angles. Warm, restrained ink replaces bright outlines.
- Prevented the scene container from scrolling when focus/click brought overflowing seat descendants into view (`overflow: clip`). Reproduced a 55px upward camera shift before the fix; verified zero scroll after main and side bets.
- Iterated browser renders at 1920×920 and 390×844. Verified $5 main + $5 Perfect Pairs produces a $10 total, then cleared the demo bet. Checked Astrid's room as well as Vera. No browser errors/warnings; module syntax checks pass.
- Generated background source remains at `/Users/solvifyab/.codex/generated_images/01a07fda-b136-7c40-a3f1-3156faac4d1f/exec-ef0a5481-f909-4e62-9973-61f1f124e987.png`.

The room remains a composited broadcast scene: filmed dealer, photographic background and shoe, plus a real mesh table. It has no free-moving camera. These visual changes do not establish production readiness or repair every recorded mouth take.

## Persistent shoe and dealing — 8 September, follow-up

The current shoe replaces the earlier photographic billboard with geometry (`shoe-model.mjs`): transparent acrylic walls and edges, sloping card pack, printed card back, follower, exposed card edges and separate red cut card. The stack shrinks with each server draw; the cut card advances to the outlet and is pulled clear when reached.

`web/shoe-game.mjs` is authoritative for a demo table per player profile. Eight decks (416 cards), one face-down burn on a fresh shoe, cut reached at 312 removed cards (75%, including the burn). Finish the current round; reshuffle only when starting the next round after collection. These are this demo's configured rules (`SHOE_RULES`), not a claim of universal casino requirements. The cut is a marker, never a playable card. An exhausted shoe raises an error and rolls back the command rather than inventing a card or shuffling mid-round.

`/api/table` persists the private shuffled order, round, revision and last command in SQLite alongside each wallet change in one transaction. Commands validate phase, legal action, stakes and funds. Request IDs make retries idempotent; revisions reject stale actions from another tab. Responses exclude the future shoe, burn identity and unrevealed hole card. Client wallet overwrites are rejected after a table is created. Currency changes wait until the round is collected. Refresh resumes an unpaid round and cannot silently redeal it.

The browser consumes round snapshots and animates every visible draw from the modeled outlet in screen coordinates. This avoids the previous hidden `#shoe2d` origin and transformed-seat coordinate error. Initial cards are paced separately; split draws, doubles, hits and dealer draws share this path. A hole-card reveal does not consume another card. The new-shoe interlude blocks betting while the shoe refills. No recorded rule audio was regenerated: obsolete fresh-every-round/certified-RNG takes are excluded from the live bank. The disclosure and dealer prompt now describe the server-shuffled demo.

Validation: 197 shoe/service checks plus deterministic persisted split, double, insurance and duplicate-collection checks. Existing 77 split checks and 50,000-round sweep passed; 10 bust-settlement checks and six speech/decoder checks passed. Browser: played a server round (411 cards after four dealt from 415; hit to 410), refreshed at player 17/dealer upcard 8 with balance 990 unchanged, stood and completed settlement. Checked full, half and reached-cut model states in an isolated temporary preview, then removed that preview. No browser warnings/errors observed.

Rule reference: Pennsylvania's published blackjack rules require reshuffling after the cut card is reached and the current round completes: https://www.pacodeandbulletin.gov/secure/pacode/data/058/chapter633a/s633a.5.html and https://www.pacodeandbulletin.gov/secure/pacode/data/058/chapter633a/s633a.7.html . The 75% placement and face-down burn are explicit demo configuration choices.

Limits: this remains demo money and the existing demo player-ID identity scheme, not a certified RGS or authenticated real-money wallet. Each profile has its own table, not a synchronized multiplayer broadcast table. The filmed dealer does not yet physically grip the animated cards; the shoe-to-hand animation is rendered separately. The existing lip-sync limitations still apply.
