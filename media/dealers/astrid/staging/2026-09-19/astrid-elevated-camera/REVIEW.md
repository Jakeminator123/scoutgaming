# Elevated first dealer upcard — 2026-09-19

The user approved reference269f8943 with “Use this angle”. It uses the original `ref-identity.png`, the supplied YouTube camera frame and the actual game-table reference. One Seedance2.0 take was generated: `de1f90a9-b8db-4a64-a46d-7c8f9d0665ef`. It is completed; do not resubmit. Exact prompts, references, approval and provider receipts are saved beside this document.

## Installed scope

Only Astrid's **first face-up card to herself** uses this take, in the opt-in local review:

http://astridelevated.localhost:4190/?dealer=astrid&performance=staged&astridGreen=review

The former green6975244a take remains disabled. Player deliveries, the hole card and later dealer draws retain their existing routes. Server-owned cards, shoe, wallet and payouts are unchanged. No production deployment or live-database access occurred.

`build-take.mjs` reproduces the public actor atlas and manifest in `web/public/review/astrid-elevated-table`. Original source is97frames at24fps; it is not interpolated or labelled60fps. Actor RGB is not recoloured or stretched. The crop[560,0,960,760] uses a rigid full-source placement with only+20px vertical translation. Shoe front lip is registered to native[1265.5,673.5]. The replacement card follows the native corner ledger underneath the retained fingers; the final DOM card uses the same filmed plane.

Source SHA: `dfaeea2b4dae3cad918a2a3af9114d261131939ea636cf2e3427172b3b33402b`.
Packed SHA: `64f0402477a887c2ffc1b6ec7e79a82782927992b16ed62c23c5bb4cea99d3d3`.
Calibration SHA: `7523881744aef99dbd3fcb086e91420fcea1c8ce8b066a542716079798f4e231`.

## Observed gameplay

The isolated guest at1280×720 played a complete one-seat round. The new first-upcard action rendered J-clubs. Player3-diamonds/3-clubs hit6-diamonds, then stood. Settlement returned10 on a5 stake, balance1000→995→1005, and the game returned to betting. Browser warnings/errors were empty. A refresh during decisions preserved all card identities, hidden hole card, wallet and exact dealer-card bounds.

The replay uses that already-issued J-clubs and consumes no new card. Actual browser captures cover approximate presented frames4,5,7,20,28,36,58,74,95; filenames reflect requested milestones, and `gameplay-qa/replay-captures.json` records the observed frame before each screenshot. These are rendered table screenshots, not source composites. Root inspected pickup, turn, finger contact and landing images. The one-round result is functional integration evidence, not full-game visual approval.

Verification: four scoped first-card/registration tests, repository pre-commit suites, dealer-sync probe, syntax and whitespace checks passed. Alpha/encoding checks and every-frame source review are documented separately under `mask-prep/video/verification.json` and `card-track/README.md`.

## Remaining visible limits

- Entry starts with hands already at the shoe. The new source has no matched transition from existing idle or surrounding old dealing takes; cuts remain visible.
- Edge-on frames27–29 are blurred and markers disappear. Their corner correspondence and front/back switch are explicitly inferred; texture orientation is authored consistently across the whole take.
- The green shoe is a proxy. Its front lip is aligned to the actual game shoe, but the two shapes are not identical.
- Slight green spill remains on some motion-blurred source edges. Skin is preserved, not whitened to hide it.
- This does not establish seven-seat motion, seamless speech transitions or full visual acceptance. No further generation was submitted after this take.
