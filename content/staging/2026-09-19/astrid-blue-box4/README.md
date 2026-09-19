# Box 4 blue tracking-card plates — awaiting review

Current proposed pair: `builtin/start.png` and `builtin/end.png`.
Generated using the built-in image_gen tool after Kevin explicitly requested
GPT images here rather than paying Higgsfield image credits. The existing
Higgsfield-derived start/end files in this folder are rejected/archive only.
No Seedance job has been submitted for this pair. No gameplay files, live
media manifests, dealer source, server cards, wallet or database changed.

## Current input provenance

- Edit target: original approved camera plate 269f8943, saved at
  ../astrid-elevated-camera/start.png, SHA256
  7bc9c315542a84448bc6401aed13187ba976cdaf0a28124042f9b478031e6011.
- Identity safeguard: original /Users/solvifyab/Desktop/ref-identity.png,
  SHA256 d31c47ded053bfcaf8c8d54a5c806793e5818cede8453c7bfa0323d36a6b347b.
- The built-in end edit uses the built-in start plus card-placement-guide.png.
  No rejected Higgsfield plate was an input to the built-in pair.
- Full prompts, original generated output paths and state: builtin/prompts.json.

## Geometry and markers

`measure-target.mjs` reproduces the current Blender table camera and desktop
96-degree seven-seat arrangement. Box 4 is zero-based: one seat to the
viewer's right of centre. The target is the ordinary first-card area above
its chip, not the filmed Box 5 landing. The physical card size is the same
72 x 103 mm used by blender-card-layout.mjs.

The new start shows one blue card back with a white centre dot at the shoe.
The end shows one blue face, a white border, and magenta/yellow/cyan/white
corner dots in the specified clockwise order. Its blue inner boundary is
within 3.24 native-equivalent pixels of the requested OUTER white boundary;
mean 2.71px. All four distinct marker colours were inspected. The white
border creates other white components: future tracking must use connected
component size and expected corner region, not every white pixel.

Both outputs are 1668 x 943. They are newly generated photographic edits,
not byte-identical preservation of Astrid or a higher-resolution master.
Identity, photographic quality and framing still need Kevin's review.
Static detection/geometry checks do not establish reliable motion, finger
contact, pickup, turnover, release or looping.

`tracking-spec.json` fixes physical dimensions with no scale parameter.
On the felt solve X/Z/yaw; in air allow rigid 3D rotation and translation.
Two visible dots do not uniquely solve an unconstrained 3D pose: use outline
and a temporal prior or mark the missing interval inferred. Inspect native
source motion before any masking or installation. Do not move a betting
box or chip to disguise an incorrect source destination.

## Rejected Higgsfield attempts

1. 2ad17459: start plate; original camera269f8943 + identityb2c16866.
2. 9e7df4f0: first end; wrong orientation and duplicate magenta marker.
3. 9b95f4a1: correction using start + exact placement guide5bdae493;
   archived when Kevin rejected image quality and chose built-in generation.

These used GPT Image2.5,2k,quality=low, one image each. Preflight was one
credit each (three submitted image jobs); the original approved plate had
quality=high. No further Higgsfield image generation is authorized by this
review. No claim that low quality alone caused every visual defect.
