# Local environment restoration — 2026-09-08

> **Historiskt kvitto, inte aktuell startinstruktion.** Sökvägen, branchen och
> direktkommandot nedan beskriver miljön den 8 september. Nuvarande checkout
> är `C:\Users\jakem\Projects\croupier` på
> `jakemanator123-github-work`. Följ `AGENTS.md`, den koordinerade startaren i
> `lab/docs/README.md`, [miljövariabelregistret](ENVIRONMENT-VARIABLES.md)
> och [aktuell molnstatus](CLOUD-CURRENT-STATE-2026-09-29.md) för nya arbeten.
> Starta inte ett andra direkt Web/Lab-par utifrån kommandot i detta kvitto.

Working directory: `/Users/solvifyab/Desktop/croupier`.
Branch: `codex/restore-casino-environment`.
Run: `HOST=127.0.0.1 node web/server.mjs`.
Game: http://127.0.0.1:4173/
Rehearsal: http://127.0.0.1:4173/?rehearsal=1

## Preserved baseline
The original checkout was already at 8de4800. Its uncommitted source media, encoded working files, calibration scripts and bust-settle test are preserved. The inspection clone under Scout-Gaming is not the running app. The initial restoration did not regenerate dealer media or spend generation credits. No production deployment.

## Changes
- Replace the foreground table PNG with a Three.js mesh: felt surface, extruded body, raised leather rail, brass edge and card shoe. Render only on resize/context restoration; pixel ratio capped at 1.75.
- Crop the room plate at the rear rail, eliminating its duplicate foreground furniture. Preserve dealer film, original scene registration and hands; correct wide-screen framing.
- Project seat targets from the same camera as the table; three targets fit within the portrait viewport. Original table image remains a WebGL fallback.
- Speech turns own their timers, cancellation and audio events. Audio is ready before cutting to the take; only its requested painted frame starts the delay. Repeating a line no longer mistakes the old clip for a new start. Unmatched audio never reuses a mouth saying different words.
- Tag decoded frames with submission-time identity, clear pending decodes on interrupts and match hand mattes by timestamp.
- Optional rehearsal panel selects four existing dealers and recorded lines, explicitly showing missing matching clips. Play twice exercises real in-game playback, without AI generation.
- Reject the observed upstream session-limit message as a chat failure instead of showing it as dealer dialogue.

## Verification
- Six speech/decoder/provider-message regression tests pass.
- Split suite: 77 checks and 50,000 randomized rounds pass.
- Existing original-checkout bust-settle suite: 10 checks pass.
- Browser: desktop Vera and Astrid rendered; portrait 390x844 has three fully visible main-bet targets. A demo Astrid round completed (goodluck, insurance, dealer blackjack, placebets), without logged errors. Vera goodluck repeated twice: start/end at 07:39:51.580/54.878 UTC, then 54.947/58.245 UTC, no overlap.
- Syntax and whitespace checks pass.

## Remaining work and limits
This is a real 3D table with filmed dealers, not rigged 3D human characters. Existing assets contain no GLB/glTF character rigs. Preserving the approved faces while adding a full human rig, facial blend shapes and natural motion requires a separate character pipeline and visual acceptance.
Playback fixes do not prove every original take has accurate lip motion. Missing clips and existing per-take word/phoneme mismatches remain visible in rehearsal. Compare by ear and eye; do not regenerate approved takes blindly.
The external chat backend returned a session-limit error during the demo. Recorded dialogue works independently; the upstream account limit itself is not fixed.
The stream builder still requires the documented calibration pass after rebuilt assets. No streams were rebuilt here.

## Visual correction loop — 8 September
- Added a generated 3:1 outer room plate (`assets/room-extended.png`) based on the existing empty-room source. The central original backdrop remains registered to the filmed dealer. The transition excludes the original outer sconces, avoiding doubled lights. Other dealers retain their own registered scenes.
- Added two table pedestals, bronze feet/collars, deeper table body, carpet and soft cast shadows. Reduced desktop tabletop depth to leave room for the supports.
- Replaced the primitive shoe blocks with the existing detailed transparent shoe cutout, facing the fixed camera, with a contact shadow on the felt. This is a photographic billboard, not a fully modeled interactive shoe. Its horizontal placement is clamped inside phone viewports.
- Unified betting-ring centres, perspective and rotations. Labels follow their crescent rather than independent calibration angles. Warm, restrained ink replaces bright outlines.
- Prevented the scene container from scrolling when focus/click brought overflowing seat descendants into view (`overflow: clip`). Reproduced a 55px upward camera shift before the fix; verified zero scroll after main and side bets.
- Iterated browser renders at 1920×920 and 390×844. Verified $5 main + $5 Perfect Pairs produces a $10 total, then cleared the demo bet. Checked Astrid's room as well as Vera. No browser errors/warnings; module syntax checks pass.
- Generated background source remains at `/Users/solvifyab/.codex/generated_images/01a07fda-b136-7c40-a3f1-3156faac4d1f/exec-ef0a5481-f909-4e62-9973-61f1f124e987.png`.

The room remains a composited broadcast scene: filmed dealer, photographic background and shoe, plus a real mesh table. It has no free-moving camera. These visual changes do not establish production readiness or repair every recorded mouth take.

## Persistent shoe and dealing — 8 September, follow-up

The current shoe replaces the earlier photographic billboard with geometry (`shoe-model.mjs`): transparent acrylic walls and edges, sloping card pack, printed card back, follower, exposed card edges and separate red cut card. The stack shrinks with each server draw; the cut card advances to the outlet and is pulled clear when reached.

`web/shoe-game.mjs` is authoritative for a demo table per player profile. Eight decks (416 cards), one face-down burn on a fresh shoe, cut reached at 312 removed cards (75%, including the burn). Finish the current round; reshuffle only when starting the next round after collection. These are this demo's configured rules (`SHOE_RULES`), not a claim of universal casino requirements. The cut is a marker, never a playable card. An exhausted shoe raises an error and rolls back the command rather than inventing a card or shuffling mid-round.

`/api/table` persists the private shuffled order, round, revision and last command in SQLite alongside each wallet change in one transaction. Commands validate phase, legal action, stakes and funds. Request IDs make retries idempotent; revisions reject stale actions from another tab. Responses exclude the future shoe, burn identity and unrevealed hole card. Client wallet overwrites are rejected after a table is created. Currency changes wait until the round is collected. Refresh resumes an unpaid round and cannot silently redeal it.

The browser consumes round snapshots and animates every visible draw from the modeled outlet in screen coordinates. This avoids the previous hidden `#shoe2d` origin and transformed-seat coordinate error. Initial cards are paced separately; split draws, doubles, hits and dealer draws share this path. A hole-card reveal does not consume another card. The new-shoe interlude blocks betting while the shoe refills. No recorded rule audio was regenerated: obsolete fresh-every-round/certified-RNG takes are excluded from the live bank. The disclosure and dealer prompt now describe the server-shuffled demo.

Validation: 197 shoe/service checks plus deterministic persisted split, double, insurance and duplicate-collection checks. Existing 77 split checks and 50,000-round sweep passed; 10 bust-settlement checks and six speech/decoder checks passed. Browser: played a server round (411 cards after four dealt from 415; hit to 410), refreshed at player 17/dealer upcard 8 with balance 990 unchanged, stood and completed settlement. Checked full, half and reached-cut model states in an isolated temporary preview, then removed that preview. No browser warnings/errors observed.

Rule reference: Pennsylvania's published blackjack rules require reshuffling after the cut card is reached and the current round completes: https://www.pacodeandbulletin.gov/secure/pacode/data/058/chapter633a/s633a.5.html and https://www.pacodeandbulletin.gov/secure/pacode/data/058/chapter633a/s633a.7.html . The 75% placement and face-down burn are explicit demo configuration choices.

Limits: this remains demo money and the existing demo player-ID identity scheme, not a certified RGS or authenticated real-money wallet. Each profile has its own table, not a synchronized multiplayer broadcast table. The filmed dealer does not yet physically grip the animated cards; the shoe-to-hand animation is rendered separately. The existing lip-sync limitations still apply.

## Compact shoe and required player login — 8 September

Reduced shoe scale from 27% to 19% of viewport height (desktop cap), shifted it inward and farther onto the felt. Corrected the pack axis: the previous negative tilt sent the back of the stack through the base, creating the false half-empty appearance. A full pack now occupies 86% of the housing length and sits above the base; actual depletion still follows server counts. Outlet and contact shadow move with the model. Reviewed desktop 1600×900 and phone 390×844.

Player login now precedes table access. `/login.html` offers sign-in and account creation; no guest bypass. `player-auth.mjs` stores per-account salted scrypt password hashes and hashed, random session tokens in SQLite. Sessions last 24 hours, use HttpOnly/SameSite=Strict cookies (Secure for HTTPS or production), expire server-side, and are revoked at sign-out. Login attempts are limited per remote address. Mutating requests reject foreign origins. This supersedes the old player-ID identity scheme: player API calls now resolve their ID from the session and ignore any supplied ID. Anonymous historical profiles remain untouched and are not automatically claimed by registering an email. Backoffice retains its separate authentication.

Verified registration, login, incorrect passwords, duplicate registration, password hashing, session persistence/expiry, logout and foreign-origin rejection using an isolated in-memory database test. Live server checks confirmed anonymous table/assets redirect to login, anonymous API calls return 401, and supplying another player ID still resolves only the signed-in account. Created and signed out of a temporary QA account in the browser, then removed that QA account and its demo data. Shoe service tests still pass. Login and table layouts reviewed on desktop and phone.

Account email verification and password-reset delivery are not implemented in this local login flow. This is authenticated demo play, not a certified real-money system.

## Login modal correction
The casino is publicly viewable again; guest visitors can select seats and bets. Authentication is requested in a native modal over the table when Deal Now or Add Funds is pressed. Closing it preserves the selected bets and starts no round. Successful sign-in/registration loads the account and continues the requested action without navigation. The old `/login.html` address redirects to the casino, and the standalone login assets are removed. Logout returns to the public table. Protected player, round and deposit APIs still return 401 without a valid session; read-only assets remain public. Removed the cashier's previous local-credit fallback on API failure.

Verified guest browsing, protected API rejection, Add Funds modal, cancellation preserving a $5 bet without dealing cards, and account creation resuming that round on the same URL. Authentication unit checks still pass. Temporary modal QA account/data removed after browser testing.

## Brand alignment and account-source audit
Replaced the modal's placeholder label with the approved final Scout wordmark: Space Grotesk 600, -0.045em tracking, off-white lettering and lime slash, taken from the local approved `design-drop/scout-gaming/project/final/app.jsx` WM definition. Modal palette/type/CTA now follow `design-kit/ScoutBrand.dc.html`: #0A0B0D, #F2F1ED, #D6FF3A; Space Grotesk headings, Inter body, JetBrains Mono labels, pill CTA. Visually checked in the browser.

Account audit found 36 records in `croupier.db.players`, zero in the new `player_accounts`, and two existing users in `craig.db.users`. The current player login queries `player_accounts`; it does not authenticate CRAIG users. Asked whether the intended existing accounts are CRAIG logins or a separate player database. No account migration or credential-source change made while that choice is pending.

## CRAIG authentication connection
The account-source choice is resolved: the running server passes `craigIdentity(boDb)` to the casino auth service. Existing CRAIG email or username and current scrypt credentials authenticate the modal. Matching is case-insensitive; ambiguous matches and incomplete invitations are rejected. The login accepts existing legacy passwords without enforcing the former signup minimum. Separate casino registration is disabled, and the modal no longer offers new-account creation.

On first successful authentication, a transaction links the CRAIG user ID to a casino profile in `craig_player_links`. Subsequent logins reuse that profile, shoe and balance. Existing anonymous profiles are not guessed/merged. CRAIG credentials and roles remain untouched; a casino session does not issue a backoffice cookie or grant a BO role. Each session records a non-reusable credential fingerprint and checks the current CRAIG account, so password changes and deleted users revoke access. Existing invitations must complete their normal CRAIG password setup.

`test/craig-login.mjs` verifies email/username login, legacy password length, failed credentials and pending invitations, stable links, separate roles, disabled registration, persisted sessions, password-change revocation and deleted-user revocation against isolated SQLite databases. Existing auth tests pass. Server restarted with the CRAIG adapter; browser modal verified with email/username input and no separate signup. No real user's password was read, changed or used for testing.

## Pending invitation diagnosis
The reported email login failure was traced to its local CRAIG record: the email account has no password hash yet (unfinished invitation), while the separate `kevin` username is active. Updated the auth adapter to return an explicit account-setup-incomplete message instead of a misleading incorrect-password message for pending invitations. Added a response assertion to the CRAIG integration test; all checks pass. No credentials or account state changed.

## Temporary guest preview
Login prompting is temporarily bypassed for local product work. Start with `sh web/preview.sh` (sets `HOST=127.0.0.1 DEMO_GUEST_ACCESS=1`). Each guest browser receives its own persistent demo player and shoe through an HttpOnly preview cookie; game outcomes and demo funds still come from the server. Backoffice authentication remains required. Normal server startup without `DEMO_GUEST_ACCESS=1` restores the CRAIG login requirement.

Verified a complete guest round and demo deposit through the server, backoffice rejection without credentials, and Add Funds opening directly in the browser without the login modal. The isolated HTTP test profile was removed. Current local server runs preview mode.

## Gameplay sequencing and dealer access — 2026-09-08

- Added a persistent bottom selector for Vera, Astrid, Amira and Mei. Switching is blocked during an active round; the selector remains usable on portrait screens. The temporary guest preview remains enabled.
- Replaced the WebGL card-flight effect with a textured, lit card with front/back faces, a turnover, table shadows and a shoe → dealer → seat path. The accessible resting cards remain in the DOM. Reduced-motion and WebGL fallback paths remain available.
- Card delivery now returns a completion promise. Initial deals, hits, doubles, split draws and dealer draws await landing before updating totals or advancing the sequence. Both sets of action controls are disabled while a command is pending. The action bar is clamped above the dealer selector.
- The dealing film starts after actual announcement completion and its first painted frame; longer deals repeat the action instead of reverting to idle. Double speech follows server acceptance. Bust speech follows landing. Settlement waits for result speech before opening betting again.
- Automatic idle and event commentary is disabled for the gameplay-first preview. Explicit chat remains available.
- Astrid's goodluck/win captions disagreed with the recordings. Local transcription of all 17 recordings identified the extra words; captions now reflect the actual recordings. This is not evidence that the generated mouths pronounce those same words.
- Normalized 18 Astrid streams containing B frames into display order, preserving decoded frame counts and per-clip audio delays. The player assigns sequential timestamps, so reordered encodes violate its stream contract. `pipeline/normalize-stream-order.py` verifies counts/order and rebuilds byte offsets without dropping other metadata. Both retiming scripts now explicitly encode without B frames.
- Added a 145-frame person mask for Astrid's dealing clip, aligned to the corresponding normalized video. This exposes her filmed hands above the felt. These are filmed hands, not a rigged 3D character or finger-level card grips; the existing footage limits exact contact across all seven seats.
- Tried regenerating the mismatched win take with Seedance 2.0, canonical start/end image and the actual recorded audio. The provider rejected submission with `not_enough_credits`; no replacement was produced. Verified estimate: 45 credits for one five-second 1080p take. Mouth-to-word mismatches remain pending a matched regeneration and visual acceptance.

Validation: shoe/service regression checks, persisted split/double/insurance/duplicate-payout checks, speech regression tests, and split-rule tests. Browser checks covered dealer switching, rejection of mid-round switching, portrait layout, initial deal, hit/bust, and settlement. Rendering checks do not establish phoneme-accurate lip sync or fully rigged hand contact.

The live double check exposed a receipt error: its header/net used only the opening stake. Settlement now includes all split/doubled hand stakes, insurance and original side bets. A $5 opening bet doubled to $10 with a $20 return correctly reports a $10 net, not $15. Server wallet amounts were already correct. Live double → dealer draws → result speech → betting completed successfully.

## Final gameplay checks — follow-up

The sequential-frame encoding contract now holds for every deployed stream across Vera, Astrid, Amira and Mei. Additional normalization preserved decoded frame counts and all indexed clip metadata. The dealing card now has a paper-thickness mesh, and renderer failures clean up the temporary card and unblock the resting card. A malformed keyboard event no longer crashes the calibration listener.

An isolated server and database on localhost:4174 were used for deterministic browser tests, separate from the user's 127.0.0.1:4173 profile. The split fixture completed split → hit → stand → double → dealer draw → settlement. It consumed nine dealt cards plus the burn, charged $15 total, returned $10 and displayed the correct $5 loss.

Asset gaps remain explicit: Amira and Mei have speech/idle assets but no dealing-action clips. Astrid/Vera have filmed dealing motions, not rigged finger-level contact with arbitrary 3D cards. The current generation account still has insufficient credits for replacement takes.

A local transcription spot-check of greeting, goodluck and win for Vera, Amira and Mei found no additional word-count mismatch against their configured/default captions. This is a transcript check, not a phoneme-quality claim. The insurance fixture paid $7.50 against $7.50 total stake (main plus insurance), correctly showing zero net.

The cut-card browser fixture reached draw 314 while keeping the original shoe through settlement. The next start produced a different shoe ID, one burn and four initial cards (draw count 5), with card conservation intact. Animation completion now handles hidden/occluded tabs and render failures; three regression tests cover those lifecycle cases. All 89 roster streams passed the no-B-frame audit. Speech and shoe/service regression suites passed again after these changes.

Remaining delivery dependency: matched speech regeneration and missing dealer action footage require generation capacity. The connected account was rechecked and still reports 3.02 credits, with no active Unlimited allowance. The quoted 180-credit repair budget covers two speech takes plus one retry each; it does not cover a complete new set of hand-action footage for all four dealers. No subscription or credit purchase was initiated.

## Hand release cues and return motion

Astrid now has measured fingertip coordinates for four release cues in the existing dealing footage. Card delivery waits for the corresponding displayed video frame, including the correct loop cycle, before starting the shoe-to-hand-to-seat animation. The common engine exposes frame presentation events; other dealers can use the same cue format when suitable footage exists. These coordinates do not establish a filmed grip or an actual reach into the shoe.

Ending a delivery interrupts the dealing loop. Astrid uses a 41-frame return-to-rest segment extracted from the existing take, with a matching hand matte; dealers without this segment return to idle. Browser checks on the isolated server verified hit delivery, return to a folded resting pose, stand and settlement back to betting. Twelve timing/playback tests pass, including three new checks for painted-frame cues, loop identity and timeout cleanup.

The source footage itself clips Astrid's fingertips at its bottom edge. A replacement take must keep both hands and the entire delivery workspace in frame; software timing cannot reconstruct the missing fingers. Amira and Mei still need dealing footage, and no replacement generation has succeeded in this pass.

After the user reported a top-up, MCP and CLI still showed 3.02 credits in the connected Team workspace. The available Chrome profile was signed out. Account/workspace clarification is pending. Higgsfield's official help confirms website Unlimited coverage does not apply to MCP/CLI generation: https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them . No additional purchase was initiated.

## Continuity and roster safeguards

Recovered the later conversation from the local session after the app reader returned only the beginning. Added `docs/JOHN-HANDOFF.md`, repository `AGENTS.md`, and `pipeline/save-checkpoint.py` for a private conversation export, verified committed-history Git bundle, handoff and checksums. The app history display itself remains outside this repair; nonignored modified/untracked product media and scripts are saved in a separate archive because a Git bundle cannot include them. The original workspace, database and ignored files remain intact.

Fixed `build-index.mjs` to preserve calibration and other clip metadata on identical rebuilds, retain unrelated clips during partial rebuilds, and reject changed calibrated footage before copying any files. Shared speech playback no longer queues a repeat of a sentence merely because its audio is still running when decode-ahead reaches the boundary. Default captions now have one shared module.

The roster audit fingerprints audio, video, captions, calibration, indexes, hand mattes and cue files for all four dealers. Deep checks verify frame boundaries, dimensions, 24 fps compatibility, no B frames and audio coverage. Versioned pre-commit checks are enabled locally, and GitLab CI is prepared but has not run remotely. The baseline records the current imperfect assets; passing it does not certify mouth-to-word accuracy. Thirteen bank lines still lack a matching video (Vera 8, Amira 2, Mei 3), including Mei's gameplay push. All existing speech takes have calibration and enough video duration for their audio plus delay.

Validation: 16 focused regression tests; 197 shoe/service checks plus persisted split/double/insurance/idempotency checks; 77 split-rule assertions and a 50,000-round sweep with zero violations. Further audiovisual fixes remain open and are described in John's handoff. The generation account was rechecked and still reports 3.02 credits.
