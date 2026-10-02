# Amira idle / speech joins

The user reported the direct idle-to-speech cut while composite grading was being
verified. Existing speech and waiting have different hand/jacket/hair poses.

Each of17 unchanged speech clips now has a320ms silent entry and exit (34 maps).
Bidirectional DIS flow matches the entire keyed actor between real endpoints;
only these silent joins warp/interpolate. Speech frame count, native25fps, exact
MP3, text and measured offset are untouched. The approved display registration
is unchanged: the waiting crop is sampled into speech-crop coordinates at2/3
with(+7.333,+.667)px offset, equivalent to its existing world placement. This is
a coordinate conversion, not an actor scale adjustment.

Runtime snapshots are taken after the actual grade, edge cleanup and light wrap.
The join does not apply them twice or briefly show an ungraded face. Hand contact
positions and cast-mask alpha blend over the same interval. Waiting is prepared
at frame0 before reveal, eliminating a stale pose/frame after speech. The exact
audio starts with the first presented native speech frame after the silent join.

Source media, masks and recordings are unchanged; maps are SHA-bound to speech
and waiting. `build.py` reproduces maps and a candidate manifest. No API jobs,
credits, new generated pictures/video, or re-keying.

## Verification

- `join-review.jpg`: five sampled stages for greeting/goodluck/dealerblackjack
  both directions. `runtime-return-sheet.jpg` is the real game GPU output for
  goodluck exit into moving waiting, including its endpoint. No double facial
  outline observed in those samples. Pose/detail change remains perceptible;
  not certified invisible for every source expression.
- `live-frames.json`, `live-return-frames.json`: actual rendered entry/exit
  progress, then native playback/idle. Final idle continues moving.
- `all-lines-runtime.json`: every17 line played with this revision, goodluck
  twice; all returned to idle. No WebGL/playback warnings or errors.
- `other-dealers-runtime.json`: Vera/Astrid/Mei goodluck twice each after the
  shared join extension; legacy non-composited joins and playback still work.
- Seven focused manifest/source/hash/track/grade/join tests, full pre-commit and
  dealer-sync `--probe` pass.

Limits: native speech is softer than waiting and derives from another plate.
This smooths existing poses; it cannot restore missing source detail or invent a
new physical action. Speech may still wait up to one5s idle loop for a matching
front-facing endpoint. Original user session and server-owned game state remain
unchanged. Installed only into the working local preview, no push/deployment.
