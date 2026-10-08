# Card size, diagonal spacing and first-white-frame replacement

2026-09-25. Source clips are unchanged. No generated media or credits.

- The previous renderer applied 0.625 foreshortening to the already projected 63 × 85 pixel source rectangle. Cards now retain that measured size.
- After user review, the horizontal row was replaced with a compact diagonal fan: 30 pixels left / 26 pixels up per arrival, with total spread capped at 60 pixels horizontally / 110 vertically. Cards remain 63 × 85; the newest card stays at the source landing. This supersedes the 71-pixel horizontal spacing in commit b9589c8.
- The white face is measured on every decoded frame. Two SVG triangles map server-provided ink into that quad; a separate visible-paper contour clips the ink underneath fingers. A separate opaque outer paper contour covers previously dealt SVG cards, preventing their ranks/suits from showing through. Its fill is the source-frame median white colour; the inward ink contour still excludes fingers. A private hole card uses the back artwork and never receives the concealed rank/suit.
- `measurements.json` records zero-based first-white frames, source hashes and final quad observations. `seat-*.jpg` shows the unsmoothed rectangular extent (green) and visible-paper mask (pink). The first thin, warm motion-blurred frame for seats 6 and 7 uses a manually bounded outline; these are explicitly recorded in the builder.
- Frame measurements: seats 1–7 = 51, 44, 47, 47, 43, 41, 44; dealer = 37. Native `mediaTime` rounding is tolerated by 1 microsecond, without moving the trigger a whole frame late.
- Build: from the repo root, run this folder's `build-tracks.py` with OpenCV, numpy and Pillow. Dependencies were installed only into a temporary analysis directory, not the application package.

## Observed verification

Browser review used the production renderer with the original source MP4s. Observed center-seat frames 47–49 through the wrist turn, the two-card normal-speed playback and its final side-by-side layout, and dealer frames 37–38. The live engine table also visibly displayed separated two-card hands at seats 3, 4 and 5 plus the private dealer hole. That user-controlled hand was not acted on or reset by QA. The earlier isolated QA round was taken over in the browser, so its completion is not claimed as an unattended full-round test.

`node --test test/*.test.mjs`: 20 passing tests, including the existing 197 shoe/service checks. Tests cover spacing, source-frame visibility, deterministic seeking and triangle corner mapping; they do not replace visual acceptance.

## Limits

This change does not generate new motions or change the game engine. Incoming-face contours are not a full depth matte for previously dealt cards. The diagonal spread is bounded; longer hands overlap more within their own seat. No card shrinking is applied.

## Diagonal follow-up verification

Observed the original three-card source playback with all seven neighboring hands present, then six-card hands at every seat (42 cards) in the same browser renderer. Hands stayed within their horizontal seat bounds. Reloaded the active live demo and verified the three occupied seats retained their cards, stake, balance and current decision while adopting the diagonal layout. No game action was taken on that user-controlled hand. All 19 tests pass, including contact continuity, fixed-size projection and neighbor bounds through 12-card hands.

## 2026-09-25 ink overflow and jitter correction

The incoming face previously contained only transparent ink over the source video.
Older SVG cards therefore painted above its paper and showed through the new face.
The production renderer now gives that face an opaque, finger-excluding paper
polygon before drawing its ink. The ink is also clipped to the inset rounded card
boundary; the two-character 10 rank has additional inset. Card size and fan offsets
remain unchanged.

From the third visible white frame, the pose fits the whole rectangular extent,
not a four-point simplification that sometimes selected a thumb indentation as a
corner. Offline symmetric five-frame quadratic smoothing removes small pose jitter;
all original 24 fps triggers and unsmoothed finger masks remain in place. RMS corner
second difference after the initial turn fell from 2.24 to 0.83 source px/frame² at
seat 4, and 10.54 to 1.61 for the dealer. This is a numerical stability check, not a
claim that the generated source motion is physically perfect.

Browser checks: production renderer + original MP4, center card 2 and card 3 at
first-white, turning and hand-clear frames; half-speed playback and dealer turn.
`browser-opaque-third-frame49.png` captures the corrected third-card overlap at 3x.
The foreground print no longer shows the older ranks through it and the thumb
remains visible in front. Existing limitations about later reaches still apply.

The open gameplay view was reloaded and retained the user’s 7♥ + 9♣ hand (16), $30 stake and $987.50 demo balance. No decision was made on that hand. The update was verified at rest there; motion checks above used the isolated review page.
