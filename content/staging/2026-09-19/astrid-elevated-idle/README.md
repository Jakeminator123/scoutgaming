# Elevated Astrid waiting loop and felt cards

One authorized Seedance2.0 job87fc5852,6seconds1080p,145native24fpsframes. Uses exact approved de1f90a9 frame96 as BOTH endpoints, camera reference269f8943 and original ref-identity.png b2c16866 as identity only. See request/reference/submission/result receipts. No duplicate job.

Source reviewed before masking: stable elevated framing, same seated proportions and hands, blink and left/right glances. Glance is wider than prompt; no identity/camera replacement. The raw green card changes visibility; all green props/background are removed from the actor output. No prop card is installed. All145 native matte frames inspected in masked/qa. Source RGB unchanged before H264 encoding; no morph, retiming or body warp.

Rebuild using the existing mask pipeline:

```sh
/tmp/astrid-a9mask-env/bin/python content/staging/2026-09-19/astrid-elevated-camera/mask-prep/build-video.py --source content/staging/2026-09-19/astrid-elevated-idle/source.mp4 --out content/staging/2026-09-19/astrid-elevated-idle/masked --crop 560,0,960,760
```

Install copies actor-packed.mp4 into web/public/review/astrid-elevated-idle alongside idle.json. Both waiting and first-upcard use the same uniformRegistration camera/crop; canvas bounds match exactly. Native video loop carries RGB/alpha on one clock. Hidden/reset during first-upcard, resumes from matched reference pose. Retired frontal idle no longer initializes. Still fallback remains on decode failure. This is an integrated review, not a seamless entrance: approved first-upcard frame0 already reaches the shoe. No new speech/player-seat actions.

Cards now project physical felt-plane corners to DOM homographies, with normal paper proportions, compressed long/split fans and thin contact shadows. Animated cards use those same world corners and existing face/back artwork at landing. Outer fans clear the shoe. Cards remain server-issued DOM/state, no wallet/database changes. Branding and chip-plane work are recorded separately in astrid-table-v2/branding-qa.

Actual isolated QA: all7 boxes, split2s at box6, extra hit8-spades to20, refresh preservation, first-upcard replay, repeated idle loops and full settlement1000-40+17.50=977.50. No browser warning/errors. See gameplay-qa/result.json and screenshots. Ten focused tests and required regression suites/probe pass. No production deployment.
