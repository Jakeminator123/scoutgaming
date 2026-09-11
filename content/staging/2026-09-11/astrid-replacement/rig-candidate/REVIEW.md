# Actual Chrome appearance failure — 11 September 2026

**Rejected by the user. This is preserved diagnostic evidence, not a realistic Astrid delivery.**

The live isolated game was inspected at `http://astrid3d.localhost:4204/?dealer=astrid&scene=rigged-review&rehearsal=1&recordproof=1`. The Chrome extension timed out after reconnection, but native Chrome controls opened the correct tab and triggered the in-game save button. The saved image is the actual Chrome WebGL canvas (no UI or audio), not a Blender render or a substituted mockup.

Captured frame: `evidence/chrome-1789154449423145000.png`, SHA-256 `65f5ed00ff10db284bcab7d1b6bf4c06c96d0ded18184a4a56bbc4cba3763ab6`. The receipt is beside it. The private game loaded hand trial V1, whose deformation was already rejected. No dealing acceptance can be inferred from this still.

The source conversion lost facial/lip/eye definition and produces a solid grooved hair mass. The actual game adds a hunched pose, lowered head, harsh facial shading and flat dark suit. These fail the canonical photographic reference at `assets/blackjack-3d/reference/astrid-canonical.png`. Correcting light alone would not create the missing eye, mouth, hair or cloth structure. See `../inspection/APPEARANCE-REJECTION.md` for the independent source review.

## Next work and boundaries

Stop finger/animation investment on this source. The next candidate must first prove Astrid's face, hair, suit and natural resting pose under a matched seated camera. Compare the actual rendered asset, not only its reference image. It must include independent eye/oral anatomy and controllable facial deformation before speech work; preserve separately animated hands, cards and props. A convincing generated image does not demonstrate a usable 3D character. Do not spend another full-body generation batch or describe photorealism as guaranteed.

No source, runtime, rig or default/public dealer was promoted. Original media, wallet, backend rules and other dealers were not changed by this trial. Facial rigging, lip sync, natural dealing, physical mobile QA and full-round visual acceptance remain open. CAC-2/CAC-4 remain In Dev.

## Reproduction harness

`prepare-review-runtime.py` copies source modules to ignored `runtime/`, links existing asset folders, and installs the private capture panel. Re-running starts from fresh top-level modules, so render listeners are not duplicated. A `runtime/public/candidate` link selects the preserved rejected trial. It is only for diagnosing this failure, never an approved default.

The isolated server uses its own ignored database and guest demo funds. `evidence-server.py` accepts fresh PNG/WebM output from the exact local preview origin and writes unique files. The screen recording controls are explicitly silent. Browser profile/download history is not used. No server logs or local database credentials belong in Git.

Existing dealer sync audit passed its baseline with the previously documented Amira/Mei gaps; it does not validate this character. The checkpoint hook output is saved locally. This delivery preserves a failed attempt, not completion of the user's requested game.
