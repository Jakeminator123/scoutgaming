# Existing centre footage mask assessment

The existing material can be reused without image/video generation, but its current R/G is a starting matte, not clean final compositing.

## Exact clock and provenance

`content/staging/2026-09-09/contact-proof/source.mp4` has145 native1920×1080 frames24fps. Its one-based `frames/`, `person/` and `contact-masks/` each contain145 PNGs at1280×720. Native frame n corresponds to file n+1, not filename n. Packed `web/public/dealers/astrid/performance/centre-native-review.mp4` has169 frames and RGB-over-R/G masks at1920×2160. SHA2567ccca94b5332f28cdd962fd70d34ac59152aecbac4748738bf53ac87331a7726 matches the manifest.

Source n maps to packed n+24 exactly. Verified all145 combined PNG frame hashes and all145 combined mask hashes match contact-proof originals with this offset. The first24 combined frames are centre-entry-clean native0,4,...92 (confirmed first0,second4,last92 by hash). Existing source native0 is therefore packed24, final144 is packed168. Fourteen decoded packed-RGB comparisons at n+24 have mean absolute differences0.323–0.437/255, consistent with re-encoding, not pixel identity. Pack code preserves every contact-source frame; only the empty-hand prefix was sampled.

Manifest events translate from packed pickup69/release116/land122/rest154 to source45/92/98/130. These are historical annotations, not newly accepted release measurements. Do not confuse the24-frame prefix offset with retiming or use packedindices against145source masks.

## Mask and tracking quality

Inspected source0,12,24,36,45,50,60,72,84,92,98,110,130,144 against actor-on-neutral and G overlay. Fingers generally remain present. Source24–45 retains portions of shoe/tray in R. Thin paper outlines persist50/72/84; native92 retains a sizeable shadowed-paper island after the fingertips separate. Table lettering/arc residue also remains near contact. Late empty return98+ is substantially cleaner in reviewed samples. G has a hard source-specific rectangular ROI boundary and remains nonzero on nearby skin after contact; it is not a release event mask.

`prepare-contact-mattes.swift` uses white-marker thresholds and a simple warm-skin predicate to produce R/G. It is not manual finger segmentation. The145-record marker-tracking file has100 non-null rows45–144. Its corners are a minimum-area rectangle around the largest white connected component, with cyclic label continuity. Hidden/occluded corners are inferred by this rectangle; do not call allfour points measured visible corners. The original builder also chooses the nearest detected hand index tip as contact: nearest-point assignment is not proof of same-finger material contact.

## Reuse path

Reuse original nativeRGB, existing1280person masks, and exact145frame clock. Apply narrowly source-traced paper/shoe removal in a separate mask derivative and review fingers over an independent authoritative game card. G must be clamped to finalR and gated by actual contact evidence. Upscaling existing masks cannot restore native-detail observations. The packed169 asset is useful for matching the existing entry but should not be decoded as the cleanest mask source; use original PNGs and avoid its420chroma mixing.

Evidence: mask-review-0..3.jpg and mask-evidence.json. No gameplay edits or full visual acceptance; whole-action motion and all-seat coverage are separate gates.
