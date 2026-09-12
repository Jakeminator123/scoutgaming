# Astrid source comparison

This viewer loads the exact new Higgsfield bust beside its photographic input. It does not load the rejected full-body rig from the private game on port 4206. Open http://127.0.0.1:4207/ while its local server runs.

Run from the repository root:

```sh
python3 -m http.server 4207 --bind 127.0.0.1 --directory content/staging/2026-09-12/astrid-closeup/source-viewer
```

Front resets the camera. Turn model rotates it; dragging also rotates it. Cheek repair switches between the untouched provider GLB and the bounded surface reconstruction, without changing the camera, lighting or material images. Downloads follow the selected version. Relative symlinks resolve to the preserved source, candidate and existing Three.js vendor files in this repository.

The loader verifies SHA-256 before parsing either model. The original is `1757bd0469cc338cfa7f6c4e3897d64d72eeed79393c9dd63591a94d61184ba1`; the repair is `09fd91c9f95f528583bd28bba0ace0b2f31e77ff202680440bcaac40fa4b9b7c`. All three embedded JPEG byte hashes match the original after export. Blender splits additional vertices at custom-normal boundaries during GLB export; the native source keeps 249,716 vertices and the export has 270,340 vertices.

The original and repaired models were loaded and visually inspected in the in-app browser. Rotation, Front and the model toggle were exercised. The new source still has inaccurate eyelid relief, solid hair, and no separate animated eyes, facial controls or body rig. The cheek reconstruction reduces the jagged damage in the native render; remaining broad cheek shading is visible in WebGL. This is a source review and bounded repair candidate, not photographic likeness approval or a finished game delivery. Public gameplay and dealer media are unchanged.
