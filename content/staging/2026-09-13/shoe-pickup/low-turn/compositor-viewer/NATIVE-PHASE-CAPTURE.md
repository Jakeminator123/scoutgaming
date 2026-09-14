# Frame 86 rendered-phase experiment

Staging only. This is a capture procedure and paused comparison tool, not a synchronization result.

## Serving (root-owned server)
Add these two routes to the existing explicit route map; no new server or headless browser is needed:
- `/native-phase-review` → `path.join(here,'native-phase-review.html')`
- `/native-phase-review.mjs` → `path.join(here,'native-phase-review.mjs')`

The tool uses the existing full350 BT709 rear/front routes, joined ledger, rigid GPU card renderer and authoritative nominated card identities. Actor/video frame N seeks at `(N+.5)/60`; card N+offset uses that exact ledger row without geometry interpolation. Both native video elements remain real visible browser layers. The actor is never painted into a synthetic proof canvas.

## Static contact reference
Using allowed CUA UI clicks/screenshots, open the page and capture actor86 with card85,86,87, then matching83–89. Keep viewport/scene size constant. The heading labels the deliberate card offset. A visible browser screenshot must show both finger contour and independent card; a GPU submission time or `seeked` event is not a screenshot. If a texture has not loaded, wait and repeat Seek before capturing. This establishes what a one-frame phase error LOOKS like at the previously missed frame86. It cannot establish moving playback timing.

## Moving proof
Open the unchanged A/B playback route `/native-layers?full=1&cardClock=display` in the foreground. Capture the actual composed browser window via an available permitted screen-recording surface or a user-selected browser display capture, including both DOM videos and card canvas. Do not substitute a canvas-only `captureStream`, ffmpeg compositing, headless screenshot loop, or scripted browser evaluation: those do not sample the native display compositor being tested. If the allowed CUA surface offers only screenshots, report dynamic capture unavailable instead of claiming 60fps motion from sequential screenshots. The existing `tools/bugshot.sh` invokes an interactive OS screenshot picker; it does not record dynamic video. `pipeline/inspect-contact-capture.swift` analyzes already saved frames; it is not a browser recorder.

Record at least three normal-speed plays, including scene and mode label. Preserve source capture frame rate/timestamps. Extract the small window around joined86 (1.4333 seconds after native presentation start) and compare the photographed hand/card combination against the paused85/86/87 references. Identify actor pose from visible pixels, not only the displayed status text: UI labels and native video can be presented in separate compositor phases. At60fps capture the capture/display phase is itself uncertain by about one frame; repeated captures or a higher-rate external display recording are needed to resolve a persistent one-frame offset. Do not invent a lead to compensate an unmeasured capture phase.

For each captured frame record: capture PTS, closest visually observed actor reference, closest card geometry reference, fingertip/card overlap error, and uncertainty. Preserve original capture and cropped proof. Compare both callback baseline and display-clock mode at the same viewport. The native-quality counters, rear/front callbacks and RAF paints are auxiliary timing evidence only. A static contact failure cannot be fixed by advancing the clock; a good static contact reference does not prove dynamic synchronization.

## Acceptance boundary
No dynamic recording has been made by this helper. Native layer color residual and source-mask/contact limitations remain inherited. All-seven-seat gameplay and visual acceptance remain outside this diagnostic.
