# Elevated camera: first dealer upcard source track

This is the 97-frame native 1920×1080, 24 fps source `de1f90a9-b8db-4a64-a46d-7c8f9d0665ef`. Scope is **Astrid's first face-up card to herself only**. All 97 native frames were inspected in raw/annotated sheets; the blurred turn was also inspected in enlarged crops. `card-track.json` includes the exact source SHA and every frame's plane, confidence, inferred corners, hand contact and phase.

The `quad` uses fixed UV order 00,10,11,01. At the endpoint, that is far-left, far-right, near-right, near-left. One constant cyclic UV assignment across all 97 frames makes printed card art upright to the player at landing; identical markers do not establish the printed top, so that texture orientation is authored. Do not independently sort corners by screen position. **The material-corner correspondence through frames 27–29 is inferred:** the card is blurred and nearly edge-on, its tracking markers disappear, and the green faces do not identify which physical side reappears. `faceUp` is therefore an explicit authored semantic assignment (false through 29, true from 30) at the observed wrist rotation, not a measured card-face identity.

| Event | Native frame | Seconds |
| --- | ---: | ---: |
| Fingers already contacting exposed card | 0 | 0.000 |
| Extraction starts | 3 ±1 | 0.125 |
| Card clears shoe | 7 ±1 | 0.292 |
| Transfer into other hand | 18–24 | 0.750–1.000 |
| Edge-on wrist rotation | 27–29 | 1.125–1.208 |
| Assigned face-up after turn | 30 | 1.250 |
| First felt contact | 33 ±2 | 1.375 |
| Contact slide stops | 43 ±1 | 1.792 |
| Fingers visibly separate | 57 ±1 | 2.375 |
| Safe landing cue after separation | 58 | 2.417 |
| Empty hand returns beside shoe | 73 ±2 | 3.042 |

First felt contact is not release. Astrid continues sliding the card and keeps her fingers over it until approximately frame 56. Render the replacement beneath the finger matte for the whole action. The initial green card is already exposed and touching her fingers; replacement visibility must start at frame 0.

Final quad is `[[933,614],[987,614],[990,675],[931,675]]`, centre `(960.25,644.5)`. First-frame exposed card quad is `[[1233,668],[1278,625],[1312,650],[1275,693]]`. The hidden initial corner and generated changing shape are plane estimates, not a rigid 3D reconstruction. Confidence is a qualitative inspection score, not a probability.

`shoe-registration.json` measures the source's unobscured frame-7 front lower lip edge at `[1244,662] → [1287,685]`, anchor `[1265.5,673.5]`, uncertainty ±4 px. Its upper throat is a different point `[1292.5,634]`. Match the game outlet definition, and apply one rigid registration to the actor, card and shoe. `shoe-registration.jpg` labels both features.

Five `annotated-sheet-*.jpg` files cover every frame. Cyan corners have visible edge support; yellow corners are inferred. `turn-detail.jpg` shows the original turn. `annotated-motion.mp4` is native-speed source geometry evidence. `card-visible-masks.zip` contains chroma/marker cleanup aids inside the fitted plane; these are **not** actor mattes and do not remove all motion-blur or dark card edges.

No generation, game code, server card state, source RGB, camera, skin or timing was changed. The source ends with one hand beside the shoe and one beside the card; it is not a seamless loop to the initial grasp. This track does not establish visual acceptance in rendered gameplay.

## Reproduce

1. Extract source frames into `frames/001.png` through `097.png` with ffmpeg, preserving native frames.
2. Run `inspect_contours.py` with OpenCV, NumPy and Pillow (raw diagnostic only; lime detection intentionally misses edge-on frames 27–29).
3. Run `build_track.py` in the same environment. It emits all 97 manually reviewed/inferred quads and verifies positive winding and convexity.
