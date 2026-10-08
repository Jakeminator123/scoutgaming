# Felt chip stacks

Restores the layered-chip appearance from Croupier's `stackChip()` in
`web/public/app.mjs` and `.chipstack` in `web/public/styles.css`, using SVG ellipses
in this demo's calibrated 1080 x 1920 table plane.

Main wagers and both side wagers now show chip edges, rims, a contact shadow and
one total on the top chip. Colours match the current chip rack. Each increase is
added to the visible wager's chip composition, so repeated $5 additions remain
separate discs. Decreases remove chips from the top. Restored wagers without a
local chip history use denominations reconstructed from their amount.

Visible height is capped at six main layers / five side layers to keep piles
within their betting targets. The full amount remains visible at the cap.
Unchanged amounts leave the SVG untouched during unrelated UI refreshes.

Verified in the rendered localhost game: a single $5 chip beside a six-layer
$125 main pile, plus four-layer $305 PP and three-layer $205 21+3 piles. Undo
removed the last $100 side chip, leaving $105 in two layers. Clear removed the
wagers; wallet stayed at $995. No new round or paid AI call was requested.
Existing 30 engine, rendering, timer and audio tests pass.

## Palette and demo refill follow-up, 26 September

Selector and felt chips now share one denomination palette, with the same
45%/25% radial light position and 85% radius. Side wagers use the same shader
colours as main wagers. The production-renderer comparison is available at
`/review/chip-colors.html` (no API calls or wallet writes).

Browser verification covered all six denominations in the selector, three-chip
main piles, PP and 21+3 piles. Computed gradient stops matched each selector's
colour/shade, and every SVG gradient reference was distinct. Thick edges and
felt projection remain in place.

The new `+ $1 000 demo` button adds a fixed server-side demo credit without
changing cards, shoe or wagers. The browser balance moved from $495 to $1,495
while the existing hand, $500 wager and 402-card shoe remained unchanged.
31 tests pass, including refill persistence, duplicate requests after another
refill/restart, session isolation, stale versions and credit during a hand.
