# Continuous dealing motion reference

`consecutive-deals-native60.mp4` is a silent **5.000 second** direct trim of the cached supplied YouTube source, native frames **240–539 inclusive** (source4.000–9.000 s). It retains the entire1280×720 picture, original60 fps, original speed and all300 consecutive frames. No crop, resizing, interpolation, cuts inside the segment, hand warping, frame dropping, or synthetic motion. Lossless H.264 encoding allows decoded source/output SHA256 equality for all300 frames. Original downloaded file is unchanged; no external upload was made.

This is a motion reference, not Astrid identity, lighting or camera approval. It is the same fixed frontal, slightly elevated table camera used for the measured first deal; shoe remains screen-right, both hands and head/torso stay visible. The dealer's lower body is hidden by the table in the source, so the clip cannot provide unobstructed anatomical full-body evidence. The watermark and surrounding source UI remain; do not treat them as generation targets. Current Astrid is closer in framing: use her accepted source for identity, outfit and camera registration.

## First complete hand cycle (times within trimmed clip)

| Source frames | Clip time | Observed action |
| --- | --- | --- |
|240–282|0.000–0.700 s|Lead-in and hands approach the shoe; receiving hand opens near outlet.|
|283–291|0.717–0.850 s|Feeding hand draws one back-up card out near the felt into the receiving hand.|
|292–301|0.867–1.017 s|Brief supported upright transfer; do not replace it with a tall hold.|
|302–309|1.033–1.150 s|Compact wrist turn completes; delivering hand immediately moves outward. Feeding hand returns to the outlet.|
|310–330|1.167–1.500 s|Low face-up slide toward the first destination.|
|331–335|1.517–1.583 s|Fingers release; empty receiving hand starts back. Next card extraction is already beginning.|

The next extraction is visible approximately source330–336 (clip1.500–1.600 s) and the following around390–393 (clip2.500–2.550 s). Those bounds come from every-third-frame review, not an exact fingertip detector. The wide sheet shows additional consecutive deliveries through the end. The key behavior is overlapping feeding-hand preparation while the delivering hand finishes its stroke; no complete forward-facing idle reset between these opening cards.

Do not turn this into a3 s serial extraction→pose→slide→head-reset cycle. Do not use faster frame playback as evidence that current Astrid reproduces this motion. Preserve continuous support during the brief turn, observed empty-hand release, and preparation overlap in the next source candidate.

## Reproduction and verification

Run `prepare-reference.py --build` with the existing bundled Python; no new dependencies. Default invocation verifies the existing output. `motion-reference-receipt.json` records full source/output SHA256, exact ffmpeg arguments, count/dimension/fps probe and all-frame equality. `source-frames.sha256` and `output-frames.sha256` record every decoded native frame. `motion-reference-wide-sheet.jpg` is only a viewing aid, labeled with original native frame and trim time; the delivered clip is unannotated.
