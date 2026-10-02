# Single-cycle cadence diagnostic

Staging-only preview from extract-edge, edge-face, held-slide and empty-return. No source deleted, no public media/player change, no claimed gameplay delivery. This is a single cycle: the stationary terminal card remains on the table. Looping would make it disappear and is not approved.

`python3 build.py` fits each source uniformly inside 1920×1080 with black padding (no stretch/actor retarget), applies monotonic piecewise timing to the whole source, motion-interpolates each clip independently to 60 fps and joins at the supplied endpoints. Source capture remains 24 fps. Interpolation does not recover native camera detail, and intermediate frames can contain flow artifacts. There is no crossfade or cross-seam optical flow to hide pose mismatches.

`edit-ledger.json` records input hashes/dimensions, speed ranges, every native frame's mapped timestamp, exact output frame boundaries and total duration. Speed multipliers operate over intervals ending at the next listed boundary. Faster holds remain chronological; frames are temporally resampled rather than deleting an internal movement or freezing a body pose. The actual narrowing interval extract-edge n50–64 and broadening edge-face n43–48 receive slower rates than surrounding holds.

Remaining material limits: source upright presentation/lift remains visible even when shorter; this preview cannot repair that choreography. Finger-contact and rigid-card judgments are conditional from dense source review; generated face texture still varies. Aspect-preserving fit is not calibrated scene registration, and joins must be inspected. It demonstrates one centre delivery only, no seven-seat source, no game-mask/card replacement, no speaking transition, no server round integration.

## Render review

Output verified 1920×1080, 60 fps, 240 frames, exactly 4.000 seconds. Clip boundaries: extract-edge n0–61; edge-face n62–117; held-slide n118–178; empty-return n179–239. Inspected 24 chronological output samples and eight frames around each join in overview.jpg and seams.jpg. Extraction, narrowing edge, broadening face, supported outward travel and empty return remain visible. Terminal card stays on felt.

The first two sections still show upright paper, and the edge-on dwell remains noticeable despite acceleration. Join at n61→62 has a small framing/table shift from different source aspect; n117→118 has another small alignment change. No crossfade is used to obscure them. n178→179 keeps the same destination/contact broadly aligned. Hands remain supported through the sampled outward slide; interpolated detail is not equivalent to original native frames. This is a four-second single-card diagnostic, not the reference's roughly one-second repeated cadence or user visual acceptance.
