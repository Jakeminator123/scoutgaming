# Box 4 blue tracking-card take — motion review failed

## User-requested live experiment

Kevin subsequently said “try it lets see live”. The same source is now
available ONLY with `?dealer=astrid&table=blender&astridBlue=box4`, e.g.
http://astridbluebox4.localhost:4190/?dealer=astrid&table=blender&astridBlue=box4.
This explicitly authorised preview supersedes the earlier decision to keep
it entirely offline; it does not change the failed choreography assessment.

The blue prop and generated Box4 label are removed from the actor matte.
Game-owned card artwork is drawn below the filmed fingers, at fixed physical
72x103mm size. Frames0–27 use provisional body-outline fits; frames28–30 use
rigid pose interpolation through the ambiguous turn. Front/back flips at29
between observed back and front. Frames31–96 reuse the bounded marker fit.
No retiming, new generation, actor warp, or colour change was performed.

`build-preview-mask.py`, `build-preview-track.py`, `install-preview.mjs`
reproduce the preview. Media/manifest live in web/public/review/astrid-blue-box4.
The ordinary takes.json stays unchanged; only the explicit query loads Box4.
The take still applies to that box's first card only, with a replay control.

Approved pair: `builtin/start.png` and `builtin/end.png`.
Generated using the built-in image_gen tool after Kevin explicitly requested
GPT images here rather than paying Higgsfield image credits. The existing
Higgsfield-derived start/end files in this folder are rejected/archive only.
Kevin approved the pair and one video with “Awesome” then “great”. One
Seedance 2.0 job c01866d1-7c93-43a4-9493-73f7c66d3725 was submitted:
4 seconds, 1080p, standard mode, high bitrate, silent, 16:9, 36-credit
preflight. Exact request and receipt are saved alongside this document.
It uses the two built-in plates plus ref-identity.png as identity only.
No gameplay files, live
media manifests, dealer source, server cards, wallet or database changed.

## Completed take and decision

`source.mp4`: job c01866d1, 1920x1080, 24fps, 97 frames, SHA256
38dad95f8ad60819bbb2604f85b4ce424d4db425324bdbd0aceca91eb759215a.
One card visibly leaves the actual shoe, turns through a thin edge and lands
at the intended target. The hand returns empty. However the same hand does
everything (no requested transfer), with an upright presentation gesture
and release only around frame55/2.29s. White “Box 4” text was generated on
the table despite the no-text instruction. Do not install this take as an
accepted realistic deal. No second video job was submitted.

Raw inspection: `inspect-source.py`, `source-review/overview.jpg`, and
`source-review/contact-*.jpg`. Full decoded PNGs are locally reproducible
and ignored by Git. Blue body detection succeeds on96/97frames, missing
thin-edge frame28. Candidate colours alone are not marker correspondence:
magenta finger-edge ringing and bleached cyan cause false positives/gaps.

`check-rigid-fit.py` performs a bounded diagnostic on face-up frames31–96.
The card stays72x103mm with no scale parameter; on-felt fits are X/Z/yaw,
lifted poses have temporal priors and a25cm maximum centre lift. Finger
occlusion is explicitly excluded from the far-left marker beforeframe56.
Results: `source-review/rigid-fit.json` and `rigid-fit.jpg`. Landed-marker
mean residual is0.26px against marker offsets calibrated from the SAME end
frame; this measures stability, not independent accuracy or unique3Dpose.
The orange outline mostly follows the face-up card. Frame43 still shows
a visible edge/pose mismatch. Pickup/turnover were not solved, and no claim
of a complete replacement track, 60fps output, masking, or gameplay QA is made.

The repository pre-commit checks and dealer-sync --probe passed. Evidence,
requests and results are retained for the user's hands-on review. Any next
paid take needs a concrete revised choreography, not reuse of this failed
motion as an accepted baseline.

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
Kevin accepted this pair for the single motion test.
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
