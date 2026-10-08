# Split cards remain on the table

The server retained both hands, but `createGameCards.render()` selected just one
hand per seat and removed every other draw from the SVG. Changing focus therefore
made already-dealt cards disappear and recreated them later.

The renderer now keeps every visible server draw in every hand, with a separate
numbered total and an active-hand highlight. The receiving hand uses the existing
filmed landing. Other hands occupy narrow lanes within the same seat and move
between those lanes over 220 ms when focus changes. Split fans overlap vertically;
normal hands retain the approved diagonal fan. Card dimensions remain 63 x 85.
Three/four split hands use two compact rows. A pending draw belongs only to its
receiving hand, so it cannot push cards in a sibling hand. No engine rules, draws,
wallet operations, source video, or face tracking were changed.

## Verification

- Reproduced the previous bug in two renderer regression tests before the fix:
  the second original card was removed at split and the sibling hand was absent.
- `node --test test/*.test.mjs`: 30 tests pass, including original engine/service
  checks and new retained-node, split-arrival, four-hand reload/collection, fixed
  dimensions and neighboring-seat bounds checks.
- Rendered local test used an isolated SQLite demo wallet and a seeded shoe.
  Observed 8 spades / 8 hearts before split; afterwards 8+3 and 8+2 were both
  visible with totals 11 and 10. Hit produced 19 in hand 2 without moving hand 1.
  The rendered settlement retained all six player cards and three dealer cards:
  hand 1 = 21, hand 2 = 19, dealer = 21; return $5 and balance $995.
- The betting countdown remained hidden through the split round.
- Four-hand coverage and double-after-split are automated checks; the visual
  check above covers the two-hand center-seat case, not every seat/four-hand video.
- Local QA uses disabled external AI credentials; no paid generation was invoked.
