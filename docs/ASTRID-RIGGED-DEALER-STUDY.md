# Astrid editable dealer study — 10 September 2026

This is a working 3D candidate, not a finished dealer or approved replacement for the video route. The opt-in game integration is maintained separately in rigged-table-scene.mjs. No other dealer media was changed.

## Delivered files

- `assets/astrid-3d/astrid-source.blend`: original generated imported model, preserved before correction. This is not a manually sculpted high-resolution master.
- `assets/astrid-3d/astrid-rigged.blend`: prepared rest model, skin weights and 54-bone rig.
- `assets/astrid-3d/astrid-animated.blend`: twelve editable actions plus optional hand/foot IK controls, elbow/knee poles, body root and head rotation. Finger FK chains contain three bones per digit.
- `web/public/dealers/astrid/rig/astrid-animated.glb`: embedded base texture/material, skin and twelve named action studies; the imported base clip also remains. Custom Blender controls are in the native project, not GLB.
- `web/public/dealers/astrid/rig/astrid-rigged.glb`: runtime rest model for procedural poseDealer.
- `dealer-studio.html`: isolated visual review with seven seat selection, timeline, speed and camera controls. Its demonstration cards are not game state.

Actions are Deal_Seat_01_Contact_Study through Deal_Seat_07_Contact_Study and Deal_Own_Card_Contact_Study, 51 frames each at 30fps. Reveal_Hole_Card_Study (55 frames), Collect_Card_Study (61 frames), Greeting_Wave_Study and Accept_Bets_Nod_Study are also authored. Own-card target is [0,.91055,.23] metres, in the same table coordinate system. Hand transfer, release and empty return are explicit phases. poseDealer returns cardYaw about Y, with the card long axis along local +Z; this freezes at release.

## Editing and rebuilding

Open the animated Blender project. CTRL_BODY moves the global root. Wrist and foot controls have custom IK properties: zero retains baked FK actions; one enables manual IK. Elbow/knee controls determine bending. CTRL_HEAD_ROTATION uses the same optional blend. Finger bones use Left/Right + Thumb/Index/Middle/Ring/Pinky + 1..3. There is no facial or eye deformation rig.

The pipeline is prepare-dealer-rig.py, sample-dealer-rig.mjs, bake-dealer-actions.py, verify-dealer-export.mjs, then add-dealer-controls.py. The latter must run after baking, because baking rebuilds the animated project from the rest project. Blender Python 4.5.3 was used. Runtime and authored actions share the same skeleton, with measured per-bone rest-axis conversion.

The source is a Meshy7 output (job cc1a080e-8d37-4f3c-847d-5f70bf1c3125), using a Higgsfield MCP identity reference (job 431f1aa2-bfdc-4478-8308-e6f97ccb9fc7). Original geometry has 91,278 vertices and 24 bones. Preparation adds 30 finger bones and weights, removes the auxiliary sphere, corrects oversized display bone lengths, and removes incorrect metallic/emissive skin settings. The source texture is only 2048px and does not provide independent PBR maps. Generative remeshing is not an inspected production retopology pass.

## Verification and remaining acceptance

- Required all-four-dealer sync probe passed; existing regression baseline unchanged. Existing missing speech takes remain documented by that audit.
- Repository pre-commit suite passed 49 tests; five dealer-motion tests passed, including two-hand continuity at boundaries, release permanence and preserved segment lengths.
- Twelve-action sweep: maximum active wrist and ankle reach residuals round to 0mm. The estimated index contact marker stays 3mm above the mathematical card point. This does NOT measure the actual skinned fingertip surface, occlusion or physical grip.
- GLB reimported animation samples versus runtime joint matrices: worst joint displacement 0.648mm, worst angular difference 0.132 degrees. See export-verification.json.
- Four manual IK target perturbation tests: endpoint residual below 0.002mm. See control-verification.json.
- Browser inspection of both outer-seat delivery poses confirmed distinct reach and a planted card; static face and coarse hand texture remain visibly unfinished. This inspection does not approve all poses, skin intersections, motion quality or physical-device performance.

Still required: facial topology/weights, eyes/blinks and exact audio-driven mouth performance; visually verified skin-to-card grip and handoff occlusion; professional motion cleanup; professional cleanup and complete round validation of the reveal, collection and greeting studies; chip-handling animation; split/multiple-card collision checks; all-four-dealer repeated rendered rehearsal and physical-device QA for any release. Astrid is the only 3D candidate. CAC-2 and CAC-4 remain In Dev. No production/default promotion.


## Follow-up: observed hand collision and additional actions

A close browser inspection at transfer progress .39 found overlapping hands that numerical reach checks missed. The correction separates the left/right contact points by 50mm across the card and blends opposing palm angles. A second close inspection showed separated hands. sample.contacts exposes the two mathematical targets; the small fingerError is measured against those, not the card centre. Actual skinned contact and full-sequence collision approval remain open.

poseCardAction(rig, progress, options) supports reveal and single-card collection. It returns the same diagnostics plus sample.cardPitch, cardYaw, visible and contacts. Reveal keeps the card visible, lifts it, rotates from face-down to face-up and returns it to its original landing. The finger target follows a rotating edge. Collection chooses the near hand and only transfers between hands when moving from positive X to the negative-X discard area. Numeric sweeps of collection from all seven seat targets show no reach residual. This does not test arbitrary large split offsets or actual card pile collisions. The one baked collection action starts at the central seat; runtime accepts the actual source.

poseDealerGesture supports greeting (raised open palm with a small wave) and accept-bets (head nod). Neither animates the face or speech. The studio exposes all studies. Close browser stills of the reveal midpoint, greeting peak and discard approach were reviewed for obvious placement; these are not full motion/device approvals.

Runtime durations: dealing and gestures 1.65s, reveal 1.8s, collection 2.0s. At 30fps the first duration rounds to 50 frame intervals. motion-samples.json supplies action names, local frame numbers, positions and card orientation for assembling matching props in the complete Blender scene.

Export landing heights match the real adapter: first-card centre .91055m over .910m felt, discard .920m. The earlier .916m study landing was corrected after integration QA found a visible gap.


## Native control-root correction

Combined-scene rendering exposed an approximately 0.996m downward offset introduced when parenting the armature to CTRL_BODY after resetting that control's location without evaluating its world matrix. The GLB, exported before control creation, was unaffected. The control pipeline now evaluates the reset before parenting and explicitly preserves the parent inverse/world matrix. Native verification runs after all controls and compares every joint at four frames in each of the twelve actions against the sampled runtime world positions; maximum residual is 0.0013mm. See native-verification.json. Earlier native apron checks made against the displaced model are withdrawn and must be rerun on the corrected project.
