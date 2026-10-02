# Box1 native card trajectory

Use `issued-card-trajectory-complete-v2.json` for the current complete 97-frame diagnostic. `trajectory18-63-proposal-v2.json` contains its 46 dense middle poses, fixed63×88 logical card under an explicitly assumed1500px camera; physical dimensions/camera are not measured. Each frame is constrained by source paper envelope and straight edges. Hidden corners remain inferred5–8px, observed edges4px. Source RGB/table/actor untouched.

The initial optical-flow-only proposal drifted up to21px and failed30→40; it is evidence of rejection, not the trajectory. Initial dense threshold also captured gold table lettering. V2 uses strict neutral paper segmentation after43 plus thin-line opening; all observed-envelope residuals≤3.36px. Dense-source-quad-proof-v2.jpg inspected across all46frames. Four/nine automatically assigned segments include envelope approximations; do not call every segment manually measured.

Source18/30 hidden upper corners come from rigid pose and weak prior. Keyproof marks them orange. Source47→48 and18→19 have the largest fitted pose changes (~10°), worth runtime review; no isolated normal flip detected. Source30 fitted upper hidden corners are~6px from coarse guesses and need hand-foreground masks.

Release63 is the requested integration event. Final source-fit center590.388,745.630 differs from requested seatcenter590.567,742.892 by(+0.180,−2.738)px. JSON supplies a translated source-basis target proposal but does not silently apply it. Bind an actual server-issued card to box1-issued. No source rank/suit is part of this artifact.

The complete draft below now includes extraction9–17; source-specific cleaned actor/finger masks remain pending. Do not hide the shoe pickup by starting playback18 or claim uncertain9–13 corners are measured. Mask preparation should use these quads only as paper bounds, never as automatic skin erasure masks.

## Complete draft added

issued-card-trajectory-complete-draft.json now supplies all97nativeframes: no card0–8, inferredpickup9–17, source-constrained18–63, stationary63–96. Source9–13 footprint merges with shoe and hand; implementation poses are explicitly inferred8–12px, and11 visiblepip coverage remains imperfect. They are NOT accepted observedgeometry.14–17 direct edge fit replaces rejected opticalflow undersizing. Do not promote complete draft solely because its framecount is complete. Actor/finger masks remain pending; sourceRGB is preserved.

Latest complete file: issued-card-trajectory-complete-v2.json. Source11 pip footprint measured at1262..1267,600..605; fixed plane extended through its visiblepaper support rather than leave an uncovered sourcepip.9–13 corners still8–12px inferred, source-shoe occlusion pending. Keep previous draft for audit only.

## Raw actor masks ready

`person-masks/0000.png` through `0096.png` are 97 native L8 Vision person masks, read directly from the original video with no RGB exports. `person-masks/receipt.json` records all hashes and exact native timestamps; maximum PTS error to frame/24 is zero. `generate.swift` reproduces them. These are raw actor segmentation only: table/lower-torso bleed and a disconnected roomlamp fragment remain. They are not cleaned R or hand-foreground G; do not use the paper quad as a skin eraser. Source RGB remains unchanged.
