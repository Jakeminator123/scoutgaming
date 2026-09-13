# Astrid physical dealing QA — 2026-09-13 21:54–21:55 UTC

Tested actual installed smooth60 gameplay on a new isolated demo guest at http://astridcontactnightqa.localhost:4173/?dealer=astrid&performance=staged&motion=smooth60. Seven seats, 5 demo units each, opening, one hit at seat 6, six remaining Stand decisions, settlement. No database or server-state edits. No other dealer, user tab, code or media changed.

## Result

Lifecycle passed this round, physical dealing remains rejected. Final screenshot shows PLEASE PLACE BETS, balance 965, total bet 0, last win 0, empty table. No browser warning/error logs. Paired goodluck, bust, lose and placebets started and ended. There was no dealer additional draw in this round.

## Measured latency

- DEAL NOW click: 21:54:02.384 UTC. Goodluck speech 02.532–07.694 (5.162 sec).
- Initial entry-3: 07.814–09.775 (1.961 sec). First actual dealing action: 09.865. Click-to-action 7.481 sec; speech-end-to-action 2.171 sec.
- First action starts: 09.865, 10.919, 11.986. Cadence roughly 1.05–1.07 sec in these first intervals. This is log action start cadence, not native-frame measured card contact.
- Last opening dealer face-down action: 23.216–23.872. Ready-exit-34: 24.061–25.471. Moving ready loop starts 25.541. Fourteen player cards arrived.
- Hit click: 21:54:37.000. Ready-loop boundary 37.821; ready-entry-3 37.873–39.339; actual dealing 39.475–40.354. Click-to-action 2.475 sec, of which loop wait 0.821 sec and entry 1.466 sec. It is not simply slow card travel.
- Ready-exit-21 40.410–41.871; loop 41.983–42.991; ready-speech begins 43.066; matched bust speech 44.590–46.009. Hit changed seat 6 from 17 to 22. Controls resumed and remaining seats completed.
- Settlement lose speech 21:55:29.589–31.258; placebets 31.333–33.634.

## Visual observations and highest-impact defect

During opening, the tool screenshot at 21:54:17.485 captured source frame 36, action deal-right, phase contact, retarget false. Astrid's feeding hand already holds damaged red-backed source paper above and to the left of the fixed shoe while the delivery hand points toward the table and the separate game card is placed. The visible paper does not emerge through the actual shoe outlet. Earlier screenshot during first cards showed the same disconnected source paper. These contact screenshots were displayed during QA but not persisted; do not represent opening-ready.png as a contact-frame capture.

The real shoe has its opening near the right-hand table edge, below the source feeding hand. Successful server card arrival does not prove extraction or correct physical grip. Faster playback or more interpolated frames will not repair the disconnected starting geometry. Highest priority remains a continuous source with empty hands, actual outlet extraction, transfer, low face-up release, and empty return, matched to the installed shoe and camera. A genuinely matching ready/shoe start would also eliminate the 1.5-second ready bridge and much of the perceived dragging without speeding up the useful delivery itself.

## Evidence

opening-performance.json and final-performance.json contain live action/transition timestamps. speech.json contains paired speech logs. errors.json is empty. opening-ready.png and settled.png show rendered opening completion and final state. final-dom.json records settled DOM state. No physical acceptance is granted.

## Repeatable evidence helper

Run `node content/staging/2026-09-13/shoe-pickup/gameplay-qa/acceptance.mjs` from the repository. It reads the captured browser logs/click times/settled DOM; computes click-to-action and transition durations; verifies every current smooth60 media SHA against its manifest; writes acceptance.json. It never accesses game APIs, fabricates cards, or mutates gameplay. A zero exit code verifies only captured lifecycle/errors and current disk media integrity. Physical extraction remains explicitly NOT ACCEPTED.

For a future run, use an isolated hostname, interact through CUA, record the timestamp immediately before each UI click, and export tab.dev.logs filters [performance] and [speech], warning/error logs, and settled DOM into a separate report folder with this helper. Preserve the raw timestamps and record any reload or failure. The currently observed right contact take is astrid-smooth60-deal-right; exact current SHA, all other selected smooth60 take SHAs, and registered source-camera coordinates are preserved in acceptance.json. Current file SHA is not proof of historical browser response bytes.

For exact current screen-space shoe evidence, click the existing calibration control and Capture clean camera reference, then read #performance-capture-status.dataset.registration through read-only DOM evaluation. That public UI exposes shoe.screen (normalized viewport), camera matrices, viewport size and dealerRect. Save the JSON and accompanying screenshot, then press Escape to restore presentation. Multiply shoe.screen by captured viewport dimensions only; do not treat manifest camera.shoeOutlet as live screen coordinates. The source manifest declares [0.63265625, 0.5511111111111111], but this run did not capture live camera registration. CUA provider became unavailable after the settled round, so no new coordinate claim is made.

Compatible latency fix: retain exact goodluck audio/video pairing and speech completion; replace the 1.961-second idle entry only with a continuous matched source beginning at the preserved speech-idle endpoint and arriving directly at the real shoe. For subsequent hits, source beginning/ending in the actual moving ready pose can replace the 1.466-second bridge, while retaining the loop seam boundary. Do not truncate the paired sentence, release the overlay early, accelerate the whole actor, or merely relocate an unattached UI card to the shoe. Source correction and in-game camera/contact verification must precede that change.
