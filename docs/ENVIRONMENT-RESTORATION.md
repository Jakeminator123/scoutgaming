# Local environment restoration — 2026-09-08

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
