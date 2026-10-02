# Independent low slide review

Source: `../low-turn/slide.mp4`; 1920x1080, 97 native frames, 24fps. No public change, generation or approval. Reviewed native samples n0,6,12,...96, enlarged n0/12/24/36/48/60/72/84/96, and every frame n20-47 around the contact transition.

**Verdict: supported low pushing motion is a useful actor candidate, but REJECT the current source as a rigid-card slide. Do not generate a matching return on the assumption that its card geometry is correct.**

## Motion and contact

- n0-24: index fingertip stays at/over the card's near upper-left region while arm moves outward. No obvious vertical display/lift in these inspected frames.
- n20-47 dense inspection: hand and card progress together. Index-only push broadens into several fingers across the near edge around n32-36. No obvious detached free drift in this interval. These are visual observations, not per-frame measured contact calibration.
- n48-60: hand remains over the upper card edge as motion slows near the front position.
- n60-96: long landing hold; fingertip still covers the card. This clip does not provide an empty-hand release/return. Do not label n60 as a measured release merely because displacement becomes small.

## Rigidity measurement

Native white-paper boundary threshold inside x850..1160/y570..900, outer contour convex hull, polygon simplification 2.5% perimeter. Values are approximate visible-boundary measurements, affected by fingertips and rounded corners; not approved tracking. Opposing edge pairs below describe the observed projected lengths, not inferred physical card dimensions.

| Native frame | Hull area px² | Longer edge pair px | Shorter edge pair px |
| --- | ---: | --- | --- |
| 0 | 2050 | 57.4–61.1 | 36.2–41.1 |
| 12 | 2434 | 60.4–62.3 | 41.4–43.4 |
| 24 | 3978 | 68.1–71.6 | 52.0–60.9 |
| 36 | 6142 | 82.5–84.3 | 65.0–67.4 |
| 48 | 7183 | 90.0–93.0 | 69.0–71.0 |
| 60 | 7495 | 84.0–93.0 | 77.2–80.1 |
| 72 | 7578 | 85.0–93.0 | 79.2–80.0 |
| 84 | 7662 | 85.0–94.0 | 78.3–80.0 |
| 96 | 7662 | 84.0–94.0 | 78.3–81.1 |

Area grows **3.74x** n0→96. Both edge families increase, with short projected edges approximately doubling. Long edges are broadly horizontal at both endpoints, so changing card yaw alone cannot explain this. The game uses an orthographic camera: a rigid card lying on one fixed plane has constant projected area under translation and in-plane rotation. The observed footage therefore cannot serve as an unchanged flat-card trajectory in that camera.

A hypothetical different perspective camera can change projected area with depth; this measurement does not prove the physical dimensions of an unknown filmed prop. But no calibrated camera/table homography supports that explanation here, and it does not match the actual game projection. Card artwork also changes between initial Q-like print and clear final K print; prop identity must be server-owned.

## Correct next reference

Project one fixed-dimension rigid game card onto the canonical table plane at BOTH initial near-shoe and final landing positions. Keep its actual projected quadrilateral/scale consistent with that camera; preserve the observed touching finger location where possible. Build the landing reference from that projection before requesting another slide. Do not reuse the current oversized landing paper, shrink/grow an overlay over time, or stretch the actor to match it.

The actor may still support a separate authored fixed-size prop test with source-card removal and measured fingertip masking. That would be explicitly authored geometry, not evidence that the source card was rigid. Real rendered contact must be inspected before accepting it or spending on a dependent return.
