# Vera speech: one take, synced voice

How the dealer's speaking clips were made indistinguishable from her idle loop, and how the voice is kept on her lips. Shipped 2026-08-27, verdict passed by Kevin.

## Problem 1 — "two different clips"

The 15 studio-era speak clips were a **different generated take**: gray studio light, she leans toward camera, framing ~14.5% tighter. Normalizing (scale 1.145 + felt grade + color affine) made them *closer*, never *the same* — a different take cannot be graded into the original.

**Fix: regenerate as a continuation of the canonical take.**

```
higgsfield generate create seedance_2_5 \
  --prompt "<continue this exact static shot ... speaks the provided audio line ... arms folded on the rail>" \
  --mode omni_reference \
  --start-image content/persona/canonical-inroom-frame0.png \
  --end-image   content/persona/canonical-inroom-frame0.png \
  --audio web/public/dealer/audio/en/<line>.mp3 \
  --aspect_ratio 1:1 --resolution 1080p --duration <audio+1s, max 12> \
  --generate_audio false --wait
```

Key ingredients:

- `canonical-inroom-frame0.png` = frame 0 of `content/raw-all/idle-1_idle_idle.mp4`, the exact take (room, table, lighting, framing) every clip must match. Using it as **both** start and end image pins the pose at both splice points.
- The line's TTS mp3 as `--audio` reference makes seedance animate the mouth to those words.
- Output is native 1440×1440 @ 24 fps, ~9 credits/second.

**Evidence:** regenerated frame 0 vs canonical frame: mean abs diff **1.87** (encode noise). Stream-vs-stream splice diffs across the batch: **1.6–1.8**. The old studio clips measured 22+.

**Trap:** `pipeline/speak-normalize.txt` is what `bake-with-table.sh` consults for the studio-era scale/grade treatment. A regenerated clip's line MUST be removed from it, or the bake re-scales the already-perfect clip by 1.145 (this produced a false "still two clips" verdict once: splice diff 22 instead of 1.8). The file is now empty; keep it that way for regenerated content.

## Problem 2 — voice ahead of her lips

Seedance animates the mouth **~300–500 ms behind** the reference audio, and the offset differs per clip. A single global constant can never fit all lines.

**Fix: measure each clip, store its own delay.**

1. `pipeline/measure-lipsync.py <stream.h264> <line.mp3>` — extracts a mouth-motion track (frame diffs in the lip crop), an audio envelope at 24 fps, and cross-correlates them over ±500 ms. Peak lag = how far the mouth trails the voice.
2. `pipeline/apply-lipsync.py` — runs that for every `idle-1/speak/*` clip with an audio file and stamps `audioDelayMs` into `web/public/dealer/streams/index.json`. Weak correlations (< 0.15) are skipped and fall back to the CSS `--lipsync-offset` (200 ms).
3. `app.mjs` speak path waits `clips[key].audioDelayMs` after the clip's first painted frame before starting the voice.

**Run `apply-lipsync.py` after every stream redeploy** — `build-index.mjs` rewrites `index.json` and drops the stamps.

Measured example: `fair_rng` +500 ms (corr 0.394), `who_are_you` +333 ms (corr 0.366), `win` +333 ms (corr 0.603).

## Problem 3 — silent second playthrough

The engine decodes ~1 s ahead of paint. When a speak clip is longer than its audio, the decoder reached the clip boundary *before* the audio-end handler ran, asked `onIdlePick` while `speaking` was still true, and committed a full silent replay; the queued idle then waited a whole extra clip. Fix (app.mjs):

- `onIdlePick` only replays the held speak clip if the voice has **> 1.2 s of runway** (covers the decode-ahead horizon); otherwise returns idle.
- `stop()` uses `engine.interrupt(idle)` instead of a queued trigger — the 200 ms crossfade hides the cut.

Verified by present-log: speak clip presents once, idle presents at audio end (8.3 s), no replay.

## Problem 4 — drift *within* a clip, and unsynced game-flow lines

Two more defects surfaced in play:

- **Game-flow lines** ("Bets are closed, good luck", "Dealer busts") were spoken through `voice.say`, which cut to the clip and started audio on a fixed 350 ms timer — no painted-frame wait, no per-clip delay. Fix: both `voice.say` and `sayLine` now go through one helper, `cutToTake(clip)` (fetch → interrupt → painted-frame wait → that clip's `audioDelayMs`), so every recorded take plays through the same synced path.
- **The mouth lag drifts during a clip** (e.g. `who_are_you`: +708 ms at the start sliding to +458 ms at the end). No constant offset can fix a changing lag. Fix: `pipeline/sync-audio-warp.py <key>` measures lag in sliding 2.5 s windows, builds a monotonic audio→video time map from the confident anchors, and re-renders the mp3 with piecewise `atempo` stretching so the voice follows the mouth through the whole line. Originals are preserved in `audio/en/orig/` and are always the warp source, so re-warping after a clip regeneration is safe. Short lines (< ~5 s) with too few anchors are left unwarped — their measured constant delay suffices.

Run order after any clip or audio change: **warp → `apply-lipsync.py`** (the warp flattens the drift; the re-measure absorbs the remaining constant into `audioDelayMs`). After the warp pass, residuals dropped from 300–750 ms to 0–42 ms on all 16 long lines.

## Adding a new line (or language)

1. TTS the line to `web/public/dealer/audio/<lang>/<key>.mp3` (must be > 2 s).
2. Generate with the command above (duration = ceil(audio)+1, max 12).
3. Download to `content/raw-all/idle-1_speak_<key>.mp4`, then:
   `./pipeline/bake-with-table.sh idle-1_speak_<key>` → stage + `node pipeline/build-index.mjs` → `python3 pipeline/apply-lipsync.py`.
4. Reload. The engine picks the clip up by key automatically.

Automation reference: `regen-batch.sh` / `regen-recover.sh` from the 08-27 session (submit all lines in parallel, wait, download, bake, deploy, measure). Note: macOS ships bash 3.2 — no associative arrays; `higgsfield generate wait` takes `--timeout`, not `--wait-timeout`.
