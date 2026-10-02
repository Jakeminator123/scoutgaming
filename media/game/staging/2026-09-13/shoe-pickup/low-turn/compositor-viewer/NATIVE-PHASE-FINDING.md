# Rendered phase investigation: fractional shoe gating defect

Used actual Chrome tab1851095242 through CUA, since in-app browser was unavailable to this agent. Opened /native-phase-review; both native layers confirmed paused at1.441666s (joined86 midpoint), then clicked card85,86,87 and inspected actual composed browser screenshots. No evaluation-based browser mutation or headless UI. The diagnostic page now fits its whole scene within viewport so both hands remain visible.

The feeding-hand backcard is a narrow clipped strip at card85, but broad full rectangle at86 and87 while the actor is held at86. The source residual white edge under that hand persists. Receiving-hand/card gap and thin background streak persist across offsets; moving card one frame ahead is not a demonstrated remedy.

Concrete cause: camera-card-fit/shoe-mask/contract.mjs requires Number.isInteger(nativeFrame). Joined85=source34,86=34.4,87=34.8. Card2 remains active inside extraction31–37 in allthree. Only85 enables shoe masking. This is a repeatable visual alpha pop in fractional60fps frames, independent of native callback delivery. The saved native-phase-shoe-gate-analysis.json enumerates affected rows across allfour extraction windows.

Bounded fix proposed to root: accept finite source positions within calibrated inclusive extraction ranges; retain active-status/id/range checks. Add tests for34,34.4,34.8 plus exact boundaries, just-outside, NaN/Infinity, unknownid and inactivecard. Do not round positions: rounding can prematurely enable or extend source occlusion. Inspect native actor86/card86 after fix and dense extraction window for allfourcards. Continuous mask gate is not automatic proof every window boundary itself is physically correct.

Saved full playback receipts remain timing/callback evidence, not a recording of the physical display. They do not establish a consistent one-frame phase correction. Do not add a global lead from those logs. Resolve the proven fractional mask bug first; dynamic compositor recording is still needed for any remaining phase claim. No public runtime, mask contract or clock changes made in this investigation.

## Fresh-import rendered verification after finite-position fix

Repeated via new Chrome tab1851095251, after root changed integer validation to finite source positions. Captured actual CUA screenshots for actor86/card86, actor86/card85 and actor86/card87. The feeding backcard stays clipped beneath the shoe for allthree; the prior broad rectangle exposure at86/87 is gone. This confirms the narrow reported defect in the rendered native-layer/GPU composition, not just a predicate test. No global clock offset was introduced.

Screenshot evidence is retained in this agent's CUA tool outputs (beforetab1851095242 and aftertab1851095251), not exported local PNG files. Before/after viewport heights differ, so these are visual evidence rather than a registered pixel-difference pair. Do not describe them as identical-resolution numerical image comparisons.

Remaining defects: source white fringe around feedinghand/card and thin residual line near receivinghand persist; no assertion that this resolves full extraction anatomy, background removal, dynamic synchronization, allfour window endpoints or seven-seat gameplay.
