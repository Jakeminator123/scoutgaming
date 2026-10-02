# CAC-9: dark, flickering fingertips — 13 September 2026

Issue: https://scoutgaming.atlassian.net/browse/CAC-9

Expected result: clean hand movement, always visible. `cac-9.png` is the attached user screenshot (Jira attachment 97603). `cac9-source.png` and `cac9-mask.png` are the first idle RGB/matte frames downscaled to 720 square for inspection. Original RGB includes the complete hand; its segmentation has uncertain edge opacity.

The shared `cleanActor` shader eroded the matte and replaced uncertain edge colour with a nearby opaque pixel without checking colour similarity. Over a black sleeve this can darken the fingers. The correction limits inward colour borrowing to similar colours and restores opacity for warm skin already supported by the source matte. It does not synthesize fingers or increase alpha outside the matte.

Actual isolated gameplay review: `http://astridhands.localhost:4173/?dealer=astrid&performance=staged`. Resting fingertips were visible in separated idle snapshots. The centre delivery showed the hand and fingertip over the moving card. A five-dollar round (4 hearts + 10 hearts versus dealer 7 clubs, Stand) completed, settled as a loss, returned to betting at 995 balance and zero stake. Speech, decision idle and return transitions were inspected. Full pre-commit and deep media audit passed. Source media, hashes and speech calibration remain unchanged.

Scope: the specific resting-hand defect is improved in the inspected gameplay. A few sampled frames do not prove every frame of every source take; keep CAC-9 In Testing for visual acceptance, not Done. Source motion blur and the four missing physical reaches remain separate limitations.
