# Extended pickup packing QA

Motion reviewer selected n66 inclusive: source55–61 contains real finger curl/recontact,62–66 settles toward slide endpoint. Received explicit confirmation of67complete maskframes before packing. pack-native.py now uses explicit PICKUP_FRAME_COUNT=67 and records frameCount/lastNativeFrame; slide55 and return41 remain unchanged. Repacked only stagingpickup.

Decoded all67frames:1920×2160, native24fps, timestamps n/24 within2microseconds, last2.750000seconds. Compared topRGB against same-index native source and bottomRG against same-index pickup-draft PNG. RGB MAE0.614–0.848/255, no missing/extra decoded frames. Inputhashes and outputSHA are retained; output SHA003c0c3c5e801a17a65bfb9e4296af6b9308396a79b174c4e0a81dac1a9aa53b.

Inspected codec comparison n54,55,58,61,66. G threshold-positive losses0,0,1,0,1 respectively among approximately12kpositivepixels. The added finger curl/recontact shapes survive encoding; narrow boundary differences remain. Mask shape/occludedfinger correctness still depends on source review. No whole-frame transition omission remains at oldcutoff54.

Evidence coverage.json,timestamps.json,input-sha256.json,rg-codec-review.jpg and reproduciblecheck.py. No public changes or gameplay acceptance. Reviewer suggests pickup66→slide2 as seam candidate; this packing preserves source endpoint but does not change viewer play ranges itself.
