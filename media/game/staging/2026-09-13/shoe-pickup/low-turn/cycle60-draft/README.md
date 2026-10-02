# Shared RGB / RG flow at60fps — staging candidate

`resample.py pickup|slide|return` builds independent packed RGB|RG streams at60fps and2x from native24fps. Pickup7–66:75 frames; slide2–54:66; return5–36:40. Each clip has exact input video/frame SHA and output-frame/native-position ledger. `receipt.json` adds packed-video, ledger, flow-cache and script hashes. No flow crosses clip boundaries; actor/card positions are still in each source camera. Root applies uniform registration and analytically interpolates rigid card separately.

Bidirectional DIS flow is computed once per adjacent source pair at960×540 and uniformly upscaled to1920×1080. Identical remaps/blend weights are applied to a five-channel array: premultiplied BGR + actor R + foreground G. RGB is unpremultiplied only afterward. RG is never independently interpolated. Stored flow arrays are float16 audit copies of the float32 calculation, not lossless snapshots; exact algorithm and input hashes are recorded for recomputation.

First iteration is retained as `*-shared60-v1-rejected.mp4`: pickup output32/native32.6 introduced a transparent duplicate finger contour absent in native32/33. `pickup/hand-32-comparison.jpg` proves this failure. Do not use v1.

Current v2 uses one occlusion rule: where warped actor coverage differs by>0.15, select the nearer warped temporal source jointly for every channel. `pickup/hand-32-v2.jpg` shows the duplicate removed; a small hard texture/edge patch remains around the thumb. This is an interpolation tradeoff, not reconstructed anatomy.

Pickup all75 output hand crops inspected in review0–6, especially native55–61 curl/recontact and native36–45 turn. Added motion stays continuous with aligned RGB/RG. Existing source-mask pink paper-border fragments near native23–27 remain in these outputs; gameplay QA is preparing separate corrected native masks. They must be substituted and pickup rerun before accepting edge quality. Slide and return moving-hand output samples were inspected; full rendered card-contact playback remains root QA. Review sheets for all output frames are saved.

The60fps label means generated in-between frames from24fps at2x, not native60 capture. Packed MP4 is H264 yuv444p CRF12 and therefore lossy; raw packed PNGs retain pre-encode masks. Decoder/compositor support and encoded RG tolerance require testing. No published assets, viewer integration, visual approval or full-gameplay claim.


## Approved mask update and420 alternative

Pickup was rebuilt after gameplay QA promoted the23–27 paper-border corrections. Current pickup ledger includes those changed RG hashes. All three clips now also provide `*-shared60-packed-420.mp4`, High profile5.2 yuv420p at60fps; original444 stream retained. `encode420.py` encodes from shared packed PNGs rather than transcoding the lossy444 stream. Per-clip encode420-receipt.json records exact ledger/output SHA and probe. compare420.py decodes every frame of420 and444 and records RG threshold128 differences, G boundary errors and actor-face colour delta. This confirms close correspondence, not lossless masks or browser frame-delivery acceptance.
