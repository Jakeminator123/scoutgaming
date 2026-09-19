# Astrid green-screen SPEAK test via ElevenLabs Image & Video API (Creatify Aurora)
Generation id: Mn2vLqTOAmDaJKBYJeKy  model creatify-aurora 720p
Inputs: start image = assets/astrid-3d/greenscreen/plate-elevated-reference.png (job 269f8943, approved plate); audio = web/public/dealers/astrid/audio/en/greeting.mp3 (4.64 s)
Endpoint: POST https://api.elevenlabs.io/v1/flows/video  (key ELEVENLABS_VIDEO_KEY in ~/.config/croupier/agent.env, scope image_video_generation)
Note: Wan 2.6 / OmniHuman are NOT exposed in the API (web UI only). API models: creatify-aurora, veo-3.1(-fast), bytedance-seedance-v2/-fast/-mini/-v2.5.
Prompt field is rejected for creatify-aurora (audio + image only).

## Installed as Astrid's greeting speak clip (2026-09-19, Kevin: "mount it, it was perfect")

Native take `take-greeting-creatify-aurora.mp4` SHA 9548226e…f703a7 (1280x704, 25 fps, 118 frames, AAC track). Zero generation.

Registration (`registration/measure.py`, `refine.py`, `coarse.json`, `refine.json`): the take is the 2688x1520 plate scaled to 1280 wide and cropped to 704 rows. Phase correlation of gradient images with the actor masked out, against frame 0 of `assets/astrid-3d/greenscreen/take-dealer-first-card.mp4` (the 1920x1080 render the runtime placement is calibrated to): one rigid transform, **scale 1.5, offset (0, +15) px**; the leftRail / rightRail / shoe windows agree at dx 0..-1, dy 15; the front rail alone reads dy 9 (generative drift, not corrected, no warp). `source.mp4` SHA 9fea307b…d848 = lanczos scale to 1920x1056, pad to 1920x1080 at (0,15) with the take's backdrop green 0x196f2d, 25 -> 24 fps by frame drop (timing kept; equal-timestamp face crops differ 4 grey levels), audio track copied (116 frames, 4.83 s; audio 4.64 s).

Audio (`registration/audio.py`, `audio-sync.json`): the embedded track cross-correlates with `greeting.mp3` at lag 0 samples, normalised peak 1.00 (onsets 0.0905 s both). Video frame 0 = greeting t=0; `audioOffsetSeconds` 0.

Mask (`mask/`, `mask-build.log`): vetted key via `astrid-green-box-right/mask/build.py --take-dir .`; actor union [658,20,1305,673], crop **[560,0,754,682]** (dealer-take origin kept), packed 754x1364, SHA **0ff04351…3c6c**; all 116 frames reviewed on `mask/qa/all-native-*.jpg`: clean, lips move, hands/shoe stationary, only the usual faint dark fringe at the jacket hem on the felt line.

Splice against the base eye-contact idle (`registration/splice.py`, `splice.json`): the take's head/torso sit ~20 px higher and the hands 6-10 px higher than base frame 0, a pose difference rather than a rigid residual, so `spliceOffset` stays [0,0] (runtime-tunable in `speak.json`); a pop of that size remains at the cut in and out.

Install: `node build-speak.mjs --install` writes `web/public/review/astrid-green-speak/{speak.json,actor-packed.mp4}` from the mask manifest, the dealer take placement (x 560, y 0, framingScale .85) and the sync measurement. Runtime `web/public/astrid-green-speak.mjs`, opt-in from `app.mjs` for astrid + Blender table only.

Runtime check (`runtime-check/check.mjs`, `result.json`, `after-load.png`, headless Chrome with SwiftShader): page loads, greeting plays over the held idle (frames 0-115), caption shows, base idle resumes; console has only the SwiftShader ReadPixels driver notices. Audio/video start delta measured on the presented frame: run 1 -91 ms (before the nudge), run 2 -250 ms nudged to -106 ms settled; software rendering inflates this, real hardware pending Kevin. Checks in `checks/` (pre-commit, dealer-sync --probe, 24 focused tests) pass.
