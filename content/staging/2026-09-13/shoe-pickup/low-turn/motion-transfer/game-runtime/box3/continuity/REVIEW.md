# Box3 existing-footage continuity — evidence, not new playback approval

## Usable existing entry
Retain contact-proof source native144 → centre-native-review packed0–23 → contact-proof native0 (equivalent packed24). No new generation, pose warp, or reverse footage is needed. The current entry prefix already represents the required hands/gaze transition. Do not remove it merely to shorten every card.

At native1920×1080, original unchanged image feature tracking gives end144→centre0 folded-hand median displacement1.20px/p90 1.47px and face median2.10px/p90 3.79px. Centre23→contact0 gives hands1.37px/p90 1.91px, face1.26px/p90 1.73px. These are sparse appearance correspondences with ~2–3px uncertainty, not anatomical ground truth. No uniform or local transform was applied. Compare direct144→contact0: hands18.56px median/p90 39.66px, visibly lifting/repositioning the folded fingers. Thus direct loop is rejected. Packed24 versus original0 full-image RGB MAE0.323/255 confirms the source boundary, with encoding differences.

Proof: exact-bridge.jpg; pose-displacements.json; immutable paths/hashes in inventory.json. Still crops intentionally focus the arms; the numerical face ROI is separately recorded by the reproducible script. No claim of continuous browser playback review.

## Speech and waiting
Actual current RGB files are dealers/astrid/streams/*.h264, not actor/streams (the latter are mattes). Sequentially decoded actual idle has145frames, greeting125, action-deal145, action-return41; hashes in actual-streams.json. Idle0/144 and greeting0/124 retain the frontal folded-rest family compatible with the centre entry's intended start. Their1440-square camera needs the existing runtime calibration; this audit does not approve a raw square-to-wide cut or alter any recorded audio/video pair. Exact source144→calibrated speech handoff still requires rendered validation.

The ready/loop loose-hand pose is visibly incompatible with contact144 folded arms. Existing ready/idle ends in folded speech rest but starts loose; it supplies the opposite direction and cannot be reused forward as folded→loose. Keep current source-bound ready joins gated to their own takes. Legacy centre/left/right packed0 are the same folded-rest family; their starts are candidates via the existing entry machinery, not permission to substitute missing seat reach trajectories.

## Reject native74→93 inertial fan shortcut
hold-release.jpg shows74 has two fingertips pressing a still-rotating card;93 has both fingertips lifted and the card settled. This skip deletes visible final rotation and finger withdrawal. Native73→74 fitted centre delta[-5.314,+1.195]px/frame (~[-127.5,+28.7]px/s at24fps) is leftward/downward with material angle change0.05245rad (~3degrees). It is supported hand motion, NOT a filmed release velocity. Native74 angle2.9994 versus settled92 angle3.1393 differs8.0degrees; centre74→92 shifts[-10.987,-0.286]px. By actual last-touch91, measured89→91 centre movement is only[-0.127,-0.167]px across2frames, below~2–3px visual uncertainty. No significant inertial release speed is evidenced.

The fingertip at74 is approximately[965,804], while93 is approximately[959,758] (manual~3–5px uncertainty); a roughly46px vertical hand jump cannot be hidden by a15.68screen-pixel card fan. Sparse generic flow is dominated by stationary paper/background and must not be read as a hand-seam acceptance. Reject the proposed shortcut and extra glide. Source always remains face-up; no turnover has been added.

## Scope and handoff
Read-only analysis; no runtime/player/media modifications and no new video built. Keep existing prefix. No tests required for this evidence-only change. Remaining: calibrated live speech transition, exact supported server-card compositing/contact, and other delivery targets. The core action and this seam evidence do not establish complete seven-seat delivery.
