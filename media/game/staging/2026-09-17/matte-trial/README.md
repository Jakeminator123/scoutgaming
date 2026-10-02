# Mei / Amira background removal trial — 2026-09-17
Tool: existing pipeline/person-mask (Apple Vision VNGeneratePersonSegmentationRequest, quality level as used for Astrid actor mattes and the hands matte). No regeneration.
Input: first 24 frames of dealers/{mei,amira}/preview/goodluck.mp4 at 720x720. Output alpha in {mei,amira}/alpha, review sheet matte-trial.jpg (RGB / alpha / cutout over flat green).
Result: clean person silhouettes on both; hair edge acceptable. Weak spots: name badge partially struck (reads as background), forearms where they meet the table rail fade to ~50 %. Fix path = same as Astrid: plate-difference vote + hard edge (build-hands.sh), or a matting model (RVM / BiRefNet) for hair.
Full-clip pipeline: parameterise pipeline/build-astrid-actor-mattes.py by dealer; it already does frames -> person-mask -> packed h264 matte.
