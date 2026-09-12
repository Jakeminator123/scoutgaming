# Bounded cheek reconstruction

`repair.py` imports the untouched provider GLB and estimates local quadratic curvature from the surrounding cheek surface. It blends corrections into two bounded patches, caps displacement at 0.006 source units and recalculates only the affected corner normals. 2,240 native vertices move. Eyes, lips, hair, neck, clothing and the source file are unchanged.

The saved `astrid-surface-repair.blend` remains editable and packed. `astrid-surface-repair.glb` retains the three original embedded material images byte for byte. `render.py` produces `front.png` with the same native camera and lights as the prior assessment.

The smaller Laplacian trial in `../face-cleanup/` did not remove the visible cheek damage. This reconstruction removes the jagged crease pattern in the native front render, but broad cheek shading remains visible under WebGL lighting. Neither result establishes likeness or animation acceptance. No rig or game integration is included, and the original can be compared directly in `../source-viewer/`.
