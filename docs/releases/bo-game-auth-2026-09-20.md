# Backoffice sign-in for original and V2 games

Deployed 2026-09-20 at 11:21 UTC to bettalotto.se and backoffice.bettalotto.se.

The game was behind Caddy HTTP Basic authentication, which rejected the request before the app could read any player session or launch token. Separately, the host-only BO cookie did not reach the game host. A partner launch was also only handled at `/`, not `/v2/`.

The game gate now recognizes an ordinary valid player session. Without one, an entry-page request makes a brief round trip through the backoffice. An existing BO session proceeds automatically; otherwise BO sign-in returns the user to the requested dealer/version. The game and BO must be in the same browser profile. `www` redirects to the canonical game host.

The BO cookie is never shared with the game or widened to the parent domain. The transfer uses a random five-minute browser-state cookie and a hashed, single-use code lasting at most 60 seconds, bound to the exact configured hosts and a whitelisted game return path. It issues a host-only, HttpOnly, production-Secure player cookie with SameSite=Lax for the return navigation. A game session grants no BO role. The CRAIG user-to-player link is shared with ordinary password login, so it preserves the same wallet and table. Newly issued BO tokens include a credential fingerprint; existing signed BO tokens remain usable according to their original expiry. Each resulting game session checks the account fingerprint and account existence.

No guest access was enabled in production. Unauthenticated game APIs/static application modules remain denied. Existing partner API/docs/media exclusions remain as before. Valid partner launch tokens now initialize the player session on the V2 entry route too. No source footage or original/V2 frontend presentation was replaced.

## Verification

- `test/bo-game-auth.mjs`: disposable actual server/SQLite tests for existing and new BO sessions, one-time codes, missing browser state, expiry, forged cookies, wrong account/type, password changes/deletion, external return paths, origin rejection, normal password login, role isolation, stable profile/wallet, complete demo round, root/V2 partner launches and logout. Player-auth and CRAIG tests also pass; all three are now in pre-commit.
- `test/table-http.mjs`: eight authoritative table/wallet/settlement/restart scenarios passed.
- Full pre-commit suite and syntax/whitespace checks passed. Caddy candidate validated before reload; all five deployed app hashes match the staged manifest.
- Browser, isolated hosts/database: BO sign-in returned to Astrid V2 automatically. Existing BO session also opened V2 without password entry. A $5 centre-seat round reached stand, dealer 17, push, collection and betting again with $1,000. Original Amira and Amira V2 then opened with the same session/balance and no second login.
- The first disposable proxy harness incorrectly forwarded POST Content-Length on an empty authentication GET, producing an API 400/media error. Fixed the harness header handling and repeated the complete round successfully. Caddy uses its native forward_auth handling; this harness defect was not shipped.
- Public original, V2 and `www` requests now reach the BO login page when logged out, with no HTTP Basic challenge. Anonymous `/api/table` and V2 application modules return 401; auth-session returns authenticated:false. The in-app browser now displays the real public BO form instead of the blocked-site screen. That browser did not have a production BO session, so authenticated public gameplay was not tested using a real user's account or wallet.

## Deployment and rollback

Scoped server release: `/opt/croupier/releases/bo-game-auth-20260920/`. It contains the five-file before/after manifest, `before/` app backups, server-local protected `Caddyfile.before`, validated candidate, and deployment receipt. Only `server.mjs`, `player-auth.mjs`, `craig-identity.mjs`, new `bo-game-auth.mjs`, and `public/bo/login.html` were shipped. The checked-in Caddy game block is `ops/caddy/bettalotto-game-auth.Caddyfile`; other virtual hosts were preserved.

Rollback must restore the prior Caddy routing and app files together, then restart croupier and reload Caddy. Do not restore/copy any database. The new additive `bo_game_handoffs` table can safely remain unused after rollback. No live user data, roles, passwords, balances or database files were copied or replaced for testing.
