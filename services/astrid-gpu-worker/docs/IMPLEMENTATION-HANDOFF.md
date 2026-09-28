# Streaming implementation — 2026-09-28

## Current Croupier handoff — 2026-09-28 follow-up

The worker remains in `services/astrid-gpu-worker` on
`jakemanator123-github-work` in `Jakeminator123/github-work`. The earlier
standalone-clone ownership notes below are historical. This follow-up adds
exact game-host WebSocket forwarding in the cloud gateway and passes two
distinct stream secrets only to the Web child. The starter's independent
`assertCloudAccessReady()` gate remains closed. The server keeps complete-text
decisions, signed one-use admission, owner/round/memory rechecks, durable paid
request reservation, cancellation and one-job-per-worker behavior.

Timing hooks now cover text wait, TTS first PCM and end, first worker media,
server send queue, client playing/first frame, worker analysis/inference/crop
composition, FFmpeg overlay/encode wall time and first bytes. The handler
reports cold-start time. GPU queue and actual billed cost require RunPod job
metadata; no values have been measured. Worker completion reports the selected
encoder and whether the real FFmpeg process exited successfully. There is no
verified NVENC session yet. No private conversation, token or key is logged by
these metrics.

A manual, SHA-tagged GHCR publish workflow is prepared for the proposed
`ghcr.io/jakemanator123/astrid-gpu-worker` package; it has **not** been run.
The existing RunPod endpoint and Emil's GitLab repository remain untouched.
The [cloud GPU plan](../../../docs/ASTRID-GPU-CLOUD-TEST.md) gives blank config,
private digest pull/rollback and the fixed-phrase cold/warm two-play test.

Local verification for this follow-up: cloud/WebSocket and generated-speech
tests, 13 relay/TTS tests, nine Python worker tests with real local FFmpeg,
Python compilation and `git diff --check` passed. The broader pre-commit/media
audit and four-dealer visual rehearsal are recorded in the delivery handoff
after they run. No GPU, Cartesia, GHCR publish or paid service was started.

Still unverified: real public HTTPS/WebSocket/cookie routing, authenticated
cloud startup, private GHCR pull, RunPod queue/cold/warm latency, actual
NVENC usage, image quality, A/V lip sync and billed cost. A separate staging
environment, exact package approval and GPU budget/stopping decision are the
next external steps. Do not infer a 2–4 s first response from synthetic tests.

## Source and scope

This separate working copy was cloned from
`https://gitlab.com/EmaCodeHero/astrid-gpu-worker.git`, commit
`d3a2d0a6672079033a0de3666a8d14122c06e90c`.
The local working branch is `jakemanator123-github-work`. The GitLab remote
is named `upstream` and its push URL is disabled. No GitLab write is authorized.

The objective is continuous PCM input and synchronized audio/video output before
the end of an utterance. Retain MuseTalk 1.5, the existing avatar and composition,
and the complete-file path during integration. Protocol tests and synthetic video
cannot approve the generated face or prove production latency.

## Responsibility

- This work owns the isolated worker and its streaming relay/reference player.
- Croupier's other active chat owns cloud topology, storage and repository cleanup.
- Shared Croupier changes require coordination before editing overlapping files.
- Actual Croupier player integration, authenticated cloud deployment, GPU timing
  and visual acceptance remain required. The reference player is a test surface.

## Build corrections

Both avatar preparations now have to succeed during the Docker build. Previously
the build swallowed errors and deferred preparation to the next cold start.
The model download helper returns failure rather than exiting the shell so its
documented secondary download source can actually run.

## Verification record

Local verification on Windows, Python 3.13, Node 22.22 and FFmpeg 9.0.1:

- Python: 9 tests passed. Real FFmpeg emitted media before input ended;
  ffprobe verified H264 High level 4.2, AAC, 24 fps, monotonic timestamps and
  audio/video ends within 90 ms. Full decode passed. Cancellation, failed
  encoder startup, session reuse and v1 compatibility passed.
- Node: 13 tests passed. Actual loopback WebSockets covered credentials,
  ownership, single-use tickets, bounded input and cancellation. Mocked Cartesia
  responses verified PCM before EOF, odd byte boundaries, timeout and cleanup.
- Chrome reference player: first decoded frame at 211 ms; terminal event at
  4,524 ms with a pre-encoded synthetic MP4.
- Full local chain with the actual Python session and FFmpeg, synthetic model
  frames, four seconds of PCM sent in real time: first decoded frame at 854 ms,
  terminal event at 4,422 ms, 114 frames, buffered duration 4.793 seconds.
  First frame preceded BOTH input EOF and the terminal event. No browser error.
  Reproduce with `node gateway/test/python-browser-fixture.mjs <ffmpeg-path>`
  (Python with websockets installed), open the printed loopback URL and click
  Start full-chain check. Fixture owns and cleans its temporary resources.
- Python compilation, shell syntax and `git diff --check` passed.
- Independent review identified and repaired buffering, sample rounding,
  encoder drain/startup, malformed JSON and stale-session lifecycle errors.

These timings measure synthetic local transport. They do not measure MuseTalk,
Cartesia, Render networking, cold starts, facial quality or production speedup.
Docker/GPU image build has not run locally because Docker is unavailable.
No new image, GitHub push, deployment or paid API call has been performed.

## Implemented path

`gateway/cartesia-source.mjs` yields bounded PCM16 mono at 24 kHz. The trusted
application calls `openSource` with the exact authenticated user, session and
utterance ID. Audio goes directly from that server to the GPU worker; the browser
receives a single synchronized H264/AAC fMP4 stream. The old full-file worker
path remains available. Only one worker job is active at a time.

The worker emits new frames in 12-frame blocks with overlapping audio context.
It preserves the existing avatar composition and global utterance boundary ramps.
Repeated Whisper windows may increase compute: the upstream feature extractor
can pad to 30 seconds. Measure time per block on the real GPU before deciding
whether to cache features, change block size or replace the audio encoder.

## Remaining integration and acceptance

This section records the standalone clone's handoff. The service is now vendored
into Croupier and its server/shared-player integration is implemented. See
`../../../docs/STREAMING-INTEGRATION.md` for current validation and outstanding
deployment work. The current scoped endpoint configuration has since returned
HTTP 200 to a read-only health request; no GPU job was submitted.

1. Coordinate shared Croupier edits with the cloud/storage chat. Its working
   tree currently overlaps generated speech and the presentation API. Reading
   its status succeeded; sending coordination messages was rejected by automatic
   approval review and awaits the user's explicit confirmation.
2. Choose the GitHub delivery location within the approved repository workflow.
   This clone has no writable remote and must not be pushed onto an unrelated
   GitHub history. It contains the source provenance needed to vendor the service.
3. Preserve Croupier's paid-request deduplication, `beforeCostly`, round/owner
   checks and cancellation when connecting the streaming source. Current
   `web/generated-speech-provider.mjs` buffers the complete TTS response.
4. Return an early stream descriptor/ticket through
   `web/generated-speech-chat.mjs` and `web/server.mjs`. A live descriptor is
   not a finalized, hash-verified speech package.
5. Integrate one audible video in the shared
   `web/public/generated-speech-player.mjs`, preserving pose gates, receipts
   and cleanup. Add the explicit stream branch in `web/public/app.mjs` to avoid
   its browser-TTS fallback. Preserve both native-lab and social-chat consumers.
6. Build the GPU image, deploy an authenticated staging relay and connect a
   warm worker. The local endpoint setting did not validate as a RunPod ID or
   known endpoint URL; the read-only health helper sent no request. A subsequent
   read-only endpoint-list request with the existing API key returned HTTP 403.
   This does not establish whether that key can call a specific scoped endpoint.
   Correct
   endpoint, staging destination and GPU budget are required for the real test.
7. Compare the same short/long lines on cold and warm workers; record first TTS
   byte, first encoded media, first decoded frame, total time, GPU throughput,
   queue time and cost. Test cancellation and two consecutive utterances.
8. Before production admission, run the Croupier required player/media checks
   and visually review all four dealers. No avatar/media files or calibration
   were changed by this implementation; no visual acceptance is claimed.
