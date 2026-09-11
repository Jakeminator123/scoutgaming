# Rejected hand trials — 11 September 2026

The user rejected the replacement character appearance after seeing the actual Chrome game render. Stop further rigging work on this source. See `../inspection/APPEARANCE-REJECTION.md` and `../rig-candidate/REVIEW.md`.

The two preserved trials use the corrected body rig with original geometry, UVs and three PBR images. Forty landmarks were measured on the new mesh. Each adds 30 digit joints to the 24-joint body rig. Both retain editable Blender files and GLBs; neither is approved for use.

- V1 (`fit-fingers-v1-rejected.py`): radial surface selection stranded outer thumb skin on the hand bone, producing flaps and spikes in moderate flexion.
- V2 (`fit-fingers.py`): removing the cutoff fixed one flap, but nearest-chain assignment split adjacent thumb/web skin between different digits and produced a new tear. The independent connected-edge inspection found 132 edges lengthening more than 12 mm.

V1 numerical fingertip contact at five samples passed. That is explicitly NOT evidence of an acceptable grip or appearance. Independent moderate-flexion images and edge diagnostics are under `../inspection/finger-flexion-review*/` and `finger-flexion-study*/`.

The collaborator preserved connected digit regions for future research in `../inspection/digit-topology/`. V3 was not implemented: the failed character appearance makes further finger fitting an inappropriate next priority. No face rig, speech animation or full-round realism acceptance exists on this source.
