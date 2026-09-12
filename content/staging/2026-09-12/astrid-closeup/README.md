# Astrid source and game appearance — 12 September 2026

The playable character still fails photographic appearance acceptance. This checkpoint preserves a better dense face source, isolates the confirmed idle-pose error, and records actual Chrome evidence. It is not a finished character or a complete-round acceptance.

## What causes the visible difference

1. The Sept11 full-body Tripo mesh already has an inaccurate face and solid, grooved hair before rigging. It is the source used by the rejected game preview. Its original PBR images and geometry were retained by the corrected body-rig transfer; shader tuning cannot invent absent anatomy or hair strands.
2. The game controller adds `lean(.4)` even at rest, approximately 23 degrees forward. The private Sept11 head counter-rotation is only `.05`, exaggerating the downward face angle. The pose also crushes/twists the jacket at the shoulders and elbows.
3. The new Sept12 close-up reconstruction is an actual GLB with a more defined likeness. It is a cropped bust with geometric eyelid/cheek artifacts and solid hair, not a rigged, animation-ready full body. Neither this source nor the upright old body has passed final appearance acceptance.

The native comparison and clay render establish that some defects exist in geometry before the game loads it. Initial root studio renders were overexposed; use `original-renders-neutral/` or the independently aligned frontal view, rather than those initial exposure trials. These are diagnostic studio views, not camera-matched game approval.

## Preserved source

- `reference.png`: generated 4096-square reference, job `0481ac1e-eb26-4c09-873f-8b5699d34e26`; reconstruction input, not an exported game model.
- `provider-original.glb`: untouched Tripo H3.1 job `9b2f127c-956a-42e3-bee0-cb72a41f3710`. SHA256 `1757bd0469cc338cfa7f6c4e3897d64d72eeed79393c9dd63591a94d61184ba1`, 15,730,436 bytes; 249,716 vertices, 476,422 triangles, three embedded 4096-square PBR maps, no skeleton/animation/morphs.
- `native-source/candidate-packed.blend`: separate editable import with all textures packed. Reopening preserves the inventoried mesh, UVs, materials, images and transforms. The original GLB remains authoritative because importer interpretation is not byte-lossless conversion.
- `independent-assessment/`: source-relative frontal camera at 101.518 degrees, PBR and clay views, exact image hashes and candid rigging suitability assessment.
- `meshy-job.json` / `hunyuan-job.json`: failed terminal generation receipts; the provider did not expose a reason. No duplicate submission or automatic rig was made after the completed Tripo result.

## Confirmed pose repair, still private

`../upright-controller/` uses a lower seated root, slight resting torso angle, corresponding head angle, and eased entry/return to the action. It retains the previously rejected V1 mesh and finger weights. Whole-hand surface support replaces the insufficient fingertip-only floor mask. This is not approval of anatomical card grip.

`game-review/prepare-review-runtime.py` builds an isolated copy of the existing game. Start `HOST=127.0.0.1 PORT=4206 DEMO_GUEST_ACCESS=1 node server.mjs` from its generated `runtime/` directory and `python3 evidence-server.py` from `game-review/`. Open `http://astridnext.localhost:4206/?dealer=astrid&scene=rigged-review&recordproof=1&rehearsal=1`. This creates its own demo database; no real user database is copied or changed.

Actual Chrome capture: `game-review/evidence/chrome-1789198727818709000.png`, SHA256 in adjacent receipt. It confirms the upright resting posture but also shows the remaining poor face/hair/jacket quality. The new bust is **not** installed in that preview. The capture contains the real WebGL canvas; it excludes HTML controls and audio.

## Verification and limits

- New original mesh SHA checked before/after import and independent inspection; three original texture hashes preserved.
- Upright diagnostic independently evaluates deformed skin over 707 samples across seven seats: no reach/floor/return failures, maximum support error 0.7002 mm. These samples are not full motion-quality or fingertip grip approval.
- All four default media sets match the deep 90-stream baseline. This does not certify phoneme sync. Shared media and public/default dealer files are unchanged by this checkpoint.
- Old checkpoint `72c7a79839da2ae1b0d7254b490dc163c1aefb30` remote pipeline `2841885403` is verified successful. New checkpoint validation is recorded in the handoff/commit, not inferred from that old pipeline.
- No complete-round, facial animation, mobile or final realism acceptance is claimed. CAC-2/CAC-4 remain In Dev.

Next asset work is targeted reconstruction/retopology of eyelids, eye surfaces, lip/oral structure and hair, plus a measured body/neck/clothing fit and deformation review. Preserve this dense original. Do not apply an automatic head bone or graft it onto the rejected body and present it as a finished dealer. A new generated still will not close these defects.

## Conversation recovery

The raw local session contained 570 visible user/assistant messages across September 8–12 with no malformed JSON entries, while the app reader returned only the beginning. A private readable Markdown/HTML/JSON export and source checksum snapshot are saved outside this repository under Kevin's Documents/Croupier-Conversation-Backups/2026-09-12-recovery. Original session data was not modified. The native conversation display itself is unresolved; do not claim it was repaired.
