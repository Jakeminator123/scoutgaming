# iPhone dealing freeze and clip transitions

The supplied iPhone recording shows the dealer held near the shoe around 9–12s,
then a card appearing without the visible arm movement. Similar holds recur.
The accompanying report has no waiting/stalled events or recorded frame gaps,
readyState 4, and API responses of 32–67 ms. The visible recording therefore
invalidates treating those decoder callbacks alone as proof of smooth playback.
A display/compositing or Blob-backed playback problem is suspected; the precise
physical-device cause is not established by desktop browser emulation.

Changes:
- iOS prepares the original full files but uses their HTTP URLs for native media
  playback, rather than passing Blob URLs to the media decoder.
- The next clip is loaded into the inactive video element before its deadline.
  Replacement requests cannot be overwritten by a late preload.
- Show the prepared video layer before calling play; explicit stacking and
  compositor isolation keep the active video underneath the game overlays.
- Avoid tiny startup seeks (<=150ms); larger offsets still catch up, and server
  deadlines/card tracking remain authoritative.

Original 1080x1920 source files are unchanged. HTTP range/caching may differ from
Blob playback on iOS and must be confirmed on the user's phone/network.

74 unit tests pass. Full deterministic rounds complete in WebKit iPhone emulation
and Chrome with a mobile viewport and 6x CPU slowdown. Both use native media URLs
under the iPhone user agent. See JSON for actual counters; screenshots introduce
some frame gaps and are not equivalent to physical iPhone hardware. The early
and contact screenshots explicitly verify visible arm motion, not just media
clock advancement. Source preloading still runs without playing hidden clips.

The user's video is not copied into the repository. Frame extraction/review used
the local watch skill and ffmpeg, without external transcription.
