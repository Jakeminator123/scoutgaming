# Astrid editable anatomical candidate

Open `astrid-animated.blend` for the full body, editable facial shapes, gaze bones and twelve body actions. Select an action in Blender's Action Editor. Wrist and foot controls have an `IK` property: 0 plays the authored action; 1 enables manual IK. Body, head, elbow and knee controls are in DEALER_CONTROLS. Fingers remain individually editable pose bones. Facial shape keys are on Astrid_Face and the corresponding oral/lash meshes; the eyes use EyeLeft and EyeRight.

`astrid-goodluck.blend` opens the measured goodluck facial performance with its original audio packed into the sequencer. The twelve body actions remain in the file. `astrid-goodluck.glb` exports the facial take; `astrid-animated.glb` exports the body actions. Materials and textures are embedded. The GLB format does not carry Blender's interactive IK controls; use the native project to edit those.

The speech GLB begins at 0 seconds, corresponding to Blender frame 1 and the source media's first frame. `speech-clock-verification.json` checks all five exported facial tracks against the measured source-clock weights. This verifies timing and transfer, not the model-specific amplitude or visual quality of lip movements.

`astrid-rigged.blend` preserves the combined rest rig. `astrid-face-source.blend` preserves the higher-detail facial source and editable hair curves. The original generated body source remains one directory above at `../astrid-source.blend`. These are generated/adapted sources, not a manually sculpted photographic portrait.

The MakeHuman anatomy and core asset license is included. `delivery-verification.json` records reopening each packed project, its images, actions, controls and SHA-256. Other verification JSONs record specific numerical checks and their limitations.

This remains a visual development candidate. The neck surface transition, hair appearance, full rendered phoneme review and physical-device performance are not finally accepted. See `docs/ASTRID-ANATOMICAL-FACE-STUDY.md` in the project root for source provenance and the live-game integration contract.
