# Original-model inspection

Run with the installed bpy 4.5.3 runtime:

```sh
/Users/solvifyab/.codex/tools/astrid-blender/bin/python inspect_candidate.py /absolute/path/model.glb /absolute/path/new-output-directory
```

FBX and glTF are also supported. The output directory must not already contain `candidate-packed.blend`. The script preserves the supplied source file, imports without anatomy/rig/material corrections, packs the images, saves a separate native file, reopens it, and compares the inventoried geometry, UVs, skin weights, morph coordinates, bones, material nodes and image bytes. Missing/undecodable textures fail the operation.

The native source is saved before adding inspection lights/camera. The three PNGs show the imported pose under neutral studio lighting: upper body and both hand regions. They are not an actual seated game render. Default front looks along Blender +Y; `--front-angle` allows changing camera azimuth if the actual source orientation differs. Hand crops use evaluated visible character geometry, excluding hidden bone-control helper meshes. Inspect their framing rather than assuming the heuristic succeeded.

`--samples 8` is a fast framing check; default is 32. `--no-render` only packs and verifies the native file. Importer interpretation is not a byte-lossless cross-format conversion: preserve the original provider file and receipt independently.

## Verified smoke checks

`smoke-review/` contains images from the **old** `content/staging/2026-09-10/astrid-rig/astrid-generated.glb`, not the pending/rejected replacement job. Its source hash is in `inspection.json`. GLB import/pack/reopen comparison passed. An FBX exported from that old asset with embedded texture was also imported/packed/reopened successfully (`fbx-inspection.json`). The temporary native files listed in these smoke receipts are local test outputs, not deliverables or new accepted models.

All three final smoke images were visually checked. The test caught hidden bone-control Icosphere geometry contaminating camera bounds; these helpers now remain in the native source but are excluded from rendering bounds. Lighting was reduced before the final smoke so skin details remained visible, without changing materials. No realistic character or animation is approved by these checks.
