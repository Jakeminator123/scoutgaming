# Local pink-card-border removal candidate n23–27

Separate candidate only; pickup-draft and current packed media unchanged. build.py reads existing nativeRGB andRG, applies five tightly scoped manually traced visiblepaper-border polygons to bothR/G, and writes rg/0023–0027.png. RGB bytes are unchanged. receipt.json records polygons, changedpixelcounts and input/outputSHAs.

Inspected before.png then comparison.png (nativeRGB / oldchecker / candidate). Long disconnected pink strips in n24/n25 are removed; short n23/n26 protrusions reduced. n27 inter-hand card-top strip is reduced while existing visible finger contours remain. Minor pale/red edge uncertainty adjacent actual finger contact remains; do not enlarge removals blindly or infer hidden finger shape. This is a local visual candidate requiring root's review, especially n27 where card and fingers touch.

An initial polygon choice around n26/n27 cut into the lower fingertip silhouette; it was rejected and narrowed/repositioned to the actual upper card border before writing the final comparison. Finalpolygons target visiblepaper only. No global morphology, hand shrinking, inpainting, or RGB replacement. Source motion and frame order unchanged. Nativecodecs/sharedflow must be rebuilt from approved corrected masks before any interpolation can lose these residuals; existing flowdraft still uses oldmasks.

No public edits or repacking. Review/accept individualframes before copying candidates; immutable inputSHA check required if currentpickup-draft changes.

Root reviewed23–26 and requested n27 refinement. Final n27 polygon removes the gap-spanning paper strip while retaining left fingertip; n27-after.png records result. Promoted23–27 to stagingpickup-draft with hash-guarded promote.py and build-pickup poststep; SHA256.json/paper-cleanup-receipt updated, individual checkerframes regenerated. Aggregate old review sheets remain historical. Repacked nativepickup and verified67frames. No public promotion or fullcontactapproval.
