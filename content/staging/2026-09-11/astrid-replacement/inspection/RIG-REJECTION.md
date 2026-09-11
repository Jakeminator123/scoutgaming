# First body rig rejected; canonical source prepared

Rigging job `7e425dab-4e40-4a45-972e-a9cfb78ea961` returned `rig-source/provider-rigged.glb`, SHA-256 `283944a34f3921e9de220ba8af87ace0389f6cef69902684343b24d8fb0ab8c7`. It is preserved as a rejected provider result.

The result has 22 bones but no finger, eye or jaw joints and no morph targets. It replaced the three original PBR maps with one color PNG and a metallic factor of 1. It also contains a baseline action despite animation being disabled in the request. These facts are recorded in `rig-source/glb-intake.json`.

More seriously, the body skeleton is anatomically misplaced. Both knees lie near Blender Y = −0.135 m and both feet near Y = −0.139 m, although the model's legs occupy opposite sides of Y because this source faces +X. LeftHand lies almost at the body's horizontal centre. The Head joint is above the 1.73 m mesh. The same placements were verified in both rest data and the original evaluated pose; the returned action does not correct them. `rig-source/joint-rejection.json` preserves the actual positions.

Spatial alignment was investigated without editing either original: median residual 0.0011 mm, 95th percentile 0.0033 mm and maximum 0.9895 mm after a uniform similarity fit. All provider vertices are referenced by faces. Some foot vertices carry one-third RightHand weight, so these are not merely unused helper vertices. The weight-transfer attempt was stopped; **no transferred rig candidate was saved**. `rig-transfer/alignment-diagnostics.json` records this investigation. Close surface alignment does not validate the provider's skeleton or weights.

## Corrected input for the next rig attempt

`canonical-source/original-canonical.glb` is derived directly from the original unrigged Tripo GLB. Positions/normals are baked into metres, ground Y = 0, height 1.73 m and front +Z in glTF (−Y in Blender), with an identity node transform. Topology, UV bytes, material definitions and all three original embedded image byte sequences are preserved. Original files remain unchanged.

`canonical-source/normalization.json` contains the SHA and exact original-Blender-world → canonical-Blender-world matrix for the separately measured finger landmarks. `canonical-review/` holds the packed native source, reopen verification and three visually inspected renders. The front and both hands remain intact after normalization.

The possibility that the rigging service interpreted the +X-facing input as a front view is a hypothesis supported by the asymmetric/collapsed joint layout, not a proven vendor diagnosis. A corrected-orientation retry still needs independent bone, weight, material and deformation review. No gameplay or final realism approval follows from this normalized source.
