# Blackjack demo: BMM preparation, 26 September 2026

This is an internal technical preparation pack for the existing BMM enquiry, not a certificate or release approval. The changes and evidence are local. Live deployment and live provider acceptance remain separate.

## Architecture and authority

Browser → same-origin table API → shared-table service → Croupier shoe/game rules → SQLite transaction → public snapshot / settlement receipt → browser cards, prerecorded announcements and sound.

Chat message → local privacy/support/rule checks → Gemini response-ID selection → fixed reviewed response bank → audit record → Cartesia voice → RunPod lip-sync → reply video. No model-authored text reaches speech. The model receives the current message only; it has no game tools, shoe, wallet, automatic player identity or history. Visitor-supplied text may itself contain information, so the pattern filter is not complete data-loss prevention. Public table chat remains visible to other guests with the same table link.

The game authority is `vendor/croupier/public/blackjack.mjs` plus `vendor/croupier/shoe-game.mjs`, orchestrated by `server/shared-table.mjs`. Browser animation and the AI cannot decide cards, stakes or returns. Game clips are selected from the server-produced timeline and manifest. Random clip variation is presentation only.

## RNG and mathematics supplied for review

- Eight decks / 416 cards, server-side Web Crypto `crypto.getRandomValues`, Fisher–Yates shuffle, rejection sampling before bounded modulo mapping. No player or model seed input. One burn card; cut threshold 312 removed cards; cards drawn without replacement; persistent shoe state across requests/restarts.
- The concrete OS/Node/OpenSSL configuration and entropy assurance for the certification target must be frozen and provided to BMM. `build-and-maths.json` records the local verification runtime, not the production runtime. This package is not a statistical RNG report.
- Rules and payout definitions: `public/demo-information.html`, `GAME-ENGINE.md`, source and tests. S17, 3:2 natural, 1:1 ordinary win, American peek, insurance 2:1, double after split, up to four split hands, one card to split aces, no surrender. All X:1 figures are profit; returned stake is accounted separately.
- Exact weighted opening-card enumeration using actual settlement code: Perfect Pairs RTP 95.9036144578%; 21+3 RTP 96.2960873595%. Details/category counts in `review/2026-09-26-safety/build-and-maths.json`. Assumption: unconditioned eight-deck opening. These figures are not the main-game or combined RTP and are not independent laboratory findings.
- Main-game RTP, specified player strategy, full mathematical report, lab sample format and independent RNG testing remain to be agreed/completed with BMM. Do not substitute generic blackjack RTP.

## Controls implemented locally

- Fixed, versioned dealer response bank; injection/freeform provider responses cannot become generated speech. Provider failures choose a fixed fallback; audit failures prevent chat speech release.
- Browser cannot trigger arbitrary game announcements; trusted non-table POST endpoints require a configured bearer token and fail closed when absent. Cross-origin requests rejected; no wildcard CORS; WebSocket payload/rate limits; security headers; private worker metadata cannot be served as media.
- Root HttpOnly/SameSite cookie migration preserves existing token and wallets. Malformed cookies receive a fresh token. This is an anonymous demo identity, not a verified account.
- A server-enforced 24-hour browser-session break clears pending bets across rooms and blocks new bets/refills and added risk. Existing hands can stand or time out. It survives server restart and cannot be cancelled early. Clearing cookies/different browser bypasses it; it is not identity-verified self-exclusion.
- Game-server decision deadline and settlement receipts from the preceding gameplay change; per-player side-bet outcomes and win sound.
- Existing AI DEALER label retained. Demo information explains rules, payouts, virtual funds, support, chat visibility and data handling. No deposits or withdrawals exist.
- Safety audit stores policy/model/response identifiers and input/output hashes, not raw chat. Thirty-day purge on startup/write. This is a local mutable SQLite log, not tamper-evident regulatory storage; hashes alone do not reconstruct inputs.
- Reply media uses random UUID filenames and stops serving after 24 hours; storage pruning runs when replies are generated. Recent chat is bounded in server memory. Wallets/nicknames/request records/receipts remain in SQLite. Final retention, deletion, access controls, backups, provider terms/DPAs and hosting regions require operator review.

## Verification and reproduction

`node --test test/*.test.mjs` passes 60 tests, including actual HTTP/WebSocket enforcement, privacy boundaries, arbitrary-model output rejection, audit failure, break expiry/restart/multiroom scope, settlement and request idempotency. Full output: `review/2026-09-26-safety/tests.txt`.

`node tools/build-bmm-evidence.mjs` regenerates hashes and opening-card mathematics. Hashes identify source bytes; `baseCommit` is the parent revision at generation and must not be mistaken for the complete changed build.

For isolated browser QA start with a temporary TABLE_DB and `RUNPOD_API_KEY=local-qa-disabled`, placeholder provider keys/endpoint, blank SESSION_URL and PORT=8634; then run `node tools/check-safety-browser.mjs`. It launches installed Chrome via Playwright. Evidence includes desktop 1440×1000 and mobile 390×844 screenshots and `browser.json`: joining, cookie reuse, break/refill block, refresh persistence and information layout. Paid provider calls are disabled. Live generated audio/lip-sync and deployment have not been revalidated by this safety run.

## Submission dependencies and proposed owners

| Item | Next step / proposed owner |
| --- | --- |
| Manufacturer, contracting entity, IP ownership | Alexander/Timur to confirm exact legal entity and relationships. Do not infer from Scout branding. |
| Client form | Corporate owner to supply registration/address/tax/incorporation records, ownership chart, UBOs >25%, directors/managers, licensing status and billing/project contacts. Original BMM form and internal checklist are kept separately from source. |
| Scope | BMM to confirm one game + RNG, Malta, Great Britain, Greece and GLI-19/Tobique approach, plus Sweden (omitted from the quoted scope). Lab scope is not a licence. |
| Assessment | BMM to provide source/build/data harness/access checklist, quotation, start date, timing and whether AI presentation has separate requirements. |
| Compliance / legal | Timur/operator to map target-market licensing and product obligations, RACI, likeness/voice rights, hosting/subprocessors and commercial agreements. |
| Real-money platform | Operator integration for authenticated wallet, KYC/age, limits, self-exclusion, regulatory records and responsible-gambling processes is outside this virtual-funds demo. |
| Release | Freeze source/runtime/manifest, validate target environment and live providers, review deploy/rollback and database backup. No certification or live-release claim until completed. |

An unsent BMM reply has been prepared in the existing email thread asking for scope/checklist/price/timing. No technical archive or form has been sent.
