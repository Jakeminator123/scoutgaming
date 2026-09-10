# Astrid editable dealer study — 10 September 2026

This is a working 3D candidate, not a finished dealer or approved replacement for the video route. The opt-in game integration is maintained separately in rigged-table-scene.mjs. No other dealer media was changed.

## Delivered files

- `assets/astrid-3d/astrid-source.blend`: original generated imported model, preserved before correction. This is not a manually sculpted high-resolution master.
- `assets/astrid-3d/astrid-rigged.blend`: prepared rest model, skin weights and 54-bone rig.
- `assets/astrid-3d/astrid-animated.blend`: eight editable actions plus optional hand/foot IK controls, elbow/knee poles, body root and head rotation. Finger FK chains contain three bones per digit.
- `web/public/dealers/astrid/rig/astrid-animated.glb`: embedded base texture/material, skin and eight named action studies; the imported base clip also remains. Custom Blender controls are in the native project, not GLB.
- `web/public/dealers/astrid/rig/astrid-rigged.glb`: runtime rest model for procedural poseDealer.
- `dealer-studio.html`: isolated visual review with seven seat selection, timeline, speed and camera controls. Its demonstration cards are not game state.

Actions are Deal_Seat_01_Contact_Study through Deal_Seat_07_Contact_Study and Deal_Own_Card_Contact_Study, 51 frames each at 30fps. Own-card target is [0,.916,.23] metres, in the same table coordinate system. Hand transfer, release and empty return are explicit phases. poseDealer returns cardYaw about Y, with the card long axis along local +Z; this freezes at release.

## Editing and rebuilding

Open the animated Blender project. CTRL_BODY moves the global root. Wrist and foot controls have custom IK properties: zero retains baked FK actions; one enables manual IK. Elbow/knee controls determine bending. CTRL_HEAD_ROTATION uses the same optional blend. Finger bones use Left/Right + Thumb/Index/Middle/Ring/Pinky + 1..3. There is no facial or eye deformation rig.

The pipeline is prepare-dealer-rig.py, sample-dealer-rig.mjs, bake-dealer-actions.py, verify-dealer-export.mjs, then add-dealer-controls.py. The latter must run after baking, because baking rebuilds the animated project from the rest project. Blender Python 4.5.3 was used. Runtime and authored actions share the same skeleton, with measured per-bone rest-axis conversion.

The source is a Meshy7 output (job cc1a080e-8d37-4f3c-847d-5f70bf1c3125), using a Higgsfield MCP identity reference (job 431f1aa2-bfdc-4478-8308-e6f97ccb9fc7). Original geometry has 91,278 vertices and 24 bones. Preparation adds 30 finger bones and weights, removes the auxiliary sphere, corrects oversized display bone lengths, and removes incorrect metallic/emissive skin settings. The source texture is only 2048px and does not provide independent PBR maps. Generative remeshing is not an inspected production retopology pass.

## Verification and remaining acceptance

- Required all-four-dealer sync probe passed; existing regression baseline unchanged. Existing missing speech takes remain documented by that audit.
- Repository pre-commit suite passed 49 tests; three dealer-motion tests passed, including two-hand continuity at boundaries, release permanence and preserved segment lengths.
- Eight-action sweep: maximum active wrist and ankle reach residuals round to 0mm. The estimated index contact marker stays 3mm above the mathematical card point. This does NOT measure the actual skinned fingertip surface, occlusion or physical grip.
- GLB reimported animation samples versus runtime joint matrices: worst joint displacement 0.648mm, worst angular difference 0.132 degrees. See export-verification.json.
- Four manual IK target perturbation tests: endpoint residual below 0.002mm. See control-verification.json.
- Browser inspection of both outer-seat delivery poses confirmed distinct reach and a planted card; static face and coarse hand texture remain visibly unfinished. This inspection does not approve all poses, skin intersections, motion quality or physical-device performance.

Still required: facial topology/weights, eyes/blinks and exact audio-driven mouth performance; visually verified skin-to-card grip and handoff occlusion; professional motion cleanup; actual reveal, collection, chip and greeting animations; split/multiple-card collision checks; all-four-dealer repeated rendered rehearsal and physical-device QA for any release. Astrid is the only 3D candidate. CAC-2 and CAC-4 remain In Dev. No production/default promotion.
