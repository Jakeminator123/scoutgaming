# Astrid before/after dealing transitions — 13 September 2026

The smooth60 player previously cut from folded-arm idle into a different source pose, then immediately released the dealing layer onto an arbitrary idle frame. The room and table were not changing. The legacy action-return began with different hands and was unsuitable.

Six actor-only clips now connect the exact idle frame to the actual source endpoints: entries at source frames 3, 21 and 34; returns from 21, 34 and 47. The manifest binds each connection to the exact idle RGB/matte and dealing media/calibration hashes. They use the existing packed compositor at the same 1920×1080 logical camera. No torso retargeting or crossfade is used. Existing contact events and server cards are unchanged.

The four accepted Higgsfield Seedance sources are 24 fps, 1664×1248. Their automatic aspect padding is removed with a uniform crop before registration; resizing the padded image directly would stretch the body. The clips are rendered at 60 fps with shared RGB/matte optical-flow maps and 2× source speed, approximately two seconds per connection. This is interpolated output, not native 60 fps capture. Endpoint pixels come from the actual gameplay source and idle assets.

`prepare-endpoints.py` creates the references. Extract raw source frames and run `pipeline/person-mask.swift`, then run `build.py` with OpenCV available. Pose 3 deliberately uses `entry-3-source.mp4` in reverse to construct its return intermediate; it must never use the rejected `return-3-source.mp4`. Only the six clips referenced by the public manifest are shipped.

## Source decisions

- `75d1d46f-b536-4e75-bd8b-54fd351409bf`: completed; return frame 34 to idle; `return-source.mp4`.
- `f978476a-5375-4cba-8a4b-ab87da2c1425`: completed; return frame 21 to idle; `return-21-source.mp4`.
- `d9e236a7-073b-4459-b78b-9f6833beb325`: completed; return frame 47 to idle; `return-47-source.mp4`.
- `63176c40-d31b-4c28-8c5a-d13acd141848`: completed but rejected. Invented a wide-arm gesture and failed its first reference. Retained separately for provenance, never installed.
- `70623221-2529-4c47-bd55-fb9ca4737ec9`: completed replacement, forward idle to frame 3; `entry-3-source.mp4`.

No generation job remains pending. Submission receipts intentionally preserve their original pending status; the terminal results above supersede them.

The first segmentation attempt made the black area below the actor opaque over the felt. This failed actual gameplay review and was rebuilt. The corrected matte intersects person segmentation with the exterior RGB silhouette, filling dark clothing interiors while removing exterior black. `mask-fixed-preview.png` documents the corrected shape.

## Runtime and verification

Smooth60 now loads these joins by default; `joins=off` retains an explicit comparison fallback. The player awaits the return and a newly presented matching idle frame before releasing the actor. Recorded speech waits for the entire sequence, including loading and return, rather than playing invisibly behind it. Error cleanup releases the actor and speech waiters.

A repeat opening exposed `ended` arriving before the final video-frame callback. The player now renders the available decoded final image through the same calibrated card path before resolving that event. It does not manufacture a frame on a timeout or change a server card. The failed repeat is retained as a pre-fix observation; it caused one extra entry after the fallback and still settled at 1,030 with 35 returned.

Six focused tests cover real media dimensions/frame counts and hashes, incompatible endpoint rejection, awaited return/idle ordering, interrupted return cleanup, and speech waiting/cancellation. The deep dealer media audit and full pre-commit checks pass. Tests are not visual approval.

Actual isolated gameplay review at astridjoinqa.localhost: centre opening, hit, return and settlement completed. A seven-seat round showed all player pairs, right hit to bust, left hit from 9 to 17, a dealer draw and settlement: 35 staked, 60 returned, final balance 1,030, zero stake. Entry 3/21/34 and exit 21/34/47 completed in the runtime. Corrected samples retained the room/table, normal body scale and visible felt beneath the arms. One opening-deal clip was interrupted at 18:44:47 UTC and its server card survived; that opening is not recorded as interruption-free visual acceptance. Subsequent right/left/dealer sequences completed without another warning.

All four dealers completed two consecutive matched greetings in the isolated rehearsal after the shared-player change; this is bounded regression coverage, not new lip-sync approval. These joins address the reported before/after pose cut. Feeding-hand paper remnants, distinct physical reaches to four inner seats, and complete colour/photorealism acceptance remain separate open issues. Do not close CAC-4 based on these joins or test results.

Final repeat after the decoded-final-frame correction (18:53–18:54 UTC): seven-seat opening ran with exactly one entry-3 and one exit-34, all seven Stand actions and settlement completed, 35 staked, 5 returned, final balance 1,000 and zero stake. No new browser warning/error occurred in this repeat. Earlier failed observations remain recorded above; the correction is not a guarantee against all device interruptions.
