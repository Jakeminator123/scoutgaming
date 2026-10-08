# Phone lag investigation — 26 September 2026

User reports Chrome on iPhone over 5G. Physical device not attached, so the exact
reported stall is not yet reproduced or confirmed resolved.

Confirmed excessive work: server state polls rerendered the complete table even
when only serverNow changed; a 20 Hz loop rewrote hidden/countdown UI; every video
frame rewrote stationary cards. Now unchanged snapshots skip full rendering,
clock writes are change-driven, hidden tabs pause polling/sync, and stationary
card poses do not rewrite SVG. The end of a dealer sequence explicitly updates
controls even if server state has not changed. Video bytes, 1080x1920 resolution,
card frame geometry, payouts and authoritative server timing are unchanged.

Deterministic one-seat round, local disposable DB, providers disabled:

| Browser | UI mutations before | after | Round after |
| --- | ---: | ---: | ---: |
| Chrome, 6x CPU slowdown, 50 Mbit/s and 40 ms configured latency | 18,467 | 7,452 | 21.9 seconds |
| WebKit with iPhone 13 viewport/device settings | 18,886 | 7,638 | See JSON |

Both completed normally with no JS errors and full-HD video. Scripts assert
settlement within 45 seconds to catch delayed decision controls/auto-stand.
WebKit emulation is not iPhone hardware. WebKit after had one 112 ms frame gap;
its end-of-run per-element playback counters include hidden/reused video, so
these do not prove dropped-frame-free physical-device playback. Mutation counts
are evidence of less UI work, not proof of resolving the user's specific stall.

Server spot-check: load below 1, ample memory; public video range HTTP 206,
first byte 90 ms and 1 MiB transferred in 376 ms from this Mac's connection.
These timings do not measure the user's mobile carrier route.

Opt-in `?diagnostics=1` adds Copy playback report. It collects bounded in-memory
video events, long frames, API/media timings and browser information. No report
is sent automatically. Normal mode has no additional monitoring or button.
Clipboard export and normal-mode absence checked in Chrome.

69 unit tests pass. Run profiler against the isolated local server on 8634 with
TABLE_DB=/tmp/astrid-phone-debug.sqlite. BASELINE=1 serves pre-fix modules from
0ed16cc. Never point this fixture at a deployed database.
