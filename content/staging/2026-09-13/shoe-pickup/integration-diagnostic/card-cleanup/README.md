# Empty return: source paper cleanup feasibility

Diagnostic only; no public integration or visual approval. Input `../../empty-return.mp4`, 73 native frames at24fps, 1924x1076. `receipt.json` binds exact source bytes.

`clean.py` produces `empty-return-clean-diagnostic.mp4`, seven indexed before/after sheets covering EVERY native frame n0-72, and selected full frames. Uses only decoded source pixels: a fixed nearby felt region 170px to the right supplies the patch at [890,766,1016,895]. Six-pixel perimeter blend; source skin components connected to the observed hand are preserved byte-identically before encoding. No generated anatomy, warp, card, or synthetic pixels from an external image model.

This is a spatial clone on the fixed image plane, **not recovery of the original hidden felt texture**. The source never exposes the felt under the whole card. Same-frame donor pixels retain source lighting changes, but the donor may have a slightly different local gradient. Camera/felt stability and destination bounds are specific to this input and cannot be copied blindly to another take.

Reviewed all 73 native-frame pairs. Paper changes from K to Q early and drifts downward later. First patch missed the late bottom edge; extended its bottom to895. The first skin-mask dilation retained obvious white rectangles, so dilation was removed. Current result removes the card body/rank and late edge throughout the sequence. **n0-22 still have tiny pale/jagged mixed card-skin pixels at fingertips**; these are not approved for a naked empty-felt presentation. From n23 onward the hand is clear and the local removal is considerably cleaner. All preserved confident-skin pixels remain exact source RGB before encoding; this does not certify perfect full fingertip coverage.

For gameplay, the authoritative dealt card must remain under those observed fingers at a stationary, calibrated table coordinate across return AND the next extraction. Do not bake a new generated card into each clip or clear the card at reset. An independent finger foreground matte must cover the preserved fingers above that persistent card. This experiment addresses source paper removal only, not the server-card continuity implementation, full-body segmentation, realistic extraction, or all seats.

Reproduce with bundled Python and OpenCV installed at /tmp/astrid-optical-flow. Output73frames verified during streaming; inspect rendered result before any publication. No gameplay change was made and no live gameplay acceptance is claimed.
