# Reusable actor/finger matte pipeline — read-only investigation

Existing reusable primitives are local Apple Vision + Swift, FFmpeg, and Python/Pillow/NumPy/OpenCV. No paid tool or new dependency is required for first segmentation. This investigation did not execute segmentation or alter public files.

## Native segmentation and hand observations

From repository root, a future staging run can use these exact commands (new paths only):

```sh
mkdir -p content/staging/2026-09-13/shoe-pickup/low-turn/matte-source/frames
mkdir -p content/staging/2026-09-13/shoe-pickup/low-turn/matte-slide/frames
ffmpeg -i content/staging/2026-09-13/shoe-pickup/low-turn/source.mp4 -fps_mode passthrough content/staging/2026-09-13/shoe-pickup/low-turn/matte-source/frames/%04d.png
ffmpeg -i content/staging/2026-09-13/shoe-pickup/low-turn/slide.mp4 -fps_mode passthrough content/staging/2026-09-13/shoe-pickup/low-turn/matte-slide/frames/%04d.png
swift pipeline/person-mask.swift content/staging/2026-09-13/shoe-pickup/low-turn/matte-source/frames content/staging/2026-09-13/shoe-pickup/low-turn/matte-source/person
swift pipeline/person-mask.swift content/staging/2026-09-13/shoe-pickup/low-turn/matte-slide/frames content/staging/2026-09-13/shoe-pickup/low-turn/matte-slide/person
swift pipeline/track-dealer-hands.swift content/staging/2026-09-13/shoe-pickup/low-turn/matte-source/frames content/staging/2026-09-13/shoe-pickup/low-turn/matte-source/hands.json
swift pipeline/track-dealer-hands.swift content/staging/2026-09-13/shoe-pickup/low-turn/matte-slide/frames content/staging/2026-09-13/shoe-pickup/low-turn/matte-slide/hands.json
```

Prerequisites: macOS Vision/CoreImage frameworks and installed Swift compiler/runtime; FFmpeg; enough disk for native RGB PNG frames. Probe source frame counts/dimensions first, retain original media SHA, and assert every RGB filename has a corresponding mask. person-mask.swift catches Vision errors and can skip frames silently; its final count alone is insufficient. Hand observations have confidence>0.25 and normalized top-left y; missing fingers stay missing. Do not substitute these observations for precise contact corners.

## Paper removal / finger occlusion

pipeline/prepare-contact-mattes.swift accepts a staging root containing frames/, person/, optional capture-settings.json. It creates contact-masks/ and marker-tracking.json. Config keys: paperRegion normalized[x0,y0,x1,y1], subtractReference, trackingStart, excludeRegions. It removes bright marker pixels from actor R while retaining heuristic skin as G foreground fingers; records null corners when tracking fails.

**Do not run it unchanged as final low-turn processing.** Default ROI/trackingStart38 and hardcoded shoe exclusion(x>.635,y<.626) belong to an older source. Its brightness threshold misses red card backs/edge-on phases and can erase pale skin or retain printed flesh-colour pixels. Baseline subtraction assumes suitable stationary first frame; source hand motion and camera drift violate that simplification. Set measured source-specific ROI/exclusions, keep masks separate, and inspect every extraction/roll/contact frame. During edge-on roll, minimum-area rectangles are inherently unstable and missing corners must remain unapproved.

Original reference-rhythm/integration/build.py demonstrates R actor/G finger packing and skin-aware white/red paper removal, but is **not a reusable runner**: hardcoded832×624 thresholds, y315/480 boundaries, shoe exclusionx495/y350, source indices3–48, point transform1132×848+(74,−112), and fixed hand-proxy corners. It directly writes web/public and recalibrates manifests. Reuse concepts only in a new staging script; never run it for these sources. The original implementation's damaged paper remnants are evidence that its thresholds are insufficient.

## Resampling and packing

reference-rhythm/smooth60/build.py applies the **same bidirectional DIS optical-flow maps to RGB and all matte channels**, then packs RGB over R actor/G fingers at1920×2160, x264 CRF14, no B frames,60fps. Existing Python runtime is /Users/solvifyab/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3; OpenCV import path previously used is /tmp/astrid-optical-flow. Verify imports before use, do not install silently. This script also writes public files; adapt into staging with actual native dimensions and new registration, never invoke unchanged.

ready-at-table/pack-registered.py provides source-bound join metadata and exact endpoint insertion, but its930×675 crop atx570 and **black-background support test** are valid only for its registered cutouts. They do not segment a full casino background. Its masks are actor R only, so it cannot supply card-over-finger occlusion. It also writes public output directly. ready-at-table/build-ready.py has the same cutout assumptions. edge-cleanup/clean.py removes upper protrusions only; it is not full person extraction and fixed y420–460 thresholds cannot be copied to a new camera.

## Required calibration before promotion

- Segment actual actor against room/table/shoe, keeping dark sleeves and pale fingertips intact through all97 source frames and the actual slide count. Review masks over checkerboard and actual game background. The original room lights leaked through person masks; clean boundary review remains mandatory.
- Remove source paper in R only where actually paper, preserve foreground finger G. Inspect front/back/edge roll and fingertip contact independently; source prints must not remain behind the server card or disappear with fingers.
- Annotate actual card quadrilateral, orientation, pickup/outlet emergence, grip transfer, face-up completion, release, land and empty-hand return. Vision fingertip averages and heuristic rectangles must remain labelled estimates until reviewed.
- Register the native source to actual captured game camera using the runtime's136px desktop control band. Current diagnostic residual is approximately3px left/9px high at the mouth from manually read anchors; it is not exact contact acceptance. Uniform alignment may need a small correction; no body warp.
- Apply shared interpolation maps to RGB/R/G and recalibrate event frames after intentional trimming/retiming.60fps is interpolated24fps, not new native detail. Bind immutable source/media/calibration SHAs.
- New ready anchor has hands adjacent shoe; old empty-return endpoint does not match. Require correct persistent dealt-card state and exact paired-speech endpoint joins. Do not force a loop by fading or freezing an actor over speech.
- Only after staging composite/native-motion acceptance, pack immutable review assets and run contact validation, deep dealer audit and repository pre-commit checks. Full rendered round and exact physical contact remain separate acceptance gates. No full background promotion or seven-seat claim from one central slide.
