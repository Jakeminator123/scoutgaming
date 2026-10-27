# Streaming relay and browser reference

Status: live. The game engine (Render `croupier-v3`) imports these modules for all generated speech; they must move before `services/astrid-gpu-worker` is removed at the clean slate.

The relay, ticket authentication, worker binding and Cartesia/ElevenLabs PCM adapters are used by
[`services/game/generated-speech-stream.mjs`](../../game/generated-speech-stream.mjs),
[`services/game/dealer-speech-runtime.mjs`](../../game/dealer-speech-runtime.mjs) and
[`services/game/speech-journal-runtime.mjs`](../../game/speech-journal-runtime.mjs).
The shared player in `services/game/public` owns playback. `browser-player.mjs` and `server.mjs` here are protocol references; the standalone server is not a production service and launches no GPU worker. Playback rules are in the [runtime guide](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## Standalone protocol checks

Node 22+, `npm ci`, then `npm test` or `npm start` in this directory. Configure:

- `WORKER_SECRET`: random server-only secret, at least 32 characters.
- `TICKET_SECRET`: a different random server-only secret, at least 32 characters.
- `ALLOWED_ORIGINS`: comma-separated exact game origins including scheme; no wildcard.
- `PORT`: defaults to 8080.

The health endpoint is `/health`. Worker assignments and used ticket nonces live in memory, so run one relay instance; more need shared routing and replay protection. Workers connect to `wss://<relay>/lipsync-worker` with `Authorization: Bearer <WORKER_SECRET>` and `X-Worker-Id: <unique-id>`, configured server-side through the RunPod session's `ws_token` and `worker_id`. The relay does not launch, warm or restart workers.

## How the application uses it

1. The game engine calls `attachSpeechRelay` and keeps game state authoritative.
2. An authenticated, CSRF-protected endpoint verifies that the user owns the game session, applies a spend and rate limit, and calls `issueTicket(TICKET_SECRET, {userId, sessionId})`. Client-claimed user IDs, worker credentials or worker URLs are never accepted.
3. The browser receives only the short-lived single-use ticket and relay URL and connects with protocols `astrid-v2` and `ticket.<ticket>`. Proxy logs must redact `Sec-WebSocket-Protocol` on this route.
4. In `onSessionReady(identity)` the server starts the authorized TTS request, opens `relay.openSource({...identity, rate})`, awaits `source.writePCM(bytes)` per chunk and calls `source.end()`. PCM is little-endian signed 16-bit mono without a WAV header. `source.signal` is passed to TTS so a disconnect stops upstream work; the source can be opened once, for the exact owner and utterance `id`.
5. The browser is receive-only. The fMP4 carries AAC audio, so no separate TTS audio is played. `player.done` means media ingestion is complete, not playback; autoplay rejection must be resolved by a user gesture (the game shows **Slå på ljud**), and `player.abort()` closes the socket on navigation or replacement.

```js
const relay = attachSpeechRelay(server, {
  workerSecret, allowedOrigins, authenticateClient: ticketAuthenticator(ticketSecret),
  async onSessionReady(identity) {
    const source = relay.openSource({ ...identity, rate: 24000 });
    try {
      for await (const pcm of authorizedTTS(identity, { signal: source.signal })) await source.writePCM(pcm);
      source.end();
    } catch { source.abort(); }
  },
});
```

Browser PCM upload is a QA option only (`allowClientPCM: true` on the relay, `connect(url, ticket, {receiveOnly:false, rate:24000})` in the player). Browsers never get TTS credentials, and the relay itself needs none.

## Limits and failure behaviour

Each authenticated socket owns one utterance with a generated ID, and only one utterance per user and session is accepted. There is no unbounded queue: missing capacity returns HTTP 503. Worker and session capacity, audio duration (25 s by default), upload inactivity, total runtime and send buffers are bounded. Cancellation keeps a worker reserved until its terminal acknowledgement; a missing acknowledgement kills the connection. Client disconnect cancels GPU work. The browser bounds pending bytes and trims played media; a slow consumer aborts. There is no automatic fallback to full-file rendering.

## Wire protocol

Controls are JSON with discriminator `t`. Binary client input is PCM16; binary worker output is fragmented MP4 with H.264 and AAC. The browser transport keeps `astrid-v2` and protocol 2 for compatibility. Registered-dealer workers also attest `X-Dealer-Id`, `X-Speech-Profile-Revision`, `X-Speech-Image-Sha256` and `X-Speech-Protocol: 3`; `worker-binding.mjs` checks them against the server-owned session avatar.

- Browser receives `ready{id,protocol:2}`; the trusted server source starts TTS.
- Relay sends the worker `start{id,rate,protocol:2}`, then PCM.
- Worker sends `stream{id,mime}` before init and media bytes.
- Source `end()` makes the relay send `end` with the assigned `id`.
- Worker finishes with `done{id,frames,ms}` or `error{id,error}`.
- `abort{id}` cancels; the worker acknowledges after encoder cleanup with `done{id,aborted:true}` or `error{id,error}`.

Tests use real local WebSockets with a mock worker. `node test/browser-fixture.mjs <ffmpeg-path>` starts an isolated loopback relay with a three-second H.264/AAC test pattern for a transport and MSE check (it cleans up and stops after ten minutes); `node test/python-browser-fixture.mjs <ffmpeg-path>` runs the full local chain with the Python session. Neither measures GPU latency or lip sync.

## TTS adapters

`cartesia-source.mjs` exposes `createCartesiaSource({apiKey,voiceId,modelId})({text,signal,beforeCostly})`. It calls Cartesia `/tts/bytes` once with the full transcript and yields PCM before HTTP EOF, keeps samples across odd chunk boundaries, limits text to 500 characters and audio to 25 s at 24 kHz, and cancels on timeout, disconnect or early return. The ownership and round check belongs in `beforeCostly`. `elevenlabs-source.mjs` is the equivalent bounded iterator for ElevenLabs. `dealer-speech-runtime.mjs` picks the adapter from the dealer's private speech profile and verifies its voice; neither adapter silently changes provider or voice.
