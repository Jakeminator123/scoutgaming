# Shared table and direct felt entry

Players tap the actual betting boxes on the felt. A checkmark identifies each selected box. Confirm boxes opens the name field; Join table reserves the boxes atomically and unlocks betting. Chips are hidden until entry completes. Reserved boxes show their owner's name and cannot be used by another guest.

The link's `session` parameter selects a shared room (default `astrid`). Each browser cookie identifies an individual guest and wallet. The server owns the shared shoe, bets, 20-second betting deadline, turn ownership, insurance choices, split draws, settlement, and clip timeline. One guest's refill and payout never change another guest's balance. Persistent request IDs prevent duplicate mutations. A 90-second decision deadline recovers an abandoned turn.

The active page uses English without em dashes. Existing felt projection, card tracking, chip stacks, palette, and sound controls remain in use. Recorded game lines follow the server's clip timeline. A first-time guest queues "Hi NAME, how are you today?" through the existing Cartesia/RunPod voice path. Provider failures leave a clear text welcome rather than pretending audio played. Local QA disables that provider path.

## Validation

- `node --test test/*.test.mjs`: 36 passing tests, including shared ownership, concurrent betting, separate balances, split/payout persistence, per-player insurance, deadlines, and isolated rooms.
- Browser: selected boxes directly on the felt; confirmed selection; name entry; chips hidden before entry and available afterward.
- Browser: Kevin and John joined the same session using separate cookies; both names and owned boxes appeared; simultaneous bets were accepted and shared. A synchronized opening round showed identical cards and insurance offers. Timer was absent during dealing.
- Further two-browser round QA was interrupted when preview tabs were closed. No claim of a fully observed two-player settlement in this pass.
- Personalized spoken welcome is wired but not exercised locally because the local preview intentionally disables paid providers.

## Files

`server/shared-table.mjs` is the shared room coordinator. `public/shared-table.js` consumes its clock and snapshots. `server/table-service.mjs` preserves existing cookie/origin handling and the older private API. `public/table-boxes.js` implements felt selection and ownership. `vendor/croupier/shoe-game.mjs` adds independently selected insurance boxes to the existing game engine.
