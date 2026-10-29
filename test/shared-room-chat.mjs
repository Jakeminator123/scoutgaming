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
  const emitted = [], decided = [], contexts = [], members = [];
  let engineOrigin, clock = 1000;
  // chatMember is the unlocked admission read; chatContext stands for the locked read (room lock,
  // the player's FOR UPDATE row and the audit advisory lock), counted in contexts.
  const service = {
    async chatMember(request, { roomId }) {
      members.push(roomId);
      if (request.headers.get('cookie') !== cookie) throw Object.assign(Error('private'), { statusCode: 401 });
      return { binding, snapshot: read('member', members.length) };
    },
    async chatContext(request, { roomId }) {
      contexts.push(roomId);
      if (request.headers.get('cookie') !== cookie) throw Object.assign(Error('private'), { statusCode: 401 });
      return { binding, dealerId: 'paow', presentationContext: roomContext, snapshot: read('locked', contexts.length) };
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
  const post = (body, { headers = {}, method = 'POST', room = 'room-a', signal } = {}) => fetch(`${engineOrigin}/api/shared-room/${room}/chat`, {
    method, headers: { origin, cookie, 'content-type': 'application/json', ...headers }, signal,
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  return { post, emitted, decided, contexts, members, close: () => chat.close(), tick: ms => { clock += ms; } };
}
const ask = (over = {}) => ({ requestId: 'chat-1', message: '  Vad har jag?  ', roundRevision: 'shared-room-a-round-4', acceptsSpeechStream: false, ...over });
const frames = async response => (await response.text()).trim().split('\n').map(line => JSON.parse(line));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a member question streams NDJSON and reaches the room as question and dealer answer', async t => {
  const h = await fixture(t);
  const response = await h.post(ask());
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
  const body = await frames(response);
  assert.deepEqual(body.map(frame => frame.type), ['progress', 'preview', 'result']);
  const { questionLineId, lineId, ...decision } = body.at(-1).decision;
  assert.deepEqual(decision, { kind: 'generatedText', requestId: 'chat-1', dealerId: 'paow', exactText: 'Du har sexton, jag skulle stanna.' });
  assert.deepEqual(h.emitted.map(entry => entry.lineId), [questionLineId, lineId], 'NDJSON and the room carry the same server line ids');
  assert.deepEqual(h.emitted.map(({ roomId, requestId, actorId, seat, text }) => ({ roomId, requestId, actorId, seat, text })), [
    { roomId: 'room-a', requestId: 'chat-1', actorId: 'player-a', seat: 1, text: 'Vad har jag?' },
    { roomId: 'room-a', requestId: 'chat-1', actorId: null, seat: null, text: 'Du har sexton, jag skulle stanna.' }]);
  assert.equal(h.contexts.length, 2, 'one locked read at admission and one before the answer is published');
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
  const h = await fixture(t, { read: kind => kind === 'locked' && ++reads === 2 ? snapshot({ roundId: 'shared-room-a-round-5' }) : snapshot() });
  const stale = await h.post(ask({ roundRevision: 'shared-room-a-round-3' }));
  assert.equal(stale.status, 409); assert.deepEqual(await stale.json(), { error: 'stale_round_revision' });
  assert.equal(h.decided.length, 0); assert.equal(h.contexts.length, 0, 'a stale question takes no lock');
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
    assert.match(result.decision.questionLineId, /^q-/); assert.match(result.decision.lineId, /^a-/);
    delete result.decision.questionLineId; delete result.decision.lineId;
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

test('review fix: 20 parallel questions from one member take at most one locked read', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = await fixture(t, { decide: async request => { await gate; return { kind: 'generatedText', requestId: request.requestId, exactText: 'Visst.' }; } });
  const pending = Array.from({ length: 20 }, (_, index) => h.post(ask({ requestId: 'chat-' + index })));
  const settled = [];
  for (const response of pending) settled.push(await Promise.race([response, new Promise(resolve => setTimeout(() => resolve(null), 300))]));
  const refused = settled.filter(response => response?.status === 429);
  assert.equal(refused.length, 19);
  for (const response of refused) assert.deepEqual(await response.json(), { error: 'shared_room_chat_busy' });
  // The admitted question takes one locked read before the answer (completeChatWithSpeech's first
  // check reuses it); the 19 refused questions take none.
  assert.ok(h.contexts.length <= 1, `locked reads before the answer: ${h.contexts.length}`);
  release(); await Promise.all(pending);
  const solo = await fixture(t);
  assert.equal((await solo.post(ask())).status, 200);
  assert.equal(h.contexts.length, solo.contexts.length, 'twenty questions cost exactly the locked reads of one');
  // Missing keys are refused before any lock as well.
  const off = await fixture(t, { settings: {} });
  for (let index = 0; index < 5; index++) assert.equal((await off.post(ask({ requestId: 'off-' + index }))).status, 503);
  assert.equal(off.contexts.length, 0);
});

test('review fix: line ids are the server\'s; a reused requestId from another member never matches', async t => {
  const h = await fixture(t);
  const one = (await frames(await h.post(ask()))).at(-1).decision;
  h.tick(10000);
  const two = (await frames(await h.post(ask()))).at(-1).decision;
  for (const value of [one.questionLineId, one.lineId, two.questionLineId, two.lineId]) assert.match(value, /^[qa]-[0-9a-f]{24}$/);
  assert.equal(new Set([one.questionLineId, one.lineId, two.questionLineId, two.lineId]).size, 4, 'the same requestId twice gives four distinct rows');
  assert.ok(!one.lineId.includes('chat-1'));
});

test('review fix: control, bidi and zero-width characters are refused before the room sees the question', async t => {
  const h = await fixture(t);
  for (const message of ['Hej\u0007', 'Hej \u202edu', 'Hej\u2066du\u2069', 'H\u200bej', 'Hej\u200f', 'He\ufeffj', 'a\u2028b']) {
    const response = await h.post(ask({ message }));
    assert.equal(response.status, 400, JSON.stringify(message)); assert.deepEqual(await response.json(), { error: 'shared_room_invalid_request' });
  }
  assert.equal(h.emitted.length, 0); assert.equal(h.decided.length, 0); assert.equal(h.members.length, 0);
  assert.equal((await h.post(ask({ message: 'Rad ett\nrad två å ä ö 👍' }))).status, 200);
});

// Review fix (PR 2): the room lock is global (pg_advisory_xact_lock), so speech never holds it per chunk.
test('review fix: a spoken answer takes two locked reads, however many chunks it prepares and streams', async t => {
  let stream;
  const ports = speechPorts({ prepare: async input => { for (let chunk = 0; chunk < 3; chunk++) await input.beforeCostly(); stream = input; return ports.descriptor; } });
  const h = await fixture(t, { speech: ports.speech });
  assert.deepEqual((await frames(await h.post(ask({ acceptsSpeechStream: true })))).at(-1).decision.speechStream, ports.descriptor);
  for (let chunk = 0; chunk < 10; chunk++) await stream.beforeCostly();
  assert.equal(h.contexts.length, 2, `locked reads for a whole spoken answer: ${h.contexts.length}`);
  assert.ok(h.members.length >= 15, 'every speech check still rereads membership and round, without a lock');
});

test('review fix: a round that moves on the read after prepare cancels the prepared speech once and keeps the text', async t => {
  let prepared = false, before;
  const ports = speechPorts({ prepare: () => { prepared = true; before = ports.calls.cancelled.length; return ports.descriptor; } });
  const h = await fixture(t, { speech: ports.speech, read: () => snapshot(prepared ? { roundId: 'shared-room-a-round-5' } : {}) });
  const result = (await frames(await h.post(ask({ acceptsSpeechStream: true })))).at(-1);
  assert.equal(result.speech, 'text-only'); assert.equal(result.decision.speechStream, undefined);
  assert.equal(result.decision.exactText, 'Du har sexton, jag skulle stanna.');
  assert.equal(ports.calls.cancelled.length - before, 1, 'the prepared speech is cancelled at once');
});

test('review fix: a member who leaves the table mid-stream fails the next speech check', async t => {
  let stream, left = false;
  const ports = speechPorts({ prepare: input => { stream = input; return ports.descriptor; } });
  const h = await fixture(t, { speech: ports.speech, read: () => snapshot(left ? { me: { id: 'player-a', seats: [], active: false } } : {}) });
  assert.ok((await frames(await h.post(ask({ acceptsSpeechStream: true })))).at(-1).decision.speechStream);
  await stream.beforeCostly();
  left = true;
  await assert.rejects(stream.beforeCostly(), /stale_round_revision/);
});

test('review fix: a client that disconnects during prepare cancels the speech it started', async t => {
  let reached, release, before;
  const hit = new Promise(resolve => { reached = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const ports = speechPorts({ prepare: async () => { before = ports.calls.cancelled.length; reached(); await gate; return ports.descriptor; } });
  const h = await fixture(t, { speech: ports.speech });
  const controller = new AbortController();
  const response = await h.post(ask({ acceptsSpeechStream: true }), { signal: controller.signal });
  assert.equal(response.status, 200);
  await hit; controller.abort(); await pause(50); release();
  for (let wait = 0; wait < 50 && ports.calls.cancelled.length === before; wait++) await pause(10);
  assert.equal(ports.calls.cancelled.length - before, 1, 'no speech is left running for a disconnected asker');
});

test('review fix: closing the chat route aborts open questions', async t => {
  let reached;
  const hit = new Promise(resolve => { reached = resolve; });
  const ports = speechPorts({ prepare: input => new Promise((_, reject) => {
    reached(); input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
  }) });
  const h = await fixture(t, { speech: ports.speech });
  const pending = h.post(ask({ acceptsSpeechStream: true })).then(frames);
  await hit; h.close();
  const body = await Promise.race([pending, pause(1000).then(() => null)]);
  assert.deepEqual(body?.at(-1), { type: 'error', error: 'shared_room_chat_cancelled' });
});
