# Greeting face-alpha repair

The user rejected the installed greeting on 2026-09-19 because her eyes
disappeared. The original green-excess key partially removed Astrid's
blue-green irises. The earlier contact-sheet verdict of "clean" missed this
and is superseded by this rejection and close-up comparison.

`build.py` reconstructs the original matte from the registered source and
cached Apple Vision masks. It makes the enclosed, high-confidence head
interior opaque: at least four pixels inside the silhouette, semantic alpha
>=250, source y<280. This changes alpha only, preserving source RGB, outer
hair/face boundaries, camera, crop, timing and the paired recording.

All 116 frames were checked: 2,300 alpha pixels in total were restored.
The corrected pixels are 255 before encoding and at least 253 after H264
decoding (`encoded-eye-check.json`). Close-ups in `qa/` compare the source,
rejected mask and corrected mask over magenta, which makes iris holes visible.
No new generation or facial repainting was performed.

`install.mjs` updates only greeting, preserving any other speech lines in
the current manifest. It also updates the canonical greeting mask so a
subsequent multi-line build uses the repair. The live media has a new
content-addressed filename to prevent reuse of the rejected cached video.
Packed SHA: 5b1f348737efd4374f498b23e21be935d8cdd450172af79e944a36845ca9dd75.

The actual table was inspected in Codex's in-app browser on an isolated
guest server at port 4211. Greeting starts after the first gesture when
autoplay is denied, the waiting layer holds during speech, frames reach115,
and the waiting loop resumes. Runtime evidence is in `../hardware-review/`.
The first corrected play measured audio/video clock deltas -25 ms at start
and -49 ms after settling. These measurements do not establish perceptually
perfect lip sync. The existing pose jump between speech and idle remains.
This repair only validates greeting; newly installed unrelated speech lines
must receive their own face-mask review.
