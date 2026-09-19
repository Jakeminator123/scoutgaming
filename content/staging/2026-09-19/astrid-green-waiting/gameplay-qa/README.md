# Waiting idle QA

Isolated guest table `http://astridboxright.localhost:4190/?dealer=astrid&table=blender`. The green waiting clip (job 15777d5f, 121 frames) replaces the frame-96 still and the plain elevated loop while Astrid waits. Segments (measured from head yaw, see `../motion/`): base 90-120, glanceLeft 0-41, glanceRight 41-90, full 0-120; ready-pose frames 0, 41, 90, 120.

`result.json` holds the 62 s segment log observed through `canvas.dataset.idleSequence` (the same names are logged to the console as `[idle] <segment> <start>-<end>`), the screenshots of a base and each glance moment, and one round: Deal Now held the idle at base frame 120, the box-5 take and the dealer upcard take played, the idle resumed with base, hit/stand, settlement, back to bets. `dealer-sync.txt`, `pre-commit.txt` and `focused-tests.txt` are the repository checks.

Not visual acceptance; see the caveats in `result.json`.
