# Streaming relay and browser reference

The relay and shared player are integrated into Croupier behind explicit
streaming flags. Production activation and real GPU streaming verification are
still pending as of 2026-09-29. The standalone server below does not create a
Render service or launch a paid GPU worker. See
[`docs/STREAMING-INTEGRATION.md`](../../../docs/STREAMING-INTEGRATION.md)
and the application's activation receipt for current deployment status.

## Run

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

1. Import `attachSpeechRelay` into the Render Node service, or run the provided
   dedicated service. Keep game state authoritative in the existing game engine.
2. Add an authenticated, CSRF-protected application endpoint that verifies the
   requesting user owns the game session, applies a per-account spend/rate limit,
   and calls `issueTicket(TICKET_SECRET, {userId, sessionId})`. Never accept
   arbitrary claimed user IDs, worker credentials or worker URLs from a client.
3. Return only the short-lived ticket and relay URL to that user. The browser
   connects with protocols `astrid-v2` and `ticket.<ticket>`; tickets are single
   use. Proxy logging must redact `Sec-WebSocket-Protocol` on this route.
4. Import `SpeechStreamPlayer`, construct it with the actual game's video
   element and call `await player.connect(url, ticket)` from a user interaction.
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
parallel. Those integration edits and all four dealer QA remain outstanding.
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

## Historical Croupier integration touchpoints (initial read-only inspection)

The list below records the original pre-integration audit. Application-side
stream descriptors, authenticated relay attachment and shared-player handling
have since been implemented. Consult the current integration document linked
above before using this list as remaining work.

- `web/generated-speech-provider.mjs`: `createGeneratedSpeechProvider` currently
  buffers `/tts/bytes`, makes a WAV, submits RunPod `/run`, polls `/status` and
  decodes Base64 MP4. Add a separate streaming entry point using the iterator
  and `openSource`; preserve request-id idempotency and `beforeCostly` checks.
- `web/generated-speech-chat.mjs`: `completeChatWithSpeech` waits for the whole
  `service.generate`. A streaming decision needs its own transport descriptor
  (ticket and request identity), issued after fresh owner/round checks. Preserve
  checks on cancellation and stale model/session/round state.
- `web/server.mjs`: existing chat route obtains `playerSession`,
  `chatSessionOwner` and `authoritativeChatStatus`, then calls the above helper.
  Attach the relay to the existing HTTP server object, issue tickets inside
  authenticated session context, and bind ready events to the reserved request.
  Never copy browser-supplied ownership into the relay source.
- `web/generated-speech.mjs`: complete-artifact reservation and storage assume
  full WAV/MP4 hashes. Streaming needs a separate lifecycle and durable request
  reservation; keep final archive/hash metadata if a take will be retained.
  Never label an in-flight or unreviewed stream as an approved speech package.
- `web/public/generated-speech-player.mjs`: current player fetches complete
  audio and video, plays a separate `Audio` and muted `video`, and corrects drift.
  Streaming must use one MSE video with muxed audio, within the same pose gate,
  single speech queue and visible pending-review treatment.
- `web/public/app.mjs`: the generated playback call around line 2175 and media
  loader around line 2583 are current consumers. Update all consumers of the
  shared player deliberately, including native/lab bridge expectations. Test
  two consecutive plays and cancellation; preserve all four dealers on their
  shared playback path before enabling any default.

These main-project files were inspected but not edited by this gateway task.
