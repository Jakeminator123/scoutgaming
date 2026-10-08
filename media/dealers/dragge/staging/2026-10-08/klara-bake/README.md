# Dragge KLARA bake (2026-10-08)

Builds Dragge's portrait deal bank, `media/dealers/dragge/runtime/presentation/`, from the green-screen KLARA
delivery of 2026-10-07 (`KLARA_DRAGAN/produktion/`, MiniMax H3 takes; the delivery README is kept as
`media/dealers/dragge/source/provenance/klara-delivery.md`). The 13 green files are not tracked; their sha256,
size and frame counts are in `receipt.json`, and `build.py` refuses any other bytes.

## Files here

| File | What |
|---|---|
| `build.py` | the bake (one script for Dragge and Paow) |
| `receipt.json` | inputs, plate, script hash, per-film join, checks and every output's sha256 and size |
| `darkhall.png` | the plate, 1080×1920 (sha256 `33dbde8e…`), copied from the H3 preview game (`public/media/dealers/rooms-v2/darkhall.png`) |
| `rooms_v2.py` | the script that built the plate, provenance only; it is not run here |

The plate is Astrid's empty portrait room and table with the KLARA acrylic shoe moved to where H3's takes draw
from. `rooms_v2.py` made it from that game's `rooms/darkhall.png` (`1ff778e3…`), a shoe-less table from
`astrid-room-clean.png` (`3c3e24ee…`) and `rooms/noshoe-aligned.png` (`7f496ab5…`), and the shoe lifted from the
first frames of H3's previews (`preview-dragan.mp4` `fdbd84bd…`, `preview-paow.mp4` `6f46feef…`), masked with
the two `VILA.png` stills.

## Recipe

1. One film per take: `in_vila_till_redo` (28 frames) + `deal_posN` without frame 0 + `ut_redo_till_vila`
   without frame 0, so 80 or 81 frames from rest to rest. `deal_poshole` becomes `deal/deal_hole/deal_hole.mp4`.
2. Decode with ffmpeg as BT.709 to rgb24 (never through OpenCV's BT.601).
3. Key every frame with the dealer-layer key of the H3 preview game at scale 1:
   `alpha = 1 - smoothstep(0.03, 0.16, g - max(r, b))` on 0..1 channels, sampled as a five-tap cross
   (centre 0.4, four taps 1.5 px away at 0.15 each, bilinear, clamped edges). Despill
   `g = min(g, mix((r + b) / 2, max(r, b) + 0.01, smoothstep(0.6, 1, alpha)))`. No person mask and no
   largest-component filter, so the prop card and the shoe's dark mouth stay.
4. Composite `colour * alpha + plate * (1 - alpha)`.
5. For the `ut` part, the landed card from the deal's last frame is pasted into the plate under the dealer: the
   paper (white) or back (black) pixels at the seat, filled to the card's convex outline, widened 3 px for the
   keyed edge, minus skin, times the keyed alpha. Every film therefore ends on the rest pose plus the card on its
   seat, and the arm still covers the card where it passes over it.
6. Pipe rgb24 back to ffmpeg with `out_color_matrix=bt709`; encode like Astrid's bank: libx264 crf 12, preset
   slow, yuv420p, colorspace BT.709, tv range, 24 fps, faststart, no audio.
7. `rest.png` is `VILA.png` keyed over the plate the same way; `poster.jpg` is its upper 1080×1080 (JPEG q90).
   `kortpositioner.json` holds Astrid's landing centres with the 79×106 card and the frame each card lies still from.

Reproduce into a new directory, then compare with `receipt.json` (two runs here gave identical bytes with
ffmpeg 8.1.2, libx264 core 165 r3222, numpy 1.26.3, OpenCV 4.8.1):

```
python -I build.py --dealer dragge --delivery <KLARA_DRAGAN/produktion> --out <new directory>
```

## Checks (receipt.json, films[].checks)

- Frame counts 80/81, one video stream, no audio.
- Frame 0 against `rest.png`: 46.3 dB PSNR. Last frame against `rest.png` outside the card: 44.6–44.7 dB.
- The last frame shows the card on its seat (white, or black for the hole card). The pasted cards measure
  78–79 × 105–106 px, centred within 1.5 px of Astrid's centres.
- Encoded against composited frames: 48–49 dB.
- Green fringe: no pixel in any frame has green more than 20/255 above red and blue where the plate does not.
- Looked at: a contact sheet of eight frames per film, full-size crops of hair, hands, the card in flight, the
  shoe and every landed card at the end of the deal and of the film.

## Seen, not changed

- The plate has a dark patch left of the shoe's mouth (about x 760–820, y 710–760), from `rooms_v2.py`'s mouth
  fill. It shows in the rest still and whenever the hand is away from the shoe.
- The delivered last frame of each deal take is H3's REDO still with the card pasted in; its card is warmer
  (about 230/233/229 against 228/236/241 before), a small colour step where the deal part ends.
- Not done: the take records (`lab/docs/templates/media-take.md`), browser review on phone and desktop, and the
  check that the hand passing under already dealt SVG cards is acceptable.
