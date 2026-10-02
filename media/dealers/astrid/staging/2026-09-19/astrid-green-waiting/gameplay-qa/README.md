# Waiting idle QA (combined base + glances)

Isolated guest table `http://astridboxright.localhost:4190/?dealer=astrid&table=blender`. Per Kevin's correction the idle is a combination: the eye-contact loop `2a721f7d` (193 frames, `review/astrid-eye-contact-idle/actor-packed.mp4`, the video already playing before) stays the base; the green waiting clip `15777d5f` contributes only glanceLeft 0-41, glanceRight 41-90 and full 0-120, spliced at the base loop boundary by the randomized scheduler with a rigid +15.3 px vertical offset measured between the two ready poses.

`result.json` holds the 90 s segment log observed through `dataset.idleSequence` (console shows `[idle] <segment> <job> <range>`), the base/glance screenshots (`combined-*.png`) and the round hold/resume record. `dealer-sync.txt`, `pre-commit.txt` and `focused-tests.txt` are the repository checks. Not visual acceptance; see the caveats in `result.json`.
