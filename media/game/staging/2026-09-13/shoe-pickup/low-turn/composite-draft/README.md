# Slide actor / hand masks — staging draft

Native slide n0–54 only, 1920×1080. `slide-rg/0000.png` to `0054.png`: RGB, red actor alpha, green visible connected hand skin foreground, blue zero. Inputs numbered n+1. Source RGB is unchanged. No anatomy is synthesized.

Rebuild with `build-slide.py` using Pillow, numpy and OpenCV (the local OpenCV install is `/tmp/astrid-optical-flow`). `SHA256.json` fingerprints all 55 RG files and the script; `slide-receipt.json` records observed-paper input hash and per-frame components.

## Review

All 55 native hand frames inspected through `slide-review-0.jpg` to `slide-review-4.jpg`. Source paper, shoe and table lettering removed. Connected queen artwork leaked at n7 and n39 in the first draft; the final draft restricts restored skin inside the observed paper hull to the observed fingertip x/y plus 3 pixels. `paper-cleanup-details.jpg` compares those native source and final crops. This is a conservative visual bound, not measured anatomical contact.

Upper contour opening removes the bright shoulder speck; confidence ramp retains the actual moving sleeve after an earlier threshold made n28–34 translucent. `contour-n0.jpg` and `contour-n30.jpg` show original/cleaned body. The ramp is 195–225 confidence; upper-body mask opening/erosion fades out y550–590 and is not applied globally to fingers. Visible skin is restored afterward.

## Remaining limitations — not gameplay approved

- Fine pale fringes remain along several fingertip boundaries, especially n39, and some dark sleeve/torso boundary uncertainty remains. Do not claim the edge issue completely solved.
- RGB skin classification can omit highlights/shadows; G is connected visible hand skin, not separately labelled fingers. Occluded anatomy is unknown and not filled.
- The observed finger candidate is not contact calibrated. A rigid game card must be checked against every rendered frame; masks alone do not prove contact.
- Sleeve silhouette uses uncertain RawVision boundary pixels; source/scene lighting remains unchanged. No temporal matte smoothing or game-colour matching is claimed.
- These masks cover the slide only, not extraction, turnover, release, return, other seats, or full gameplay.

Suitable for root staging packaging and closer compositing review. Not approval for public gameplay replacement.
