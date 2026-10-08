# Full-quality mobile video buffering — 26 September 2026

The video and audio source files are unchanged: 1080×1920 H.264, 24 fps, original sound and frame timing. No re-encoding or lower-resolution variant was introduced.

Previously six idle files fetched together at startup and game media loaded only when its server timeline started. The browser now downloads one source at a time, prioritizes game clips and plays complete original-byte Blob buffers. Repeated sources reuse the same buffer. The cache has a 96 MiB target with LRU eviction; video elements pin their current sources. Idle variation is loaded gradually only after game preparation, while a cached idle continues playing.

Selecting boxes and confirming starts preparation of those boxes, currently occupied boxes, the dealer and the exact prerecorded announcements selected by the shared server. Joining and new bets await preparation; errors allow retry. New server plans also warm upcoming clips. Server cards, money, outcomes and deadlines are unchanged. Newly joining players in an already active shared round remain subject to its existing server timeline.

## Reproduction and evidence

Run the isolated server with disabled providers (see BMM-PREPARATION.md), then `node tools/check-mobile-buffer.mjs`. The harness uses installed Chrome, a 390×844 viewport, 4 Mbit/s downstream, 120 ms configured latency and 4× CPU slowdown. This is browser emulation, not a physical iPhone/Safari result.

The cold-cache test completed betting, side bets, decision, settlement and collection. No visible mid-clip waiting/stalled/error event occurred during the round. Both video elements decoded at 1080×1920; final playback counters reported zero dropped frames. Each downloaded MP4 had exactly one network request. Evidence: measurement.json and mobile-settlement.png.

Initial video started after 10.5 seconds and full-quality preparation took 43.9 seconds on this intentionally constrained cold connection. The selected one-box game pack is 20.9 MB / 13 clips. This first preparation cost is explicit in the UI; it is not represented as instant loading. Cached repeat playback avoids that download cost. Very slow connections, OS memory pressure and physical-device decoder behavior still need device-specific validation.

63 automated tests pass, including buffer deduplication, transfer priority, exact original payload preservation, retry/eviction and matching the server announcement selection. All prior payout, shared-table, sound, timeout and security tests remain green.
