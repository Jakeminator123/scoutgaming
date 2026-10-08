# Backoffice operations read model · 27 September 2026

John's supplied backoffice design is implemented in the Croupier project's
`codex/existing-backoffice-audit` branch. This Astrid companion adds the admin-only
`view=operations` response through the existing internal game-audit endpoint.

`server/operations.mjs` projects actual shared rooms to public table/phase/seat counts,
seated names/presence, stake totals and shoe counts. It does not expose cards, shoe
order, shuffle samples, credentials or balances, and does not advance/write game
state. No gameplay UI, rules, media or payment behavior changed.

Validation: all 95 Node tests pass, including the new read-only/privacy test in
`test/backoffice.test.mjs`. An isolated combined BO/game server displayed three actual
local settled rounds: $180 stake, $137.50 payout, house +$42.50. Desktop and 393px mobile
BO layouts, selected-room tree links, actual 1080x1920 deal clip and transaction filters
were checked in the browser. No production deployment in this delivery.
