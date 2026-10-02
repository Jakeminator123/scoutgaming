# Slide contact candidates and endpoint comparison

No public integration, generation, actor warp or contact approval. `extract.py` reads actual native source pixels; results in `observations.json` are **candidates**, not a playable manifest.

## Endpoint remains inconsistent

Both `low-turn/anchor.png` and `landing-planar.png` are1344x752. Uniform fit into1920x1080 uses1.42857143 scale plus vertical padding. Visible white-paper convex hull area is1986.7px² for the anchor versus3524.5px² for landing: **1.774x**, still incompatible with the intended flat rigid prop under the game orthographic camera. Anchor edges are approximately56–60px and33–40px; landing visible right edge52.9px and bottom67.2px. Landing top-left is finger-occluded and the hull has five vertices, so do not invent a fourth hidden corner or compare five edges as physical sides. See `anchor-comparison.json`. **Do not generate another slide from this mismatched pair.**

## Native n0–54 evidence

`observations.json` binds `low-turn/slide.mp4` SHA,1920x1080 native dimensions and every source frame n0–54. It contains:

- actual bright paper boundary convex hull / simplified polygon;
- a connected visible-skin candidate nearest the observed paper center, both native and normalized coordinates;
- `contactMeasured:false` and explicit confidence/missing state.

All55 frames produced candidates; none were silently interpolated. Inspected all55 annotated outputs in `candidate-review-0.jpg` through4. Red candidates follow the visible fingertip/paper junction approximately: n0[1075,620], n12[1059,639], n24[1025,680], n36[979,743], n48[955,781], n54[949,791]. These are image-boundary estimates, not pressure/contact sensors or certified correspondence to the same finger.

n0–31 primarily follows the extended index fingertip; n32–54 the hand spreads and the chosen lowest/nearest visible finger can change. Allow several pixels uncertainty from mixed skin/card pixels. The paper hull spans finger-occluded portions and can absorb nearby bright table lettering when touching the card; use it as an inspected removal-region candidate, **never as measured hidden corners or a final foreground mask**. No release event is established before54: fingers remain over paper.

## Bounded authored prop path

Use the canonical game's fixed physical card size and plane orientation, with constant projected area. Place a nominated prop contact point under the reviewed fingertip trajectory by rigid translation only; orientation stays explicitly authored until more than one stable measured contact/edge establishes it. Do not derive prop scale from this growing source hull. Preserve the actual actor and all visible fingertip RGB using the independently generated person matte plus local finger matte. Remove original paper from both actor layers, allowing canonical game felt/text to show beneath. Inspect n28–38 closely because the hand changes from index push to multiple fingers and a single point cannot prove the wider grip.

The proposed authored prop is a feasibility preview. Real game calibration still requires source camera registration, reviewed finger identity/contact at the chosen prop point, full source-card removal, server card identity, and persistent landing through return/next pickup. No `measured:true` or visual-approval fields are emitted by this extraction.
