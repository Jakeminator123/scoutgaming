# Fixed-card contact draft viewer

Run `node server.mjs` from this folder, then open http://127.0.0.1:4189/ . Root's current staging process is session74313. Server binds127.0.0.1 and serves only this HTML, existing game card-art.mjs, diagnostic observations and native RGB/RG masks. Public gameplay is unchanged.

The viewer imports the real game card-face renderer, but uses a nominated Q of spades for QA; it is NOT a server-issued game hand. The constant parallelogram has corners[1052,619],[1109,612],[1136,643],[1079,650] atframe0, then rigidly translates by the observed fingertip candidate. It never scales to the growing source-paper hull. Geometry and contact are authored/draft, notmeasured:true. Source prop removal is in the separate draftRG masks. Ractor/Gfinger coverage is split algebraically around the drawn card, avoiding duplicate soft-edge opacity.

55native frames can be inspected individually or played at24fps. No interpolation or motionretiming in this viewer. Missing masks/observations must remain visible failures. Browserroot observed first andlastframes; initial shoulder lamp/elbow fragments identified forcleanup. This is checkerboard compositing proof only, notgamecamera, seven-seat, timing, release or fullround acceptance.
