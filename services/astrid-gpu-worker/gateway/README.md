# Streaming relay and browser reference

The relay, ticket authentication, worker binding and Cartesia/ElevenLabs PCM
adapters are imported by Croupier's game server. The integration lives in
[`services/game/generated-speech-stream.mjs`](../../game/generated-speech-stream.mjs),
[`services/game/dealer-speech-runtime.mjs`](../../game/dealer-speech-runtime.mjs) and
[`services/game/speech-journal-runtime.mjs`](../../game/speech-journal-runtime.mjs).
The shared game player in `services/game/public` owns actual playback.
`browser-player.mjs` and `server.mjs` here are protocol references. The
standalone server below does not create a Render service or launch a paid GPU
worker. See the
[runtime guide](../../../docs/LOCAL-PRESENTATION-RUNTIME.md) and
[John handoff](../../../docs/JOHN-HANDOFF.md) for current deployment and
GPU acceptance; the retired integration report is no longer a separate source.

## Standalone protocol checks

Node 22+, `npm ci`, then `npm test` or `npm start` in this directory. Configure:

- `WORKER_SECRET`: random server-only secret, at least 32 characters.
- `TICKET_SECRET`: different random server-only secret, at least 32 characters.
- `ALLOWED_ORIGINS`: comma-separated exact game origins, including scheme; no wildcard.
- `PORT`: defaults to 8080. Render supplies this itself.

Use TLS termination in Render. The health endpoint is `/health`. Deploy one
relay instance initially: worker assignments and used ticket nonces are held
in memory. Multiple instances need shared routing and replay protection.

Workers connect to `wss://<relay>/lipsync-worker` with
`Authorization: Bearer <WORKER_SECRET>` and `X-Worker-Id: <unique-id>`.
Configure these using RunPod session `ws_token` and `worker_id` server-side;
keep the token out of URLs and browser bundles. This relay does not launch,
warm or restart workers: the application must own that lifecycle and budget.

## Integrating the application

1. Import `attachSpeechRelay` into the application Node service. Croupier already
   does this in its game server; the standalone fixture is not an additional
   production service. Keep game state authoritative in the existing game engine.
2. Add an authenticated, CSRF-protected application endpoint that verifies the
   requesting user owns the game session, applies a per-account spend/rate limit,
   and calls `issueTicket(TICKET_SECRET, {userId, sessionId})`. Never accept
   arbitrary claimed user IDs, worker credentials or worker URLs from a client.
3. Return only the short-lived ticket and relay URL to that user. The browser
   connects with protocols `astrid-v2` and `ticket.<ticket>`; tickets are single
   use. Proxy logging must redact `Sec-WebSocket-Protocol` on this route.
4. In an isolated reference integration, import `SpeechStreamPlayer`, construct
   it with the test's video element and call `await player.connect(url, ticket)`
   from a user interaction.
   The browser is receive-only by default. The fMP4 includes AAC audio: do not
   play a separate TTS audio source.
5. On the trusted application server, use `onSessionReady(identity)` to start
   the authorized TTS request. Obtain `relay.openSource({...identity, rate})`,
   await `source.writePCM(bytes)` as TTS chunks arrive, then call `source.end()`.
   PCM must be little-endian signed 16-bit mono, without a WAV header. Pass
   `source.signal` to TTS fetch/adapter so disconnection stops upstream work.
   The source API checks the exact user/session owner and generated utterance
   `id`, and can be opened once. Preserve that `id` across asynchronous work;
   `identity.signal` cancels preparation even before the source opens.
   Keep the business request associated with that owner server-side; never
   accept arbitrary client-provided source ownership. PCM travels directly
   from Render to GPU, while browsers receive only synchronized media.
6. Await `player.done` for completed media ingestion (not playback completion).
   Playback begins after the first decodable buffered media, before `done`.
   Wire autoplay rejection to a Play button. On navigation, interruption or
   replacement, call `player.abort()` to close the socket and revoke its URL.

The existing TTS adapter must deliver PCM with the declared rate, and the game
must switch to this player without running its legacy MP4 or audio player in
parallel. Croupier's application integration exists; consult the handoff for
registered-dealer and GPU acceptance instead of this reference fixture.
No LLM or TTS API credentials are needed by this relay itself. The standalone
`server.mjs` only exposes health and socket attachment; a production application
must import the module and wire `onSessionReady` to its TTS adapter. There is
deliberately no public arbitrary-audio producer endpoint in that service.

Example server integration (the application implements `authorizedTTS` and
ticket issuance using its existing authentication):

```js
const relay = attachSpeechRelay(server, {
  workerSecret, allowedOrigins, authenticateClient: ticketAuthenticator(ticketSecret),
  async onSessionReady(identity) {
    const source = relay.openSource({ ...identity, rate: 24000 });
    try {
      for await (const pcm of authorizedTTS(identity, { signal: source.signal })) {
        await source.writePCM(pcm);
      }
      source.end();
    } catch { source.abort(); }
  },
});
```

Browser PCM upload is an explicit QA option only: set relay `allowClientPCM:
true` and player `connect(url, ticket, {receiveOnly:false, rate:24000})`, then
await `player.writePCM()` and call `player.endInput()`. Do not give browsers
TTS service credentials.

## Limits and failure behavior

Each authenticated socket owns one utterance and is assigned a generated ID.
Only one utterance per user/session is accepted. There is no unbounded job
queue: unavailable capacity returns HTTP 503. Worker and session capacity,
audio duration (25 seconds by default), upload inactivity, overall runtime and
send buffers are bounded.
Cancellation keeps a worker reserved until its terminal acknowledgement;
missing acknowledgement kills the connection. Worker reconnection/replenishment
is the caller's responsibility. Client disconnect cancels GPU work.

The browser bounds pending append bytes and trims already played media. A slow
consumer aborts rather than allowing unlimited memory growth. There is no
automatic fallback to full-file rendering: failures stay observable.

## Wire protocol

All controls are JSON with discriminator `t`. All binary client input is PCM16;
all binary worker output is fragmented MP4 containing H264 and AAC.

The browser transport retains `astrid-v2` and protocol 2 for compatibility.
Registered-dealer worker connections additionally attest `X-Dealer-Id`,
`X-Speech-Profile-Revision`, `X-Speech-Image-Sha256` and `X-Speech-Protocol: 3`.
`worker-binding.mjs` validates these against the server-owned session avatar;
the application supplies `authenticateWorker` and selects the exact worker.
Legacy sessions without an avatar must not advertise a registered-dealer
binding. The standalone `server.mjs` does not implement these application
profile, budget or RunPod lifecycle checks.

- Browser receives `ready{id,protocol:2}`; trusted server source starts TTS.
- Relay sends worker `start{id,rate,protocol:2}`, followed by PCM messages.
- Worker sends `stream{id,mime}` before init/media bytes.
- Source calls `end()`; relay sends `end` with the assigned `id`.
- Worker ends with `done{id,frames,ms}`, or `error{id,error}`.
- `abort{id}` cancels work; worker acknowledges only after encoder cleanup with
  `done{id,aborted:true}` or `error{id,error}`.

Tests use real local WebSockets with a mock worker, check early delivery,
ownership, credentials, cancellation and limits. GPU visual quality, actual
MuseTalk latency and browser codec support require separate deployed QA.

For a local real-codec check, run `node test/browser-fixture.mjs <ffmpeg-path>`.
It creates a temporary three-second H264/AAC test pattern, starts an isolated
loopback relay and mock worker, then prints a browser URL. Click Start playback.
The page and `/result` show decoded frames, first-frame time and whether frames
arrived before `done`. It deletes temporary media on stop and automatically
stops after ten minutes. This checks transport/MSE only, not GPU latency.

## Cartesia adapter

`cartesia-source.mjs` provides the concrete server-side PCM async iterator:
`createCartesiaSource({apiKey,voiceId,modelId})({text,signal,beforeCostly})`.
It calls Cartesia `/tts/bytes` once with the complete transcript and yields
PCM before HTTP EOF. It preserves samples across odd HTTP chunk boundaries,
limits text to 500 characters and audio to 25 seconds at 24 kHz, and cancels on
timeout, browser disconnect or an early iterator return. The existing
ownership/round check belongs in `beforeCostly`. Keep voice/model values tied
to the existing server voice profile. This removes full-audio buffering but
does not itself stream incomplete LLM text.

`elevenlabs-source.mjs` provides the equivalent bounded PCM iterator for
ElevenLabs. `services/game/dealer-speech-runtime.mjs` selects the adapter from the current
dealer's private speech profile and verifies its voice; neither adapter
silently changes provider or chooses another dealer's voice.
