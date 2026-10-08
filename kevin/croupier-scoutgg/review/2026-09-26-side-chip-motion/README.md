# Side-bet chip motion

69 tests pass. `node tools/check-side-chip-motion.mjs` ran against a disposable
local database, with provider calls disabled, in Chrome at 390x844 and 1280x900.
The deterministic two-player round checked reveal timing, losing side chips
fading to zero opacity while the main wager stays visible, winning stacks of
26/101 wager-unit chips (12 visible layers maximum), owner-only notifications,
wallet settlement 985 -> 1620, next-round cleanup, subsequent blackjack and
no notification replay on refresh. Screenshots show mobile and desktop layouts.
The visible stacks are bounded for performance; the top amount is total return
and the label underneath is profit. Payout mathematics is unchanged.

This is browser viewport testing, not a physical-phone performance measurement.
