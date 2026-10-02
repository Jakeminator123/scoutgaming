# Seven-seat physical reach generation — 2026-09-17

Goal: Astrid physically deals one card from the shoe to each of the seven existing seat positions (isolated-game-targets.json), instead of legacy/glide delivery.

Method: start image = camera-locked ready pose n000 (start-ready.jpg, upload 5962e894). End images = far-left-endpoint renderer (127.0.0.1:4189) with the real rendered card quad per box (box{N}-endpoint.jpg). Model kling3_0 std, sound off, start+end frame. 1280x720, 24fps.

## Round 1 — 3 s, 4.5 credits each (7 jobs, 31.5 credits)
| box | job | verdict |
|---|---|---|
|0|8e4689e0|FAIL — card released early, slides by itself|
|1|d9c797a1|FAIL — card flies to target without hand|
|2|a9fa1da6|PASS candidate — hand carries card to target, releases there|
|3|0f5d719c|PASS candidate|
|4|e1a12d04|PASS candidate|
|5|b0753d65|FAIL — card teleports at end|
|6|03b29fb6|FAIL — card teleports at end|

## Round 2 — 5 s, 7.5 credits each, continuous-contact prompt (4 jobs, 30 credits)
| box | job | verdict |
|---|---|---|
|0|ac2fa366|PASS candidate — long lean, hand in contact to far-left target (box0-reach-v2.mp4)|
|1|d6f34e24|PASS candidate (box1-reach-v2.mp4)|
|5|66abe9fe|FAIL — card held at shoe until ~f85, then teleports|
|6|010802fc|FAIL — hand goes to viewer-left/centre instead of far right|

Balance after: ~1.9 credits (Scout Gaming Group workspace). Boxes 5 and 6 (right side, left-hand delivery) still need a working source.
None of this is integrated into the 4190 runtime yet; "PASS candidate" = motion visually plausible in frame review, not mask/registration/gameplay acceptance.
Review sheets: end-review.jpg, motion-review*.jpg.

## Gameplay review route (installed 2026-09-17 19:20)
`game-runtime/install.py` links box0/1 (v2) and box2/3/4 clips into isolated 4190 as `/astrid-seven/box{N}.mp4` and patches `flyFromShoe` in app.mjs with `tryAstridSeven` (game-runtime/bridge.mjs).
URL: `http://astridsingleseat.localhost:4190/?dealer=astrid&performance=staged&motion=smooth60&astridSeven=review&astridContinuous=off`
Behaviour: first card of box 0–4 plays the FULL-SCENE generated clip as a video layer under #table2d (z 19) at sourceFit registration; dealer canvases hidden meanwhile; DOM card revealed at clip landAt (box0 4.0s, box1 3.7s, box2–4 2.3s); legacy delivery for second cards, boxes 5/6 and dealer. Receipts as hidden `.astrid-seven-receipt` divs.
Verified headless 1200x655: two rounds, 10/10 clips complete, 2 cards every seat, no leftover video, dealer canvas restored. Screenshot midclip-box4-1200x655.jpg. Not smoothness/contact acceptance: cut from idle to clip and back is abrupt, baked table differs slightly from CSS table.
