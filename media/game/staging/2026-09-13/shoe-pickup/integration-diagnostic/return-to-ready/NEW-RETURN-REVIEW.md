# Matching return: independent native review

Source low-turn/return.mp4:1920x1080,97nativeframes at24fps. SHA256: f5236f1c185ab6ca665d7f177610c583a2d44265f42145f310f7e84e6a354396.

**Verdict: usable actor-motion candidate for staging; not yet a pixel-matched seamless cycle or approved prop/contact asset.** It corrects the former250px left-rest versus adjacent-shoe arm mismatch.

Reviewed every6th native frame0–96, every frame5–24 at enlarged hand detail, face crops every12th frame, and full final frame96 beside low-turn/source frame0.

## Useful continuous interval

- n0–5: landing-contact hold. Candidate starts n5 only if incoming actor endpoint matches this actual frame.
- n5–7: fingers remain at the top of the stationary source card.
- n8: first visible fingertip/card gap in enlarged frames; treat as release candidate, not pressure measurement.
- n9–22: hand visibly empty and retracts diagonally to the adjacent-shoe ready location. Feeding hand remains at shoe; no new pickup or return with a card.
- n24: arm broadly at ready location, while head/gaze is still finishing its rise.
- n24–36: gaze/head settles forward. Include this if returning to forward ready.
- n36–96: mostly hold/subtle idle, unnecessary for each deal.

Recommended initial staging cut **n5–36 inclusive**,32nativeframes/1.333seconds at24fps. Do not replay the full4seconds. Cadence retiming is separate from this source review and needs presented-frame playback/edge checks. For an arm-only endpoint n24 is earlier, but it is NOT the same head/gaze as the forward ready take.

No obvious card lift, unwanted re-pickup, detached card carried by the returning hand, or torso warp was seen in those inspected frames. This is not blanket all-pixel visual acceptance.

## Prop and seam findings

Contrary to the expected no-card endpoint, the **source K remains visible through n96**. It should still be excluded from the actor matte and replaced by the persistent authoritative game card; do not infer disappearance from the submitted endpoint image.

Final receiving hand near[1115,596] and feeding fingertips near[1238,596] are approximately17–20px above their counterparts in low-turn/source n0. Hair/head is about10px above. These are rough native visual landmarks, not calibrated exact correspondences. The pose category now matches, but source framing/scale differs slightly. A uniform registration fit using several stable actor/camera landmarks must be inspected before joining; do not translate only hands or blindly crossfade. n24/36 endpoint requires its own measured fit, not automatic reuse of the final-frame estimate.

Preserve the same fixed server card through incoming slide, release, return and next pickup. Source paper identity/size is not approved, and the earlier large landing-card growth remains separate. New person/finger mattes must exclude source K without damaging first8frames of finger coverage.

No public changes, generation or new video were made by this review.
