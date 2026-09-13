# Return actor R / observed skin G draft

Built41native1920×1080 R/G masks from mattes/return, n0–40. Target motion-review range5–36 remains unchanged. build.py confines output to this directory. Raw output r/g/rg/checker directories are ignored; receipt and7sample review retained.

Algorithm keeps the largest high-confidence actor component, discarding disconnected table feet. Removes measured broad shoe context and stable card area(x885–1005,y825–985), felt/lettering colours; restores only connected observed warm RGB skin supported by the original Vision mask. G is visible connected hand skin, not labelled individual anatomical fingers. No inpainting, hull completion, unknown-finger reconstruction or actor warping.

Reviewed n0,5,12,20,28,36,40 checkerboard and RG. Ghostshoe/tablefoot fragments are removed in these samples. Delivery hand remains visible across the empty-hand return; frame5–36 poses retain recognizable sleeve/hand coverage. Stable paper removed in inspected samples. Thresholding still leaves small sleeve holes/fringes around wrist (notably n12) and may suppress pale highlights. Native fingertip boundaries and whole sequence temporal coherence remain unapproved; this is a usable compositing draft, not a ready gameplay asset.

Initial frame0–5 fingertip near stationary card needs exact comparison before choosing a splice. Fixedpaper exclusion does not invent occluded hand pixels. Root should validate actual native composite with servercard retained beneath fingers, calibrated live shoe position, source endpoint joins and paired speech before packing/promoting. No public files changed.
