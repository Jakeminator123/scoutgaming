# Editable collection sweep

Open `astrid-collection-sweep.blend`. Its active timeline gathers sixteen independently editable neutral card helpers into one stack. The original twelve body actions remain available in the Action Editor, alongside `Collect_All_Cards_Sweep_Study`. The sixteen card actions are separate and synchronized through NLA tracks. Existing wrist/foot IK controls remain available; set their IK property to 1 for manual control.

`astrid-collection-sweep.glb` contains the single synchronized collection clip, the current rigged dealer geometry/materials, and sixteen independent card nodes. It includes the reviewed oral and posterior-neck corrections while preserving the original motion. The cards have neutral materials and contain no game card values. Blender's IK editing controls stay in the native project.

The source samples cover all seven seats and the dealer's cards. `native-verification.json` compares all 268 native frames, `collection-export-verification.json` verifies every exported frame and preservation of original geometry/material/skin data, and `packed-verification.json` records reopening the packed source. Body GLB time follows the established frame/30 convention; the first pose is at 1/30 s.

This is an editable motion delivery. Photographic likeness, oral animation quality, and final visual acceptance of the whole game remain separate. Original sculpt/generated sources and the previous twelve-action package are preserved in the sibling folders.

For the local exported-animation review, open `/collection-export-review.html` on the development server. The viewer plays the GLB's animation directly, without the game's motion solver.
