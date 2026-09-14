# Bounded prefix room-light cleanup

Frozen candidate for actual-game review. All 40 original-source head/shoulder pairs and all 40 before/after mask composites were visually inspected. Explicit source-camera polygons remove the long horizontal lamp behind the left hair, left shoulder plate, and outer right shoulder lamp. The 45 right-source masks are byte-identical to the input. No source RGB, body geometry, card clock, or gameplay state was changed.

143,173 pixel positions changed across prefix masks; R and G are reduced together, alpha never increases. Receipt preserves every original namespace, sourceNative, actualOriginalSourceNative, combinedNative, outputFrame and pacePlanSHA256. Per-frame polygons and source/output hashes are recorded.

The narrow connected bright stubs immediately beside the ear/jaw and thin suit-edge mixture remain intentionally uncertain. This is a bounded improvement, not full edge cleanup or smoothness acceptance. Input prefix masks originate at 1280x720 and were already uniformly upsampled before this change; no new native hair detail is claimed.

Proof: ../head-clean-review/clean-critical-00.jpg and clean-critical-30.jpg; dense clean-all-00 through clean-all-35 (five frames per sheet), compared against before-00 through before-35 original-source evidence.
