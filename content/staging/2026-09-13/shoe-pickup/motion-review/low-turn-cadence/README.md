# Targeted pickup-turn cadence candidate

`pickup-turn-pace60.mp4`: verified 1920×1080, 51 frames at 60 fps, 0.850 seconds. Native source is 24 fps; output is motion-compensated interpolation, not new camera frames. No public change, full-cycle or gameplay approval.

`build.py` uses contiguous native n7–54: 2x over n7–20, 4x over upright-transfer n21–35, 2x over n36–54. There are no internal frame-range deletions or body retargeting. `edit-ledger.json` records exact source SHA, every native frame's retimed timestamp, range boundaries and actual output probe. The final native sample is held only for final output quantization, not used as an animation loop.

Inspected every output frame in frames-0/1/2.jpg. Output n0–17 retains visible outlet extraction; n18–26 shortens the lifted transfer; n27–38 preserves red-plane narrowing, edge and white-plane broadening; n39–50 remains low with receiving-hand contact. The upright handoff is shortened to approximately 0.156 seconds, near the reference's brief upright phase, but extraction plus turnover still occupies most of this 0.85-second clip before a separate delivery/return.

Some motion blur remains around the hands and narrow paper; output n14 has a thin bright diagonal/edge echo near the exiting card. This can be an interpolation defect and should be inspected at playback size before promotion. It does not erase the continuous source rotation, but do not claim artifact-free fingers or native high-rate detail. Candidate starts with hands already near shoe and ends at near-shoe low paper, so original idle and old centre-body slide endpoints are not automatically compatible. Parent must inspect matched continuation before any integration claim.
