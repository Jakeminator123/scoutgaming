# Edge blend for the keyed Astrid (takes + waiting idle)

Kevin 2026-09-19: keyed edges too sharp against the 3D environment. Render-side only, zero generation, no re-masking: `web/public/actor-edge-blend.mjs` adds one GLSL stage, `blendEdge`, to both compositors (the waiting idle's `actor-compositor.mjs` and the takes' painter in `performance-player.mjs`), so the dealer upcard, the box-5 take and the idle get the same treatment.

1. **Alpha edge softening**: the matte is eroded by `erode` px (8-tap min) and then feathered with a small gaussian of radius `feather` px (centre + 8-tap ring, alpha only). The cleaned matte stays the ceiling, so the feather softens inward and never regrows removed spill.
2. **Light wrap**: over the outer band (weight `1 - feathered alpha`, so 0 in the interior) the actor RGB is mixed by up to `wrap` toward the colour behind her. The Blender table canvas keeps no drawing buffer and the room plate is CSS, so a 96x54 scene capture is usually empty; the wrap then falls back to the wall tone above the rear rail (`--performance-rear`) and the felt tone below it.
3. **RGB never blurred**: the colour is sampled only at the pixel itself; hair and finger detail are untouched apart from the wrap.

Defaults `edge=1,2,0.15` (erode 1 px, feather 2 px, wrap 15 %), clamped to 0-4 / 0-6 / 0-0.6. `?edge=e,f,w` overrides; `?edgeHud=1` mounts three sliders; `window.astridEdge.set({wrap:.25})` tunes live. All GPU: per fragment about 45 matte reads, no per-frame CPU work beyond a 4 Hz canvas capture.

Evidence: `before-off.png` (`edge=0,0,0`) and `after-default.png` are the idle at base frame 104 in the same viewport; `before-after-crops.png` and `crop-*.png` are 2x device-pixel crops of hair, shoulder line, fingers on the felt and the hand at the shoe. `box5-mid-slide-edge.png`, `box5-landed-edge.png` and `dealer-landed-edge.png` show the takes with the blend on (frames 44, 65 and 58). Zero console warnings or errors; `dealer-sync.txt`, `pre-commit.txt`, `focused-tests.txt`.

Honest read of the crops: at these defaults the change is subtle, a slightly softer hair line and finger edges and a faintly toned outer band; it does not make the source look filmed in the room. The wrap uses the two-tone fallback, not the true pixels behind her, until the table canvas is captured with a preserved drawing buffer. Kevin tunes and reviews.
