# First replacement reference review — 11 September 2026

Reviewed the completed Nano Banana reference batch through Higgsfield MCP and the actual rendered images:

- Right-facing profile: `516ea1c1-e2c6-4172-9978-8c5b86115086` (local original also inspected).
- Rear: `85627833-35d5-446b-8595-fa539a0b1a71` (local original also inspected).
- Left-facing profile: `b1ff4104-2b02-41d2-8b09-9b9ec569404a` (browser image inspected).
- Compared against existing `assets/astrid-3d/reference-front.png`.

The black suit, compact blonde bun and neutral studio surfaces form a useful appearance reference. All visible hands have five digits. The rear original shows nails and knuckles: it depicts the backs of the hands. An initial low-resolution preview impression that it showed palms was corrected after viewing the original and must not trigger a retry.

The pose is not sufficiently consistent for treating all four images as strict projections of one unchanged A-pose. Both profiles show a broad hand back facing the side camera, rather than the narrower projection expected from the original front-facing palm orientation. Wrists and fingertips sit visibly lower relative to the body in the profiles. This is consistent with lowered arms and changed forearm rotation; the hidden depth cannot be measured from these images alone.

Approximate manual vertical landmarks, normalized from crown 0 to sole 1:

| View | Shoulder | Cuff | Fingertips |
| --- | --- | --- | --- |
| Original front | 0.16 | 0.44 | 0.52 |
| New rear | 0.16 | 0.46 | 0.55 |
| New right-facing profile | 0.17 | 0.48 | 0.57 |

These rounded screen-based observations are not photogrammetric measurements. They identify a material pose discrepancy, not exact joint coordinates or a measured 3D reconstruction error.

Recommendation sent to the generation task: correct the poses before strict multiview conditioning, or use a controlled front-only candidate with the new images as appearance reference. Do not automatically spend on another whole batch. Preserve actual camera directions when mapping the provider's view-order convention. No 3D model or natural performance is approved by this image review.
