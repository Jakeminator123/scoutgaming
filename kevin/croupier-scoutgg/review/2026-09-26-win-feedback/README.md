# Personal win feedback — 26 September 2026

Reuses the original Croupier stacked toast treatment from `web/public/app.mjs` and `web/public/styles.css`: dark panel, lime amount, Space Grotesk / JetBrains Mono, 350 ms entrance, 4.2-second display and 500 ms exit. Notifications sit in the centre of the playing area above the wager stacks, with responsive widths and reduced-motion support.

Only the owner receives win notifications and the win sound. Side-bet notifications trigger when the exact deciding card faces are visible. Their plus amount is profit on that individual wager. The matching pile changes immediately to total return (stake plus profit), with a persistent profit label below the player's wager area. The label is positioned below cards so it remains readable. Losses and pushes have no celebration. The old duplicate side-result status sentence is hidden; results remain in Hands & results.

The server now exposes per-field sideResults (stake, total return, profit, label and original draw IDs), alongside the existing combined sideReturn. The existing paytable, total credits and settlement timing are unchanged. Side awards stay with the original hand through splits. The client never reconstructs payouts from labels or implements a second paytable. Existing persisted rounds without per-field metadata start using this presentation on their next round.

Main-hand notifications use the owner's net main/insurance profit, excluding side awards already shown. This avoids celebrating a push, a net losing main result or another player's hand. Notifications are deduplicated through polling/split updates, and restored results do not replay after refresh.

## Evidence

67 automated tests pass, including reveal gating, owner isolation, zero/negative profit suppression, repeat/refresh suppression, separate PP/21+3 award metadata and original draw preservation through split. See tests.txt.

`node tools/check-win-feedback.mjs` uses a disposable local database and disabled providers, never the deployed shoe. Two independent browser identities play together. The winner's $5 Perfect Pairs and $5 21+3 produce profit notifications +$125 / +$500 and chip piles $130 / $505 at reveal. The losing identity receives no win toast. The wallet stays $985 until settlement, then becomes $1,620 exactly once. A subsequent $5 blackjack against dealer 20 shows +$7.50 and balance $1,627.50; no notification appears for the other player or on refresh.

Screenshots cover the mobile win notifications, persistent mobile/desktop profit labels and desktop blackjack. Original Full HD media files and the mobile video buffer are unchanged.
