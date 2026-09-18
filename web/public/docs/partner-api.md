# Croupier Partner API v1

Server-owned AI-dealer blackjack. The game engine (shoe, rules, outcomes, payouts) runs on our server. The AI dealer only presents the game. Partners integrate through this API.

Base URL: `https://bettalotto.se` (production). All endpoints are `POST` with a JSON body.

## 1. Authentication (every request)

Each partner gets an API key and a secret from the Scout backoffice. Every request carries three headers:

| Header | Value |
|---|---|
| `X-Api-Key` | your key, e.g. `ck_live_…` |
| `X-Timestamp` | Unix seconds, must be within 5 minutes of server time |
| `X-Signature` | hex HMAC-SHA256 over `${timestamp}.${METHOD}.${path}.${rawBody}` using the secret |

`path` is the URL path only (e.g. `/api/v1/table`). `rawBody` is the exact JSON string you send (empty string if no body).

Node.js example:

```js
import { createHmac } from 'node:crypto';
const KEY = 'ck_live_…', SECRET = 'cs_…', BASE = 'https://bettalotto.se';
async function call(path, payload) {
  const body = JSON.stringify(payload ?? {});
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', SECRET).update(`${ts}.POST.${path}.${body}`).digest('hex');
  const r = await fetch(BASE + path, { method: 'POST', body,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY, 'X-Timestamp': ts, 'X-Signature': sig } });
  return r.json();
}
console.log(await call('/api/v1/ping'));
```

Errors are JSON `{ "error": "…" }` with HTTP 400/401/403/404. Key scopes: `launch`, `play`, `wallet`, `history`, `lobby`.

## 2. Endpoints

### POST /api/v1/ping
Returns `{ ok, key, scopes, serverTime }`. Use to verify signing.

### POST /api/v1/lobby (scope: lobby)
Lists tables, dealers, limits and rules.
```json
{ "tables": [{ "id": "astrid-blackjack", "game": "blackjack", "dealer": "astrid", "decks": 8, "cutAfter": 312, "boxes": 7, "minBet": 5, "maxBet": 2000, "sideBets": ["perfectPairs","21+3"], "blackjackPays": "3:2", "dealerStandsSoft17": true, "aiDealer": true }] }
```

### POST /api/v1/launch (scope: launch)
Get a game URL for one of your players. Open it in an iframe or a new tab. The session lasts 6 hours.
```json
// request
{ "playerId": "your-player-123", "currency": "EUR", "language": "sv", "returnUrl": "https://your-site/lobby" }
// response
{ "url": "https://bettalotto.se/?dealer=astrid&…&launch=<token>", "expiresIn": 21600, "playerRef": "…" }
```
`playerId` is your identifier. We map it to an internal player on first use.

### POST /api/v1/table (scope: play)
Drive the table server-side without the UI (for your own front end, bots, or QA). Same engine as the UI.

Every non-`state` call needs a unique `requestId` (idempotency: replays return the original response).

| op | body | notes |
|---|---|---|
| `state` | `{ playerId, op:"state" }` | current view, no requestId needed |
| `start` | `{ playerId, requestId, op:"start", bets:[{box:3, main:10, pp:0, tp:0}] }` | places bets and deals. `box` 0–6, sparse list is fine. Optional `version` for optimistic locking |
| `act` | `{ playerId, requestId, op:"act", action:"hit"\|"stand"\|"double"\|"split" }` | for the active hand |
| `insurance` | `{ playerId, requestId, op:"insurance", take:true\|false }` | when dealer shows an ace |
| `collect` | `{ playerId, requestId, op:"collect" }` | settles and returns balance |

Response: `{ version, shoe:{ id, total, remaining, dealt, cutAfter, cutReached, shufflePending, decks, burn }, round:{ boxes, hands, dealer, phase, active, legalActions }, balance, requestId }`. Shoe order, burn card and the hole card are never exposed.

### POST /api/v1/demo-credit (scope: wallet, internal wallet only)
`{ playerId, amount }` adds demo funds for integration testing. Not available on keys with a seamless wallet.

### POST /api/v1/balance (scope: wallet)
`{ playerId }` → `{ playerId, balance, currency }`. With a seamless wallet configured, your wallet is the source of truth and this is informational.

### POST /api/v1/history (scope: history)
`{ playerId?, from?, to?, limit? }` (ISO timestamps, limit ≤ 1000) → `{ rounds:[{ id, playerId, tableVersion, shoeId, op, requestId, stake, delta, currency, round, at }] }`. Every bet, action and settlement is logged with the full round state at that moment. Use this for reconciliation and regulator exports.

## 3. Seamless wallet (recommended for production)

If your key has a **wallet URL**, we never hold player money. Before each play call we ask your wallet for the balance, and on every debit/credit we call you:

```
POST <your wallet URL>
Headers: X-Api-Key, X-Timestamp, X-Signature   (signed with the same secret, path "/wallet")
Body: { "type": "balance"|"bet"|"win", "playerId", "currency", "amount", "transactionId", "roundId", "at" }
Response (200): { "balance": 123.45 }
```
- `transactionId` is unique per debit/credit. If you see it again, return the same result (do not double-book).
- Reject a `bet` with a non-200 status if funds are insufficient; the round will not start.
- Timeout is 8 seconds. On timeout or non-200 the play call fails with an error and nothing is booked on our side.

Without a wallet URL the key uses our internal demo wallet (starts at 0; use for integration testing only).

## 4. Regulatory notes

- Game engine and AI dealer are separate. The dealer layer has no write access to shoe, outcomes, payouts or balances.
- RNG: cryptographic OS random (`crypto.getRandomValues`), Fisher-Yates shuffle without modulo bias, 8 decks, cut card at 312, one burn card, no mid-round shuffle.
- Rounds are ≥ 3 seconds and every state transition is logged (see history).
- Clear "AI DEALER" label in the UI.

## 5. Support

Scout Gaming Group, Kevin Negash — kevin.negash@scoutgaminggroup.com
