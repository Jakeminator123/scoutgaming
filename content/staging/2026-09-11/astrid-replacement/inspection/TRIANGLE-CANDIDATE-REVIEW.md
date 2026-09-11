# Tripo triangle candidate — actual source review

Job `81c28894-4323-44b3-9bda-3a0a32100c5a` completed on 11 September 2026. The earlier quad-output attempt failed; its cause is not established. This result does not prove the failure was caused by quad export.

Original source: `triangle-source/provider-original.glb`, 7,137,728 bytes, SHA-256 `432fed3af74c1f829d8cf99031fc90b07aadec3ea7a7ee13411c2191eee456af`. The supplied GLB is preserved without geometry/material changes. Its provider URL is recorded in `triangle-source/provenance.json`.

The GLB contains one mesh with 102,706 vertices and 190,224 triangles. It has **no skeleton, skin weights, morph targets or animations**. Its color, metallic/roughness and normal images are embedded 4096×4096 JPEGs. `triangle-source/glb-intake.json` records structural details. `triangle-front-review/candidate-packed.blend` is the separate editable native source with all three original maps packed; its reopen comparison passed (`inspection.json`). Import is not a claim of byte-identical cross-format conversion; the original GLB remains authoritative.

The model faces Blender +X. Front-camera review therefore uses `--front-angle 90`. The initial `triangle-review/upper-body.png` is a profile, not a front view. Camera hand-region selection was corrected to use camera-right projection instead of assuming world-X arm span. Original vertex positions were not rotated or changed.

## Visual decision

**Accept for one body-rigging and motion trial; not accepted as the finished realistic dealer.**

The actual front and hand renders under `triangle-front-review/` were inspected. The head/neck/jacket are a more coherent assembly than the previous mixed-source character. Both hands have visible volume, five distinct digits and open spaces between the fingers, improving substantially on the old flat-looking hand mesh. The suit lapels and blouse have plausible large-scale form.

Still visible: fixed slightly upward-looking eyes, limited facial detail, sculpted hair grooves rather than convincing strands, and small irregular cuff edges. The static render proves neither facial articulation nor finger bending/card grip. No eye, mouth or finger controls currently exist. No actual-game lighting, seated pose, clipping/deformation test or continuous pickup→delivery→release→return has passed on this new asset.

Next: retain the original, obtain a separate body rig, inspect its actual bones/weights/material preservation, then author and verify the full card action on this geometry. Do not feed the new mesh through old hardcoded material/finger corrections. Facial articulation must preserve the new coherent head rather than silently reinstalling the previously rejected head.
