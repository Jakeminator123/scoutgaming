# Dragge – deal films (KLARA, baked 2026-10-08)

Portrait deal bank for the local presentation lane, baked from the KLARA green-screen delivery of 2026-10-07
(MiniMax H3 takes, `media/dealers/dragge/source/provenance/klara-delivery.md`). Same contract as Astrid's bank:
every film starts on the rest still and ends on it with the card on its seat, so the films play in any order.
How it was built and measured: `media/dealers/dragge/staging/2026-10-08/klara-bake/`.

## Format

| | |
|---|---|
| Films | MP4, H.264 (crf 12, preset slow), yuv420p, BT.709, 24 fps, **1080×1920**, no audio, faststart |
| Rest still | `rest.png`, published as `/dealers/dragge/rest.png`: H3's `VILA.png` keyed over the plate. Frame 0 of every film matches it at about 46 dB PSNR, not byte for byte |
| Poster | `poster.jpg` (`/dealers/dragge/poster.jpg`): the upper 1080×1080 of the rest still |
| End frame | the rest pose plus the stand-in card on its seat (white face up; black back up for the hole card) |
| Card | 79×106 px on Astrid's landing centres (`kortpositioner.json`); measured prop centres are within 1.5 px |

Each film is `in_vila_till_redo` (28 frames) + `deal_posN` without its first frame + `ut_redo_till_vila` without
its first frame. The dealer is keyed over the plate in every frame, and during the return the landed card is part
of the table under him.

## deal/

| File | Seat | Frames | Card still from frame |
|---|---|---|---|
| `deal_pos1/deal_pos1.mp4` | player 1 (far left) | 80 | 46 |
| `deal_pos2/deal_pos2.mp4` | player 2 | 80 | 46 |
| `deal_pos3/deal_pos3.mp4` | player 3 | 81 | 46 |
| `deal_pos4/deal_pos4.mp4` | player 4 (centre) | 80 | 45 |
| `deal_pos5/deal_pos5.mp4` | player 5 | 80 | 46 |
| `deal_pos6/deal_pos6.mp4` | player 6 | 80 | 47 |
| `deal_pos7/deal_pos7.mp4` | player 7 (far right) | 80 | 51 |
| `deal_posdealer/deal_posdealer.mp4` | dealer up card | 80 | 49 |
| `deal_hole/deal_hole.mp4` (H3 `deal_poshole`) | dealer hole card, black back up | 81 | 46 |

There is no flip, idle or speech film: turning the hole card falls back to the 2D path, the rest is the still,
and game lines are skipped for this bank.

## Known limits

- The hand is filmed, so SVG cards already on the table lie over it when it reaches past them.
- The delivered last frame of each deal take is H3's REDO still with the card pasted in; that card is a little
  warmer than the filmed one before it, a small colour step where the deal part ends.
- Visual acceptance (seams, card cover, phone and desktop) has not been done.
