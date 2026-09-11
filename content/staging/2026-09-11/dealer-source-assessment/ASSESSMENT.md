# Whole-dealer assessment — 2026-09-11

## Decision

Replace or substantially rebuild the visible character and authored performance. Keep the game state, table, card/contact targets, source-clock speech bindings and control adapter as integration infrastructure. Further collar-only iterations are not a credible route to the requested overall realism.

This is an assessment of the inspected assets, not a claim that generated 3D can never work. A new Higgsfield candidate is usable only after inspecting its actual geometry, materials and deformation in the game. No new generation was submitted by this task.

## Evidence

- Current packed sources were reopened and hashed: `native-inventory.json`.
- Original generated body: 91,278 vertices, 159,728 triangles, one 2,048 px texture, 24 bones and one baseline clip; no facial shapes. The current retained body has 83,123 vertices and 146,995 triangles. Density is not evidence of intentional deformation topology.
- The separate MakeHuman-derived facial source has 4,526 vertices / 4,500 quads and ten expressions plus Basis; the current subdivided face has 18,051 vertices / 18,000 quads. It can serve as a sculpt/anatomy starting point, but subdivision and photographic projection have not established likeness or realistic shading.
- Thirty finger bones were added using measured 2D landmarks and distance-based weights (`pipeline/prepare-dealer-rig.py:94`). This provides articulation, not verified knuckle/webbing/thumb anatomy or a natural card grip.
- The twelve body actions are baked procedural contact studies. `poseDealer` resets the rig and derives root displacement, lean, gaze and flattened hand orientation from progress; `dealer-motion.mjs` uses fixed phase fractions and eased paths. No professionally captured body/hand motion file or provenance was found in the inspected asset inventory. The source videos/face measurements are not equivalent to body motion capture.
- `round-overview.png` and `deal-sequence.png` sample the existing final-fit recording. The latter covers 178–184 seconds, including pickup, reach and return. These frames show the frontal stare, repeated reset posture and large torso reach; they do not by themselves prove temporal smoothness. The collaborating gameplay task is independently reviewing continuous motion.
- Compared with the Scout seated reference, the current game dealer has a sharper, more mask-like face and eyes, flatter hair, narrow rigid upper body and stiff extended hands. These dominate the view more than the small collar defects.

## Reuse versus replacement

| Area | Decision |
|---|---|
| Game rules, wallet demo, rounds, table coordinates | Reuse |
| Card ownership/contact/release events and media clock | Reuse and adapt to the new rig |
| Existing body mesh and clothing | Replace or rebuild as a coherent character, with intentional shoulder/elbow/hand topology and separate garment surfaces |
| Facial quad base | Optional sculpt starting point; current fitted identity, eye treatment and projected shading need rebuilding |
| Hair | Replace visible groom/material construction; preserve identity and side part from reference |
| Existing body action curves | Keep as test/contact scaffolding; author a convincing performance rather than preserve them as final animation |
| Original speech audio and 52-channel measurements | Preserve; map to the new facial rig with rendered checks |

## Smallest concrete next asset proof

One coherent Astrid dealer, in the black jacket and ivory blouse, matching the seated Scout reference. Deliver a native editable rig and embedded-material GLB. Include anatomically separated fingers and thumb, useful wrist/elbow/shoulder controls, a continuous neck, properly seated eyes/lids and a facial expression/viseme set with a documented mapping from the existing speech measurements. Use neutral base color plus actual surface response maps; do not bake the portrait's directional shadows into the final skin response.

Author one complete card action at the actual table: relaxed ready posture → pickup → credible two-hand transfer where needed → controlled delivery → release → natural return. Coordinate torso, shoulder, elbow, wrist, fingers, gaze and breathing. Preserve card contacts with constrained retargeting rather than forcing every hand into one flat pose. A captured performance is helpful but not mandatory; carefully authored animation can be used.

The first acceptance view is the whole seated dealer in the actual game camera and light, at normal playback speed, alongside the reference. Check the silhouette, face, hands, material response and complete action together. Only then expand to all seven seats, own-card/reveal/collection actions and all speech lines. This is a sequence toward the full scope, not a reduced final deliverable.

## Reference and generation handoff

- Identity, posture, hands and final camera intent: `assets/blackjack-3d/reference/astrid-canonical.png`.
- Full-body construction reference: `assets/astrid-3d/reference-front.png`.
- Neutral facial detail: `content/staging/2026-09-10/astrid-head-v2/astrid-neutral-reference.png`.
- No verified identity-matched true side/back photographic reference was found. Existing `groomed-side.png` is a render of the current model and must not become the identity target.
- Original Meshy job: `cc1a080e-8d37-4f3c-847d-5f70bf1c3125`, receipt `content/staging/2026-09-10/astrid-rig/generation-job.json`. It used a single A-pose image, standard model, ultra mode, 1.73 m, requested 80,000 polygons / quad topology, remesh/texture/PBR/rigging enabled and animation disabled. The saved source was imported from a triangulated GLB and has a single texture. GLB triangulation alone does not prove the provider ignored its quad option, and a PBR material can use scalar factors without separate maps. What is missing here is a delivered editable quad source and demonstrated realistic surface response. Do not repeat those settings and assume the result is production-ready.

## Preserved boundary

Commit ff62751 is preserved. Collar V5/V6/V7, exact ray evidence, the scoped weight verifier and the browser texture-loading diagnosis are frozen under `../2026-09-10/astrid-head-v2/collar-repair/` (repository path: `content/staging/2026-09-10/astrid-head-v2/collar-repair/`). V7 passes declared native/export weight equivalence but retains a tiny side-collar skin triangle. It is not a completed realism candidate. Public model and production loader were not changed by these studies.
