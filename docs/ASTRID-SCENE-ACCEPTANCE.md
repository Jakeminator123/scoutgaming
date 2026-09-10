# Astrid scene acceptance — 10 September 2026

CAC-1, CAC-5 and CAC-7 passed their reported background and cutout checks on the staged Astrid table. They moved from Ready for QA through In Testing to Done. CAC-3/6 were already Done for their control/total overlaps. **CAC-2 and CAC-4 remain In Dev for delivery coverage and natural motion.** This checkpoint does not approve the full table or promote staged media to the default route.

## Scope and evidence

The current descriptions, Expected Result text and available custom fields were read. CAC-1 describes older speech bringing back a different room; CAC-5 requires aligned background lights during gameplay; CAC-7 requires a clean actor edge without regenerating the model. No separate Expected Result custom field exists on these reports; the expected text is in the description.

The implementation under test is checkpoint `d0c1361`: one room plate, isolated original Astrid speech, isolated embedded speech and the shared GPU edge treatment. No speech, action media or playback calibration changed during this acceptance pass. All play used the separate 4180 database. Guest access remains enabled.

- **Desktop, 1920×1080:** all 17 selectable Astrid lines played through the actual rehearsal interface. There are 132 timestamped screenshots from caption start to end. Both native goodluck/win and the older stream-based speech were included. Chatter lines were selected explicitly for asset coverage; small talk was not enabled in gameplay.
- **Room continuity:** both former seam regions remained pixel-identical to the resting room across all 132 captures. Actor isolation was enabled and the secondary room was absent in every sample. A normal three-seat deal added 202 captures covering all four delivery directions and the two opt-in return candidates. The unobscured left and right background-light regions remained pixel-identical throughout.
- **Occlusion qualification:** the initial right-side probe included pixels covered by Astrid when leaning right. Frame 0117 was inspected; the difference was her face occluding the room. The recorded background-only probe excludes that strip. This is documented in the raw measurements.
- **Actor edges:** original-resolution hair, face, suit, sleeve and hand crops were inspected during speech and the four delivery directions. The reported white cutout fringe was not visible in these samples. Existing generated movement softness and pose discontinuities remain separate, open motion defects.
- **Phone viewport, 390×844:** goodluck, lose and placebets were sampled. A normal game without the rehearsal overlay was then captured in 57 frames through speech, player delivery, upcard and hole card. The continuous room and clean actor were inspected in native speech, contact and the final action state.

The desktop three-seat round debited $15 once ($1,050 → $1,035) and settled at $1,065 after standing all hands. The phone round debited $5 once ($1,065 → $1,060), showed J-heart/5-heart against 3-club and a hidden card, then settled at $1,060 with no outstanding bet. These are isolated demo balances.

Committed compact evidence is in `web/public/dealers/astrid/performance/scene-acceptance/`: the all-line comparison, full-size edge crops, four motion crops, three normal-phone frames, scene measurements and HTTP results. Raw screenshots, line/frame JSON, logs and settlement evidence remain private in `content/staging/2026-09-10/scene-acceptance/` and the checkpoint backup.

## Real server recovery and settlement

`node test/table-http.mjs` starts a disposable copy of the actual HTTP server with its own SQLite database and guest cookie. It never opens a running preview's database. Deterministic examples reorder only existing undealt cards, preserving their multiset. Eight acceptance groups passed:

1. One initial debit; private shoe and unrevealed hole; duplicate retry; stale and illegal command rollback.
2. Server process restart with the same guest, cards, version, shoe and wallet, without a second deduction.
3. Concurrent identical split requests produce one split debit/draw; hit, double and settlement complete; retried collection pays once.
4. Insurance charges half stake, reveals the dealer's blackjack and settles correctly.
5. Player blackjack payout.
6. Push return.
7. Player bust loss.
8. Natural shoe depletion reaches the cut, completes that round and replaces the shoe only on the next start.

The first run reached the cut after 60 additional rounds. This number is random and is not an acceptance threshold. The test is now part of GitLab CI. No wallet or game API behavior was changed.

## Remaining acceptance

### Loading-time camera correction

While preparing the capture reference, resizing during dealer startup exposed an additional placement error. `app.mjs` built the table before awaiting `engine.init()`/`engine.start()`, but registered its resize listener after those awaits. With the Astrid stream-index response delayed eight seconds in a disposable local server, a 1280×720 → 1920×1080 resize left the old projection `(0.0015625, 0.00277778)` and an undersized dealer/table after loading completed. Warm loads did not consistently reproduce it.

The table listener now registers before the media awaits; the later listener positions gameplay controls once they exist. Repeating the delayed-load test produces the correct projection `(0.00104167, 0.00185185)` and matches the stable camera reference. A delayed resize to 390×844 also produces the correct projection. Before/after screenshots and camera JSON are committed alongside the scene evidence as `resize-*`. This corrects a loading-dependent cause of hand/shoe separation under CAC-2, which remains In Dev for its full delivery requirement.

The 90-stream deep baseline passes after this change. Astrid, Vera, Amira and Mei each played goodluck twice sequentially through the actual shared player; first-end precedes second-start in the saved logs. Their existing media, audio and tracking hashes remain unchanged. Other dealers' known scene/media limitations are not approved by this sequencing check.

These are desktop-browser and phone-viewport checks, not physical Safari/iPhone/Android approval. They do not certify every speech phoneme or fix source blur. CAC-2/4 still need believable contact at every served fan and continuous professional pacing. The generated right return swept across the felt; the generated own-card return carried a dealt card back to the shoe. Both were rejected. The current centre and left returns remain opt-in partial candidates.

Use the updated [controlled capture brief](ASTRID-CONTROLLED-CAPTURE.md) for the next footage. Filmed hole-card reveal, collection and shoe change are also still absent. The current logical/CSS actions are not substitutes for those performances. No release, full milestone completion or default promotion is claimed.
