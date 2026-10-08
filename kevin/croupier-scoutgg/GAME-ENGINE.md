# Local playable table

The demo now uses Croupier's existing blackjack rules and server-owned shoe. It is a local demonstration with a separate $1,000 demo wallet per browser session, not the production wallet or back-office account.

## Run

Use the existing ignored `.env` and `PORT=8620 npm start` (Node 22.13+ / Node 24+). Gemini selects a fixed response ID; only approved text passes to Cartesia → RunPod. Game announcements use the prerecorded clips with their embedded original audio and do not generate new speech.

`data/demo.sqlite` is ignored. Keep it out of Git and deployment copies. `TABLE_DB` can select an isolated test database.

## Integration

- `vendor/croupier/`: byte-identical rules and persistent-shoe service from Croupier commit `3c2b70b914d83e94db3b5cd0e965647d93ae17ae`; see its README for provenance.
- `server/table-service.mjs`: SQLite transaction stores the wallet and game together. HTTP-only session cookie, same-origin validation, version checks, unique request IDs, duplicate-command recovery. Hidden hole cards and future shoe order are not sent to the client.
- `POST /api/table`: `state`, `start`, `act`, `insurance`, `collect`. Mutations require `version` and `requestId`; start requires seven `{main,pp,tp}` bets. `act` accepts only server-listed legal actions.
- This browser-facing demo endpoint uses its own guest-session cookie; the existing bearer-token protection for the integration APIs is unchanged.
- `public/game-events.js`: maps issued `shoeDraw` IDs to clips. Opening order is 7 → 1 → dealer, repeated for the second card. Split reassigns existing cards without replaying their draws. A hole reveal uses the already-issued card.
- `public/game-table.js`: server snapshots drive the UI. Good luck, double, bust, insurance, side-bet and outcome events select the appropriate recorded speech variant. Buttons stay locked until the visual sequence completes. Results collect once; state can resume after refresh.
- `public/game-cards.js`: ranks/suits come from the server. Cards retain the measured 63 × 85 source dimensions, anchored at the manifest landings. The newest card lands at the recorded location. Earlier cards slide diagonally up-left at a measured per-seat contact frame. Normal spacing is 30 pixels left and 26 pixels up; the entire fan is capped at 60 pixels wide and 110 pixels high so longer hands stay clear of neighboring seats. The 63 × 85 manifest dimensions already include projection and are not foreshortened again. Ranks and suits appear on the first white-face frame, using measured quadrilaterals and visible-paper contours to keep the filmed fingers in front. Stable draw-keyed nodes avoid a second jump when the next face is revealed. Split-hand buttons show each hand at the same seat.
- `public/table-boxes.js`: seven felt-style betting rings below the measured landings. There are no card-target outline rectangles.
- `public/app.js`: one serialized video queue, native video-frame callbacks, completion promises and recovery if a browser pauses a clip. Shared manual previews cannot interrupt a private active hand.

## Latest Emil media

Merged `origin/main` at `1e271e17522e11c51d2703a7149d6196a0b88d3d` on 2026-09-25. All 51 original speech MP4s and the manifest now include his corrected endings. The optional alternate recompression folder remains excluded by the existing sparse checkout to save disk space. Do not mix timings from the older manifest.

## Visual limits

This integration uses the existing single-card videos, not newly generated full-round footage. The game ink follows the filmed blank face through the wrist turn, using source-frame tracks in `review/2026-09-25-card-faces/`. An opaque visible-paper polygon, sampled from the source colour, covers older game cards beneath each incoming face; an inward contour clips the ink away from the filmed fingers. Rectangular extent fitting avoids using a thumb notch as a corner; symmetric five-frame pose smoothing runs offline without delaying the first-white trigger. No clean-felt patch is used. The earlier left slide uses separate contact measurements in `review/2026-09-25-card-contact/`. Existing cards are persistent SVG overlays. Finger exclusion is available for the incoming white face only, not for later reaches over previously dealt cards. The user-approved diagonal fan bounds the hand spread while preserving every card’s source size. Long hands overlap more within their own fan instead of spilling into the adjacent seat. This is a playable alignment demo, not proof of perfect occlusion during later reaches. No new generation credits were spent.

## Checks

`node --test test/*.test.mjs`

Covers original engine/shoe checks, wallet persistence and rollback, duplicate debit/payout prevention, session isolation, opening order, split/hit/double draw mapping, hole reveal, immediate blackjack, paused-video recovery, contact-driven diagonal spacing and neighboring-seat bounds, first-white-frame visibility, measured triangle projection and frame-clock seeking. `/review/card-contact.html` is a local visual inspection page using the same renderer and source clips, without engine/wallet mutations.

## Scout / Privé controls (25 September)

The private demo now has a champagne/black interface (no lime), six denomination
chips, undo, double bets, all seats, clear and direct PP/21+3 felt targets. Choose
a denomination, then click the main circle or either smaller circle above it:
Perfect Pairs on the left, 21+3 on the right. There is no bet-type selector. Each
target updates its own draft field through the existing server validation and
payouts. Insurance is offered
after the deal/line ends with its exact cost across all occupied hands. Its cost
is included in total stake; insufficient funds disable acceptance, not decline.

The 20-second presentation clock is visible only during betting and starts on
the first bet. Additional chips do not reset it. It pauses during speech and
hidden tabs. Starting a deal immediately hides and clears it. Decisions and
insurance have no countdown or automatic action. Default expiry deals the
existing bets; the gear menu can disable automatic dealing. This is a private-demo timer, not an authoritative multiplayer deadline;
all actions still go through versioned server commands. Reloading resets the
presentation timer; the real hand and wallet remain server-persisted.

Sound is unlocked by a browser gesture. The old game's ambience loops quietly,
ducks under recorded speech, and pauses while hidden. Chip/decision/paper/chime
sounds use WebAudio; the paper landing is triggered once at the measured
contact frame. Master mute cancels scheduled sound; independent voice, ambience
and effects levels persist locally. No new speech generation is used.

Validation: round-clock and audio lifecycle tests plus the existing card,
playback and authoritative engine tests. UI evidence and exact browser checks
are in review/2026-09-25-scout-ui/.

### Centered controls refinement

Betting controls are centered at 44% of the registered source frame. Decision,
insurance and result controls sit at 33.5%, above the dealer's card landing.
PP/21+3 are separate projected circles above-left and above-right of every main
circle, at source offsets (-40, -38) and (40, -38). Visible radii are 27 x 18;
elliptical hit areas follow each circle. Their chips replace the labels when
occupied. Main-circle clicks always add to the main bet, even after a side bet.
The camera, main bets and card calibration remain unchanged. Captions sit above
the controls.


## Shared-table corrections, 26 September

The active page uses the shared room coordinator, superseding the private-only
clock description above. Shared decisions now have a persisted 60-second
server deadline after presentation, with visible countdown and auto-stand (or
insurance decline). Betting remains 20 seconds. Side-bet speech/results and
per-player win effects are connected to authoritative outcomes. Round receipts
persist each participant's stakes, hands, return and net in the payout transaction.
The wallet explicitly labels the previous return while a new round is active.
Buffered clips seek to the current shared clock after loading.

See [integration review](review/2026-09-26-game-integration/README.md) for the
51-test suite, two-session desktop/mobile evidence, buffering experiment, and
remaining limits. These changes are local and have not been deployed.

## Full-quality mobile buffering (26 September 2026)

The player now prepares original Full HD clips before joining/betting and reuses Blob buffers. No media was re-encoded. Cold connections show preparation progress. See `review/2026-09-26-mobile-buffer/README.md` for the throttled full-round result and measured first-load cost.
