# Minimal game integration path — source cycle still staged

Read current public app/player/contact/table modules. No public edits or new browser gameplay test in this investigation. Current game remains existing smooth60; native cycle preview is not gameplay integration.

## Reuse existing authoritative-card path

app.mjs deliverCard (around1211) selects performance take, creates the server-owned card DOM, and flyFromShoe (around1044) calls PerformancePlayer.play with actual card/rank/suit, faceDown, target fan corners, tableScene.shoeOutlet(), onCue and onLand. Keep this path and server round/wallet/shoe commands unchanged. Do not make the source prop's K/Q print authoritative or substitute a local random card.

PerformancePlayer.play (around82) already accepts origin but **does not consume origin beyond its argument**. It paints contactFrame(take, presented media time) card coordinates; after release it interpolates them to target corners until land, then calls onLand once and removes the moving card. createContactVisual layers actorR, independent game-card mesh, foregroundG. This is the correct minimal rendering hook. The gap is measured source coordinates and complete cycle media, not another standalone canvas/card timer.

Construct one staging-only measured central-cycle take from packed pickup0–66, slide2 onward and return5–36 after endpoint/motion review. Preserve complete same-clock RGB/R/G through edits. Generate a new immutable packed media file and take manifest with events pickup/release/land/rest and per-presented-frame quadrilateral/faceUp/contact. Front/back roll must follow observed geometry; source faces remain removed. Keep status review; if measurements are estimates they must retain hand-proxy semantics rather than being called measured/contact-approved. Do not relabel unknown corners to pass validation.

Minimal app hook: add a separate explicit Astrid source-mode manifest selection in the existing Promise.all loader near69, then feed that take into the existing deliverCard/flyFromShoe/player path. Do not overwrite smooth60 defaults. Scope selection to centre until other physical deliveries exist; avoid letting selectPlayerPerformance's nearest direction silently map the central source to all seats. Only enable after the complete calibrated take passes staging gates. Existing shader and servercard lifecycle can remain shared.

## Shoe and camera alignment

contactProof is enabled for Astrid performance=staged nearapp121. table-scene registration returns exact projected mouth, world transform, camera and viewport. Actual screenshot1280×720 mouth(781.133,349.731). performance-contact uniformRegistration166–175 reserves136px desktop controls:584px scene height. Wholeviewport contain is not the runtime mapping. Map source/native coordinates with the same uniform fit used by actor and contact mesh; never dealerRect-relative scaling for whole-scene footage.

Observed anchor mouth under actual fit was approximately3px left/9px high from model outlet, with3–8px manual landmark uncertainty. Refine against native actual extraction fingertip/card leading edge and shoe corners. Apply one uniform registered actor+card transform before packing or explicit camera registration, not local body bending. Mere origin translation of the game-card mesh would disconnect it from the filmed fingers; do not fill the missing shoe path using the currently-unused origin argument alone. A useful guard can compare transformed calibrated source mouth to supplied model origin and reject unsupported mismatch, rather than fabricating motion.

The shoe's model should occlude the portion of card still physically inside it, while foreground fingers occlude the extracted card. Existing test/shoe-contact-occlusion.mjs is relevant to that layer order. Actual game composite must prove no duplicate filmed shoe/card and stable face/sleeve colours.

## Complete cycle / speech lifecycle

The new cycle ends adjacent-shoe ready, unlike old folded speech-idle joins. Existing ready-motion/scene-join bindings depend on exact media/calibration/idle hashes; old joins cannot be reused by merely renaming take IDs. Provide exact idle→newready/pickup and newready→pairedidle bridge, or keep a labelled no-speech staging rehearsal until they exist. Existing prepareSpeech and finish(wait) must retain ownership until matching endpoint and next paired frame are presented. Never cut/retime paired recorded speech or release overlay early to erase latency.

Within a multi-card round, avoid replaying pickup's long leading rest and return's redundant tail: only use source-reviewed valid frame ranges and continuous endpoint joins. No freezing/fading over speech; no disappearing dealt card when the actor returns. Once onLand reveals the authoritative DOM card, it remains independent of the return actor.

## Centre versus seven positions

This source gives one central supported slide. Retarget=false must remain. Existing target interpolation can place a game card in seven fans, but does not produce seven filmed reaches. Do not call it seven-position physical acceptance. A centre-only isolated hand is the minimal integration check; left/right/inner positions require their own source motion or a genuinely approved physical transfer path. Dealer facedown/reveal/collection/shoe-change also lack this source coverage.

## Existing verification and isolation

Focused contracts: node --test test/performance-contact.mjs test/pack-contact-media.mjs test/scene-join.mjs test/ready-motion.mjs test/shoe-contact-occlusion.mjs test/shoe-game.mjs. Relevant pack/audit tools pipeline/pack-contact-media.mjs and pipeline/audit-performance.mjs. Required media audit node pipeline/audit-dealer-sync.mjs --probe and .githooks/pre-commit after actual integration changes. Synthetic test fixtures verify contracts, never filmed contact.

Browser QA uses CUA and a new explicit *.localhost hostname/demo guest. web/server.mjs uses PORT and DEMO_GUEST_ACCESS; any independent server must use an isolated copied runtime/database after checking current storage configuration. Do not assume a new hostname means a separate database; it isolates guest cookies, while backend is shared. Never edit user round state. Existing gameplay-qa/acceptance.mjs consumes actual logs/click timestamps and settled DOM; it deliberately cannot grant physical acceptance. Complete centre opening, hit, return and paired speech; record exact film/source SHA, live registration, timing, card/finger screenshots and settled wallet. Broader required shared-player regression stays separate from Astrid visual acceptance.
