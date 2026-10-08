# Felt cards and frame-calibrated left slide

Scope: the local Astrid demo, presentation only. Original media, server-owned draws, wallet and rules are unchanged. No media generation.

## Measured contact

Decoded every source frame in the contact window (24 fps). The JPG sheets label **zero-based frame indices** and timestamps. The yellow outline marks the existing game card's projected footprint; it is not drawn in gameplay. Contact means the incoming card first reaches that footprint, before turning face up. The old timing incorrectly waited for the later lowering/release.

| Destination | Contact frame | Time | Earlier by | Fingers clear / face replacement |
| --- | ---: | ---: | ---: | ---: |
| 1 | 39 | 1.625 s | 25 frames | 68 |
| 2 | 38 | 1.583 s | 21 frames | 63 |
| 3 | 34 | 1.417 s | 26 frames | 64 |
| 4 | 31 | 1.292 s | 30 frames | 64 |
| 5 | 27 | 1.125 s | 29 frames | 60 |
| 6 | 26 | 1.083 s | 31 frames | 60 |
| 7 | 31 | 1.292 s | 31 frames | 67 |
| Dealer | 26 | 1.083 s | 20 frames | 51 |

`contact-measurements.json` records source hashes and frame numbers. If the source clips change, remeasure. Frame-level visual picks have at least one source-frame resolution (41.7 ms); this is not a physical contact reconstruction.

## Runtime

- `public/card-table-layout.js` owns timing, fixed-size felt projection and bounded left fan.
- A second card moves the first 40 source pixels left and only 6 up. Larger hands fan within a 64-pixel horizontal envelope, including the leftmost seat.
- `public/game-cards.js` retains draw-keyed nodes. The new card's slot is reserved before it appears, so revealing it does not move the old cards twice. Hole reveal changes the face on the same node.
- The slide starts at the measured contact, eases to a stop over 380 ms, and uses the video's own clock. Seeking/pausing does not accumulate motion.
- The game face and the small clean-felt patch wait until fingers leave the prop. The patch persists across the final held source frame and is removed when the next video actually becomes visible.
- `public/app.js` forwards `requestVideoFrameCallback`'s `mediaTime` (fallback: video time).

## Inspection

Open `/review/card-contact.html` for the same renderer, exact source videos, selectable seat and incoming card 2/3/4, normal/half speed, and before/contact/mid-slide/hand-clear/after checkpoints. This page uses fixed review cards and never calls the game engine or wallet.

Observed in the browser: middle card 3 is stationary before contact (f29), sliding left at f35 while the hand is still delivering, then retains the same fan when the third face appears. A complete native game opening and blackjack settlement were also observed during this change; that first run preceded the final earlier-contact calibration. The user table was reloaded with its current 17-point hand, $945 balance and $10 stake preserved. No decisions were made on that hand.

Automated checks: `node --test test/*.test.mjs` passes, including frame timing, no pre-contact motion, second/third/larger hands, seek/pause determinism, fixed projection, seat bounds, original engine checks and wallet isolation. These checks do not certify per-finger occlusion. The existing video + SVG overlay still has no foreground finger matte; this work improves plane alignment and contact timing, not source anatomy.
