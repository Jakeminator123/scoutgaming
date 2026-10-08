# OpenClaw and event/clip index

This integrates patterns from Jakob's Croupier commit
`d321e3f565c67c6c6fdec80f92508a017298c383` into the shared Astrid game.
The existing game, backoffice and media remain the source of truth.

## Runtime

Set `DEALER_LLM_PROVIDER=openclaw`, `OPENCLAW_PRODUCT_SPEECH_URL` (bare HTTPS
Director origin) and `OPENCLAW_PRODUCT_SPEECH_TOKEN` in private deployment
configuration, then restart the game. Gemini remains the default until selected.
No OpenAI model key or broad Gateway key is needed here.

The game uses Jakob's `/api/product/speech` HTTP envelope and the separate
`openclaw/croupier-speech` role. It does not route game events through MCP or
wait for AI during dealing. Each request carries server revisions. A response
must echo those revisions and still match the current room before acceptance.
Timeouts, invalid choices and stale replies use reviewed fallback text.

The host application's reviewed response policy is preserved. `recordedLine`
is the upstream protocol's fixed-line selector: here it selects exact text in
our reviewed bank, then uses our existing Cartesia + RunPod generation path.
It does not claim a prerecorded video exists for that line. Arbitrary generated
text and provider media URLs are rejected. Silence skips TTS and video.
Cards are omitted from AI context because an authoritative plan can be ahead of
actual client playback. Player identities, balances, history, shoe order and
private cards are not sent. Context reads never advance the game.

`presentation.speech_choice` is appended to the existing audit chain with a
parent event, request ID, response ID, decision and revisions. It is a selection
record, not playback proof. Existing `player.* → engine.* → presentation.plan`
and wallet events remain authoritative. No claim of RNG certification is made.

## Index and MCP

`server/integration-index.mjs` builds a versioned graph from the actual classified
media registry. Active events link to allowed clips. Legacy/training clips stay
searchable but have no runtime binding. The graph includes source modules and
ownership. Unknown file availability is null, not a claim that media was checked.

Start the read-only MCP process with `node /absolute/path/server/mcp.mjs`.
Use a direct node command rather than npm when the client expects clean stdio.
It implements MCP using the official TypeScript SDK and
[stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

Resource: `croupier://integration/index`.
Tools: `search_integration({query})`, `read_event_trace({room})`.
The default static index needs no credentials. For live traces, the client must
supply `CROUPIER_GAME_URL` and the existing `GAME_AUDIT_TOKEN` via its private
environment. The game exposes authenticated GET
`/api/internal/game-audit/integration?room=astrid`. The trace projects only IDs,
parents, timestamps, event types, hashes, speech choices and scheduled clip IDs.
It excludes raw payloads, identities, balances, chat, cards and shoe data.

Example client entry (put real credentials in the client's secret configuration):

```json
{"mcpServers":{"croupier-integration":{"command":"node","args":["/absolute/path/server/mcp.mjs"]}}}
```

No MCP has been registered in the remote OpenClaw service. Its game-facing speech
role intentionally has no tools. This MCP is for integration/operator clients;
remote registration and deployment remain separate changes.

## Verification, 2026-09-26

The live speech relay selected `greeting` for a synthetic greeting and returned
our exact reviewed text. No user history or identity was sent. This verifies
choice generation, not audio/video quality. Tests cover stale replies, malformed
choices, privacy projection, safety routing, silence, audit relationships,
authenticated HTTP access and real SDK client/server stdio discovery and calls.

Remaining: deploy/enable this adapter in the shared environment; configure an
operator MCP client; verify complete voice/video playback in the target browser.
The current local Lissabon demo remains a separate checkout and runtime.
