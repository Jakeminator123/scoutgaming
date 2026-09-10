# Astrid contact capture handoff

## Next capture — 10 September

**Per-position correction:** the latest user report rejects three-direction routing. Use [player-targets.json](reference/astrid-capture-20260910/player-targets.json) from the actual seven-seat game. It records each initial card fan target and the existing release gap; see [the coverage audit](ASTRID-AUDIO-AND-SEAT-COVERAGE.md). The first two proof shots below address continuity defects but are not sufficient coverage for CAC-2. Capture distinct usable reaches/releases for all served positions, subsequent cards and split fans. Do not declare a seat covered merely because its card can slide there after a left/centre/right take.

The existing four direction takes now use the same front-outlet extraction. Centre and left have partial, opt-in empty-hand return candidates. The right continuation failed because it swept across the table before reaching the outlet. The own-card continuation failed because it moved a delivered card back into the shoe. Neither rejected take is in the runtime. See [ASTRID-LAYOUT-AND-RETURN-QA.md](ASTRID-LAYOUT-AND-RETURN-QA.md) for the source IDs and recorded failures.

The next step is a controlled performance proof. John/performer availability has been requested but is not yet confirmed. No physical recording has been scheduled and no new generation job is pending. The two rejected render jobs were rechecked and are completed. CAC-2 and CAC-4 are now Blocked on this dependency; return them to In Dev when usable source footage is available. This brief is ready for the person arranging capture; it is not a claim that capture has happened.

### Current reference packet

- [Clean current table](reference/astrid-capture-20260910/table-reference.jpg), captured in the actual staged game at 1920×1080 after the viewport finished loading. It binds the pictured dealer scale, rail and shoe. The browser snapshot is 1912×1080 (the 1920px viewport minus its right scrollbar strip); use the recorded viewport dimensions for normalization, not the JPEG width.
- [Current render camera](reference/astrid-capture-20260910/camera.json), exported by the game's existing capture control. Its matrices describe this render, not a physical lens or centimetres. The current viewport outlet differs from the normalized **source-media** outlet in the older camera below because the whole scene is fitted to the available screen. Do not mix the two coordinate spaces.
- [Current take anchors](reference/astrid-capture-20260910/take-anchors.json), containing the unchanged original source identities, hashes, source camera, event frames and measured release coordinates. These are references for matching existing joins, not approved replacement footage or measurements of a new performer.
- The [Scout reference](https://scoutgaminggroup.com/ai-casino) defines photographic identity, lighting, contact and fluid performance. Existing release correction and folded-arm returns are defects to remove, not gestures to reproduce.

### First two proof shots

| Shot | Continuous action | Inspect before more capture |
| --- | --- | --- |
| Own-card delivery | Rest → front outlet → extract one rigid marked card → place it in the dealer fan → release → empty hand back to outlet; also finish a version at the same rest pose. | Take from the front outlet, never from the stack centre. The placed card stays on the felt. All fingers and the whole card path remain in frame. |
| Right delivery and return | Outlet-ready → extract one card → place in the right player fan → release → empty hand directly back to outlet; repeat once without folding arms. | No extra sweep, shuffle or card retrieval. Entry and exit must join the neighbouring take without a visible pose jump. |

Record each sequence as an uncut normal-speed performance. Let the performer execute a natural professional cadence; do not stretch a slow gesture or accelerate a spoken sentence. Keep camera, focus, exposure, white balance, shoe, seat and lighting locked. Include clean hold frames at both ends and enough pre/post-roll to choose genuine motion boundaries. Preserve the original audio track even if it is only location sound.

Use removable table-plane markers and a rigid card whose full corners can be reconstructed under occlusion. Record the camera calibration and measured physical dimensions. The final actor layer must exclude the prop; the finished game uses its server-issued card beneath a matching foreground finger matte. Keep source corner/fingertip measurements and confidence for every contact frame. A visible strip of card is not the full rectangle.

After the first proof passes in the actual game, capture left/centre/right player deliveries with second-card and split offsets, own upcard/hole/additional draws, hole reveal, collection and shoe change. The requirement is believable delivery to every player fan, not an arbitrary requirement for seven unique videos. Choose the action coverage from actual target geometry and verify all seven seats plus split fans.

### Handoff and acceptance

Deliver original constant-frame-rate media, clean plate, camera/lens/calibration measurements, source frame index, rigid full-card transforms, fingertip/occlusion labels, actor matte, foreground finger matte and source hashes. Match the approved synthetic Astrid identity only through an explicit reviewed transfer; a new physical performer is not automatically the same character. New identity-transferred footage must be checked again for face, hands and contact.

Stage one new candidate inside the existing Astrid game. Use the shared presented-media clock for the actor, attached card, occlusion and sound; settle each delivery only at landing. Review extraction, grip, release and both joins frame by frame, then complete repeated normal-speed rounds. Reject floating contact, duplicate cards, bent card geometry, blur, abrupt pose/exposure changes or gestures without game events. Use In Dev during implementation, Ready for QA when the candidate and evidence are prepared, In Testing during acceptance, and Done only after the full expected behavior passes. The ingest details below remain applicable; older action-coverage lists are historical.

## Earlier continuation — 9 September, dealer cards and transitions

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

## Current remaining coverage

Left/right direction variants and isolated Astrid speech/idle now exist in staging, as described above; their existence does not approve contact, motion continuity or every phoneme. Remaining coverage includes the failed right/own-card returns, believable contact across all served fans, filmed hole reveal, collection, shoe-change performance, full Astrid line-by-line speech acceptance and actual desktop Safari / iPhone Safari / Android Chrome validation. The walkable prototype remains saved separately.
