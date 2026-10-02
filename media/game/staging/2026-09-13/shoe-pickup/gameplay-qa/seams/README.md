# Native source seam inspection

Inspected held-slide native final frame72 and empty-return native frames0,18,36,54,72 (24fps). Both videos are1924×1076; transfer-anchor.png and end.png are1344×752. These differ negligibly in aspect ratio; uniform fit with a fraction-pixel crop is sufficient, without stretching the body.

Held-slide frame72 → empty-return frame0 is an excellent positional seam: whole-frame RGB MAE0.990/255; mean RGB delta[-0.075,-0.131,-0.148]. Outer-background ORB/RANSAC similarity has scale1.0000006, translation[0.021,-0.029]px, rotation approximately0.0014degrees, median inlier residual0.023px. The pose visibly matches. No body warp, grading, or dissolve is justified here; direct cut candidate, pending motion-boundary playback review.

Anchor background registration is consistent with uniform scaling: mapping1924×1076 return-first toward1344×752 yields scale~0.69956, translation roughly[0,1]px, subpixel-to0.91px median inlier residual. End and transfer intentionally contain different hand/head/card poses; background match does not establish pose match between those two anchors. measure_seams.py additionally compares held-first with resized transfer and return-last with resized end; metrics.json stores values.

The card is NOT perfectly stationary in empty-return. White-card bounding boxes at native frames0/18/36/54/72 are [905,775,96,86], [905,777,97,89], [905,779,97,89], [905,781,97,88], [905,783,97,88]. Its lower edge moves861→871px (+10px). Threshold centroid moves~6.53px downward but this is affected by hand occlusion in frame0 and face artwork. Stationary background fit at final frame predicts only about3px downward at the card location, leaving roughly5–7px local card drift. A single uniform frame registration cannot fix that local relative motion.

Visible card rank/artwork also morphs: held-last/return-first read as K while the final return/end image reads Q. This is a separate source-paper continuity defect, not colour grading. Do not claim immutable card identity or use these source faces as server card values. Any preview may assess motion/seam only until card replacement and finger occlusion are verified.

No public edits, body warping, generation, or gameplay acceptance. Native PNG evidence is retained; Python measurements use OpenCV from /tmp/astrid-optical-flow and bundled Python. White-region boxes are threshold measurements, not manual four-corner calibration.
