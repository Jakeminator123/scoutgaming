# Native actor layers and independent card clock

Run the existing staging server and open `/native-layers?full=1&codec=709&cardClock=display`. Omitting `cardClock=display` retains the callback-driven baseline. This four-delivery diagnostic uses explicit review card values; it is not server-bound gameplay and does not reach all seven actual seats.

Rear and foreground finger videos are native transparent VP9 layers. Independent card geometry is sampled from the existing ledger; the clock does not retarget geometry or change source motion. The optional display sampler uses rear video mediaTime/expectedDisplayTime anchors, with no assumed refresh lead. Stale anchors hold the last card frame after min(100ms, max(50ms, 3 median RAF intervals)); 50ms covers three source frame intervals. Front-layer stalls are diagnostic only, with visibility accounting for the verified transparent return tail. Pausing, seeking, restarting and colour comparison cancel the sampler.

## Browser evidence

- Baseline: rear3/front1 reported video drops.
- First display sampler:349 sampled card frames after initial0;24 indices recovered without rear callbacks. One reported video drop per layer.
- Guarded run:348 sampled card frames, missing1;32 callback gaps recovered. No stale/front warnings; one reported video drop per layer.
- Consecutive guarded run:347 sampled card frames, missing5/86; rear1/front2 video drops.
- The final50ms source-frame floor leaves these approximately60Hz runs' threshold unchanged; its arithmetic was checked at240/120/60/30Hz.

`analyze-display-clock.py <receipt.json>` saves reproducible coverage and submission-timestamp analysis. GPU submission times and expected video display times are not actual composited presentation proof. Frame86 remains a meaningful motion-coverage gap in the repeated run. No perfect phase, all-frame smoothness or gameplay acceptance is claimed.

`native-layers-709-opaque-absolute-browser.json` now measures absolute/max errors: opaque control matches all sampled source RGB pixels exactly at the three sampled timestamps, while native-alpha colour residual remains. This does not establish equality outside the sampled pixel domains. No RGB correction was applied.

Required pre-commit checks and dealer-sync probe passed. Public gameplay and asset baselines were not changed. Full seven-seat source motion, release/return and rendered gameplay verification remain unfinished.
