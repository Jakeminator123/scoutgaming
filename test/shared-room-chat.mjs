import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleSharedRoomHttp } from '../services/game/shared-room-http.mjs';
import { createSharedRoomChat, sharedRoomChatRound } from '../services/game/shared-room-chat.mjs';
import { projectOpenClawGameStatus } from '../services/game/openclaw-chat.mjs';

const origin = 'https://player.example.test', cookie = 'croupier_session=alice';
const snapshot = (over = {}) => ({ contract: 'blackjack-table/1', roomId: 'room-a', version: 9, presentationVer: 3, configVersion: 'config-a',
  windowId: 'window-a', phase: 'decisions', roundId: 'shared-room-a-round-4', owners: ['player-a', null, 'player-b', null, null, null, null],
  round: { phase: 'decisions', holeDraw: 5, active: 0,
    hands: [{ box: 0, stake: 10, cards: [{ r: '9', s: '♣', shoeDraw: 1 }, { r: '7', s: '♦', shoeDraw: 3 }] }],
    // A defective upstream projection must still never forward the hole card (shoeDraw 5).
    dealer: [{ r: 'K', s: '♠', shoeDraw: 2 }, { r: 'Q', s: '♥', shoeDraw: 5 }], legalActions: ['hit', 'stand'] },
  me: { id: 'player-a', seats: [0], active: true, available: 100 }, ...over });
const binding = { actorId: 'player-a', sessionId: 'player-' + 'f'.repeat(64), operatorId: 'operator-a', roomId: 'room-a', packageRevision: 2, expiresAt: Date.now() + 60000 };

const roomContext = Object.freeze({ operatorSlug: 'kasino', roomId: 'room-a', packageRevision: 2, dealerId: 'paow' });
async function fixture(t, { settings = { speechUrl: 'https://director.invalid', speechToken: 'token' }, read = () => snapshot(), decide, now, speech = null } = {}) {
  const emitted = [], decided = [], contexts = [];
  let engineOrigin, clock = 1000;
  const service = {
    async chatContext(request, { roomId }) {
      contexts.push(roomId);
      if (request.headers.get('cookie') !== cookie) throw Object.assign(Error('private'), { statusCode: 401 });
      return { binding, dealerId: 'paow', presentationContext: roomContext, snapshot: read(contexts.length) };
    },
    emitChat: (roomId, entry) => emitted.push({ roomId, ...entry }),
  };
  let chat;
  const server = createServer(async (req, res) => {
    if (!(await handleSharedRoomHttp(req, res, { command: null, chat, engineOrigin }))) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  engineOrigin = `http://127.0.0.1:${server.address().port}`;
  chat = createSharedRoomChat({ service, origin, engineOrigin, settingsProvider: () => settings, now: now ?? (() => clock), speech,
    decide: decide ?? (async (request, status) => { decided.push({ request, status });
      return { kind: 'generatedText', requestId: request.requestId, exactText: 'Du har sexton, jag skulle stanna.' }; }) });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const post = (body, { headers = {}, method = 'POST', room = 'room-a' } = {}) => fetch(`${engineOrigin}/api/shared-room/${room}/chat`, {
    method, headers: { origin, cookie, 'content-type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  return { post, emitted, decided, contexts, tick: ms => { clock += ms; } };
}
const ask = (over = {}) => ({ requestId: 'chat-1', message: '  Vad har jag?  ', roundRevision: 'shared-room-a-round-4', acceptsSpeechStream: false, ...over });
const frames = async response => (await response.text()).trim().split('\n').map(line => JSON.parse(line));

test('a member question streams NDJSON and reaches the room as question and dealer answer', async t => {
  const h = await fixture(t);
  const response = await h.post(ask());
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
  const body = await frames(response);
  assert.deepEqual(body.map(frame => frame.type), ['progress', 'preview', 'result']);
  assert.deepEqual(body.at(-1).decision, { kind: 'generatedText', requestId: 'chat-1', dealerId: 'paow', exactText: 'Du har sexton, jag skulle stanna.' });
  assert.deepEqual(h.emitted.map(({ roomId, requestId, actorId, seat, text }) => ({ roomId, requestId, actorId, seat, text })), [
    { roomId: 'room-a', requestId: 'chat-1', actorId: 'player-a', seat: 1, text: 'Vad har jag?' },
    { roomId: 'room-a', requestId: 'chat-1', actorId: null, seat: null, text: 'Du har sexton, jag skulle stanna.' }]);
  assert.equal(h.contexts.length, 3, 'authorization and round are read again before the answer is published');
  assert.equal(sharedRoomChatRound({ roundId: null, windowId: 'w' }), 'window:w');
});

test('OpenClaw gets only a public projection: no hole card, holeDraw, room id or session id', async t => {
  const h = await fixture(t);
  assert.equal((await h.post(ask())).status, 200);
  const { status, request } = h.decided[0], wire = JSON.stringify(projectOpenClawGameStatus(status));
  assert.deepEqual(request, { requestId: 'chat-1', message: 'Vad har jag?', history: [] });
  assert.ok(!JSON.stringify(status).includes('holeDraw')); assert.ok(!wire.includes('holeDraw'));
  assert.deepEqual(projectOpenClawGameStatus(status).visibleCards.dealer.cards, [{ r: 'K', s: '♠', faceDown: false }]);
  assert.ok(!wire.includes('"r":"Q"'));
  for (const secret of ['room-a', binding.sessionId, 'player-a', 'shared-room-a-round-4', 'available', 'stake']) assert.ok(!wire.includes(secret), secret);
});

test('origin, method, JSON, membership and authentication fail closed before OpenClaw', async t => {
  const h = await fixture(t, { read: () => snapshot({ me: { id: 'player-a', seats: [], active: false } }) });
  const cases = [
    [await h.post(ask(), { headers: { origin: 'https://evil.example.test' } }), 403, 'shared_room_invalid_origin'],
    [await h.post(ask(), { headers: { authorization: 'Bearer x' } }), 403, 'shared_room_invalid_origin'],
    [await h.post(null, { method: 'GET' }), 405, 'shared_room_method_not_allowed'],
    [await h.post(ask(), { headers: { 'content-type': 'text/plain' } }), 415, 'shared_room_json_required'],
    [await h.post({ ...ask(), extra: 1 }), 400, 'shared_room_invalid_request'],
    [await h.post(ask({ message: 'x'.repeat(1001) })), 400, 'shared_room_invalid_request'],
    [await h.post(ask(), { headers: { cookie: 'croupier_session=mallory' } }), 401, 'shared_room_authentication_required'],
    [await h.post(ask()), 403, 'shared_room_chat_not_member'],
  ];
  for (const [response, status, error] of cases) {
    assert.equal(response.status, status, error); assert.deepEqual(await response.json(), { error });
  }
  assert.equal(h.decided.length, 0); assert.equal(h.emitted.length, 0);
});

test('a question for another round is 409; a round that moves during the answer is never published', async t => {
  let reads = 0;
  const h = await fixture(t, { read: () => ++reads === 3 ? snapshot({ roundId: 'shared-room-a-round-5' }) : snapshot() });
  const stale = await h.post(ask({ roundRevision: 'shared-room-a-round-3' }));
  assert.equal(stale.status, 409); assert.deepEqual(await stale.json(), { error: 'stale_round_revision' });
  assert.equal(h.decided.length, 0);
  const moved = await frames(await h.post(ask({ requestId: 'chat-2' })));
  assert.deepEqual(moved.at(-1), { type: 'error', error: 'stale_round_revision' });
  assert.deepEqual(h.emitted.map(entry => entry.actorId), ['player-a'], 'no dealer line for a stale answer');
});

test('missing OpenClaw keys answer 503 with their code and never call OpenClaw or publish', async t => {
  for (const [settings, error] of [[{}, 'openclaw_not_configured'], [{ speechUrl: 'https://director.invalid' }, 'product_speech_relay_not_configured']]) {
    const h = await fixture(t, { settings });
    const response = await h.post(ask());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error });
    assert.equal(h.decided.length, 0); assert.equal(h.emitted.length, 0);
  }
});

test('one open question per actor and ten seconds between questions', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = await fixture(t, { decide: async request => { await gate; return { kind: 'generatedText', requestId: request.requestId, exactText: 'Visst.' }; } });
  const first = h.post(ask());
  await new Promise(resolve => setTimeout(resolve, 50));
  const busy = await h.post(ask({ requestId: 'chat-2' }));
  assert.equal(busy.status, 429); assert.deepEqual(await busy.json(), { error: 'shared_room_chat_busy' });
  release(); assert.equal((await first).status, 200);
  h.tick(9999);
  const soon = await h.post(ask({ requestId: 'chat-3' }));
  assert.equal(soon.status, 429); assert.deepEqual(await soon.json(), { error: 'shared_room_chat_too_soon' });
  h.tick(1);
  assert.equal((await h.post(ask({ requestId: 'chat-4' }))).status, 200);
});

// PR 2: speech for the asker. A stubbed moving runtime records what the room hands it.
function speechPorts({ supports = true, requested = true, prepare, still = null } = {}) {
  const calls = { forContext: [], prepare: [], cancelled: [] };
  const descriptor = Object.freeze({ schemaVersion: 1, kind: 'moving-speech-stream', id: 'a'.repeat(32), url: '/moving-speech-stream', ticket: 'body.sig' });
  const movingSpeech = { supports: dealerId => supports && dealerId === 'paow', cancelOwner: owner => calls.cancelled.push(owner),
    forContext: (context, presentationVersion, sessionRevision) => {
      calls.forContext.push({ context, presentationVersion, sessionRevision });
      return { prepare: async input => { calls.prepare.push(input); await input.beforeCostly(); return prepare ? prepare(input) : descriptor; } };
    } };
  return { calls, descriptor, speech: () => ({ movingSpeech, speechStream: still, dealerSpeech: { requested: async dealerId => requested && dealerId === 'paow' } }) };
}

test('acceptsSpeechStream: the moving runtime gets the room context and binding owner; the ticket goes to the asker', async t => {
  const ports = speechPorts(), h = await fixture(t, { speech: ports.speech });
  const body = await frames(await h.post(ask({ acceptsSpeechStream: true })));
  assert.deepEqual(body.map(frame => frame.type), ['progress', 'preview', 'progress', 'result']);
  const { decision } = body.at(-1);
  assert.deepEqual(decision.speechStream, ports.descriptor); assert.equal(decision.visualMode, 'generated-lipsync-stream-preview');
  assert.equal(body.at(-1).speech, undefined);
  assert.equal(ports.calls.forContext.length, 1);
  const [{ context, presentationVersion, sessionRevision }] = ports.calls.forContext, [input] = ports.calls.prepare;
  assert.equal(context, roomContext); assert.equal(presentationVersion, undefined); assert.match(sessionRevision, /^s[a-f0-9]{24}$/);
  assert.equal(input.owner, binding.sessionId); assert.equal(input.playerId, 'player-a'); assert.equal(input.dealerId, 'paow');
  assert.equal(input.text, 'Du har sexton, jag skulle stanna.'); assert.equal(input.requestId, 'chat-1'); assert.equal(Object.hasOwn(input, 'presentationVersion'), false);
  assert.deepEqual(ports.calls.cancelled, [binding.sessionId], 'a new question cancels the earlier answer of this owner');
  assert.equal(h.emitted.at(-1).text, 'Du har sexton, jag skulle stanna.');
});

test('speech never fails the text: busy, no profile and no lane answer text-only with a reason', async t => {
  const busy = speechPorts({ prepare: () => { throw Object.assign(Error('generated_speech_session_busy'), { code: 'generated_speech_session_busy', statusCode: 429 }); } });
  const cases = [[busy, 'generated_speech_session_busy'], [speechPorts({ requested: false }), 'generated_speech_profile_not_enabled'],
    [speechPorts({ supports: false }), 'moving_speech_dealer_unavailable'],
    [speechPorts({ prepare: () => { throw Object.assign(Error('https://private.example/?key=secret'), { code: 'provider_private' }); } }), 'moving_speech_unavailable']];
  for (const [ports, reason] of cases) {
    const h = await fixture(t, { speech: ports.speech }), response = await h.post(ask({ acceptsSpeechStream: true }));
    assert.equal(response.status, 200, reason);
    const result = (await frames(response)).at(-1);
    assert.deepEqual(result, { type: 'result', speech: 'text-only', reason,
      decision: { kind: 'generatedText', requestId: 'chat-1', dealerId: 'paow', exactText: 'Du har sexton, jag skulle stanna.' } });
    assert.equal(h.emitted.length, 2, 'question and answer still reach the room');
  }
  assert.equal(busy.calls.prepare.length, 1);
});

test('without a moving lane the still-image stream is used; without acceptsSpeechStream nothing is prepared', async t => {
  const still = { prepared: [], prepare: async input => { still.prepared.push(input); return { kind: 'generated-speech-stream' }; } };
  const ports = speechPorts({ supports: false, still }), h = await fixture(t, { speech: ports.speech });
  assert.deepEqual((await frames(await h.post(ask({ acceptsSpeechStream: true })))).at(-1).decision.speechStream, { kind: 'generated-speech-stream' });
  assert.equal(still.prepared[0].owner, binding.sessionId); assert.equal(ports.calls.forContext.length, 0);
  h.tick(10000);
  const plain = (await frames(await h.post(ask({ requestId: 'chat-2' })))).at(-1);
  assert.equal(plain.decision.speechStream, undefined); assert.equal(plain.speech, undefined); assert.equal(still.prepared.length, 1);
});
