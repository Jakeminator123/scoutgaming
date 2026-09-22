# Amira room, table and supplied speech/idle integration — 20 September

Review server: isolated guest4211, public linked to the working repository. No
production deployment, live database changes or provider video generation.

## Visible changes

- Amira uses the Blender table and Scout felt branding, with original palette
  #665139. Astrid palette restored to #263336.
- Built-in GPT Image edited Amira's original room into scene-clear-v2.png:
  cleared foreground tables, raised lighting, increased visible floor. Original
  room preserved; prompt/receipt are in ../amira-room-clean/. Actual1672x941.
- Fixed blank/tiny card indices when a Blender table has no PerformancePlayer:
  both dealing and settled cards use the same textured card artwork. Amira has
  taller narrow rank/suit indices and stronger black/red contrast, without
  scaling physical cards. Dealer total is left of the fan. Dealer fan is now
  19cm ahead of the rear edge, retaining a gap above the center player fan.
- Installed all17 supplied keyed speech clips and exact paired recordings.
- Installed the exact waiting job5f2929a3 with continuous native movement.
- Astrid filmed dealing is temporarily disabled as requested. Shoe-based card
  delivery remains active; her current idle/lipsync are retained.

## Observations and evidence

All17 Amira lines completed via actual rehearsal (amira-all-lines.json); native
face/eye/badge alpha was checked separately. Vera two-play goodluck completed
(vera-twice.json). Amira seven-seat round reached settlement, stake35/return40;
opening cards, hit and chips were observed (amira-round-log.json and images).
After waiting/jumbo installation, greeting and goodluck twice completed, idle
resumed across eight wraps, and center9S+7S hit busted and settled stake5/return0
(amira-loop-round-log.json, amira-jumbo-opening.jpg). No playback warning/error.
Autoplay correctly deferred greeting until the first gesture on a fresh host.

The last small dealer-fan adjustment22cm->19cm passed projection tests but its
final browser capture was interrupted when test tabs were closed. Fresh Mei and
Astrid two-play rechecks were also interrupted by tab closures; do not describe
those final rechecks as complete. Earlier all-four shared-player regressions
are recorded in the handoff. No all-dealer visual approval is implied.

## Remaining limitations

Waiting uses the newer2K plate while all17 supplied talks use the older1K plate.
Waiting is sharper/warmer and its left hand/jacket pose differs. A rigid head
translation helps alignment, but the speech boundary is not visually seamless.
Speech can wait up to5.04s for a forward-facing idle boundary. Native recordings
are not newly generated HD speech and measured zero source audio lag is not
proof of perfect mouth motion.

Validation:18 focused tests, full repository pre-commit, dealer-sync --probe.
Probe concerns the unchanged legacy asset baseline; the new review-bank hash,
audio pairing and loop invariants are covered by test-amira-green-speak.mjs.
