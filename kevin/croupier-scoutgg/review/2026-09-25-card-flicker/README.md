# Stable card stock and release handoff

The dealer's final source frame (64 at 24 fps) changes from cool white to neutral
white. The old colour threshold then loses the top of the card: its measured
top-left corner jumps from y=-43 to -15.61. A black replacement made the missing
paper especially visible. The supplied back PNG also has transparent padding,
so it needs opaque card stock underneath it.

The renderer now stops using that moving-paper mask at the measured finger-release
frame (dealer 51; seats 1–7: 68, 63, 64, 64, 60, 60, 67). From release through
the clip boundary it uses the same fixed 63×85 card. While held, the measured
finger contour still clips the artwork, with a small opaque edge covering the
source's white fringe. The back asset is preloaded and has opaque black stock.

Opening-round refreshes now insert only a new or genuinely reordered draw into
the SVG. Existing card/image groups stay attached instead of being removed and
appended on every reveal. Size, contact timing and diagonal fan are unchanged.

Regression checks cover existing-node continuity throughout an opening/reveal,
opaque private-card stock, and all eight destinations remaining identical from
finger release through the final frame and next source. The browser review page
now supports card 1 and a hidden dealer card for repeatable inspection.

`source-dealer.jpg` and `source-4.jpg` are crops of the original source frames.
`black-release.png` and `black-final.png` show the production renderer over the
dealer source at release and its formerly broken last frame. Source MP4s and
card size were not modified. No generation credits were used.

Browser check: an isolated demo opening dealt all seven seats (16 cards total)
and reached insurance with the hidden dealer back intact through the following
speech and idle clips. `opening-seven-seats.png` records that state. The user's
round was not acted on. All 23 Node tests pass, including the existing 197
shoe/service checks. This checks the opening and release path; it is not a claim
of a newly completed full gameplay round or perfect generated hand anatomy.
