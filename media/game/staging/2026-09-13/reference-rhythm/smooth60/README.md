# Astrid 60 fps review

The user's request was smoother, higher-quality dealing with less rushed motion. `motion=smooth60` uses four new review takes; `motion=rhythm` preserves the previous version.

RGB is reconstructed from the preserved 1664×1248 source, avoiding the old 832×624 intermediate. Its original camera registration is scaled uniformly onto a 1920×1080 canvas. Existing cleaned masks are upsampled; this does not add segmentation detail. H264 CRF 14, no B frames, packed RGB and masks at 1920×2160, 60 fps. Source footage is 24 fps, not native 60 fps or native Full HD. Bidirectional DIS optical flow estimates intermediate images and applies the same maps to RGB and masks. Motion runs at 80% source speed. No body retargeting, grading, or server card changes.

Rebuild: extract first 48 native PNGs from ../source.mp4 into native/; run build.py with NumPy, Pillow, OpenCV (tested 5.0.0) and ffmpeg available. It also needs the preserved integration/packed-frames masks. Native extraction and intermediate images are not delivery assets. Receipt records source/output frame counts. Tracking binds original calibration/media hashes; all card footprints remain explicitly estimated and unapproved.

Verification: focused tests probe decoded dimensions, frame count, 60 fps, distinct decoded frames, media/calibration hashes, slowed event times, one-time cues, and disabled body retargeting. Deep dealer media audit and complete pre-commit suite pass. An isolated 1280×720 game on astridsmoothqa.localhost completed seven occupied seats, a hit to 21, two additional dealer draws, and settlement: stake 35, returned 22.50, final balance 987.50, then zero stake. No browser warning/error. Browser screenshots sampled moving and resting poses without body elongation. Individual dealer draw transitions were logged; not every interpolated frame was visually inspected.

Remaining visual limits: source motion blur cannot be recovered by interpolation; fast occlusions can still soften fingers. Existing feeding-hand paper artifacts, final pose joins and distinct physical reaches to all seven spots are not resolved by this quality pass. Cards reach their server-owned fans by a slide from the filmed hand. This is a local review, not full visual approval or production deployment.

Shared-player regression: Astrid, Vera, Amira and Mei each completed two consecutive matched greetings in the isolated rehearsal, with matching start/end logs. This is playback continuity coverage, not fresh lip-sync approval.
