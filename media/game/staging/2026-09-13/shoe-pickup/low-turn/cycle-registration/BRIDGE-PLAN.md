# Repair route: retain the existing source transition

No new generated bridge is needed for the diagnosed hand-pose discontinuity. The original accepted `low-turn/anchor.png` has the curled-finger, index-contact pose seen at slide0. Pickup54 was not the actual generated endpoint. Inspection beyond the earlier trim reveals genuine wrist lift, finger curl and recontact at source55–61, settling through62–66. The earlier assumption that55–96 was only stationary hold was incorrect. `pickup-native54-66.jpg` proves the missing motion continuously.

Use pickup through native66 inclusive and start slide at2. Keep all55–66 source frames in order. At24fps these12 additional frames occupy0.5s;2x playback occupies0.25s, or15 output frames at60fps with truthful interpolation. Do not collapse them into a crossfade or hold. The card is already on felt; it remains stationary while fingers change grip. Extraction and turnover remain in the earlier source interval.

Pair66→2 registered hand appearance MAE7.639/255, edge Chamfer0.724px. Prior54→3 was23.447/255 and2.667px. These are appearance diagnostics, not proof of anatomical contact. The real pose difference is substantially reduced without generating, warping or skipping moving fingers. n67 gives negligibly better metric but is unnecessary extra hold.

## Only if closer rendered inspection still rejects the seam

A minimal bridge would use actual source66 as first frame and uniformly registered slide2 as final frame, both lossless PNG at source0 camera. Never feed divergent raw camera endpoints or substitute the old anchor for an observed endpoint. Target only6–8 native frames of settling motion (0.25–0.33s), with stationary rigid card and index remaining in contact. A provider4s minimum can include the short action followed by a hold, but no generation is currently proposed or authorized by this plan.

Draft fallback prompt: “Continuous locked-camera micro-adjustment between these exact frames. Preserve Astrid, camera, sleeve length, room, shoe and stationary face-up card. Her right index fingertip maintains contact with the same trailing corner while the other fingers make only the tiny natural adjustment needed to match the final frame. Do not move, lift, rotate, resize or replace the card. Left hand stays resting at the shoe. No cut, dissolve, texture morph, body change, extra gesture or new card. Complete the adjustment in the first0.25 seconds, then hold naturally.”

A unified replacement clip is unnecessary for this particular seam unless the existing55–66 physical adjustment fails close motion QA. Current priority is use and inspect the actual omitted frames.
