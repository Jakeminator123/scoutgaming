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


### Getting a test session without writing code
In the Scout backoffice, **API Keys → MINT TEST TOKEN** creates a test player for your key and gives you: a ready launch URL (valid 6 h), an **ADD DEMO FUNDS** button (internal-wallet keys only), and the exact signed `curl` for `/api/v1/launch` including the signed string, so you can verify your own HMAC implementation byte for byte.

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

Response: `{ version, shoe:{ id, total, remaining, dealt, cutAfter, cutReached, shufflePending, decks, burn }, round:{ boxes, hands, dealer, phase, active, holeDraw, legalActions }, balance, requestId, presentation:[…] }`. Shoe order, burn card and the hole card's identity are never exposed before reveal. See *Presentation events* below.

### POST /api/v1/demo-credit (scope: wallet, internal wallet only)
`{ playerId, amount }` adds demo funds for integration testing. Not available on keys with a seamless wallet.


### POST /api/v1/assets (scope: lobby)
Everything a client needs to render our dealer yourself. `{ dealer:"astrid" }` →
```json
{ "dealer": { "key":"astrid", "name":"Astrid", "room":"Dark Hall" },
  "scene": { "room":"…/scene.png", "table":"…/table.png", "cardBack":"…", "shoe":"…", "chip":"…" },
  "camera": { "width":1920, "height":1080, "boxCentres":[[434.8,693.1],[590.6,742.9],[751.4,775.0],[931.0,783.7],[1144.6,777.8],[1287.4,763.5],[1431.2,720.3]] },
  "streams": [{ "key":"idle-1/idle/idle", "kind":"idle", "url":"…/idle-1_idle_idle.h264", "codec":"avc1.4D4028", "width":1440, "height":1440, "fps":24, "frames":145, "handsMatte":{…}, "audio":null }, …],
  "deals":   [{ "id":"astrid-centre-native-20260909", "action":"deal-centre", "url":"…/centre-native-review.mp4", "layout":"rgb-over-masks-r-actor-g-fingers", "fps":24, "frames":169, "events":{ "pickup":69, "release":116, "land":122, "rest":154 }, "landAtMs":5083 }, …],
  "speech":  [{ "line":"goodluck", "text":"Bets are closed. Good luck at my table.", "audio":"…/goodluck.mp3", "lipsyncDelayMs":463, "clip":"idle-1/speak/goodluck" }, …],
  "formats": { "h264":"raw Annex-B stream, decode with WebCodecs or ffmpeg", "packedAtlas":"RGB tile over mask tiles; use mask as alpha over your table" } }
```
`kind`: `idle` loops between actions; `speech` clips are lip-synced to their `audio` (start audio `lipsyncDelayMs` after the clip); `action` clips are dealer gestures. `deals` are the filmed card deliveries per direction (`deal-left` boxes 0–1, `deal-centre` 2–4, `deal-right` 5–6, `deal-dealer`). `landAtMs` is when the card touches the felt: place your DOM card at `boxCentres[box]` at that moment.

### Presentation events (on every `table` response and on the event stream)
Each non-`state` `table` response includes `presentation`: an ordered list of what our dealer does for that state change. Play them in order.

| type | fields | meaning |
|---|---|---|
| `speak` | `line`, `blocking?` | play speech clip + audio for `line` (see assets.speech). `blocking` = wait before dealing |
| `deal` | `to` (`box`/`dealer`), `box`, `handIndex`, `card` (`{r,s}` or null), `faceDown`, `shoeDraw`, `clip.action` | play the deal clip for `clip.action`, reveal `card` at `landAtMs` at `boxCentres[box]`. `faceDown` = show card back |
| `reveal` | `to:"dealer"`, `card`, `shoeDraw` | flip the dealer's hole card |
| `turn` | `box`, `handIndex`, `legalActions` | highlight the active hand, show its buttons |
| `settle` | `dealerTotal`, `dealerBlackjack`, `hands[{box,stake,returned,outcome}]` | pay out. `outcome`: win / blackjack / push / lose |
| `idle` | | return dealer to idle loop |

Cards are ordered by `shoeDraw` (server draw order), so the sequence is exactly what a real table would do.

### GET /api/v1/events (scope: play) — server-sent events
Live stream of presentation events for one player, for clients that render in real time (bots, second screens, or your own UI driven by another process).

```
GET /api/v1/events?playerId=<id>&key=<X-Api-Key>&ts=<unix seconds>&sig=<hex>
sig = HMAC-SHA256( `${ts}.GET./api/v1/events.${playerId}` , secret )
```
Events: `hello` on connect, then `round` with `{ op, requestId, version, phase, balance, events:[…presentation] }` after every `table` call for that player. Keep-alive comment every 25 s. Reconnect with a fresh `ts`/`sig` (5-minute window).

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

## 6. Prompts for ChatGPT / Claude

Paste one of these together with this page ("Copy for LLM" at the top copies the whole page as Markdown).

**Build a headless client (your own UI with our dealer)**
```
You are building a web client for the Croupier Partner API v1 (documentation pasted below). Using /api/v1/assets, decode the dealer's raw H.264 streams with WebCodecs, loop the idle clip, and on each `presentation` event from /api/v1/table or the SSE stream play the matching speech clip (audio offset by lipsyncDelayMs) or deal clip, placing a DOM card at camera.boxCentres[box] at landAtMs. Use the packed-atlas mask tile as alpha so hands render over the table. Vanilla TypeScript, no framework. Documentation:
```

**Build an API client**
```
You are integrating the Croupier Partner API v1 (documentation pasted below). Write a small TypeScript module that: (1) signs requests with HMAC-SHA256 exactly as specified, (2) exposes ping(), lobby(), launch(playerId, currency, language), table(playerId, cmd) with automatic requestId generation and safe replay, history(filter). Use fetch, no dependencies. Include a 10-line usage example. Documentation:
```

**Implement the seamless wallet**
```
You are the operator side of the Croupier Partner API v1 (documentation pasted below). Implement the seamless wallet endpoint we must expose: verify the HMAC signature, handle type = balance | bet | win, enforce idempotency on transactionId, reject a bet with a non-200 status when funds are insufficient, and return { balance }. Target: Node.js + Express + Postgres. Include the SQL schema and tests for double-delivery of the same transactionId. Documentation:
```

**Reconcile rounds**
```
Using the /api/v1/history endpoint from the Croupier Partner API v1 (documentation pasted below), write a nightly reconciliation job that pulls every round for the last 24 hours, sums stake and delta per playerId and currency, compares with our wallet ledger, and prints mismatches. Documentation:
```

**Explain it to a non-developer**
```
Explain the Croupier Partner API v1 (documentation pasted below) to a product manager in under 200 words: what the operator must build, what Croupier owns, how money flows, and what is logged for regulators. Documentation:
```
