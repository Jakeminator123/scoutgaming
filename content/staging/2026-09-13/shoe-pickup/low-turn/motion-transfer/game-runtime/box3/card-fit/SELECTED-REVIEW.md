# Selected85-frame timeline geometry

All34 selected carried-source poses38–92 were visually inspected against original1920x1080 RGB in selected-proof-0.jpg through5.jpg. The output ledger has85entries exactly matching pace/receipt.json; entry/pre38 have no quad, source92 onward reuses one terminal pose. Source image bytes remain unchanged.

38–48: bounding-keypose interpolation was checked against each visible leading edge. These remain estimates, not measured fullcorners. Rear corners are hidden inside the shoe; shoe occlusion is mandatory. Low visibility confidence.

49–91: independent fixed-basis translation/rotation was estimated from paper-colour contour samples near the initialized boundary. Robust least-squares fits actual selected frames; no claim these are manually measured corners. Initial narrowsearch failed63–67 (unmodelled timing variation), so search was broadened and those actualpaper contours constrain the final fit. Full revised subset was then inspected. The final quads follow the visible source rotations and retain pad overlap; no body or hand is moved. Some early/mid edge differences remain severalpixels due fixedbasis versus generatedsurface, especially49–60. This must be judged in actual independent-card composite, not hidden with skin erasure.

RMS includes hand-occlusion notches in the paper contour; it is not amodal corner accuracy. Foreground fingers must be kept over the quad. Exact sourcepaper subtraction may remove confirmedpaper outsidequad overfelt, but never erase skin merely to fit the fixedshape. No front/back turnover appears or is added.

selected-output-tracking.json carries originalsourceSHA, paceReceiptSHA, eachoutputFrame/sourceNative/cornersNative/confidence/evidence/inferredHiddenCorners/residual. This is ready for parent geometric review and diagnostic composition, not automatically public gameplay promotion.
