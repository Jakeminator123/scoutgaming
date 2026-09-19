# Independent asset audit

These are file, decoder and pixel measurements, not visual or lip-sync acceptance.

- All 17 speech entries retain their text, audio path/hash, cut-in/out, audio offset, source/native-source hash, fps, frame count, dimensions and camera/crop metadata. All raw, registered-source, original packed and paired MP3 files still match the saved input hashes. Installed manifests match the staged manifests.
- Decoded all 1,060 displayed speech frames. Counts, dimensions and 24 fps match the manifests. All display-copy hashes and enter/exit flow hashes match.
- Encoded head-interior alpha is at least 249/255, with only five sampled interior pixels below 250 across the bank. The eye band is at least 250/255 throughout. No transparent eye/head holes were detected by this check. Rest loop/out/back interior minima are 250/249/250. This is near-opaque encoded alpha, not a claim of mathematically exact 255 everywhere.
- Fixed speech scale ranges from 0.975732 to 0.982975. All 17 clips use a single per-clip transform. Camera placement and actor offset are unchanged. Mapping every original opaque pixel through its new transform finds zero outside the retained crop: no new source-actor clipping detected.
- Original folded-loop wrap head RGB mean absolute difference was 25.32/255, versus a typical adjacent-frame median of 1.13 (22.41 times normal). The new wrap is 1.91 versus median 1.21 (1.58 times normal).
- The moving overlap is now the largest local change: frames 3→4, 4→5 and 5→6, peak 4.90 versus the original native adjacent peak 3.54. Inspect the first 0.125–0.3 seconds of the loop for visible interpolation or expression change; improved wrap metrics alone do not approve the loop.

`report.json` contains per-line checks and decoder/alpha/crop results; `summary.json` is the compact rollup. `check.py` reproduces those measurements.

`low-alpha-locations.json` preserves an initial diagnostic that accidentally included the clipped ROI top boundary: its low samples were top hair silhouette pixels, not eyes. The final report fixes that measurement by explicitly eroding against a zero ROI border. Those initial values must not be used as the head-interior result.
