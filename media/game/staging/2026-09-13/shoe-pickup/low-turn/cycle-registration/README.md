# Uniform cycle registration

`register.py` fits background SIFT correspondences with robust similarity inliers, then least-squares scale + XY translation only. Mask excludes actor and shoe: x<730 or x>1420 or y>820. `registration.json` includes exact matrices, source SHA256s, match counts and residuals. `clip-transforms.json` averages the nearly identical endpoint camera fits into one constant transform per clip; apply identically to RGB, matte and card coordinates. No local warp or crossfade.

Static background fits are strong: source54 median0.128px; slide0/54 0.532/0.513px; return0/36 0.692/0.695px. p95 remains <1.8px. Thus scale/translation explains the camera difference well. Actor pose is deliberately excluded from fitting.

## Pose verdict

Pickup source54 → slide0 is NOT seamless. `pickup-slide-pose.jpg` shows source fingertips resting down beside the face-up card, while slide0 has curled/lifted non-index fingers and a higher wrist. Index tip is roughly 15px higher at slide0 in native coordinates. Uniform camera adjustment cannot remove this pose difference without displacing the correctly aligned face/shoe/background. Reject a claim of fixed handoff from these matrices alone.

Slide54 → return0 is much closer at upper body / shoe-side hand. Face features retain ~1–2px differences. Left landing hand falls mostly below the optical-flow ROI, so its three matches are not sufficient evidence of contact continuity.

Return36 → source0 is close but not identical: sparse forward/backward-consistent appearance tracks give eyes median2.084px (p952.445), face1.632px, viewer-left hand1.510px and viewer-right hand1.564px. `return-ready-pose.jpg` visually confirms similar hand positions and a slight eyelid/expression difference. No perfect-loop claim. Stationary dealt-card persistence is external to this actor registration.

`pose-residual.py` is a diagnostic, not landmark ground truth. It filters inconsistent tracks, so a low median cannot certify unmatched moving fingers; the pickup→slide manual mismatch takes precedence. Registered JPEGs and feature-marker evidence are retained for inspection. No public changes or gameplay acceptance.
