# Filmed hand in front of existing dealer cards

The sideways fan fixed placement but not depth: the source video remained underneath every SVG card. At dealer frame 32, an existing ace visibly covered Astrid's fingers. The incoming card's existing paper contour could not protect older cards.

`game-cards.js` now clips the complete card layer with a source-frame hand contour. Its even-odd holes expose the filmed fingers over existing cards, including the hidden card. It follows the hand through withdrawal, beyond the frame when the incoming face becomes stationary. Source changes, cleared rounds and interrupted deals reset it. Card values, timing, placement and video assets are unchanged.

## Calibration and cost

`build-tracks.py` measures the original eight 24 fps dealing clips offline with OpenCV. `measurements.json` records source hashes and frame counts. The contours retain only skin entering the dealer-card area, exclude isolated table lettering, and are bounded to the dealer fan plus an antialias margin. `source-contours.jpg` shows source-frame samples.

The generated module is about 27 KB. SVG clip paths are precomputed once and updated only on changed source frames. There is no video duplication, canvas readback or runtime skin detection. These masks are tied to the exact source clips; regenerate and visually verify them if those clips change.

## Verification

- `node --test test/*.test.mjs`: 101 passed; results in `tests.txt`.
- The regression checks actual finger/paper coordinates at source frames 32, 48, 51 and 56, all source hashes, deterministic pause/seek selection, the mask on the complete card layer, and resets after release, source switches and cleared rounds.
- Browser reproduction and corrected capture at frame 32: `before-frame32.png`, `after-frame32.png`. `hand-layer-detail.png` is a direct browser screenshot crop of the corrected fingers.
- Close-up review with six cards at contact, turn, thumb hold and withdrawal; normal-speed playback and a hidden second card checked in `/review/card-contact.html`. Additional captures at frames 40 and 48.
- Separate local playable demo session `hand-layer-qa`: opening deal, hidden hole, reveal and settlement passed at 393 x 740. Player 8H/QD = 18, dealer 7S/JH = 17, $5 demo stake, $10 returned. Cards cleared for the next round, and the QA player left the table. `mobile-round.png` records settlement. This is responsive browser verification, not a physical-device performance claim.

This is a local game correction, not a production deployment. The first layout fix alone did not resolve this overlap.
