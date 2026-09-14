# Cold/warm isolated playback finding

Actual receipt cold-warm-browser-review.json, same issued4♦: firstplay89/89 callbacks,0 reported drops; repeat64distinct callbacks and24drops. Repeat omissions span startup5, ongoing16, return4 frames. Warm GPU paint time improved (median0.4ms, max0.8ms versus cold0.7ms,max8.6ms). This contradicts a simple cold-shader-startup explanation. Decoderprocessing median stays~0.050s while p95~0.10–0.12s; that is decoder processing-latency metadata, not single-thread CPUcost perframe.

Lifecycle source review: one persistent GPU renderer/VideoTexture, previous playback paused and oldRVFC cancelled at restart, generation checks, serialized adapter renderplans. No obvious duplicate callback loop supported by this source or two receipts. Actual VideoPlaybackQuality exposes prototype getters, so direct JSON serialized start/end as{}. Fixed explicit numeric snapshots and added a prototype-getter regression test. Existing deltas were computed from getters and remain meaningful.

Added per-run seek/wait/stall/play/pause/end observations, readyState/currentTime, explicit quality snapshots and document visibility. Listeners detach on disposal/stale start/failure. This distinguishes decoder buffering/seek behavior from a wrongly attributed shader cost on the next measurement.

Important presentation confound: packedsourcevideo is display:none and4MP, GPU uploads on callbacks, while root ran in a hidden IAB tab. Prior experiments showed native source presentation state changes callback delivery. This is a plausible mechanism, not proven causality for this repeat. Next controlled measurement: three foreground repeats, same issuedcard and video bytes, with this telemetry; compare separately to three hidden repeats. No source resize/retime or visible packed-video promotion. If foreground repeats still degrade, inspect observed waiting/stalled and quality creationTime/reset boundaries before changing media lifetime. Do not silently create a new video each replay; that would change the experiment and texture lifecycle.

No globalphaseoffset, codec or publicgame changes. No60fpssmoothnessclaim.
