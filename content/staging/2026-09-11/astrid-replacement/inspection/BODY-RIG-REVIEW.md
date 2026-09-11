# Corrected body rig review

The corrected-orientation provider rig has 24 anatomically plausible body joints. The original canonical mesh, UVs and three embedded PBR JPEGs are preserved in `rig-corrected-transfer/original-pbr-body-rig.blend` and `.glb`. The rest export has 102706 vertices, 190224 triangles, 24 joints and no animations. It does not yet contain fingers or facial controls.

Weight transfer leaves canonical source geometry unchanged. Provider surface sampling differs by at most 0.999721 mm; the documented 1.01 mm tolerance applies to weight correspondence, not movement of source vertices. Median residual is 0.000396 mm, p99 0.7149 mm. Rest skin residual is at most 0.000370 mm. See transfer-verification.json and glb-intake.json for hashes and checks.

Actual rendered forward elbow pose (LeftForeArm local X −55 degrees) holds the sleeve/elbow silhouette and clears the hip in the inspected front view. The wrist and five unbent fingers remain intact. Slight cuff irregularity belongs to the source and remains visible. Evidence: rig-forward-bend-review/upper-body.png and image-right-hand.png. This single view is not full collision or motion acceptance.

Rejected pose: local Z +55 degrees puts the hand into the hip. Its arm-bend-study.blend is retained as a rejected direction, not a usable action. Far-region numerical stability alone did not detect that physical collision.

The original source and rest rig are preserved separately from pose studies. The independent hand candidate is owned by the game integration task. Facial movement, finger flexion review, natural card handling and a complete rendered round remain open; this checkpoint does not approve realism or change public/default assets.
