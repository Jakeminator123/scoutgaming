# Empty return cannot directly join adjacent-shoe ready

Inspected empty-return.mp4 n72 and low-turn/source.mp4 n0 at native resolution, and extract-edge.mp4 every3frames n0–72 as a possible existing bridge. No new hard-cut video or public changes.

Final empty-return receiving fingertips are approximately[869,567] after uniform mapping into1920x1080, versus approximately[1115,613] in low-turn/source n0. Roughly250px of real arm displacement is missing. Facial gaze is broadly forward in both, but that does not repair the arm pose. The former returns the right hand to viewer-left; the latter requires it next to the shoe. Empty-return never reaches this target; trimming cannot create a zero-frame join.

Old extract-edge starts at the left-hand rest and later moves toward the shoe. However, by the time receiving hand moves inward (~n27 onward), feeding hand has already extracted and visibly lifted red paper. Those frames cannot supply a clean empty-hand adjacent-ready bridge without changing the filmed action. No inspected existing frame window closes this gap honestly.

Required source change: a real empty-hand return from the reviewed slide's landing pose directly to low-turn/ready.png / low-turn/source first pose, preserving adjacent-shoe hand placement and forward gaze. Keep the game card as an independent persistent prop; exclude any generated source paper from actor mattes. Root owns generation. No amount of source-paper cleanup alone supplies this missing arm motion. Prior card-cleanup/persistence diagnostic remains useful for paper lifecycle independently.

## Same-index review and constant-prop coverage

`review-index.py` reviews n32–54 candidates against native crops and creates `reviewed-index32-54.json`. The selected points appear to remain at the same outer/index fingertip as the other fingers open; I found no substantiated frame where a manual coordinate change would improve identity continuity. Therefore corrections are explicitly[0,0], not gratuitously edited. Uncertainty stays4px (5px during32–35), contactMeasured remains false. An image cannot prove finger pressure or unseen contact.

`constant-prop-finger-review.jpg` shows every second native frame n32–54 using root's actual packed RGB/R-actor/G-finger source and exactly root viewer's fixed parallelogram (57,-7)/(27,31), rigidly translated under the candidate. The card artwork here is the labelled frozen SOURCE Q placeholder, not authoritative game art. Actor geometry remains unchanged.

Coverage finding: the same candidate point stays over the near card corner as the hand opens; the fixed-size prop does not visibly run away from the index in these inspected samples. However the existing foreground matte includes **pale, jagged source-paper residue under fingertips**, most obvious32–38 and still visible afterward. Changing fingertip trajectory will not remove that fringe and would risk breaking contact. Preserve the candidate trajectory for this staging experiment and fix local matte/source-paper contamination separately. This is a conditional coverage result, not final finger-matte or full-cycle approval.
