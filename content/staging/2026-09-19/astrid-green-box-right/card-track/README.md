# Box-5 take 6a378270: rigid card track

Source `6a378270-fc2a-4f14-972b-44820678ffa4`, 1920x1080, 97 native frames at 24 fps, SHA `6047a7be3e4b7714ff331fa810244015d452ea51acb642f7047562f7bd7cabe8`. Scope: the **first card to box 5 only** (Kevin's second correction; the folder name still says box-right because the clip was first tried on box 6, see gameplay-qa/README.md).

Kevin's rule for this install: **the replaced card must not change size.** `build_track.py` therefore models the card as a rigid rectangle whose apparent size is fixed to the rest pose (frame 96: 70.9 x 116.8 source px, corners `[[1277.7,729.6],[1347.4,719.1],[1401.9,823.0],[1331.1,832.8]]`). Per frame only position and in-plane rotation are solved, by least squares over whichever of the four magenta marker dots are visible. Corners are the dots scaled outward around their centroid by one ratio (1.4697) measured on the rest body.

| Frames | Pose evidence | Flag |
| --- | --- | --- |
| 0-8 | four dots, but the card is still inside the shoe; residual 24 px because the exposed portion does not match the flat model | card is `null` before pickup 9 |
| 9-14, 16-22, 31-35 | bright body min-area rectangle (blur or fingers hide the dots) | inferred corners |
| 15, 37 | two dots, rigid | inferred |
| 23-30 | **interpolated pose** between 22 and 31: the card is lifted and tilted between the hands, one marker under the fingers mismatches, residual 28-38 px | inferred, low confidence |
| 36, 38 | residual gate (8 px) rejected the fit; interpolated | inferred |
| 39-53 | three dots, rigid | corner 0 inferred |
| 54-96 | four dots, rigid, residual under 4 px | measured |

Authored events (take-config.json): pickup 9 (replacement first drawn as the card leaves the shoe mouth), release 58 (fingertips separate), land 59 (DOM card takes over at the filmed quad), rest 96. Fingers touch the card from 5; first felt contact about 33; slide stops about 52; empty hand back beside the shoe about 72.

## Apparent width sanity check

`apparent-width.png` plots the card's apparent width per frame: orange is the measured corner quad of the previous (non-rigid) tracker, magenta is the rigid pose. The rigid width is 70.9 px on every frame. The measured width is 34-59 px through the carry (9-22, the source card is foreshortened and motion-blurred while lifted), 57-61 px while it is lowered (31-35), and 67-73 px once flat (36-96). The orange spike to 118 px at 23-30 is a mis-detected marker, not a real size change. So: during the carry the rigid replacement is drawn about 1.2-1.5x wider than the filmed card in the same frame. That is the cost of the fixed size, recorded here rather than hidden.

The plane is treated as locally affine; the true PlateCam homography is not applied per frame, because the card never leaves the box-5 depth band by more than the residuals above.

## Reproduce

```
/tmp/astrid-a9mask-env/bin/python mask/build.py --take-dir .
/tmp/astrid-a9mask-env/bin/python card-track/inspect_contours.py   # raw sheets (paths inside assume this folder)
/tmp/astrid-a9mask-env/bin/python card-track/build_track.py --take-dir .
node build-take.mjs . --install
```

`annotated-sheet-*.jpg` cover all 97 frames (magenta = rigid quad, orange = measured quad, cyan corners = visible dots, yellow = inferred). `card-track.json` carries both quads, the pose, the per-frame residual and the width table. No generation, no source RGB change, no gameplay acceptance is claimed here.
