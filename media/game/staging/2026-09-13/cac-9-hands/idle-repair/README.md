# Second CAC-9 correction: the actual idle mask

The user rejected the first shader correction. In their open tab, idle fingertips visibly disappeared between samples 2.4 seconds apart. CAC-9 returned to In Dev. Comparing the full-loop contact sheets showed intact source fingers but deeply varying opacity in the original segmentation. The prior shader's opacity recovery still depended on that failing alpha.

`repair.py` restores skin coverage within the inspected idle hand crop, following the RGB hand pixels in each of all 145 frames. No static hand is pasted in, and source RGB, voice and timing are unchanged. This crop is specific to idle; do not reuse it for unreviewed moving hands or other takes. Original mask bytes are preserved. The revised mask has its own public filename, frame index and paired provenance hash.

The source/old-mask/new-mask contact sheets cover the loop at half-second intervals. The existing user tab was reloaded at zero stake, and three separated gameplay screenshots spanning the six-second loop retained complete fingertips, unlike the reproduced failure. Shared rehearsal and idle-return checks were also run. Actor pairing audit, deep roster audit and full pre-commit checks passed. This is a bounded idle repair; CAC-9 remains open and no blanket all-take hand acceptance is claimed.
