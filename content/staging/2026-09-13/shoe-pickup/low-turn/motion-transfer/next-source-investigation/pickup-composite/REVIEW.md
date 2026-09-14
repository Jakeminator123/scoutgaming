# Partial pickup composite — staging temporal proof

The two paper-retained movies contain the same 25 native samples (0,3,...72), with the original photographed red card restored beneath the observed hand. `pickup-paper-retained60.mp4` runs in 0.416667 seconds; `pickup-paper-retained24.mp4` runs in 1.041667 seconds. Neither has invented intermediate frames or a completed extraction.

Only a local shoe/table domain is replaced with the original source40 background. A uniform background-to-source0 similarity, estimated from static room features, has median inlier error 0.226 px. The current actor has identity transform: no body warp, translation, or scaling. Original source RGB files and masks remain unchanged. Source40's different actor pose is never used outside this local patch.

Reviewed every selected source/composite contact pair in `paper-close-0.jpg` through `paper-close-4.jpg`. The gray generated fascia is removed and the original shoe remains stable. Original paper visibly emerges, with its white border retained using a two-pixel source-RGB allowance and soft alpha boundary. This is photographed paper, not a server-authoritative card texture. Manual visible strip boundaries do not measure hidden corners.

Remaining failures/uncertainties: small matte notches at native6; dark finger perimeter and rectangular background/shadow remnants near the wrist at native45–72; thin early paper edge native30–45 has approximately two-pixel uncertainty. Source hand contact shadow is not fully reconstructed on the replacement shoe. The source-generated shoe differs from the restored shoe, so their physical aperture correspondence remains a hypothesis. The hand/card boundary is materially more legible than the cardless proof, but this is not final mask acceptance.

**Native72 is still a partial extraction. There is no turnover, delivery, release or compatible next phase. Do not integrate this as a complete gameplay deal.**

`receipt.json` describes the original cardless hand/shoe diagnostic. `paper-receipt.json` is the paper-retained provenance, per-frame polygon/clock ledger and output hashes. `build-paper.py` reproduces the new movie through pipes; no full-frame image sequence is duplicated.
