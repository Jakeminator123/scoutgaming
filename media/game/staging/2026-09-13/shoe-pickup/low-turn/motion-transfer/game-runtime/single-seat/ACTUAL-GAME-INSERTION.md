# Opt-in insertion into the isolated actual game

No implementation/default public changes in this design. Preserve codec controls; none has final performance acceptance (gray repeats6/7/12 drops). Use only copied `game-runtime/runtime/public/app.mjs` on4190, with an explicit `astridBox0=review` query and dealer=astrid/isolated-host guard. Do not route other seats by nearest direction.

## Actual authoritative flow

- `web/public/app.mjs:582` tableCommand posts version/requestId to same-origin `/api/table`; retries samepayload, then stores serverversion and table snapshot. Server `web/server.mjs:84` commits shoe+wallet transaction together. No replacement API or local draw.
- `app.mjs:1353` openinground calls tableCommand('start'), takes `out.round` via roundView, then loops actual `round.live()` hands. First playercard comes from `live[i].cards[0]` at1372; secondcard, dealerup and hiddenhole are separate deliveries. Hiddenhole supplies `card=null,faceDown:true,shoeDraw:round.holeDraw` at1384.
- `deliverCard` at1212 selects baseline action from screen centre and prepares motion. `dealCardTo` at1198 creates the actual DOMcard, sets its fanindex and updates shoe display from server shoeDraw, appends it, then calls `flyFromShoe`.
- `flyFromShoe` at1045 is the narrow geometry/visual dispatch point: the actual newly appended DOMcard exists here and `cardLandingCorners` can measure it. Existing performance branch hides that DOMcard, calls PerformancePlayer.play, reveals onLand and finally reveals onfailure. The rough adapter must be an earlier explicit branch, not nested in the existing performance branch.

## Eligibility and handoff

Pass explicit seat identity from `deliverCard` using `container.closest('.seat')`/the existing seatEls array and `round.live()[i].box`; do not infer slot from x coordinate. Eligible only exactbox0, unsplit container, firstcardindex0, matching reviewed target basis, Astrid and explicitreviewmode. Other deliveries remain separately identified baseline behavior; this is only one delivery integration, not allseven improvedmotion. Existing firstcard fan currently changes when secondcard arrives, so the completed DOMcard must resume normal gamefan ownership after release.

Bind reviewedslot `box0-first` to issued identifier containing tableversion/shoeDraw in the current player/table context. Rank/suit come only from supplied server card; faceDown is never overridden by filmedfront. Use optional slotBindings, never modify/re-sign ledger payload. Keep the actual DOMcard hidden only after target/provenance validation and renderer preparation succeeds. On sole adapter onLand, reveal that same element, stop rendering its duplicate independent mesh, while actorreturn may continue. In neutralharness landed mesh stayedvisible; ACTUALgame surface must exclude `plan.landed` because the DOMcard now owns those pixels. Do not also trigger old PerformancePlayer onLand.

Cancel/resize/hidden/error: dispose only candidate actor layer, reveal existing serverDOMcard, emit explicit failedreview status, and restore hostactorownership. Do not start generic fake reach or issue a replacement card. Reveal-onfailure is state recovery, not a successfully observed landing. Missing lastcallback requires truthful incomplete outcome, not a manufactured final land.

## Room/table registration

Host a transparent canvas layer inside actual `#scene`, above table/background and at the intended dealer layer order, instead of the neutralgray standalonecanvas. Retain actual room/table DOM and servercardDOM. `PerformancePlayer` already uses `.performance-layer` and uniformRegistration; use its layering conventions, but not its old release interpolation. Card corners remain1920×1080 canonical coordinates inside GPU; actorcrop offsets remain withinthatframe.

Reference contract `camera-review/seven-targets/css-plane-contract.json` has captured source→1280game similarity scale0.5421688741883204, translation[121.01686751907214,0.1039891799197603]. This is source-specific measured registration, NOT simply uniformRegistration({1920,1080},viewport). The actualtable contactproof path uses uniformRegistration({1280,720},viewport), see table-scene.mjs:53 and performance-contact.mjs:167. Compose currenttableuniformfit × inversecapturedtableuniformfit × capturedsourcefit to obtain candidatecanvasuniformscale/translation. This preserves the source camera/body, no per-axis stretch.

However CSScard widths/fan offsets do NOT scale uniformly at all viewports. After appending the actualelement, call exported `cardLandingCorners` at performance-player.mjs:335, inverse-map allfour current corners through candidatecanvas similarity, and compare against reviewedcanonicalendpoint. That helper composes2D CSSmatrices and bounds, rejecting non2D. Exact target mismatch means unavailable review at that viewport; don't drag actor or stretch the card to forceit. Only documented float32<=.001px normalization is allowed by currentledger. Targetbasis changes need reviewed target/ledger revision, not silent runtime mutation. Reference capture already documents~5nativepx shoe localization and distantperspective uncertainty; measured currentrenderedproof must addressthat visually.

## Actor/speech ownership dependencies

`beginDealingTake` at1329 uses existing performance sequence; `endDealingTake` at1234 invokes its finish/idle handoff, and speech path1674 prepareSpeech. Candidatebranch must own a scoped action token/abort signal and suppress conflicting baseline actor action while it plays. Originalsource0 entry and finalcontinuation39 ready are not automatically compatible with existing speaking idle. No blindfade or auto oldidle splice: expose entry/return seam as knownfailedreview unless renderedjoinapproved. Await candidate completion before nextdelivery; root may choose roughreview seam with explicit failureevidence. Do not let generic begin/end take concurrently replace candidateactor.

## Required rendered checkpoint

Same realserverround at actualgame table: firstbox0 issued face visible at correcttarget, no duplicate card after handoff, secondcardfan remains valid, dealerhiddenhole stayshidden, resize/cancel leaves validserverstate, no extraonLand, entry/return seam documented. Record actualcanvas/currentDOMcorner mapping and issuedidentity. Playbackmetrics remain secondary. No codecvariant is promoted by this integration design.
