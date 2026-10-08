# Shared blackjack integration review, 26 September 2026

The deployed Scout demo is `astrid-lipsync-demo-2`, baseline `1b3b18d`, served by
`astrid-scout-demo` on port 8620. It embeds the Croupier blackjack engine under
`vendor/croupier`. The unrelated Scout fantasy game-server does not drive this
blackjack table. No changes were made to either older Croupier checkout.

## Findings and changes

- Shared tables accepted and evaluated PP/21+3 but omitted the private client's
  side-bet announcement and winner effects. Add recorded sidebet_2 (which does
  not incorrectly claim immediate wallet credit), owner-specific win effects,
  and visible side-bet returns. Existing engine settlement credits sides at
  round end, once, including after a split.
- The shared client never called the main win effects. New settlement receipts
  trigger the winner's chime once, with a larger chime for a winning natural.
  Polls, refreshes and another player's win must not replay it.
- `LAST RETURN` persisted from the preceding round while new hands were shown.
  During an active round it now reads `PREVIOUS RETURN`. A per-player receipt
  stores round ID, hands, all stakes, total returned and net result in the same
  SQLite transaction as the payout. The results panel separates main/insurance
  return from side return. Nonparticipants retain their previous return.
- A server-owned 60-second decision/insurance deadline replaces the invisible
  90-second limit. The timer begins after the presentation plan, survives refresh,
  and auto-stands or declines insurance at expiry. This is blackjack, so no
  `check` action exists. The 20-second betting clock remains server-owned.
- Shared videos now calculate their seek position when loading actually finishes,
  rather than using an offset frozen before the load. Frame callbacks correct
  drift over 400ms and skip obsolete clips; seeking frames cannot move card art
  backwards. Clock offset accounts for half the request round trip, and older
  responses cannot rewind the snapshot. Returning to a visible tab resynchronizes.

## Verification

`node --test test/*.test.mjs`: 51 passing tests, including the existing 197
shoe/service assertions. New deterministic regressions cover:

- Lost hand + $1,000 natural blackjack + lost side bets: $2,500 returned, with
  a second player's winnings excluded. Receipts survive restart and next round.
- All three Perfect Pairs tiers and all five 21+3 tiers, including ace-high and
  ace-low straight rules and the invalid K-A-2 wrap.
- Combined $5 Perfect Pair / $5 suited trips pays $635 in sides exactly once
  across split and restart; main pushes are accounted separately.
- Double charges one extra original stake; player bust still loses to dealer bust.
- Server timeout before/at the 60-second boundary and after restart.

`browser-check.mjs` runs two isolated Chromium sessions at 1440x1000 and
390x844 on local port 8632, using `/tmp/astrid-game-review-20260926.sqlite`.
Only this disposable database is seeded with deterministic cards. Provider
welcome generation is disabled. Screenshots and browser-result.json record
separate wallet returns, owner-only WebAudio chime scheduling, visible mobile
countdown, side-bet labels, and main blackjack settlement. Scheduling oscillators
verifies application wiring, not the volume of a physical speaker. The second
observed round returned $12.50 on a $5 natural and triggered one new blackjack
chime. Neither round produced browser page errors.

`buffering-check.mjs` injected 1,700ms into the first deal video load at mobile
size. The first sampled playback position was 1.820603s against a server
position of 1.852s: 31.397ms drift. See buffering-result.json. This verifies
catch-up after loading in that run, not continuous device-level smoothness.

## Limits

The historical $5,800 round in the supplied screenshot was already replaced in
live room state. Read-only inspection found no retained hand history from that
round. Its exact cards/ownership/payout cannot be reconstructed. The matching
reported scenario passes at $2,500; this is not proof of the historical cause.
New receipts make subsequent reports traceable. No existing player's balance was
changed to compensate for an unverified historical discrepancy.

Mobile screenshots are Chromium emulation, not an iPhone hardware or Safari
performance acceptance. Existing filmed lipsync quality was not regenerated or
certified. No production deployment or real-user wallet mutation was performed.
