# Return packed native-frame QA

Extended compositor-viewer/pack-native.py with explicit return specification:41frames, RGB mattes/return/frames/%04d.png starting1, RG return-draft/rg/%04d.png starting0. Slide/pickup remain55frames and unchanged inputs. Ran only return. Output return-packed-draft.mp4 is1920×2160,24fps, topRGB/bottomRactor-Gvisiblehands, no interpolation, no B frames. Source file hashes and encoder command are in its JSON receipt.

Decoded all41frames and compared same-index nativeRGB and RG. RGB whole-frame MAE range0.586–0.914/255 supports correct RGB correspondence (not a visual-identity score). Timestamps equal n/24 within2microseconds from0 to1.666667. Exact packed/inputmask hashes are retained in input-sha256.json. No missing/extra decode frame.

Inspected n5,8,12,20,36 fingertips and sleeve regions in rg-codec-review.jpg. SourceG pixels above127 are12,197/11,804/11,727/11,406/11,499; decoded loses0/0/1/0/0 respectively. R loses175/183/194/162/158 threshold-positive pixels, largely thin actor boundaries. No whole finger disappears due encoding in those samples. Small sleeve holes at n8/n12 already exist in the PNGs and remain codec-independent.

This verifies packing/frame correspondence only. Native matte fringes, exact fingertip contour and live card/sleeve occlusion remain draft issues. No gameplay promotion or public asset changes. Reproduce with bundledPython return-packed-qa/check.py; all outputs stay in staging.
