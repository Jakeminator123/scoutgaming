# Three cycle seams — offline native-frame QA

Sources: extract-edge.mp4 and held-slide/empty-return1924×1076; edge-face.mp4 is1912×1080. Examined native frame0/frame72. Background ORB features from outer upper scene fitted with RANSAC similarity (one uniform scale, rotation, translation), then B inverse-warped into A coordinates solely for measurement. No body deformation. Saved native endpoints and aligned-B diagnostic PNGs; measurements reproducible with measure_cycle.py and OpenCV.

| Seam | Uniform map A→B | Residual face/body/shoe translation after alignment | RGB MAE face/body/shoe (0–255) |
|---|---|---|---|
| extract last→edge-face first | scale0.993663; x+0.052,y+5.624; rotation~0.0039° |0.40/0.06/0.29px |2.48/1.33/2.45|
| edge-face last→held-slide first |scale0.996037; x+9.984,y+0.293; rotation~0.0029°|0.54/0.69/0.15px|3.15/1.54/2.82|
| empty-return last→extract first |scale1.000144; x−0.300,y+0.336; rotation~0.0051°|0.18/1.16/1.45px|5.87/3.15/9.71|

These are image-region phase-correlation estimates, not exact anatomical landmark motion; RGB MAE includes compression, texture and lighting differences. The background fits have median inlier residual0.74,0.74,0.52px respectively. All three actor poses are spatially close enough for direct-cut candidates after uniform registration. No body warp is supported or needed by these endpoints.

Important: do NOT naïvely resize1912×1080 edge-face to1924×1076 independently in x/y. Fit/crop uniformly. The two seam transforms are NOT exact inverses, so a single static rescale may not align every segment endpoint throughout a full cycle. Measure/drift-stabilize the stationary background over each entire clip with a smooth global similarity, or retain the small residual and review native playback. Endpoint measures alone cannot prove smooth velocities across cuts.

The raw full-frame cycle is NOT loop-compatible: empty-return ends with a face-up card on the felt; extract-edge begins with empty felt. A direct cycle makes that card vanish. Uniform registration cannot correct missing content. Persist the server-owned dealt card via actual matte/contact compositing, or make a source with the same accumulated-table state; never treat this as a source-only approved loop. The shoe region also changes brightness/detail (MAE9.71) more strongly at that seam despite only1.45px estimated shift, requiring actual temporal review. The already-documented K→Q card-artwork morph remains.

No public edits or generated assets. These findings support assembly of a labelled source-motion preview, not approval of live gameplay, card extraction accuracy throughout the clips, finger occlusion, or seven-seat delivery.
