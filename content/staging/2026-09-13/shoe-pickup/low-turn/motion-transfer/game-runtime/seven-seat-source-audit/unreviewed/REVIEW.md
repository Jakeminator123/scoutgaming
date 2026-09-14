# Remaining unique-source audit

178 inventory paths hash-matched to 173 distinct MP4 byte streams. 26 hashes were already covered by the previous14, extended10 and seven-seat source audits. Most other unique streams are encodes, masks, composite diagnostics, idle/return bridges or recordings: distinct bytes do not imply a new motion source.

Exactly four additional original action sources survived the path/provenance filter. Twelve timestamp-exact native samples of each were inspected; this is endpoint coverage triage, not dense contact or visual acceptance. All four sampled clips show only one placement. No remaining source establishes box5 delivery or an exact second-card center fan placement.

| Source | SHA256 | Observed final paper center, native pixels | Finding |
|---|---|---|---|
| content/staging/2026-09-09/cac-side-delivery/right/source.mp4 | 4e0d75e55c35c5b42a1a81ae0067145f29ec1b2083b6598147469455c79b2dc3 | 1058.83, 727.78 | Uncorrected right slides toward center lettering, releases between sampled52 and61, returns empty by70. Final1058.8,727.8 is139.6px from current center930.97,783.72 and231.4px from box5 1287.43,763.51. Not an exact center/box5 delivery. Starts with partly extracted paper; no new complete shoe pickup. |
| content/staging/2026-09-09/centre-continuity/source.mp4 | 5933bf8452908d188e14107cfae8f28d2c61e9af49c24aa9c4a975ac4689bd5c | 454.07, 642.67 | Whole action crosses center then sweeps far left; paper released before105. Center is a transit, not placement. |
| content/staging/2026-09-09/dealer-front-continuation/source.mp4 | 2aec415bcf22461f993f911ed925a6215046f182c251335bdd9b4d46fb54818c | 948.33, 646.29 | Short continuation places at dealer spot above lettering; empty return44–61. Not player center or inner-right. |
| content/staging/2026-09-09/dealer-delivery/source.mp4 | 0baff4f9a64a1a06c7bc623ed2bc595c5919f8e5a0887e9892bca69cc453ef42 | 948.72, 644.31 | Whole action lifts paper vertically from shoe before placing at dealer spot; does not meet low-draw requirement. |

Endpoint measurements use final exposed white contour centroid and min-area bounding rectangle inside a table ROI. These are source-image measurements, not hidden corners or physical camera calibration. The four contact sheets preserve native indices; no source RGB was edited. Endpoint overlays mark the selected contour.

Scope is the supplied178-file inventory, not every possible disk location. Path exclusion is documented per file in crossmatch.json; it is not a claim that all derivative frames were newly inspected. Existing14/10 audits were reused rather than repeated. No generation, runtime change, body retarget, or media promotion was performed.

## Dealer-upcard follow-up
Actual live dealer target supplied by root maps to [941.43824,682.65794] in canonical source coordinates. Uncorrected-right source endpoint differs [+117.3951,+45.1188] (~125.77px). Replacing artwork at the observed source location could support a differently located dealer hand, but translating only its card to the current DOM target would visibly detach from the filmed hand. Final white hull is ~117×44 native pixels; its flattened basis must be reviewed, not assumed equivalent to existing dealer CSS card.

Dense native50–61 was inspected: paper is already on felt, fingertip touches through53, separation is uncertain54–55 and clear56. Empty return continues57–70. This does not prove rigid paper or flawless anatomy.

Contact-proof47 to uncorrected-right0 is broadly the same approach pose but is not pixel-identical: paired crop shows approximately10–20px hand/card difference; ROI760,430..1370,750 MAE14.73/255. Static felt SIFT gives only7 RANSAC inliers, median residual0.409px, median raw displacement[0.204,5.272]px. Fitted similarity is recorded in right-camera-registration.json; limited feature support and generated background drift prevent declaring the old contact-proof registration automatically valid for this source. No transform was applied.

Uncorrected right has source/frames/start/job files, but no person/contact masks. Existing right-corrected combined masks are different filmed motion and cannot be reused. Prefix contact-proof masks can be reused for their own native frames; uncorrected97 frames require local matte inference plus source-bound cleanup before independent-prop integration.
