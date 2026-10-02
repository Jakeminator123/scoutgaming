# Astrid upper-body lamp-fragment repair

The user pointed out bright noise around shoulders and face in the rejected Seedance pose-47 bridge. Comparing `scene-joins/pose-47.png` with native source frame 47 traced it to captured casino lamps protruding through the person matte. These fragments were baked into the generation reference, not introduced by display noise.

`clean.py` removes thin upper-body matte protrusions using a high-confidence silhouette, morphological opening, a small inward margin and feathering. It blends back to the original matte between camera y=420 and y=460; hands below that line and the finger/card channel remain unchanged before encoding. RGB pixels are untouched before encoding. The repaired border loses a few pixels of wispy hair detail; this is a scoped correction, not a new actor or global colour adjustment.

`build.py` processes the four smooth60 takes and six current entry/return clips with the same mask operation. The repair ramps to zero over 12 frames at each folded-idle endpoint, preserving the original speech-idle handoff. `install.mjs` uses immutable `-edge-v2.mp4` names and binds transitions to the recalculated take hashes/calibration. Original media files remain available; running tabs using the old manifest are not forcibly reloaded.

Source paper holes and estimated card contact remain unresolved. This does not approve CAC-9's entire hand-visibility scope, seven filmed reaches, or the new ready-state lifecycle.
