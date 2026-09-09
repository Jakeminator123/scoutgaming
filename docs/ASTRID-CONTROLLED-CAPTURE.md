# Astrid contact capture handoff

## Latest continuation — 9 September, dealer cards and transitions

The user accepted the direction of the measured dealing motion and requested Astrid also deal her own cards, followed by smoother joins. The staged game now has a distinct dealer-card source for upcard, face-down hole card and additional dealer draws. This supersedes the earlier instruction below to stop all expansion. It does not grant full contact or default-table approval.

The long actor dissolves and per-card legacy-idle resets have been removed. A completed actor frame stays visible while the next take loads, and the next actor replaces it only after its first frame is rendered. Two consecutive own-card deliveries were inspected at the boundary in the actual game with no idle flash. Existing speech stays on the shared player.

A replacement centre take was rejected because it delivered too far left. An attempted preparatory take was rejected because it added a sweep. Neither is loaded by the game. The original measured player contact is preserved. A later clean preparatory take keeps both hands resting and joins their small wrist/gaze reposition to that original delivery. Only this 24-frame entry is prepended; the 145 original contact frames retain their speed and tracking. See `performance/provenance.json` for source prompts and hashes.

## Earlier contact findings (still relevant to contact quality)

The 9 September in-game contact proof is **not approved for default gameplay**. It demonstrates server-card replacement under the fingers, but the partially occluded marker is fitted as a rectangle at the shoe exit. This compresses the card into a narrow strip for the first extraction frames. Fitting a visible fragment is not a measurement of the complete rigid card. The generated take also ends in a different resting pose from the current idle, and its release location requires a visible correction to reach the player's card fan.

Do not expand this take into left/right/reveal/collection/shoe-change variants until these failures are resolved. The next asset workflow is controlled hand-performance capture with explicit corner tracking and hand occlusion. This needs a filmed performance or authored performance data; the current tools cannot physically record a dealer.

## Files for the capture artist / John

- `web/public/dealers/astrid/performance/camera-reference.png`: actual staged game composition, 1280 × 720.
- `web/public/dealers/astrid/performance/camera.json`: actual camera matrices, dealer rectangle and shoe transform. Shoe outlet is at normalized image **(0.63593743, 0.59885410)**.
- `candidate-source.mp4` in the same directory: generated six-second single-card movement for comparison, not approved footage.
- `in-game-review.mp4`: an actual isolated-game hit using a server-issued card. This is a silent visual recording; it is not proof of audio output.
- `manifest.json`: current measured-frame contract, checksum, event frames and explicit review status.
- `docs/reference/astrid-dealing-approved-concept.png`: approved pickup / guide / release / rest direction.

## First controlled take

1. Use a fixed tripod and manual exposure, white balance and focus. Match the reference's Astrid outfit, sleeve position, skin exposure, table surface and shoe placement. Include the full shoulder-to-fingertip reach; do not crop a wrist, hand, card or outlet.
2. Record a clean room/table plate and a lens/calibration-board view without moving the camera. Record measured board dimensions and table-plane reference points. Solve the photographic camera before rebuilding its 3D counterpart; the current orthographic preview is not a lens calibration.
3. Use one standard rigid poker-size tracking card (63 × 88 mm), with distinct removable corner markers. Keep a spare clean view of its complete face/back and edges. Record enough views to reconstruct corners when fingers or the shoe hide them. Do not interpret the remaining visible strip as the full card.
4. Hold the exact idle pose for one second. Reach to the shoe outlet, extract that one card, guide it to the marked centre landing area, release once, and return to the same idle pose for one second. Mouth closed. No shuffle, flourish, second delivery or hand rubbing.
5. Film the centre landing area at the actual in-game card-fan position, including the second and split-hand offsets. Do not move a released card backward to compensate for an overshooting take. Author distinct target directions after the first direction passes.
6. Supply the original constant-frame-rate 1080p or higher take, camera/lens settings and calibration plate, clean room plate, an actor alpha matte, a foreground finger matte, and per-frame full-card pose/corners with confidence and occlusion labels. Preserve source audio when a speech take is later prepared.

If motion reference is transferred onto the existing synthetic Astrid identity, that resulting footage needs a new identity and contact review. Do not substitute an unapproved face or imply the physical performer is Astrid.

## Ingest and review

- Stage source separately. Never replace existing speech or hand streams during capture preparation.
- Pack RGB above a mask image of equal size: red channel = actor alpha, green = foreground finger alpha. This keeps RGB, actor cutout and fingers on one decoded video frame.
- Prepare one measurement record per source frame, including full-card corners/orientation and observed fingertip position during contact. Preserve missing measurements as failures; do not invent confidence or silently interpolate an occluded corner.
- Generate a new SHA-256 for packed media and for camera/events/tracking. `pipeline/audit-performance.mjs --probe` checks integrity and dimensions. Its pass is not visual acceptance.
- Load the candidate through `?dealer=astrid&performance=staged&rehearsal=1`. Use an isolated database and a different hostname. Watch pickup, grip and release in the real game, including initial deal, hit and repeated delivery.
- Inspect original-resolution frames and normal-speed playback. Require rigid card proportions, actual outlet contact, correct finger occlusion, no duplicate prop, a consistent room and a matched return pose. Then repeat at narrow and wide viewports with one camera registration.
- Only a named review tied to both hashes may set `contact-approved`. Full-table/default approval additionally requires every action, speech, device and recovery check from the implementation plan.

## Still outside this checkpoint

Left/right direction variants, filmed hole reveal, collection, shoe-change performance, a continuous isolated Astrid speech/idle set, full Astrid line-by-line phoneme acceptance, and actual iPhone Safari / Android Chrome validation. The walkable prototype remains saved separately.
