# Independent close-up source assessment — 12 September 2026

This is a materially better face source than the rejected full-body reconstruction, but is not accepted as a realistic animated dealer. Compared unchanged provider GLB against reference.png and canonical seated Astrid. The closer lip shape, recognizable brow/eye spacing and side-part hairstyle improve likeness. Dark heavy eyelid rims, sharper brow/cheek relief and a less natural skin surface still diverge from the photographic references. A neutral render cannot establish final canonical lighting/camera equivalence.

## Direct evidence

Original SHA256: 1757bd0469cc338cfa7f6c4e3897d64d72eeed79393c9dd63591a94d61184ba1. 249716 vertices, 476422 triangles, one connected surface after analysis-only welding, no skeleton or morphs. Three embedded 4096×4096 JPEG maps remain unchanged; hashes are in embedded-image-hashes.json. Source bytes were checked before/after rendering. No original geometry/material files were modified.

The mesh object contains a yaw transform. Its source-relative +X front maps to camera azimuth 101.518 degrees in Blender, not 90 degrees. Use aligned-front.png for the frontal comparison. front.png is the earlier 90-degree diagnostic, and three-quarter.png uses 135 degrees. Lighting is fixed and moderate: key35/fill17/rim25 times (source height/1.73)^2, world0.4, AgX medium-high contrast, exposure0. This avoids attributing a camera mismatch to facial geometry.

clay-front.png uses a temporary neutral material override. Cheek crease marks, irregular eyelid rims and coarse hair ridges remain visible without the color/normal maps: these defects have a geometric component. Material adjustment alone cannot remove them. The original PBR exaggerates dark eyelid edges and skin contrast, so both geometry and surface response matter. Hair has finer detail than the prior full-body source but still forms a grooved solid mass; reference flyaways and strand silhouette are not reproduced.

## Rigging suitability

Useful as a dense, preserved likeness/sculpt source for further targeted work. It is not ready for facial performance: eyes, lids, lips, hair and clothing are not independently authored components; eye surfaces contain baked relief instead of a clean independently rotatable eyeball setup. Mouth interior suitability is unverified. A working blink/gaze/speech rig requires appropriate lid/lip edge flow, eye geometry, oral structure, and expression deformation checks. Automatic remeshing or attaching a head bone does not provide these.

This is a cropped bust, not a complete body. Integrating it requires a measured neck/shoulder/clothing transition and an appropriate physical scale; treating its approximately1-unit bust height as full human stature would be wrong. Do not graft it onto the rejected body and call that likeness or motion acceptance. Root owns the next source decision and game comparison. No rigging, paid generation, public changes or Git-index edits were performed by this assessment.
