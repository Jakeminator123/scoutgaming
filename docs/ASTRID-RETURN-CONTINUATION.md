# Astrid centre return — 10 September 2026

CAC-4 has a new **partial, opt-in candidate inside the actual blackjack app**:
`/?dealer=astrid&performance=staged&rehearsal=1&continuity=review`.
The ordinary staged route and all four original deliveries remain unchanged.
Use a centre main bet to exercise the new return, followed by Astrid's own card.
The rehearsal panel's **Watch centre return test** opens the actual initial-deal recording.

## What changed

After a centre delivery, the hand returns directly to the front shoe outlet when another card is already scheduled. The next compatible delivery resumes at its registered shoe-ready frame 55. The final card of a sequence keeps the original return to rest, including after a split. Hit/double and other single-card calls do not request a continuing tail. This does not change server commands, shoe consumption, cards, wallet or settlements.

The centre candidate preserves original frames 0–124, including pickup 69, release 116 and landing 122. It appends frames 1–55 of the silent empty-hand return generated in job `1b1fba28-e83e-43c7-acdf-385cf265074d`. The generated background and its stray tracking card are excluded by the actor matte. RGB and alpha remain packed into one 180-frame, 24fps video at native 1080p. Playback stays 1.75x; speech assets and audio are unchanged.

Continuation metadata binds the original take's media/calibration hashes, unchanged delivery records and the precise next pickup. A source, camera or timing change invalidates the join. Seeking completes before displaying the next layer; the previous presented actor remains visible until its replacement is painted. Card attachment and cues still use the presented frame. Review candidates require explicit staging and cannot enable themselves through ordinary table approval.

While building this asset, the packer produced 180 clean frames but 181 packed frames. Concat and image inputs used different time bases. Both now use exact 1/24 frame ticks before stacking. A regression reproduces that exact 125+55 frame case with small synthetic media.

## Actual checks

All gameplay used isolated **127.0.0.1:4180**, with no edits to the user's databases.

- Initial deal: $1,085 → $1,080 after a single $5 bet. A-spade / 4-spade against dealer 10-club and a hidden hole card. Both own-card deliveries began at frame 55 after the centre return. No blank actor layer, extra card or performance error was observed. Stand settled at $1,080, bet zero, cards cleared.
- Inspected the delivery/return join at source frames 124/125 and the next-pickup join in captured game frames 0253/0255. The pose remains close through these joins without an actor dissolve. This is a limited frame inspection, not approval of all contact or motion.
- Refreshed during centre return frame 168 on a subsequent $5 round. The balance remained $1,075; the server restored 9-spade / 9-heart against dealer 3-club and the same hidden hole card.
- Split that pair. The additional $5 was deducted once, balance $1,070 and total stake $10. Hands became 9-spade/J-spade and 9-heart/9-diamond. The second delivery resumed at frame 55 and ended at original resting frame 168. Standing both hands settled at $1,090 with $20 returned, zero bet and no cards.
- Goodluck played twice sequentially for Vera, Amira, Mei and Astrid through the actual rehearsal interface. Astrid retained embedded audio/video. No original dealer assets changed; this is not complete phoneme acceptance.
- Deep dealer probe, performance media probe and all **42 hook tests** pass. The four original manifest takes are byte-for-byte equivalent as parsed JSON to the preceding checkpoint. Physical Safari/iPhone/Android tests remain outstanding.

Public evidence: [in-game recording](../web/public/dealers/astrid/performance/continuous-return-game.mp4), [checks](../web/public/dealers/astrid/performance/return-continuation-checks.json), [source provenance](../web/public/dealers/astrid/performance/return-continuation-provenance.json), plus before/after join PNGs in the same directory. The recording is silent and preserves elapsed browser capture timing. Private raw frames, speech logs and recovery traces are under `content/staging/2026-09-10/return-bridge/in-game/`.

## Remaining work and Jira

CAC-4 moved **In Dev → In Testing → In Dev** during this work. The centre-to-next-pickup join improved, but the full ticket still fails: left, right and own-card return tails still fold to rest; source motion remains soft; initial speech/action pose changes remain visible. Keep CAC-2 in Dev for exact seat contact. CAC-1/3/5/6/7 remain Ready for QA. No issue is Done and no default production promotion occurred.

Next: inspect this candidate with the reference at normal speed, then prepare matching empty-hand return actions for the remaining directions only if this approach holds up. Do not reuse the centre return on a different hand pose or warp the hand to another seat. Controlled performance capture remains the alternative if generated actions cannot meet contact/continuity acceptance.

## Rebuild

`pipeline/build-return-continuation.mjs` binds the original centre source and new bridge hashes. To reproduce on another Mac:

1. Create `content/staging/2026-09-10/return-bridge/`, and copy the committed `web/public/dealers/astrid/performance/return-bridge-source.mp4` there as `source.mp4`.
2. Extract all video frames to `frames/%04d.png` using ffmpeg, preserving 24fps.
3. Compile `pipeline/person-mask.swift`, then run it on `frames/` with output `person/`.
4. Run `node pipeline/build-return-continuation.mjs`. This creates a **pending** review candidate and a private recipe. Rebuilding does not carry over visual acceptance.
5. Run `node pipeline/audit-performance.mjs --probe`, the dealer probe and hook suite, then inspect the joins in the actual game.

The committed bridge source contains the generated room and moving tracking prop for provenance; the runtime loads only its isolated packed derivative. No additional generation credits were used for integration, masking or these checks.
