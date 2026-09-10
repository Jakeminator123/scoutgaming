# Astrid anatomical face and source-clock performance

This is an opt-in development candidate, not final photographic acceptance. The playable integration uses `?dealer=astrid&scene=rigged-review&face=anatomical`; the independent control studio uses `/dealer-studio.html?face=anatomical`. The original filmed dealer remains the default.

## Editable geometry and controls

The replacement head uses MakeHuman's CC0 core anatomy, fitted to an Astrid reference. It contains separate eyes, eyelids/lashes, teeth, tongue, scalp and hair fibers. Ten real mesh shape keys control jaw opening, lip closure, pucker, funnel, smile, width, bilateral blinks and inner brows. EyeLeft and EyeRight are separately weighted gaze bones. The full character retains the existing body armature, with 56 deformation bones after adding the two eyes.

The source is an adapted anatomical mesh and generated body, not a manually sculpted photographic portrait. The editable high-detail hair source retains 1,650 curves; the runtime candidate retains 825 converted strands. Every facial shape preserves the same vertex count. Original body vertex coordinates and weights outside the removed obsolete head are checked for exact preservation.

The native MakeHuman head/neck/chest weights are carried through subdivision as mesh attributes and retargeted to Astrid's head, neck and chest. A height-only weight assignment was rejected because it stretched the jaw during turns. The current regression measures actual skinned lower-face positions against the head transform at both outer seats, allowing 2 mm for soft tissue. This is a mechanical regression threshold, not a realism score.

The studio exposes body poses, head framing, individual facial controls, gaze, an optional authored idle gaze/blink sequence and original-video playback. Manual facial input pauses source playback so two controllers cannot fight. Reset clears both morphs and gaze.

Packed editable deliveries are in `assets/astrid-3d/anatomical/`: high-detail facial source, combined rest rig, twelve body actions with manual controls, and the measured goodluck take with packed audio. The corresponding animated GLBs embed seven material images. The original generated baseline animation is excluded from the twelve-action export. `delivery-verification.json` records reopening the packed files and enumerates their controls and actions.

## Measured speech

`capture-dealer-face.py` extracts MediaPipe blendshape measurements from the exact source video frames. `dealer-face.mjs` interpolates those measurements against the media's actual currentTime; it does not run an independent speech timer. Seek, playback-rate changes, pauses, repeats and interruptions therefore use the same source time.

Each file records its source SHA-256, duration, decoded frame count and binding. Indexed recordings also bind the exact audio SHA-256, public URLs, line text and calibrated audio delay. Native embedded-audio videos use zero extra offset. Missing intervals longer than 120 ms and elapsed source endings return to neutral rather than presenting invented measurements.

The collaborating game task owns the complete 17-line manifest and playback adapter. Capture coverage is 1,756 measured frames with zero missing detections. Detection coverage and matching hashes do not establish phoneme-level visual acceptance; inspect each rendered line in the actual game.

## Sources and reproducibility

- Original body: `assets/astrid-3d/astrid-source.blend`, Higgsfield Meshy v7 image-to-3D job `cc1a080e-8d37-4f3c-847d-5f70bf1c3125`.
- Neutral identity reference: Higgsfield Nano Banana 2 job `0e81fd79-cc01-4892-b980-c1a38db32cbd`, saved with its receipt under `content/staging/2026-09-10/astrid-head-v2/`.
- Anatomy, proxies and semantic rig: MakeHuman Community core assets, CC0. Native rig weights are `data/rigs/default_weights.mhw` and hierarchy `default.mhskel` in the staged vendor folder.
- Construction order: build-dealer-face, fit-dealer-face-landmarks, fit-dealer-face, map-dealer-face-texture, texture-dealer-face, groom-dealer-hair, export-dealer-face, optimize-dealer-face, attach-dealer-face. These scripts currently resolve the dated staging directory explicitly.
- Native action delivery follows sample-dealer-rig, bake-dealer-actions and add-dealer-controls. The optional goodluck facial take follows prepare-dealer-facial-keyframes and bake-dealer-facial-performance, preserving its original packed audio.

Blender Python requires bpy, NumPy and the local vendor assets. Measurement requires MediaPipe, OpenCV and its face-landmarker model. No live generation is needed to edit the saved meshes, controls or exported materials.

## Verification and remaining work

The six face regression tests cover source-clock behavior, missing intervals, reset/clamping, mismatched source rejection, actual exported morph/gaze data and lower-face skin stability. Body contact and export tests remain separate. Native renders include rest and both outer-seat poses; rejected jaw/collar attempts remain staged as diagnostic evidence.

A second neck-fitting pass initially used raw Mesh coordinates after the preceding pass had moved shape-key Basis. Correcting each pass to read the current Basis removed a duplicated neck offset. Matching the full retained neck surface then removed the prominent collar ring. The independent evaluated-surface check rejects the prior model (46.11 mm maximum gap) and passes the corrected model (2.12 mm maximum, 0.92 mm mean). Before/after renders and both outer-seat poses are saved in `assets/astrid-3d/anatomical/review/`. This check samples actual evaluated geometry, not helper bones.

The studio renders paused states only when controls, camera, viewport or media state change. A completed action offers Spela igen, which restarts the current movement; scrubbing pauses at the selected pose. Both replay and manual release positioning were exercised in the browser after this change.

Final acceptance still requires natural skin/neck continuity, less repetitive hair appearance, eye and facial lighting review, all-line rendered lip review, full-round interaction and physical-device performance. Do not mark CAC-2/CAC-4 or the user's complete realism goal done from these technical checks.
