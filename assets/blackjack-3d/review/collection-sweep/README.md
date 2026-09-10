# Single-stack collection review

The opt-in actual game now gathers finished server cards along one continuous path, forms one packet, and makes one placement in the existing discard tray. Cards stay still until contact. The two hands exchange the packet near the centre; the first card remains on top. The legacy individual collection study is retained for editable-source compatibility.

`round-final.json` records the first actual three-seat sweep: eight cards gathered, discard count 74, zero live cards, final demo balance 977.50. The round returned 5 against 15 stake. The earlier interim balance was 972.50. The initial balance before this particular test was not independently recorded; do not infer it from a previous unrelated round.

`sweep-in-game-silent.webm` is an extract from the real game recording. It has no audio. `sweep-contact-frames.png` samples the player-card gathering; it is not a full native-resolution fingertip proof. The complete source recording is retained in private staging.

Independent skin tests cover all seven seats and the outer four split hands. The sixteen-card sample lasts 8.8875 seconds over 268 frames, with minimum hand height 911.25mm and maximum active fingertip offset 0.7003mm. These are mechanical checks; professional motion and photographic likeness still require visual acceptance. The first faster handoff was rejected after a wrist-discontinuity failure; the larger preparation interval passes the same check.

New runtime gathering foley requests are generated only when another card joins the packet, coalesced at 80ms during dense fans; there is one landing cue. Existing mute/visibility guards prevent delayed sound replay. The first recording predates the new soft gathering foley, so it cannot approve sound quality.

Regenerate the editable animation samples with `node pipeline/sample-dealer-collection.mjs <separate-study-directory>`. Every sample includes independent card IDs/transforms plus the real 56-bone poses; it does not create cards or balances. The collaborating dealer task bakes this as an additional standalone study preserving the twelve earlier actions.
