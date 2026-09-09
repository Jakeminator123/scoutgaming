# Astrid CAC follow-up — 9 September 2026

This continues checkpoint `9263527` on `codex/restore-casino-environment`. Jira now contains CAC-1 through CAC-7. All refer to Astrid. CAC-5/6/7 have Steps and Expected Result saved in their descriptions; no separate configured Expected Result custom field was returned. No ticket has been closed automatically.

## Changes against the reports

| Report | Current change | Verification / remaining limit |
|---|---|---|
| CAC-1, CAC-5: overlapping room and misaligned lights | Every Astrid actor layer uses the single room plate. The obsolete 3D carpet is replaced by a transparent shadow receiver, removing another horizontal floor seam. | Idle, embedded speech, ordinary speech and a full three-seat deal were viewed in-game. The old baked central background is absent. Source pose changes still exist. |
| CAC-2: centre-only dealing | Select the nearest measured release to the actual rendered card fan, including split offsets and viewport registration. The held 3D card and resting card now use one bitmap, paper colour and rounded outline. | Recorded left/centre/right and both dealer cards in a real round. Three player variants still cannot provide seven independently captured exact deliveries; residual release correction remains. |
| CAC-3, CAC-6: controls/totals/side bets overlap | Totals are below the betting spots again. Split totals share a row and clear neighbouring arcs. Action panels avoid cards, totals, arcs, payouts and wallet, preferring a position below the hand. One shared camera transform reserves 136px beneath the desktop scene. Deal Now also sits below the betting area. | Actual seven-seat, outer-seat, split and winning-PP checks found zero measured total/arc and control collisions. After the first bet, centre/right/PP bets remained clickable and did not accidentally start the round. |
| CAC-4: robotic pacing | Existing calibrated 1.75x silent takes retained; audio remains 1x. Shorter corrective routing and consistent card appearance remove two presentation discontinuities. | Full 40-second initial-deal recording saved. Returning to folded hands between cards and source motion softness remain; complete professional motion continuity is not accepted. |
| CAC-7: white cutout fringe | `actor-compositor.mjs` applies a one-source-pixel matte contraction and inward colour decontamination only at semi-transparent edges. Stream speech, embedded speech and performance use the same GPU shader. | No footage, face, voice or audio regeneration. No generation credits used. Browser runtime reported no shader errors. This removes reliance on SVG canvas filters for isolated Astrid; physical Safari/device approval is still pending. |

The phone view now follows the active server hand. A desktop seven-seat round no longer leaves seats 0, 1, 5 and 6 permanently hidden on a phone. The visible three-seat span is narrower so outer card fans stay inside 390px. After settlement it returns to the normal three betting spots.

## Actual gameplay evidence

All new gameplay used isolated server **127.0.0.1:4180** with a separate temporary SQLite database. Existing 4173/4175/4176 and the earlier 4178 data were preserved. Guest access remains enabled. No game/wallet rules changed.

- Seven-seat round: $35 initial stake from $1,000, refresh retained the same cards and $965 balance. Resized to 390x844; active seats progressed 6 → 5 → 4 → 3 → 2 → 1 → 0. Hit, bust, two doubles, stand, dealer turn and settlement completed. Doubles brought the stake to $45 and balance to $955. Settlement returned $10, closing at $965. All cards cleared and the three default phone spots returned.
- A local deterministic shoe fixture was then prepared **only in 4180**, by reordering existing undealt cards while no unpaid hand existed. No wallet edits. An outer split produced separate totals and completed settlement.
- Final three-seat fixture: all three $5 main bets plus a $5 centre PP were successfully placed before starting. Initial balance $975 → $955. The recorded initial deal presents all four delivery directions and the hole card. A right split cost $5 once, stake $25 and balance $950. The centre Perfect Pair returned $130. Both split totals align below the chip, clear adjacent side-bet arcs and remain above the action panel. All four player hands then stood; dealer turn and settlement completed, closing at $1,080 with no cards or outstanding bet.
- Vera, Amira and Mei goodluck played twice sequentially in the shared player; Astrid native goodluck also played twice with the GPU actor mask. These checks establish playback sequencing and unchanged media, not full phoneme approval.

The committed **[current three-seat recording](../web/public/dealers/astrid/performance/cac-followup-deal.mp4)** is also opened by **Watch updated three-seat deal** in the actual game's rehearsal panel. It is a timestamped browser capture, silent, with elapsed timing preserved. The recording is not a separate animation viewer or a replacement for the playable table.

Private raw captures, timestamps, fixture provenance and JSON measurements are in `content/staging/2026-09-09/cac-followup/`, with a separate checkpoint backup. Public screenshots include split/side-bet clearance, phone card fans and native speech. Reference opening frames were inspected at approximately 0.75, 2.26 and 3.76 seconds in the [Scout video](https://scoutgaminggroup.com/ai-casino); the reference has continuous two-handed performance and still exceeds the staged clips in pose continuity.

## Regression and delivery boundary

Deep roster, performance and actor/audio probes passed. All 38 hook tests passed, including routing by actual card position and preferring controls below totals. Existing missing speech-take warnings for Vera/Amira/Mei are unchanged. No original dealer stream, voice, native audio or calibrated contact track was replaced.

The new scene remains **staged**, not Astrid's default production rendering path. Remaining full-milestone work includes natural continuous motion between deliveries, exact contact at every seat/fan, filmed hole-card reveal/collection/shoe change, complete audible phoneme review, slow/interrupted playback across browsers, and physical Safari/iPhone/Android verification. No claim of complete Astrid functionality or final realism acceptance is made by this checkpoint.
