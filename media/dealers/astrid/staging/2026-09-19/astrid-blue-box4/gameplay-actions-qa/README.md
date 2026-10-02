# Box 4 v1 added-card routing

Preview: `http://astridbluebox4.localhost:4190/?dealer=astrid&table=blender&astridBlue=box4`.
Verified in an isolated local guest runtime on4199, not the user's database.
No new generation or media bytes. Moving Box4 size0.80, settled1.25 unchanged;
split hands use separate compact fans. The dealer's existing clip now repeats
for its own opening pair and subsequent draws only in this opt-in preview.

`runtime-observations.json` contains DOM observations aligned with captured
screenshots. These establish routing and card visibility; the contact images
were also visually inspected.

- `hole-card-contact.png`: dealer take, faceDown true, hidden card has no rank.
- `split-complete.png`: separate8S/3D and8H/2C hands after both filmed split deliveries.
- `split-double-contact.png`: third card5H added to a split hand, moving scale0.80.
- `hit-contact.png`: normal Box4 hit3D on5S/2H.
- `dealer-third-contact.png`, `dealer-fourth-contact.png`: filmed4S and6H draws.
- `settled.png`: dealer21, player10, balance980, totalbet0 after the5 test stake.

The split test also confirmed an added4D on the second hand; that capture was
interrupted, so no complete split-hit motion capture is claimed. Its added-card
route is shared with the filmed split double, and covered by routing tests.
The last hit/dealer round was captured continuously from hit through settlement.

Limits: the existing actor clip still lands at its photographed contact point,
then the settled cards fan into their hand slots. This change does not solve
the existing source/idle joins or add new choreography for each split-hand slot.
Only Box4 and dealer cards gain repeated-film routing; other seats retain
their existing behavior.
