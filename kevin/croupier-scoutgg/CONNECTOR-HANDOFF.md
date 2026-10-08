# Astrid / John / Jakob / Emil connector — 28 September 2026

Production release: `connector-20260928-1320` on croupier.scoutgg.dev. This branch extends the production reporting baseline without importing the experimental OpenClaw/speech server changes from the other game branch.

- John's flat chip selector, felt stacks, bottom control dock, action buttons, total pills and receipt summary use the existing authoritative shared-game handlers and wallet receipts.
- Published BO brand themes reach `/api/presentation`. Drafts stay private. Colours, chips, typography, logo and face suit colours apply at the next betting boundary; active/settled hands retain their theme. ETag revalidation avoids repeatedly transferring uploaded logos. Brands remain presentation skins over the shared game, not separate operator wallets.
- The filmed Scout back is retained for a seamless hole/flip handoff. Custom back designs and BO table geometry are explicitly preview-only. Existing original/rounded/extended felt choices remain available under Settings.
- Every new server presentation step records Jakob's pinned catalogue ID and commit. Player-turn control steps are recorded without inventing clips. The combined BO tree connects all 16 catalogue events to families, active assignments and actual scheduled records. Historical matching is labelled; scheduling is not device playback acknowledgement. Unbound variants remain training/reference.
- Emil's byte-identical hole/flip files come from `EmaCodeHero/astrid-demo-v3` commit `24d809fd47bf89c359c4e6d80ffdcbe15d45118c`. Hole f45 hands off to the matching drawn back; flip hides that back and reveals the rank at f31. Both preload. Two dealer cards have 66px spacing; hand occlusion uses measured source frames. The original eight hand tracks are unchanged.

## Verification

100 tests pass on this production-compatible branch, including hidden-card privacy, unchanged draw identity on reveal, same-origin security, theme boundary and ETag HTTP behaviour. The broader source branch has 107 passing tests. BO required precommit checks and 9 catalogue/published-design/connection tests pass.

Local real engine: complete round with side bet, stand/settlement, then a double round with the new hole/flip sequence. Published theme queued through the decision and appeared on Next round. Rendered iPhone-sized 393x852 dock, decisions, hole spacing; source-frame review at hole f33/f45 and flip f29/f31. BO same-origin game iframe loads, flip media preview readyState 4 / 2.333333s / no error, and real local round records map to reveal.dealer.

Deployment: 37 payload files verified. Both services active. Three online SQLite backups pass integrity checks. Before/after: 8 BO accounts, 10 players, 35 settlements, 22 movements; account and wallet hashes identical. Protected draft/audit endpoints remain 401 anonymously; media Range is 206; unchanged theme is 304. No live test wagers or financial changes were created. Runtime rollback is switching the previous game symlink and BO service override; do not restore databases for a code rollback.

Local providers were disabled. This does not certify RNG or production OpenClaw acceptance, nor prove physical iPhone performance on every network. The existing shoe audit and house/transaction reporting remain authoritative and unchanged.
