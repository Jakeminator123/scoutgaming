# Dragge English speech bake (2026-10-08)

Builds Dragge's speech films, `media/dealers/dragge/runtime/presentation/repliker/`, from the lip-synced English
takes of 2026-10-08. Each take is a green 1080×1920 film with sound: Dragge's cloned voice (ElevenLabs) given to
MuseTalk on RunPod Serverless with the avatar `dragan_vila2x`, made from his KLARA `VILA.png`. The takes were handed
over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/` and are not tracked; their sha256, size and
frame counts are in `receipt.json`, and `build.py` refuses any other bytes. The texts come from
`dragge-voice-lines.csv` (sha256 pinned in `build.py`), the list the voice was generated from.

## Files here

| File | What |
|---|---|
| `build.py` | the bake |
| `receipt.json` | inputs (takes, text list, lip-sync input wavs), the deal bake, plate and rest still it used, per-film checks and every output's sha256 and size |
| `takes.md` | one take record per film (`lab/docs/templates/media-take.md`), filled in as far as automated checks go |

## Recipe

1. `<line>_1` becomes `repliker/<line>/<line>.mp4`, the standard of family `dragge/<event>/<line>`. `<line>_2` and
   `<line>_3` go to `repliker/<line>/variant/`. The 15 extra takes (`greet_*`, `remark_*`, `banter_1`, `table_*`)
   have no trigger in this repository and are not baked.
2. Decode, key and composite with the deal bake's own code: `../klara-bake/build.py` is loaded by path and must
   match its pinned sha256, and the plate is its `darkhall.png`. Same BT.709 decode, the same five-tap key and
   despill, the same plate, so a speech film and a deal film start on the same picture.
3. Encode the picture like the deal bank (libx264 crf 12, preset slow, yuv420p, BT.709, tv range, 24 fps,
   faststart) and copy the take's AAC stream packet for packet (`-c:a copy`).
4. Write `repliker/bank.json` with the exact English text of the 17 standards, published as
   `/dealers/dragge/audio/en/bank.json`, which the rehearsal panel (`?rehearsal=1`) reads. Variant texts are in
   `repliker/README.md`, `receipt.json` and `takes.md`; they are not rehearsal lines.

Reproduce into a new directory, then compare with `receipt.json`:

```
python -I build.py --takes <croupier-dragge-live/public/media/dealers/dragge/repliker/en> \
  --lines <dragge-voice-lines.csv> --voice <voice/en-wav> --out <new directory>
```

## Checks (receipt.json, films[].checks)

- 51 films of 51–121 frames (2.1–5.0 s), each with one H.264 and one AAC stream, frame counts equal to the takes.
- Sound: every audio packet of every film equals the take's (ffmpeg framemd5: timing, size and MD5 per packet);
  both streams start at 0.000 s, as in the takes. The picture runs 0.04–0.08 s longer than the sound, as in the takes.
- Frame 0 against `rest.png`: 47.34–47.36 dB PSNR; last frame: 47.22–47.33 dB. The deal films' frame 0 is 46.3 dB.
- Encoded against composited frames: 48.7–49.7 dB.
- Green fringe: no pixel in any frame has green more than 20/255 above red and blue where the plate does not.
- Voice span (information for the reviewer, not a lip-sync measure): 0.22–0.38 s of silence before the voice and
  0.46–0.80 s after it.
- Looked at: face crops at six points of `greeting`, `blackjack` and `bust_2`, full frames of `dealerbust` next to
  the first and last frame of the deal film `deal_pos4`, and mouth sharpness and lip colour measured over all 51 films.
- Two runs of this `build.py` into new directories gave identical films, `bank.json` and `.gitkeep` files (ffmpeg
  8.1.2, libx264 core 165 r3222, numpy 1.26.3, OpenCV 4.8.1, Python 3.11.11). The README template changed between
  them; the committed `README.md`, `receipt.json` and `takes.md` are from the second run.

## Seen, not changed

- While he speaks, the mouth area is softer (Laplacian variance 24–25 % lower in every film) and the lips paler
  (red minus green 7–10 lower) than in the still. That is MuseTalk's mouth in the takes; each take eases into it
  over 3–4 frames and back over 5. The bake does not change it.

## Not done

- Visual lip-sync approval of every film: `takes.md` marks each take **ogranskad** with the reviewer fields empty.
- Browser rehearsal on `/blackjack?lane=mobile-phone-dragge&rehearsal=1` with two consecutive plays per line, on
  phone and desktop. The variants are not reachable from the rehearsal panel; they need a Studio media policy entry.
- `chatter1` and `chatter2` are baked, but the game does not call them and `/api/presentation/select` accepts only
  letters in a line id, so they cannot be played yet (the same holds for Astrid's).
- Swedish: the catalogue has one text and one film per line id and no language field, so the Swedish takes stay out.
- Blob publish and `media/blob-index.json`.
