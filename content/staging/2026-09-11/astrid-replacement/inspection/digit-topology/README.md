# Connected distal digit regions

Read-only analysis of original-pbr-body-rig.blend. Original vertex IDs, coordinates, topology and source bytes are unchanged. Coincident vertices within 3 micrometres are joined only in an analysis graph. Region membership is obtained from connected components after anatomical cuts, never nearest-chain ownership.

connected-regions.json gives each digit's vertexIds, boundaryVertexIds and inwardGeodesicMetres (same order as vertexIds). Boundaries have distance zero; use a smooth inward blend from Hand to digit weights. Regions are mutually disjoint and distances finite. This is a conservative distal partition; proximal palm remains Hand and is not a claim of complete anatomical root segmentation.

Four fingers separate at left Z < 0.867 m and right Z < 0.864 m. Thumb planes advance along measured MCP to IP until the tip component disconnects from the palm/finger components. Earlier cuts that retained other fingertips were rejected. The selected thumb region is over 72 mm from other fingertip landmarks. Full cut trials and source SHA are included.

connected-regions.png shows front orthographic source vertices and cut boundaries. Visual review confirms five distinct distal digit regions per hand, with palm excluded. This diagnostic does not itself validate flexion: rerender the resulting weighted candidate at the identical moderate pose and inspect actual skin before approval.
