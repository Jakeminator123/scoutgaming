# Restored cycle cadence versus the supplied real dealer

The restored 2x cycle is still too slow for the reference's consecutive opening deal. This is offline source evidence, not gameplay acceptance. No media or public code was changed.

Current 60 fps ledgers contain pickup 75 frames (1.250 s), slide 66 (1.100 s), return 40 (0.667 s): exactly **3.0167 s**. The actor first separates from the card around return n8, approximately **2.4125 s** after cycle start. The empty arm is ready around return n24 (**2.7458 s**); forward gaze settles at n36. Event boundaries are visual estimates, not contact sensors.

In the cached supplied YouTube clip, extraction n283 at 60 fps reaches release n331–335 in **0.800–0.867 s**. The next card is already being extracted around n330–336; another extraction follows around n390–393. That gives roughly **0.78–0.88 s**, then **0.90–1.05 s** between extraction starts. See `reference-next-cards.jpg`, every third native frame n330–450. Those next-card intervals carry a few frames of uncertainty; they are not claimed as exact frame event detections. The reference feeding hand prepares the next card during the delivering hand's outward travel and return. It does not wait for a front-facing idle pose between cards.

Our release is roughly three times later, and our 3.02 s full cycle is about three times the dense reference interval. Increasing display fps alone cannot change this. The current serial source also contains a longer supported upright transfer, a genuine subsequent finger adjustment, and a head-reset phase. A single isolated hit can legitimately be followed by a decision pause; that pause should begin after physical release/return and should not slow the stroke itself. Dense initial dealing should not reset speech/gaze before every card.

## Retiming recommendation and limits

First compare an all-source-preserving **2.5x** cycle, about **2.4 s**. At native24/output60, 2.5x is the highest rate that can show every source frame once. Keep pickup55–61: those are real curl/recontact, not dead time. Keep the full turn through36–46; do not repeat the old cutoff54 edit. This baseline is still far slower than the reference but does not discard native turn poses.

`timings.json` additionally gives an **experimental continuous phase map**, about1.787 s plus encoder endpoint rounding: pickup7–21 at3x;21–36 at4x;36–46 at2.5x;46–55 at3x;55–62 at2.5x;62–66 at3x;slide2–54 at4x;return5–36 at3x. Release would be about1.398 s, empty-arm-ready1.620 s. This is a speed experiment, not an approved recommendation: speeds above2.5x at60 fps necessarily sample across some native poses. Therefore it **does not satisfy a literal every-native-turn-frame requirement**. Do not implement it by deleting frames or cutting over the turn. It is recorded to show why speed alone is insufficient, not to silently authorize skipping.

For a no-skipped-turn alternative, retain pickup7–66 at2.5x and return5–36 at2.5x; only test slide2–54 at4x. Continuous duration is2.0417 s and release1.575 s, still well behind the supplied reference. Keep RGB, actor-R, finger-G, and authoritative card on the exact same time mapping. A future dense opening source needs overlapping feed/receive motion and a hand-ready join; changing the existing return endpoint24 to the next pickup7 without checking head/body continuity would introduce a new jump.

## Evidence provenance

Reference: cached `youtube-reference/watch/download/video.mp4`, https://www.youtube.com/watch?v=dfE-7NV4Vh8; SHA2567f912f65a4bd8cf0b00c26fd196cdd956b9666cbc272bc35bada015e736d4a8e. Native first-cycle frames previously reviewed in `motion-review/LOW-TURN-SPEC.md`; the next-card sheet was newly extracted for this check. Source SHA values and current frame counts are in `timings.json`, read from cycle60-draft ledgers. Return release/ready events correspond to `integration-diagnostic/return-to-ready/NEW-RETURN-REVIEW.md`.

Reproduce sheet with ffmpeg select between(n,330,450)*not(mod(n,3)), crop600:290:270:245, scale480:232, tile6x7; `measure.py` labels the cached /tmp sheet and emits calculations. No synthetic gameplay state or server arrival was used as physical evidence.
