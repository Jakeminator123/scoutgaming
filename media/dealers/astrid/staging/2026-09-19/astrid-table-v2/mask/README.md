# Astrid mask candidate for table-v2 PlateCam

Only the approved elevated Seedance source `de1f90a9` is used. Source path and full SHA are pinned in `manifest.json`. No older frontal source, new generation, colour filter, body stretch, perspective warp or timing change is involved.

`build.py` freshly decodes all97 source frames, verifies each image against the cached native RGB before reusing its local Apple Vision person matte, and re-keys green/magenta set pieces with the existing vetted elevated key. The resulting **alpha differs by0 pixels** from the prior verified elevated matte. This is an explicit reproducible rebuild and new table-profile package, not a claim that masking changed the photographed viewing angle. Dense source/cutout inspection did not support removing any additional photographed fingers, hair or clothing.

Deliverables:

- `actor-packed.mp4`: **960×1520**, original cropped RGB above independent straight grayscale alpha, 97 frames at24fps, no audio or B frames.
- `rest-0096.png`: transparent **1920×1080** native rest frame96.
- `rest-0096-crop.png`: corresponding **960×760** actor crop.
- `manifest.json`: source/frame hashes, transforms, exact key provenance and settings.
- `verification.json`: decoded media contract, native rest RGB equality and all-frame exclusion/opacity checks.
- `qa/all-native-*.jpg`: every native frame; `qa/hands-source-alpha.jpg`: detailed pickup/turn/release/return source comparison; `qa/decoded-grounds.jpg`: actual encoded samples on dark/light/checker.

All geometry uses the **native1920×1080 origin**, with no old+20px Y offset. Crop `[560,0,960,760]` maps native `(x,y)` to crop `(x−560,y)` and back to `(x+560,y)`. The complete native actor fits this crop, union bounds `[656,22,1306,678]`. Root owns the final Blender table registration and depth ordering.

The source and `assets/astrid-3d/greenscreen/blackjack-camera-reference.jpg` visibly share the same table perspective and normalized layout; reference/rest96 comparison is `qa/reference-source-layout.jpg`. A sparse feature fit is saved as exploratory evidence only and is insufficient to infer a physical camera angle. The source camera must remain unchanged; Blender PlateCam/table placement supplies the environment match.

Observed edge and motion limits: hair/shoulder contours and both hands/fingers are retained across the full sequence. Green background, table, shoe and marker card are absent. Source motion blur and slight green spill remain at some contact-edge pixels; no whitening/despill was applied. The lower-left triangle in native0–4 is photographed blazer material behind the reaching arm and remains intact. The flat source torso edge near y542 must be occluded by the table rear rail, while forearms stay above felt. A replacement tracked card belongs behind retained fingers. Any photographed hand portion originally occluded by the source shoe cannot be reconstructed by masking.

Native0 already reaches toward the shoe; native96 is the requested empty-hand rest. They are different poses and do not form a seamless idle loop. No full-game visual acceptance is claimed.

Rebuild and verify:

```sh
/tmp/astrid-a9mask-env/bin/python build.py
/tmp/astrid-a9mask-env/bin/python verify.py
```

All work is isolated here. Public assets, shared JavaScript and gameplay were not edited by this mask task.
