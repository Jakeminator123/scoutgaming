# Astrid single-card shoe pickup candidates

The user rejected delivery without visible extraction from the actual shoe. This staging experiment rebuilds the complete physical action, rather than drawing a card from an unrelated origin or changing the old proxy metadata. Nothing here is installed in gameplay.

Anchor d207da34-c322-49a1-997c-9a8d6022522e uses the existing source reference 42d15cc3-032d-4abe-b509-13ad819cbf87. Inspected full image: both hands empty, feeding fingertips at the low front shoe mouth, stable Astrid composition. This is a source anchor; matching current rendered camera/shoe coordinates remains required.

First take f9ab611b-8409-4007-b2f9-97c2019f4840 (source.mp4): 97 native 24 fps frames. In the 16 inspected chronological samples a card emerges at the outlet, passes between hands, lands and is left behind. Rejected for excessive vertical card display and roughly three-second delivery.

Second take f44bf201-4c28-4d63-8496-1459ebda635a (fast.mp4): 73 native 24 fps frames. Better outlet extraction and continuous transfer; still briefly raises the card, remains slow, and incorrectly leaves the card face down. Cannot approve as a player deal.

pace60.mp4 is only a cadence experiment from fast.mp4: ffmpeg motion-compensated interpolation to 108 fps, timestamps divided by 1.8, output 60 fps, CRF15, no B frames. 101 frames / 60 fps. Sixteen cropped samples inspected: extraction, transfer, brief lift, release and empty return survive; face-down defect remains. This is interpolated, not native 60 fps or additional captured detail. No gameplay acceptance implied.

Third source b761026b-2599-42a1-ad1b-2e2481ac6b9a (turn.mp4), 3840x2160, 73 frames at 24 fps, completed and failed the wrist-turn requirement: the card remains red-back-up through delivery in the inspected sequence. Higher resolution did not repair the choreography. Rejected for player dealing. Face-up end anchor 33776e49-e64c-4f13-92d8-bd19ed71f3ec completed and was inspected. Exact prompts and submissions are saved separately. review.py produces reproducible frame-numbered contact sheets and ffprobe receipts.

Fourth take 2bc43925-eb41-4aba-b0c1-ace56546b0e0 (bound.mp4), 73 frames at 24 fps, completed. Supplied start and face-up end images. The sequence reaches the face-up terminal card, but shows an extended upright presentation and an awkward unsupported-looking drop/slide; reject as a professional player delivery. Endpoint correctness does not prove intervening contact.

All four video jobs and both image jobs are terminal. No further generation is pending. fast.mp4 / pace60.mp4 remain the best extraction/transfer experiments, with the explicit face-down and brief-lift limits above. No public app, server, source manifest or paired speech assets changed. Deep live-asset audit passed. Full commit checks run for the saved staging work. Further work must validate a low economical turn-and-slide and camera/shoe alignment before integration; do not promote any of these based on completion or output resolution alone.

## Overnight continuation — 14 September

All later generation jobs are terminal. Exact requests and IDs are preserved in split-request.json, held-landing-request.json and edge-split-request.json.

- extract-turn.mp4 / slide-return.mp4: rejected for broadside texture morph and early detached card drift; see motion-review/SPLIT-REVIEW.md.
- held-slide.mp4: conditional supported slide; fingertips stay on the paper through landing.
- empty-return.mp4: empty hand separates, but source paper drifts 5–7 px relative to background and changes rank. It requires paper replacement, not whole-body stabilization.
- extract-edge.mp4 / edge-face.mp4: conditional geometric turn improvement, with observed narrowing at native n50–64 and broadening at n43–48. Excess upright holds/lifts remain. See motion-review/EDGE-MOTION-REVIEW.md.

Held-slide last frame and empty-return first frame differ by 0.99/255 RGB overall; no global grade/body warp is justified. See gameplay-qa/seams/. Actual video sizes vary (1924×1076 and 1912×1080); use uniform fit, never force aspect ratio. New integration-diagnostic tools preserve unobserved card corners as unknown. The optional public shoe-lip geometry module is tested but not connected to the player.

Current next work: full-cycle cadence preview, cycle seam review and stationary source-paper removal feasibility. No new source has been promoted into gameplay; all seven genuine reaches, camera/shoe registration, clean finger coverage and paired speech joins remain acceptance gates.
