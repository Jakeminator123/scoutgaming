# Fixed-card contact draft viewer

Run `node server.mjs` from this folder, then open http://127.0.0.1:4189/ . Root's current staging process is session74313. Server binds127.0.0.1 and serves only this HTML, existing game card-art.mjs, diagnostic observations and native RGB/RG masks. Public gameplay is unchanged.

The viewer imports the real game card-face renderer, but uses a nominated Q of spades for QA; it is NOT a server-issued game hand. The constant parallelogram has corners[1052,619],[1109,612],[1136,643],[1079,650] atframe0, then rigidly translates by the observed fingertip candidate. It never scales to the growing source-paper hull. Geometry and contact are authored/draft, notmeasured:true. Source prop removal is in the separate draftRG masks. Ractor/Gfinger coverage is split algebraically around the drawn card, avoiding duplicate soft-edge opacity.

55native frames can be inspected individually or played at24fps. No interpolation or motionretiming in this viewer. Missing masks/observations must remain visible failures. Browserroot observed first andlastframes; initial shoulder lamp/elbow fragments identified forcleanup. This is checkerboard compositing proof only, notgamecamera, seven-seat, timing, release or fullround acceptance.

## Decoded GPU review

CPU decoded composition skipped about half the frames; a first GPU run skipped openingframes during shader compilation. The GPU path now warms the decoded firstframe before playback, then uses requestVideoFrameCallback timestamps. Browser38 captured all55frames0–54;0 is explicitly decoded preroll and1–54 are presented callbacks. Evidence gpu-playback.json. This proves native24fps delivery in this isolated preview, not60fps/gameplay performance. GPU uses the same splitR/Galpha formula, rawvideoRGBsampling andactualgamecardart as the stagingPNGreference; no personwarp. Ended fallback draws actual finalvideoimage and records it separately when needed. Currentserverprocesssession49268. Packedpickup source is also saved (55frames), but its authoredcardturn stillneedsgeometry/occlusion review.


## Assembled native cycle

`/cycle` plays pickup7–66 → slide2–54 → return5–36. The additional pickup frames retain the actual finger adjustment that the former54 cutoff removed. The GPU accepts explicit card quads and one whole-clip uniform registration; return uses the fixed landed quad independently of the hand. Pickup uses a procedural red review back and the nominated game's Q face after turnover. No authoritative game state is connected.

`extended-playback.json` was read from the actual browser after playback: every selected native frame was presented in order. `cycle-end-browser.png` captures the returning empty hands and retained card. This does not certify visual smoothness or all seven reaches. The captured version still has unresolved early extraction7–12 and draft mask/contact boundaries. HTTP206 ranges are needed for the chosen start-frame seeks; suffix/open-ended and416 responses were also verified.


## Shared-flow and single-decoder tests

`/cycle?fps=60&chroma=420` tests identical RGB/R/G flow at2x source speed, with authored rigid rotation evaluated analytically between native poses. The initial444 and420 three-decoder runs drop frames, so neither is a performance pass. The1280 render-size test did not resolve it. `flow444-browser-repeat.json` predates the approved paper-mask rebuild; its source bytes were subsequently replaced, so it is telemetry-only, not a reproducible visual approval.

`/continuous` uses one181-frame packed420 stream and exact global-to-source-frame ledger. The first browser run displayed0,2–180, missing only movement frame1; both phase boundaries were continuous. `/continuous?preroll=1` adds four invisible decoder warmup frames before those unchanged181 motion frames. It retained movement frame1 but missed91,124,159 in that run; decoder quality reported6 dropped frames including warmup. This is an improvement in lifecycle structure, NOT an all-frames performance pass. Both telemetry files are saved. Source motion remains3.0167s, materially slower than the reference's overlapping real-dealer rhythm. No public code changed.
