# Dealer cards stay on the felt

The playable game used the player fan for Astrid's own hand. It moved old cards up by as much as 110 source pixels, over her filmed resting hand. Dealer cards now spread horizontally from the original (540, 895) landing point, with a maximum 180-pixel spread. The card size, incoming face tracking, contact/release timing and player/split layouts are unchanged. Her total follows the left edge of the wider fan.

The existing contact review page now loads its JavaScript as an external module so it works with the game's current `script-src 'self'` policy.

## Verification

- `node --test test/*.test.mjs`: 97 passed; output in `tests.txt`.
- Layout regression exercises 1–22 dealer cards across 76 source frames. Complete card footprints stay within x=328.5–571.5 and y=852.5–937.5; incoming cards retain the original landing point.
- Renderer regression covers upcard, opaque hole card, reveal, subsequent draws, total placement, node identity, source handoff, restored state and collection. Player cards retain their positions.
- Rendered `/review/card-contact.html` on local game port 8642: six cards before/after at source frame 51; contact/mid-slide and normal playback checked. Two-card hidden-hole state also checked. `before.png` and `after.png` use the same original clip and renderer.
- Actual isolated playable table `/?session=dealer-felt-qa`: $5 demo hand, player 10H/3S, dealer 7S/8H/7C = 22. Opening deal, hidden hole, reveal, extra dealer draw, settlement, restored hand and next-round card clearing passed. Mobile viewport was 393 x 740 for the opening/settled round; `mobile-hole.png` records the hidden-hole state. This is responsive browser verification, not a physical iPhone performance test.
- Reopened game's dealer SVG positions: (480,895), (510,895), (540,895). Player positions remained (510,1089), (540,1115). Screenshots: `game-recovered.png`, `game-settled.png`.

Tested against a disposable local database with provider calls disabled. No production deployment is included. No matching current CAC issue was found; older motion/seat-routing tickets were left unchanged.
