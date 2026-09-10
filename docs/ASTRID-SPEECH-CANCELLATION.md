# Speech cancellation — 10 September 2026

The shared speech queue now cancels both active and waiting lines when sound is muted or the document reports hidden. A line still waiting for its audio bank keeps its cancellation signal after sound returns, so it cannot start late. Cancelling also releases the gameplay wait; later valid events can speak normally. Repeated requested lines remain sequential.

## Browser reproduction and result

A disposable copy of the actual server delayed Astrid's `audio/en/bank.json` response by 20 seconds. It used a separate SQLite database and distinct `speech-qa.localhost` / `speech-fixed.localhost` hostnames. The baseline served the committed `2be4795` application; the second run served the changed application. Both used the normal staged game without rehearsal, because the rehearsal panel itself awaits a second bank request before preparing the table.

- **Before:** a $5 round requested goodluck, then sound was muted and restored within 13.356 seconds of navigation. The old queue started the cancelled embedded goodluck at 00:45:51.759 UTC, about eight seconds after the mute/unmute interaction. Dealing waited for that unwanted speech.
- **After:** the same interaction completed within 17.928 seconds, before the delayed response. Dealing began immediately after cancellation and goodluck never started. The natural blackjack round debited $5 once, returned $12.50 and settled at $1,007.50 from $1,000. The new blackjack and placebets lines subsequently completed in sequence.
- **Active native speech:** Astrid's goodluck was interrupted after its video became visible. It ended after 0.751 seconds; the queued repeat did not start. Caption, native video layers and packed-speech state were cleared after unmute.
- **Active stream speech:** Vera's goodluck was interrupted after its caption appeared. It ended after 0.788 seconds, the queued repeat did not start, and the caption cleared.
- **Roster:** Astrid, Vera, Amira and Mei each played goodluck twice through the actual rehearsal interface. Every first completion preceded its second start. `speech-roster-playback.json` records the event ordering and interruption checks.

Compact before/after event evidence is in `web/public/dealers/astrid/performance/scene-acceptance/speech-cancellation.json`, with a settlement screenshot beside it. Raw browser logs and screenshots are saved privately under `content/staging/2026-09-10/speech-interruptions/`.

## Regression and limits

Three new queue regressions cover cancellation during bank loading, visibility cancellation and sequential repetition with active-audio cleanup. The full hook suite passes 45 tests, including the existing media/player, contact, layout and reporting checks. The deep 90-stream dealer audit matches the unchanged baseline. No dealer media, voice, calibration, card, wallet or login behavior was changed.

The browser automation kept reporting `document.hidden === false` when switching its tabs. Actual hidden-tab behavior is therefore **not browser-verified** here; the visibility lifecycle has unit coverage only. These checks establish cancellation and sequencing, not phoneme accuracy or physical mobile/Safari acceptance.

CAC-2 and CAC-4 remain **In Dev**. Their full hand-contact and professional-motion requirements are still open. This timing fix does not approve the rejected right/own-card returns, promote staged rendering, or complete the Astrid milestone.
