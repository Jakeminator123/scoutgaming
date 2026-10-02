# Astrid staged sequence adapter

`sequence-binding.mjs` is isolated from public runtime and defaults. It binds already-issued server-visible delivery records to an exact reviewed multi-card frame ledger. It performs no API call, draw, wallet mutation, media scheduling or visual approval. No current draft ledger has been marked reviewed to make this module run.

API:

    const binding = await bindAstridSequence({deliveries, ledger, targets});
    const {moving, newLandings, landed} = binding.present(presentedOutputFrame);

Deliveries must explicitly supply unique cardId, seatId, targetId, faceDown and (only if face-up) card:{r,s}. Use existing server-view hand/card identities. Hidden-card inputs are allowlisted: rank, suit, card object and extra nested fields never escape through moving/landing records. `face` stays back regardless of filmed pose when faceDown=true. This does not itself establish that input came from the server; the gameplay caller must construct it from its authoritative response, not source footage.

Targets contain seatId, unique targetId and exact four 2D corners in the same calibrated coordinate system as the ledger. A split/fan position needs its own exact target. No screen-third or nearest-seat fallback. Unsupported seat, changed target corners, missing/duplicate card IDs, mismatched count, out-of-interval prop and missing active prop are hard errors before playback.

Ledger schema `astrid-staged-sequence-v1`: dealer astrid, sourceSha256, fps, deliveries with cardId/seatId/targetId/targetCorners/pickup/release/land, and contiguous frames with {frame,cards:[{cardId,corners,faceUp}]}. Every attached or released-but-not-landed prop must be present in every frame [pickup,land). `review` requires staged-reviewed status, evidence reference and payloadSha256. `ledgerDigest` hashes JSON serialization excluding review; preserve property order when transporting. Hash binding detects mutation, not independent artistic approval. A caller must only supply evidence from an actual reviewed source. Do not fabricate review records for the current incomplete source.

The adapter snapshots inputs before asynchronous hashing and deep-freezes returned state. It permits equal or forward presented frames; rewinds reject. Skipped frames catch up all passed land events once. `newLandings` is idempotent per binding; `landed` persists for subsequent actor/return frames. This guarantee is in-memory presentation only, never a financial transaction or cross-reload idempotency claim. Caller recovery must use server state and a separately chosen presentation position.

At source109→return, do not pretend109 is land: actual fourth finger contact continues; observed clear release is return5/global114/output285, not source110. A joined OUTPUT ledger must name the physical release and land on its own output clock. The unit test uses synthetic109 contact/110 release/112 land only to prove the state machine; these numbers do not approve the actual joined source. Pass the same presented output-frame index used by actor RGB/R/G, not a separately scaled native timer.

The renderer draws `moving` around actor R/G and hands each `newLandings` card to the actual persistent table representation. It must keep hidden-card backs and never infer a rank from source print. Returning actor or speech cannot remove `landed`. Media failures/abort can still reveal the final server state as explicit fallback; that is not successful physical delivery.

Thirteen focused tests: hidden info; fourth return contact; dropped-frame land; missing/duplicate IDs; unsupported/shifted seat; fabricated/missing prop; changed review/time; immutable snapshots; overlapping four-card sequence. Run `node --test` on sequence-binding.test.mjs. Tests use synthetic ledger review evidence and do not authorize public promotion.


Endpoint guard: every corresponding last-moving corner at land-1 must agree with the exact target, default tolerance zero. Changing seat IDs and declared targetCorners alone cannot redirect a middle delivery to far left. Optional landingCalibrations are external evidence records: cardId, units canonical-pixels, sourceSha256, frame, exact sourceCorners, maxCornerErrorPixels, evidence and sha256 (JSON payload without sha256). The ledger must reference the exact landingCalibrationSha256, so timing/source/pose cannot change independently. Nonzero tolerance must be >0 and <=2 canonical pixels; this is a conservative adapter rejection ceiling, not a measured uncertainty or visual acceptance claim. The actual allowance must be independently measured and recorded. Never pass normalized UV coordinates as canonical pixels. Hashes detect changes and cross-binding errors; they cannot prove an evidence statement truthful. The caller/reviewer remains responsible for real calibration provenance. No current source was assigned a tolerance or given new approval by this change.

Four additional tests reject relabeled far-left motion, reject a one-pixel mismatch without evidence, accept only explicit bound one-pixel fixture calibration, and reject wrong-frame evidence or an invented700-pixel allowance. This protects the land handoff; physical trajectory/hand-contact evidence before the final pose remains a separate reviewed-ledger responsibility.
