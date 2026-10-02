# Packed slide codec QA

Decoded all55frames from compositor-viewer/slide-packed-draft.mp4, native24fps,1920×2160 packed RGB-over-RG. Compared decoded bottom-half R/G to exact composite-draft/slide-rg PNGs, no transform/resizing during measurement. All55 PTS equal n/24 within2microseconds. Probe/timestamps and input hashes retained. Reproducible check.py uses FFmpeg, bundledPython/Pillow/NumPy; no public writes.

Sampled native frames28,30,32,34 (sleeve/hand boundary) and39 (fingers) in rg-codec-review.jpg: left sourceRG, middledecodedRG, rightabsoluteerror amplified4×. Source/decoded silhouette shapes are visibly close; codec differences concentrate at existing boundaries and around finger tips. No newly missing whole finger or sleeve region was visible in these samples.

Frame39 G:13,692 source pixels>127;13,697decoded. Only3sourcepositive pixels cross belowthreshold and8cross above. Mean loss on positiveG is1.399/255. Maximum localizedG error62/255, so near-zero globalMAE does not imply every boundarypixel is exact.

Frames28–34 R:219–226 sourcepositive pixels cross below127 per sample (roughly0.19–0.20% of~114kactorpositivepixels);179–207 pixels gained. Mean positiveR loss1.46–1.51/255. GlobalR MAE0.144–0.148/255; maximum localR error139–146. Frame39 R loses239 and gains201. These are thin edge perturbations consistent with lossy yuv420p packed-channel encoding; they should be distinguished from broad pre-existing sleeve/card/room matte defects.

G on28/30/32/34 loses0/3/0/5 pixels at127, gains6/5/5/11. Existing finger coverage therefore mostly survives encoding at this threshold. This is a mask-equivalence check, not a guarantee of translucent rendering at all alpha values or proper server-card occlusion.

Known source-mask fringes or sleeve cuts present in both left and middle images are NOT codec-induced. Any remaining gameplay shoulder/hand fade requires decoded composite review over actual background and source matte refinement; changing codec alone cannot repair those shapes. No physical/contact acceptance, native60fps claim, or gameplay promotion.
