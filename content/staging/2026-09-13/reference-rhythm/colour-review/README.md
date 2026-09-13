# Rhythmic-source colour diagnostic

Compared the preserved idle stream with the new rhythm source using two small cheek patches relative to Vision-detected face bounds. Exact rectangles, source hash, per-frame observations and confidence are recorded in measurements.json. The first 48 source frames cover the three excerpts currently used in gameplay.

The idle patch median is RGB [154,100,77]. Rhythm excerpt medians are right [151,105.5,82], centre [149.25,103.5,81], left [153.25,107.5,83.75]. These suggest a substantially smaller correction than the old action source's [0.90625,0.81379,0.76471] gain. **Do not copy the old gain into the rhythm manifest.** It belongs to different footage and different measured patches.

No grading was applied. Face-bounds-relative patches are not exact anatomical correspondence; downward head pose and shading change the sampled values. Candidate ratios are diagnostic only. A matched-camera idle → speech → dealing → return comparison is still required before changing the shader gain or claiming colour consistency. This investigation does not resolve the missing physical inner-seat reaches.

Reproduce: extract the first preserved idle frame into frames/idle.png, run faces.swift on that directory and the existing integration/frames directory, then run measure.py with NumPy/Pillow. The scripts do not alter public media, manifests or approval baselines. Original footage and the no-deformation gameplay path remain unchanged.
